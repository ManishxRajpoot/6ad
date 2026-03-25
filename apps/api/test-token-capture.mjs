/**
 * Quick test: login to FB and see if CDP captures any EAA tokens
 * Run: node test-token-capture.mjs
 */
import puppeteer from 'rebrowser-puppeteer'
import * as OTPAuth from 'otpauth'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const EMAIL = 'nocturnebivalveu4tc@hotmail.com'
const PASSWORD = 'Superads@555'
const TWO_FA_SECRET = '7KRT4KZRC53LRHWG6HIQTCFD7O5JOTWH'

const sleep = ms => new Promise(r => setTimeout(r, ms))

function generateTOTP(secret) {
  const totp = new OTPAuth.TOTP({ issuer: 'Facebook', label: 'FB', algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret.replace(/[\s-]/g, '').toUpperCase()) })
  return totp.generate()
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1366,768', '--disable-blink-features=AutomationControlled'],
    defaultViewport: null,
  })

  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  let tokens = []

  // Listen to REQUESTS (like the extension does)
  client.on('Network.requestWillBeSent', (params) => {
    const url = params.request?.url || ''
    const postData = params.request?.postData || ''
    const combined = url + ' ' + postData

    const m = combined.match(/access_token=(EAA[a-zA-Z0-9%_-]+)/)
    if (m) {
      try {
        const t = decodeURIComponent(m[1])
        if (t.length > 30) {
          tokens.push({ token: t, source: 'request-param', url: url.substring(0, 80) })
          console.log(`[REQUEST] access_token= found: ${t.substring(0, 40)}... (len=${t.length})`)
        }
      } catch {}
    }

    const broad = combined.match(/EAA[a-zA-Z0-9]{50,}/)
    if (broad && !m) {
      tokens.push({ token: broad[0], source: 'request-broad', url: url.substring(0, 80) })
      console.log(`[REQUEST-BROAD] EAA found: ${broad[0].substring(0, 40)}... (len=${broad[0].length})`)
    }
  })

  // Listen to responses too
  client.on('Network.responseReceived', async (params) => {
    const url = params.response?.url || ''
    const ct = params.response?.headers?.['content-type'] || ''
    if (url.includes('facebook.com') && (ct.includes('json') || ct.includes('javascript') || ct.includes('html'))) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId: params.requestId })
        const text = body.body || ''
        const matches = text.match(/EAA[a-zA-Z0-9]{50,}/g)
        if (matches) {
          for (const t of matches) {
            if (t.length > 50 && t.length < 500) {
              tokens.push({ token: t, source: 'response-body', url: url.substring(0, 80) })
              console.log(`[RESPONSE] EAA in body: ${t.substring(0, 40)}... from ${url.substring(0, 60)}`)
            }
          }
        }
      } catch {}
    }
  })

  // ====== LOGIN ======
  console.log('\n=== STEP 1: LOGIN ===')
  await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(2000)

  const emailEl = await page.$('#email')
  if (emailEl) { await emailEl.click(); await page.keyboard.type(EMAIL, { delay: 50 }); console.log('Email entered') }
  await sleep(500)

  const passEl = await page.$('#pass')
  if (passEl) { await passEl.click(); await page.keyboard.type(PASSWORD, { delay: 50 }); console.log('Password entered') }
  await sleep(500)

  const loginBtn = await page.$('#loginbutton') || await page.$('button[name="login"]') || await page.$('button[type="submit"]')
  if (loginBtn) await loginBtn.click()
  console.log('Login clicked')

  try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }) } catch {}
  await sleep(3000)
  console.log('After login URL:', page.url())

  // ====== 2FA ======
  const content = await page.content()
  const currentUrl = page.url()
  const needs2FA = currentUrl.includes('checkpoint') || currentUrl.includes('two_step_verification') || currentUrl.includes('two_factor') ||
    content.includes('approvals_code') || content.includes('Enter the code') || content.includes('Two-factor') ||
    content.includes('Login code') || content.includes('Enter Code') || content.includes('security code') || content.includes('Code Generator')

  if (needs2FA) {
    console.log('\n=== 2FA DETECTED ===')
    console.log('2FA URL:', currentUrl.substring(0, 100))
    const code = generateTOTP(TWO_FA_SECRET)
    console.log('TOTP code:', code)

    // Wait long for the new React-based 2FA page to fully render
    console.log('Waiting 15s for 2FA page to render...')
    await sleep(15000)
    await page.screenshot({ path: '/tmp/fb-2fa-page.png' })
    console.log('Screenshot saved: /tmp/fb-2fa-page.png')

    // Log all visible inputs for debugging
    const allInputs = await page.$$eval('input', els => els.map(el => ({
      name: el.name, type: el.type, id: el.id, placeholder: el.placeholder,
      visible: el.offsetWidth > 0 && el.offsetHeight > 0,
      autocomplete: el.autocomplete
    })))
    console.log('All inputs on page:', JSON.stringify(allInputs, null, 2))

    let found = false
    for (const sel of ['input[name="approvals_code"]', '#approvals_code', 'input[name="code"]',
      'input[autocomplete="one-time-code"]', 'input[type="tel"]', 'input[type="number"]',
      'input[type="text"]']) {
      const inp = await page.$(sel)
      if (inp) {
        const visible = await inp.isVisible().catch(() => false)
        const box = await inp.boundingBox()
        if (visible || (box && box.width > 0)) {
          await inp.click({ clickCount: 3 })
          await sleep(200)
          await page.keyboard.type(code, { delay: 80 })
          console.log('2FA entered in:', sel)
          found = true
          break
        }
      }
    }

    if (!found) {
      // Fallback: find any visible text/tel/number input
      const inputs = await page.$$('input')
      for (const inp of inputs) {
        const type = await inp.evaluate(el => el.type)
        if (['hidden', 'password', 'email', 'submit', 'checkbox', 'radio', 'file', 'button'].includes(type)) continue
        const visible = await inp.isVisible().catch(() => false)
        if (visible) {
          await inp.click({ clickCount: 3 })
          await sleep(200)
          await page.keyboard.type(code, { delay: 80 })
          console.log('2FA entered in fallback input (type=' + type + ')')
          found = true
          break
        }
      }
    }

    if (!found) {
      console.log('WARNING: Could not find 2FA input!')
      await page.screenshot({ path: '/tmp/fb-2fa-noinput.png' })
    }

    if (found) {
      await sleep(500)
      // Try multiple submit button selectors
      for (const sel of ['#checkpointSubmitButton', 'button[type="submit"]', 'div[role="button"]', 'input[type="submit"]']) {
        const btn = await page.$(sel)
        if (btn) {
          const visible = await btn.isVisible().catch(() => false)
          if (visible) {
            await btn.click()
            console.log('Clicked submit:', sel)
            break
          }
        }
      }
      try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }) } catch {}
      await sleep(5000)
      await page.screenshot({ path: '/tmp/fb-after-2fa.png' })

      // Remember browser / save browser prompts
      for (let i = 0; i < 3; i++) {
        const u = page.url()
        if (!u.includes('checkpoint') && !u.includes('two_step')) break
        console.log(`Post-2FA prompt ${i + 1}, URL: ${u.substring(0, 80)}`)
        const btn = await page.$('button[type="submit"]') || await page.$('div[role="button"]')
        if (btn) { await btn.click(); await sleep(3000) }
      }
    }
  }

  // Check login
  const cookies = await page.cookies()
  const cUser = cookies.find(c => c.name === 'c_user')
  console.log('\nc_user:', cUser ? cUser.value : 'NONE')

  if (!cUser) {
    console.log('LOGIN FAILED — no c_user cookie')
    await sleep(5000)
    await browser.close()
    return
  }

  console.log('LOGIN SUCCESS!')
  console.log('Tokens captured during login:', tokens.length)

  // ====== TOKEN CAPTURE: Navigate to BM pages ======
  console.log('\n=== STEP 2: TOKEN CAPTURE ===')

  const bmPages = [
    { url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns', name: 'Ads Manager' },
    { url: 'https://business.facebook.com/business_locations/', name: 'Business Locations' },
    { url: 'https://business.facebook.com/latest/settings/ad_accounts', name: 'BM Ad Accounts' },
    { url: 'https://business.facebook.com/latest/settings/business_users', name: 'BM Users' },
    { url: 'https://www.facebook.com/adsmanager/manage/campaigns', name: 'WWW Ads Manager' },
  ]

  for (const p of bmPages) {
    console.log(`\n--- ${p.name} ---`)
    console.log(`Navigating: ${p.url}`)
    try {
      await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 30000 })
      await sleep(8000)
      console.log('Current URL:', page.url())
      console.log('Tokens so far:', tokens.length)

      // Try HTML extraction
      const htmlToken = await page.evaluate(() => {
        const m = document.documentElement.innerHTML.match(/EAA[a-zA-Z0-9]{50,}/)
        return m ? m[0] : null
      })
      if (htmlToken) {
        tokens.push({ token: htmlToken, source: 'html', url: p.url })
        console.log(`[HTML] Token: ${htmlToken.substring(0, 40)}...`)
      }

      // Try clicking around to trigger AJAX
      const clickTargets = ['a[href*="campaigns"]', 'a[href*="adsets"]', '[role="tab"]', 'a[href*="settings"]']
      for (const sel of clickTargets) {
        try {
          const el = await page.$(sel)
          if (el) {
            const box = await el.boundingBox()
            if (box && box.width > 0) {
              await el.click()
              console.log(`Clicked: ${sel}`)
              await sleep(3000)
              if (tokens.length > 0) break
            }
          }
        } catch {}
      }
    } catch (e) {
      console.log(`Error: ${e.message}`)
    }
  }

  // ====== RESULTS ======
  console.log('\n\n========== FINAL RESULTS ==========')
  console.log(`Total tokens captured: ${tokens.length}`)

  if (tokens.length > 0) {
    // Deduplicate
    const unique = [...new Set(tokens.map(t => t.token))]
    console.log(`Unique tokens: ${unique.length}`)

    for (let i = 0; i < Math.min(unique.length, 5); i++) {
      const t = unique[i]
      const info = tokens.find(x => x.token === t)
      console.log(`\nToken ${i + 1} (source: ${info.source}):`)
      console.log(`  Value: ${t.substring(0, 60)}...`)
      console.log(`  Length: ${t.length}`)
      console.log(`  From: ${info.url}`)

      // Validate
      try {
        const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (data.id) {
          console.log(`  ✅ VALID: ${data.name} (${data.id})`)
        } else {
          console.log(`  ❌ Invalid: ${data.error?.message || 'unknown error'}`)
        }
      } catch (e) {
        console.log(`  ❌ Error: ${e.message}`)
      }
    }
  } else {
    console.log('NO TOKENS FOUND!')
    console.log('The CDP interceptor did not catch any EAA tokens from Facebook.')
  }

  console.log('\nClosing browser in 5s...')
  await sleep(5000)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
