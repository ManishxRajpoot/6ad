/**
 * 6AD Auto Recharge - Background Service Worker
 * Handles polling for pending recharges and executing them via Facebook Graph API
 */

// ==================== CONFIG ====================

const DEFAULT_API_URL = 'https://api.6ad.in'
const POLL_INTERVAL_SECONDS = 10
const HEARTBEAT_ALARM = '6ad-heartbeat'

// ==================== STATE ====================

let isProcessing = false
let attachedTabIds = new Set()

// ==================== STORAGE HELPERS ====================

async function getConfig() {
  const data = await chrome.storage.local.get([
    'apiKey',
    'apiUrl',
    'fbAccessToken',
    'fbUserId',
    'fbUserName',
    'adAccountIds',
    'isEnabled',
    'lastHeartbeat',
    'lastError',
    'recentActivity'
  ])
  return {
    apiKey: data.apiKey || '',
    apiUrl: data.apiUrl || DEFAULT_API_URL,
    fbAccessToken: data.fbAccessToken || '',
    fbUserId: data.fbUserId || '',
    fbUserName: data.fbUserName || '',
    adAccountIds: data.adAccountIds || [],
    isEnabled: data.isEnabled !== false, // default true
    lastHeartbeat: data.lastHeartbeat || null,
    lastError: data.lastError || null,
    recentActivity: data.recentActivity || []
  }
}

async function updateConfig(updates) {
  await chrome.storage.local.set(updates)
}

async function addActivity(type, message) {
  const config = await getConfig()
  const activity = {
    type,
    message,
    timestamp: Date.now()
  }
  const recent = [activity, ...(config.recentActivity || [])].slice(0, 50)
  await updateConfig({ recentActivity: recent })
}

// ==================== API HELPERS ====================

