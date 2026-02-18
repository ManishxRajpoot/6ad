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
  networkToken?: string // Token captured from network interceptor
  screenshotBase64?: string
  twoFASecret?: string
  loginDomain?: string // Which domain we logged in on
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
          session.networkToken = tokenFromUrl
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
                session.networkToken = t
                log(`Captured token from response: ${t.substring(0, 20)}...`)
              }
            }
          }
        } catch {}
      }
    } catch {}
  })

  session.status = 'logging_in'

  // ==========================================================
  // LOGIN ON www.facebook.com (NOT mobile) — keeps cookies on same domain
  // ==========================================================
  log(`Navigating to www.facebook.com...`)
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 })
  log(`Page loaded: ${page.url()}`)

  // Take screenshot to see what we got
  await takeScreenshot(session, page)

  // Close cookie dialog if present
  try {
    const cookieSelectors = [
      '[data-cookiebanner="accept_button"]',
      'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
      '[title="Allow all cookies"]',
      '[value="Accept All"]',
      'button[name="accept"]',
      'button[title="Decline optional cookies"]',
      'button[title="Only allow essential cookies"]',
    ]
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        log(`Clicked cookie button: ${sel}`)
        await sleep(1500)
        break
      }
    }
  } catch {}

  await sleep(1000)

  // Find email input — robust approach with retries
  const emailSelectors = [
    '#email',
    'input[name="email"]',
    'input[type="email"]',
    'input[data-testid="royal_email"]',
    'input[type="text"]',
  ]

  let emailInput = null

  // First try: check existing DOM
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

  // Second try: wait up to 10s for #email to appear
  if (!emailInput) {
    log(`Email input not found immediately, waiting up to 10s...`)
    try {
      emailInput = await page.waitForSelector('#email, input[name="email"]', { visible: true, timeout: 10000 })
      log(`Found email input after waiting`)
    } catch {
      log(`Still no email input after 10s wait`)
    }
  }

  // Third try: navigate to /login page explicitly
  if (!emailInput) {
    log(`Trying /login page...`)
    try {
      await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 15000 })
      await sleep(2000)
      await takeScreenshot(session, page)

      emailInput = await page.waitForSelector('#email, input[name="email"], input[type="text"]', { visible: true, timeout: 10000 })
      log(`Found email input on /login page`)
    } catch {
      log(`/login page also failed`)
    }
  }

  // Fourth try: use m.facebook.com as absolute last resort, but we'll handle cookies
  if (!emailInput) {
    log(`Falling back to m.facebook.com...`)
    try {
      await page.goto('https://m.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 15000 })
      await sleep(2000)
      await takeScreenshot(session, page)

      emailInput = await page.waitForSelector('#m_login_email, input[name="email"], input[type="text"]', { visible: true, timeout: 10000 })
      log(`Found email input on m.facebook.com`)
    } catch {}
  }

  if (!emailInput) {
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

  // Remember which domain we logged in on (for cookie handling later)
  session.loginDomain = page.url().includes('m.facebook.com') ? 'm.facebook.com' : 'www.facebook.com'
  log(`Login domain: ${session.loginDomain}`)

  // Click login button
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
        await captureTokenAfterLogin(sessionId)
      } else {
        log(`Could not find 2FA input field, page may have CAPTCHA`)
        // Don't fail — still try to capture token, maybe the page moved on
        session.error = 'Could not find 2FA input field on page'
        await captureTokenAfterLogin(sessionId)
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
  await captureTokenAfterLogin(sessionId)
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
  // Multiple rounds of checkpoint prompts
  for (let i = 0; i < 3; i++) {
    const content = await page.content()
    const url = page.url()

    if (!url.includes('checkpoint') && !content.includes('Remember') && !content.includes('Save Browser')) {
      break
    }

    log(`Post-checkpoint prompt round ${i + 1}, URL: ${url}`)

    // "Remember this browser?"
    if (content.includes('Remember') || content.includes('Save Browser') || content.includes('remember_browser') || content.includes('Don\'t Save')) {
      log(`"Remember browser?" prompt detected, clicking continue...`)
      try {
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
    await captureTokenAfterLogin(sessionId)
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

// ==================== Capture Token After Login ====================

async function captureTokenAfterLogin(sessionId: string) {
  const session = activeSessions.get(sessionId)
  if (!session || !session.page || !session.browser) return

  session.status = 'capturing_token'
  const page = session.page
  const loginDomain = session.loginDomain || 'www.facebook.com'

  let token = session.networkToken || null
  const currentUrl = page.url()
  log(`Capturing token, networkToken: ${token ? 'yes' : 'no'}, current URL: ${currentUrl}, loginDomain: ${loginDomain}`)

  // Step 0: Check if we have a c_user cookie (confirms we're logged in)
  const allCookies = await page.cookies()
  const cUserCookie = allCookies.find(c => c.name === 'c_user')
  const xsCookie = allCookies.find(c => c.name === 'xs')
  log(`Auth cookies: c_user=${cUserCookie ? `${cUserCookie.value}@${cUserCookie.domain}` : 'NONE'}, xs=${xsCookie ? `present@${xsCookie.domain}` : 'NONE'}`)

  if (!cUserCookie) {
    log(`No c_user cookie — not logged in. Trying cookie domain fix...`)
    // Try to get cookies from any facebook domain and set to root
    try {
      const allC = await page.cookies('https://m.facebook.com', 'https://www.facebook.com')
      const cUser = allC.find(c => c.name === 'c_user')
      if (cUser) {
        log(`Found c_user on ${cUser.domain}, fixing domain...`)
        const importantNames = ['c_user', 'xs', 'fr', 'datr', 'sb']
        for (const c of allC.filter(c => importantNames.includes(c.name))) {
          try {
            await page.setCookie({
              name: c.name,
              value: c.value,
              domain: '.facebook.com',
              path: '/',
              httpOnly: c.httpOnly,
              secure: c.secure,
              expires: c.expires,
            })
          } catch {}
        }
      }
    } catch {}
  }

  // =====================================================
  // STRATEGY 1: Check network interceptor first (best source)
  // =====================================================
  if (token) {
    log(`Already have token from network interceptor`)
  }

  // =====================================================
  // STRATEGY 2: Navigate to www.facebook.com and load Ads Manager
  // The Ads Manager SPA is the MOST RELIABLE source of EAA tokens
  // because it loads them via XHR which our interceptor catches
  // =====================================================
  if (!token) {
    try {
      // First ensure we're on www.facebook.com
      if (!currentUrl.includes('www.facebook.com')) {
        log(`Navigating to www.facebook.com...`)
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 })
        await sleep(2000)
        await takeScreenshot(session, page)
      }

      // Now load Ads Manager — this triggers XHR calls that contain EAA tokens
      log(`Loading Ads Manager to trigger token XHRs...`)
      await page.goto('https://www.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 30000 })
      // Wait extra time for AJAX calls that contain tokens
      await sleep(8000)
      await takeScreenshot(session, page)

      // Check network interceptor
      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from network interceptor after Ads Manager load: ${token.substring(0, 20)}...`)
      }

      // Also check page HTML
      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`Ads Manager approach failed: ${e.message}`)
    }
  }

  // =====================================================
  // STRATEGY 3: Use DTSG token to call Facebook's internal API
  // Extract fb_dtsg from page and use it to get access token
  // =====================================================
  if (!token) {
    try {
      log(`Trying DTSG + internal API approach...`)
      // Make sure we're on facebook.com
      const curUrl = page.url()
      if (!curUrl.includes('facebook.com') || curUrl.includes('login')) {
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 15000 })
        await sleep(3000)
      }

      const dtsgToken = await page.evaluate(() => {
        try {
          // Method 1: Find in page HTML
          const html = document.documentElement.innerHTML
          const dtsgMatch = html.match(/"DTSGInitData".*?"token":"([^"]+)"/) ||
                           html.match(/name="fb_dtsg" value="([^"]+)"/) ||
                           html.match(/"dtsg":\{"token":"([^"]+)"/) ||
                           html.match(/\["DTSGInitialData",\[\],\{"token":"([^"]+)"/)
          if (dtsgMatch) return dtsgMatch[1]

          // Method 2: Check require calls
          const scripts = document.querySelectorAll('script')
          for (const script of scripts) {
            const text = script.textContent || ''
            const m = text.match(/"DTSGInitialData".*?"token":"([^"]+)"/) ||
                     text.match(/"token":"(AQ[^"]{20,})"/)
            if (m) return m[1]
          }
        } catch {}
        return null
      })

      if (dtsgToken) {
        log(`Found DTSG token: ${dtsgToken.substring(0, 20)}...`)

        // Use DTSG to get access token via Facebook's internal endpoint
        const accessToken = await page.evaluate(async (dtsg: string) => {
          try {
            // Method: Call the business integrations API which returns an access token
            const formData = new URLSearchParams()
            formData.append('fb_dtsg', dtsg)
            formData.append('fb_api_caller_class', 'RelayModern')
            formData.append('fb_api_req_friendly_name', 'AdAccountAccessTokenQuery')
            formData.append('variables', '{}')
            formData.append('doc_id', '0') // placeholder

            // Try getting token from ads API endpoint
            const resp = await fetch('https://www.facebook.com/api/graphql/', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formData.toString(),
            })
            const text = await resp.text()
            const tokenMatch = text.match(/(EAA[A-Za-z0-9]{30,})/)
            if (tokenMatch) return tokenMatch[1]
          } catch {}

          try {
            // Alternative: hit the business account selection which returns tokens
            const resp2 = await fetch('https://www.facebook.com/ajax/bootloader-endpoint/?modules=AdsLWIManagerContainer', {
              credentials: 'include',
            })
            const text2 = await resp2.text()
            const tokenMatch2 = text2.match(/(EAA[A-Za-z0-9]{30,})/)
            if (tokenMatch2) return tokenMatch2[1]
          } catch {}

          return null
        }, dtsgToken)

        if (accessToken) {
          token = accessToken
          log(`Got token via DTSG API call: ${token.substring(0, 20)}...`)
        }
      } else {
        log(`Could not find DTSG token in page`)
      }
    } catch (e: any) {
      log(`DTSG approach failed: ${e.message}`)
    }
  }

  // =====================================================
  // STRATEGY 4: Navigate to business.facebook.com (triggers different XHRs)
  // =====================================================
  if (!token) {
    try {
      log(`Trying business.facebook.com...`)
      await page.goto('https://business.facebook.com/latest/home', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(5000)
      await takeScreenshot(session, page)

      // Check network interceptor
      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from network interceptor on business.facebook.com`)
      }

      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`business.facebook.com failed: ${e.message}`)
    }
  }

  // =====================================================
  // STRATEGY 5: Navigate to adsmanager on business domain
  // =====================================================
  if (!token) {
    try {
      log(`Trying business.facebook.com/adsmanager...`)
      await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(5000)
      await takeScreenshot(session, page)

      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from adsmanager.facebook.com`)
      }
      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`adsmanager.facebook.com failed: ${e.message}`)
    }
  }

  // Final: check network interceptor one more time
  if (!token && session.networkToken) {
    token = session.networkToken
    log(`Using token from network interceptor: ${token.substring(0, 20)}...`)
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
    log(`Validating token: ${token.substring(0, 20)}...`)
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
