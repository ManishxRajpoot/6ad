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

const FB_GRAPH_BASE = 'https://graph.facebook.com/v18.0' // v18.0 matches the Chrome extension

// Chrome config from env
const CHROME_PATH = process.env.CHROME_PATH || undefined // undefined = use bundled Chromium
const CHROME_PROFILE_DIR = process.env.CHROME_PROFILE_DIR || undefined // undefined = temp profile

function log(msg: string) {
  console.log(`[FBBrowser] ${msg}`)
}

// Active login sessions being processed
interface LoginSession {
  id: string
  status: 'launching' | 'logging_in' | 'waiting_manual_login' | 'needs_2fa' | 'submitting_2fa' | 'capturing_token' | 'success' | 'failed'
  browser: Browser | null
  page: Page | null
  cdpClient: CDPSession | null
  error?: string
  fbName?: string
  fbUserId?: string
  capturedToken?: string
  networkToken?: string
  allCapturedTokens: Set<string>
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
      // Clear background token poller if running
      if ((session as any)._pollInterval) {
        clearInterval((session as any)._pollInterval)
      }
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

// ==================== XHR/Fetch Interception (like extension content.js) ====================
// The Chrome extension captures tokens by monkey-patching XHR and fetch in MAIN world.
// CDP requestWillBeSent does NOT see FormData bodies — but JS-level interception does.
// This is the key difference that lets the extension capture valid tokens (EAAI...).

async function injectTokenInterceptor(page: Page) {
  await page.evaluateOnNewDocument(() => {
    // Store captured tokens in a global array the Node side can read
    (window as any).__6ad_tokens = [] as string[]

    function saveToken(token: string, source: string) {
      if (!token || token.indexOf('EAA') !== 0 || token.length < 20) return
      // Deduplicate
      if ((window as any).__6ad_tokens.includes(token)) return
      ;(window as any).__6ad_tokens.push(token)
      console.log('[6AD-inject] Token captured via ' + source + ': ' + token.substring(0, 20) + '... (len=' + token.length + ')')
    }

    // ===== Intercept XMLHttpRequest =====
    const origOpen = XMLHttpRequest.prototype.open
    const origSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
      (this as any).__6adUrl = String(url)
      return origOpen.apply(this, arguments as any)
    }

    XMLHttpRequest.prototype.send = function (body?: any) {
      try {
        if ((this as any).__6adUrl) {
          const urlStr = String((this as any).__6adUrl)
          const m = urlStr.match(/access_token=(EAA[a-zA-Z0-9]+)/)
          if (m) saveToken(m[1], 'xhr-url')
        }
        if (body && typeof body === 'string') {
          const m2 = body.match(/access_token=(EAA[a-zA-Z0-9]+)/)
          if (m2) saveToken(m2[1], 'xhr-body')
        }
        // KEY: FormData.get() — CDP can't see this, but JS interception can!
        if (body && typeof body === 'object' && body.get) {
          try {
            const t = body.get('access_token')
            if (t && typeof t === 'string') saveToken(t, 'xhr-formdata')
          } catch (e) {}
        }
      } catch (e) {}
      return origSend.apply(this, arguments as any)
    }

    // ===== Intercept fetch =====
    const origFetch = window.fetch
    window.fetch = function (input: any, init?: any) {
      try {
        const url = (typeof input === 'string') ? input : (input && input.url ? input.url : '')
        const m = url.match(/access_token=(EAA[a-zA-Z0-9]+)/)
        if (m) saveToken(m[1], 'fetch-url')

        if (init && init.body) {
          if (typeof init.body === 'string') {
            const m2 = init.body.match(/access_token=(EAA[a-zA-Z0-9]+)/)
            if (m2) saveToken(m2[1], 'fetch-body')
          }
          // KEY: FormData.get() — the extension's secret weapon
          if (typeof init.body === 'object' && init.body.get) {
            try {
              const t = init.body.get('access_token')
              if (t && typeof t === 'string') saveToken(t, 'fetch-formdata')
            } catch (e) {}
          }
        }
      } catch (e) {}
      return origFetch.apply(this, arguments as any)
    }

    console.log('[6AD-inject] XHR/fetch interceptors installed on', window.location.hostname)
  })
}

