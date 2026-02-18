/**
 * FB Browser Manager - Manages Puppeteer browser sessions for Facebook login
 *
 * Flow:
 * 1. Admin enters FB email/password (+ optional 2FA secret) in admin panel
 * 2. Puppeteer launches stealth browser, navigates to facebook.com, enters credentials
 * 3. If 2FA is needed and secret provided, auto-generates TOTP code and submits
 * 4. After login, captures EAA access token from page scripts/network
 * 5. Token stored in ExtensionSession for the server-side worker to use
 */

import puppeteer, { Browser, Page } from 'puppeteer'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import * as OTPAuth from 'otpauth'

const prisma = new PrismaClient()

const FB_GRAPH_BASE = 'https://graph.facebook.com/v18.0'

function log(msg: string) {
  console.log(`[FBBrowser] ${msg}`)
}

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
  twoFASecret?: string
  createdAt: Date
}

const activeSessions = new Map<string, LoginSession>()

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of activeSessions.entries()) {
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

// ==================== Stealth Helpers ====================

async function applyStealthToPage(page: Page) {
  // Override navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // Override chrome runtime
    ;(window as any).chrome = { runtime: {} }
    // Override permissions
    const originalQuery = (window as any).navigator.permissions?.query
    if (originalQuery) {
      ;(window as any).navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters)
    }
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })
    // Remove headless indicators from user agent
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    })
  })
}

// ==================== Start Login ====================

export async function startFbLogin(email: string, password: string, twoFASecret?: string): Promise<{ sessionId: string }> {
  const sessionId = generateSessionId()

  const loginSession: LoginSession = {
    id: sessionId,
    status: 'launching',
    browser: null,
    page: null,
    twoFASecret: twoFASecret || undefined,
    createdAt: new Date(),
  }
  activeSessions.set(sessionId, loginSession)

  // Launch browser in background (don't await)
  performLogin(sessionId, email, password).catch(err => {
    log(`Login error for ${sessionId}: ${err.message}`)
    const s = activeSessions.get(sessionId)
    if (s && s.status !== 'failed' && s.status !== 'success') {
      s.status = 'failed'
      s.error = err.message
    }
  })

  return { sessionId }
}

