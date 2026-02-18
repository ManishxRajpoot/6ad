/**
 * 6AD Auto Recharge - Background Service Worker
 * Handles polling for pending recharges and executing them via Facebook Graph API
 */

// ==================== CONFIG ====================

const DEFAULT_API_URL = 'https://api.6ad.in'
const POLL_INTERVAL_SECONDS = 10
const HEARTBEAT_ALARM = '6ad-heartbeat'
const FB_GRAPH_VERSION = 'v18.0'
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`

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

// ==================== FACEBOOK GRAPH API ====================

async function fbGraphRequest(endpoint, method = 'GET', params = {}) {
  const config = await getConfig()
  if (!config.fbAccessToken) throw new Error('No Facebook access token')

  const url = new URL(`${FB_GRAPH_BASE}${endpoint}`)
  params.access_token = config.fbAccessToken

  if (method === 'GET') {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const response = await fetch(url.toString())
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `FB API ${response.status}`)
    }
    return response.json()
  } else {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `FB API ${response.status}`)
    }
    return response.json()
  }
}

// ==================== TOKEN CAPTURE VIA COOKIES ====================
// Use Facebook cookies to generate an access token via Graph API

async function tryCaptureFBToken() {
  try {
    // Get Facebook cookies
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' })
    const cookieMap = {}
    for (const c of cookies) {
      cookieMap[c.name] = c.value
    }

    const cUser = cookieMap['c_user']
    const xs = cookieMap['xs']
    const datr = cookieMap['datr']

    if (!cUser || !xs) {
      console.log('[6AD] No FB session cookies found (c_user, xs)')
      return false
    }

    // Build cookie string for requests
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    // Method: Fetch facebook.com/adsmanager and extract EAA token from response
    // FB embeds EAA tokens in the HTML/JS of ads-related pages
    const response = await fetch('https://business.facebook.com/business_locations/', {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      credentials: 'include'
    })

    if (!response.ok) {
      console.log('[6AD] FB page fetch failed:', response.status)
      return false
    }

    const text = await response.text()

    // Look for EAA token in the response
    const tokenMatch = text.match(/EAA[a-zA-Z0-9]{50,}/)
    if (tokenMatch) {
      await handleTokenCapture(tokenMatch[0])
      return true
    }

    // Alternative: try the Graph API directly with cookies
    // Facebook's own pages use a first-party cookie-based auth
    const graphResponse = await fetch('https://graph.facebook.com/v18.0/me?fields=id,name&access_token=', {
      headers: { 'Cookie': cookieStr },
      credentials: 'include'
    })

    console.log('[6AD] No EAA token found in page response')
    return false
  } catch (err) {
    console.error('[6AD] Cookie-based token capture failed:', err.message)
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

// Listen for debugger events (network requests)
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Network.requestWillBeSent') {
    const url = params.request?.url || ''
    const postData = params.request?.postData || ''

    // Extract token from URL or POST body
    // Token can contain a-z, A-Z, 0-9 and may be URL-encoded
    const tokenRegex = /access_token=(EAA[a-zA-Z0-9%_-]+)/

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

    // Broader match in any part of the data
    const anyMatch = (url + ' ' + postData).match(/EAA[a-zA-Z0-9%_-]{50,}/)
    if (anyMatch) {
      try {
        const token = decodeURIComponent(anyMatch[0])
        validateAndSaveToken(token)
      } catch { validateAndSaveToken(anyMatch[0]) }
    }
  }
})

// Validate token against Graph API before saving
let lastValidatedToken = null
let isValidating = false

async function validateAndSaveToken(token) {
  if (!token || token.indexOf('EAA') !== 0 || token.length < 20) return
  if (token === lastValidatedToken) return
  if (isValidating) return

  isValidating = true
  try {
    // Quick test: call /me with this token
    const response = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`)
    const data = await response.json()

    if (data.id && data.name) {
      // Valid token!
      lastValidatedToken = token
      console.log('[6AD] Valid token found for user:', data.name)
      await handleTokenCapture(token)
      await updateConfig({ fbUserId: data.id, fbUserName: data.name })
      await addActivity('success', `FB connected: ${data.name} (${data.id})`)
    } else if (data.error) {
      console.log('[6AD] Token invalid:', data.error.message)
    }
  } catch (err) {
    console.log('[6AD] Token validation error:', err.message)
  } finally {
    isValidating = false
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
    if (!config.fbAccessToken) return []

    const result = await fbGraphRequest('/me/adaccounts', 'GET', {
      fields: 'account_id,name',
      limit: '200'
    })

    const accounts = (result.data || []).map(a => a.account_id)

    try {
      const me = await fbGraphRequest('/me', 'GET', { fields: 'id,name' })
      await updateConfig({
        fbUserId: me.id || config.fbUserId,
        fbUserName: me.name || config.fbUserName,
        adAccountIds: accounts
      })
    } catch {
      await updateConfig({ adAccountIds: accounts })
    }

    return accounts
  } catch (err) {
    console.error('[6AD] Failed to discover ad accounts:', err.message)
    await addActivity('error', `Ad account discovery failed: ${err.message}`)
    return []
  }
}

// ==================== HEARTBEAT ====================

