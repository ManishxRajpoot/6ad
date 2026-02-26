/**
 * 6AD Auto Recharge V2 - Background Service Worker
 * Handles polling for pending recharges/BM shares and executing them via Facebook Graph API
 *
 * v2.0.0 — Enhanced token management:
 *   - Multi-candidate token pool (up to 5 candidates, sorted by length desc)
 *   - Validates via /me/adaccounts — only USER tokens accepted
 *   - Proactive Ads Manager navigation when tasks arrive with no token
 *   - Aggressive content.js now captures from FormData/fetch/XHR (not just window.__accessToken)
 */

// ==================== CONFIG ====================

const DEFAULT_API_URL = 'https://api.6ad.in'
const POLL_INTERVAL_SECONDS = 10
const HEARTBEAT_ALARM = '6ad-heartbeat'
const MAX_TOKEN_CANDIDATES = 5

// ==================== STATE ====================

let isProcessing = false

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
    'recentActivity',
    'tokenCandidates'
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
    recentActivity: data.recentActivity || [],
    tokenCandidates: data.tokenCandidates || []
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

// ==================== TOKEN CAPTURE & MULTI-CANDIDATE POOL ====================

/**
 * Extract __accessToken from Facebook page's JS runtime via chrome.scripting.
 * Also checks require('CurrentAccessToken') and c_user cookie.
 */
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
      console.log('[6AD-V2] No Facebook tabs open for token capture')
      return false
    }

    for (const tab of tabs) {
      try {
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
          console.log(`[6AD-V2] Token captured via ${result.source} (length: ${result.token.length})`)
          await handleTokenCapture(result.token, result.source || 'script-injection')

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
        console.log('[6AD-V2] Script injection failed for tab', tab.id, ':', err.message)
      }
    }

    console.log('[6AD-V2] No token found via script injection')
    return false
  } catch (err) {
    console.error('[6AD-V2] Token capture failed:', err.message)
    return false
  }
}

/**
 * Handle a token captured from content.js (via bridge) or script injection.
 * Validates via /me/adaccounts — only USER tokens can list ad accounts.
 * Maintains a multi-candidate pool sorted by length (longest first = user tokens).
 */
async function handleTokenCapture(token, source = 'unknown') {
  // Validate token format
  if (!token || !token.startsWith('EAA') || token.length < 40) return
  if (!/^EAA[a-zA-Z0-9._-]+$/.test(token)) {
    console.log('[6AD-V2] handleTokenCapture: rejecting token with invalid chars (length:', token.length, ')')
    return
  }
  if (token.length > 500) {
    console.log('[6AD-V2] handleTokenCapture: rejecting suspiciously long token (length:', token.length, ')')
    return
  }

  const config = await getConfig()

  // Skip if we already have this exact token
  if (token === config.fbAccessToken) return

  // Add to candidate pool (for tracking/debugging)
  let candidates = config.tokenCandidates || []
  const existingIdx = candidates.findIndex(c => c.token === token)
  if (existingIdx === -1) {
    candidates.push({
      token: token.substring(0, 20) + '...',  // Don't store full token in candidates
      fullToken: token,
      source: source,
      length: token.length,
      capturedAt: Date.now(),
      validated: false
    })
    // Sort by length descending (user tokens are longer than app tokens)
    candidates.sort((a, b) => b.length - a.length)
    // Keep only top N
    candidates = candidates.slice(0, MAX_TOKEN_CANDIDATES)
  }

  // Skip short tokens (app tokens tend to be <120 chars, user tokens 150-300)
  if (token.length < 100) {
    console.log(`[6AD-V2] handleTokenCapture: skipping short token from ${source} (len=${token.length}, likely app token)`)
    await updateConfig({ tokenCandidates: candidates })
    return
  }

  // Validate token via /me/adaccounts — only USER tokens pass this check
  console.log(`[6AD-V2] handleTokenCapture: validating token from ${source} (len=${token.length})...`)

  const MAX_VALIDATION_ATTEMPTS = 2
  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
    try {
      const data = await fbGraphFetch('/v21.0/me/adaccounts', token, {
        params: { limit: '1', fields: 'id' }
      })
      if (data.error) {
        console.log(`[6AD-V2] handleTokenCapture: token REJECTED — /me/adaccounts failed:`, data.error.message?.substring(0, 100), '(code:', data.error.code, ', len:', token.length, ')')
        // Mark as rejected in candidates
        const idx = candidates.findIndex(c => c.fullToken === token)
        if (idx >= 0) candidates[idx].validated = false
        await updateConfig({ tokenCandidates: candidates })
        return
      }
      if (!data.data || !Array.isArray(data.data)) {
        console.log('[6AD-V2] handleTokenCapture: token REJECTED — invalid /me/adaccounts response (len:', token.length, ')')
        await updateConfig({ tokenCandidates: candidates })
        return
      }

      // SUCCESS — valid user token!
      console.log('[6AD-V2] handleTokenCapture: token VALIDATED — user token with', data.data.length, 'ad account(s) accessible')

      // Mark as validated in candidates
      const idx = candidates.findIndex(c => c.fullToken === token)
      if (idx >= 0) candidates[idx].validated = true

      // Store as the active token
      await updateConfig({ fbAccessToken: token, tokenCandidates: candidates })
      await addActivity('success', `Token saved via ${source} (len=${token.length}, ${token.substring(0, 15)}...)`)
      console.log('[6AD-V2] New FB token stored, length:', token.length)

      // Trigger a heartbeat to send token to server immediately
      setTimeout(sendHeartbeat, 2000)
      return

    } catch (e) {
      // Network error — retry
      if (attempt < MAX_VALIDATION_ATTEMPTS) {
        console.log(`[6AD-V2] handleTokenCapture: validation network error (attempt ${attempt}): ${e.message} — retrying in 3s...`)
        await new Promise(r => setTimeout(r, 3000))
      } else {
        console.log(`[6AD-V2] handleTokenCapture: validation failed after ${attempt} attempts: ${e.message} — rejecting token`)
        await updateConfig({ tokenCandidates: candidates })
        return
      }
    }
  }
}

