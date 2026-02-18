/**
 * FB Browser Manager - Manages Puppeteer browser sessions for Facebook login
 *
 * Flow:
 * 1. Admin enters FB email/password in admin panel
 * 2. Puppeteer launches browser, navigates to facebook.com, enters credentials
 * 3. If 2FA is needed, waits for admin to provide code
 * 4. After login, captures EAA access token from network requests
 * 5. Token stored in ExtensionSession for the server-side worker to use
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

const FB_GRAPH_BASE = 'https://graph.facebook.com/v18.0'

// Active login sessions being processed
interface LoginSession {
  id: string
  status: 'launching' | 'logging_in' | 'needs_2fa' | 'submitting_2fa' | 'capturing_token' | 'success' | 'failed'
  browser: Browser | null
  page: Page | null
  error?: string
  fbName?: string
  fbUserId?: string
  capturedToken?: string
  screenshotBase64?: string
  createdAt: Date
}

const activeSessions = new Map<string, LoginSession>()

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of activeSessions.entries()) {
    // Remove sessions older than 10 minutes
    if (now - session.createdAt.getTime() > 10 * 60 * 1000) {
      cleanupSession(id)
    }
  }
}, 60_000)

async function cleanupSession(id: string) {
  const session = activeSessions.get(id)
  if (session) {
    try {
      if (session.browser) await session.browser.close()
    } catch {}
    activeSessions.delete(id)
  }
}

function generateSessionId(): string {
  return 'fbl_' + crypto.randomBytes(8).toString('hex')
}

// ==================== Start Login ====================

export async function startFbLogin(email: string, password: string): Promise<{ sessionId: string }> {
  const sessionId = generateSessionId()

  const loginSession: LoginSession = {
    id: sessionId,
    status: 'launching',
    browser: null,
    page: null,
    createdAt: new Date(),
  }
  activeSessions.set(sessionId, loginSession)

  // Launch browser in background (don't await)
  performLogin(sessionId, email, password).catch(err => {
    console.error(`[FBBrowser] Login error for ${sessionId}:`, err.message)
    const s = activeSessions.get(sessionId)
    if (s) {
      s.status = 'failed'
      s.error = err.message
    }
  })

  return { sessionId }
}

async function performLogin(sessionId: string, email: string, password: string) {
  const session = activeSessions.get(sessionId)
  if (!session) return

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-notifications',
      '--window-size=1280,800',
    ],
  })

  session.browser = browser
  const page = await browser.newPage()
  session.page = page

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 800 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  // Intercept network requests to capture access tokens
  let capturedToken: string | null = null

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    req.continue()
  })

  page.on('response', async (response) => {
    try {
      const url = response.url()
      // Look for Graph API calls or token in URL params
      if (url.includes('access_token=EAA') || url.includes('graph.facebook.com')) {
        const urlObj = new URL(url)
        const tokenFromUrl = urlObj.searchParams.get('access_token')
        if (tokenFromUrl && tokenFromUrl.startsWith('EAA')) {
          capturedToken = tokenFromUrl
          console.log(`[FBBrowser] Captured token from URL: ${tokenFromUrl.substring(0, 20)}...`)
        }
      }

      // Check response body for tokens
      if (url.includes('facebook.com') && response.headers()['content-type']?.includes('json')) {
        try {
          const text = await response.text()
          const tokenMatch = text.match(/(EAA[A-Za-z0-9]+)/g)
          if (tokenMatch) {
            for (const t of tokenMatch) {
              if (t.length > 30) {
                capturedToken = t
                console.log(`[FBBrowser] Captured token from response: ${t.substring(0, 20)}...`)
              }
            }
          }
        } catch {}
      }
    } catch {}
  })

  session.status = 'logging_in'

  // Navigate to Facebook
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 })

  // Close cookie dialog if present
  try {
    const cookieBtn = await page.$('[data-cookiebanner="accept_button"]')
    if (cookieBtn) await cookieBtn.click()
  } catch {}

  await sleep(1000)

  // Enter email
  await page.waitForSelector('#email', { timeout: 10000 })
  await page.type('#email', email, { delay: 50 })
  await sleep(500)

  // Enter password
  await page.type('#pass', password, { delay: 50 })
  await sleep(500)

  // Click login button
  await page.click('[name="login"]')

  // Wait for navigation
  await sleep(5000)

  // Take screenshot to see current state
  const screenshot = await page.screenshot({ encoding: 'base64' })
  session.screenshotBase64 = screenshot as string

  // Check if we landed on a 2FA page
  const currentUrl = page.url()
  const pageContent = await page.content()

  const needs2FA = currentUrl.includes('checkpoint') ||
    currentUrl.includes('two_step_verification') ||
    pageContent.includes('approvals_code') ||
    pageContent.includes('Enter the code') ||
    pageContent.includes('Two-factor authentication') ||
    pageContent.includes('Login code') ||
    pageContent.includes('Enter Code') ||
    pageContent.includes('security code')

  const loginFailed = pageContent.includes('Wrong credentials') ||
    pageContent.includes('The password that you') ||
    pageContent.includes('incorrect password') ||
    pageContent.includes('The email address you entered')

  if (loginFailed) {
    session.status = 'failed'
    session.error = 'Invalid email or password'
    await browser.close()
    session.browser = null
    session.page = null
    return
  }

  if (needs2FA) {
    session.status = 'needs_2fa'
    console.log(`[FBBrowser] 2FA required for session ${sessionId}`)
    return // Wait for 2FA code submission
  }

  // Login succeeded, try to capture token
  await captureTokenAfterLogin(sessionId, capturedToken)
}

// ==================== Submit 2FA Code ====================

export async function submit2FACode(sessionId: string, code: string): Promise<void> {
  const session = activeSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (!session.page) throw new Error('No browser page available')
  if (session.status !== 'needs_2fa') throw new Error(`Session is not waiting for 2FA (status: ${session.status})`)

  session.status = 'submitting_2fa'

  const page = session.page

  try {
    // Try different 2FA input selectors
    const selectors = [
      'input[name="approvals_code"]',
      'input[id="approvals_code"]',
      '#approvals_code',
      'input[type="text"][autocomplete]',
      'input[type="tel"]',
      'input[type="number"]',
    ]

    let inputFound = false
    for (const selector of selectors) {
      try {
        const input = await page.$(selector)
        if (input) {
          await input.click({ clickCount: 3 }) // Select all
          await input.type(code, { delay: 50 })
          inputFound = true
          break
        }
      } catch {}
    }

    if (!inputFound) {
      // Try to find any visible text input
      const inputs = await page.$$('input[type="text"], input[type="tel"], input[type="number"]')
      for (const input of inputs) {
        const visible = await input.isVisible()
        if (visible) {
          await input.click({ clickCount: 3 })
          await input.type(code, { delay: 50 })
          inputFound = true
          break
        }
      }
    }

    if (!inputFound) {
      throw new Error('Could not find 2FA input field')
    }

    await sleep(500)

    // Click submit/continue button
    const buttonSelectors = [
      '#checkpointSubmitButton',
      'button[type="submit"]',
      '[data-testid="checkpoint_submit_button"]',
      'button[name="submit[Continue]"]',
    ]

    for (const selector of buttonSelectors) {
      try {
        const btn = await page.$(selector)
        if (btn) {
          await btn.click()
          break
        }
      } catch {}
    }

    await sleep(5000)

    // Take screenshot
    const screenshot = await page.screenshot({ encoding: 'base64' })
    session.screenshotBase64 = screenshot as string

    // Check if still on checkpoint
    const url = page.url()
    const content = await page.content()

    if (url.includes('checkpoint') && (content.includes('approvals_code') || content.includes('Enter Code'))) {
      session.status = 'needs_2fa'
      session.error = 'Invalid 2FA code, please try again'
      return
    }

    // Sometimes FB asks "Remember this browser?"
    if (content.includes('Remember this browser') || content.includes('Save Browser') || content.includes('remember_browser')) {
      try {
        // Click "Continue" or "Save" to remember
        const continueBtn = await page.$('button[type="submit"]')
        if (continueBtn) await continueBtn.click()
        await sleep(3000)
      } catch {}
    }

    // Capture token
    await captureTokenAfterLogin(sessionId, null)
  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
    await cleanupSession(sessionId)
  }
}

// ==================== Capture Token After Login ====================

async function captureTokenAfterLogin(sessionId: string, preExistingToken: string | null) {
  const session = activeSessions.get(sessionId)
  if (!session || !session.page || !session.browser) return

  session.status = 'capturing_token'
  const page = session.page

  let token = preExistingToken

  // If we don't have a token yet, navigate to pages that trigger Graph API calls
  if (!token) {
    try {
      // Navigate to business.facebook.com to trigger API calls with tokens
      await page.goto('https://business.facebook.com/latest/home', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(3000)
    } catch {}
  }

  // Try getting token from cookies
  if (!token) {
    try {
      const cookies = await page.cookies('https://www.facebook.com')
      // Check for access token in cookies/localStorage
      const accessToken = await page.evaluate(() => {
        // Try to get token from various sources
        try {
          // Try __accessToken
          const scripts = document.querySelectorAll('script')
          for (const script of scripts) {
            const text = script.textContent || ''
            const match = text.match(/"accessToken":"(EAA[^"]+)"/)
            if (match) return match[1]
            const match2 = text.match(/"access_token":"(EAA[^"]+)"/)
            if (match2) return match2[1]
          }
        } catch {}
        return null
      })
      if (accessToken) {
        token = accessToken
        console.log(`[FBBrowser] Captured token from page scripts: ${token.substring(0, 20)}...`)
      }
    } catch {}
  }

  // Try making a direct Graph API call using the cookies session
  if (!token) {
    try {
      // Use Ads Manager which requires and provides access tokens
      await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(5000)

      // Try to extract token from the page
      const tokenFromPage = await page.evaluate(() => {
        try {
          const scripts = document.querySelectorAll('script')
          for (const script of scripts) {
            const text = script.textContent || ''
            const match = text.match(/(EAA[A-Za-z0-9]{30,})/)
            if (match) return match[1]
          }
          // Try window.__accessToken or similar globals
          const win = window as any
          if (win.__accessToken) return win.__accessToken
          if (win.__eaaid) return win.__eaaid
        } catch {}
        return null
      })

      if (tokenFromPage) {
        token = tokenFromPage
        console.log(`[FBBrowser] Captured token from Ads Manager: ${token.substring(0, 20)}...`)
      }
    } catch {}
  }

  // Take final screenshot
  try {
    const screenshot = await page.screenshot({ encoding: 'base64' })
    session.screenshotBase64 = screenshot as string
  } catch {}

  if (!token) {
    // Check if we're actually logged in by checking cookies
    const cookies = await page.cookies('https://www.facebook.com')
    const cUser = cookies.find(c => c.name === 'c_user')

    if (cUser) {
      // We're logged in but couldn't capture token — try the access token endpoint
      try {
        const fbUserId = cUser.value
        // Try getting an access token through the graph API debug endpoint
        const result = await page.evaluate(async (userId: string) => {
          try {
            const resp = await fetch(`https://www.facebook.com/ajax/bootloader-endpoint/?modules=fb-lite-bootstrapping`, {
              credentials: 'include'
            })
            const text = await resp.text()
            const tokenMatch = text.match(/(EAA[A-Za-z0-9]{30,})/)
            return tokenMatch ? tokenMatch[1] : null
          } catch {
            return null
          }
        }, fbUserId)

        if (result) {
          token = result
        }
      } catch {}
    }

    if (!token) {
      session.status = 'failed'
      session.error = 'Logged in but could not capture access token. Try using the Ads Manager URL method or paste token manually.'
      await cleanupSession(sessionId)
      return
    }
  }

  // Validate and exchange token
  try {
    const validateRes = await fetch(`${FB_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const validateData = await validateRes.json() as any

    if (validateData.error) {
      session.status = 'failed'
      session.error = `Captured token is invalid: ${validateData.error.message}`
      await cleanupSession(sessionId)
      return
    }

    session.fbName = validateData.name
    session.fbUserId = validateData.id

    // Exchange for long-lived token
    let finalToken = token
    const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

    if (FB_APP_ID && FB_APP_SECRET) {
      try {
        const exchangeUrl = `${FB_GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(token)}`
        const exchangeRes = await fetch(exchangeUrl)
        const exchangeData = await exchangeRes.json() as any
        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token
          console.log(`[FBBrowser] Token exchanged for long-lived`)
        }
      } catch {}
    }

    session.capturedToken = finalToken

    // Save to database
    const rawKey = 'ext_' + crypto.randomBytes(24).toString('hex')
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.substring(0, 12) + '...'

    await prisma.extensionSession.create({
      data: {
        name: `FB: ${validateData.name}`,
        apiKey: keyHash,
        apiKeyPrefix: keyPrefix,
        adAccountIds: [],
        fbAccessToken: finalToken,
        fbUserId: validateData.id,
        fbUserName: validateData.name,
      }
    })

    session.status = 'success'
    console.log(`[FBBrowser] Login complete: ${validateData.name} (${validateData.id})`)

  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
  }

  // Close browser
  await cleanupSession(sessionId)
}

// ==================== Get Login Status ====================

export function getLoginStatus(sessionId: string) {
  const session = activeSessions.get(sessionId)
  if (!session) return null

  return {
    id: session.id,
    status: session.status,
    error: session.error,
    fbName: session.fbName,
    fbUserId: session.fbUserId,
    screenshot: session.screenshotBase64 || null,
  }
}

// ==================== Get All Active Login Sessions ====================

export function getActiveLoginSessions() {
  const sessions: any[] = []
  for (const [id, session] of activeSessions.entries()) {
    sessions.push({
      id: session.id,
      status: session.status,
      error: session.error,
      fbName: session.fbName,
      createdAt: session.createdAt,
    })
  }
  return sessions
}

// ==================== Cancel Login ====================

export async function cancelLogin(sessionId: string) {
  await cleanupSession(sessionId)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
