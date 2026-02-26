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

// ==================== TOKEN ERROR DETECTION ====================

function isTokenError(errorMessage) {
  if (!errorMessage) return false
  const msg = errorMessage.toLowerCase()
  return (
    msg.includes('error validating access token') ||
    msg.includes('malformed access token') ||
    msg.includes('invalid oauth 2.0 access token') ||
    msg.includes('the access token could not be decrypted') ||
    msg.includes('session has expired') ||
    msg.includes('session is invalid') ||
    /code[:\s]*190/.test(msg) ||
    /oauthexception.*190/.test(msg)
  )
}

function isFbTokenError(responseData) {
  if (!responseData?.error?.message) return false
  if (responseData.error.code === 190) return true
  return isTokenError(responseData.error.message)
}

// ==================== DIRECT GRAPH API (SERVICE WORKER) ====================

/**
 * Make a Graph API request directly from the service worker.
 * Graph API only needs access_token param — no cookies required.
 * Works even when no tabs are open.
 */
async function fbGraphFetch(path, accessToken, options = {}) {
  const method = options.method || 'GET'
  const baseUrl = `https://graph.facebook.com${path}`

  let url, fetchOptions

  if (method === 'GET') {
    const params = new URLSearchParams(options.params || {})
    params.set('access_token', accessToken)
    url = `${baseUrl}?${params.toString()}`
    fetchOptions = { method: 'GET' }
  } else {
    url = baseUrl
    const body = new URLSearchParams(options.params || {})
    body.set('access_token', accessToken)
    fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    }
  }

  const resp = await fetch(url, fetchOptions)
  const text = await resp.text()

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON from Facebook: ' + text.substring(0, 200))
  }

  return data
}

// ==================== TOKEN CAPTURE ====================
// Primary method: Extract __accessToken from Facebook page's JS runtime via chrome.scripting
// Backup: Debugger intercepts network requests for EAA tokens

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

              // 2. Fallback: Try Facebook's require system
              if (!result.token && typeof require === 'function') {
                try {
                  const mod = require('CurrentAccessToken')
                  if (mod && mod.getToken) {
                    result.token = mod.getToken()
                    result.source = 'require'
                  }
                } catch(e) {}
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
        if (result && result.token && result.token.startsWith('EAA') && result.token.length >= 40) {
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

function isAdsCheckUrl(url) {
  return url && (url.includes('localhost:3004') || url.includes('ads-check.6ad.in'))
}

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

    // Check Authorization header
    const authHeader = headers['Authorization'] || headers['authorization'] || ''
    if (authHeader.includes('EAA')) {
      const authMatch = authHeader.match(/EAA[a-zA-Z0-9]{20,}/)
      if (authMatch) {
        validateAndSaveToken(authMatch[0], 'auth_header')
        return
      }
    }

    // Extract token from URL or POST body (access_token= parameter only)
    const tokenRegex = /access_token=(EAA[a-zA-Z0-9%_.-]+)/

    const urlMatch = url.match(tokenRegex)
    if (urlMatch) {
      try {
        const token = decodeURIComponent(urlMatch[1])
        validateAndSaveToken(token, 'access_token_param')
      } catch { validateAndSaveToken(urlMatch[1], 'access_token_param') }
      return
    }

    const bodyMatch = postData.match(tokenRegex)
    if (bodyMatch) {
      try {
        const token = decodeURIComponent(bodyMatch[1])
        validateAndSaveToken(token, 'access_token_param')
      } catch { validateAndSaveToken(bodyMatch[1], 'access_token_param') }
      return
    }

    // Removed: broad fallback regex and response body scanning
    // These were capturing binary/encoded data from CSS/JS bundles that matched EAA pattern
  }
})

// Token collection — Facebook pages emit many different EAA tokens.
// We collect them over a short window and pick the best one from trusted sources.
let collectedTokens = [] // { token, source } objects
// tokenCollectionTimer removed — using chrome.alarms('6ad-token-debounce') for MV3 safety
let savedTokenSet = new Set() // Avoid re-processing tokens we already saved

