/**
 * AdsPower On-Demand Worker
 *
 * Smart task routing by ad account ID:
 *   - Each profile stores managedAdAccountIds (auto-populated from extension heartbeat)
 *   - When a task comes in for act_123, worker finds which profile has "123" in managedAdAccountIds
 *   - Opens ONLY that specific AdsPower browser
 *   - Extension processes the task, then browser is closed
 *
 * AdsPower Local API: http://localhost:50325/api/v1/browser/...
 */

import WebSocket from 'ws'
import * as OTPAuth from 'otpauth'
import { prisma } from '../lib/prisma.js'

// ─── Configuration ─────────────────────────────────────────────────
const CONFIG = {
  POLL_INTERVAL_MS: 30_000,
  ADSPOWER_API_BASE: process.env.ADSPOWER_API_BASE || 'http://localhost:50325',
  ADSPOWER_API_KEY: process.env.ADSPOWER_API_KEY || '1c36652b562b009f94bb48545b3b091f00205f7c6f0c18b1',
  BROWSER_LAUNCH_WAIT_MS: 15_000,
  HEARTBEAT_TIMEOUT_MS: 120_000,
  TASK_TIMEOUT_MS: 300_000,
  IDLE_CLOSE_DELAY_MS: 120_000,           // 2 min — close browser shortly after task completes
  POST_LOGIN_COOLDOWN_MS: 30_000,         // 30s cooldown after fresh login before opening adsmanager
  MAX_LOGINS_PER_DAY: 999,                // No practical limit — let it retry as needed
  LOGIN_BACKOFF_BASE_MS: 60_000,          // Base backoff after failed login (1 min)
  MAX_TASKS_BEFORE_RESTART: 12,           // Safety restart after N tasks
  MAX_UPTIME_MS: 8 * 60 * 60 * 1000,     // Safety restart after 8 hours uptime
}

// OAuth token generation REMOVED (v1.4.2) — navigating to /dialog/oauth was unnecessary
// and suspicious. Cookie-based recharge handles recharges server-side, extension captures tokens.

const activeBrowsers = new Map<string, { profileId: string; serialNumber: string; launchedAt: number; failedCycles: number; tasksCompleted: number }>()

// Performance stats (in-memory, resets on restart)
const workerStats = {
  totalRecharges: 0,
  totalRechargeTimeMs: 0,
  loggedInExecutions: 0,
  loggedOutExecutions: 0,
  lastResetAt: Date.now(),
}

let pollInterval: NodeJS.Timeout | null = null
let isProcessing = false

// ─── AdsPower API helpers ──────────────────────────────────────────

interface AdsPowerResponse {
  code: number
  msg: string
  data?: { ws?: { puppeteer: string; selenium: string }; webdriver?: string; status?: string }
}

async function adsPowerRequest(path: string): Promise<AdsPowerResponse> {
  try {
    // Append api_key to every request (required by AdsPower paid plans)
    const separator = path.includes('?') ? '&' : '?'
    const url = `${CONFIG.ADSPOWER_API_BASE}${path}${separator}api_key=${CONFIG.ADSPOWER_API_KEY}`
    const res = await fetch(url)
    return await res.json() as AdsPowerResponse
  } catch (err: any) {
    return { code: -1, msg: `AdsPower API unreachable: ${err.message}` }
  }
}

// Store debug info per serial number for CDP access
const browserDebugInfo = new Map<string, { debugPort: number; wsUrl: string }>()