async function performLogin(sessionId: string, email: string, password: string) {
  const session = activeSessions.get(sessionId)
  if (!session) return

  log(`Starting login for ${sessionId}`)

  // Launch browser with stealth args
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-notifications',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
      '--lang=en-US',
    ],
  })

  session.browser = browser
  const page = await browser.newPage()
  session.page = page

  // Apply stealth
  await applyStealthToPage(page)

  // Set realistic viewport and user agent
  await page.setViewport({ width: 1280, height: 800 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

  // Set extra headers to look more realistic
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  })

  // Intercept network requests to capture access tokens
  let capturedToken: string | null = null

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    req.continue()
  })

  page.on('response', async (response) => {
    try {
      const url = response.url()
      if (url.includes('access_token=EAA') || url.includes('graph.facebook.com')) {
        const urlObj = new URL(url)
        const tokenFromUrl = urlObj.searchParams.get('access_token')
        if (tokenFromUrl && tokenFromUrl.startsWith('EAA')) {
          capturedToken = tokenFromUrl
          log(`Captured token from URL: ${tokenFromUrl.substring(0, 20)}...`)
        }
      }

      if (url.includes('facebook.com') && response.headers()['content-type']?.includes('json')) {
        try {
          const text = await response.text()
          const tokenMatch = text.match(/(EAA[A-Za-z0-9]{30,})/g)
          if (tokenMatch) {
            for (const t of tokenMatch) {
              if (t.length > 30) {
                capturedToken = t
                log(`Captured token from response: ${t.substring(0, 20)}...`)
              }
            }
          }
        } catch {}
      }
    } catch {}
  })

  session.status = 'logging_in'

  // Use m.facebook.com (mobile) — simpler HTML, less bot detection, more reliable selectors
  await page.goto('https://m.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 30000 })
  log(`Page loaded: ${page.url()}`)

  // Take screenshot to see what we got
  await takeScreenshot(session, page)

  // Close cookie dialog if present (try multiple selectors)
  try {
    const cookieSelectors = [
      '[data-cookiebanner="accept_button"]',
      'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
      '[title="Allow all cookies"]',
      '[value="Accept All"]',
      'button[name="accept"]',
    ]
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        log(`Clicked cookie accept: ${sel}`)
        await sleep(1500)
        break
      }
    }
  } catch {}

  await sleep(1000)

  // Find and fill email — try multiple selectors
  const emailSelectors = ['#email', '#m_login_email', 'input[name="email"]', 'input[type="email"]', 'input[type="text"]']
  let emailInput = null
  for (const sel of emailSelectors) {
    try {
      emailInput = await page.$(sel)
      if (emailInput) {
        const visible = await emailInput.isVisible().catch(() => true)
        if (visible) {
          log(`Found email input: ${sel}`)
          break
        }
        emailInput = null
      }
    } catch {}
  }

  if (!emailInput) {
    // Last resort: take screenshot and fail with useful error
    await takeScreenshot(session, page)
    const html = await page.content()
    log(`Could not find email input. Page URL: ${page.url()}, HTML length: ${html.length}`)
    session.status = 'failed'
    session.error = 'Could not find login form on Facebook. Facebook may be blocking the server IP.'
    await cleanupSession(sessionId)
    return
  }

  await emailInput.click()
  await sleep(300)
  await emailInput.type(email, { delay: 80 + Math.random() * 40 })
  await sleep(800)

  // Find and fill password
  const passSelectors = ['#pass', '#m_login_password', 'input[name="pass"]', 'input[type="password"]']
  let passInput = null
  for (const sel of passSelectors) {
    try {
      passInput = await page.$(sel)
      if (passInput) {
        log(`Found password input: ${sel}`)
        break
      }
    } catch {}
  }

  if (!passInput) {
    session.status = 'failed'
    session.error = 'Could not find password field'
    await cleanupSession(sessionId)
    return
  }

  await passInput.click()
  await sleep(200)
  await passInput.type(password, { delay: 70 + Math.random() * 50 })
  await sleep(1000)

  // Click login button — try multiple selectors
  const loginBtnSelectors = ['[name="login"]', 'button[data-testid="royal_login_button"]', 'button[type="submit"]', 'input[type="submit"]', '#loginbutton']
  for (const sel of loginBtnSelectors) {
    try {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        log(`Clicked login button: ${sel}`)
        break
      }
    } catch {}
  }

  // Wait for navigation
  await sleep(6000)

  // Take screenshot
  await takeScreenshot(session, page)

  // Analyze current page
  const currentUrl = page.url()
  const pageContent = await page.content()
  log(`After login URL: ${currentUrl}`)

  // Check for login failure
  const loginFailed = pageContent.includes('Wrong credentials') ||
    pageContent.includes('The password that you') ||
    pageContent.includes('incorrect password') ||
    pageContent.includes('The email address you entered') ||
    pageContent.includes('Please re-enter your password')

  if (loginFailed) {
    session.status = 'failed'
    session.error = 'Invalid email or password'
    log(`Login failed: invalid credentials`)
    await cleanupSession(sessionId)
    return
  }

  // Check for 2FA / checkpoint
  const needs2FA = currentUrl.includes('checkpoint') ||
    currentUrl.includes('two_step_verification') ||
    pageContent.includes('approvals_code') ||
    pageContent.includes('Enter the code') ||
    pageContent.includes('Two-factor authentication') ||
    pageContent.includes('Login code') ||
    pageContent.includes('Enter Code') ||
    pageContent.includes('security code') ||
    pageContent.includes('login approval') ||
    pageContent.includes('Code Generator')

  if (needs2FA) {
    log(`2FA/checkpoint detected at: ${currentUrl}`)

    if (session.twoFASecret) {
      // Auto-generate TOTP code
      log(`Auto-generating TOTP code from secret`)
      session.status = 'submitting_2fa'
      const code = generateTOTPCode(session.twoFASecret)
      log(`Generated TOTP code: ${code}`)

      // Wait a bit more for the page to fully render
      await sleep(2000)
      await takeScreenshot(session, page)

      const submitted = await submitCodeOnPage(page, code)
      if (submitted) {
        log(`2FA code submitted successfully, waiting...`)
        await sleep(6000)
        await takeScreenshot(session, page)

        // Handle "Remember browser?" or "Continue" prompts
        await handlePostCheckpointPrompts(page)

        // Now capture token
        await captureTokenAfterLogin(sessionId, capturedToken)
      } else {
        log(`Could not find 2FA input field, page may have CAPTCHA`)
        // Don't fail — still try to capture token, maybe the page moved on
        session.error = 'Could not find 2FA input field on page'
        await captureTokenAfterLogin(sessionId, capturedToken)
      }
      return
    }

    // No secret — wait for manual 2FA code
    session.status = 'needs_2fa'
    log(`Waiting for manual 2FA code for ${sessionId}`)
    return
  }

  // Check if we're on the homepage (login succeeded)
  log(`No 2FA needed, checking if logged in...`)
  await captureTokenAfterLogin(sessionId, capturedToken)
}