// ==================== TOKEN RECAPTURE ====================

/**
 * Recapture a fresh Facebook access token when the stored one is bad/expired.
 * Does NOT open new tabs — only checks existing FB tabs.
 * If no token found, returns null so server can handle login via CDP.
 */
async function recaptureToken() {
  console.log('[6AD-V2] recaptureToken: checking existing FB tabs for token...')

  try {
    const tabs = await chrome.tabs.query({
      url: ['https://www.facebook.com/*', 'https://business.facebook.com/*', 'https://adsmanager.facebook.com/*']
    })

    if (tabs.length === 0) {
      console.log('[6AD-V2] recaptureToken: no FB tabs open — returning null, server will handle')
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
          console.log('[6AD-V2] recaptureToken: FB is LOGGED OUT — returning null, server will login via CDP')
          await addActivity('warning', 'FB logged out — server will handle login')
          return null
        }

        // If we got a token, validate and save it
        const token = result?.token
        if (token && token.startsWith('EAA') && token.length >= 40 && /^EAA[a-zA-Z0-9._-]+$/.test(token)) {
          console.log('[6AD-V2] recaptureToken: token found (len:', token.length, ') — validating...')
          await handleTokenCapture(token, 'recapture-script')
          const updatedCfg = await getConfig()
          if (updatedCfg.fbAccessToken === token) {
            console.log('[6AD-V2] recaptureToken: token validated and stored')
            return token
          }
          console.log('[6AD-V2] recaptureToken: token rejected by handleTokenCapture — continuing search')
        }
      } catch (e) {
        console.log('[6AD-V2] recaptureToken: tab', tab.id, 'failed:', e.message)
      }
    }

    console.log('[6AD-V2] recaptureToken: FB logged in but no __accessToken found — waiting for interceptor capture')
    return null

  } catch (err) {
    console.error('[6AD-V2] recaptureToken error:', err.message)
    return null
  }
}

// ==================== TOKEN REHYDRATION (3-step escalation) ====================

/**
 * Rehydrate a fresh Facebook access token with 3-step escalation:
 *   Step 1: Try reading __accessToken from existing open FB tabs (no navigation)
 *   Step 2: Navigate to Ads Manager to trigger Graph API calls → content.js interceptors capture tokens
 *   Step 3: Return null — adspower-worker will handle auto-login
 *
 * V2 improvement: Step 2 navigates to Ads Manager (which triggers many Graph API calls)
 * and the aggressive content.js interceptors capture tokens from request bodies.
 * This works even when window.__accessToken is null.
 */