async function startBrowser(serialNumber: string): Promise<boolean> {
  console.log(`[AdsPower] Starting browser serial=${serialNumber} with extension`)
  const launchArgs = encodeURIComponent(JSON.stringify(['--no-sandbox']))
  const openTabs = encodeURIComponent(JSON.stringify(['https://www.facebook.com/']))
  const res = await adsPowerRequest(`/api/v1/browser/start?serial_number=${serialNumber}&launch_args=${launchArgs}&open_tabs=${openTabs}`)
  if (res.code === 0) {
    console.log(`[AdsPower] Browser started: serial=${serialNumber}`)
    // Save debug info for CDP control
    if (res.data?.ws?.puppeteer) {
      try {
        const wsUrl = res.data.ws.puppeteer
        const portMatch = wsUrl.match(/:(\d+)\//)
        if (portMatch) {
          browserDebugInfo.set(serialNumber, { debugPort: parseInt(portMatch[1]), wsUrl })
          console.log(`[AdsPower] Debug port for serial=${serialNumber}: ${portMatch[1]}`)
        }
      } catch {}
    }
    return true
  }
  // Browser already running (various AdsPower messages)
  if (res.msg?.includes('bindled') || res.msg?.includes('bindling') || res.msg?.includes('bindl') || res.msg?.includes('already') || res.data?.ws) {
    console.log(`[AdsPower] Browser already running: serial=${serialNumber} (msg: ${res.msg})`)
    // Try ws data from start response first
    if (res.data?.ws?.puppeteer) {
      try {
        const wsUrl = res.data.ws.puppeteer
        const portMatch = wsUrl.match(/:(\d+)\//)
        if (portMatch) {
          browserDebugInfo.set(serialNumber, { debugPort: parseInt(portMatch[1]), wsUrl })
          console.log(`[AdsPower] Debug port from start response for serial=${serialNumber}: ${portMatch[1]}`)
        }
      } catch {}
    }
    // Fallback: try active endpoint
    if (!browserDebugInfo.has(serialNumber)) {
      const activeRes = await adsPowerRequest(`/api/v1/browser/active?serial_number=${serialNumber}`)
      console.log(`[AdsPower] Active endpoint response:`, JSON.stringify(activeRes.data))
      if (activeRes.data?.ws?.puppeteer) {
        try {
          const wsUrl = activeRes.data.ws.puppeteer
          const portMatch = wsUrl.match(/:(\d+)\//)
          if (portMatch) {
            browserDebugInfo.set(serialNumber, { debugPort: parseInt(portMatch[1]), wsUrl })
            console.log(`[AdsPower] Debug port from active endpoint for serial=${serialNumber}: ${portMatch[1]}`)
          }
        } catch {}
      }
    }
    return true
  }
  console.error(`[AdsPower] Failed to start serial=${serialNumber}: ${res.msg} (code: ${res.code})`)
  return false
}

/**
 * Use Chrome DevTools Protocol to auto-login Facebook and capture fresh token.
 * Flow:
 *   1. Navigate any tab to facebook.com/home.php (shows login form if logged out)
 *   2. Check: already logged in? Continue button? Login form?
 *   3. Fill email/password and click login if needed
 *   4. Open NEW tab to adsmanager URL — extension intercepts API calls to capture token
 */
async function cdpAutoLogin(serialNumber: string, profile: any): Promise<boolean> {
  let debugInfo = browserDebugInfo.get(serialNumber)

  // If no debug info, try refreshing from AdsPower API
  if (!debugInfo) {
    console.log(`[AdsPower CDP] No debug info cached — refreshing from AdsPower API...`)
    const activeRes = await adsPowerRequest(`/api/v1/browser/active?serial_number=${serialNumber}`)
    if (activeRes.data?.ws?.puppeteer) {
      const wsUrl = activeRes.data.ws.puppeteer
      const portMatch = wsUrl.match(/:(\d+)\//)
      if (portMatch) {
        debugInfo = { debugPort: parseInt(portMatch[1]), wsUrl }
        browserDebugInfo.set(serialNumber, debugInfo)
        console.log(`[AdsPower CDP] Refreshed debug info: port=${portMatch[1]}`)
      }
    }
    if (!debugInfo) {
      console.log(`[AdsPower CDP] No debug info for serial=${serialNumber}`)
      return false
    }
  }

  // ─── LOGIN RATE LIMIT CHECK ─────────────────────────────────────
  const profileLoginData = await prisma.facebookAutomationProfile.findUnique({
    where: { id: profile.id },
    select: { loginAttemptsToday: true, lastLoginAttemptAt: true, loginCooldownUntil: true, consecutiveLoginFails: true },
  })

  if (profileLoginData) {
    // Reset daily counter if last attempt was > 24h ago
    const lastAttempt = profileLoginData.lastLoginAttemptAt
    const isNewDay = !lastAttempt || (Date.now() - lastAttempt.getTime() > 24 * 60 * 60 * 1000)
    if (isNewDay && (profileLoginData.loginAttemptsToday > 0 || profileLoginData.consecutiveLoginFails > 0)) {
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { loginAttemptsToday: 0, consecutiveLoginFails: 0 },
      }).catch(() => {})
      console.log(`[AdsPower CDP] Reset daily login counter for "${profile.label}"`)
    }

    // Check cooldown
    if (profileLoginData.loginCooldownUntil && profileLoginData.loginCooldownUntil.getTime() > Date.now()) {
      const waitMin = Math.ceil((profileLoginData.loginCooldownUntil.getTime() - Date.now()) / 60_000)
      console.log(`[AdsPower CDP] Profile "${profile.label}" in login cooldown — ${waitMin} min remaining. Skipping.`)
      return false
    }

    // Check daily limit
    if (!isNewDay && profileLoginData.loginAttemptsToday >= CONFIG.MAX_LOGINS_PER_DAY) {
      console.error(`[ALERT] Profile "${profile.label}" hit daily login limit (${CONFIG.MAX_LOGINS_PER_DAY}). Skipping.`)
      return false
    }
  }

  // Increment login attempt counter BEFORE attempting
  await prisma.facebookAutomationProfile.update({
    where: { id: profile.id },
    data: {
      loginAttemptsToday: { increment: 1 },
      lastLoginAttemptAt: new Date(),
    },
  }).catch(() => {})

  const ADSMANAGER_URL = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1144840690863654&nav_entry_point=comet_bookmark&nav_source=comet'

  try {
    // Step 1: Get any open tab
    let tabsResp: Response
    try {
      tabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
    } catch (fetchErr: any) {
      // Debug port may be stale — refresh from AdsPower API
      console.log(`[AdsPower CDP] Debug port ${debugInfo.debugPort} unreachable — refreshing...`)
      const activeRes = await adsPowerRequest(`/api/v1/browser/active?serial_number=${serialNumber}`)
      if (activeRes.data?.ws?.puppeteer) {
        const wsUrl = activeRes.data.ws.puppeteer
        const portMatch = wsUrl.match(/:(\d+)\//)
        if (portMatch) {
          debugInfo = { debugPort: parseInt(portMatch[1]), wsUrl }
          browserDebugInfo.set(serialNumber, debugInfo)
          console.log(`[AdsPower CDP] New debug port: ${portMatch[1]}`)
          tabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
        } else {
          console.log(`[AdsPower CDP] Could not parse new debug port`)
          return false
        }
      } else {
        console.log(`[AdsPower CDP] Browser not active — cannot refresh debug info`)
        return false
      }
    }

    const tabs: any[] = await tabsResp!.json()

    // Use first "page" type tab (skip devtools, extensions, etc.)
    const pageTab = tabs.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (!pageTab) {
      console.log(`[AdsPower CDP] No usable tab found`)
      return false
    }

    let wsUrl = pageTab.webSocketDebuggerUrl
    await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json/activate/${pageTab.id}`).catch(() => {})

    // Get credentials from DB FIRST (before any navigation to avoid wasting time)
    const profileData = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: { fbLoginEmail: true, fbLoginPassword: true, twoFactorSecret: true },
    })

    if (!profileData?.fbLoginEmail || !profileData?.fbLoginPassword) {
      console.log(`[AdsPower CDP] No login credentials in DB for profile ${profile.id}`)
      return false
    }

    // Clean up ALL extra tabs before login — start with a clean browser
    await cdpCleanupTabs(debugInfo.debugPort)

    // Open facebook.com/home.php in a BRAND NEW tab via CDP Target.createTarget
    // Using existing tab fails because it's already on business.facebook.com which triggers instant redirect
    // A fresh tab doesn't carry that redirect context, so home.php shows the login form for ~10s
    console.log(`[AdsPower CDP] Opening facebook.com/home.php in NEW tab...`)
    const homeTabCreated = await cdpCreateTab(debugInfo.wsUrl, 'https://www.facebook.com/home.php')
    if (!homeTabCreated) {
      console.log(`[AdsPower CDP] Failed to create home.php tab — falling back to existing tab`)
      await cdpEvaluate(wsUrl, `window.location.href = 'https://www.facebook.com/home.php'`)
    }
    await sleep(4000) // Wait for new tab to load

    // Find the new home.php tab's WebSocket URL
    const freshTabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
    const freshTabs: any[] = await freshTabsResp.json()
    const loginFbTab = freshTabs.find((t: any) =>
      t.type === 'page' && t.webSocketDebuggerUrl &&
      (t.url?.includes('www.facebook.com') || t.url?.includes('facebook.com/home'))
    )
    if (loginFbTab) {
      wsUrl = loginFbTab.webSocketDebuggerUrl
      console.log(`[AdsPower CDP] Found new FB tab: ${loginFbTab.url?.substring(0, 80)}`)
    } else {
      console.log(`[AdsPower CDP] Could not find new FB tab — using original`)
    }

    // Step 2: POLL for login form — try every 2s for up to 12s
    // home.php shows login form for ~10s before redirect, so we have plenty of time
    let loginResult: any = null
    for (let attempt = 1; attempt <= 5; attempt++) {
      console.log(`[AdsPower CDP] Checking for login form (attempt ${attempt}/5)...`)
      loginResult = await cdpEvaluate(wsUrl, `
      (function() {
        var url = window.location.href;

        // Already logged in? (has c_user cookie = active session)
        if (document.cookie.includes('c_user=')) {
          return { status: 'already_logged_in', url: url.substring(0, 100) };
        }

        // 2FA page? (pending from previous login attempt — FB redirected directly here)
        if (/two_step_verification|two_factor|checkpoint/.test(url)) {
          return { status: '2fa_page', url: url.substring(0, 150), inputCount: document.querySelectorAll('input').length };
        }

        // Find login form inputs — expanded selectors
        var emailInput = document.querySelector('input[name="email"], input[id="email"], input[type="email"]');
        var passInput = document.querySelector('input[name="pass"], input[type="password"]');

        // Broad fallback: any visible text input + password input
        if (!emailInput || !passInput) {
          var allInputs = document.querySelectorAll('input');
          var foundEmail = null, foundPass = null;
          for (var j = 0; j < allInputs.length; j++) {
            var inp = allInputs[j];
            var type = (inp.type || '').toLowerCase();
            if (type === 'password' && !foundPass) foundPass = inp;
            else if ((type === 'text' || type === 'email' || type === '') && !foundEmail) {
              if (inp.offsetWidth > 0 && inp.offsetHeight > 0) foundEmail = inp;
            }
          }
          if (!emailInput && foundEmail) emailInput = foundEmail;
          if (!passInput && foundPass) passInput = foundPass;
        }

        if (!emailInput || !passInput) {
          return { status: 'no_form', url: url.substring(0, 150), title: document.title.substring(0, 80), inputCount: document.querySelectorAll('input').length };
        }

        // IMMEDIATELY fill credentials — race the 10s redirect!
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(emailInput, ${JSON.stringify(profileData.fbLoginEmail)});
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));

        setter.call(passInput, ${JSON.stringify(profileData.fbLoginPassword)});
        passInput.dispatchEvent(new Event('input', { bubbles: true }));
        passInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Click login button
        var btn = document.querySelector('button[name="login"], button[type="submit"], button[data-testid="royal_login_button"], button[id="loginbutton"]');
        if (btn) { btn.click(); return { status: 'login_clicked', btnSelector: 'standard' }; }

        // Try buttons with login text
        var buttons = document.querySelectorAll('button, div[role="button"], a[role="button"]');
        for (var k = 0; k < buttons.length; k++) {
          var btnText = (buttons[k].textContent || '').trim().toLowerCase();
          if (btnText === 'log in' || btnText === 'login' || btnText === 'sign in') {
            var rect = buttons[k].getBoundingClientRect();
            if (rect.width > 50 && rect.height > 20) {
              buttons[k].click();
              return { status: 'login_text_clicked', text: btnText };
            }
          }
        }

        // Fallback: submit form
        var form = emailInput.closest('form') || passInput.closest('form');
        if (form) { form.submit(); return { status: 'form_submitted' }; }

        // Last resort: Enter key on password field
        passInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        passInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        passInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        return { status: 'enter_pressed' };
      })()
    `)

      console.log(`[AdsPower CDP] Attempt ${attempt} result:`, JSON.stringify(loginResult))

      // Success cases — break out of polling loop
      if (loginResult?.status === 'already_logged_in' || loginResult?.status === '2fa_page' ||
          loginResult?.status === 'login_clicked' || loginResult?.status === 'login_text_clicked' ||
          loginResult?.status === 'form_submitted' || loginResult?.status === 'enter_pressed') {
        break
      }

      // No form yet — wait 2s and retry
      if (attempt < 5) {
        console.log(`[AdsPower CDP] No form yet (inputs: ${loginResult?.inputCount || 0}, url: ${loginResult?.url?.substring(0, 60) || 'unknown'}) — retrying in 2s...`)
        await sleep(2000)
      }
    }

    let loginDone = false

    if (loginResult?.status === 'already_logged_in') {
      console.log(`[AdsPower CDP] Already logged in!`)
      loginDone = true
    } else if (loginResult?.status === '2fa_page') {
      // Pending 2FA from previous session — handle directly (no login form submission needed)
      console.log(`[AdsPower CDP] 2FA page detected directly (pending from previous login)`)
      // Refresh wsUrl for the 2FA page tab
      try {
        const freshTabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
        const freshTabs: any[] = await freshTabsResp.json()
        const currentTab = freshTabs.find((t: any) => t.type === 'page' && /facebook\.com/.test(t.url))
        if (currentTab?.webSocketDebuggerUrl) {
          wsUrl = currentTab.webSocketDebuggerUrl
          console.log(`[AdsPower CDP] Refreshed wsUrl for 2FA: ${currentTab.url?.substring(0, 80)}`)
        }
      } catch {}
      const twoFaResult = await cdpHandle2FA(wsUrl, profileData)
      if (twoFaResult.handled) {
        console.log(`[AdsPower CDP] 2FA handled successfully — continuing login`)
        loginDone = true
      } else {
        console.error(`[ALERT] Profile "${profile.label}" 2FA detected but NOT handled: ${twoFaResult.message}`)
      }
    } else if (loginResult?.status === 'login_clicked' || loginResult?.status === 'login_text_clicked' || loginResult?.status === 'form_submitted' || loginResult?.status === 'enter_pressed') {
      console.log(`[AdsPower CDP] Login submitted (${loginResult.status}) — waiting 12s for FB to process...`)
      await sleep(12000)

      // ─── 2FA Detection & Handling ─────────────────────────
      // Refresh tab WebSocket URL — page may have navigated to 2FA checkpoint
      try {
        const freshTabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
        const freshTabs: any[] = await freshTabsResp.json()
        const currentTab = freshTabs.find((t: any) => t.type === 'page' && /facebook\.com/.test(t.url))
        if (currentTab?.webSocketDebuggerUrl) {
          wsUrl = currentTab.webSocketDebuggerUrl
          console.log(`[AdsPower CDP] Refreshed wsUrl for 2FA check: ${currentTab.url?.substring(0, 80)}`)
        }
      } catch {}
      const twoFaResult = await cdpHandle2FA(wsUrl, profileData)
      if (twoFaResult.detected) {
        if (twoFaResult.handled) {
          console.log(`[AdsPower CDP] 2FA handled successfully — continuing login`)
          loginDone = true
        } else {
          console.error(`[ALERT] Profile "${profile.label}" 2FA detected but NOT handled: ${twoFaResult.message}`)
          // loginDone stays false → will trigger backoff
        }
      } else {
        loginDone = true  // No 2FA required
      }
    } else {
      console.log(`[AdsPower CDP] Could not find login form after 5 attempts — last result: ${JSON.stringify(loginResult)}`)
    }

    if (!loginDone) {
      // LOGIN FAILURE — set exponential backoff cooldown
      const fails = (profileLoginData?.consecutiveLoginFails || 0) + 1
      const backoffMs = CONFIG.LOGIN_BACKOFF_BASE_MS * Math.pow(2, Math.min(fails - 1, 5)) // 1m, 2m, 4m, 8m, 16m, 32m max
      const cooldownUntil = new Date(Date.now() + backoffMs)
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: {
          consecutiveLoginFails: fails,
          loginCooldownUntil: cooldownUntil,
          lastError: `Login failed: ${loginResult?.status || 'unknown'}`,
          healthStatus: fails >= 3 ? 'unhealthy' : 'unknown',
        },
      }).catch(() => {})
      console.error(`[ALERT] Profile "${profile.label}" login failed #${fails}. Cooldown: ${(backoffMs / 60_000).toFixed(0)} min`)
      return false
    }

    // POST-LOGIN COOLDOWN: Wait 30s after fresh login before opening adsmanager.
    // Prevents Facebook from flagging rapid post-login navigation as bot behavior.
    if (loginResult?.status !== 'already_logged_in') {
      workerStats.loggedOutExecutions++ // Track: fresh login was needed
      console.log(`[AdsPower CDP] Post-login cooldown: waiting ${CONFIG.POST_LOGIN_COOLDOWN_MS / 1000}s before opening adsmanager...`)
      await sleep(CONFIG.POST_LOGIN_COOLDOWN_MS)

      // Update login success tracking — reset failure counters
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { lastLoginAt: new Date(), consecutiveLoginFails: 0, loginCooldownUntil: null },
      }).catch(() => {})
    } else {
      console.log(`[AdsPower CDP] Already logged in — skipping cooldown`)
    }

    // NOTE: Session warm-up (scrolling FB feed) intentionally skipped for recharges.
    // The post-login cooldown above provides sufficient session stabilization.

    // Step 4: Capture token
    // Key insight: FB sends access_token in FormData POST bodies, which CDP Network.requestWillBeSent
    // doesn't capture (multipart bodies are empty in postData). So we inject JS-level interceptors
    // (same approach as the extension) and read captured tokens via CDP.
    console.log(`[AdsPower CDP] Step 4: Token capture starting...`)

    let capturedToken: string | null = null

    // Get current tabs
    const allTabs = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
    const pageTabs = allTabs.filter((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)
    console.log(`[AdsPower CDP] Found ${pageTabs.length} page tabs: ${pageTabs.map((t: any) => t.url?.substring(0, 80)).join(' | ')}`)

    // Phase 0: Dismiss any lingering remember_browser / checkpoint pages
    for (const tab of pageTabs) {
      const tUrl = tab.url || ''
      if (/two_factor|remember_browser|checkpoint|save_device/.test(tUrl) && tab.webSocketDebuggerUrl) {
        console.log(`[AdsPower CDP] Dismissing lingering page: ${tUrl.substring(0, 80)}`)
        await cdpEvaluate(tab.webSocketDebuggerUrl, `
          (function() {
            var btns = document.querySelectorAll('button[type="submit"], div[role="button"], a[role="button"], button');
            for (var i = 0; i < btns.length; i++) {
              var t = (btns[i].textContent || '').trim().toLowerCase();
              if (/continue|ok|yes|save|trust|skip|not now|done/i.test(t) && btns[i].offsetWidth > 30) {
                btns[i].click();
                return 'clicked: ' + t.substring(0, 20);
              }
            }
            var sub = document.querySelector('button[type="submit"]');
            if (sub && sub.offsetWidth > 30) { sub.click(); return 'clicked_submit'; }
            return 'no_button';
          })()
        `).then((r: any) => console.log(`[AdsPower CDP] Dismiss result: ${r}`)).catch(() => {})
        await sleep(3000)
      }
    }

    // Find usable tab (prefer FB page, skip 2FA/checkpoint pages)
    const refreshedAllTabs = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
    const refreshedPageTabs = refreshedAllTabs.filter((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)
    let fbTab = refreshedPageTabs.find((t: any) =>
      t.url?.includes('www.facebook.com') &&
      !t.url?.includes('two_factor') && !t.url?.includes('checkpoint') && !t.url?.includes('remember_browser')
    )
    if (!fbTab) fbTab = refreshedPageTabs[0]

    if (fbTab?.webSocketDebuggerUrl) {
      // Phase 1: Navigate to FB home for session warmup
      const tabUrl = fbTab.url || ''
      const isOnFbHome = tabUrl.includes('www.facebook.com') &&
        !tabUrl.includes('two_factor') && !tabUrl.includes('checkpoint') && !tabUrl.includes('remember_browser')

      if (!isOnFbHome) {
        console.log(`[AdsPower CDP] Tab on ${tabUrl.substring(0, 60)} — navigating to FB home for warmup...`)
        await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.location.href = 'https://www.facebook.com/home.php'`)
        await sleep(8000)
        const rTabs = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
        const rFb = rTabs.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl && t.url?.includes('www.facebook.com'))
        if (rFb) fbTab = rFb
      }

      // Quick check: maybe __accessToken already exists on home.php
      const quickToken = await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.__accessToken || null`)
      if (quickToken && typeof quickToken === 'string' && quickToken.startsWith('EAA') && quickToken.length >= 100) {
        capturedToken = quickToken
        console.log(`[AdsPower CDP] __accessToken found on home.php immediately! (len=${quickToken.length})`)
      }

      // Phase 2 (OAuth) REMOVED — navigating to /dialog/oauth was suspicious and unnecessary.
      // Cookie-based recharge handles recharges. Extension captures tokens from Ads Manager.

      // Phase 3: Intercept FormData.prototype.append BEFORE page loads + CDP network fallback
      // Key: Page.addScriptToEvaluateOnNewDocument injects interceptor before ANY page JS runs
      // This catches access_token from multipart/form-data bodies (which CDP Network can't read)
      if (!capturedToken) {
        console.log(`[AdsPower CDP] Phase 3: FormData interception on Ads Manager...`)
        capturedToken = await cdpInterceptToken(
          fbTab.webSocketDebuggerUrl,
          60000, // 60s timeout — adsmanager can be slow
          'https://adsmanager.facebook.com/adsmanager/manage/accounts'
        )
        if (capturedToken) {
          console.log(`[AdsPower CDP] Token captured from Ads Manager FormData interception!`)
        }

        // Deep scan: check __accessToken + search ALL page HTML for EAA tokens
        if (!capturedToken) {
          console.log(`[AdsPower CDP] Deep scanning page for EAA tokens...`)
          const scanResult = await cdpEvaluate(fbTab.webSocketDebuggerUrl, `
            (function() {
              var results = { accessToken: null, htmlTokens: [], url: window.location.href.substring(0, 80) };

              // 1. window.__accessToken
              if (window.__accessToken && typeof window.__accessToken === 'string' && window.__accessToken.indexOf('EAA') === 0) {
                results.accessToken = { token: window.__accessToken, len: window.__accessToken.length };
              }

              // 2. Scan all script tags for EAA patterns
              var scripts = document.querySelectorAll('script');
              var seen = {};
              for (var i = 0; i < scripts.length; i++) {
                var text = scripts[i].textContent || '';
                if (text.length > 10000000) continue; // Skip huge scripts
                var re = /EAA[a-zA-Z0-9._-]{30,500}/g;
                var m;
                while ((m = re.exec(text)) !== null) {
                  var tok = m[0];
                  if (!seen[tok]) {
                    seen[tok] = true;
                    results.htmlTokens.push({ token: tok.substring(0, 30) + '...', len: tok.length, full: tok });
                  }
                }
              }

              // 3. Try Facebook's internal require system for CurrentAccessToken
              try {
                if (typeof require === 'function') {
                  var mod = require('CurrentAccessToken');
                  if (mod && mod.getToken) {
                    var reqToken = mod.getToken();
                    if (reqToken && typeof reqToken === 'string' && reqToken.indexOf('EAA') === 0 && reqToken.length > 40 && !seen[reqToken]) {
                      seen[reqToken] = true;
                      results.htmlTokens.push({ token: reqToken.substring(0, 30) + '...', len: reqToken.length, full: reqToken });
                      results.requireToken = true;
                    }
                  }
                }
              } catch(e) {}

              // 4. Scan <script type="application/json"> tags (data-sjs payloads)
              try {
                var jsonScripts = document.querySelectorAll('script[type="application/json"]');
                for (var j = 0; j < jsonScripts.length; j++) {
                  var json = jsonScripts[j].textContent || '';
                  if (json.length > 5000000) continue;
                  var m3 = json.match(/"accessToken"\\s*:\\s*"(EAA[a-zA-Z0-9._-]{30,500})"/);
                  if (m3 && !seen[m3[1]]) { seen[m3[1]] = true; results.htmlTokens.push({ token: m3[1].substring(0, 30) + '...', len: m3[1].length, full: m3[1] }); }
                  var m4 = json.match(/"access_token"\\s*:\\s*"(EAA[a-zA-Z0-9._-]{30,500})"/);
                  if (m4 && !seen[m4[1]]) { seen[m4[1]] = true; results.htmlTokens.push({ token: m4[1].substring(0, 30) + '...', len: m4[1].length, full: m4[1] }); }
                  var m5 = json.match(/set\\(\\["(EAA[a-zA-Z0-9._-]{30,500})"\\]\\)/);
                  if (m5 && !seen[m5[1]]) { seen[m5[1]] = true; results.htmlTokens.push({ token: m5[1].substring(0, 30) + '...', len: m5[1].length, full: m5[1] }); }
                }
              } catch(e) {}

              // 5. Check __comet_data_store (React/Comet data)
              try {
                if (window.__comet_data_store) {
                  var storeStr = JSON.stringify(window.__comet_data_store).substring(0, 2000000);
                  var storeMatch = storeStr.match(/"accessToken"\\s*:\\s*"(EAA[a-zA-Z0-9._-]{30,500})"/);
                  if (storeMatch && !seen[storeMatch[1]]) { seen[storeMatch[1]] = true; results.htmlTokens.push({ token: storeMatch[1].substring(0, 30) + '...', len: storeMatch[1].length, full: storeMatch[1] }); }
                }
              } catch(e) {}

              // 6. Check common FB internal data stores
              try { if (window.__ar_ephemeral_data) results.arData = true; } catch(e) {}
              try {
                var dtsg = document.querySelector('input[name="fb_dtsg"]');
                if (dtsg) results.dtsg = dtsg.value ? dtsg.value.substring(0, 20) : 'empty';
              } catch(e) {}

              return JSON.stringify(results);
            })()
          `)
          try {
            const scan = JSON.parse(scanResult || '{}')
            console.log(`[AdsPower CDP] Deep scan on ${scan.url}: __accessToken=${scan.accessToken ? 'len=' + scan.accessToken.len : 'null'}, htmlTokens=${scan.htmlTokens?.length || 0}, dtsg=${scan.dtsg || 'none'}`)

            // Try the __accessToken first
            if (scan.accessToken?.token && scan.accessToken.len >= 100) {
              capturedToken = scan.accessToken.token
              console.log(`[AdsPower CDP] Using __accessToken (len=${scan.accessToken.len})`)
            }

            // Try HTML tokens (sorted by length descending — user tokens are longer)
            if (!capturedToken && scan.htmlTokens?.length > 0) {
              scan.htmlTokens.sort((a: any, b: any) => (b.len || 0) - (a.len || 0))
              for (const ht of scan.htmlTokens) {
                if (capturedToken) break
                if (ht.len < 100) continue
                console.log(`[AdsPower CDP] Testing HTML token (len=${ht.len})...`)
                const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(ht.full)}`).then(r => r.json()).catch(() => null)
                if (meRes?.id) {
                  capturedToken = ht.full
                  console.log(`[AdsPower CDP] HTML token VALID! User: ${meRes.name} (${meRes.id})`)
                } else {
                  console.log(`[AdsPower CDP] HTML token invalid: ${meRes?.error?.message?.substring(0, 60) || 'no id'}`)
                }
              }
            }
          } catch (e: any) {
            console.log(`[AdsPower CDP] Deep scan parse error: ${e.message}`)
          }
        }
      }

      // Phase 3b: Try business.facebook.com as alternative interception target
      if (!capturedToken) {
        console.log(`[AdsPower CDP] Phase 3b: Trying business.facebook.com...`)
        capturedToken = await cdpInterceptToken(
          fbTab.webSocketDebuggerUrl,
          30000, // 30s shorter timeout
          'https://business.facebook.com/latest/home'
        )
        if (capturedToken) {
          console.log(`[AdsPower CDP] Token captured from business.facebook.com!`)
        } else {
          // Refresh tab reference after navigation
          const rTabsBiz = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
          const rFbBiz = rTabsBiz.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl && t.url?.includes('facebook.com'))
          if (rFbBiz) fbTab = rFbBiz
        }
      }

      // Phase 4: Navigate back to FB home and try __accessToken there
      if (!capturedToken) {
        console.log(`[AdsPower CDP] Phase 4: Going back to FB home to read __accessToken...`)
        await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.location.href = 'https://www.facebook.com/home.php'`)
        await sleep(10000)

        const rTabs3 = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
        const rFb3 = rTabs3.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl && t.url?.includes('www.facebook.com'))
        if (rFb3) fbTab = rFb3

        for (let attempt = 1; attempt <= 5; attempt++) {
          if (attempt > 1) await sleep(3000)
          const result = await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.__accessToken || null`)
          if (result && typeof result === 'string' && result.startsWith('EAA') && result.length >= 100) {
            capturedToken = result
            console.log(`[AdsPower CDP] __accessToken found on home.php! (attempt ${attempt}, len=${result.length})`)
            break
          }
          console.log(`[AdsPower CDP] __accessToken attempt ${attempt}: ${result === null ? 'null' : `${String(result).substring(0, 20)}...`}`)
        }
      }
    } else {
      console.log(`[AdsPower CDP] No usable page tab found!`)
    }

    // Validate and store captured token
    if (capturedToken) {
      const meRes = await fetch(`https://graph.facebook.com/me?access_token=${encodeURIComponent(capturedToken)}`).then(r => r.json()).catch(() => null)
      if (meRes?.id) {
        console.log(`[AdsPower CDP] Token VALIDATED! User: ${meRes.name} (${meRes.id}), len=${capturedToken.length}`)
        await prisma.facebookAutomationProfile.update({
          where: { id: profile.id },
          data: {
            fbAccessToken: capturedToken,
            fbTokenCapturedAt: new Date(),
            healthStatus: 'healthy',
            lastError: null,
          },
        }).catch(() => {})
        console.log(`[AdsPower CDP] Token stored in DB!`)
        workerStats.loggedInExecutions++
      } else {
        console.log(`[AdsPower CDP] Token failed /me validation:`, meRes?.error?.message || 'unknown')
        capturedToken = null
      }
    }

    // Phase 5 (NEW): Extract cookies + fb_dtsg for cookie-based recharge fallback
    if (!capturedToken && fbTab?.webSocketDebuggerUrl) {
      console.log(`[AdsPower CDP] Phase 5: Extracting cookies + fb_dtsg for cookie-based fallback...`)
      const session = await cdpExtractSession(fbTab.webSocketDebuggerUrl, debugInfo.debugPort)
      if (session && session.cookies && session.userId) {
        console.log(`[AdsPower CDP] Session extracted: userId=${session.userId}, dtsg=${session.dtsg ? 'yes' : 'no'}, cookies=${session.cookies.length} chars`)
        await prisma.facebookAutomationProfile.update({
          where: { id: profile.id },
          data: {
            fbCookies: session.cookies,
            fbDtsg: session.dtsg || '',
            healthStatus: 'cookie_fallback',
            lastError: 'No EAA token — using cookie-based fallback',
          },
        }).catch((e: any) => console.log(`[AdsPower CDP] Failed to save session: ${e.message}`))
      } else {
        console.log(`[AdsPower CDP] Failed to extract session — cookies or userId missing`)
      }
    }

    if (!capturedToken) {
      // Track failed cycles to prevent infinite loops
      const browser = activeBrowsers.get(profile.id)
      const failedCycles = (browser?.failedCycles || 0) + 1
      if (browser) browser.failedCycles = failedCycles

      if (failedCycles >= 3) {
        // After 3 consecutive failed cycles, clear cookies for fresh login
        console.log(`[AdsPower CDP] Token capture failed ${failedCycles} times — clearing cookies for fresh login...`)
        if (fbTab?.webSocketDebuggerUrl) {
          await cdpClearFBCookies(fbTab.webSocketDebuggerUrl, debugInfo.debugPort)
        }
        if (browser) browser.failedCycles = 0 // Reset after clearing
        await prisma.facebookAutomationProfile.update({
          where: { id: profile.id },
          data: { healthStatus: 'needs_login', lastError: `Token capture failed ${failedCycles}x — cookies cleared, will re-login next cycle` },
        }).catch(() => {})
      } else {
        console.log(`[AdsPower CDP] Token capture failed (cycle ${failedCycles}/3) — will retry next cycle`)
        await prisma.facebookAutomationProfile.update({
          where: { id: profile.id },
          data: { lastError: `Token capture failed (attempt ${failedCycles}/3)` },
        }).catch(() => {})
      }
    }

    return true
  } catch (err: any) {
    console.error(`[AdsPower CDP] Error:`, err.message)
    return false
  }
}

/**
 * Clear FB session cookies via CDP so the next cycle triggers a fresh login.
 * Uses both CDP Storage.clearCookies and Network.deleteCookies for thorough cleanup.
 */
async function cdpClearFBCookies(tabWsUrl: string, debugPort: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(tabWsUrl)
      let msgId = 1
      const fbCookies = ['c_user', 'xs', 'fr', 'datr', 'sb', 'wd', 'spin', 'locale']

      ws.on('open', () => {
        // Delete key FB session cookies for both domains
        for (const name of fbCookies) {
          ws.send(JSON.stringify({
            id: msgId++,
            method: 'Network.deleteCookies',
            params: { name, domain: '.facebook.com', path: '/' }
          }))
        }
        console.log(`[AdsPower CDP] Cleared ${fbCookies.length} FB session cookies`)
        setTimeout(() => { try { ws.close() } catch {} resolve() }, 2000)
      })

      ws.on('error', () => resolve())
      setTimeout(() => { try { ws.close() } catch {} resolve() }, 5000)
    } catch {
      resolve()
    }
  })
}