// ==================== TOTP Code Generation ====================

function generateTOTPCode(secret: string): string {
  const cleanSecret = secret.replace(/[\s-]/g, '').toUpperCase()

  const totp = new OTPAuth.TOTP({
    issuer: 'Facebook',
    label: 'FB',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(cleanSecret),
  })

  return totp.generate()
}

// ==================== Submit Code on Page ====================

async function submitCodeOnPage(page: Page, code: string): Promise<boolean> {
  // Extended list of selectors for 2FA input
  const inputSelectors = [
    'input[name="approvals_code"]',
    'input[id="approvals_code"]',
    '#approvals_code',
    'input[name="code"]',
    'input[autocomplete="one-time-code"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="text"][autocomplete]',
    'input[type="text"]',
  ]

  let inputFound = false

  // First try specific selectors
  for (const selector of inputSelectors) {
    try {
      const input = await page.$(selector)
      if (input) {
        const visible = await input.isVisible().catch(() => true)
        if (visible) {
          await input.click({ clickCount: 3 })
          await sleep(200)
          await input.type(code, { delay: 60 })
          inputFound = true
          log(`Typed code into: ${selector}`)
          break
        }
      }
    } catch {}
  }

  // Fallback: find any visible input
  if (!inputFound) {
    try {
      const allInputs = await page.$$('input')
      for (const input of allInputs) {
        const visible = await input.isVisible().catch(() => false)
        if (!visible) continue
        const type = await input.evaluate((el: any) => el.type)
        const name = await input.evaluate((el: any) => el.name)
        // Skip hidden, password, email, submit inputs
        if (['hidden', 'password', 'email', 'submit', 'checkbox', 'radio', 'file'].includes(type)) continue
        log(`Fallback: typing into input[name=${name}, type=${type}]`)
        await input.click({ clickCount: 3 })
        await sleep(200)
        await input.type(code, { delay: 60 })
        inputFound = true
        break
      }
    } catch {}
  }

  if (!inputFound) {
    log(`No input field found for 2FA code`)
    return false
  }

  await sleep(500)

  // Click submit button
  const buttonSelectors = [
    '#checkpointSubmitButton',
    'button[type="submit"]',
    '[data-testid="checkpoint_submit_button"]',
    'button[name="submit[Continue]"]',
    'button[value="Continue"]',
    'input[type="submit"]',
    '[role="button"][tabindex="0"]',
  ]

  for (const selector of buttonSelectors) {
    try {
      const btn = await page.$(selector)
      if (btn) {
        const visible = await btn.isVisible().catch(() => true)
        if (visible) {
          await btn.click()
          log(`Clicked submit: ${selector}`)
          break
        }
      }
    } catch {}
  }

  return true
}

// ==================== Handle Post-Checkpoint Prompts ====================

async function handlePostCheckpointPrompts(page: Page) {
  const content = await page.content()
  const url = page.url()

  // "Remember this browser?"
  if (content.includes('Remember') || content.includes('Save Browser') || content.includes('remember_browser') || content.includes('Don\'t Save')) {
    log(`"Remember browser?" prompt detected, clicking continue...`)
    try {
      // Try to click "Continue" / "Save" / first submit button
      const btn = await page.$('button[type="submit"]')
      if (btn) {
        await btn.click()
        await sleep(3000)
      }
    } catch {}
  }

  // "Check Notifications" or "Where You're Logged In" or other checkpoint follow-ups
  if (url.includes('checkpoint')) {
    log(`Still on checkpoint, trying to continue...`)
    try {
      const submitBtn = await page.$('button[type="submit"]')
      if (submitBtn) {
        await submitBtn.click()
        await sleep(3000)
      }
    } catch {}
  }
}

// ==================== Submit 2FA Code (Manual) ====================