async function apiRequest(endpoint, method = 'GET', body = null) {
  const config = await getConfig()
  if (!config.apiKey) throw new Error('No API key configured')

  const url = `${config.apiUrl.replace(/\/+$/, '')}${endpoint}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Extension-Key': config.apiKey
    }
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// ==================== TOKEN CAPTURE ====================
// Primary method: Extract __accessToken from Facebook page's JS runtime via chrome.scripting
// Backup: Debugger intercepts network requests for EAA tokens
// This is the same approach that SMIT/sMeta extensions use — no public Graph API calls from service worker

async function tryCaptureFBToken() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.facebook.com/*',
        'https://business.facebook.com/*',
        'https://adsmanager.facebook.com/*'
      ]
    })

    if (tabs.length === 0) {
      console.log('[6AD] No Facebook tabs open for token capture')
      return false
    }

    for (const tab of tabs) {
      try {
        // PRIMARY METHOD: Extract __accessToken from page's JS runtime
        // This is the most reliable method — same as SMIT/sMeta extensions
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => {
            try {
              const result = {}
              const html = document.documentElement.innerHTML

              // 1. __accessToken — Facebook's main user token stored in window
              if (window.__accessToken) {
                result.token = window.__accessToken
                result.source = '__accessToken'
              }

              // 2. Fallback: search HTML for EAA tokens
              if (!result.token) {
                const tokens = []
                const regex = /["']?(EAA[a-zA-Z0-9]{40,})["']?/g
                let m
                while ((m = regex.exec(html)) !== null) {
                  tokens.push(m[1])
                }
                if (tokens.length > 0) {
                  tokens.sort((a, b) => b.length - a.length)
                  result.token = tokens[0]
                  result.source = 'html'
                }
              }

              // 3. Get user info
              const cUser = document.cookie.match(/c_user=(\d+)/)
              if (cUser) result.userId = cUser[1]

              const um = html.match(/"USER_ID":"(\d+)"/)
              if (um) result.userId = um[1]

              return result
            } catch (e) {
              return { error: e.message }
            }
          }
        })

        const result = results?.[0]?.result
        if (result && result.token && result.token.startsWith('EAA') && result.token.length >= 20) {
          console.log(`[6AD] Token captured via ${result.source} (length: ${result.token.length})`)
          await handleTokenCapture(result.token)

          // Also save user info if available
          if (result.userId) {
            const config = await getConfig()
            if (result.userId !== config.fbUserId) {
              await updateConfig({
                fbUserId: result.userId,
                fbUserName: config.fbUserName || 'FB User ' + result.userId,
              })
            }
          }
          return true
        }
      } catch (err) {
        console.log('[6AD] Script injection failed for tab', tab.id, ':', err.message)
      }
    }

    console.log('[6AD] No token found via script injection')
    return false
  } catch (err) {
    console.error('[6AD] Token capture failed:', err.message)
    return false
  }
}

// ==================== TOKEN CAPTURE VIA DEBUGGER ====================
// Attach Chrome debugger to FB tabs to intercept network requests

function isFacebookUrl(url) {
  return url && (
    url.includes('facebook.com') ||
    url.includes('fbcdn.net')
  )
}

async function attachDebuggerToFBTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.facebook.com/*',
        'https://business.facebook.com/*',
        'https://adsmanager.facebook.com/*'
      ]
    })

    for (const tab of tabs) {
      if (!attachedTabIds.has(tab.id)) {
        try {
          await chrome.debugger.attach({ tabId: tab.id }, '1.3')
          await chrome.debugger.sendCommand({ tabId: tab.id }, 'Network.enable')
          attachedTabIds.add(tab.id)
          console.log('[6AD] Debugger attached to tab', tab.id, tab.url)
          await addActivity('info', 'Debugger attached to Facebook tab')
        } catch (err) {
          // May already be attached or permission denied
          console.log('[6AD] Debugger attach failed for tab', tab.id, ':', err.message)
        }
      }
    }
  } catch (err) {
    console.error('[6AD] Tab query failed:', err.message)
  }
}

// Listen for debugger events (network requests AND responses)
chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method === 'Network.requestWillBeSent') {
    const url = params.request?.url || ''
    const postData = params.request?.postData || ''
    const headers = params.request?.headers || {}

    // Check Authorization header too
    const authHeader = headers['Authorization'] || headers['authorization'] || ''
    if (authHeader.includes('EAA')) {
      const authMatch = authHeader.match(/EAA[a-zA-Z0-9]{20,}/)
      if (authMatch) {
        validateAndSaveToken(authMatch[0])
        return
      }
    }

    // Extract token from URL or POST body
    // Token can contain a-z, A-Z, 0-9 and may be URL-encoded
    const tokenRegex = /access_token=(EAA[a-zA-Z0-9%_.-]+)/

    const urlMatch = url.match(tokenRegex)
    if (urlMatch) {
      try {
        const token = decodeURIComponent(urlMatch[1])
        validateAndSaveToken(token)
      } catch { validateAndSaveToken(urlMatch[1]) }
      return
    }

    const bodyMatch = postData.match(tokenRegex)
    if (bodyMatch) {
      try {
        const token = decodeURIComponent(bodyMatch[1])
        validateAndSaveToken(token)
      } catch { validateAndSaveToken(bodyMatch[1]) }
      return
    }

    // Broader match in any part of the data (lowered threshold from 50 to 20 chars)
    const combined = url + ' ' + postData
    const anyMatch = combined.match(/EAA[a-zA-Z0-9%_.-]{20,}/)
    if (anyMatch) {
      try {
        const token = decodeURIComponent(anyMatch[0])
        validateAndSaveToken(token)
      } catch { validateAndSaveToken(anyMatch[0]) }
    }
  }

  // Also try to get tokens from response bodies
  if (method === 'Network.responseReceived') {
    const url = params.response?.url || ''
    // Only check graph.facebook.com or facebook.com API responses
    if (url.includes('facebook.com') || url.includes('fbcdn.net')) {
      try {
        const requestId = params.requestId
        if (requestId && source.tabId) {
          const responseBody = await chrome.debugger.sendCommand(
            { tabId: source.tabId },
            'Network.getResponseBody',
            { requestId }
          )
          if (responseBody && responseBody.body) {
            const bodyStr = responseBody.body.substring(0, 5000) // Only check first 5KB
            const tokenMatch = bodyStr.match(/EAA[a-zA-Z0-9]{20,}/)
            if (tokenMatch) {
              validateAndSaveToken(tokenMatch[0])
            }
          }
        }
      } catch {
        // Response body might not be available yet or already gone
      }
    }
  }
})

// Token collection — Facebook pages emit many different EAA tokens.
// We collect them over a short window and pick the LONGEST one (the main user token).
let collectedTokens = []
let tokenCollectionTimer = null
let savedTokenSet = new Set() // Avoid re-processing tokens we already saved

async function validateAndSaveToken(token) {
  if (!token || token.indexOf('EAA') !== 0 || token.length < 20) return
  // Skip very short tokens (likely app tokens, not user tokens)
  if (token.length < 40) return
  // Skip tokens we've already processed
  if (savedTokenSet.has(token)) return

  console.log('[6AD] EAA token seen (length:', token.length, ')')
  collectedTokens.push(token)

  // Debounce — wait 3 seconds after last token, then pick the best one
  if (tokenCollectionTimer) clearTimeout(tokenCollectionTimer)
  tokenCollectionTimer = setTimeout(() => pickBestToken(), 3000)
}

async function pickBestToken() {
  if (collectedTokens.length === 0) return

  // Pick the longest token — Facebook's main user access token is the longest
  const sorted = [...collectedTokens].sort((a, b) => b.length - a.length)
  const bestToken = sorted[0]

  // Mark all collected tokens as processed
  for (const t of collectedTokens) {
    savedTokenSet.add(t)
  }
  collectedTokens = []

  // Only save if it's different from current OR longer
  const config = await getConfig()
  if (bestToken === config.fbAccessToken) return
  if (config.fbAccessToken && bestToken.length < config.fbAccessToken.length) {
    console.log('[6AD] Skipping shorter token (current:', config.fbAccessToken.length, 'new:', bestToken.length, ')')
    return
  }

  console.log('[6AD] Best token selected (length:', bestToken.length, 'from', sorted.length, 'candidates)')
  await handleTokenCapture(bestToken)

  // Get user info from cookies instead of Graph API
  try {
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' })
    const cUser = cookies.find(c => c.name === 'c_user')
    if (cUser) {
      const updates = {}
      if (cUser.value !== config.fbUserId) {
        updates.fbUserId = cUser.value
      }
      if (!config.fbUserName || config.fbUserName === 'Not connected') {
        updates.fbUserName = 'FB User ' + cUser.value
      }
      if (Object.keys(updates).length > 0) {
        await updateConfig(updates)
      }
    }
  } catch (cookieErr) {
    console.log('[6AD] Cookie read failed:', cookieErr.message)
  }
}

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabIds.has(tabId)) {
    attachedTabIds.delete(tabId)
  }
})

// Clean up when debugger is detached
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId) {
    attachedTabIds.delete(source.tabId)
    console.log('[6AD] Debugger detached from tab', source.tabId, reason)
  }
})

// ==================== AD ACCOUNT DISCOVERY ====================

async function discoverAdAccounts() {
  try {
    const config = await getConfig()
    if (!config.fbAccessToken) return config.adAccountIds || []

    // Use page context to discover ad accounts (same approach as token capture)
    try {
      const fbTab = await findFbTab()
      const results = await chrome.scripting.executeScript({
        target: { tabId: fbTab.id },
        world: 'MAIN',
        func: async (storedToken) => {
          try {
            const token = window.__accessToken || storedToken
            if (!token) return { error: 'No token available' }

            const resp = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name&limit=200&access_token=${encodeURIComponent(token)}`, {
              credentials: 'include'
            })
            const data = await resp.json()
            if (data.error) return { error: data.error.message }

            const accounts = (data.data || []).map(a => a.account_id)

            // Also get user info
            let userName = null
            let userId = null
            try {
              const meResp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`, {
                credentials: 'include'
              })
              const meData = await meResp.json()
              if (meData.name) userName = meData.name
              if (meData.id) userId = meData.id
            } catch {}

            return { accounts, userName, userId }
          } catch (e) {
            return { error: e.message }
          }
        },
        args: [config.fbAccessToken]
      })

      const result = results?.[0]?.result
      if (result && !result.error && result.accounts) {
        const updates = { adAccountIds: result.accounts }
        if (result.userName) updates.fbUserName = result.userName
        if (result.userId) updates.fbUserId = result.userId
        await updateConfig(updates)
        console.log(`[6AD] Discovered ${result.accounts.length} ad accounts, user: ${result.userName || 'unknown'}`)
        return result.accounts
      } else {
        console.log('[6AD] Ad account discovery failed:', result?.error || 'unknown')
        return config.adAccountIds || []
      }
    } catch (err) {
      console.log('[6AD] Ad account discovery failed:', err.message)
      return config.adAccountIds || []
    }
  } catch (err) {
    console.error('[6AD] Failed to discover ad accounts:', err.message)
    return []
  }
}

// ==================== HEARTBEAT ====================

async function sendHeartbeat() {
  const config = await getConfig()
  if (!config.apiKey || !config.isEnabled) return

  try {
    // Always attach debugger to FB tabs (no-op if already attached)
    await attachDebuggerToFBTabs()

    // Try to capture token if we don't have one
    if (!config.fbAccessToken) {
      await tryCaptureFBToken()
    }

    // Re-read config after potential token capture
    const updatedConfig = await getConfig()

    // Send heartbeat FIRST — don't let account discovery block it
    const result = await apiRequest('/extension/heartbeat', 'POST', {
      adAccountIds: updatedConfig.adAccountIds || [],
      fbUserId: updatedConfig.fbUserId || undefined,
      fbUserName: updatedConfig.fbUserName || undefined,
      fbAccessToken: updatedConfig.fbAccessToken || undefined
    })

    await updateConfig({
      lastHeartbeat: Date.now(),
      lastError: null
    })

    console.log('[6AD] Heartbeat OK, pending recharges:', result.pendingCount, 'pending BM shares:', result.pendingBmShareCount)

    if (result.pendingCount > 0 || result.pendingBmShareCount > 0) {
      await addActivity('info', `Heartbeat: ${result.pendingCount} recharges, ${result.pendingBmShareCount} BM shares pending`)
    }

    // Try account discovery in background (don't block heartbeat)
    if (updatedConfig.fbAccessToken) {
      discoverAdAccounts().catch(e => console.log('[6AD] Account discovery error:', e.message))
    }

    if (result.pendingCount > 0) {
      await checkAndProcessRecharges()
    }

    if (result.pendingBmShareCount > 0) {
      await checkAndProcessBmShares()
    }
  } catch (err) {
    console.error('[6AD] Heartbeat failed:', err.message)
    await updateConfig({ lastError: err.message })
  }
}

// ==================== RECHARGE PROCESSING ====================

/**
 * Validate FB session is alive before processing tasks.
 * Checks: 1) FB tab exists and isn't login page  2) Token works via /me API call
 */
async function validateFbSession() {
  try {
    // Check if we have a stored token at all
    const config = await getConfig()
    if (!config.fbAccessToken) {
      return { valid: false, error: 'No Facebook access token stored — open Facebook in this browser first' }
    }

    // Check if FB tab exists
    let fbTab
    try {
      fbTab = await findFbTab()
    } catch (e) {
      return { valid: false, error: 'No Facebook tab open — browser may not have loaded Facebook' }
    }

    // Check if tab is on login page (FB logged us out)
    if (fbTab.url && (fbTab.url.includes('/login') || fbTab.url.includes('login.php') || fbTab.url.includes('/checkpoint'))) {
      return { valid: false, error: 'Facebook is logged out — browser is on login page. Re-login required in AdsPower.' }
    }

    // Quick validation: call /me to check if token actually works
    const results = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      world: 'MAIN',
      func: async (token) => {
        try {
          const resp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`, { credentials: 'include' })
          const data = await resp.json()
          if (data.error) return { valid: false, error: data.error.message || 'Token validation failed' }
          return { valid: true, userId: data.id, name: data.name }
        } catch (e) {
          return { valid: false, error: 'Network error validating token: ' + e.message }
        }
      },
      args: [config.fbAccessToken]
    })

    return results?.[0]?.result || { valid: false, error: 'Token validation script returned no result' }
  } catch (e) {
    return { valid: false, error: 'Session check failed: ' + e.message }
  }
}

