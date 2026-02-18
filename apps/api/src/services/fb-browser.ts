/**
 * FB Browser Manager - Manages Puppeteer browser sessions for Facebook login
 *
 * Flow:
 * 1. Admin enters FB email/password (+ optional 2FA secret) in admin panel
 * 2. Puppeteer launches browser, navigates to facebook.com/adsmanager
 * 3. Facebook redirects to login, we enter credentials
 * 4. If 2FA is needed and secret provided, auto-generates TOTP code and submits
 * 5. Facebook redirects back to adsmanager — we capture EAA token from XHR/page
 * 6. Token stored in ExtensionSession for the server-side worker to use
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
  networkToken?: string
  screenshotBase64?: string
  twoFASecret?: string
  loginDomain?: string
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
  await page.evaluateOnNewDocument(() => {
    // Core: remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    // Chrome runtime
    const chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} }
    Object.defineProperty(window, 'chrome', { get: () => chrome })

    // Permissions
    const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions)
    if (originalQuery) {
      (window.navigator.permissions as any).query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters)
    }

    // Plugins — make it look like real Chrome
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ]
        const arr: any = plugins
        arr.item = (i: number) => plugins[i]
        arr.namedItem = (name: string) => plugins.find(p => p.name === name)
        arr.refresh = () => {}
        return arr
      },
    })

    // Languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' })
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' })

    // Hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 })
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 })

    // WebGL vendor
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
      if (parameter === 37445) return 'Intel Inc.'
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'
      return getParameter.call(this, parameter)
    }
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

  // Launch with new headless mode (better stealth than 'shell')
  const browser = await puppeteer.launch({
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-notifications',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
      '--lang=en-US',
      '--disable-extensions',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--mute-audio',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  })

  session.browser = browser
  const page = await browser.newPage()
  session.page = page

  await applyStealthToPage(page)
  await page.setViewport({ width: 1366, height: 768 })
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  })

  // Network interceptor for EAA tokens
  await page.setRequestInterception(true)
  page.on('request', (req) => { req.continue() })
  page.on('response', async (response) => {
    try {
      const url = response.url()
      // Check URL params
      if (url.includes('access_token=EAA')) {
        try {
          const urlObj = new URL(url)
          const t = urlObj.searchParams.get('access_token')
          if (t && t.startsWith('EAA') && t.length > 30) {
            session.networkToken = t
            log(`[NET] Token from URL param: ${t.substring(0, 25)}...`)
          }
        } catch {}
      }
      // Check JSON response bodies
      const ct = response.headers()['content-type'] || ''
      if (url.includes('facebook.com') && (ct.includes('json') || ct.includes('javascript'))) {
        try {
          const text = await response.text()
          const matches = text.match(/(EAA[A-Za-z0-9]{30,})/g)
          if (matches) {
            for (const t of matches) {
              if (t.length > 30 && t.length < 500) {
                session.networkToken = t
                log(`[NET] Token from response body (${url.substring(0, 60)}): ${t.substring(0, 25)}...`)
              }
            }
          }
        } catch {}
      }
    } catch {}
  })

  session.status = 'logging_in'

  // ==========================================================
  // GO DIRECTLY TO ADS MANAGER — Facebook will redirect to login
  // After login, it redirects BACK to adsmanager which loads EAA tokens
  // ==========================================================
  log(`Navigating to adsmanager.facebook.com (will redirect to login)...`)
  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })

  const landingUrl = page.url()
  log(`Landing URL: ${landingUrl}`)
  await takeScreenshot(session, page)

  // Close cookie dialog if present
  await dismissCookieBanner(page)
  await sleep(1000)

  // Find email input
  let emailInput = await findEmailInput(page)

  // If no email input, we might already be logged in (or need to try other approaches)
  if (!emailInput) {
    // Check if we're already on adsmanager (already logged in)
    if (page.url().includes('adsmanager')) {
      log(`Already logged in! On adsmanager directly.`)
      await captureTokenAfterLogin(sessionId)
      return
    }

    // Try navigating to login directly
    log(`No email input found, trying direct login page...`)
    await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 15000 })
    await sleep(2000)
    await takeScreenshot(session, page)
    emailInput = await findEmailInput(page)
  }

  if (!emailInput) {
    await takeScreenshot(session, page)
    session.status = 'failed'
    session.error = 'Could not find login form. Facebook may be blocking this server.'
    log(`FAILED: No email input found. URL: ${page.url()}`)
    await cleanupSession(sessionId)
    return
  }

  // Type email with human-like delays
  await emailInput.click()
  await sleep(200 + Math.random() * 300)
  await emailInput.type(email, { delay: 50 + Math.random() * 80 })
  await sleep(500 + Math.random() * 500)

  // Find and fill password
  let passInput = null
  for (const sel of ['#pass', 'input[name="pass"]', 'input[type="password"]']) {
    passInput = await page.$(sel)
    if (passInput) break
  }

  if (!passInput) {
    session.status = 'failed'
    session.error = 'Could not find password field'
    await cleanupSession(sessionId)
    return
  }

  await passInput.click()
  await sleep(200 + Math.random() * 200)
  await passInput.type(password, { delay: 40 + Math.random() * 70 })
  await sleep(500 + Math.random() * 500)

  session.loginDomain = 'www.facebook.com'

  // Click login — use keyboard Enter (more natural than clicking button)
  log(`Submitting login via Enter key...`)
  await page.keyboard.press('Enter')

  // Wait for navigation after login
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
  } catch {
    // Navigation might not trigger if it's SPA-like
  }
  await sleep(3000)

  await takeScreenshot(session, page)
  const afterLoginUrl = page.url()
  const afterLoginContent = await page.content()
  log(`After login URL: ${afterLoginUrl}`)

  // Check c_user cookie to verify login success
  const cookies = await page.cookies()
  const cUser = cookies.find(c => c.name === 'c_user')
  log(`After login c_user: ${cUser ? cUser.value : 'NONE'}`)

  // Check for explicit login failure
  const loginFailed = afterLoginContent.includes('Wrong credentials') ||
    afterLoginContent.includes('The password that you') ||
    afterLoginContent.includes('incorrect password') ||
    afterLoginContent.includes('The email address you entered') ||
    afterLoginContent.includes('Please re-enter your password')

  if (loginFailed) {
    session.status = 'failed'
    session.error = 'Invalid email or password'
    log(`Login FAILED: wrong credentials`)
    await cleanupSession(sessionId)
    return
  }

  // Check if login silently failed (no c_user and still on login-like page)
  if (!cUser) {
    // Check if on checkpoint/2FA
    const needs2FA = afterLoginUrl.includes('checkpoint') ||
      afterLoginUrl.includes('two_step_verification') ||
      afterLoginContent.includes('approvals_code') ||
      afterLoginContent.includes('Enter the code') ||
      afterLoginContent.includes('Two-factor authentication') ||
      afterLoginContent.includes('Login code') ||
      afterLoginContent.includes('Enter Code') ||
      afterLoginContent.includes('security code') ||
      afterLoginContent.includes('login approval') ||
      afterLoginContent.includes('Code Generator')

    if (needs2FA) {
      log(`2FA/checkpoint detected at: ${afterLoginUrl}`)
      await handle2FA(sessionId, session, page)
      return
    }

    // No c_user and no 2FA — login silently failed
    // Check if the page still has a login form
    const stillHasLoginForm = await page.$('input[name="email"], #email, input[name="pass"], #pass')
    if (stillHasLoginForm) {
      session.status = 'failed'
      session.error = 'Login failed — Facebook may have blocked this login attempt. Try again or use a different IP.'
      log(`Login SILENTLY FAILED: still on login page, no c_user cookie`)
      await cleanupSession(sessionId)
      return
    }

    // Might be in a state we don't recognize — wait more and recheck
    log(`No c_user yet but not on login form. Waiting 5s more...`)
    await sleep(5000)
    const cookies2 = await page.cookies()
    const cUser2 = cookies2.find(c => c.name === 'c_user')
    if (!cUser2) {
      // Check for 2FA one more time
      const content2 = await page.content()
      const url2 = page.url()
      if (url2.includes('checkpoint') || content2.includes('Enter the code') || content2.includes('Two-factor')) {
        log(`2FA detected on second check`)
        await handle2FA(sessionId, session, page)
        return
      }

      session.status = 'failed'
      session.error = 'Login did not succeed — no authentication cookie received. Facebook may require CAPTCHA or has blocked this IP.'
      log(`Login FAILED: no c_user after extended wait. URL: ${url2}`)
      await cleanupSession(sessionId)
      return
    }
    log(`Got c_user after extended wait: ${cUser2.value}`)
  }

  // ===== LOGIN SUCCEEDED =====
  log(`Login succeeded! c_user cookie present.`)

  // Check if we're already on adsmanager (Facebook redirected us back)
  if (afterLoginUrl.includes('adsmanager')) {
    log(`Already on adsmanager after login — perfect!`)
    await sleep(5000) // Wait for XHR calls
    await captureTokenAfterLogin(sessionId)
    return
  }

  // Navigate to adsmanager now
  log(`Navigating to adsmanager for token capture...`)
  await captureTokenAfterLogin(sessionId)
}

// ==================== Find Email Input Helper ====================

async function findEmailInput(page: Page) {
  const selectors = ['#email', 'input[name="email"]', 'input[data-testid="royal_email"]', 'input[type="email"]', 'input[type="text"]']

  for (const sel of selectors) {
    try {
      const el = await page.$(sel)
      if (el) {
        const visible = await el.isVisible().catch(() => true)
        if (visible) {
          log(`Found email input: ${sel}`)
          return el
        }
      }
    } catch {}
  }

  // Wait for it
  try {
    const el = await page.waitForSelector('#email, input[name="email"]', { visible: true, timeout: 8000 })
    if (el) {
      log(`Found email input after waiting`)
      return el
    }
  } catch {}

  return null
}

// ==================== Dismiss Cookie Banner ====================

async function dismissCookieBanner(page: Page) {
  const selectors = [
    '[data-cookiebanner="accept_button"]',
    'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
    '[title="Allow all cookies"]',
    'button[title="Decline optional cookies"]',
    'button[title="Only allow essential cookies"]',
    '[value="Accept All"]',
  ]
  for (const sel of selectors) {
    try {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        log(`Dismissed cookie banner: ${sel}`)
        await sleep(1000)
        return
      }
    } catch {}
  }
}

// ==================== Handle 2FA ====================

async function handle2FA(sessionId: string, session: LoginSession, page: Page) {
  if (session.twoFASecret) {
    log(`Auto-generating TOTP code from secret`)
    session.status = 'submitting_2fa'
    const code = generateTOTPCode(session.twoFASecret)
    log(`Generated TOTP code: ${code}`)

    await sleep(2000)
    await takeScreenshot(session, page)

    const submitted = await submitCodeOnPage(page, code)
    if (submitted) {
      log(`2FA code submitted, waiting...`)
      await sleep(6000)
      await takeScreenshot(session, page)
      await handlePostCheckpointPrompts(page)

      // Verify login succeeded after 2FA
      const cookies = await page.cookies()
      const cUser = cookies.find(c => c.name === 'c_user')
      log(`After 2FA c_user: ${cUser ? cUser.value : 'NONE'}`)

      if (!cUser) {
        // One more try
        await sleep(3000)
        const cookies2 = await page.cookies()
        const cUser2 = cookies2.find(c => c.name === 'c_user')
        if (!cUser2) {
          log(`Still no c_user after 2FA — may need retry`)
        }
      }

      await captureTokenAfterLogin(sessionId)
    } else {
      log(`Could not find 2FA input field`)
      session.error = 'Could not find 2FA input field on page'
      await captureTokenAfterLogin(sessionId)
    }
  } else {
    session.status = 'needs_2fa'
    log(`Waiting for manual 2FA code for ${sessionId}`)
  }
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
          log(`Typed 2FA code into: ${selector}`)
          break
        }
      }
    } catch {}
  }

  if (!inputFound) {
    // Fallback: any visible text input
    try {
      const allInputs = await page.$$('input')
      for (const input of allInputs) {
        const visible = await input.isVisible().catch(() => false)
        if (!visible) continue
        const type = await input.evaluate((el: any) => el.type)
        if (['hidden', 'password', 'email', 'submit', 'checkbox', 'radio', 'file'].includes(type)) continue
        await input.click({ clickCount: 3 })
        await sleep(200)
        await input.type(code, { delay: 60 })
        inputFound = true
        log(`Typed 2FA into fallback input`)
        break
      }
    } catch {}
  }

  if (!inputFound) {
    log(`No input field found for 2FA code`)
    return false
  }

  await sleep(500)

  // Submit
  for (const sel of ['#checkpointSubmitButton', 'button[type="submit"]', 'input[type="submit"]']) {
    try {
      const btn = await page.$(sel)
      if (btn && await btn.isVisible().catch(() => true)) {
        await btn.click()
        log(`Clicked 2FA submit: ${sel}`)
        break
      }
    } catch {}
  }

  return true
}

// ==================== Handle Post-Checkpoint Prompts ====================

async function handlePostCheckpointPrompts(page: Page) {
  for (let i = 0; i < 3; i++) {
    const content = await page.content()
    const url = page.url()
    if (!url.includes('checkpoint') && !content.includes('Remember') && !content.includes('Save Browser')) break

    log(`Post-checkpoint prompt round ${i + 1}`)
    try {
      const btn = await page.$('button[type="submit"]')
      if (btn) {
        await btn.click()
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
    if (!submitted) throw new Error('Could not find 2FA input field')

    await sleep(6000)
    await takeScreenshot(session, page)

    const url = page.url()
    const content = await page.content()
    if (url.includes('checkpoint') && (content.includes('approvals_code') || content.includes('Enter Code'))) {
      session.status = 'needs_2fa'
      session.error = 'Invalid 2FA code, please try again'
      return
    }

    await handlePostCheckpointPrompts(page)
    await captureTokenAfterLogin(sessionId)
  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
    await cleanupSession(sessionId)
  }
}

// ==================== Take Screenshot ====================

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

  let token = session.networkToken || null
  log(`=== TOKEN CAPTURE START ===`)
  log(`Current URL: ${page.url()}`)
  log(`Network token already captured: ${token ? 'YES' : 'NO'}`)

  // Verify we're logged in
  const cookies = await page.cookies()
  const cUser = cookies.find(c => c.name === 'c_user')
  log(`c_user cookie: ${cUser ? `${cUser.value} @ ${cUser.domain}` : 'NONE'}`)

  if (!cUser) {
    session.status = 'failed'
    session.error = 'Not logged in — no c_user cookie. Login may have been blocked by Facebook.'
    log(`TOKEN CAPTURE FAILED: not logged in`)
    await takeScreenshot(session, page)
    await cleanupSession(sessionId)
    return
  }

  // ===== STRATEGY 1: Already have token from network interceptor =====
  if (token) {
    log(`Using network-intercepted token`)
  }

  // ===== STRATEGY 2: Load Ads Manager (triggers XHR with tokens) =====
  if (!token) {
    try {
      const curUrl = page.url()
      if (!curUrl.includes('adsmanager')) {
        log(`Navigating to adsmanager.facebook.com...`)
        await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 30000 })
      }
      // Ads Manager is a SPA — wait for AJAX calls
      log(`Waiting 10s for Ads Manager AJAX calls...`)
      await sleep(10000)
      await takeScreenshot(session, page)

      // Check network interceptor
      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from network after Ads Manager: ${token.substring(0, 25)}...`)
      }

      // Also scan page
      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`Ads Manager failed: ${e.message}`)
    }
  }

  // ===== STRATEGY 3: Try business.facebook.com settings =====
  if (!token) {
    try {
      log(`Trying business.facebook.com/latest/settings...`)
      await page.goto('https://business.facebook.com/latest/settings/business_users', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(8000)
      await takeScreenshot(session, page)

      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from business.facebook.com: ${token.substring(0, 25)}...`)
      }
      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`business.facebook.com failed: ${e.message}`)
    }
  }

  // ===== STRATEGY 4: Use DTSG to call internal API =====
  if (!token) {
    try {
      log(`Trying DTSG approach...`)
      // Go to facebook.com home if needed
      if (!page.url().includes('facebook.com') || page.url().includes('login')) {
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 15000 })
        await sleep(3000)
      }

      const dtsgToken = await page.evaluate(() => {
        const html = document.documentElement.innerHTML
        const m = html.match(/"DTSGInitData".*?"token":"([^"]+)"/) ||
                  html.match(/name="fb_dtsg" value="([^"]+)"/) ||
                  html.match(/"dtsg":\{"token":"([^"]+)"/) ||
                  html.match(/"token":"(AQ[A-Za-z0-9_-]{20,})"/)
        return m ? m[1] : null
      })

      if (dtsgToken) {
        log(`Found DTSG: ${dtsgToken.substring(0, 20)}...`)

        // Try calling graphql API
        const result = await page.evaluate(async (dtsg: string) => {
          try {
            const resp = await fetch('/api/graphql/', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                fb_dtsg: dtsg,
                fb_api_caller_class: 'RelayModern',
                fb_api_req_friendly_name: 'AdsManagerHomeQuery',
                variables: '{}',
                doc_id: '0',
              }).toString(),
            })
            const text = await resp.text()
            const m = text.match(/(EAA[A-Za-z0-9]{30,})/)
            return m ? m[1] : null
          } catch { return null }
        }, dtsgToken)

        if (result) {
          token = result
          log(`Got token via DTSG: ${token.substring(0, 25)}...`)
        }

        // Also check if network interceptor caught something
        if (!token && session.networkToken) {
          token = session.networkToken
          log(`Network interceptor caught token during DTSG call`)
        }
      }
    } catch (e: any) {
      log(`DTSG failed: ${e.message}`)
    }
  }

  // ===== STRATEGY 5: Try www.facebook.com/adsmanager (different path) =====
  if (!token) {
    try {
      log(`Trying www.facebook.com/adsmanager...`)
      await page.goto('https://www.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(8000)
      await takeScreenshot(session, page)

      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from www adsmanager`)
      }
      if (!token) {
        token = await extractTokenFromPage(page)
      }
    } catch (e: any) {
      log(`www adsmanager failed: ${e.message}`)
    }
  }

  // ===== FINAL CHECK =====
  if (!token && session.networkToken) {
    token = session.networkToken
    log(`Final: using network interceptor token`)
  }

  await takeScreenshot(session, page)
  log(`=== TOKEN CAPTURE END === Result: ${token ? 'SUCCESS' : 'FAILED'}`)

  if (!token) {
    session.status = 'failed'
    session.error = 'Logged in successfully but could not capture access token. The account may not have Ads Manager access.'
    log(`Token capture failed for ${sessionId}`)
    await cleanupSession(sessionId)
    return
  }

  // Validate token
  try {
    log(`Validating token: ${token.substring(0, 25)}...`)
    const validateRes = await fetch(`${FB_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const validateData = await validateRes.json() as any

    if (validateData.error) {
      session.status = 'failed'
      session.error = `Token invalid: ${validateData.error.message}`
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
          log(`Exchanged for long-lived token`)
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
    log(`=== LOGIN COMPLETE: ${validateData.name} (${validateData.id}) ===`)
  } catch (err: any) {
    session.status = 'failed'
    session.error = err.message
    log(`Token validation error: ${err.message}`)
  }

  await cleanupSession(sessionId)
}

// ==================== Extract Token From Page ====================

async function extractTokenFromPage(page: Page): Promise<string | null> {
  try {
    const token = await page.evaluate(() => {
      const html = document.documentElement.innerHTML
      const patterns = [
        /"accessToken":"(EAA[^"]+)"/,
        /"access_token":"(EAA[^"]+)"/,
        /access_token=(EAA[A-Za-z0-9]+)/,
        /(EAA[A-Za-z0-9]{30,})/,
      ]
      for (const p of patterns) {
        const m = html.match(p)
        if (m && m[1].length > 30 && m[1].length < 500) return m[1]
      }
      return null
    })
    if (token) log(`Extracted token from page HTML: ${token.substring(0, 25)}...`)
    return token
  } catch { return null }
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

export async function cancelLogin(sessionId: string) {
  await cleanupSession(sessionId)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