export async function submit2FACode(sessionId: string, code: string): Promise<void> {
  const session = activeSessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (!session.page) throw new Error('No browser page available')
  if (session.status !== 'needs_2fa') throw new Error(`Session is not waiting for 2FA (status: ${session.status})`)

  session.status = 'submitting_2fa'
  const page = session.page

  try {
    const submitted = await submitCodeOnPage(page, code)

    if (!submitted) {
      throw new Error('Could not find 2FA input field')
    }

    await sleep(6000)
    await takeScreenshot(session, page)

    // Check if still on checkpoint
    const url = page.url()
    const content = await page.content()

    if (url.includes('checkpoint') && (content.includes('approvals_code') || content.includes('Enter Code') || content.includes('Enter the code'))) {
      session.status = 'needs_2fa'
      session.error = 'Invalid 2FA code, please try again'
      return
    }

    await handlePostCheckpointPrompts(page)

    // Capture token
    await captureTokenAfterLogin(sessionId, null)
  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
    await cleanupSession(sessionId)
  }
}

// ==================== Take Screenshot Helper ====================

async function takeScreenshot(session: LoginSession, page: Page) {
  try {
    const screenshot = await page.screenshot({ encoding: 'base64' })
    session.screenshotBase64 = screenshot as string
  } catch {}
}

// ==================== Copy Cookies Between Domains ====================

async function copyCookiesToDomain(page: Page, fromDomain: string, toDomains: string[]) {
  try {
    // Get all cookies from the source domain
    const cookies = await page.cookies(`https://${fromDomain}`)
    log(`Found ${cookies.length} cookies from ${fromDomain}`)

    if (cookies.length === 0) return

    // Copy cookies to each target domain
    for (const targetDomain of toDomains) {
      const newCookies = cookies.map(cookie => ({
        ...cookie,
        domain: `.facebook.com`, // Set to root domain so all subdomains can access
        url: `https://${targetDomain}`,
      }))

      await page.setCookie(...newCookies)
      log(`Copied ${newCookies.length} cookies to ${targetDomain}`)
    }
  } catch (e: any) {
    log(`Cookie copy error: ${e.message}`)
  }
}

// ==================== Capture Token After Login ====================