/**
 * Intercept network requests via CDP to capture EAA access tokens.
 * Sets up Network listener FIRST, then navigates to the target URL.
 * Validates each token via /me — returns first VALID user token, or null on timeout.
 *
 * @param tabWsUrl - WebSocket debugger URL for the tab
 * @param timeoutMs - Max time to wait for a valid token
 * @param navigateUrl - URL to navigate to (triggers API calls with tokens)
 */
async function cdpInterceptToken(tabWsUrl: string, timeoutMs: number = 60000, navigateUrl?: string): Promise<string | null> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null
    let resolved = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    let msgId = 1
    const seenTokens = new Set<string>()
    let requestCount = 0
    let formDataTokenCount = 0
    let runtimeEventCount = 0

    function cleanup() {
      if (timeout) { clearTimeout(timeout); timeout = null }
      if (ws) {
        try { ws.removeAllListeners(); ws.close() } catch {}
        ws = null
      }
    }

    function done(token: string | null) {
      if (resolved) return
      resolved = true
      console.log(`[AdsPower CDP] Interception done: ${token ? 'TOKEN FOUND' : 'no token'} (${requestCount} network reqs, ${formDataTokenCount} FormData tokens, ${seenTokens.size} validated)`)
      cleanup()
      resolve(token)
    }

    async function validateAndResolve(token: string, source: string) {
      if (resolved || seenTokens.has(token)) return
      seenTokens.add(token)

      // Skip very short tokens (app tokens tend to be shorter)
      if (token.length < 100) {
        console.log(`[AdsPower CDP] Skipping short token from ${source} (len=${token.length})`)
        return
      }

      console.log(`[AdsPower CDP] Validating token from ${source} (len=${token.length}, ${token.substring(0, 20)}...)`)

      try {
        const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`).then(r => r.json()).catch(() => null)
        if (meRes?.id) {
          console.log(`[AdsPower CDP] Token VALID! User: ${meRes.name} (${meRes.id}) — captured via ${source}`)
          done(token)
        } else {
          console.log(`[AdsPower CDP] Token invalid (${source}): ${meRes?.error?.message?.substring(0, 60) || 'no id'}`)
        }
      } catch (e: any) {
        console.log(`[AdsPower CDP] Token validation error: ${e.message}`)
      }
    }

    // Comprehensive JS interceptor injected BEFORE page scripts via Page.addScriptToEvaluateOnNewDocument
    // Catches access_token from ALL possible body construction methods:
    // 1. FormData.append/set('access_token', ...)
    // 2. URLSearchParams.append/set('access_token', ...)
    // 3. URLSearchParams constructor with {access_token: ...}
    // 4. fetch/XHR with string body containing access_token=EAA
    // 5. fetch/XHR with FormData/URLSearchParams body (.get('access_token'))
    const formDataInterceptorScript = `
(function() {
  var _6adCaptured = {};
  var _6adCount = 0;

  // Store tokens in window for later retrieval via Runtime.evaluate
  window.__6adTokens = window.__6adTokens || [];

  function capture(token, src) {
    if (!token || typeof token !== 'string') return;
    if (token.indexOf('EAA') !== 0 || token.length <= 40) return;
    if (_6adCaptured[token]) return;
    _6adCaptured[token] = true;
    _6adCount++;
    window.__6adTokens.push({ token: token, source: src, len: token.length });
    console.log('[6AD_TOKEN]' + token);
    console.log('[6AD_SRC]' + src + ' len=' + token.length);
  }

  function checkBody(body, src) {
    if (!body) return;
    // String body: access_token=EAA...
    if (typeof body === 'string') {
      var m = body.match(/access_token=(EAA[a-zA-Z0-9._-]+)/);
      if (m) capture(m[1], src + '-string');
      return;
    }
    // FormData or URLSearchParams: .get('access_token')
    if (typeof body === 'object' && typeof body.get === 'function') {
      try {
        var tok = body.get('access_token');
        if (tok) capture(tok, src + '-get');
      } catch(e) {}
    }
  }

  // === Hook FormData.prototype.append + set ===
  var origFDAppend = FormData.prototype.append;
  FormData.prototype.append = function(key, value) {
    try { if (key === 'access_token') capture(value, 'fd-append'); } catch(e) {}
    return origFDAppend.apply(this, arguments);
  };
  if (FormData.prototype.set) {
    var origFDSet = FormData.prototype.set;
    FormData.prototype.set = function(key, value) {
      try { if (key === 'access_token') capture(value, 'fd-set'); } catch(e) {}
      return origFDSet.apply(this, arguments);
    };
  }

  // === Hook URLSearchParams.prototype.append + set ===
  var origUSPAppend = URLSearchParams.prototype.append;
  URLSearchParams.prototype.append = function(key, value) {
    try { if (key === 'access_token') capture(value, 'usp-append'); } catch(e) {}
    return origUSPAppend.apply(this, arguments);
  };
  if (URLSearchParams.prototype.set) {
    var origUSPSet = URLSearchParams.prototype.set;
    URLSearchParams.prototype.set = function(key, value) {
      try { if (key === 'access_token') capture(value, 'usp-set'); } catch(e) {}
      return origUSPSet.apply(this, arguments);
    };
  }

  // === Hook URLSearchParams constructor to catch new URLSearchParams({access_token: 'EAA...'}) ===
  var OrigUSP = URLSearchParams;
  window.URLSearchParams = function(init) {
    var instance = new OrigUSP(init);
    try {
      var tok = instance.get('access_token');
      if (tok) capture(tok, 'usp-ctor');
    } catch(e) {}
    return instance;
  };
  window.URLSearchParams.prototype = OrigUSP.prototype;
  window.URLSearchParams.toString = function() { return OrigUSP.toString(); };

  // === Helper: scan text for tokens in JSON response format ===
  function scanText(text, src) {
    if (!text || typeof text !== 'string' || text.length > 500000) return;
    var m1 = text.match(/"access_token"\\s*:\\s*"(EAA[a-zA-Z0-9._-]{30,500})"/);
    if (m1) capture(m1[1], src + '-at');
    var m2 = text.match(/"accessToken"\\s*:\\s*"(EAA[a-zA-Z0-9._-]{30,500})"/);
    if (m2) capture(m2[1], src + '-AT');
    var m3 = text.match(/set\\(\\["(EAA[a-zA-Z0-9._-]{30,500})"\\]\\)/);
    if (m3) capture(m3[1], src + '-set');
  }

  // === Hook fetch — check request body + scan response body ===
  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      if (init && init.body) checkBody(init.body, 'fetch');
    } catch(e) {}
    return origFetch.apply(this, arguments).then(function(resp) {
      try {
        if (resp.ok) {
          resp.clone().text().then(function(text) { scanText(text, 'f-resp'); }).catch(function(){});
        }
      } catch(e) {}
      return resp;
    });
  };

  // === Hook XMLHttpRequest.send — check request body + scan response body ===
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(body) {
    try { if (body) checkBody(body, 'xhr'); } catch(e) {}
    try {
      this.addEventListener('load', function() {
        try { if (this.responseText) scanText(this.responseText, 'x-resp'); } catch(e) {}
      });
    } catch(e) {}
    return origSend.apply(this, arguments);
  };

  // Diagnostic: confirm interceptor is running
  console.log('[6AD_INTERCEPTOR] installed on ' + window.location.hostname + ' (v1.3.0 — response scanning)');
})();
`

    try {
      console.log(`[AdsPower CDP] Connecting WebSocket to tab: ${tabWsUrl.substring(0, 80)}...`)
      ws = new WebSocket(tabWsUrl)

      timeout = setTimeout(async () => {
        console.log(`[AdsPower CDP] Interception timed out after ${timeoutMs / 1000}s (${requestCount} network reqs, ${formDataTokenCount} interceptor tokens, ${runtimeEventCount} console events, ${seenTokens.size} validated)`)

        // FALLBACK: Try Runtime.evaluate to read tokens stored in window.__6adTokens
        // This works even if Runtime.consoleAPICalled events weren't delivered
        if (!resolved && ws && ws.readyState === WebSocket.OPEN) {
          try {
            const evalId = msgId++
            ws.send(JSON.stringify({
              id: evalId,
              method: 'Runtime.evaluate',
              params: { expression: 'JSON.stringify(window.__6adTokens || [])', returnByValue: true }
            }))

            // Wait briefly for the evaluate response
            await new Promise<void>((evalResolve) => {
              const evalTimeout = setTimeout(() => evalResolve(), 5000)
              const origHandler = ws!.listeners('message')

              function evalHandler(data: Buffer) {
                try {
                  const msg = JSON.parse(data.toString())
                  if (msg.id === evalId && msg.result?.result?.value) {
                    clearTimeout(evalTimeout)
                    const tokensJson = msg.result.result.value
                    const tokens = JSON.parse(typeof tokensJson === 'string' ? tokensJson : JSON.stringify(tokensJson))
                    if (Array.isArray(tokens) && tokens.length > 0) {
                      console.log(`[AdsPower CDP] FALLBACK: Runtime.evaluate found ${tokens.length} tokens in window.__6adTokens!`)
                      // Sort by length descending — longer tokens are more likely user tokens
                      tokens.sort((a: any, b: any) => (b.len || 0) - (a.len || 0))
                      for (const t of tokens) {
                        if (!resolved && t.token && t.token.startsWith('EAA') && t.token.length > 40) {
                          formDataTokenCount++
                          validateAndResolve(t.token, `fallback-${t.source}`)
                        }
                      }
                    } else {
                      console.log(`[AdsPower CDP] FALLBACK: window.__6adTokens is empty — interceptor may not have run`)
                    }
                    ws?.removeListener('message', evalHandler)
                    // Give validation time to complete
                    setTimeout(() => evalResolve(), 3000)
                    return
                  }
                } catch {}
              }

              ws!.on('message', evalHandler)
            })
          } catch (e: any) {
            console.log(`[AdsPower CDP] FALLBACK Runtime.evaluate failed: ${e.message}`)
          }
        }

        if (!resolved) done(null)
      }, timeoutMs)

      ws.on('open', () => {
        console.log(`[AdsPower CDP] WebSocket connected! Setting up interceptors...`)

        // 1. Enable Page domain (required for addScriptToEvaluateOnNewDocument)
        ws?.send(JSON.stringify({ id: msgId++, method: 'Page.enable', params: {} }))

        // 2. Enable Runtime domain to receive console events (for FormData token capture)
        ws?.send(JSON.stringify({ id: msgId++, method: 'Runtime.enable', params: {} }))

        // 3. Enable Network domain (fallback for URL params / headers)
        ws?.send(JSON.stringify({ id: msgId++, method: 'Network.enable', params: {} }))

        // 4. Inject comprehensive interceptor BEFORE page scripts run
        ws?.send(JSON.stringify({
          id: msgId++,
          method: 'Page.addScriptToEvaluateOnNewDocument',
          params: { source: formDataInterceptorScript }
        }))
        console.log(`[AdsPower CDP] Interceptor injected via addScriptToEvaluateOnNewDocument`)

        // 5. Small delay to ensure all domains are enabled, then navigate
        setTimeout(() => {
          if (resolved) return
          if (navigateUrl) {
            console.log(`[AdsPower CDP] Navigating to: ${navigateUrl}`)
            ws?.send(JSON.stringify({ id: msgId++, method: 'Page.navigate', params: { url: navigateUrl } }))
          } else {
            console.log(`[AdsPower CDP] Reloading page to trigger API calls...`)
            ws?.send(JSON.stringify({ id: msgId++, method: 'Page.reload', params: {} }))
          }
        }, 500)
      })

      ws.on('message', (data: Buffer) => {
        if (resolved) return
        try {
          const msg = JSON.parse(data.toString())

          // === PRIMARY: Token from JS interceptor via console.log ===
          if (msg.method === 'Runtime.consoleAPICalled') {
            runtimeEventCount++
            const args = msg.params?.args || []
            for (const arg of args) {
              if (arg.type !== 'string' || typeof arg.value !== 'string') continue
              const val = arg.value

              if (val.startsWith('[6AD_TOKEN]')) {
                const token = val.substring(11) // '[6AD_TOKEN]'.length = 11
                if (token.startsWith('EAA') && token.length > 40) {
                  formDataTokenCount++
                  console.log(`[AdsPower CDP] JS interceptor token captured! (len=${token.length})`)
                  validateAndResolve(token, 'js-interceptor')
                }
              } else if (val.startsWith('[6AD_SRC]')) {
                console.log(`[AdsPower CDP] Token source: ${val.substring(9)}`)
              } else if (val.startsWith('[6AD_INTERCEPTOR]')) {
                console.log(`[AdsPower CDP] ${val}`)
              }
            }
          }

          // === FALLBACK: Token from network request URL/headers/postData ===
          if (msg.method === 'Network.requestWillBeSent') {
            requestCount++
            const url = msg.params?.request?.url || ''
            const postData = msg.params?.request?.postData || ''
            const headers = msg.params?.request?.headers || {}

            // Check Authorization header (rare but possible)
            const authHeader = headers['Authorization'] || headers['authorization'] || ''
            const bearerMatch = authHeader.match(/Bearer\s+(EAA[a-zA-Z0-9._-]+)/)
            if (bearerMatch && bearerMatch[1].length >= 40 && bearerMatch[1].length < 500) {
              validateAndResolve(bearerMatch[1], 'network-bearer')
            }

            // Check URL params
            const urlMatch = url.match(/access_token=(EAA[a-zA-Z0-9._-]+)/)
            if (urlMatch && urlMatch[1].length >= 40 && urlMatch[1].length < 500) {
              validateAndResolve(urlMatch[1], 'network-url')
            }

            // Check POST body (works for x-www-form-urlencoded, not multipart)
            if (postData) {
              const bodyMatch = postData.match(/access_token=(EAA[a-zA-Z0-9._-]+)/)
              if (bodyMatch && bodyMatch[1].length >= 40 && bodyMatch[1].length < 500) {
                validateAndResolve(bodyMatch[1], 'network-postdata')
              }
            }
          }
        } catch {}
      })

      ws.on('error', (err: any) => {
        console.log(`[AdsPower CDP] Interception WS error:`, err.message)
        done(null)
      })

      ws.on('close', () => {
        console.log(`[AdsPower CDP] Interception WS closed unexpectedly`)
        if (!resolved) done(null)
      })
    } catch (err: any) {
      console.log(`[AdsPower CDP] Interception setup failed:`, err.message)
      done(null)
    }
  })
}

// cdpOAuthTokenCapture, extractTokenFromUrl, validateToken REMOVED (v1.4.2)
// OAuth dialog navigation was unnecessary and suspicious.
// Cookie-based recharge handles recharges server-side.
// Extension captures tokens from window.__accessToken on Ads Manager.

/**
 * Force token capture without full cdpAutoLogin flow.
 * Finds an existing FB tab (or uses any tab), navigates to Ads Manager,
 * and uses cdpInterceptToken() to capture a valid user token.
 *
 * This is a lightweight alternative to cdpAutoLogin() — no login form filling,
 * just navigation + JS interceptor to capture tokens from network traffic.
 *
 * @returns The captured token, or null if capture failed
 */
async function cdpForceTokenCapture(serialNumber: string, profile: any): Promise<string | null> {
  let debugInfo = browserDebugInfo.get(serialNumber)

  // If no debug info, try refreshing from AdsPower API
  if (!debugInfo) {
    console.log(`[AdsPower CDP Force] No debug info for serial=${serialNumber}, trying to fetch...`)
    try {
      const resp = await fetch(`http://127.0.0.1:50325/api/v1/browser/active?serial_number=${serialNumber}`)
      const data = await resp.json()
      if (data.data?.ws?.puppeteer) {
        const wsUrl = data.data.ws.puppeteer
        const portMatch = wsUrl.match(/:(\d+)\//)
        const debugPort = portMatch ? parseInt(portMatch[1]) : null
        if (debugPort) {
          debugInfo = { debugPort, wsUrl }
          browserDebugInfo.set(serialNumber, debugInfo)
        }
      }
    } catch (e: any) {
      console.log(`[AdsPower CDP Force] Failed to get debug info: ${e.message}`)
    }
  }

  if (!debugInfo) {
    console.log(`[AdsPower CDP Force] No debug info available for serial=${serialNumber}`)
    return null
  }

  try {
    // Find an existing FB tab
    const tabsResp = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`)
    const tabs: any[] = await tabsResp.json()

    // Prefer an existing Facebook tab
    let targetTab = tabs.find((t: any) =>
      t.url && (t.url.includes('facebook.com') || t.url.includes('adsmanager.facebook.com'))
    )

    // If no FB tab, use the first available tab
    if (!targetTab) {
      targetTab = tabs.find((t: any) => t.webSocketDebuggerUrl && t.type === 'page')
    }

    if (!targetTab?.webSocketDebuggerUrl) {
      console.log(`[AdsPower CDP Force] No suitable tab found for token capture`)
      return null
    }

    console.log(`[AdsPower CDP Force] Using tab: ${targetTab.url?.substring(0, 60)}...`)
    const adsManagerUrl = 'https://adsmanager.facebook.com/adsmanager/manage/campaigns'

    // Use existing cdpInterceptToken with 45s timeout
    const token = await cdpInterceptToken(targetTab.webSocketDebuggerUrl, 45000, adsManagerUrl)

    if (token) {
      console.log(`[AdsPower CDP Force] Token captured! (len=${token.length}) — saving to DB...`)
      // Save to database
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: {
          fbAccessToken: token,
          fbTokenCapturedAt: new Date(),
          fbTokenValidatedAt: new Date(),
          healthStatus: 'healthy',
        },
      })
      return token
    }

    console.log(`[AdsPower CDP Force] No token captured within timeout`)
    return null
  } catch (err: any) {
    console.error(`[AdsPower CDP Force] Error:`, err.message)
    return null
  }
}

/**
 * Extract Facebook session cookies + fb_dtsg from browser via CDP.
 * Used as fallback for cookie-based recharge when no EAA token available.
 */
async function cdpExtractSession(tabWsUrl: string, debugPort: number): Promise<{ cookies: string; dtsg: string; userId: string } | null> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null
    let resolved = false
    let msgId = 1
    let cookies = ''
    let dtsg = ''
    let userId = ''

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; try { ws?.close() } catch {} resolve(null) }
    }, 15000)

    try {
      ws = new WebSocket(tabWsUrl)

      ws.on('open', () => {
        // Request cookies
        ws?.send(JSON.stringify({ id: msgId++, method: 'Network.getCookies', params: { urls: ['https://www.facebook.com', 'https://adsmanager.facebook.com', 'https://business.facebook.com'] } }))
        // Request fb_dtsg from page
        ws?.send(JSON.stringify({ id: msgId++, method: 'Runtime.evaluate', params: {
          expression: `(function() { var d = document.querySelector('input[name="fb_dtsg"]'); return d ? d.value : (typeof require === 'function' ? (function() { try { return require('DTSGInitialData').token; } catch(e) { return null; } })() : null); })()`,
          returnByValue: true
        }}))
      })

      ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString())

          // Handle getCookies response
          if (msg.id === 1 && msg.result?.cookies) {
            const fbCookies = msg.result.cookies as any[]
            const important = ['c_user', 'xs', 'datr', 'fr', 'sb']
            const parts: string[] = []
            for (const c of fbCookies) {
              if (important.includes(c.name)) {
                parts.push(`${c.name}=${c.value}`)
                if (c.name === 'c_user') userId = c.value
              }
            }
            cookies = parts.join('; ')
            console.log(`[AdsPower CDP] Session: extracted ${parts.length} cookies, userId=${userId || 'none'}`)
          }

          // Handle fb_dtsg response
          if (msg.id === 2 && msg.result?.result?.value) {
            dtsg = String(msg.result.result.value)
            console.log(`[AdsPower CDP] Session: fb_dtsg=${dtsg.substring(0, 20)}...`)
          }

          // If we have both, resolve
          if (cookies && userId) {
            clearTimeout(timeout)
            if (!resolved) {
              resolved = true
              try { ws?.close() } catch {}
              resolve({ cookies, dtsg, userId })
            }
          }
        } catch {}
      })

      ws.on('error', () => {
        if (!resolved) { resolved = true; clearTimeout(timeout); resolve(null) }
      })
    } catch {
      clearTimeout(timeout)
      resolve(null)
    }
  })
}

/**
 * Cookie-based recharge: call Facebook's internal API using session cookies.
 * Bypasses EAA access tokens entirely — uses the same auth as the Ads Manager page.
 */
async function cookieBasedRecharge(
  depositId: string,
  adAccountId: string,
  amount: number,
  cookies: string,
  dtsg: string
): Promise<{ success: boolean; error?: string; details?: string; previousSpendCap?: number; newSpendCap?: number }> {
  // Cookie-based recharge is unreliable — Facebook internal GraphQL requires real doc_ids.
  // This function should ONLY return success if it can VERIFY the spend cap changed.
  console.log(`[Cookie Recharge] Cookie-based recharge is not reliable — skipping for act_${adAccountId}. Use token-based or extension recharge instead.`)
  return { success: false, error: 'Cookie-based recharge disabled — requires valid EAA token or Chrome extension' }
}

/**
 * Execute JavaScript via Chrome DevTools Protocol WebSocket
 */
async function cdpEvaluate(wsUrl: string, expression: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null
    let resolved = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    function cleanup() {
      if (timeout) { clearTimeout(timeout); timeout = null }
      if (ws) {
        try { ws.removeAllListeners(); ws.close() } catch {}
        ws = null
      }
    }

    try {
      ws = new WebSocket(wsUrl)
      const id = 1

      timeout = setTimeout(() => {
        if (!resolved) { resolved = true; cleanup(); resolve(null) }
      }, 15000)

      ws.on('open', () => {
        ws?.send(JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true }
        }))
      })

      ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.id === id) {
            resolved = true
            const value = msg.result?.result?.value || null
            cleanup()
            resolve(value)
          }
        } catch {}
      })

      ws.on('error', (err: any) => {
        if (!resolved) { resolved = true; cleanup(); resolve(null) }
      })

      ws.on('close', () => {
        if (!resolved) { resolved = true; cleanup(); resolve(null) }
      })
    } catch (err: any) {
      cleanup()
      resolve(null)
    }
  })
}

/**
 * Open a new tab via CDP Target.createTarget using the browser-level WebSocket.
 * This is more reliable than window.open() since it doesn't depend on page context.
 */
async function cdpCreateTab(browserWsUrl: string, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(browserWsUrl)
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) { resolved = true; ws.close(); resolve(false) }
      }, 15000)

      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 99,
          method: 'Target.createTarget',
          params: { url }
        }))
      })

      ws.on('message', (data: any) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.id === 99) {
            resolved = true
            clearTimeout(timeout)
            ws.close()
            console.log(`[AdsPower CDP] Target.createTarget result:`, JSON.stringify(msg.result || msg.error))
            resolve(!msg.error)
          }
        } catch {}
      })

      ws.on('error', (err: any) => {
        console.error(`[AdsPower CDP] createTab WS error:`, err.message)
        if (!resolved) { resolved = true; clearTimeout(timeout); resolve(false) }
      })
    } catch (err: any) {
      console.error(`[AdsPower CDP] createTab error:`, err.message)
      resolve(false)
    }
  })
}

/**
 * Close all extra tabs — keep max 1-2 tabs per browser.
 * Prevents RAM leaks from accumulating tabs over time.
 * Keeps 1 facebook.com tab + optionally 1 adsmanager tab (during task only).
 */
// ─── 2FA TOTP Helpers ───────────────────────────────────────────────

function generateTOTP(base32Secret: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'Facebook',
    label: 'FB',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret.replace(/[\s-]/g, '').toUpperCase())
  })
  return totp.generate()
}

async function cdpHandle2FA(wsUrl: string, profile: any): Promise<{ detected: boolean; handled: boolean; message?: string }> {
  try {
    // Step 1: Detect 2FA page
    const detection = await cdpEvaluate(wsUrl, `
      (function() {
        var url = window.location.href;
        return {
          hasCheckpoint: /checkpoint|two_step_verification|two_factor/.test(url),
          hasCodeInput: !!document.querySelector('input[name="approvals_code"], input[name="code"], input[type="tel"], input[autocomplete="one-time-code"]'),
          url: url.substring(0, 150)
        }
      })()
    `)

    if (!detection?.hasCheckpoint && !detection?.hasCodeInput) {
      return { detected: false, handled: false }
    }

    console.log(`[AdsPower CDP] 2FA page detected: ${detection.url}`)

    // Step 2: Need TOTP secret
    if (!profile.twoFactorSecret) {
      return { detected: true, handled: false, message: 'No twoFactorSecret stored for this profile' }
    }

    // Step 3: Generate TOTP code
    const code = generateTOTP(profile.twoFactorSecret)
    console.log(`[AdsPower CDP] Generated TOTP code for 2FA`)

    // Step 4: Wait for FB React 2FA form to render (critical — FB loads async)
    console.log(`[AdsPower CDP] Waiting 5s for 2FA React form to render...`)
    await sleep(5000)

    // Step 5: Retry loop — find input, enter code, click submit
    let submitted: any = null
    for (let retryInput = 0; retryInput < 6; retryInput++) {
      if (retryInput > 0) {
        console.log(`[AdsPower CDP] 2FA input not ready — waiting 3s (attempt ${retryInput + 1}/6)...`)
        await sleep(3000)
      }
      submitted = await cdpEvaluate(wsUrl, `
      (function() {
        // Broad selector set — FB uses different layouts depending on account/risk
        var selectors = [
          'input[name="approvals_code"]',
          '#approvals_code',
          'input[name="code"]',
          'input[autocomplete="one-time-code"]',
          'input[type="tel"]',
          'input[type="number"]',
          'input[maxlength="6"]',
          'input[maxlength="8"]',
          'input[type="text"]'
        ];

        var input = null;
        // Search main page
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
            // Skip search boxes for broad text selector
            if (selectors[i] === 'input[type="text"]' && (el.name === 'q' || el.role === 'searchbox' || el.getAttribute('aria-label') === 'Search')) continue;
            input = el;
            break;
          }
        }

        // Iframe fallback — some FB 2FA renders inside iframes
        if (!input) {
          var iframes = document.querySelectorAll('iframe');
          for (var f = 0; f < iframes.length; f++) {
            try {
              var doc = iframes[f].contentDocument;
              if (!doc) continue;
              for (var s = 0; s < selectors.length - 1; s++) {
                var el2 = doc.querySelector(selectors[s]);
                if (el2 && el2.offsetWidth > 0) { input = el2; break; }
              }
              if (input) break;
            } catch(e) {} // cross-origin iframes will throw
          }
        }

        if (!input) return { status: 'no_input', inputCount: document.querySelectorAll('input').length, html: document.title };

        // Focus + click input first (React inputs need this)
        input.focus();
        input.click();

        // Fill code using React-compatible setter
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '${code}');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        // Find and click submit button
        var btnSelectors = ['#checkpointSubmitButton', 'button[type="submit"]', 'input[type="submit"]'];
        for (var j = 0; j < btnSelectors.length; j++) {
          var btn = document.querySelector(btnSelectors[j]);
          if (btn && btn.offsetWidth > 0) { btn.click(); return { status: 'submitted', selector: btnSelectors[j] }; }
        }

        // Text match — "Continue", "Submit", "Next", "Verify", Hindi "जारी रखें"
        var buttons = document.querySelectorAll('div[role="button"], span[role="button"], button, a[role="button"]');
        for (var k = 0; k < buttons.length; k++) {
          var txt = (buttons[k].textContent || '').trim();
          if (/^(continue|submit|next|verify|confirm|जारी)/i.test(txt) && buttons[k].offsetWidth > 30) {
            buttons[k].click();
            return { status: 'submitted_text', text: txt.substring(0, 30) };
          }
        }
        return { status: 'no_button', inputFilled: true };
      })()
    `)

      console.log(`[AdsPower CDP] 2FA attempt ${retryInput + 1}: ${submitted?.status} (inputs: ${submitted?.inputCount || '?'})`)

      // Break on successful submit
      if (submitted?.status === 'submitted' || submitted?.status === 'submitted_text') break
      // If input was found but no button, retry a couple more times for button to render
      if (submitted?.status === 'no_button' && retryInput >= 2) break
    } // end retry loop

    if (submitted?.status === 'submitted' || submitted?.status === 'submitted_text') {
      console.log(`[AdsPower CDP] 2FA code entered and submitted (${submitted.status})`)
      await sleep(8000) // Wait for FB to verify the code

      // Handle "Remember browser" or additional checkpoint prompts
      for (let promptCheck = 0; promptCheck < 3; promptCheck++) {
        const pageState = await cdpEvaluate(wsUrl, `
          (function() {
            var url = window.location.href;
            if (/checkpoint|review|remember|save_device/i.test(url)) {
              var btns = document.querySelectorAll('button[type="submit"], div[role="button"], a[role="button"]');
              for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').toLowerCase();
                if (/continue|ok|yes|save|trust|skip/i.test(t) && btns[i].offsetWidth > 30) {
                  btns[i].click();
                  return 'clicked_prompt';
                }
              }
              // Fallback: just click first submit button
              var sub = document.querySelector('button[type="submit"]');
              if (sub) { sub.click(); return 'clicked_prompt'; }
            }
            return 'no_prompt';
          })()
        `)
        if (pageState !== 'clicked_prompt') break
        console.log(`[AdsPower CDP] Handled post-2FA prompt (${promptCheck + 1})`)
        await sleep(3000)
      }

      return { detected: true, handled: true }
    }

    return { detected: true, handled: false, message: `2FA submit failed: ${submitted?.status} (title: ${submitted?.html || 'unknown'})` }
  } catch (err: any) {
    return { detected: true, handled: false, message: err.message }
  }
}

async function cdpCleanupTabs(debugPort: number, keepAdsmanager = false): Promise<void> {
  try {
    const resp = await fetch(`http://127.0.0.1:${debugPort}/json`)
    const tabs: any[] = await resp.json()
    const pageTabs = tabs.filter((t: any) => t.type === 'page')

    if (pageTabs.length <= 1) return // Already clean

    // Find tab to keep: prefer facebook.com (not adsmanager)
    let keepTab = pageTabs.find((t: any) =>
      t.url?.includes('www.facebook.com') && !t.url?.includes('adsmanager')
    )
    const adsTab = keepAdsmanager
      ? pageTabs.find((t: any) => t.url?.includes('adsmanager.facebook.com'))
      : null

    if (!keepTab) keepTab = pageTabs[0] // Fallback: keep first tab

    let closed = 0
    for (const tab of pageTabs) {
      if (tab.id === keepTab.id) continue
      if (adsTab && tab.id === adsTab.id) continue
      try {
        await fetch(`http://127.0.0.1:${debugPort}/json/close/${tab.id}`)
        closed++
      } catch {}
    }
    if (closed > 0) {
      console.log(`[AdsPower CDP] Tab cleanup: closed ${closed} extra tab(s), kept ${keepAdsmanager ? '1-2' : '1'}`)
    }
  } catch {}
}