async function rehydrateToken() {
  console.log('[6AD-V2] rehydrateToken: starting 3-step escalation...')

  // Step 1: Quick read from existing tabs (no navigation)
  const quick = await recaptureToken()
  if (quick) {
    console.log('[6AD-V2] rehydrateToken: Step 1 success — token from existing tab')
    return quick
  }

  // Step 2: Navigate an existing FB tab to Ads Manager to trigger API calls
  // The aggressive content.js interceptors will capture tokens from request bodies
  console.log('[6AD-V2] rehydrateToken: Step 1 failed — trying Step 2 (navigate to Ads Manager for interceptor capture)...')
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.facebook.com/*',
        'https://business.facebook.com/*',
        'https://adsmanager.facebook.com/*'
      ]
    })

    if (tabs.length === 0) {
      console.log('[6AD-V2] rehydrateToken: No FB tabs open — cannot rehydrate, adspower-worker will handle')
      return null
    }

    const tab = tabs[0]

    // First check if logged in
    try {
      const loginCheck = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: () => ({ loggedIn: document.cookie.includes('c_user=') })
      })
      if (!loginCheck?.[0]?.result?.loggedIn) {
        console.log('[6AD-V2] rehydrateToken: FB is LOGGED OUT — returning null, adspower-worker will auto-login')
        await addActivity('warning', 'FB logged out during rehydration — server will handle login')
        return null
      }
    } catch (e) {
      console.log('[6AD-V2] rehydrateToken: login check failed:', e.message)
    }

    // Navigate to Ads Manager — this triggers dozens of Graph API calls
    // content.js interceptors will capture access_token from FormData/URLSearchParams bodies
    console.log(`[6AD-V2] rehydrateToken: Navigating tab ${tab.id} to Ads Manager (triggers API calls → interceptor captures token)...`)
    await chrome.tabs.update(tab.id, { url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns' })

    // Wait for page to load and interceptors to fire
    // Check every 3s for up to 30s
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const cfg = await getConfig()
      if (cfg.fbAccessToken && cfg.fbAccessToken.startsWith('EAA') && cfg.fbAccessToken.length >= 100) {
        console.log(`[6AD-V2] rehydrateToken: Step 2 success — token captured by interceptor after ${(i + 1) * 3}s`)
        return cfg.fbAccessToken
      }
    }

    // Also try script injection as backup
    const captured = await tryCaptureFBToken()
    if (captured) {
      const cfg = await getConfig()
      if (cfg.fbAccessToken) {
        console.log('[6AD-V2] rehydrateToken: Step 2 success — token from script injection')
        return cfg.fbAccessToken
      }
    }

    console.log('[6AD-V2] rehydrateToken: Step 2 failed — FB logged in but no token captured after Ads Manager navigation')
    return null
  } catch (err) {
    console.error('[6AD-V2] rehydrateToken error:', err.message)
    return null
  }
}

// ==================== AD ACCOUNT DISCOVERY ====================

async function discoverAdAccounts() {
  try {
    const config = await getConfig()
    if (!config.fbAccessToken) return config.adAccountIds || []

    try {
      // Fetch ALL ad accounts with pagination
      let allAccounts = []
      let nextUrl = null
      let page = 0
      const maxPages = 10 // Safety limit

      // First page
      const data = await fbGraphFetch('/v21.0/me/adaccounts', config.fbAccessToken, {
        params: { fields: 'account_id,name', limit: '200' }
      })

      if (data.error) {
        console.log('[6AD-V2] Ad account discovery failed:', data.error.message)
        return config.adAccountIds || []
      }

      allAccounts = (data.data || []).map(a => a.account_id)
      nextUrl = data.paging?.next || null
      page++

      // Follow pagination cursors
      while (nextUrl && page < maxPages) {
        try {
          const resp = await fetch(nextUrl)
          const text = await resp.text()
          let pageData
          try { pageData = JSON.parse(text) } catch { break }

          if (pageData.error || !pageData.data) break

          const pageAccounts = pageData.data.map(a => a.account_id).filter(Boolean)
          if (pageAccounts.length === 0) break

          allAccounts = allAccounts.concat(pageAccounts)
          nextUrl = pageData.paging?.next || null
          page++
          console.log(`[6AD-V2] Ad account pagination: page ${page}, total so far: ${allAccounts.length}`)
        } catch (e) {
          console.log('[6AD-V2] Pagination fetch error:', e.message)
          break
        }
      }

      const accounts = [...new Set(allAccounts)] // Deduplicate
      const updates = { adAccountIds: accounts }

      try {
        const meData = await fbGraphFetch('/v21.0/me', config.fbAccessToken, {
          params: { fields: 'id,name' }
        })
        if (meData.name) updates.fbUserName = meData.name
        if (meData.id) updates.fbUserId = meData.id
      } catch {}

      await updateConfig(updates)
      console.log(`[6AD-V2] Discovered ${accounts.length} ad accounts, user: ${updates.fbUserName || 'unknown'}`)
      return accounts
    } catch (err) {
      console.log('[6AD-V2] Ad account discovery failed:', err.message)
      return config.adAccountIds || []
    }
  } catch (err) {
    console.error('[6AD-V2] Failed to discover ad accounts:', err.message)
    return []
  }
}

// ==================== FB SESSION VALIDATION ====================

/**
 * Validate FB session by checking stored token via /me/adaccounts.
 * Only USER tokens can list ad accounts — app tokens fail this check.
 */
async function validateFbSession() {
  try {
    const config = await getConfig()
    if (!config.fbAccessToken) {
      return { valid: false, error: 'No Facebook access token stored', tokenMissing: true }
    }

    try {
      const data = await fbGraphFetch('/v21.0/me/adaccounts', config.fbAccessToken, {
        params: { limit: '1', fields: 'id' }
      })

      if (data.error) {
        return {
          valid: false,
          error: data.error.message || 'Token validation failed',
          isTokenError: isFbTokenError(data)
        }
      }

      if (!data.data || !Array.isArray(data.data)) {
        return { valid: false, error: 'Not a valid user token (no ad accounts data)' }
      }

      return { valid: true }
    } catch (e) {
      return { valid: false, error: 'Network error validating token: ' + e.message }
    }
  } catch (e) {
    return { valid: false, error: 'Session check failed: ' + e.message }
  }
}

// ==================== HEARTBEAT ====================

async function sendHeartbeat() {
  const config = await getConfig()
  if (!config.apiKey || !config.isEnabled) return

  try {
    // Try to capture token if we don't have one
    if (!config.fbAccessToken) {
      await tryCaptureFBToken()
    }

    // Re-read config after potential token capture
    const updatedConfig = await getConfig()

    // Send heartbeat
    const result = await apiRequest('/extension/heartbeat', 'POST', {
      adAccountIds: updatedConfig.adAccountIds || [],
      fbUserId: updatedConfig.fbUserId || undefined,
      fbUserName: updatedConfig.fbUserName || undefined,
      fbAccessToken: updatedConfig.fbAccessToken || undefined
    })

    const heartbeatUpdates = {
      lastHeartbeat: Date.now(),
      lastError: null
    }

    // Use profile data from API response
    if (result.profileLabel) {
      heartbeatUpdates.fbUserName = result.profileLabel
    }
    if (result.profileAdAccountIds && result.profileAdAccountIds.length > 0) {
      heartbeatUpdates.adAccountIds = result.profileAdAccountIds
    }

    await updateConfig(heartbeatUpdates)

    console.log('[6AD-V2] Heartbeat OK, pending recharges:', result.pendingCount, 'pending BM shares:', result.pendingBmShareCount,
      result.profileLabel ? ', profile: ' + result.profileLabel : '',
      result.profileAdAccountIds?.length ? ', accounts: ' + result.profileAdAccountIds.length : '')

    if (result.pendingCount > 0 || result.pendingBmShareCount > 0) {
      await addActivity('info', `Heartbeat: ${result.pendingCount} recharges, ${result.pendingBmShareCount} BM shares pending`)
    }

    // Try account discovery via Graph API in background
    // Re-discover if no accounts, or if we have fewer than expected (pagination issue)
    const currentAccountCount = heartbeatUpdates.adAccountIds?.length || updatedConfig.adAccountIds?.length || 0
    if (updatedConfig.fbAccessToken && currentAccountCount < 50) {
      discoverAdAccounts().catch(e => console.log('[6AD-V2] Account discovery error:', e.message))
    }

    if (result.pendingCount > 0) {
      await checkAndProcessRecharges()
    }

    if (result.pendingBmShareCount > 0) {
      await checkAndProcessBmShares()
    }
  } catch (err) {
    console.error('[6AD-V2] Heartbeat failed:', err.message)
    await updateConfig({ lastError: err.message })
  }
}

// ==================== RECHARGE PROCESSING ====================

async function checkAndProcessRecharges() {
  if (isProcessing) return
  isProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled) return

    const hasToken = config.fbAccessToken && config.fbAccessToken.startsWith('EAA')
    console.log(`[6AD-V2] Checking recharges (stored token: ${hasToken ? 'yes, len=' + config.fbAccessToken.length : 'none'})`)

    const result = await apiRequest('/extension/pending-recharges', 'GET')
    const recharges = result.recharges || []

    for (const recharge of recharges) {
      await processRecharge(recharge)
    }
  } catch (err) {
    console.error('[6AD-V2] Recharge check failed:', err.message)
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
    console.error('[6AD-V2] Invalid recharge data:', recharge)
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

      // Try stored token FIRST — if still valid, recharge completes instantly (no browser needed)
      let config = await getConfig()
      let accessToken = config.fbAccessToken

      if (!accessToken) {
        console.log('[6AD-V2] No token stored, attempting rehydration (3-step escalation)...')
        accessToken = await rehydrateToken()
        if (!accessToken) {
          if (!claimed) {
            console.log(`[6AD-V2] No token for recharge act_${accountId} — skipping, deposit stays PENDING`)
            await addActivity('warning', `No token for act_${accountId} — skipping, server will retry`)
            return
          }
          throw new Error('No access token available — rehydration failed')
        }
      }

      // NOW safe to claim (we have a token)
      if (!claimed) {
        await addActivity('info', `Claiming recharge for act_${accountId} ($${depositAmount})`)
        await apiRequest(`/extension/recharge/${depositId}/claim`, 'POST')
        claimed = true
      }

      console.log('[6AD-V2] Using token for recharge (len:', accessToken.length, '):', accessToken.substring(0, 15) + '...')

      // Step 1: GET current spend cap
      const accountData = await fbGraphFetch(`/v21.0/act_${accountId}`, accessToken, {
        params: { fields: 'spend_cap,amount_spent,name' }
      })

      if (accountData.error) {
        if (isFbTokenError(accountData) && attempt < MAX_ATTEMPTS) {
          console.log(`[6AD-V2] Token error on GET for act_${accountId}: ${accountData.error.message} — rehydrating...`)
          await addActivity('warning', `Token error: ${accountData.error.message} — rehydrating...`)
          await updateConfig({ fbAccessToken: '' })
          const newToken = await rehydrateToken()
          if (newToken) {
            lastError = accountData.error.message
            continue
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

      // Step 2: POST new spend cap
      const postData = await fbGraphFetch(`/v21.0/act_${accountId}`, accessToken, {
        method: 'POST',
        params: { spend_cap: newCapDollars.toString() }
      })

      if (postData.error) {
        if (isFbTokenError(postData) && attempt < MAX_ATTEMPTS) {
          console.log(`[6AD-V2] Token error on POST for act_${accountId}: ${postData.error.message} — rehydrating...`)
          await updateConfig({ fbAccessToken: '' })
          const newToken = await rehydrateToken()
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
      console.log(`[6AD-V2] Successfully recharged act_${accountId}`)
      return // success

    } catch (err) {
      lastError = err.message
      const isNetworkErr = err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed')
      const isTokenErr = isTokenError(err.message)

      if (attempt < MAX_ATTEMPTS) {
        if (isTokenErr) {
          console.log(`[6AD-V2] Token error (attempt ${attempt}/${MAX_ATTEMPTS}) for act_${accountId}: ${err.message}`)
          await updateConfig({ fbAccessToken: '' })
          await rehydrateToken()
          continue
        }
        if (isNetworkErr) {
          console.log(`[6AD-V2] Network error (attempt ${attempt}/${MAX_ATTEMPTS}) for act_${accountId}: ${err.message}`)
          continue
        }
      }

      // Final failure
      console.error(`[6AD-V2] Recharge failed for act_${accountId} after ${attempt} attempt(s):`, err.message)
      await addActivity('error', `Recharge failed for act_${accountId}: ${err.message}`)

      try {
        await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', { error: err.message })
      } catch (reportErr) {
        console.error('[6AD-V2] Failed to report failure:', reportErr.message)
      }
      return
    }
  }

  // All attempts exhausted
  console.error(`[6AD-V2] Recharge failed for act_${accountId} after ${MAX_ATTEMPTS} attempts:`, lastError)
  await addActivity('error', `Recharge failed for act_${accountId} after ${MAX_ATTEMPTS} attempts: ${lastError}`)
  try {
    await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', {
      error: `Failed after ${MAX_ATTEMPTS} attempts: ${lastError}`
    })
  } catch (reportErr) {
    console.error('[6AD-V2] Failed to report failure:', reportErr.message)
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
      console.log('[6AD-V2] BM share check skipped:', !config.apiKey ? 'no key' : 'disabled')
      return
    }

    const hasToken = config.fbAccessToken && config.fbAccessToken.startsWith('EAA')
    console.log(`[6AD-V2] Checking BM shares (stored token: ${hasToken ? 'yes, len=' + config.fbAccessToken.length : 'none'})`)

    await addActivity('info', 'Checking for pending BM shares...')
    const result = await apiRequest('/extension/pending-bm-shares', 'GET')
    const bmShares = result.bmShares || []
    console.log('[6AD-V2] Found', bmShares.length, 'pending BM shares')

    if (bmShares.length === 0) {
      await addActivity('info', 'No pending BM shares')
      return
    }

    await addActivity('info', `Found ${bmShares.length} pending BM share(s)`)
    for (const share of bmShares) {
      await processBmShare(share)
    }
  } catch (err) {
    console.error('[6AD-V2] BM share check failed:', err.message)
    await addActivity('error', `BM share check failed: ${err.message}`)
  } finally {
    isBmShareProcessing = false
  }
}

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
  const validTabs = tabs.filter(t => t.url && !t.url.includes('/loginpage') && !t.url.includes('/login') && !t.url.includes('login.php'))
  const searchTabs = validTabs.length > 0 ? validTabs : tabs

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
    console.error('[6AD-V2] Invalid BM share data:', share)
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

      // Try stored token FIRST
      let config = await getConfig()
      let accessToken = config.fbAccessToken

      if (!accessToken) {
        console.log('[6AD-V2] No token for BM share, attempting rehydration (3-step escalation)...')
        accessToken = await rehydrateToken()
        if (!accessToken) {
          if (!claimed) {
            console.log(`[6AD-V2] No token for BM share act_${accountId} — skipping, stays PENDING`)
            await addActivity('warning', `No token for BM share act_${accountId} — skipping, server will retry`)
            return
          }
          throw new Error('No access token available — rehydration failed')
        }
      }

      // Validate token via /me/adaccounts ONLY on first attempt before claiming
      if (!claimed) {
        const session = await validateFbSession()
        if (!session.valid) {
          console.log(`[6AD-V2] Token invalid for BM share (${session.error}) — trying rehydration...`)
          await updateConfig({ fbAccessToken: '' })
          accessToken = await rehydrateToken()
          if (!accessToken) {
            console.log(`[6AD-V2] BM share skipped: rehydration failed — stays PENDING for server`)
            await addActivity('warning', `BM share skipped: token invalid, rehydration failed — server will retry`)
            return
          }
          const session2 = await validateFbSession()
          if (!session2.valid) {
            console.log(`[6AD-V2] BM share skipped: rehydrated token also invalid — stays PENDING`)
            await addActivity('warning', `BM share skipped: rehydrated token invalid (${session2.error})`)
            return
          }
        }
        console.log(`[6AD-V2] Token validated for BM share via /me/adaccounts`)
      }

      // NOW safe to claim
      if (!claimed) {
        await addActivity('info', `Claiming BM share: act_${accountId} → BM ${userBmId} (${username})${ownerBmId ? ` [owner BM: ${ownerBmId}]` : ''}`)
        await apiRequest(`/extension/bm-share/${requestId}/claim`, 'POST')
        claimed = true
      }

      console.log('[6AD-V2] Using token for BM share (len:', accessToken.length, '):', accessToken.substring(0, 15) + '...')

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

      // If all methods failed due to token error → rehydrate and retry
      if (!result && gotTokenError && attempt < MAX_ATTEMPTS) {
        console.log('[6AD-V2] Token error during BM share — rehydrating...')
        await updateConfig({ fbAccessToken: '' })
        await rehydrateToken()
        lastError = errors.join(' | ')
        continue
      }

      if (!result) throw new Error(errors.join(' | '))

      // Success!
      await apiRequest(`/extension/bm-share/${requestId}/complete`, 'POST')
      await addActivity('success', `BM shared: act_${accountId} → BM ${userBmId} (${username}) [${result.method}]`)
      console.log(`[6AD-V2] Successfully shared act_${accountId} to BM ${userBmId} via ${result.method}`)
      return

    } catch (err) {
      lastError = err.message

      if (isTokenError(err.message) && attempt < MAX_ATTEMPTS) {
        console.log(`[6AD-V2] BM share token error (attempt ${attempt}) — rehydrating...`)
        await updateConfig({ fbAccessToken: '' })
        await rehydrateToken()
        continue
      }

      if (attempt >= MAX_ATTEMPTS) {
        console.error(`[6AD-V2] BM share failed for act_${accountId} after ${attempt} attempts:`, err.message)
        await addActivity('error', `BM share failed for act_${accountId}: ${err.message}`)
        try {
          await apiRequest(`/extension/bm-share/${requestId}/failed`, 'POST', { error: err.message })
        } catch (reportErr) {
          console.error('[6AD-V2] Failed to report BM share failure:', reportErr.message)
        }
        return
      }
    }
  }

  // Safety net
  console.error(`[6AD-V2] BM share failed for act_${accountId} after ${MAX_ATTEMPTS} attempts:`, lastError)
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
  }
})

