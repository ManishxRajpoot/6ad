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

import { PrismaClient } from '@prisma/client'
import WebSocket from 'ws'
import * as OTPAuth from 'otpauth'

const prisma = new PrismaClient()

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

    // Step 4: Capture token from www.facebook.com
    // Strategy: Navigate a tab to FB home (NOT adsmanager) — FB home has __accessToken and user tokens in API calls
    console.log(`[AdsPower CDP] Capturing token from www.facebook.com...`)

    let capturedToken: string | null = null

    // Get current tabs
    const allTabs = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
    const pageTabs = allTabs.filter((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)
    console.log(`[AdsPower CDP] Found ${pageTabs.length} page tabs: ${pageTabs.map((t: any) => t.url?.substring(0, 80)).join(' | ')}`)

    // Find the best FB tab: prefer home.php, skip 2FA/checkpoint/remember_browser pages
    let fbTab = pageTabs.find((t: any) =>
      t.url?.includes('www.facebook.com') &&
      !t.url?.includes('two_factor') &&
      !t.url?.includes('two_step') &&
      !t.url?.includes('checkpoint') &&
      !t.url?.includes('remember_browser')
    )

    // If no clean FB tab, use any page tab and navigate it to home.php
    if (!fbTab) {
      fbTab = pageTabs[0] // Use first available page tab
    }

    if (fbTab?.webSocketDebuggerUrl) {
      // Ensure we're on a proper FB home page — navigate if needed
      const tabUrl = fbTab.url || ''
      const isOnFbHome = tabUrl.includes('www.facebook.com') &&
        !tabUrl.includes('two_factor') && !tabUrl.includes('checkpoint') && !tabUrl.includes('remember_browser')

      if (!isOnFbHome) {
        console.log(`[AdsPower CDP] Tab on ${tabUrl.substring(0, 60)} — navigating to FB home first...`)
        await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.location.href = 'https://www.facebook.com/home.php'`)
        await sleep(8000) // Wait for FB home to load
        // Refresh tab list and re-find the tab (URL changed)
        const refreshedTabs = await fetch(`http://127.0.0.1:${debugInfo.debugPort}/json`).then(r => r.json()).catch(() => [])
        const refreshedFb = refreshedTabs.find((t: any) =>
          t.type === 'page' && t.webSocketDebuggerUrl && t.url?.includes('www.facebook.com/home')
        )
        if (refreshedFb) fbTab = refreshedFb
      }

      // Method A: Read window.__accessToken directly (available on www.facebook.com after page load)
      console.log(`[AdsPower CDP] Trying window.__accessToken on FB tab (${fbTab.url?.substring(0, 60)})...`)
      for (let attempt = 1; attempt <= 5; attempt++) {
        if (attempt > 1) await sleep(3000)
        const result = await cdpEvaluate(fbTab.webSocketDebuggerUrl, `window.__accessToken || null`)
        if (result && typeof result === 'string' && result.startsWith('EAA') && result.length >= 40) {
          capturedToken = result
          console.log(`[AdsPower CDP] __accessToken found! (attempt ${attempt}, len=${result.length})`)
          break
        }
        console.log(`[AdsPower CDP] __accessToken attempt ${attempt}: ${result === null ? 'null' : `${String(result).substring(0, 20)}...`}`)
      }

      // Method B: If __accessToken not available, intercept network requests by reloading FB page
      if (!capturedToken) {
        console.log(`[AdsPower CDP] __accessToken not available, trying network interception on FB page...`)
        capturedToken = await cdpInterceptToken(fbTab.webSocketDebuggerUrl, 45000)
      }
    } else {
      console.log(`[AdsPower CDP] No usable page tab found!`)
    }

    // Validate captured token
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

    if (!capturedToken) {
      // Dead session: c_user cookie exists but no token available
      // Clear FB session cookies so next cycle triggers a fresh login with email/password/2FA
      console.log(`[AdsPower CDP] Token capture failed — dead session detected, clearing cookies for fresh login...`)
      if (fbTab?.webSocketDebuggerUrl) {
        await cdpClearFBCookies(fbTab.webSocketDebuggerUrl, debugInfo.debugPort)
      }
      await prisma.facebookAutomationProfile.update({
        where: { id: profile.id },
        data: { healthStatus: 'needs_login', lastError: 'Dead session — cookies cleared, will re-login next cycle' },
      }).catch(() => {})
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
async function cdpInterceptToken(tabWsUrl: string, timeoutMs: number = 45000, navigateUrl?: string): Promise<string | null> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null
    let resolved = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    let msgId = 1
    const seenTokens = new Set<string>()
    let requestCount = 0

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
      console.log(`[AdsPower CDP] Network interception done: ${token ? 'TOKEN FOUND' : 'no token'} (${requestCount} requests seen, ${seenTokens.size} tokens checked)`)
      cleanup()
      resolve(token)
    }

    async function validateAndResolve(token: string) {
      if (resolved || seenTokens.has(token)) return
      seenTokens.add(token)

      // Skip very short tokens (app tokens tend to be shorter)
      if (token.length < 100) {
        console.log(`[AdsPower CDP] Skipping short token (len=${token.length})`)
        return
      }

      console.log(`[AdsPower CDP] Validating intercepted token (len=${token.length}, ${token.substring(0, 20)}...)`)

      try {
        const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`).then(r => r.json()).catch(() => null)
        if (meRes?.id) {
          console.log(`[AdsPower CDP] Token VALID! User: ${meRes.name} (${meRes.id})`)
          done(token)
        } else {
          console.log(`[AdsPower CDP] Token invalid: ${meRes?.error?.message?.substring(0, 60) || 'no id'}`)
        }
      } catch (e: any) {
        console.log(`[AdsPower CDP] Token validation error: ${e.message}`)
      }
    }

    try {
      console.log(`[AdsPower CDP] Connecting WebSocket to tab: ${tabWsUrl.substring(0, 80)}...`)
      ws = new WebSocket(tabWsUrl)

      timeout = setTimeout(() => {
        console.log(`[AdsPower CDP] Network interception timed out after ${timeoutMs / 1000}s (${requestCount} requests, ${seenTokens.size} tokens checked)`)
        done(null)
      }, timeoutMs)

      ws.on('open', () => {
        console.log(`[AdsPower CDP] WebSocket connected! Enabling Network domain...`)
        // Enable Network domain FIRST to catch all subsequent requests
        ws?.send(JSON.stringify({ id: msgId++, method: 'Network.enable', params: {} }))

        // Small delay to ensure Network is enabled before navigation
        setTimeout(() => {
          if (resolved) return
          if (navigateUrl) {
            // Navigate to the URL that triggers API calls containing access_token
            console.log(`[AdsPower CDP] Navigating to: ${navigateUrl}`)
            ws?.send(JSON.stringify({ id: msgId++, method: 'Page.navigate', params: { url: navigateUrl } }))
          } else {
            // Reload current page to trigger fresh API calls
            console.log(`[AdsPower CDP] Reloading page to trigger API calls...`)
            ws?.send(JSON.stringify({ id: msgId++, method: 'Page.reload', params: {} }))
          }
        }, 500)
      })

      ws.on('message', (data: Buffer) => {
        if (resolved) return
        try {
          const msg = JSON.parse(data.toString())

          if (msg.method === 'Network.requestWillBeSent') {
            requestCount++
            const url = msg.params?.request?.url || ''
            const postData = msg.params?.request?.postData || ''

            // Check URL for access_token
            const urlMatch = url.match(/access_token=(EAA[a-zA-Z0-9]+)/)
            if (urlMatch && urlMatch[1].length >= 40 && urlMatch[1].length < 500) {
              validateAndResolve(urlMatch[1])
            }

            // Also check POST body for access_token
            if (postData) {
              const bodyMatch = postData.match(/access_token=(EAA[a-zA-Z0-9]+)/)
              if (bodyMatch && bodyMatch[1].length >= 40 && bodyMatch[1].length < 500) {
                validateAndResolve(bodyMatch[1])
              }
            }
          }
        } catch {}
      })

      ws.on('error', (err: any) => {
        console.log(`[AdsPower CDP] Network interception WS error:`, err.message)
        done(null)
      })

      ws.on('close', () => {
        console.log(`[AdsPower CDP] Network interception WS closed unexpectedly`)
        if (!resolved) done(null)
      })
    } catch (err: any) {
      console.log(`[AdsPower CDP] Network interception setup failed:`, err.message)
      done(null)
    }
  })
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
async function serverSideRecharge(depositId: string, adAccountId: string, amount: number, accessToken: string): Promise<{ success: boolean; error?: string; details?: string }> {
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

    console.log(`[Server Recharge] act_${adAccountId}: currentCap=$${currentCapDollars}, deposit=$${amount}, newCap=$${newCapDollars}`)

    // Step 2: POST new spend cap
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

    const details = `currentCap=$${currentCapDollars}, newCap=$${newCapDollars}`
    console.log(`[Server Recharge] SUCCESS act_${adAccountId}: ${details}`)
    return { success: true, details }
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
    take: 20,
  }).catch(() => [] as any[])

  // Recharges: adAccountId is MongoDB ObjectID, need adAccount.accountId for Facebook ID
  const recharges = await prisma.accountDeposit.findMany({
    where: { status: 'APPROVED', rechargeStatus: { in: ['PENDING', 'NONE'] } },
    select: { id: true, adAccountId: true, adAccount: { select: { accountId: true } } },
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
      // Browser is active — retry CDP auto-login since tasks are stuck
      console.log(`[AdsPower] Browser active for "${profile.label}" (failedCycles=${info.failedCycles}) — retrying CDP auto-login...`)
      const cdpLoginOk = await cdpAutoLogin(serialNumber, profile)
      if (cdpLoginOk) {
        console.log(`[AdsPower] CDP login action taken — waiting 15s for FB to complete login...`)
        await sleep(15_000)
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

  // CDP auto-login BEFORE waiting for heartbeat — click "Continue" button
  // so FB is logged in by the time extension starts processing tasks
  console.log(`[AdsPower] Proactive CDP auto-login for "${profile.label}" before heartbeat...`)
  const cdpLoginOk = await cdpAutoLogin(serialNumber, profile)
  if (cdpLoginOk) {
    console.log(`[AdsPower] CDP login action taken — waiting 15s for FB to complete login...`)
    await sleep(15_000)
  } else {
    // Even if CDP failed, wait a bit — extension might already be logged in from previous session
    console.log(`[AdsPower] CDP login failed — waiting 10s before checking heartbeat...`)
    await sleep(10_000)
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

    // Group tasks by ad account → find correct profile for each
    const profilesToLaunch = new Map<string, { profile: any; adAccountIds: Set<string> }>()

    for (const task of tasks) {
      // Find profile that has this ad account
      let profile = await findProfileForAdAccount(task.adAccountId)

      if (!profile) {
        // No profile has this ad account — use fallback
        profile = await getAnyAvailableProfile()
        if (!profile) {
          console.log(`[AdsPower] No profile found for ad account ${task.adAccountId}`)
          continue
        }
        console.log(`[AdsPower] No profile match for act_${task.adAccountId}, using fallback "${profile.label}"`)
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

    // Launch each needed profile
    let anyBrowserLaunched = false
    for (const [profileId, { profile, adAccountIds }] of profilesToLaunch) {
      console.log(`[AdsPower] Opening "${profile.label}" (serial=${profile.adsPowerSerialNumber}) for ${adAccountIds.size} ad accounts: ${Array.from(adAccountIds).map(id => 'act_' + id).join(', ')}`)
      const ok = await ensureBrowserRunning(profile)
      if (!ok) continue
      anyBrowserLaunched = true
      console.log(`[AdsPower] Extension running in "${profile.label}" — processing...`)
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

        // Get fresh token
        const updatedProfile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: profileId },
          select: { fbAccessToken: true, fbTokenCapturedAt: true, label: true, managedAdAccountIds: true },
        })
        const tokenFresh = updatedProfile?.fbTokenCapturedAt && (Date.now() - updatedProfile.fbTokenCapturedAt.getTime()) < 300_000
        if (!updatedProfile?.fbAccessToken || !tokenFresh) {
          console.log(`[AdsPower] No fresh token for "${updatedProfile?.label || profileId}" — cannot do server-side recharge`)
          continue
        }

        console.log(`[AdsPower] Token available for "${updatedProfile.label}" — doing server-side recharge for ${failedDeposits.length} deposits...`)

        for (const deposit of failedDeposits) {
          const fbAccountId = deposit.adAccount?.accountId
          if (!fbAccountId) continue

          // ATOMIC CLAIM: only proceed if status is still PENDING/FAILED/NONE
          // If extension already claimed (IN_PROGRESS) or completed (COMPLETED), count=0 → skip
          // This is the same pattern as /extension/recharge/:id/claim endpoint
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

          console.log(`[AdsPower] Server-side recharge: deposit ${deposit.id}, act_${fbAccountId}, $${deposit.amount}`)

          const result = await serverSideRecharge(deposit.id, fbAccountId, deposit.amount, updatedProfile.fbAccessToken!)
          if (result.success) {
            await prisma.accountDeposit.update({
              where: { id: deposit.id },
              data: {
                rechargeStatus: 'COMPLETED',
                rechargeMethod: 'SERVER',
                rechargedAt: new Date(),
                rechargedBy: 'server-worker',
                rechargeError: null,
              },
            })
            console.log(`[AdsPower] Deposit ${deposit.id} RECHARGE COMPLETED via server! ${result.details}`)
          } else {
            await prisma.accountDeposit.update({
              where: { id: deposit.id },
              data: { rechargeStatus: 'FAILED', rechargeError: result.error },
            })
            console.error(`[AdsPower] Server recharge FAILED for ${deposit.id}: ${result.error}`)
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