/**
 * Claim and fail all pending recharges with a given error message.
 */
async function failAllPendingRecharges(errorMsg) {
  try {
    const result = await apiRequest('/extension/pending-recharges', 'GET')
    const recharges = result.recharges || []
    for (const recharge of recharges) {
      try {
        await apiRequest(`/extension/recharge/${recharge.depositId}/claim`, 'POST')
        await apiRequest(`/extension/recharge/${recharge.depositId}/failed`, 'POST', {
          error: errorMsg
        })
      } catch (e) {
        console.error('[6AD] Failed to report error for deposit:', e.message)
      }
    }
  } catch (e) {
    console.error('[6AD] Failed to fetch pending recharges:', e.message)
  }
}

/**
 * Get a 2FA code — tries TOTP secret first (instant), falls back to IMAP email.
 * Reusable by login flow, BM share flow, or any flow that needs 2FA.
 * @returns {string|null} The 2FA/OTP code, or null if unavailable
 */
async function get2FACode() {
  // Strategy 1: TOTP from 2FA secret (instant)
  try {
    const result = await apiRequest('/extension/generate-2fa', 'GET')
    if (result.code) {
      console.log(`[6AD] 2FA code from TOTP: ${result.code} (${result.remaining}s left)`)
      // If code expires in < 5 seconds, wait for next code
      if (result.remaining < 5) {
        console.log('[6AD] Code expiring soon, waiting for next cycle...')
        await new Promise(r => setTimeout(r, (result.remaining + 1) * 1000))
        const retry = await apiRequest('/extension/generate-2fa', 'GET')
        if (retry.code) return retry.code
      }
      return result.code
    }
  } catch (e) {
    console.log('[6AD] TOTP not available:', e.message)
  }

  // Strategy 2: IMAP email OTP (fallback, slower)
  try {
    console.log('[6AD] Trying IMAP email OTP fallback...')
    await new Promise(r => setTimeout(r, 5000)) // Wait for email delivery
    const result = await apiRequest('/extension/fetch-otp', 'POST')
    if (result.otp) {
      console.log(`[6AD] OTP from email: ${result.otp}`)
      return result.otp
    }
  } catch (e) {
    console.log('[6AD] IMAP OTP not available:', e.message)
  }

  return null
}

/**
 * Auto-login to Facebook when session expires.
 * 1. Gets credentials from API
 * 2. Navigates to facebook.com
 * 3. Fills email/password and clicks login
 * 4. Handles 2FA/OTP via IMAP if needed
 * 5. Waits for successful login and captures new token
 */