async function validateAndSaveToken(token, source) {
  if (!token || token.indexOf('EAA') !== 0 || token.length < 20) return
  // Skip very short tokens (likely app tokens, not user tokens)
  if (token.length < 40) return
  // Reject garbage: real FB tokens are strictly alphanumeric (a-z, A-Z, 0-9)
  if (!/^EAA[a-zA-Z0-9]+$/.test(token)) {
    console.log('[6AD] Rejecting token with non-alphanumeric chars (length:', token.length, ')')
    return
  }
  // Reject suspiciously long tokens — real FB tokens are ~150-250 chars
  if (token.length > 500) {
    console.log('[6AD] Rejecting suspiciously long token (length:', token.length, ')')
    return
  }
  // Skip tokens we've already processed
  if (savedTokenSet.has(token)) return

  console.log('[6AD] EAA token seen (length:', token.length, ', source:', source || 'unknown', ')')
  collectedTokens.push({ token, source: source || 'unknown' })

  // Debounce — wait 3 seconds after last token, then pick the best one
  // Use chrome.alarms for MV3 safety (setTimeout may not fire if SW goes idle)
  chrome.alarms.create('6ad-token-debounce', { delayInMinutes: 0.05 }) // ~3 seconds
}

async function pickBestToken() {
  if (collectedTokens.length === 0) return

  // Source priority: access_token param > auth header > __accessToken > html
  const sourcePriority = { 'access_token_param': 1, 'auth_header': 2, '__accessToken': 3, 'html': 4, 'unknown': 5 }

  // Sort by source priority first, then by length (longer = better within same priority)
  const sorted = [...collectedTokens].sort((a, b) => {
    const pa = sourcePriority[a.source] || 5
    const pb = sourcePriority[b.source] || 5
    if (pa !== pb) return pa - pb
    return b.token.length - a.token.length
  })

  // Mark all collected tokens as processed
  for (const t of collectedTokens) {
    savedTokenSet.add(t.token)
  }
  collectedTokens = []

  // Try each candidate — validate with /me API before accepting
  let bestToken = null
  for (const candidate of sorted) {
    const config = await getConfig()
    if (candidate.token === config.fbAccessToken) return // Already have this one

    // Quick validation: call /me to check if token actually works
    try {
      const resp = await fetch(`https://graph.facebook.com/me?access_token=${encodeURIComponent(candidate.token)}`)
      const data = await resp.json()
      if (data.id) {
        bestToken = candidate.token
        console.log('[6AD] Token validated via /me API (user:', data.id, ', source:', candidate.source, ', length:', candidate.token.length, ')')
        break
      } else {
        console.log('[6AD] Token failed /me validation (source:', candidate.source, ', length:', candidate.token.length, ', error:', data.error?.message?.substring(0, 80) || 'unknown', ')')
      }
    } catch (e) {
      console.log('[6AD] Token /me validation error:', e.message, '(source:', candidate.source, ')')
    }
  }

  if (!bestToken) {
    console.log('[6AD] No valid token found from', sorted.length, 'candidates')
    return
  }

  console.log('[6AD] Best token selected (length:', bestToken.length, 'from', sorted.length, 'candidates)')
  await handleTokenCapture(bestToken, true) // skipValidation=true — already validated via /me above

  // Get user info from cookies instead of Graph API
  try {
    const currentConfig = await getConfig()
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' })
    const cUser = cookies.find(c => c.name === 'c_user')
    if (cUser) {
      const updates = {}
      if (cUser.value !== currentConfig.fbUserId) {
        updates.fbUserId = cUser.value
      }
      if (!currentConfig.fbUserName || currentConfig.fbUserName === 'Not connected') {
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

// ==================== TOKEN RECAPTURE ====================

/**
 * Recapture a fresh Facebook access token when the stored one is bad/expired.
 * Does NOT open new tabs — only checks existing FB tabs.
 * If no token found, returns null so server can handle login via CDP.
 */
async function recaptureToken() {
  console.log('[6AD] recaptureToken: checking existing FB tabs for token...')

  try {
    // Step 1: Check existing FB tabs for __accessToken (don't open new tabs)
    const tabs = await chrome.tabs.query({
      url: ['https://www.facebook.com/*', 'https://business.facebook.com/*', 'https://adsmanager.facebook.com/*']
    })

    if (tabs.length === 0) {
      console.log('[6AD] recaptureToken: no FB tabs open — returning null, server will handle')
      return null
    }

    // Prefer www.facebook.com tabs (where __accessToken exists)
    const sorted = [...tabs].sort((a, b) => {
      const aWww = a.url?.includes('www.facebook.com') ? 0 : 1
      const bWww = b.url?.includes('www.facebook.com') ? 0 : 1
      return aWww - bWww
    })

    for (const tab of sorted) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => {
            const loggedIn = !!window.__accessToken || document.cookie.includes('c_user=')
            let token = null
            if (window.__accessToken) token = window.__accessToken
            if (!token && typeof require === 'function') {
              try {
                const mod = require('CurrentAccessToken')
                if (mod && mod.getToken) token = mod.getToken()
              } catch(e) {}
            }
            return { token, loggedIn }
          }
        })
        const result = results?.[0]?.result

        // If FB is logged out → bail immediately
        if (!result?.loggedIn) {
          console.log('[6AD] recaptureToken: FB is LOGGED OUT — returning null, server will login via CDP')
          await addActivity('warning', 'FB logged out — server will handle login')
          return null
        }

        // If we got a token, validate it
        const token = result?.token
        if (token && token.startsWith('EAA') && token.length >= 40 && /^EAA[a-zA-Z0-9]+$/.test(token)) {
          const meData = await fbGraphFetch('/v21.0/me', token, { params: { fields: 'id,name' } })
          if (meData.id) {
            console.log('[6AD] recaptureToken: token validated! User:', meData.name)
            await handleTokenCapture(token, true)
            return token
          } else {
            console.log('[6AD] recaptureToken: token failed /me:', meData.error?.message)
          }
        }
      } catch (e) {
        console.log('[6AD] recaptureToken: tab', tab.id, 'failed:', e.message)
      }
    }

    // Logged in but no __accessToken from any tab — token may come via debugger later
    console.log('[6AD] recaptureToken: FB logged in but no __accessToken found — waiting for debugger capture')
    return null

  } catch (err) {
    console.error('[6AD] recaptureToken error:', err.message)
    return null
  }
}