// ==================== MESSAGE HANDLERS ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FB_TOKEN_CAPTURED') {
    console.log('[6AD-V2] Token received from content.js via bridge! source:', message.source || 'unknown', 'len:', message.token?.length)
    handleTokenCapture(message.token, message.source || 'content-bridge')
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
  } else if (message.type === 'FORCE_TOKEN_CAPTURE') {
    // New in V2: manually trigger Ads Manager navigation for token capture
    forceTokenCapture().then(result => sendResponse(result))
    return true
  } else if (message.type === 'GET_TOKEN_CANDIDATES') {
    getConfig().then(config => sendResponse({ candidates: config.tokenCandidates || [] }))
    return true
  }
})

/**
 * Force token capture by navigating to Ads Manager.
 * Used by popup "Force Token Capture" button.
 */
async function forceTokenCapture() {
  try {
    await addActivity('info', 'Force token capture triggered — navigating to Ads Manager...')
    const token = await rehydrateToken()
    if (token) {
      return { success: true, token: token.substring(0, 15) + '...', length: token.length }
    }
    return { success: false, error: 'No token captured — try logging into Facebook first' }
  } catch (e) {
    return { success: false, error: e.message }
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
    recentActivity: (config.recentActivity || []).slice(0, 20),
    tokenCandidates: (config.tokenCandidates || []).map(c => ({
      source: c.source,
      length: c.length,
      capturedAt: c.capturedAt,
      validated: c.validated
    })),
    version: '2.0.0'
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
    setTimeout(sendHeartbeat, 1000)
  }
  return { enabled }
}

// ==================== STARTUP ====================

console.log('[6AD-V2] Background service worker started (v2.0.0 — aggressive interceptor mode)')

// Run initial heartbeat after 5s
setTimeout(() => {
  getConfig().then(config => {
    if (config.isEnabled && config.apiKey) {
      sendHeartbeat()
    }
  })
}, 5000)