async function autoLoginFacebook() {
  try {
    console.log('[6AD] Attempting auto-login to Facebook...')
    await addActivity('info', 'FB session expired — attempting auto-login...')

    // 1. Get login credentials from API
    let credentials
    try {
      credentials = await apiRequest('/extension/login-credentials', 'GET')
    } catch (e) {
      return { success: false, error: 'No login credentials configured — set FB email/password in admin profile settings' }
    }
    if (!credentials.email || !credentials.password) {
      return { success: false, error: 'No login credentials configured for this profile' }
    }

    // 2. Find or create a Facebook tab
    let fbTab
    try {
      const tabs = await chrome.tabs.query({ url: ['https://*.facebook.com/*'] })
      fbTab = tabs[0]
    } catch (e) {}

    if (!fbTab) {
      // Create a new tab
      fbTab = await chrome.tabs.create({ url: 'https://www.facebook.com/', active: false })
      await new Promise(r => setTimeout(r, 5000))
    } else {
      // Navigate existing tab to facebook.com
      await chrome.tabs.update(fbTab.id, { url: 'https://www.facebook.com/' })
      await new Promise(r => setTimeout(r, 5000))
    }

    // 3. Check if we're on login page and fill credentials
    const loginResult = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      world: 'MAIN',
      func: async (email, password) => {
        try {
          // Wait a moment for page to stabilize
          await new Promise(r => setTimeout(r, 2000))

          const url = window.location.href.toLowerCase()
          const html = document.documentElement.innerHTML.toLowerCase()

          // Check if already logged in (not on login page)
          if (!url.includes('/login') && !url.includes('login.php') && !url.includes('/checkpoint')
              && !html.includes('log in to facebook') && !html.includes('log into facebook')) {
            // Might already be logged in after navigation
            if (window.__accessToken || document.cookie.includes('c_user=')) {
              return { status: 'already_logged_in' }
            }
          }

          // Find email input
          const emailInput = document.querySelector('input[name="email"], input[id="email"], input[type="email"], input[name="login_source"]')
          if (!emailInput) {
            return { status: 'no_login_form', error: 'Could not find email input on page' }
          }

          // Find password input
          const passInput = document.querySelector('input[name="pass"], input[id="pass"], input[type="password"]')
          if (!passInput) {
            return { status: 'no_login_form', error: 'Could not find password input on page' }
          }

          // Fill in credentials using native input setter (works with React/FB forms)
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          nativeInputValueSetter.call(emailInput, email)
          emailInput.dispatchEvent(new Event('input', { bubbles: true }))
          emailInput.dispatchEvent(new Event('change', { bubbles: true }))

          await new Promise(r => setTimeout(r, 500))

          nativeInputValueSetter.call(passInput, password)
          passInput.dispatchEvent(new Event('input', { bubbles: true }))
          passInput.dispatchEvent(new Event('change', { bubbles: true }))

          await new Promise(r => setTimeout(r, 500))

          // Find and click login button
          const loginBtn = document.querySelector('button[name="login"], button[type="submit"], button[data-testid="royal_login_button"], input[type="submit"][value*="Log" i], button[id="loginbutton"]')
          if (loginBtn) {
            loginBtn.click()
          } else {
            // Fallback: press Enter
            passInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
          }

          return { status: 'credentials_submitted' }
        } catch (e) {
          return { status: 'error', error: e.message }
        }
      },
      args: [credentials.email, credentials.password]
    })

    const result = loginResult?.[0]?.result
    if (!result) return { success: false, error: 'Login script returned no result' }

    if (result.status === 'already_logged_in') {
      console.log('[6AD] Already logged in after navigation!')
      await addActivity('success', 'FB session restored — already logged in')
      // Re-capture token
      await tryCaptureFBToken()
      return { success: true }
    }

    if (result.status === 'no_login_form') {
      return { success: false, error: result.error || 'Login form not found on page' }
    }

    if (result.status === 'error') {
      return { success: false, error: result.error || 'Error during login' }
    }

    // 4. Wait for page to load after login attempt
    console.log('[6AD] Credentials submitted, waiting for page load...')
    await new Promise(r => setTimeout(r, 8000))

    // 5. Check if we hit a checkpoint/2FA page
    const postLoginCheck = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      world: 'MAIN',
      func: () => {
        const url = window.location.href.toLowerCase()
        const bodyText = document.body?.innerText?.toLowerCase() || ''
        const html = document.documentElement.innerHTML.toLowerCase()

        // Check for checkpoint / 2FA
        if (url.includes('/checkpoint') || url.includes('/login/checkpoint')) {
          const needsCode = /enter the code|enter.*code|confirmation code|security code|verify.*code|we sent|code.*sent/i.test(bodyText)
          const isEmailOtp = /sent.*code.*email|email.*verification|sent.*to your email|sent.*code.*to.*@/i.test(bodyText)
          if (needsCode) {
            return { status: 'checkpoint_otp', isEmail: isEmailOtp }
          }
          return { status: 'checkpoint_other', bodyText: bodyText.substring(0, 300) }
        }

        // Check for wrong password
        if (/incorrect password|wrong password|password.*incorrect|password.*wrong|didn.?t match/i.test(bodyText)) {
          return { status: 'wrong_password' }
        }

        // Check if we're logged in now
        if (document.cookie.includes('c_user=') || window.__accessToken) {
          return { status: 'logged_in' }
        }

        // Check if still on login page
        if (url.includes('/login') || url.includes('login.php')) {
          return { status: 'still_login_page', bodyText: bodyText.substring(0, 300) }
        }

        // Assume logged in if we're on facebook.com main page
        return { status: 'likely_logged_in', url: url }
      }
    })

    const postResult = postLoginCheck?.[0]?.result
    if (!postResult) return { success: false, error: 'Post-login check returned no result' }

    console.log('[6AD] Post-login status:', postResult.status)

    // Handle different post-login states
    if (postResult.status === 'wrong_password') {
      await addActivity('error', 'Auto-login failed: wrong password — update credentials in admin settings')
      return { success: false, error: 'Wrong Facebook password — update in admin profile settings' }
    }

    if (postResult.status === 'checkpoint_otp') {
      console.log('[6AD] 2FA/OTP checkpoint detected')
      await addActivity('info', '2FA checkpoint detected — getting code...')

      const otpCode = await get2FACode()
      if (!otpCode) {
        const errorMsg = '2FA required but could not get code. Add twoFactorSecret (TOTP key) in admin profile settings.'
        await addActivity('error', errorMsg)
        return { success: false, error: errorMsg }
      }

      await addActivity('info', `2FA code: ${otpCode}`)
      console.log('[6AD] Using 2FA code:', otpCode)

      // Enter OTP code
      const otpEnterResult = await chrome.scripting.executeScript({
        target: { tabId: fbTab.id },
        world: 'MAIN',
        func: async (otp) => {
          try {
            // Find the OTP input
            const codeInput = document.querySelector('input[name="approvals_code"], input[type="tel"], input[placeholder*="code" i], input[aria-label*="code" i], input[name="code"]')
            if (!codeInput) {
              // Try any visible text input
              const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input:not([type])')
              for (const inp of inputs) {
                const rect = inp.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0 && inp.type !== 'hidden' && inp.name !== 'search') {
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
                  nativeInputValueSetter.call(inp, otp)
                  inp.dispatchEvent(new Event('input', { bubbles: true }))
                  inp.dispatchEvent(new Event('change', { bubbles: true }))

                  await new Promise(r => setTimeout(r, 500))

                  // Click continue/submit button
                  const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]')
                  for (const btn of buttons) {
                    const text = (btn.textContent?.trim().toLowerCase() || '') + ' ' + (btn.value?.toLowerCase() || '')
                    if (/continue|submit|confirm|next|verify|send/i.test(text)) {
                      const rect = btn.getBoundingClientRect()
                      if (rect.width > 0 && rect.height > 0) {
                        btn.click()
                        return { status: 'otp_submitted' }
                      }
                    }
                  }
                  // Fallback: Enter key
                  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
                  return { status: 'otp_submitted' }
                }
              }
              return { status: 'no_input', error: 'Could not find OTP input field' }
            }

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
            nativeInputValueSetter.call(codeInput, otp)
            codeInput.dispatchEvent(new Event('input', { bubbles: true }))
            codeInput.dispatchEvent(new Event('change', { bubbles: true }))

            await new Promise(r => setTimeout(r, 500))

            // Click continue/submit button
            const buttons = document.querySelectorAll('button, [role="button"], input[type="submit"]')
            for (const btn of buttons) {
              const text = (btn.textContent?.trim().toLowerCase() || '') + ' ' + (btn.value?.toLowerCase() || '')
              if (/continue|submit|confirm|next|verify|send/i.test(text)) {
                const rect = btn.getBoundingClientRect()
                if (rect.width > 0 && rect.height > 0) {
                  btn.click()
                  return { status: 'otp_submitted' }
                }
              }
            }
            // Fallback: Enter
            codeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
            return { status: 'otp_submitted' }
          } catch (e) {
            return { status: 'error', error: e.message }
          }
        },
        args: [otpCode]
      })

      const otpResult2 = otpEnterResult?.[0]?.result
      if (otpResult2?.status === 'no_input') {
        return { success: false, error: 'OTP received but could not find input field on checkpoint page' }
      }

      // Wait for checkpoint to resolve
      console.log('[6AD] OTP submitted, waiting for login to complete...')
      await new Promise(r => setTimeout(r, 8000))
    }

    if (postResult.status === 'checkpoint_other') {
      return { success: false, error: 'Facebook checkpoint detected that cannot be auto-handled. Manual intervention required.' }
    }

    // 6. Final check — are we logged in now?
    const finalCheck = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      world: 'MAIN',
      func: () => {
        return {
          hasCUser: document.cookie.includes('c_user='),
          hasToken: !!window.__accessToken,
          url: window.location.href
        }
      }
    })

    const final = finalCheck?.[0]?.result
    if (final?.hasCUser || final?.hasToken) {
      console.log('[6AD] Auto-login successful!')
      await addActivity('success', 'Auto-login to Facebook successful!')

      // Re-capture token
      await tryCaptureFBToken()
      await new Promise(r => setTimeout(r, 3000))

      // Navigate to business.facebook.com for better token access
      try {
        await chrome.tabs.update(fbTab.id, { url: 'https://business.facebook.com/' })
        await new Promise(r => setTimeout(r, 5000))
        await attachDebuggerToFBTabs()
        await tryCaptureFBToken()
      } catch (e) {
        console.log('[6AD] Post-login navigation warning:', e.message)
      }

      return { success: true }
    }

    return { success: false, error: 'Login completed but could not verify session. URL: ' + (final?.url || 'unknown') }
  } catch (e) {
    console.error('[6AD] Auto-login error:', e.message)
    return { success: false, error: 'Auto-login error: ' + e.message }
  }
}

