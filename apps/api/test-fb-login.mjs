/**
 * Standalone test script for FB browser login
 * Uses rebrowser-puppeteer with full anti-detection stack
 * Run: node test-fb-login.mjs
 */
import puppeteer from 'rebrowser-puppeteer'
import * as OTPAuth from 'otpauth'

const EMAIL = 'nocturnebivalveu4tc@hotmail.com'
const PASSWORD = 'Superads@555'
const TWO_FA_SECRET = '7KRT4KZRC53LRHWG6HIQTCFD7O5JOTWH'

// Chrome path — set to your local Chrome or leave blank for bundled Chromium
const CHROME_PATH = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CHROME_PROFILE_DIR = process.env.CHROME_PROFILE_DIR || ''

function log(msg) {
  console.log(`[${new Date().toISOString().substring(11, 19)}] ${msg}`)
}

function generateTOTP(secret) {
  const totp = new OTPAuth.TOTP({
    issuer: 'Facebook',
    label: 'FB',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret.replace(/[\s-]/g, '').toUpperCase()),
  })
  return totp.generate()
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function randomDelay(min, max) {
  return sleep(min + Math.random() * (max - min))
}

async function humanType(page, text) {
  for (const char of text) {
    await page.keyboard.type(char)
    const isSpecial = /[^a-zA-Z0-9]/.test(char)
    await randomDelay(isSpecial ? 80 : 30, isSpecial ? 200 : 120)
  }
}

async function humanClick(page, selector) {
  const el = await page.$(selector)
  if (!el) return false
  const box = await el.boundingBox()
  if (!box) return false
  const x = box.x + box.width * (0.3 + Math.random() * 0.4)
  const y = box.y + box.height * (0.3 + Math.random() * 0.4)
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) })
  await randomDelay(50, 150)
  await page.mouse.click(x, y)
  return true
}

async function randomMouseMovement(page) {
  const viewport = page.viewport()
  const w = viewport?.width || 1920
  const h = viewport?.height || 1080
  const x = 100 + Math.random() * (w - 200)
  const y = 100 + Math.random() * (h - 200)
  await page.mouse.move(x, y, { steps: 3 + Math.floor(Math.random() * 5) })
}

async function injectAntiFingerprint(page) {
  await page.evaluateOnNewDocument(() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })

    // Spoof WebGL renderer
    const getParameter = WebGLRenderingContext.prototype.getParameter
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'Intel Inc.'
      if (param === 37446) return 'Intel Iris OpenGL Engine'
      return getParameter.call(this, param)
    }

    // Spoof WebGL2 renderer
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Intel Inc.'
        if (param === 37446) return 'Intel Iris OpenGL Engine'
        return getParameter2.call(this, param)
      }
    }

    // Override navigator.plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ]
        plugins.length = 3
        return plugins
      }
    })

    // Override navigator.languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })

    // Fix chrome.runtime (missing in headless)
    if (!window.chrome) window.chrome = {}
    if (!window.chrome.runtime) window.chrome.runtime = { connect: () => {}, sendMessage: () => {} }

    // Override permissions query
    const originalQuery = window.navigator.permissions?.query
    if (originalQuery) {
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      )
    }
  })
}