/**
 * Server-side recharge: use stored FB token to update ad account spend cap.
 * Same logic as the extension but runs from Node.js, bypassing cached extension code.
 */
async function serverSideRecharge(depositId: string, adAccountId: string, amount: number, accessToken: string): Promise<{ success: boolean; error?: string; details?: string; previousSpendCap?: number; newSpendCap?: number }> {
  adAccountId = adAccountId.trim()
  const FB_GRAPH = 'https://graph.facebook.com/v21.0'

  try {
    // Step 1: GET current spend cap
    console.log(`[Server Recharge] GET act_${adAccountId} spend_cap...`)
    const getResp = await fetch(`${FB_GRAPH}/act_${adAccountId}?fields=spend_cap,amount_spent,name&access_token=${encodeURIComponent(accessToken)}`)
    const getText = await getResp.text()
    let accountData: any
    try { accountData = JSON.parse(getText) } catch {
      return { success: false, error: `Invalid FB response: ${getText.substring(0, 200)}` }
    }
    if (accountData.error) {
      return { success: false, error: `FB GET error for act_${adAccountId}: ${accountData.error.message || JSON.stringify(accountData.error)}` }
    }

    const currentCapCents = parseInt(accountData.spend_cap || '0', 10)
    const currentCapDollars = currentCapCents / 100
    const newCapDollars = currentCapDollars + amount

    console.log(`[Server Recharge] act_${adAccountId}: currentCap=$${currentCapDollars} (${currentCapCents} cents), deposit=$${amount}, newCap=$${newCapDollars}`)

    // Step 2: POST new spend cap (Facebook Graph API expects spend_cap in the account currency, NOT cents)
    // The Graph API spend_cap field returns cents but the POST expects dollars for the /act_{id} endpoint
    const postResp = await fetch(`${FB_GRAPH}/act_${adAccountId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        spend_cap: newCapDollars.toString(),
        access_token: accessToken,
      }).toString(),
    })
    const postText = await postResp.text()
    let postData: any
    try { postData = JSON.parse(postText) } catch {
      return { success: false, error: `Invalid POST response: ${postText.substring(0, 200)}` }
    }
    if (postData.error) {
      return { success: false, error: `FB POST error: ${postData.error.message || JSON.stringify(postData.error)}` }
    }

    // Step 3: VERIFY — re-read spend cap to confirm it actually changed
    console.log(`[Server Recharge] Verifying spend cap change for act_${adAccountId}...`)
    try {
      const verifyResp = await fetch(`${FB_GRAPH}/act_${adAccountId}?fields=spend_cap&access_token=${encodeURIComponent(accessToken)}`)
      const verifyText = await verifyResp.text()
      const verifyData = JSON.parse(verifyText)
      if (verifyData.spend_cap) {
        const verifiedCapCents = parseInt(verifyData.spend_cap, 10)
        const verifiedCapDollars = verifiedCapCents / 100
        console.log(`[Server Recharge] Verified spend_cap for act_${adAccountId}: $${verifiedCapDollars} (expected $${newCapDollars})`)
        if (verifiedCapDollars < newCapDollars - 0.01) {
          return { success: false, error: `Spend cap verification failed: expected $${newCapDollars} but got $${verifiedCapDollars}`, previousSpendCap: currentCapDollars, newSpendCap: verifiedCapDollars }
        }
      }
    } catch (verifyErr: any) {
      console.log(`[Server Recharge] Verification read failed (non-fatal): ${verifyErr.message}`)
      // Non-fatal — the POST succeeded, verification read might fail due to rate limiting
    }

    const details = `previousCap=$${currentCapDollars}, newCap=$${newCapDollars}`
    console.log(`[Server Recharge] SUCCESS act_${adAccountId}: ${details}`)
    return { success: true, details, previousSpendCap: currentCapDollars, newSpendCap: newCapDollars }
  } catch (err: any) {
    return { success: false, error: `Server recharge error: ${err.message}` }
  }
}

async function stopBrowser(serialNumber: string): Promise<boolean> {
  console.log(`[AdsPower] Stopping browser serial=${serialNumber}`)
  const res = await adsPowerRequest(`/api/v1/browser/stop?serial_number=${serialNumber}`)
  // Always clean up memory regardless of stop result
  browserDebugInfo.delete(serialNumber)
  if (res.code === 0) { console.log(`[AdsPower] Browser stopped: serial=${serialNumber}`); return true }
  console.error(`[AdsPower] Failed to stop serial=${serialNumber}: ${res.msg}`)
  return false
}

async function isBrowserActive(serialNumber: string): Promise<boolean> {
  const res = await adsPowerRequest(`/api/v1/browser/active?serial_number=${serialNumber}`)
  return res.code === 0 && res.data?.status === 'Active'
}

// ─── Task Detection ────────────────────────────────────────────────

interface PendingTask {
  type: 'bm_share' | 'recharge'
  id: string
  adAccountId: string
}

/**
 * Get all pending tasks (just id + Facebook accountId)
 *
 * BmShareRequest.adAccountId = Facebook account ID string (e.g. "879772328363257")
 * AccountDeposit.adAccountId = MongoDB ObjectID → need adAccount.accountId for Facebook ID
 */
async function getPendingTasks(): Promise<PendingTask[]> {
  const tasks: PendingTask[] = []

  // BM shares: adAccountId is already the Facebook account ID (no relation needed)
  const bmShares = await prisma.bmShareRequest.findMany({
    where: { status: 'PENDING', platform: 'FACEBOOK', shareAttempts: { lt: 5 } },
    select: { id: true, adAccountId: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  }).catch(() => [] as any[])

  // Recharges: adAccountId is MongoDB ObjectID, need adAccount.accountId for Facebook ID
  const recharges = await prisma.accountDeposit.findMany({
    where: { status: 'APPROVED', rechargeStatus: { in: ['PENDING', 'NONE'] } },
    select: { id: true, adAccountId: true, adAccount: { select: { accountId: true } } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  }).catch(() => [] as any[])

  for (const s of bmShares) tasks.push({ type: 'bm_share', id: s.id, adAccountId: s.adAccountId })
  for (const r of recharges) tasks.push({ type: 'recharge', id: r.id, adAccountId: r.adAccount?.accountId || r.adAccountId })

  return tasks
}

// ─── Profile Matching by Ad Account ID ─────────────────────────────

/**
 * Find which profile manages this ad account.
 *
 * Strategy:
 *   1. Direct link: AdAccount.extensionProfileId → profile (set by admin when creating account)
 *   2. Heartbeat match: profile has this adAccountId in managedAdAccountIds
 *   3. No match: return null → caller uses fallback
 */
async function findProfileForAdAccount(adAccountId: string): Promise<any | null> {
  // 1. Direct link from AdAccount → extensionProfileId
  const adAccount = await prisma.adAccount.findFirst({
    where: { accountId: adAccountId },
    select: { extensionProfileId: true },
  }).catch(() => null)

  if (adAccount?.extensionProfileId) {
    const profile = await prisma.facebookAutomationProfile.findFirst({
      where: {
        id: adAccount.extensionProfileId,
        isEnabled: true,
        adsPowerSerialNumber: { not: null },
      },
    })
    if (profile) {
      console.log(`[AdsPower] Direct link: act_${adAccountId} → profile "${profile.label}"`)
      return profile
    }
  }

  // 2. Heartbeat match: check managedAdAccountIds
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
      managedAdAccountIds: { has: adAccountId },
    },
  })

  if (profiles.length > 0) {
    for (const p of profiles) {
      if (!activeBrowsers.has(p.id)) return p
    }
    return profiles[0]
  }

  return null
}

/**
 * Fallback: get any available profile
 */
async function getAnyAvailableProfile(): Promise<any | null> {
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
    },
  })

  for (const p of profiles) {
    if (!activeBrowsers.has(p.id)) return p
  }
  return null
}

// ─── Browser Lifecycle ─────────────────────────────────────────────

async function waitForHeartbeat(profileId: string): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < CONFIG.HEARTBEAT_TIMEOUT_MS) {
    const profile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profileId },
      select: { lastHeartbeatAt: true },
    })
    if (profile?.lastHeartbeatAt && (Date.now() - profile.lastHeartbeatAt.getTime()) < 30_000) {
      console.log(`[AdsPower] Extension heartbeat confirmed for profile ${profileId}`)
      return true
    }
    await sleep(5_000)
  }
  console.warn(`[AdsPower] Heartbeat timeout for profile ${profileId}`)
  return false
}

async function ensureBrowserRunning(profile: any): Promise<boolean> {
  const serialNumber = profile.adsPowerSerialNumber!

  // If browser is tracked, verify it's actually still running
  if (activeBrowsers.has(profile.id)) {
    const info = activeBrowsers.get(profile.id)!
    const isActive = await isBrowserActive(serialNumber)

    if (!isActive) {
      console.log(`[AdsPower] Browser tracked but NOT active for "${profile.label}" — clearing and restarting`)
      activeBrowsers.delete(profile.id)
      browserDebugInfo.delete(serialNumber)
      // Fall through to start fresh below
    } else if (info.failedCycles >= 3) {
      // Too many failed cycles — force restart
      console.log(`[AdsPower] ${info.failedCycles} failed cycles for "${profile.label}" — force restarting browser`)
      await stopBrowser(serialNumber)
      activeBrowsers.delete(profile.id)
      browserDebugInfo.delete(serialNumber)
      await sleep(5_000)
      // Fall through to start fresh below
    } else {
      // Browser is active — check if we need CDP auto-login or if extension has a fresh token
      const currentProfile = await prisma.facebookAutomationProfile.findUnique({
        where: { id: profile.id },
        select: { fbAccessToken: true, fbTokenCapturedAt: true },
      })
      const age = currentProfile?.fbTokenCapturedAt ? Date.now() - currentProfile.fbTokenCapturedAt.getTime() : Infinity
      const tokenOk = currentProfile?.fbAccessToken && age < 2 * 60 * 60 * 1000

      if (tokenOk) {
        console.log(`[AdsPower] Browser active for "${profile.label}" with fresh token (age: ${(age / 60000).toFixed(1)} min) — extension will handle tasks`)
      } else {
        console.log(`[AdsPower] Browser active for "${profile.label}" (failedCycles=${info.failedCycles}) but no fresh token — retrying CDP auto-login...`)
        const cdpLoginOk = await cdpAutoLogin(serialNumber, profile)
        if (cdpLoginOk) {
          console.log(`[AdsPower] CDP login action taken — waiting 15s for FB to complete login...`)
          await sleep(15_000)
        }
      }
      // Verify heartbeat is still working
      const heartbeatOk = await waitForHeartbeat(profile.id)
      if (!heartbeatOk) {
        console.warn(`[AdsPower] Extension not responding in "${profile.label}" — force restarting`)
        await stopBrowser(serialNumber)
        activeBrowsers.delete(profile.id)
        browserDebugInfo.delete(serialNumber)
        await sleep(5_000)
        // Fall through to start fresh below
      } else {
        return true
      }
    }
  }

  const alreadyActive = await isBrowserActive(serialNumber)
  if (!alreadyActive) {
    const launched = await startBrowser(serialNumber)
    if (!launched) return false
    console.log(`[AdsPower] Waiting ${CONFIG.BROWSER_LAUNCH_WAIT_MS / 1000}s for browser to load...`)
    await sleep(CONFIG.BROWSER_LAUNCH_WAIT_MS)
  } else {
    // Browser already running — ensure we have debug info (may have been lost on API restart)
    if (!browserDebugInfo.has(serialNumber)) {
      console.log(`[AdsPower] Browser already active, fetching debug info for serial=${serialNumber}...`)
      // Call startBrowser which will get ws URL from "already running" response
      await startBrowser(serialNumber)
    }
  }

  activeBrowsers.set(profile.id, { profileId: profile.id, serialNumber, launchedAt: Date.now(), failedCycles: 0, tasksCompleted: 0 })

  // Check if profile already has a fresh token — if so, skip CDP auto-login entirely.
  // The extension will try the stored token first (3-step escalation: token → rehydrate → login).
  // CDP auto-login is only needed if there's no token at all.
  const freshProfile = await prisma.facebookAutomationProfile.findUnique({
    where: { id: profile.id },
    select: { fbAccessToken: true, fbTokenCapturedAt: true },
  })
  const tokenAge = freshProfile?.fbTokenCapturedAt ? Date.now() - freshProfile.fbTokenCapturedAt.getTime() : Infinity
  const hasRecentToken = freshProfile?.fbAccessToken && tokenAge < 2 * 60 * 60 * 1000 // 2 hours

  if (hasRecentToken) {
    console.log(`[AdsPower] Profile "${profile.label}" has fresh token (age: ${(tokenAge / 60000).toFixed(1)} min) — skipping CDP auto-login`)
    // Just wait a bit for extension to boot up
    await sleep(5_000)
  } else {
    // No recent token — run CDP auto-login to establish FB session
    console.log(`[AdsPower] No fresh token for "${profile.label}" (age: ${tokenAge === Infinity ? 'never' : (tokenAge / 60000).toFixed(1) + ' min'}) — running CDP auto-login...`)
    const cdpLoginOk = await cdpAutoLogin(serialNumber, profile)
    if (cdpLoginOk) {
      console.log(`[AdsPower] CDP login action taken — waiting 15s for FB to complete login...`)
      await sleep(15_000)
    } else {
      // Even if CDP failed, wait a bit — extension might already be logged in from previous session
      console.log(`[AdsPower] CDP login failed — waiting 10s before checking heartbeat...`)
      await sleep(10_000)
    }
  }

  const heartbeatOk = await waitForHeartbeat(profile.id)
  if (!heartbeatOk) {
    console.warn(`[AdsPower] Extension not responding in "${profile.label}" — stopping`)
    await stopBrowser(serialNumber)
    activeBrowsers.delete(profile.id)
    return false
  }

  return true
}

// ─── Main Poll Loop ────────────────────────────────────────────────

async function pollForTasks(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  try {
    const tasks = await getPendingTasks()

    if (tasks.length === 0) {
      await cleanupIdleBrowsers()
      return
    }

    console.log(`[AdsPower] Found ${tasks.length} pending tasks`)

    // Group tasks by admin-assigned profile (extensionProfileId on AdAccount)
    // ONLY open the profile that admin assigned — no fallback to random profiles
    const profilesToLaunch = new Map<string, { profile: any; adAccountIds: Set<string> }>()

    for (const task of tasks) {
      // Find the admin-assigned profile for this ad account
      const profile = await findProfileForAdAccount(task.adAccountId)

      if (!profile) {
        // No profile assigned — skip, admin needs to assign one
        console.log(`[AdsPower] act_${task.adAccountId} has no assigned profile — skipping (admin must assign extensionProfileId)`)
        continue
      }

      if (!profilesToLaunch.has(profile.id)) {
        profilesToLaunch.set(profile.id, { profile, adAccountIds: new Set() })
      }
      profilesToLaunch.get(profile.id)!.adAccountIds.add(task.adAccountId)
    }

    if (profilesToLaunch.size === 0) {
      console.log(`[AdsPower] No profiles available for pending tasks`)
      return
    }

    // Pick ONE profile to launch this cycle — most tasks first
    // Others will be picked up in the next 30s poll cycle
    const sorted = Array.from(profilesToLaunch.entries()).sort((a, b) => {
      return b[1].adAccountIds.size - a[1].adAccountIds.size
    })

    const [bestProfileId, { profile: bestProfile, adAccountIds: bestAccounts }] = sorted[0]
    if (sorted.length > 1) {
      console.log(`[AdsPower] ${sorted.length} profiles need launching — picking "${bestProfile.label}" first (${bestAccounts.size} tasks). Others deferred to next cycle.`)
    }

    // Launch only the best profile
    let anyBrowserLaunched = false
    console.log(`[AdsPower] Opening "${bestProfile.label}" (serial=${bestProfile.adsPowerSerialNumber}) for ${bestAccounts.size} ad accounts: ${Array.from(bestAccounts).map(id => 'act_' + id).join(', ')}`)
    const ok = await ensureBrowserRunning(bestProfile)
    if (ok) {
      anyBrowserLaunched = true
      console.log(`[AdsPower] Extension running in "${bestProfile.label}" — processing...`)
    }
    // Keep only the launched profile in profilesToLaunch for the rest of the function
    for (const key of Array.from(profilesToLaunch.keys())) {
      if (key !== bestProfileId) profilesToLaunch.delete(key)
    }

    // If no browser launched, skip the 5-min wait — tasks can't be processed
    if (!anyBrowserLaunched) {
      console.warn(`[AdsPower] No browsers launched successfully — skipping wait loop`)
      // Increment failure tracking on all profiles
      for (const [profileId] of profilesToLaunch) {
        const info = activeBrowsers.get(profileId)
        if (info) {
          info.failedCycles++
          console.log(`[AdsPower] Profile ${profileId}: failedCycles=${info.failedCycles}`)
        }
      }
      // Increment shareAttempts on stuck BM shares so watchdog can eventually auto-reject
      const stuckShares = tasks.filter(t => t.type === 'bm_share')
      for (const share of stuckShares) {
        await prisma.bmShareRequest.update({
          where: { id: share.id },
          data: {
            shareAttempts: { increment: 1 },
            shareError: 'WORKER_CYCLE_FAILED: Browser could not launch — extension offline or login failed',
          },
        }).catch((e: any) => console.error(`[AdsPower] Failed to update BM share ${share.id}:`, e.message))
      }
      if (stuckShares.length > 0) {
        console.log(`[AdsPower] Incremented shareAttempts for ${stuckShares.length} stuck BM shares`)
      }
      return
    }

    // Wait for tasks to complete (with early break if login failures detected)
    const startTime = Date.now()
    while (Date.now() - startTime < CONFIG.TASK_TIMEOUT_MS) {
      const remaining = await getPendingTasks()
      if (remaining.length === 0) {
        console.log(`[AdsPower] All tasks completed`)
        break
      }

      // Break early if deposits are failing due to login issues — go straight to CDP retry
      const loginFailed = await prisma.accountDeposit.count({
        where: {
          status: 'APPROVED',
          rechargeStatus: 'FAILED',
          rechargeError: { contains: 'Auto-login' },
          updatedAt: { gte: new Date(Date.now() - 60_000) },
        },
      })
      if (loginFailed > 0) {
        console.log(`[AdsPower] ${loginFailed} deposits failed login — breaking wait loop for CDP retry`)
        break
      }

      // After 60s, if extension still has no token, trigger CDP force token capture
      if ((Date.now() - startTime) > 60_000) {
        for (const [profileId, { profile: p }] of profilesToLaunch) {
          const currentProfile = await prisma.facebookAutomationProfile.findUnique({
            where: { id: profileId },
            select: { fbAccessToken: true, fbTokenCapturedAt: true, label: true },
          })
          const tokenAge = currentProfile?.fbTokenCapturedAt ? Date.now() - currentProfile.fbTokenCapturedAt.getTime() : Infinity
          const hasValidToken = currentProfile?.fbAccessToken && tokenAge < 300_000 // 5 min

          if (!hasValidToken) {
            console.log(`[AdsPower] Extension has no fresh token for "${currentProfile?.label || profileId}" after 60s — triggering CDP force token capture...`)
            const serial = p.adsPowerSerialNumber!
            const capturedToken = await cdpForceTokenCapture(serial, p)
            if (capturedToken) {
              console.log(`[AdsPower] CDP force token capture succeeded for "${currentProfile?.label}" (len=${capturedToken.length}) — extension should pick up tasks now`)
            } else {
              console.log(`[AdsPower] CDP force token capture failed for "${currentProfile?.label}" — will try cdpAutoLogin next`)
            }
          }
        }
      }

      // Break early if profiles have cookie_fallback status — extension can't recharge without token
      if ((Date.now() - startTime) > 30_000) {
        const cookieFallbackProfiles = await prisma.facebookAutomationProfile.count({
          where: {
            id: { in: Array.from(profilesToLaunch.keys()) },
            healthStatus: 'cookie_fallback',
            fbCookies: { not: null },
          },
        })
        if (cookieFallbackProfiles > 0 && remaining.filter(t => t.type === 'recharge').length > 0) {
          console.log(`[AdsPower] ${cookieFallbackProfiles} profile(s) in cookie_fallback mode — breaking wait loop`)
          break
        }
      }

      // Break early if BM shares are stuck (not being claimed by extension) after 2 min
      const stuckBmShares = remaining.filter(t => t.type === 'bm_share')
      if (stuckBmShares.length > 0 && remaining.filter(t => t.type === 'recharge').length === 0 && (Date.now() - startTime) > 120_000) {
        console.log(`[AdsPower] ${stuckBmShares.length} BM shares unclaimed after 2 min (no recharges pending) — breaking wait loop`)
        break
      }

      console.log(`[AdsPower] Waiting... ${remaining.length} tasks remaining`)
      await sleep(10_000)
    }

    // Check if tasks failed due to login issues OR tasks are still stuck as PENDING
    const failedDeposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: { in: ['FAILED', 'PENDING', 'NONE'] },
        OR: [
          { rechargeError: { contains: 'Auto-login' }, updatedAt: { gte: new Date(Date.now() - 300_000) } },
          { rechargeStatus: { in: ['PENDING', 'NONE'] } },
        ],
      },
      include: { adAccount: { select: { accountId: true } } },
      take: 10,
    }).catch(() => [] as any[])

    if (failedDeposits.length > 0) {
      console.log(`[AdsPower] ${failedDeposits.length} deposits need retry — trying CDP auto-login + server-side recharge...`)

      // Try CDP auto-login for each profile
      for (const [profileId, { profile }] of profilesToLaunch) {
        const serial = profile.adsPowerSerialNumber!
        console.log(`[AdsPower] CDP auto-login attempt for "${profile.label}" (serial=${serial})`)
        const cdpResult = await cdpAutoLogin(serial, profile)
        if (cdpResult) {
          console.log(`[AdsPower] CDP login action taken — waiting 20s for FB login + token capture...`)
          await sleep(20_000)
        } else {
          console.log(`[AdsPower] CDP could not login — waiting 15s...`)
          await sleep(15_000)
        }

        // Get fresh token (cookie-based recharge is disabled — unreliable)
        const updatedProfile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: profileId },
          select: { fbAccessToken: true, fbTokenCapturedAt: true, label: true, managedAdAccountIds: true },
        })
        const tokenFresh = updatedProfile?.fbTokenCapturedAt && (Date.now() - updatedProfile.fbTokenCapturedAt.getTime()) < 300_000
        const hasToken = updatedProfile?.fbAccessToken && tokenFresh

        if (!hasToken) {
          console.log(`[AdsPower] No fresh token for "${updatedProfile?.label || profileId}" — server-side recharge not possible, leaving for extension`)
          continue
        }

        console.log(`[AdsPower] Server-side recharge (token) for "${updatedProfile!.label}" — processing ${failedDeposits.length} deposits...`)

        for (const deposit of failedDeposits) {
          const fbAccountId = deposit.adAccount?.accountId
          if (!fbAccountId) continue

          // ATOMIC CLAIM: only proceed if status is still PENDING/FAILED/NONE
          const claimed = await prisma.accountDeposit.updateMany({
            where: {
              id: deposit.id,
              rechargeStatus: { in: ['PENDING', 'FAILED', 'NONE'] },
            },
            data: { rechargeStatus: 'IN_PROGRESS', rechargeMethod: 'SERVER', rechargeAttempts: { increment: 1 } },
          })
          if (claimed.count === 0) {
            console.log(`[AdsPower] Deposit ${deposit.id} already claimed/completed — skipping server-side recharge`)
            continue
          }

          console.log(`[AdsPower] Server-side recharge (token): deposit ${deposit.id}, act_${fbAccountId}, $${deposit.amount}`)

          const result = await serverSideRecharge(deposit.id, fbAccountId, deposit.amount, updatedProfile!.fbAccessToken!)

          if (result.success) {
            const rechargeDetails = result.previousSpendCap !== undefined
              ? `Server recharge: previousCap=$${result.previousSpendCap}, newCap=$${result.newSpendCap}`
              : result.details || 'Server recharge completed'
            await prisma.accountDeposit.update({
              where: { id: deposit.id },
              data: {
                rechargeStatus: 'COMPLETED',
                rechargeMethod: 'SERVER',
                rechargedAt: new Date(),
                rechargedBy: `server-worker-token`,
                rechargeError: null,
                adminRemarks: rechargeDetails,
              },
            })
            console.log(`[AdsPower] Deposit ${deposit.id} RECHARGE COMPLETED via token! ${result.details}`)
          } else {
            await prisma.accountDeposit.update({
              where: { id: deposit.id },
              data: { rechargeStatus: 'FAILED', rechargeError: result.error },
            })
            console.error(`[AdsPower] Server recharge FAILED for ${deposit.id}: ${result.error}`)

            // If token is invalid/expired, clear it so it's not reused
            if (result.error?.includes('Invalid request') || result.error?.includes('Invalid OAuth') || result.error?.includes('expired')) {
              console.log(`[AdsPower] Clearing invalid token for "${updatedProfile!.label}" — token rejected by Facebook`)
              await prisma.facebookAutomationProfile.update({
                where: { id: profileId },
                data: { fbAccessToken: null, fbTokenCapturedAt: null, fbTokenValidatedAt: null },
              })
              break // Don't try more deposits with this bad token
            }
          }
        }
      }
    }

    // Task-scoped lifecycle — don't reset idle timer, let cleanupIdleBrowsers() close them
    // after IDLE_CLOSE_DELAY_MS (~2 min) once no new tasks arrive.
    const finalTasks = await getPendingTasks()
    if (finalTasks.length === 0) {
      console.log(`[AdsPower] All tasks done. Browsers will auto-close in ~${CONFIG.IDLE_CLOSE_DELAY_MS / 60_000} min.`)
      for (const [profileId, { profile }] of profilesToLaunch) {
        const info = activeBrowsers.get(profileId)
        if (info) {
          // Don't reset launchedAt — let idle timer expire so browser closes
          info.tasksCompleted += tasks.length // Track completed tasks for restart policy
        }

        // Clean up tabs after tasks complete — prevent RAM leak
        const serial = profile.adsPowerSerialNumber!
        const dbg = browserDebugInfo.get(serial)
        if (dbg) await cdpCleanupTabs(dbg.debugPort)
      }
    } else {
      console.log(`[AdsPower] Still ${finalTasks.length} tasks remaining — incrementing failedCycles`)
      for (const [profileId] of profilesToLaunch) {
        const info = activeBrowsers.get(profileId)
        if (info) {
          info.failedCycles++
          console.log(`[AdsPower] Profile ${profileId}: failedCycles=${info.failedCycles}`)
          if (info.failedCycles >= 3) {
            console.error(`[ALERT] Profile ${profileId} hit ${info.failedCycles} failed cycles — forcing restart`)
          }
        }
      }

      // Increment shareAttempts on stuck BM shares so task-watchdog can eventually auto-reject
      const stuckBmShares = finalTasks.filter(t => t.type === 'bm_share')
      if (stuckBmShares.length > 0) {
        console.log(`[AdsPower] ${stuckBmShares.length} BM shares still pending after full cycle — incrementing attempts`)
        for (const share of stuckBmShares) {
          await prisma.bmShareRequest.update({
            where: { id: share.id },
            data: {
              shareAttempts: { increment: 1 },
              shareError: 'WORKER_CYCLE_FAILED: Browser could not process — extension offline or login failed',
            },
          }).catch((e: any) => console.error(`[AdsPower] Failed to update BM share ${share.id}:`, e.message))
        }
      }
    }

  } catch (err: any) {
    console.error(`[AdsPower] Worker error:`, err.message)
  } finally {
    isProcessing = false
  }
}

async function cleanupIdleBrowsers(): Promise<void> {
  for (const [profileId, info] of activeBrowsers.entries()) {
    const idleTime = Date.now() - info.launchedAt

    // Safety restart: too many tasks completed
    if (info.tasksCompleted >= CONFIG.MAX_TASKS_BEFORE_RESTART) {
      console.log(`[AdsPower] Safety restart: ${info.tasksCompleted} tasks completed (limit: ${CONFIG.MAX_TASKS_BEFORE_RESTART}). Restarting serial=${info.serialNumber}`)
      await stopBrowser(info.serialNumber)
      activeBrowsers.delete(profileId)
      continue
    }

    // Safety restart: uptime exceeded
    if (Date.now() - info.launchedAt > CONFIG.MAX_UPTIME_MS) {
      console.log(`[AdsPower] Safety restart: uptime ${((Date.now() - info.launchedAt) / 3600000).toFixed(1)}h (limit: ${CONFIG.MAX_UPTIME_MS / 3600000}h). Restarting serial=${info.serialNumber}`)
      await stopBrowser(info.serialNumber)
      activeBrowsers.delete(profileId)
      continue
    }

    // Idle too long → stop browser entirely
    if (idleTime > CONFIG.IDLE_CLOSE_DELAY_MS) {
      console.log(`[AdsPower] Cleaning up idle browser (${(idleTime / 60_000).toFixed(1)} min idle): serial=${info.serialNumber}`)
      await stopBrowser(info.serialNumber)
      activeBrowsers.delete(profileId)
    } else {
      // Browser still alive → just clean up extra tabs (prevent RAM leak)
      const dbg = browserDebugInfo.get(info.serialNumber)
      if (dbg) await cdpCleanupTabs(dbg.debugPort)
    }
  }
}

// ─── Account Discovery ──────────────────────────────────────────────

/**
 * Discover which AdsPower profile manages a given ad account.
 *
 * Opens each enabled profile one by one, waits for extension heartbeat
 * (which calls FB /me/adaccounts and reports managedAdAccountIds),
 * then checks if the target account appears. Stops as soon as found.
 *
 * Sets AdAccount.extensionProfileId when found.
 *
 * @returns profileId if found, null if not found in any profile
 */
export async function discoverAccountProfile(adAccountId: string): Promise<string | null> {
  console.log(`[AdsPower Discovery] Starting discovery for act_${adAccountId}`)

  // If the account already has an admin-assigned extensionProfileId, respect it — don't overwrite
  const existingAccount = await prisma.adAccount.findFirst({
    where: { accountId: adAccountId },
    select: { extensionProfileId: true },
  })
  if (existingAccount?.extensionProfileId) {
    console.log(`[AdsPower Discovery] act_${adAccountId} already has extensionProfileId=${existingAccount.extensionProfileId} (admin-assigned), skipping discovery`)
    return existingAccount.extensionProfileId
  }

  // Get all enabled profiles with AdsPower config
  const profiles = await prisma.facebookAutomationProfile.findMany({
    where: {
      isEnabled: true,
      adsPowerSerialNumber: { not: null },
      extensionApiKey: { not: null },
    },
  })

  if (profiles.length === 0) {
    console.log(`[AdsPower Discovery] No profiles available`)
    return null
  }

  // First check if any profile already has it in managedAdAccountIds (from previous heartbeats)
  for (const profile of profiles) {
    if (profile.managedAdAccountIds?.includes(adAccountId)) {
      console.log(`[AdsPower Discovery] Already known: act_${adAccountId} → "${profile.label}"`)
      // Link it directly
      await prisma.adAccount.updateMany({
        where: { accountId: adAccountId },
        data: { extensionProfileId: profile.id },
      })
      return profile.id
    }
  }

  console.log(`[AdsPower Discovery] Account not in any cached heartbeat. Opening ${profiles.length} profiles to discover...`)

  // Open each profile, wait for heartbeat, check if account discovered
  for (const profile of profiles) {
    const serialNumber = profile.adsPowerSerialNumber!
    const wasAlreadyActive = activeBrowsers.has(profile.id) || await isBrowserActive(serialNumber)

    console.log(`[AdsPower Discovery] Trying "${profile.label}" (serial=${serialNumber})...`)

    const ok = await ensureBrowserRunning(profile)
    if (!ok) {
      console.log(`[AdsPower Discovery] Failed to start "${profile.label}", skipping`)
      continue
    }

    // Give extension a moment to heartbeat with fresh ad account list
    await sleep(10_000)

    // Re-read profile to get updated managedAdAccountIds
    const updatedProfile = await prisma.facebookAutomationProfile.findUnique({
      where: { id: profile.id },
      select: { managedAdAccountIds: true },
    })

    if (updatedProfile?.managedAdAccountIds?.includes(adAccountId)) {
      console.log(`[AdsPower Discovery] FOUND: act_${adAccountId} → "${profile.label}"`)

      // Link it
      await prisma.adAccount.updateMany({
        where: { accountId: adAccountId },
        data: { extensionProfileId: profile.id },
      })

      // Close browser if we opened it
      if (!wasAlreadyActive) {
        await stopBrowser(serialNumber)
        activeBrowsers.delete(profile.id)
      }

      return profile.id
    }

    console.log(`[AdsPower Discovery] act_${adAccountId} NOT in "${profile.label}"`)

    // Close browser if we opened it just for discovery
    if (!wasAlreadyActive) {
      await stopBrowser(serialNumber)
      activeBrowsers.delete(profile.id)
    }
  }

  console.log(`[AdsPower Discovery] act_${adAccountId} not found in any profile`)
  return null
}

// ─── Public API ────────────────────────────────────────────────────

export function startAdsPowerWorker(): void {
  console.log('[AdsPower] Starting on-demand worker...')
  console.log(`[AdsPower] API base: ${CONFIG.ADSPOWER_API_BASE}`)
  console.log(`[AdsPower] Poll interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`)

  pollForTasks().catch(err => console.error('[AdsPower] Initial poll error:', err))
  pollInterval = setInterval(() => {
    pollForTasks().catch(err => console.error('[AdsPower] Poll error:', err))
  }, CONFIG.POLL_INTERVAL_MS)

  console.log('[AdsPower] Worker started')
}

export async function stopAdsPowerWorker(): Promise<void> {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  for (const [, info] of activeBrowsers.entries()) await stopBrowser(info.serialNumber)
  activeBrowsers.clear()
  console.log('[AdsPower] Worker stopped')
}

export function getWorkerStatus() {
  return {
    isRunning: pollInterval !== null,
    isProcessing,
    activeBrowserCount: activeBrowsers.size,
    activeBrowsers: Array.from(activeBrowsers.entries()).map(([id, info]) => ({
      profileId: id,
      serialNumber: info.serialNumber,
      launchedAt: new Date(info.launchedAt).toISOString(),
      runningForMs: Date.now() - info.launchedAt,
      failedCycles: info.failedCycles,
      tasksCompleted: info.tasksCompleted,
    })),
    stats: {
      ...workerStats,
      avgRechargeTimeMs: workerStats.totalRecharges > 0
        ? Math.round(workerStats.totalRechargeTimeMs / workerStats.totalRecharges)
        : 0,
      loggedInRatio: (workerStats.loggedInExecutions + workerStats.loggedOutExecutions) > 0
        ? (workerStats.loggedInExecutions / (workerStats.loggedInExecutions + workerStats.loggedOutExecutions) * 100).toFixed(1) + '%'
        : 'N/A',
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