async function checkAndProcessRecharges() {
  if (isProcessing) return
  isProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled) return

    // Validate FB session BEFORE attempting any recharges
    let session = await validateFbSession()
    if (!session.valid) {
      console.warn(`[6AD] FB session invalid: ${session.error} — attempting auto-login...`)
      await addActivity('warning', `FB session invalid: ${session.error}`)

      // Try auto-login
      const loginResult = await autoLoginFacebook()
      if (loginResult.success) {
        // Re-validate after login
        session = await validateFbSession()
        if (!session.valid) {
          const errorMsg = `Auto-login succeeded but session still invalid: ${session.error}`
          console.error(`[6AD] ${errorMsg}`)
          await addActivity('error', errorMsg)
          await failAllPendingRecharges(errorMsg)
          return
        }
      } else {
        const errorMsg = `Auto-login failed: ${loginResult.error}`
        console.error(`[6AD] ${errorMsg}`)
        await addActivity('error', errorMsg)
        await failAllPendingRecharges(errorMsg)
        return
      }
    }

    console.log(`[6AD] FB session valid (user: ${session.name || session.userId})`)

    const result = await apiRequest('/extension/pending-recharges', 'GET')
    const recharges = result.recharges || []

    for (const recharge of recharges) {
      await processRecharge(recharge)
    }
  } catch (err) {
    console.error('[6AD] Recharge check failed:', err.message)
    await addActivity('error', `Recharge check failed: ${err.message}`)
  } finally {
    isProcessing = false
  }
}