// ==================== CDP Token Interceptor ====================
// Uses Chrome DevTools Protocol directly — NOT request interception
// This is much harder for sites to detect

async function setupCDPTokenCapture(page: Page, session: LoginSession): Promise<CDPSession> {
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  // Helper to add a decoded token to the collection
  function addToken(raw: string, source: string) {
    try {
      const token = decodeURIComponent(raw)
      if (token.startsWith('EAA') && token.length > 30 && token.length < 500) {
        if (!session.allCapturedTokens.has(token)) {
          session.allCapturedTokens.add(token)
          log(`[CDP] New token #${session.allCapturedTokens.size} (${source}): ${token.substring(0, 30)}... (len=${token.length})`)
        }
        // Also set networkToken for backward compat (first token found)
        if (!session.networkToken) session.networkToken = token
      }
    } catch {
      if (raw.startsWith('EAA') && raw.length > 30) {
        if (!session.allCapturedTokens.has(raw)) {
          session.allCapturedTokens.add(raw)
          log(`[CDP] New raw token #${session.allCapturedTokens.size} (${source}): ${raw.substring(0, 30)}...`)
        }
        if (!session.networkToken) session.networkToken = raw
      }
    }
  }

  // PRIMARY: Listen to outgoing REQUESTS — this is where tokens appear
  // Collect ALL unique tokens, validate later to find the right one
  client.on('Network.requestWillBeSent', (params: any) => {
    try {
      const url = params.request?.url || ''
      const postData = params.request?.postData || ''
      const tokenRegex = /access_token=(EAA[a-zA-Z0-9%_-]+)/

      // Check URL params for token
      const urlMatch = url.match(tokenRegex)
      if (urlMatch) {
        addToken(urlMatch[1], 'req-url')
        return
      }

      // Check POST body for token
      const bodyMatch = postData.match(tokenRegex)
      if (bodyMatch) {
        addToken(bodyMatch[1], 'req-body')
        return
      }

      // Broader match: find EAA token anywhere in URL or body
      const combined = url + ' ' + postData
      const anyMatch = combined.match(/EAA[a-zA-Z0-9%_-]{50,}/)
      if (anyMatch) {
        addToken(anyMatch[0], 'broad')
      }
    } catch {}
  })

  // SECONDARY: Also check response bodies (belt and suspenders)
  client.on('Network.responseReceived', async (params: any) => {
    try {
      const url = params.response.url || ''

      // Check URL for access_token param
      if (url.includes('access_token=EAA')) {
        try {
          const urlObj = new URL(url)
          const t = urlObj.searchParams.get('access_token')
          if (t) addToken(t, 'resp-url')
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
              if (t.length > 30 && t.length < 500) addToken(t, 'resp-body')
            }
          }
        } catch {}
      }
    } catch {}
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
    allCapturedTokens: new Set<string>(),
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

  // Layer 7: XHR/Fetch interception (like extension's content.js MAIN world)
  // This captures tokens from FormData bodies that CDP cannot see
  await injectTokenInterceptor(page)

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
  // STEP 2: MANUAL LOGIN FLOW
  // Open facebook.com/login — user logs in manually in the Chrome window.
  // We poll for c_user cookie every 3s. Once detected → capture tokens.
  // This avoids CAPTCHA/bot-detection since the user interacts directly.
  // ==========================================================
  log(`Navigating to www.facebook.com/login...`)
  await page.goto('https://www.facebook.com/login/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })

  await takeScreenshot(session, page)

  // Close cookie dialog if present
  await dismissCookieBanner(page)

  // Check if already logged in (FB redirected away from login)
  const currentUrl = page.url()
  if (currentUrl.includes('facebook.com') && !currentUrl.includes('/login') && !currentUrl.includes('checkpoint')) {
    const cookies = await page.cookies()
    const cUserCheck = cookies.find(c => c.name === 'c_user')
    if (cUserCheck) {
      log(`Already logged in! c_user: ${cUserCheck.value}`)
      await captureTokenAfterLogin(sessionId)
      return
    }
  }

  // ===== WAIT FOR MANUAL LOGIN =====
  // User logs in manually — we poll for c_user cookie
  session.status = 'waiting_manual_login'
  log(`Waiting for manual login... User must login in the Chrome window.`)

  const MAX_WAIT_MS = 5 * 60 * 1000 // 5 minutes max
  const POLL_INTERVAL = 3000
  const startTime = Date.now()
  let loggedIn = false

  while (Date.now() - startTime < MAX_WAIT_MS) {
    if (session.status === 'failed') return // Session was cancelled

    try {
      const cookies = await page.cookies('https://www.facebook.com')
      const cUser = cookies.find(c => c.name === 'c_user')
      if (cUser) {
        log(`Manual login detected! c_user: ${cUser.value}`)
        loggedIn = true
        break
      }
    } catch {}

    await sleep(POLL_INTERVAL)
  }

  if (!loggedIn) {
    session.status = 'failed'
    session.error = 'Login timed out (5 minutes). Please try again.'
    log(`Login timed out waiting for manual login`)
    await cleanupSession(sessionId)
    return
  }

  // ===== LOGIN SUCCEEDED =====
  log(`Login succeeded! c_user cookie present.`)
  await takeScreenshot(session, page)

  // Collect any tokens the JS interceptor captured during manual login/browsing
  await collectJSTokens(page, session)
  log(`Tokens captured during manual login phase: ${session.allCapturedTokens.size}`)

  // Small wait for FB to finish loading
  await sleep(3000)

  // Proceed to token capture
  log(`Proceeding to token capture...`)
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

// ==================== BM Page Interaction Helper ====================
// Facebook SPA pages only make token-containing API calls when the user interacts.
// This simulates clicks/scrolls to trigger those AJAX calls.

async function interactWithPage(page: Page, session: LoginSession) {
  if (session.networkToken) return // Already got token

  log(`Interacting with page to trigger API calls...`)

  // Click on various tabs, links, buttons that trigger AJAX
  const clickTargets = [
    // Ads Manager tabs
    'a[href*="campaigns"]',
    'a[href*="adsets"]',
    'a[href*="ads"]',
    '[role="tab"]',
    // BM navigation
    'a[href*="settings"]',
    'a[href*="ad_accounts"]',
    'a[href*="business_users"]',
    // Generic interactive elements
    '[data-testid]',
    'button[aria-label]',
  ]

  for (const sel of clickTargets) {
    if (session.networkToken) {
      log(`Token captured during interaction!`)
      return
    }
    try {
      const els = await page.$$(sel)
      if (els.length > 0) {
        // Click the first visible one
        for (const el of els.slice(0, 2)) {
          try {
            const box = await el.boundingBox()
            if (box && box.width > 0 && box.height > 0) {
              await el.click()
              log(`Clicked: ${sel}`)
              await sleep(2000) // Wait for AJAX response
              if (session.networkToken) return
              break
            }
          } catch {}
        }
      }
    } catch {}
  }

  // Scroll down to trigger lazy-loaded content
  try {
    await page.evaluate(() => window.scrollBy(0, 500))
    await sleep(2000)
    await page.evaluate(() => window.scrollBy(0, 500))
    await sleep(2000)
  } catch {}
}

// ==================== Capture Token After Login ====================
// NO automatic navigation — user browses manually.
// We just start a background poller that collects JS-intercepted + CDP tokens.
// User clicks "Finish" on the frontend to trigger validation.

async function captureTokenAfterLogin(sessionId: string) {
  const session = activeSessions.get(sessionId)
  if (!session || !session.page || !session.browser) return

  session.status = 'capturing_token'
  const page = session.page

  log(`=== TOKEN CAPTURE START (manual browsing mode) ===`)
  log(`Current URL: ${page.url()}`)
  log(`Tokens already collected: ${session.allCapturedTokens.size}`)
  log(`CDP session active: ${session.cdpClient ? 'YES' : 'NO'}`)

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

  // Start background token poller — collects tokens every 3s while user browses
  log(`Browser stays open. User browses FB pages manually.`)
  log(`Polling for JS-intercepted tokens every 3 seconds...`)
  log(`User should visit: Ads Manager, BM Settings, etc.`)

  const pollInterval = setInterval(async () => {
    try {
      if (!activeSessions.has(sessionId)) {
        clearInterval(pollInterval)
        return
      }
      await collectJSTokens(page, session)

      // Also extract from current page HTML
      try {
        const htmlTokens = await page.evaluate(() => {
          const html = document.documentElement.innerHTML
          const matches = html.match(/EAA[a-zA-Z0-9]{50,}/g)
          return matches || []
        })
        for (const ht of htmlTokens) {
          if (ht.length > 30 && ht.length < 500 && !session.allCapturedTokens.has(ht)) {
            session.allCapturedTokens.add(ht)
            log(`[HTML-POLL] Token from page: ${ht.substring(0, 30)}...`)
          }
        }
      } catch {}
    } catch {}
  }, 3000)

  // Store the interval so we can clean it up
  ;(session as any)._pollInterval = pollInterval
}

// ==================== Finish & Validate Tokens ====================
// Called when user clicks "Finish" — collects final tokens, validates, saves

export async function finishTokenCapture(sessionId: string): Promise<{ success: boolean; error?: string; fbName?: string }> {
  const session = activeSessions.get(sessionId)
  if (!session) return { success: false, error: 'Session not found' }
  if (!session.page) return { success: false, error: 'No browser page' }

  const page = session.page

  // Stop the poller
  if ((session as any)._pollInterval) {
    clearInterval((session as any)._pollInterval)
  }

  log(`=== FINISH TOKEN CAPTURE ===`)

  // Final collection from page
  await collectJSTokens(page, session)

  // Extract from current page HTML
  try {
    const htmlTokens = await page.evaluate(() => {
      const html = document.documentElement.innerHTML
      const matches = html.match(/EAA[a-zA-Z0-9]{50,}/g)
      return matches || []
    })
    for (const ht of htmlTokens) {
      if (ht.length > 30 && ht.length < 500 && !session.allCapturedTokens.has(ht)) {
        session.allCapturedTokens.add(ht)
        log(`[HTML-FINAL] Token: ${ht.substring(0, 30)}...`)
      }
    }
  } catch {}

  // Cookie-based fetch (like extension)
  try {
    const allCookies = await page.cookies('https://www.facebook.com', 'https://business.facebook.com')
    const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

    if (cookieStr.includes('c_user=') && cookieStr.includes('xs=')) {
      log(`Cookie-based fetch (extension method)...`)

      const urls = [
        'https://business.facebook.com/business_locations/',
        'https://business.facebook.com/content_management/',
        'https://www.facebook.com/adsmanager/manage/campaigns',
      ]

      for (const fetchUrl of urls) {
        try {
          const resp = await fetch(fetchUrl, {
            headers: {
              'Cookie': cookieStr,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
          })

          if (resp.ok) {
            const html = await resp.text()
            const matches = html.match(/EAA[a-zA-Z0-9]{50,}/g)
            if (matches) {
              for (const m of matches) {
                if (m.length > 50 && m.length < 500 && !session.allCapturedTokens.has(m)) {
                  session.allCapturedTokens.add(m)
                  log(`[COOKIE-FETCH] Token from ${new URL(fetchUrl).pathname}: ${m.substring(0, 30)}...`)
                }
              }
            }
          }
        } catch (e: any) {
          log(`Cookie fetch failed: ${e.message}`)
        }
      }
    }
  } catch {}

  log(`Total tokens collected: ${session.allCapturedTokens.size}`)
  for (const t of session.allCapturedTokens) {
    log(`  Token: ${t.substring(0, 35)}... (len=${t.length})`)
  }

  if (session.allCapturedTokens.size === 0) {
    session.status = 'failed'
    session.error = 'No tokens captured. Please browse Ads Manager or BM Settings pages before clicking Finish.'
    await cleanupSession(sessionId)
    return { success: false, error: session.error }
  }

  // Validate all tokens against Graph API
  let fbName = ''
  let fbUserId = ''
  let validToken = ''

  log(`Validating ${session.allCapturedTokens.size} tokens against Graph API v18.0...`)

  for (const candidateToken of session.allCapturedTokens) {
    try {
      const validateRes = await fetch(`${FB_GRAPH_BASE}/me?fields=id,name&access_token=${encodeURIComponent(candidateToken)}`)
      const validateData = await validateRes.json() as any

      if (validateData.id && validateData.name) {
        fbName = validateData.name
        fbUserId = validateData.id
        validToken = candidateToken
        log(`VALID TOKEN: ${candidateToken.substring(0, 30)}... → ${fbName} (${fbUserId})`)
        break
      } else {
        log(`Invalid: ${candidateToken.substring(0, 25)}... → ${validateData.error?.message || 'unknown'}`)
      }
    } catch (e: any) {
      log(`Error validating: ${candidateToken.substring(0, 25)}... → ${e.message}`)
    }
  }

  if (!validToken) {
    log(`No token passed validation out of ${session.allCapturedTokens.size} candidates.`)
    session.status = 'failed'
    session.error = `None of the ${session.allCapturedTokens.size} captured tokens passed Graph API validation. Browse more pages and try again.`
    // Don't cleanup — keep browser open so user can try again
    return { success: false, error: session.error }
  }

  session.fbName = fbName
  session.fbUserId = fbUserId

  // Try to exchange for long-lived token
  let finalToken = validToken
  const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
  const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

  if (FB_APP_ID && FB_APP_SECRET) {
    try {
      const exchangeUrl = `${FB_GRAPH_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(validToken)}`
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
      name: `FB: ${fbName}`,
      apiKey: keyHash,
      apiKeyPrefix: keyPrefix,
      adAccountIds: [],
      fbAccessToken: finalToken,
      fbUserId: fbUserId,
      fbUserName: fbName,
    }
  })

  session.status = 'success'
  log(`=== LOGIN COMPLETE: ${fbName} (${fbUserId}) ===`)
  await cleanupSession(sessionId)

  return { success: true, fbName }
}

// ==================== Collect JS-Intercepted Tokens ====================
// Reads tokens captured by the injected XHR/fetch interceptor from window.__6ad_tokens

async function collectJSTokens(page: Page, session: LoginSession) {
  try {
    const tokens = await page.evaluate(() => {
      return (window as any).__6ad_tokens || []
    }) as string[]

    let newCount = 0
    for (const t of tokens) {
      if (t.startsWith('EAA') && t.length > 20 && t.length < 500) {
        if (!session.allCapturedTokens.has(t)) {
          session.allCapturedTokens.add(t)
          newCount++
          log(`[JS-INTERCEPT] New token: ${t.substring(0, 30)}... (len=${t.length})`)
        }
      }
    }
    if (newCount > 0) {
      log(`[JS-INTERCEPT] Collected ${newCount} new tokens (total: ${session.allCapturedTokens.size})`)
    }
  } catch (e: any) {
    log(`[JS-INTERCEPT] Failed to collect: ${e.message}`)
  }
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
    tokenCount: session.allCapturedTokens.size,
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