async function main() {
  log('Launching browser with rebrowser-puppeteer anti-detection...')

  const launchOptions = {
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
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
    defaultViewport: null,
  }

  if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH
  if (CHROME_PROFILE_DIR) launchOptions.userDataDir = CHROME_PROFILE_DIR

  const browser = await puppeteer.launch(launchOptions)
  const page = await browser.newPage()

  // Inject anti-fingerprint scripts
  await injectAntiFingerprint(page)

  // CDP-based token capture (NOT request interception)
  let networkToken = null
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  client.on('Network.responseReceived', async (params) => {
    const url = params.response.url || ''

    if (url.includes('access_token=EAA')) {
      try {
        const urlObj = new URL(url)
        const t = urlObj.searchParams.get('access_token')
        if (t && t.startsWith('EAA') && t.length > 30) {
          networkToken = t
          log(`[CDP] Token from URL: ${t.substring(0, 30)}...`)
        }
      } catch {}
    }

    const ct = params.response.headers?.['content-type'] || params.response.headers?.['Content-Type'] || ''
    if (url.includes('facebook.com') && (ct.includes('json') || ct.includes('javascript'))) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId: params.requestId })
        const text = body.body || ''
        const matches = text.match(/(EAA[A-Za-z0-9]{30,})/g)
        if (matches) {
          for (const t of matches) {
            if (t.length > 30 && t.length < 500) {
              networkToken = t
              log(`[CDP] Token from body (${url.substring(0, 60)}): ${t.substring(0, 30)}...`)
            }
          }
        }
      } catch {}
    }
  })

  // ====================================================
  // Check cookie persistence — skip login if already logged in
  // ====================================================
  if (CHROME_PROFILE_DIR) {
    log('Checking cookie persistence (persistent profile)...')
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 })
    const cookies = await page.cookies()
    const cUser = cookies.find(c => c.name === 'c_user')
    if (cUser) {
      log(`Already logged in from previous session! c_user=${cUser.value}`)
      log('Skipping login form, going straight to token capture...')
      // Jump to token capture
      await captureToken(page, browser, client, networkToken)
      return
    }
    log('No saved session, proceeding with login...')
  }

  // ====================================================
  // Step 1: Go to www.facebook.com/login
  // ====================================================
  log('Step 1: Navigating to www.facebook.com/login...')
  await page.goto('https://www.facebook.com/login/', {
    waitUntil: 'networkidle2',
    timeout: 30000
  })

  log(`Landing URL: ${page.url()}`)
  await page.screenshot({ path: '/tmp/fb-step1-landing.png' })

  // Random mouse movement
  await randomMouseMovement(page)
  await randomDelay(500, 1000)

  // Dismiss cookies
  for (const sel of ['[data-cookiebanner="accept_button"]', 'button[title="Decline optional cookies"]', 'button[title="Only allow essential cookies"]', '[value="Accept All"]']) {
    try {
      const btn = await page.$(sel)
      if (btn) { await humanClick(page, sel); log(`Dismissed cookie: ${sel}`); await randomDelay(800, 1500); break }
    } catch {}
  }
  await randomDelay(800, 1500)

  // ====================================================
  // Step 2: Find and fill login form
  // ====================================================
  log('Step 2: Looking for email input...')
  let emailInput = null
  for (const sel of ['#email', 'input[name="email"]', 'input[type="email"]', 'input[type="text"]']) {
    emailInput = await page.$(sel)
    if (emailInput && await emailInput.isVisible().catch(() => true)) {
      log(`Found email: ${sel}`)
      break
    }
    emailInput = null
  }

  if (!emailInput) {
    log('Waiting for email input...')
    try {
      emailInput = await page.waitForSelector('#email, input[name="email"]', { visible: true, timeout: 10000 })
      log('Found email after wait')
    } catch {
      log('FAILED: No email input after 10s')
      await page.screenshot({ path: '/tmp/fb-FAILED-no-email.png' })
      await browser.close()
      return
    }
  }

  // Random move before typing
  await randomMouseMovement(page)
  await randomDelay(300, 600)

  // Click email with mouse
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
  await humanType(page, EMAIL)
  log('Email entered')
  await randomDelay(400, 800)

  // Password
  let passInput = null
  for (const sel of ['#pass', 'input[name="pass"]', 'input[type="password"]']) {
    passInput = await page.$(sel)
    if (passInput) break
  }
  if (!passInput) {
    log('FATAL: No password input')
    await browser.close()
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
  await humanType(page, PASSWORD)
  log('Password entered')
  await randomDelay(400, 900)

  // Submit — click login button
  await randomDelay(300, 800)
  const loginClicked = await humanClick(page, '#loginbutton') ||
    await humanClick(page, 'button[name="login"]') ||
    await humanClick(page, 'button[type="submit"]')

  if (!loginClicked) {
    log('No login button found, pressing Enter...')
    await page.keyboard.press('Enter')
  }

  try {
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 })
  } catch {}
  await randomDelay(2000, 4000)

  await page.screenshot({ path: '/tmp/fb-step3-after-login.png' })
  log(`After login URL: ${page.url()}`)

  // Check cookies
  let cookies = await page.cookies()
  let cUser = cookies.find(c => c.name === 'c_user')
  log(`c_user: ${cUser ? `${cUser.value} @ ${cUser.domain}` : 'NONE'}`)

  // ====================================================
  // Step 3: Handle 2FA if needed
  // ====================================================
  const content = await page.content()
  const url = page.url()
  const needs2FA = url.includes('checkpoint') ||
    url.includes('two_step_verification') ||
    url.includes('two_factor') ||
    content.includes('approvals_code') ||
    content.includes('Enter the code') ||
    content.includes('Two-factor') ||
    content.includes('Login code') ||
    content.includes('Enter Code') ||
    content.includes('security code') ||
    content.includes('Code Generator')
  log(`needs2FA: ${needs2FA}`)

  if (needs2FA) {
    log('Step 3: 2FA DETECTED!')
    const code = generateTOTP(TWO_FA_SECRET)
    log(`TOTP code: ${code}`)
    await randomDelay(1500, 3000)
    await page.screenshot({ path: '/tmp/fb-step4-2fa.png' })

    // Wait for React to render
    log('Waiting 10s for 2FA React app to render...')
    await sleep(10000)
    await page.screenshot({ path: '/tmp/fb-step4-2fa-detail.png' })

    let found2FA = false
    for (const sel of ['input[name="approvals_code"]', '#approvals_code', 'input[name="code"]', 'input[autocomplete="one-time-code"]', 'input[type="tel"]', 'input[type="number"]']) {
      const inp = await page.$(sel)
      if (inp && await inp.isVisible().catch(() => true)) {
        const box = await inp.boundingBox()
        if (box) {
          const x = box.x + box.width * (0.3 + Math.random() * 0.4)
          const y = box.y + box.height * (0.3 + Math.random() * 0.4)
          await page.mouse.move(x, y, { steps: 5 })
          await randomDelay(80, 200)
          await page.mouse.click(x, y, { clickCount: 3 })
        } else {
          await inp.click({ clickCount: 3 })
        }
        await randomDelay(150, 300)
        await humanType(page, code)
        log(`Typed 2FA into: ${sel}`)
        found2FA = true
        break
      }
    }

    if (!found2FA) {
      const inputs = await page.$$('input')
      for (const inp of inputs) {
        if (!await inp.isVisible().catch(() => false)) continue
        const type = await inp.evaluate(el => el.type)
        if (['hidden', 'password', 'email', 'submit', 'checkbox', 'radio', 'file'].includes(type)) continue
        await inp.click({ clickCount: 3 })
        await randomDelay(150, 300)
        await humanType(page, code)
        log(`Typed 2FA into fallback (type=${type})`)
        found2FA = true
        break
      }
    }

    if (found2FA) {
      await randomDelay(400, 800)
      for (const sel of ['#checkpointSubmitButton', 'button[type="submit"]', 'input[type="submit"]']) {
        const btn = await page.$(sel)
        if (btn && await btn.isVisible().catch(() => true)) {
          await humanClick(page, sel)
          log(`Clicked 2FA submit: ${sel}`)
          break
        }
      }

      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }) } catch {}
      await sleep(5000)

      // Handle "Remember browser" prompts
      for (let i = 0; i < 3; i++) {
        const c = await page.content()
        const u = page.url()
        if (!u.includes('checkpoint') && !c.includes('Remember') && !c.includes('Save Browser')) break
        log(`Post-checkpoint prompt ${i + 1}`)
        try {
          await humanClick(page, 'button[type="submit"]')
          await randomDelay(2000, 4000)
        } catch {}
      }

      await page.screenshot({ path: '/tmp/fb-step5-after-2fa.png' })
      log(`After 2FA URL: ${page.url()}`)

      cookies = await page.cookies()
      cUser = cookies.find(c => c.name === 'c_user')
      log(`After 2FA c_user: ${cUser ? `${cUser.value} @ ${cUser.domain}` : 'NONE'}`)
    } else {
      log('FAILED: Could not find 2FA input')
      await page.screenshot({ path: '/tmp/fb-2fa-FAILED.png' })
    }
  } else if (!cUser) {
    log('No 2FA and no c_user — login silently failed')
    await page.screenshot({ path: '/tmp/fb-silent-fail.png' })
  }

  // ====================================================
  // Step 4: TOKEN CAPTURE
  // ====================================================
  await captureToken(page, browser, client, networkToken)
}