async function processRecharge(recharge) {
  // API returns: depositId, adAccountId, adAccountName, amount, approvedAt
  const depositId = recharge.depositId
  const accountId = recharge.adAccountId
  const depositAmount = parseFloat(recharge.amount)

  if (!depositId || !accountId || isNaN(depositAmount) || depositAmount <= 0) {
    console.error('[6AD] Invalid recharge data:', recharge)
    return
  }

  const MAX_ATTEMPTS = 2  // Only 1 retry to avoid FB suspicion
  const RETRY_DELAY_MS = 15000 // 15 seconds before retry — let page fully load
  let lastError = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt === 1) {
        await addActivity('info', `Claiming recharge for act_${accountId} ($${depositAmount})`)
        await apiRequest(`/extension/recharge/${depositId}/claim`, 'POST')
        // Wait 5s for page to be fully ready before making API calls
        await new Promise(r => setTimeout(r, 5000))
      } else {
        await addActivity('info', `Retrying recharge for act_${accountId} (page may not have been ready)`)
        console.log(`[6AD] Retry for act_${accountId}, waiting ${RETRY_DELAY_MS/1000}s for page to load...`)
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      }

      // Get access token — try page context first, fall back to stored debugger token
      let accessToken = null
      let tokenSource = 'none'
      try {
        const fbTab = await findFbTab()
        const ctx = await getFbPageContext(fbTab)
        accessToken = ctx.accessToken
        tokenSource = ctx.tokenSource
      } catch (ctxErr) {
        console.log('[6AD] Page context failed, trying stored token:', ctxErr.message)
      }

      // Fallback: use stored debugger token if page context failed
      if (!accessToken) {
        const config = await getConfig()
        if (config.fbAccessToken) {
          accessToken = config.fbAccessToken
          tokenSource = 'stored_debugger'
        }
      }

      if (!accessToken) {
        throw new Error('No access token available — open Facebook and browse around to capture a token')
      }
      console.log('[6AD] Got FB token for recharge via', tokenSource, ':', accessToken?.substring(0, 15) + '...')

      // Execute recharge — Graph API only needs access_token, no dtsg needed
      const fbTab = await findFbTab()
      const results = await chrome.scripting.executeScript({
        target: { tabId: fbTab.id },
        world: 'MAIN',
        func: async (accountId, accessToken, depositAmount) => {
          try {
            // Step 1: Get current spend cap
            const getUrl = `https://graph.facebook.com/v21.0/act_${accountId}?fields=spend_cap,amount_spent,name&access_token=${encodeURIComponent(accessToken)}`
            const getResp = await fetch(getUrl, { credentials: 'include' })
            const getText = await getResp.text()
            let accountData
            try {
              accountData = JSON.parse(getText)
            } catch {
              return { error: 'Invalid response from FB GET: ' + getText.substring(0, 200), retryable: true }
            }

            if (accountData.error) return { error: accountData.error.message || JSON.stringify(accountData.error), retryable: false }

            // FB GET returns spend_cap in CENTS (e.g. 10000 = $100)
            // FB POST expects spend_cap in DOLLARS (e.g. 250 = $250)
            const currentCapCents = parseInt(accountData.spend_cap || '0', 10)
            const spentCents = parseInt(accountData.amount_spent || '0', 10)
            const currentCapDollars = currentCapCents / 100
            const spentDollars = spentCents / 100
            // depositAmount is already in dollars
            const newCapDollars = currentCapDollars + depositAmount

            // Log raw values for debugging
            const debugInfo = `raw_spend_cap=${accountData.spend_cap}, currentCap=$${currentCapDollars}, deposit=$${depositAmount}, newCap=$${newCapDollars}`

            // Step 2: Set new spend cap (POST expects DOLLARS)
            const postResp = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              credentials: 'include',
              body: new URLSearchParams({
                spend_cap: newCapDollars.toString(),
                access_token: accessToken
              }).toString()
            })
            const postText = await postResp.text()
            let postData
            try {
              postData = JSON.parse(postText)
            } catch {
              return { error: 'Invalid response: ' + postText.substring(0, 200) + ' | ' + debugInfo, retryable: true }
            }
            if (postData.error) return { error: (postData.error.message || JSON.stringify(postData.error)) + ' | ' + debugInfo, retryable: false }

            return {
              success: true,
              debugInfo,
              currentCapDollars,
              spentDollars,
              newCapDollars
            }
          } catch (e) {
            // "Failed to fetch" and network errors are retryable
            return { error: e.message, retryable: true }
          }
        },
        args: [accountId, accessToken, depositAmount]
      })

      const result = results?.[0]?.result
      if (!result) throw new Error('Script injection returned no result')
      if (result.error) {
        // Check if error is retryable (network/transient) vs permanent (FB API error)
        const isRetryable = result.retryable || result.error.includes('Failed to fetch') || result.error.includes('NetworkError') || result.error.includes('Load failed')
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          console.log(`[6AD] Retryable error for act_${accountId}: ${result.error}`)
          lastError = result.error
          continue // retry once
        }
        throw new Error(result.error)
      }

      await addActivity('info', `act_${accountId}: ${result.debugInfo || ''} | cap $${result.currentCapDollars} → $${result.newCapDollars}`)

      await apiRequest(`/extension/recharge/${depositId}/complete`, 'POST', {
        previousSpendCap: result.currentCapDollars,
        newSpendCap: result.newCapDollars
      })

      await addActivity('success', `Recharged act_${accountId} +$${depositAmount.toFixed(2)} (new cap: $${result.newCapDollars.toFixed(2)})`)
      console.log(`[6AD] Successfully recharged act_${accountId}`)
      return // success — exit the retry loop

    } catch (err) {
      lastError = err.message
      // Check if this is a retryable error
      const isRetryable = err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed') || err.message.includes('No Facebook tab') || err.message.includes('Script injection returned no result')
      if (isRetryable && attempt < MAX_ATTEMPTS) {
        console.log(`[6AD] Retryable error (attempt ${attempt}/${MAX_ATTEMPTS}) for act_${accountId}: ${err.message}`)
        continue // retry
      }

      // Final failure — report it
      console.error(`[6AD] Recharge failed for act_${accountId} after ${attempt} attempt(s):`, err.message)
      await addActivity('error', `Recharge failed for act_${accountId}: ${err.message}`)

      try {
        await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', {
          error: err.message
        })
      } catch (reportErr) {
        console.error('[6AD] Failed to report failure:', reportErr.message)
      }
      return // give up
    }
  }

  // Should not reach here, but just in case all attempts exhausted
  console.error(`[6AD] Recharge failed for act_${accountId} after ${MAX_ATTEMPTS} attempts:`, lastError)
  await addActivity('error', `Recharge failed for act_${accountId} after ${MAX_ATTEMPTS} attempts: ${lastError}`)
  try {
    await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', {
      error: `Failed after ${MAX_ATTEMPTS} attempts: ${lastError}`
    })
  } catch (reportErr) {
    console.error('[6AD] Failed to report failure:', reportErr.message)
  }
}

// ==================== BM SHARE PROCESSING ====================

let isBmShareProcessing = false

async function checkAndProcessBmShares() {
  if (isBmShareProcessing) return
  isBmShareProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled || !config.fbAccessToken) {
      console.log('[6AD] BM share check skipped:', !config.apiKey ? 'no key' : !config.isEnabled ? 'disabled' : 'no token')
      return
    }

    await addActivity('info', 'Checking for pending BM shares...')
    const result = await apiRequest('/extension/pending-bm-shares', 'GET')
    const bmShares = result.bmShares || []
    console.log('[6AD] Found', bmShares.length, 'pending BM shares')

    if (bmShares.length === 0) {
      await addActivity('info', 'No pending BM shares')
      return
    }

    await addActivity('info', `Found ${bmShares.length} pending BM share(s)`)
    for (const share of bmShares) {
      await processBmShare(share)
    }
  } catch (err) {
    console.error('[6AD] BM share check failed:', err.message)
    await addActivity('error', `BM share check failed: ${err.message}`)
  } finally {
    isBmShareProcessing = false
  }
}

/**
 * Extract Facebook page context tokens (__accessToken, fb_dtsg, __user, lsd)
 * This is how extensions like SMIT work — they read tokens from the page's JS runtime
 * instead of using the public Graph API.
 */