// ==================== AD ACCOUNT DISCOVERY ====================

async function discoverAdAccounts() {
  try {
    const config = await getConfig()
    if (!config.fbAccessToken) return config.adAccountIds || []

    // Direct fetch from service worker — no tab needed
    try {
      const data = await fbGraphFetch('/v21.0/me/adaccounts', config.fbAccessToken, {
        params: { fields: 'account_id,name', limit: '200' }
      })

      if (data.error) {
        console.log('[6AD] Ad account discovery failed:', data.error.message)
        return config.adAccountIds || []
      }

      const accounts = (data.data || []).map(a => a.account_id)
      const updates = { adAccountIds: accounts }

      // Also get user info
      try {
        const meData = await fbGraphFetch('/v21.0/me', config.fbAccessToken, {
          params: { fields: 'id,name' }
        })
        if (meData.name) updates.fbUserName = meData.name
        if (meData.id) updates.fbUserId = meData.id
      } catch {}

      await updateConfig(updates)
      console.log(`[6AD] Discovered ${accounts.length} ad accounts, user: ${updates.fbUserName || 'unknown'}`)
      return accounts
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
/**
 * Validate FB session by checking stored token via direct /me API call.
 * No tab required — works even when all tabs are closed.
 */
async function validateFbSession() {
  try {
    const config = await getConfig()
    if (!config.fbAccessToken) {
      return { valid: false, error: 'No Facebook access token stored', tokenMissing: true }
    }

    // Direct fetch to Graph API from service worker — no tab needed
    try {
      const data = await fbGraphFetch('/v21.0/me', config.fbAccessToken, {
        params: { fields: 'id,name' }
      })

      if (data.error) {
        return {
          valid: false,
          error: data.error.message || 'Token validation failed',
          isTokenError: isFbTokenError(data)
        }
      }

      return { valid: true, userId: data.id, name: data.name }
    } catch (e) {
      return { valid: false, error: 'Network error validating token: ' + e.message }
    }
  } catch (e) {
    return { valid: false, error: 'Session check failed: ' + e.message }
  }
}

// failAllPendingRecharges REMOVED — it claimed deposits just to fail them,
// preventing server-side fallback from handling them. Deposits now stay PENDING
// so either the extension (next cycle) or server can process them.

// Auto-login (get2FACode + autoLoginFacebook) REMOVED — login is handled by
// adspower-worker on the server side. Extension only captures tokens and does recharges.

// [autoLoginFacebook body deleted — ~470 lines of login form filling, 2FA, etc.]
// The adspower-worker handles login. Extension only captures tokens.
async function checkAndProcessRecharges() {
  if (isProcessing) return
  isProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled) return

    // Validate FB session (tab-independent — uses direct fetch)
    let session = await validateFbSession()

    if (!session.valid) {
      console.warn(`[6AD] FB session invalid: ${session.error}`)
      await addActivity('warning', `FB session invalid: ${session.error}`)

      // If token error or missing → try recapture (opens FB tab, reads __accessToken)
      if (session.isTokenError || session.tokenMissing) {
        console.log('[6AD] Attempting token recapture...')
        const newToken = await recaptureToken()
        if (newToken) {
          session = await validateFbSession()
        }
      }

      // If still invalid after recapture → skip and let server handle
      if (!session.valid) {
        console.log('[6AD] Token recapture failed — skipping, deposits stay PENDING for server')
        await addActivity('warning', 'No valid token after recapture — skipping, server will retry')
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
  const depositId = recharge.depositId
  const accountId = recharge.adAccountId
  const depositAmount = parseFloat(recharge.amount)

  if (!depositId || !accountId || isNaN(depositAmount) || depositAmount <= 0) {
    console.error('[6AD] Invalid recharge data:', recharge)
    return
  }

  const MAX_ATTEMPTS = 3
  const RETRY_DELAY_MS = 10000
  let lastError = null
  let claimed = false

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        await addActivity('info', `Retrying recharge for act_${accountId} (attempt ${attempt}/${MAX_ATTEMPTS})`)
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      }

      // FIRST: Verify we have a valid token BEFORE claiming
      let config = await getConfig()
      let accessToken = config.fbAccessToken

      if (!accessToken) {
        console.log('[6AD] No token stored, attempting recapture...')
        accessToken = await recaptureToken()
        if (!accessToken) {
          if (!claimed) {
            // Don't claim — deposit stays PENDING for server to handle
            console.log(`[6AD] No token for recharge act_${accountId} — skipping, deposit stays PENDING`)
            await addActivity('warning', `No token for act_${accountId} — skipping, server will retry`)
            return
          }
          throw new Error('No access token available — recapture failed')
        }
      }

      // NOW safe to claim (we have a token)
      if (!claimed) {
        await addActivity('info', `Claiming recharge for act_${accountId} ($${depositAmount})`)
        await apiRequest(`/extension/recharge/${depositId}/claim`, 'POST')
        claimed = true
      }

      console.log('[6AD] Using token for recharge (len:', accessToken.length, '):', accessToken.substring(0, 15) + '...')

      // Step 1: GET current spend cap — direct fetch from service worker (no tab needed)
      const accountData = await fbGraphFetch(`/v21.0/act_${accountId}`, accessToken, {
        params: { fields: 'spend_cap,amount_spent,name' }
      })

      if (accountData.error) {
        // Token error → recapture and retry
        if (isFbTokenError(accountData) && attempt < MAX_ATTEMPTS) {
          console.log(`[6AD] Token error on GET for act_${accountId}: ${accountData.error.message} — recapturing...`)
          await addActivity('warning', `Token error: ${accountData.error.message} — recapturing...`)
          // Clear bad token
          await updateConfig({ fbAccessToken: '' })
          const newToken = await recaptureToken()
          if (newToken) {
            lastError = accountData.error.message
            continue // retry with new token
          }
        }
        throw new Error(accountData.error.message || JSON.stringify(accountData.error))
      }

      // FB GET returns spend_cap in CENTS, POST expects DOLLARS
      const currentCapCents = parseInt(accountData.spend_cap || '0', 10)
      const spentCents = parseInt(accountData.amount_spent || '0', 10)
      const currentCapDollars = currentCapCents / 100
      const spentDollars = spentCents / 100
      const newCapDollars = currentCapDollars + depositAmount
      const debugInfo = `raw_spend_cap=${accountData.spend_cap}, currentCap=$${currentCapDollars}, deposit=$${depositAmount}, newCap=$${newCapDollars}`

      // Step 2: POST new spend cap — direct fetch from service worker
      const postData = await fbGraphFetch(`/v21.0/act_${accountId}`, accessToken, {
        method: 'POST',
        params: { spend_cap: newCapDollars.toString() }
      })

      if (postData.error) {
        if (isFbTokenError(postData) && attempt < MAX_ATTEMPTS) {
          console.log(`[6AD] Token error on POST for act_${accountId}: ${postData.error.message} — recapturing...`)
          await updateConfig({ fbAccessToken: '' })
          const newToken = await recaptureToken()
          if (newToken) { lastError = postData.error.message; continue }
        }
        throw new Error((postData.error.message || JSON.stringify(postData.error)) + ' | ' + debugInfo)
      }

      // Success!
      await addActivity('info', `act_${accountId}: ${debugInfo} | cap $${currentCapDollars} → $${newCapDollars}`)

      await apiRequest(`/extension/recharge/${depositId}/complete`, 'POST', {
        previousSpendCap: currentCapDollars,
        newSpendCap: newCapDollars
      })

      await addActivity('success', `Recharged act_${accountId} +$${depositAmount.toFixed(2)} (new cap: $${newCapDollars.toFixed(2)})`)
      console.log(`[6AD] Successfully recharged act_${accountId}`)
      return // success

    } catch (err) {
      lastError = err.message
      const isNetworkErr = err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed')
      const isTokenErr = isTokenError(err.message)

      if (attempt < MAX_ATTEMPTS) {
        if (isTokenErr) {
          console.log(`[6AD] Token error (attempt ${attempt}/${MAX_ATTEMPTS}) for act_${accountId}: ${err.message}`)
          await updateConfig({ fbAccessToken: '' })
          await recaptureToken()
          continue
        }
        if (isNetworkErr) {
          console.log(`[6AD] Network error (attempt ${attempt}/${MAX_ATTEMPTS}) for act_${accountId}: ${err.message}`)
          continue
        }
      }

      // Final failure
      console.error(`[6AD] Recharge failed for act_${accountId} after ${attempt} attempt(s):`, err.message)
      await addActivity('error', `Recharge failed for act_${accountId}: ${err.message}`)

      try {
        await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', { error: err.message })
      } catch (reportErr) {
        console.error('[6AD] Failed to report failure:', reportErr.message)
      }
      return
    }
  }

  // All attempts exhausted
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
    if (!config.apiKey || !config.isEnabled) {
      console.log('[6AD] BM share check skipped:', !config.apiKey ? 'no key' : 'disabled')
      return
    }

    if (!config.fbAccessToken) {
      console.log('[6AD] No token for BM shares, attempting recapture...')
      const newToken = await recaptureToken()
      if (!newToken) {
        console.log('[6AD] BM share check skipped: no token and recapture failed')
        return
      }
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

// getFbPageContext() removed — processRecharge and processBmShare now use
// fbGraphFetch() directly from the service worker (no tab needed)

/**
 * Find a Facebook tab, preferring www.facebook.com (where __accessToken exists)
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

  // Prefer www.facebook.com > business.facebook.com > adsmanager.facebook.com
  // IMPORTANT: window.__accessToken only exists on www and business, NOT adsmanager
  const wwwTab = searchTabs.find(t => t.url && t.url.includes('www.facebook.com'))
  if (wwwTab) return wwwTab
  const bizTab = searchTabs.find(t => t.url && t.url.includes('business.facebook.com'))
  if (bizTab) return bizTab
  return searchTabs[0]
}

async function processBmShare(share) {
  const requestId = share.requestId
  const accountId = share.adAccountId
  const userBmId = share.userBmId
  const ownerBmId = share.ownerBmId
  const username = share.username

  if (!requestId || !accountId || !userBmId) {
    console.error('[6AD] Invalid BM share data:', share)
    return
  }

  const MAX_ATTEMPTS = 3
  let lastError = null
  let claimed = false

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) {
        await addActivity('info', `Retrying BM share for act_${accountId} (attempt ${attempt}/${MAX_ATTEMPTS})`)
        await new Promise(r => setTimeout(r, 10000))
      }

      // FIRST: Verify we have a valid token BEFORE claiming
      let config = await getConfig()
      let accessToken = config.fbAccessToken

      if (!accessToken) {
        accessToken = await recaptureToken()
        if (!accessToken) {
          if (!claimed) {
            console.log(`[6AD] No token for BM share act_${accountId} — skipping, stays PENDING`)
            await addActivity('warning', `No token for BM share act_${accountId} — skipping, server will retry`)
            return
          }
          throw new Error('No access token available — recapture failed')
        }
      }

      // NOW safe to claim (we have a token)
      if (!claimed) {
        await addActivity('info', `Claiming BM share: act_${accountId} → BM ${userBmId} (${username})${ownerBmId ? ` [owner BM: ${ownerBmId}]` : ''}`)
        await apiRequest(`/extension/bm-share/${requestId}/claim`, 'POST')
        claimed = true
      }

      console.log('[6AD] Using token for BM share (len:', accessToken.length, '):', accessToken.substring(0, 15) + '...')

      const defaultTasks = ['ADVERTISE', 'ANALYZE']
      const errors = []
      let gotTokenError = false

      // Helper to try a BM share method via direct fetch
      async function tryBmMethod(name, path, params) {
        try {
          const data = await fbGraphFetch(path, accessToken, { method: 'POST', params })
          if (data.error) {
            errors.push(`${name}: ${data.error.message} (code ${data.error.code})`)
            if (isFbTokenError(data)) gotTokenError = true
            return null
          }
          return { success: true, data, method: name }
        } catch (e) {
          errors.push(`${name}: ${e.message}`)
          return null
        }
      }

      // Method 1: POST /act_{id}/agencies
      let result = await tryBmMethod('agencies', `/v21.0/act_${accountId}/agencies`, {
        business: userBmId,
        permitted_tasks: JSON.stringify(defaultTasks)
      })

      // Method 2: owner_client_ad_accounts
      if (!result && ownerBmId) {
        result = await tryBmMethod('owner_client_ad_accounts', `/v21.0/${ownerBmId}/client_ad_accounts`, {
          adaccount_id: `act_${accountId}`,
          permitted_tasks: JSON.stringify(defaultTasks)
        })
      }

      // Method 3: user_client_ad_accounts
      if (!result) {
        result = await tryBmMethod('user_client_ad_accounts', `/v21.0/${userBmId}/client_ad_accounts`, {
          adaccount_id: `act_${accountId}`,
          permitted_tasks: JSON.stringify(defaultTasks)
        })
      }

      // Method 4: assigned_users
      if (!result) {
        result = await tryBmMethod('assigned_users', `/v21.0/act_${accountId}/assigned_users`, {
          business: userBmId,
          tasks: JSON.stringify(defaultTasks)
        })
      }

      // If all methods failed due to token error → recapture and retry
      if (!result && gotTokenError && attempt < MAX_ATTEMPTS) {
        console.log('[6AD] Token error during BM share — recapturing...')
        await updateConfig({ fbAccessToken: '' })
        await recaptureToken()
        lastError = errors.join(' | ')
        continue
      }

      if (!result) throw new Error(errors.join(' | '))

      // Success!
      await apiRequest(`/extension/bm-share/${requestId}/complete`, 'POST')
      await addActivity('success', `BM shared: act_${accountId} → BM ${userBmId} (${username}) [${result.method}]`)
      console.log(`[6AD] Successfully shared act_${accountId} to BM ${userBmId} via ${result.method}`)
      return

    } catch (err) {
      lastError = err.message

      if (isTokenError(err.message) && attempt < MAX_ATTEMPTS) {
        console.log(`[6AD] BM share token error (attempt ${attempt}) — recapturing...`)
        await updateConfig({ fbAccessToken: '' })
        await recaptureToken()
        continue
      }

      if (attempt >= MAX_ATTEMPTS) {
        console.error(`[6AD] BM share failed for act_${accountId} after ${attempt} attempts:`, err.message)
        await addActivity('error', `BM share failed for act_${accountId}: ${err.message}`)
        try {
          await apiRequest(`/extension/bm-share/${requestId}/failed`, 'POST', { error: err.message })
        } catch (reportErr) {
          console.error('[6AD] Failed to report BM share failure:', reportErr.message)
        }
        return
      }
    }
  }

  // Safety net
  console.error(`[6AD] BM share failed for act_${accountId} after ${MAX_ATTEMPTS} attempts:`, lastError)
  await addActivity('error', `BM share failed for act_${accountId} after ${MAX_ATTEMPTS} attempts: ${lastError}`)
  try {
    await apiRequest(`/extension/bm-share/${requestId}/failed`, 'POST', {
      error: `Failed after ${MAX_ATTEMPTS} attempts: ${lastError}`
    })
  } catch {}
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
  } else if (alarm.name === '6ad-token-debounce') {
    await pickBestToken()
  } else if (alarm.name === '6ad-startup-init') {
    await onStartupInit()
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

async function handleTokenCapture(token, skipValidation = false) {
  // Validate token format before storing
  if (!token || !token.startsWith('EAA') || token.length < 40) return
  if (!/^EAA[a-zA-Z0-9]+$/.test(token)) {
    console.log('[6AD] handleTokenCapture: rejecting non-alphanumeric token (length:', token.length, ')')
    return
  }
  if (token.length > 500) {
    console.log('[6AD] handleTokenCapture: rejecting suspiciously long token (length:', token.length, ')')
    return
  }

  const config = await getConfig()
  if (token === config.fbAccessToken) return // Already have this token

  // ALWAYS validate token via /me before saving (unless caller already validated)
  if (!skipValidation) {
    try {
      const meData = await fbGraphFetch('/v21.0/me', token, { params: { fields: 'id,name' } })
      if (!meData.id) {
        console.log('[6AD] handleTokenCapture: token REJECTED by /me validation (error:', meData.error?.message?.substring(0, 80) || 'no id', ', len:', token.length, ')')
        return
      }
      console.log('[6AD] handleTokenCapture: token VALIDATED via /me (user:', meData.name, ', id:', meData.id, ')')
    } catch (e) {
      console.log('[6AD] handleTokenCapture: /me validation failed:', e.message, '— rejecting token')
      return
    }
  }

  await updateConfig({ fbAccessToken: token })
  await addActivity('success', `Token saved (len=${token.length}, ${token.substring(0, 15)}...)`)
  console.log('[6AD] New FB token stored, length:', token.length)

  // Trigger a heartbeat to send token to server immediately
  setTimeout(sendHeartbeat, 2000)
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

  // Inject token into ads-check pages
  if (changeInfo.status === 'complete' && tab.url && isAdsCheckUrl(tab.url)) {
    const config = await getConfig()
    const token = config.fbAccessToken
    if (token && token.startsWith('EAA') && token.length >= 40) {
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (t) => {
              window.postMessage({ type: '__6AD_ADS_CHECK_TOKEN__', token: t }, window.location.origin)
            },
            args: [token]
          })
          console.log('[6AD] Token injected into ads-check page')
        } catch (err) {
          console.log('[6AD] Ads-check inject failed:', err.message)
        }
      }, 1500)
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

// MV3-safe startup: use chrome.alarms instead of setTimeout for deferred init
async function onStartupInit() {
  const config = await getConfig()
  // Always attach debugger on startup
  await attachDebuggerToFBTabs()

  // Validate stored token on startup — clear garbage tokens from previous sessions
  if (config.fbAccessToken) {
    try {
      const session = await validateFbSession()
      if (!session.valid && session.isTokenError) {
        console.log('[6AD] Startup: stored token invalid, clearing...', session.error)
        await updateConfig({ fbAccessToken: '' })
        await addActivity('warning', 'Cleared invalid startup token — will recapture on first use')
      } else if (session.valid) {
        console.log('[6AD] Startup: stored token valid (user:', session.name || session.userId, ')')
      }
    } catch (e) {
      console.log('[6AD] Startup: token validation error:', e.message)
    }
  }

  if (config.apiKey && config.isEnabled) {
    await sendHeartbeat()
  }
}

// Use a one-time alarm for deferred startup (MV3 service workers kill setTimeout after 30s idle)
chrome.alarms.create('6ad-startup-init', { delayInMinutes: 0.05 }) // ~3 seconds

// Also run on browser startup (covers cold starts)
chrome.runtime.onStartup.addListener(() => {
  console.log('[6AD] Browser startup detected')
  onStartupInit()
})

console.log('[6AD] Background service worker loaded')