async function captureToken(page, browser, client, networkToken) {
  log('')
  log('===== TOKEN CAPTURE =====')
  log(`CDP token so far: ${networkToken ? networkToken.substring(0, 30) + '...' : 'NONE'}`)

  const cookies = await page.cookies()
  const cUser = cookies.find(c => c.name === 'c_user')
  if (!cUser) {
    log('FATAL: Not logged in. Aborting token capture.')
    await browser.close()
    return
  }
  log(`Logged in as c_user=${cUser.value}`)

  let token = networkToken

  // Strategy 1: adsmanager.facebook.com
  if (!token) {
    log('Strategy 1: adsmanager.facebook.com...')
    try {
      await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 30000 })
      log('Waiting 12s for AJAX...')
      await sleep(12000)
      await page.screenshot({ path: '/tmp/fb-step6-adsmanager.png' })
      log(`Adsmanager URL: ${page.url()}`)

      if (networkToken) {
        token = networkToken
        log(`Got token from CDP: ${token.substring(0, 30)}...`)
      }

      if (!token) {
        token = await page.evaluate(() => {
          const html = document.documentElement.innerHTML
          for (const p of [/"accessToken":"(EAA[^"]+)"/, /"access_token":"(EAA[^"]+)"/, /(EAA[A-Za-z0-9]{30,})/]) {
            const m = html.match(p)
            if (m && m[1].length > 30 && m[1].length < 500) return m[1]
          }
          return null
        })
        if (token) log(`Got token from page HTML: ${token.substring(0, 30)}...`)
      }
    } catch (e) {
      log(`adsmanager failed: ${e.message}`)
    }
  }

  // Strategy 2: business.facebook.com
  if (!token) {
    log('Strategy 2: business.facebook.com...')
    try {
      await page.goto('https://business.facebook.com/latest/settings/business_users', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(8000)
      await page.screenshot({ path: '/tmp/fb-step7-business.png' })
      if (networkToken) {
        token = networkToken
        log(`Got token from business: ${token.substring(0, 30)}...`)
      }
    } catch (e) {
      log(`business failed: ${e.message}`)
    }
  }

  // Strategy 3: www.facebook.com/adsmanager
  if (!token) {
    log('Strategy 3: www.facebook.com/adsmanager...')
    try {
      await page.goto('https://www.facebook.com/adsmanager/manage/campaigns', { waitUntil: 'networkidle2', timeout: 25000 })
      await sleep(8000)
      await page.screenshot({ path: '/tmp/fb-step8-www-adsmanager.png' })
      if (networkToken) {
        token = networkToken
        log(`Got token from www adsmanager: ${token.substring(0, 30)}...`)
      }
    } catch (e) {
      log(`www adsmanager failed: ${e.message}`)
    }
  }

  log('')
  log(`===== FINAL RESULT: ${token ? 'TOKEN CAPTURED!' : 'NO TOKEN'} =====`)
  if (token) {
    log(`Token: ${token.substring(0, 50)}...`)
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
      const data = await res.json()
      log(`Validated: ${JSON.stringify(data)}`)
    } catch (e) {
      log(`Validation error: ${e.message}`)
    }
  }

  log('Done. Closing browser in 10s...')
  await sleep(10000)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