async function captureTokenAfterLogin(sessionId: string, preExistingToken: string | null) {
  const session = activeSessions.get(sessionId)
  if (!session || !session.page || !session.browser) return

  session.status = 'capturing_token'
  const page = session.page

  let token = preExistingToken
  const currentUrl = page.url()
  log(`Capturing token, pre-existing: ${token ? 'yes' : 'no'}, current URL: ${currentUrl}`)

  // Step 1: Try extracting token from current page (wherever we are after login/2FA)
  if (!token) {
    token = await extractTokenFromPage(page)
  }

  // Step 1.5: Copy cookies from m.facebook.com to www/business subdomains
  // This is critical — login on m.facebook.com sets cookies for m.facebook.com,
  // but www.facebook.com and business.facebook.com need their own cookies
  const sourceDomain = currentUrl.includes('m.facebook.com') ? 'm.facebook.com' : 'www.facebook.com'
  log(`Copying cookies from ${sourceDomain} to other FB domains...`)
  await copyCookiesToDomain(page, sourceDomain, [
    'www.facebook.com',
    'business.facebook.com',
    'web.facebook.com',
  ])

  // Step 2: Navigate to www.facebook.com homepage (cookies now copied)
  if (!token) {
    try {
      log(`Navigating to www.facebook.com...`)
      await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(3000)
      await takeScreenshot(session, page)
      token = await extractTokenFromPage(page)
    } catch (e: any) {
      log(`www.facebook.com navigation failed: ${e.message}`)
    }
  }

  // Step 3: Check c_user cookie to confirm we're logged in, then try inline fetches
  if (!token) {
    try {
      const cookies = await page.cookies('https://www.facebook.com')
      const cUser = cookies.find(c => c.name === 'c_user')

      if (cUser) {
        log(`Logged in as c_user=${cUser.value}, trying inline fetches for token...`)

        // Method A: Try fetching Facebook API endpoints from within the page (cookies auto-sent)
        const fetchedToken = await page.evaluate(async () => {
          try {
            // Try fetching a page that always includes access token
            const resp = await fetch('https://www.facebook.com/adsmanager/manage/campaigns', {
              credentials: 'include',
              redirect: 'follow',
            })
            const text = await resp.text()
            const tokenMatch = text.match(/(EAA[A-Za-z0-9]{30,})/)
            if (tokenMatch) return tokenMatch[1]

            // Try another endpoint
            const resp2 = await fetch('https://www.facebook.com/ajax/bootloader-endpoint/?modules=AdsLWIManagerContainer', {
              credentials: 'include',
            })
            const text2 = await resp2.text()
            const tokenMatch2 = text2.match(/(EAA[A-Za-z0-9]{30,})/)
            if (tokenMatch2) return tokenMatch2[1]

            return null
          } catch {
            return null
          }
        })

        if (fetchedToken) {
          token = fetchedToken
          log(`Captured token via inline fetch: ${token.substring(0, 20)}...`)
        }
      } else {
        log(`Not logged in — no c_user cookie found on www.facebook.com`)

        // Extra debug: list all cookies we have
        const allCookies = await page.cookies()
        const fbCookies = allCookies.filter(c => c.name === 'c_user' || c.name === 'xs' || c.name === 'fr')
        log(`Available FB auth cookies: ${fbCookies.map(c => `${c.name}@${c.domain}`).join(', ') || 'NONE'}`)
      }
    } catch {}
  }

  // Step 4: Navigate to Ads Manager on same domain (www.facebook.com/adsmanager)
  if (!token) {
    try {
      log(`Navigating to www.facebook.com/adsmanager...`)
      await page.goto('https://www.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(5000)
      await takeScreenshot(session, page)
      token = await extractTokenFromPage(page)
    } catch (e: any) {
      log(`Ads Manager failed: ${e.message}`)
    }
  }

  // Step 5: Try business.facebook.com
  if (!token) {
    try {
      log(`Navigating to business.facebook.com...`)
      await page.goto('https://business.facebook.com/latest/home', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(3000)
      await takeScreenshot(session, page)
      token = await extractTokenFromPage(page)
    } catch (e: any) {
      log(`business.facebook.com failed: ${e.message}`)
    }
  }

  // Step 6: Try m.facebook.com specific pages that might have tokens
  if (!token) {
    try {
      log(`Trying m.facebook.com/adsmanager...`)
      await page.goto('https://m.facebook.com/adsmanager', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(3000)
      await takeScreenshot(session, page)
      token = await extractTokenFromPage(page)
    } catch (e: any) {
      log(`m.facebook.com/adsmanager failed: ${e.message}`)
    }
  }

  // Step 7: Last resort — try www.facebook.com with direct Graph API call from page
  if (!token) {
    try {
      log(`Last resort: trying Graph API discover from page context...`)
      // Navigate back to www.facebook.com first
      await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 15000 })
      await sleep(2000)

      // Try to extract the EAAG token from DTSGInitData or similar
      const pageToken = await page.evaluate(() => {
        try {
          // Look through all script elements
          const scripts = document.querySelectorAll('script')
          for (const script of scripts) {
            const text = script.textContent || ''
            const match = text.match(/(EAA[A-Za-z0-9]{30,})/)
            if (match) return match[1]
          }
          // Check window.__accessToken or similar globals
          const w = window as any
          if (w.__accessToken) return w.__accessToken
          if (w.Env?.api_key) {
            // Not the token but could help
          }
        } catch {}
        return null
      })

      if (pageToken) {
        token = pageToken
        log(`Got token from script tags: ${token.substring(0, 20)}...`)
      }
    } catch (e: any) {
      log(`Last resort failed: ${e.message}`)
    }
  }

  // Final screenshot
  await takeScreenshot(session, page)

  if (!token) {
    session.status = 'failed'
    session.error = 'Logged in but could not capture access token. Try pasting the token manually on the Extensions page.'
    log(`Failed to capture token for ${sessionId}`)
    await cleanupSession(sessionId)
    return
  }

  // Validate and exchange token
  try {
    log(`Validating token...`)
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
    log(`Token valid: ${validateData.name} (${validateData.id})`)

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
          log(`Token exchanged for long-lived`)
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
    log(`Login complete: ${validateData.name} (${validateData.id})`)
  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
    log(`Token validation error: ${err.message}`)
  }

  // Close browser
  await cleanupSession(sessionId)
}

// ==================== Extract Token From Page ====================

async function extractTokenFromPage(page: Page): Promise<string | null> {
  try {
    const token = await page.evaluate(() => {
      try {
        const html = document.documentElement.innerHTML
        // Look for access token patterns in the page source
        const patterns = [
          /"accessToken":"(EAA[^"]+)"/,
          /"access_token":"(EAA[^"]+)"/,
          /access_token=(EAA[A-Za-z0-9]+)/,
          /(EAA[A-Za-z0-9]{30,})/,
        ]
        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match) return match[1]
        }
      } catch {}
      return null
    })

    if (token) {
      log(`Extracted token from page: ${token.substring(0, 20)}...`)
    }
    return token
  } catch {
    return null
  }
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