async function getFbPageContext(tab) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => {
      try {
        const ctx = {}
        const html = document.documentElement.innerHTML

        // 1. __accessToken — Facebook stores the current user's access token here
        if (window.__accessToken) {
          ctx.accessToken = window.__accessToken
          ctx.tokenSource = '__accessToken'
        }

        // 1b. Fallback: search HTML for EAA tokens (works in AdsPower/anti-detect browsers)
        if (!ctx.accessToken) {
          const tokens = []
          const regex = /["']?(EAA[a-zA-Z0-9]{40,})["']?/g
          let m
          while ((m = regex.exec(html)) !== null) {
            tokens.push(m[1])
          }
          if (tokens.length > 0) {
            tokens.sort((a, b) => b.length - a.length)
            ctx.accessToken = tokens[0]
            ctx.tokenSource = 'html_scan'
          }
        }

        // 1c. Fallback: Try Facebook's require system
        if (!ctx.accessToken && typeof require === 'function') {
          try {
            const mod = require('CurrentAccessToken')
            if (mod && mod.getToken) {
              ctx.accessToken = mod.getToken()
              ctx.tokenSource = 'require'
            }
          } catch(e) {}
        }

        // 2. fb_dtsg — CSRF token
        let m = html.match(/"DTSGInitialData".*?"token":"([^"]+)"/)
        if (m) { ctx.dtsg = m[1] }
        else {
          const input = document.querySelector('input[name="fb_dtsg"]')
          if (input) { ctx.dtsg = input.value }
          else {
            m = html.match(/"token":"(AQ[A-Za-z0-9_-]+)"/)
            if (m) ctx.dtsg = m[1]
          }
        }

        // 3. __user — current user ID
        m = html.match(/"USER_ID":"(\d+)"/)
        if (m) { ctx.userId = m[1] }
        else {
          const m2 = html.match(/"CurrentUserInitialData".*?"USER_ID":"(\d+)"/)
          if (m2) ctx.userId = m2[1]
        }
        // Fallback: cookie
        if (!ctx.userId) {
          const cUser = document.cookie.match(/c_user=(\d+)/)
          if (cUser) ctx.userId = cUser[1]
        }

        // 4. lsd token
        m = html.match(/"LSD".*?"token":"([^"]+)"/)
        if (m) ctx.lsd = m[1]

        return ctx
      } catch (e) {
        return { error: e.message }
      }
    }
  })

  const ctx = results?.[0]?.result
  if (!ctx || ctx.error) {
    throw new Error(ctx?.error || 'Failed to extract Facebook page context')
  }

  // If still no accessToken from page, use the one we captured via debugger
  if (!ctx.accessToken) {
    const config = await getConfig()
    if (config.fbAccessToken) {
      ctx.accessToken = config.fbAccessToken
      ctx.tokenSource = 'stored_debugger'
      console.log('[6AD] Using stored debugger token as fallback (page had no __accessToken)')
    }
  }

  if (!ctx.accessToken) {
    throw new Error('No access token found — open Facebook and browse around to capture a token')
  }
  if (!ctx.dtsg) {
    throw new Error('Could not find fb_dtsg on page — try refreshing the Facebook page')
  }

  console.log(`[6AD] Page context: token via ${ctx.tokenSource}, dtsg=${ctx.dtsg?.substring(0, 8)}..., user=${ctx.userId}`)
  return ctx
}

/**
 * Find a Facebook tab, preferring business.facebook.com
 */
async function findFbTab() {
  const tabs = await chrome.tabs.query({
    url: ['https://business.facebook.com/*', 'https://www.facebook.com/*', 'https://adsmanager.facebook.com/*']
  })
  if (tabs.length === 0) {
    throw new Error('No Facebook tab open — open business.facebook.com or adsmanager.facebook.com first')
  }
  // Filter out login/redirect pages that don't have valid tokens
  const validTabs = tabs.filter(t => t.url && !t.url.includes('/loginpage') && !t.url.includes('/login') && !t.url.includes('login.php'))
  const searchTabs = validTabs.length > 0 ? validTabs : tabs

  // Prefer adsmanager > business.facebook.com > www.facebook.com
  const adsTab = searchTabs.find(t => t.url && t.url.includes('adsmanager.facebook.com'))
  if (adsTab) return adsTab
  const bizTab = searchTabs.find(t => t.url && t.url.includes('business.facebook.com'))
  if (bizTab) return bizTab
  return searchTabs[0]
}

async function processBmShare(share) {
  const requestId = share.requestId
  const accountId = share.adAccountId
  const userBmId = share.userBmId
  const ownerBmId = share.ownerBmId  // The BM that owns this ad account
  const username = share.username

  if (!requestId || !accountId || !userBmId) {
    console.error('[6AD] Invalid BM share data:', share)
    return
  }

  try {
    await addActivity('info', `Claiming BM share: act_${accountId} → BM ${userBmId} (${username})${ownerBmId ? ` [owner BM: ${ownerBmId}]` : ''}`)
    await apiRequest(`/extension/bm-share/${requestId}/claim`, 'POST')

    const fbTab = await findFbTab()
    const ctx = await getFbPageContext(fbTab)
    console.log('[6AD] Got FB page context for BM share — token:', ctx.accessToken?.substring(0, 15) + '...')

    // Execute BM share from the page context using Facebook's Graph API
    // The logged-in user is the OWNER of the ad account.
    // We try multiple approaches to share the ad account to the user's BM:
    //
    // Method 1: POST /act_{id}/agencies — owner assigns partner BM to their ad account
    // Method 2: POST /{ownerBmId}/client_ad_accounts — owner's BM adds ad account as client for partner
    // Method 3: POST /{userBmId}/client_ad_accounts — direct assignment (needs MANAGE_AD_ACCOUNTS)
    const shareResults = await chrome.scripting.executeScript({
      target: { tabId: fbTab.id },
      world: 'MAIN',
      func: async (userBmId, adAccountId, ownerBmId, accessToken) => {
        const graphBase = 'https://graph.facebook.com/v21.0'
        const errors = []

        // Helper to try a Graph API call
        async function tryMethod(name, url, params) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              credentials: 'include',
              body: new URLSearchParams({
                ...params,
                access_token: accessToken,
              }).toString()
            })
            const text = await resp.text()
            try {
              const data = JSON.parse(text)
              if (data.error) {
                errors.push(`${name}: ${data.error.message} (code ${data.error.code})`)
                return null
              }
              return { success: true, data, method: name }
            } catch {
              errors.push(`${name}: non-JSON response: ${text.substring(0, 100)}`)
              return null
            }
          } catch (e) {
            errors.push(`${name}: ${e.message}`)
            return null
          }
        }

        // Default permission: ADVERTISE = "Manage campaigns (ads)" + ANALYZE = "View performance"
        const defaultTasks = ['ADVERTISE', 'ANALYZE']

        // Method 1: POST /act_{id}/agencies — Add partner BM as agency on the ad account
        // This is what happens when owner says "share this ad account with partner BM"
        let result = await tryMethod(
          'agencies',
          `${graphBase}/act_${adAccountId}/agencies`,
          {
            business: userBmId,
            permitted_tasks: JSON.stringify(defaultTasks),
          }
        )
        if (result) return result

        // Method 2: If we know the owner's BM, try adding as client_ad_accounts from owner's BM
        if (ownerBmId) {
          result = await tryMethod(
            'owner_client_ad_accounts',
            `${graphBase}/${ownerBmId}/client_ad_accounts`,
            {
              adaccount_id: `act_${adAccountId}`,
              permitted_tasks: JSON.stringify(defaultTasks),
            }
          )
          if (result) return result
        }

        // Method 3: POST /{userBmId}/client_ad_accounts — try direct assignment
        result = await tryMethod(
          'user_client_ad_accounts',
          `${graphBase}/${userBmId}/client_ad_accounts`,
          {
            adaccount_id: `act_${adAccountId}`,
            permitted_tasks: JSON.stringify(defaultTasks),
          }
        )
        if (result) return result

        // Method 4: POST /act_{id}/assigned_users — share to individual business user
        // (fallback, may not work for BM sharing)
        result = await tryMethod(
          'assigned_users',
          `${graphBase}/act_${adAccountId}/assigned_users`,
          {
            business: userBmId,
            tasks: JSON.stringify(defaultTasks),
          }
        )
        if (result) return result

        return { error: errors.join(' | ') }
      },
      args: [userBmId, accountId, ownerBmId || '', ctx.accessToken]
    })

    const result = shareResults?.[0]?.result
    if (!result) throw new Error('Script injection returned no result')
    if (result.error) throw new Error(result.error)

    // Success!
    await apiRequest(`/extension/bm-share/${requestId}/complete`, 'POST')
    await addActivity('success', `BM shared: act_${accountId} → BM ${userBmId} (${username}) [${result.method}]`)
    console.log(`[6AD] Successfully shared act_${accountId} to BM ${userBmId} via ${result.method}`)

  } catch (err) {
    console.error(`[6AD] BM share failed for act_${accountId}:`, err.message)
    await addActivity('error', `BM share failed for act_${accountId}: ${err.message}`)

    try {
      await apiRequest(`/extension/bm-share/${requestId}/failed`, 'POST', {
        error: err.message
      })
    } catch (reportErr) {
      console.error('[6AD] Failed to report BM share failure:', reportErr.message)
    }
  }
}