async function sendHeartbeat() {
  const config = await getConfig()
  if (!config.apiKey || !config.isEnabled) return

  try {
    // Try to capture token if we don't have one
    if (!config.fbAccessToken) {
      // Try cookie-based capture
      await tryCaptureFBToken()
      // Also try attaching debugger to FB tabs
      await attachDebuggerToFBTabs()
    }

    // Re-read config after potential token capture
    const updatedConfig = await getConfig()

    let adAccountIds = updatedConfig.adAccountIds || []
    if (updatedConfig.fbAccessToken) {
      adAccountIds = await discoverAdAccounts()
    }

    const result = await apiRequest('/extension/heartbeat', 'POST', {
      adAccountIds,
      fbUserId: updatedConfig.fbUserId || undefined,
      fbUserName: updatedConfig.fbUserName || undefined,
      fbAccessToken: updatedConfig.fbAccessToken || undefined
    })

    await updateConfig({
      lastHeartbeat: Date.now(),
      lastError: null
    })

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

async function checkAndProcessRecharges() {
  if (isProcessing) return
  isProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled || !config.fbAccessToken) return

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

  try {
    await addActivity('info', `Claiming recharge for act_${accountId} ($${depositAmount})`)
    await apiRequest(`/extension/recharge/${depositId}/claim`, 'POST')

    const accountData = await fbGraphRequest(`/act_${accountId}`, 'GET', {
      fields: 'spend_cap,amount_spent,name'
    })

    // FB Graph API GET returns spend_cap/amount_spent in CENTS (hundredths)
    // FB Graph API POST accepts spend_cap in DOLLARS
    // So: read cents, convert to dollars, do math in dollars, post dollars
    const currentCapCents = parseInt(accountData.spend_cap || '0', 10)
    const spentCents = parseInt(accountData.amount_spent || '0', 10)
    const currentCapDollars = currentCapCents / 100
    const spentDollars = spentCents / 100
    const newCapDollars = currentCapDollars + depositAmount

    await addActivity('info', `act_${accountId}: spent $${spentDollars.toFixed(2)}, cap $${currentCapDollars.toFixed(2)} → new cap $${newCapDollars.toFixed(2)}`)

    await fbGraphRequest(`/act_${accountId}`, 'POST', {
      spend_cap: newCapDollars.toString()
    })

    await apiRequest(`/extension/recharge/${depositId}/complete`, 'POST', {
      previousSpendCap: currentCapDollars,
      newSpendCap: newCapDollars
    })

    await addActivity('success', `Recharged act_${accountId} +$${depositAmount.toFixed(2)} (new cap: $${newCapDollars.toFixed(2)})`)
    console.log(`[6AD] Successfully recharged act_${accountId}`)

  } catch (err) {
    console.error(`[6AD] Recharge failed for act_${accountId}:`, err.message)
    await addActivity('error', `Recharge failed for act_${accountId}: ${err.message}`)

    try {
      await apiRequest(`/extension/recharge/${depositId}/failed`, 'POST', {
        error: err.message
      })
    } catch (reportErr) {
      console.error('[6AD] Failed to report failure:', reportErr.message)
    }
  }
}

// ==================== BM SHARE PROCESSING ====================

let isBmShareProcessing = false

async function checkAndProcessBmShares() {
  if (isBmShareProcessing) return
  isBmShareProcessing = true

  try {
    const config = await getConfig()
    if (!config.apiKey || !config.isEnabled || !config.fbAccessToken) return

    const result = await apiRequest('/extension/pending-bm-shares', 'GET')
    const bmShares = result.bmShares || []

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

async function processBmShare(share) {
  // API returns: requestId, adAccountId, adAccountName, userBmId, username
  const requestId = share.requestId
  const accountId = share.adAccountId
  const userBmId = share.userBmId
  const username = share.username

  if (!requestId || !accountId || !userBmId) {
    console.error('[6AD] Invalid BM share data:', share)
    return
  }

  try {
    await addActivity('info', `Claiming BM share: act_${accountId} → BM ${userBmId} (${username})`)
    await apiRequest(`/extension/bm-share/${requestId}/claim`, 'POST')

    // Call Facebook Graph API to share the ad account to user's BM
    // POST /{userBmId}/client_ad_accounts
    const config = await getConfig()
    const url = `${FB_GRAPH_BASE}/${userBmId}/client_ad_accounts`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        adaccount_id: `act_${accountId}`,
        permitted_tasks: JSON.stringify(['MANAGE', 'ADVERTISE', 'ANALYZE']),
        access_token: config.fbAccessToken
      }).toString()
    })

    const result = await response.json()

    if (result.error) {
      throw new Error(result.error.message || 'Facebook API error')
    }

    // Success!
    await apiRequest(`/extension/bm-share/${requestId}/complete`, 'POST')
    await addActivity('success', `BM shared: act_${accountId} → BM ${userBmId} (${username})`)
    console.log(`[6AD] Successfully shared act_${accountId} to BM ${userBmId}`)

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

// ==================== TAB MONITORING ====================
// When a Facebook tab loads, try to attach debugger

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isFacebookUrl(tab.url)) {
    if (!attachedTabIds.has(tabId)) {
      try {
        await chrome.debugger.attach({ tabId }, '1.3')
        await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
        attachedTabIds.add(tabId)
        console.log('[6AD] Auto-attached debugger to tab', tabId)
      } catch (err) {
        console.log('[6AD] Auto-attach failed:', err.message)
      }
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
  }
})

async function handleTokenCapture(token) {
  const config = await getConfig()
  if (token !== config.fbAccessToken) {
    await updateConfig({ fbAccessToken: token })
    await addActivity('info', `Facebook token updated (${token.substring(0, 12)}...)`)
    console.log('[6AD] New FB token stored')

    await discoverAdAccounts()
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

// ==================== STARTUP ====================

chrome.runtime.onInstalled.addListener(() => {
  console.log('[6AD] Extension installed/updated')
  addActivity('info', 'Extension installed/updated')
})

setTimeout(async () => {
  const config = await getConfig()
  if (config.apiKey && config.isEnabled) {
    await sendHeartbeat()
  }
}, 3000)

console.log('[6AD] Background service worker loaded')
