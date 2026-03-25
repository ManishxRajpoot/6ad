/**
 * Manual login helper — opens Chrome with persistent profile
 *
 * 1. Chrome opens with facebook.com
 * 2. YOU login manually (solve CAPTCHA, 2FA, etc.)
 * 3. Press Enter in terminal when you're logged in
 * 4. Script saves cookies and tests token capture
 *
 * Run: node test-manual-login.mjs
 */
import puppeteer from 'rebrowser-puppeteer'
import * as readline from 'readline'

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROFILE_DIR = '/tmp/6ad-chrome-profile' // persistent profile

const sleep = ms => new Promise(r => setTimeout(r, ms))

function waitForEnter(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(prompt, () => { rl.close(); resolve() })
  })
}

async function main() {
  console.log('=== 6AD Manual FB Login ===')
  console.log(`Chrome profile: ${PROFILE_DIR}`)
  console.log('')

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1366,768',
      '--start-maximized', '--no-first-run', '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled', '--disable-infobars',
    ],
    defaultViewport: null,
  })

  const page = await browser.newPage()

  // Setup CDP token interceptor
  const client = await page.createCDPSession()
  await client.send('Network.enable')

  let tokens = []

  client.on('Network.requestWillBeSent', (params) => {
    try {
      const url = params.request?.url || ''
      const postData = params.request?.postData || ''
      const combined = url + ' ' + postData
      const m = combined.match(/access_token=(EAA[a-zA-Z0-9%_-]+)/)
      if (m) {
        try {
          const t = decodeURIComponent(m[1])
          if (t.length > 30) {
            tokens.push(t)
            console.log(`\n[CDP] Token captured: ${t.substring(0, 40)}... (len=${t.length})`)
          }
        } catch {}
      }
      const broad = combined.match(/EAA[a-zA-Z0-9]{50,}/)
      if (broad && !m) {
        tokens.push(broad[0])
        console.log(`\n[CDP-BROAD] Token: ${broad[0].substring(0, 40)}...`)
      }
    } catch {}
  })

  client.on('Network.responseReceived', async (params) => {
    const url = params.response?.url || ''
    const ct = params.response?.headers?.['content-type'] || ''
    if (url.includes('facebook.com') && (ct.includes('json') || ct.includes('javascript'))) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId: params.requestId })
        const text = body.body || ''
        const matches = text.match(/EAA[a-zA-Z0-9]{50,}/g)
        if (matches) {
          for (const t of matches) {
            if (t.length > 50 && t.length < 500 && !tokens.includes(t)) {
              tokens.push(t)
              console.log(`\n[CDP-RESP] Token in response: ${t.substring(0, 40)}...`)
            }
          }
        }
      } catch {}
    }
  })

  // Check if already logged in
  console.log('Checking if already logged in...')
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 })
  await sleep(3000)

  const cookies = await page.cookies()
  const cUser = cookies.find(c => c.name === 'c_user')

  if (cUser) {
    console.log(`\n✅ Already logged in! c_user=${cUser.value}`)
    console.log('Skipping manual login — going to token capture...')
  } else {
    console.log('\n❌ Not logged in.')
    console.log('')
    console.log('=================================================')
    console.log('  Please login to Facebook in the Chrome window.')
    console.log('  Solve any CAPTCHA / 2FA that appears.')
    console.log('  Then come back here and press ENTER.')
    console.log('=================================================')
    console.log('')

    await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 20000 })

    await waitForEnter('Press ENTER after you are logged in to Facebook... ')

    // Verify login
    const cookies2 = await page.cookies()
    const cUser2 = cookies2.find(c => c.name === 'c_user')
    if (!cUser2) {
      console.log('❌ Still not logged in (no c_user cookie). Please try again.')
      await browser.close()
      return
    }
    console.log(`\n✅ Logged in! c_user=${cUser2.value}`)
  }

  // ====== TOKEN CAPTURE ======
  console.log('\n=== TOKEN CAPTURE ===')
  console.log('Navigating to BM pages to capture EAA token...\n')

  const pages = [
    { url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns', name: 'Ads Manager' },
    { url: 'https://business.facebook.com/business_locations/', name: 'Business Locations' },
    { url: 'https://business.facebook.com/latest/settings/ad_accounts', name: 'BM Ad Accounts' },
    { url: 'https://business.facebook.com/latest/settings/business_users', name: 'BM Users' },
    { url: 'https://www.facebook.com/adsmanager/manage/campaigns', name: 'WWW Ads Manager' },
  ]

  for (const p of pages) {
    const uniqueBefore = [...new Set(tokens)].length
    console.log(`\n--- ${p.name} ---`)
    try {
      await page.goto(p.url, { waitUntil: 'networkidle2', timeout: 30000 })
      await sleep(8000)

      // Try HTML extraction
      const htmlToken = await page.evaluate(() => {
        const m = document.documentElement.innerHTML.match(/EAA[a-zA-Z0-9]{50,}/)
        return m ? m[0] : null
      })
      if (htmlToken && !tokens.includes(htmlToken)) {
        tokens.push(htmlToken)
        console.log(`[HTML] Token: ${htmlToken.substring(0, 40)}...`)
      }

      const uniqueAfter = [...new Set(tokens)].length
      console.log(`Tokens: ${uniqueBefore} → ${uniqueAfter}`)
    } catch (e) {
      console.log(`Error: ${e.message}`)
    }

    // Stop if we have tokens
    if (tokens.length > 0) {
      console.log('Token found! Skipping remaining pages.')
      break
    }
  }

  // ====== RESULTS ======
  console.log('\n\n========== RESULTS ==========')
  const unique = [...new Set(tokens)]
  console.log(`Total unique tokens: ${unique.length}`)

  if (unique.length > 0) {
    for (let i = 0; i < Math.min(unique.length, 3); i++) {
      const t = unique[i]
      console.log(`\nToken ${i + 1}:`)
      console.log(`  Value: ${t.substring(0, 70)}...`)
      console.log(`  Length: ${t.length}`)

      // Validate v18.0
      try {
        const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (data.id) {
          console.log(`  ✅ VALID (v18.0): ${data.name} (${data.id})`)
        } else {
          console.log(`  ❌ Invalid (v18.0): ${data.error?.message}`)
        }
      } catch (e) { console.log(`  ❌ Error: ${e.message}`) }

      // Also try v21.0
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (data.id) {
          console.log(`  ✅ VALID (v21.0): ${data.name} (${data.id})`)
        } else {
          console.log(`  ❌ Invalid (v21.0): ${data.error?.message}`)
        }
      } catch (e) { console.log(`  ❌ Error: ${e.message}`) }
    }
  } else {
    console.log('NO TOKENS CAPTURED!')
    console.log('')
    console.log('Try browsing Ads Manager or BM settings manually in the Chrome window.')
    console.log('The CDP interceptor will capture tokens as you browse.')
    console.log('')
    await waitForEnter('Press ENTER after browsing BM pages (or to close)... ')

    if (tokens.length > 0) {
      const t = tokens[tokens.length - 1]
      console.log(`\nToken captured: ${t.substring(0, 70)}...`)
      try {
        const res = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(t)}`)
        const data = await res.json()
        console.log(`Validation: ${JSON.stringify(data)}`)
      } catch (e) { console.log(`Error: ${e.message}`) }
    }
  }

  console.log('\nClosing browser...')
  await browser.close()
  console.log('Done! The Chrome profile is saved at:', PROFILE_DIR)
  console.log('Next time you run this or the automation, cookies will be reused.')
}

main().catch(e => { console.error(e); process.exit(1) })