// ==================== ALARM SETUP ====================

chrome.alarms.create(HEARTBEAT_ALARM, {
  periodInMinutes: POLL_INTERVAL_SECONDS / 60
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    const config = await getConfig()
    if (config.isEnabled && config.apiKey) {
      await sendHeartbeat()
    }
  }
})

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FB_TOKEN_CAPTURED') {
    handleTokenCapture(message.token)
    sendResponse({ received: true })
  } else if (message.type === 'GET_STATUS') {
    handleGetStatus().then(sendResponse)
    return true
  } else if (message.type === 'SAVE_CONFIG') {
    handleSaveConfig(message.config).then(sendResponse)
    return true
  } else if (message.type === 'TOGGLE_ENABLED') {
    handleToggle(message.enabled).then(sendResponse)
    return true
  } else if (message.type === 'FORCE_HEARTBEAT') {
    sendHeartbeat().then(() => sendResponse({ done: true }))
    return true
  } else if (message.type === 'COPY_TOKEN') {
    getConfig().then(config => sendResponse({ token: config.fbAccessToken || '' }))
    return true
  }
})

async function handleTokenCapture(token) {
  const config = await getConfig()
  if (token !== config.fbAccessToken) {
    await updateConfig({ fbAccessToken: token })
    await addActivity('success', `Token saved (len=${token.length}, ${token.substring(0, 15)}...)`)
    console.log('[6AD] New FB token stored, length:', token.length)

    // Trigger a heartbeat to send token to server immediately
    setTimeout(sendHeartbeat, 2000)
  }
}

async function handleGetStatus() {
  const config = await getConfig()
  return {
    apiKey: config.apiKey ? `${config.apiKey.substring(0, 12)}...` : '',
    apiKeySet: !!config.apiKey,
    apiUrl: config.apiUrl,
    fbAccessToken: config.fbAccessToken ? `${config.fbAccessToken.substring(0, 12)}...` : '',
    hasFbToken: !!config.fbAccessToken,
    fbUserId: config.fbUserId,
    fbUserName: config.fbUserName,
    adAccountIds: config.adAccountIds,
    isEnabled: config.isEnabled,
    lastHeartbeat: config.lastHeartbeat,
    lastError: config.lastError,
    recentActivity: (config.recentActivity || []).slice(0, 20)
  }
}

async function handleSaveConfig(newConfig) {
  const updates = {}
  if (newConfig.apiKey !== undefined) updates.apiKey = newConfig.apiKey
  if (newConfig.apiUrl !== undefined) updates.apiUrl = newConfig.apiUrl || DEFAULT_API_URL
  if (newConfig.fbAccessToken !== undefined) {
    updates.fbAccessToken = newConfig.fbAccessToken
    await addActivity('success', `Manual token set (len=${newConfig.fbAccessToken.length})`)
  }

  await updateConfig(updates)
  await addActivity('info', 'Configuration updated')

  setTimeout(sendHeartbeat, 1000)

  return { saved: true }
}

async function handleToggle(enabled) {
  await updateConfig({ isEnabled: enabled })
  await addActivity('info', enabled ? 'Extension enabled' : 'Extension disabled')

  if (enabled) {
    setTimeout(sendHeartbeat, 500)
  }

  return { enabled }
}

// ==================== TAB LISTENER ====================
// Auto-attach debugger when navigating to Facebook

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isFacebookUrl(tab.url)) {
    if (!attachedTabIds.has(tabId)) {
      try {
        await chrome.debugger.attach({ tabId }, '1.3')
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
        attachedTabIds.add(tabId)
        console.log('[6AD] Auto-attached debugger to FB tab', tabId, tab.url)
        await addActivity('info', `Debugger auto-attached to ${new URL(tab.url).hostname}`)
      } catch (err) {
        console.log('[6AD] Auto-attach failed:', err.message)
      }
    }

    // Also try script injection capture after a delay (let page JS load)
    const config = await getConfig()
    if (!config.fbAccessToken) {
      setTimeout(() => tryCaptureFBToken(), 5000)
    }
  }
})

// ==================== STARTUP ====================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[6AD] Extension installed/updated')
  addActivity('info', 'Extension installed/updated')
  // Immediately try to attach to any open FB tabs
  attachDebuggerToFBTabs()
})

setTimeout(async () => {
  const config = await getConfig()
  // Always attach debugger on startup
  await attachDebuggerToFBTabs()
  if (config.apiKey && config.isEnabled) {
    await sendHeartbeat()
  }
}, 3000)

console.log('[6AD] Background service worker loaded')
