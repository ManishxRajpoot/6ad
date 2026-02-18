/**
 * FB Browser Manager - Manages browser sessions for Facebook login
 *
 * Anti-detection stack:
 * 1. rebrowser-puppeteer — patches CDP Runtime.Enable leak + sourceURL leak
 * 2. headless: false + Xvfb on VPS — real WebGL, real screen metrics
 * 3. Persistent --user-data-dir — cookies persist, FB sees returning user
 * 4. Real Google Chrome (not Chromium) — proper codecs, real UA
 * 5. Stripped automation flags — no navigator.webdriver
 * 6. CDP Network.enable for token capture (not request interception)
 * 7. Human-like mouse movements, variable typing speed
 */

import puppeteer, { Browser, Page, CDPSession } from 'rebrowser-puppeteer'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import * as OTPAuth from 'otpauth'

const prisma = new PrismaClient()

const FB_GRAPH_BASE = 'https://graph.facebook.com/v21.0'

// Chrome config from env
const CHROME_PATH = process.env.CHROME_PATH || undefined // undefined = use bundled Chromium
const CHROME_PROFILE_DIR = process.env.CHROME_PROFILE_DIR || undefined // undefined = temp profile

function log(msg: string) {
  console.log(`[FBBrowser] ${msg}`)
}

// Active login sessions being processed
interface LoginSession {
  id: string
  status: 'launching' | 'logging_in' | 'needs_2fa' | 'submitting_2fa' | 'capturing_token' | 'success' | 'failed'
  browser: Browser | null
  page: Page | null
  cdpClient: CDPSession | null
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
      if (session.cdpClient) await session.cdpClient.detach().catch(() => {})
      if (session.browser) await session.browser.close()
    } catch {}
    activeSessions.delete(id)
  }
}

function generateSessionId(): string {
  return 'fbl_' + crypto.randomBytes(8).toString('hex')
}

// ==================== Human-Like Helpers ====================

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min)
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Move mouse to element with natural curve before clicking
async function humanClick(page: Page, selector: string): Promise<boolean> {
  const el = await page.$(selector)
  if (!el) return false

  const box = await el.boundingBox()
  if (!box) return false

  // Random point within the element (not dead center)
  const x = box.x + box.width * (0.3 + Math.random() * 0.4)
  const y = box.y + box.height * (0.3 + Math.random() * 0.4)

  // Move mouse with small steps (natural curve)
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) })
  await randomDelay(50, 150)
  await page.mouse.click(x, y)
  return true
}

// Type text with variable speed like a human
async function humanType(page: Page, text: string) {
  for (const char of text) {
    await page.keyboard.type(char)
    // Vary delay per character — faster for common letters, slower for special chars
    const isSpecial = /[^a-zA-Z0-9]/.test(char)
    await randomDelay(isSpecial ? 80 : 30, isSpecial ? 200 : 120)
  }
}

// Random mouse movements to look human
async function randomMouseMovement(page: Page) {
  // With defaultViewport: null, viewport() may be null — use safe defaults
  const viewport = page.viewport()
  const w = viewport?.width || 1920
  const h = viewport?.height || 1080
  const x = 100 + Math.random() * (w - 200)
  const y = 100 + Math.random() * (h - 200)
  await page.mouse.move(x, y, { steps: 3 + Math.floor(Math.random() * 5) })
}

// ==================== Anti-Fingerprint Injection ====================

async function injectAntiFingerprint(page: Page) {
  await page.evaluateOnNewDocument(() => {
    // 1. Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })

    // 2. Spoof WebGL renderer (headless returns SwiftShader)
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) return 'Intel Inc.' // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine' // UNMASKED_RENDERER_WEBGL
      return getParameter.call(this, parameter)
    }

    // Also patch WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = function (parameter: number) {
        if (parameter === 37445) return 'Intel Inc.'
        if (parameter === 37446) return 'Intel Iris OpenGL Engine'
        return getParameter2.call(this, parameter)
      }
    }

    // 3. Override navigator.plugins (headless has empty plugins)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        return [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ]
      },
    })

    // 4. Override navigator.languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    })

    // 5. Fix chrome.runtime (missing in headless but present in real Chrome)
    if (!(window as any).chrome) {
      (window as any).chrome = {}
    }
    if (!(window as any).chrome.runtime) {
      (window as any).chrome.runtime = {
        connect: () => {},
        sendMessage: () => {},
      }
    }

    // 6. Override permissions query (headless returns 'denied' for notifications)
    const originalQuery = window.navigator.permissions.query
    window.navigator.permissions.query = (parameters: any) => {
      if (parameters.name === 'notifications') {
        return Promise.resolve({ state: 'default', onchange: null } as PermissionStatus)
      }
      return originalQuery.call(window.navigator.permissions, parameters)
    }
  })
}

// ==================== CDP Token Interceptor ====================
// Uses Chrome DevTools Protocol directly — NOT request interception
// This is much harder for sites to detect

async function setupCDPTokenCapture(page: Page, session: LoginSession): Promise<CDPSession> {
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  client.on('Network.responseReceived', async (params: any) => {
    const url = params.response.url || ''

    // Check URL for access_token param
    if (url.includes('access_token=EAA')) {
      try {
        const urlObj = new URL(url)
        const t = urlObj.searchParams.get('access_token')
        if (t && t.startsWith('EAA') && t.length > 30) {
          session.networkToken = t
          log(`[CDP] Token from URL param: ${t.substring(0, 25)}...`)
        }
      } catch {}
    }

    // Check JSON response bodies for EAA tokens
    const ct = params.response.headers?.['content-type'] || params.response.headers?.['Content-Type'] || ''
    if (url.includes('facebook.com') && (ct.includes('json') || ct.includes('javascript'))) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId: params.requestId })
        const text = body.body || ''
        const matches = text.match(/(EAA[A-Za-z0-9]{30,})/g)
        if (matches) {
          for (const t of matches) {
            if (t.length > 30 && t.length < 500) {
              session.networkToken = t
              log(`[CDP] Token from response (${url.substring(0, 60)}): ${t.substring(0, 25)}...`)
            }
          }
        }
      } catch {
        // Response body may not be available for all requests — that's fine
      }
    }
  })

  return client
}

// ==================== Start Login ====================

export async function startFbLogin(email: string, password: string, twoFASecret?: string): Promise<{ sessionId: string }> {
  const sessionId = generateSessionId()

  const loginSession: LoginSession = {
    id: sessionId,
    status: 'launching',
    browser: null,
    page: null,
    cdpClient: null,
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
  if (CHROME_PATH) log(`Using Chrome: ${CHROME_PATH}`)
  if (CHROME_PROFILE_DIR) log(`Using profile: ${CHROME_PROFILE_DIR}`)

  // ==================== ANTI-DETECTION LAUNCH CONFIG ====================
  const launchOptions: any = {
    headless: false, // Layer 2: Real headed mode (use Xvfb on VPS)
    ignoreDefaultArgs: ['--enable-automation'], // Layer 5: Remove automation flag
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--lang=en-US,en;q=0.9',
      '--password-store=basic',
      '--enable-webgl',
      '--disable-infobars',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--mute-audio',
      '--disable-blink-features=AutomationControlled',
    ],
    defaultViewport: null, // Layer 5: Use actual window size, not artificial 800x600
  }

  // Layer 4: Use real Google Chrome if available
  if (CHROME_PATH) {
    launchOptions.executablePath = CHROME_PATH
  }

  // Layer 3: Persistent Chrome profile
  if (CHROME_PROFILE_DIR) {
    launchOptions.userDataDir = CHROME_PROFILE_DIR
  }

  const browser = await puppeteer.launch(launchOptions)
  session.browser = browser
  const page = await browser.newPage()
  session.page = page

  // Layer 5+6: Anti-fingerprint injection
  await injectAntiFingerprint(page)

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  })

  // Setup CDP-based token capture
  const cdpClient = await setupCDPTokenCapture(page, session)
  session.cdpClient = cdpClient

  session.status = 'logging_in'

  // ==========================================================
  // STEP 1: Check if already logged in (cookie persistence)
  // ==========================================================
  if (CHROME_PROFILE_DIR) {
    log(`Checking persistent cookies — may already be logged in...`)
    try {
      await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 })
      await sleep(2000)
      const cookies = await page.cookies()
      const cUser = cookies.find(c => c.name === 'c_user')
      if (cUser) {
        log(`Already logged in from previous session! c_user: ${cUser.value}`)
        log(`Skipping login form — going straight to token capture`)
        await captureTokenAfterLogin(sessionId)
        return
      }
      log(`Not logged in from cookies — proceeding with login form`)
    } catch (e: any) {
      log(`Cookie check failed: ${e.message} — proceeding with login`)
    }
  }

  // ==========================================================
  // STEP 2: Go to Ads Manager (redirects to login)
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

  // Small random mouse movement — looks more human
  await randomMouseMovement(page)
  await randomDelay(500, 1000)

  // Close cookie dialog if present
  await dismissCookieBanner(page)
  await randomDelay(800, 1500)

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
    await randomDelay(1500, 2500)
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

  // Random mouse move before interacting with form
  await randomMouseMovement(page)
  await randomDelay(300, 700)

  // Click and type email with human-like behavior
  const emailBox = await emailInput.boundingBox()
  if (emailBox) {
    const ex = emailBox.x + emailBox.width * (0.3 + Math.random() * 0.4)
    const ey = emailBox.y + emailBox.height * (0.3 + Math.random() * 0.4)
    await page.mouse.move(ex, ey, { steps: 8 + Math.floor(Math.random() * 6) })
    await randomDelay(100, 250)
    await page.mouse.click(ex, ey)
  } else {
    await emailInput.click()
  }
  await randomDelay(200, 500)
  await humanType(page, email)
  await randomDelay(400, 800)

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

  const passBox = await passInput.boundingBox()
  if (passBox) {
    const px = passBox.x + passBox.width * (0.3 + Math.random() * 0.4)
    const py = passBox.y + passBox.height * (0.3 + Math.random() * 0.4)
    await page.mouse.move(px, py, { steps: 6 + Math.floor(Math.random() * 8) })
    await randomDelay(100, 200)
    await page.mouse.click(px, py)
  } else {
    await passInput.click()
  }
  await randomDelay(200, 400)
  await humanType(page, password)
  await randomDelay(400, 900)

  session.loginDomain = 'www.facebook.com'

  // Small pause before submit — humans don't submit instantly
  await randomDelay(300, 800)

  // Click login button with mouse (more natural than keyboard Enter)
  const loginClicked = await humanClick(page, '#loginbutton') ||
    await humanClick(page, 'button[name="login"]') ||
    await humanClick(page, 'button[type="submit"]')

  if (!loginClicked) {
    // Fallback to Enter key
    log(`No login button found, pressing Enter...`)
    await page.keyboard.press('Enter')
  }

  // Wait for navigation after login
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
  } catch {
    // Navigation might not trigger if it's SPA-like
  }
  await randomDelay(2000, 4000)

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
        await humanClick(page, sel)
        log(`Dismissed cookie banner: ${sel}`)
        await randomDelay(800, 1500)
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

    await randomDelay(1500, 3000)
    await takeScreenshot(session, page)

    const submitted = await submitCodeOnPage(page, code)
    if (submitted) {
      log(`2FA code submitted, waiting...`)
      await randomDelay(4000, 7000)
      await takeScreenshot(session, page)
      await handlePostCheckpointPrompts(page)

      // Verify login succeeded after 2FA
      const cookies = await page.cookies()
      const cUser = cookies.find(c => c.name === 'c_user')
      log(`After 2FA c_user: ${cUser ? cUser.value : 'NONE'}`)

      if (!cUser) {
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
          // Human-like: move mouse to input then click
          const box = await input.boundingBox()
          if (box) {
            const x = box.x + box.width * (0.3 + Math.random() * 0.4)
            const y = box.y + box.height * (0.3 + Math.random() * 0.4)
            await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 5) })
            await randomDelay(80, 200)
            await page.mouse.click(x, y, { clickCount: 3 })
          } else {
            await input.click({ clickCount: 3 })
          }
          await randomDelay(150, 300)
          await humanType(page, code)
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
        await randomDelay(150, 300)
        await humanType(page, code)
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

  await randomDelay(400, 800)

  // Submit
  for (const sel of ['#checkpointSubmitButton', 'button[type="submit"]', 'input[type="submit"]']) {
    try {
      const btn = await page.$(sel)
      if (btn && await btn.isVisible().catch(() => true)) {
        await humanClick(page, sel)
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
        await humanClick(page, 'button[type="submit"]')
        await randomDelay(2000, 4000)
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

    await randomDelay(4000, 7000)
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

  // ===== STRATEGY 1: Already have token from CDP interceptor =====
  if (token) {
    log(`Using CDP-intercepted token`)
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

      // Check CDP interceptor
      if (session.networkToken) {
        token = session.networkToken
        log(`Got token from CDP after Ads Manager: ${token.substring(0, 25)}...`)
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

        if (!token && session.networkToken) {
          token = session.networkToken
          log(`CDP interceptor caught token during DTSG call`)
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
    log(`Final: using CDP interceptor token`)
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
