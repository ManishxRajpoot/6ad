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
    type, // 'info' | 'success' | 'error' | 'recharge'
    message,
    timestamp: Date.now()
  }
  const recent = [activity, ...(config.recentActivity || [])].slice(0, 50) // Keep last 50
  await updateConfig({ recentActivity: recent })
}

// ==================== API HELPERS ====================

async function apiRequest(endpoint, method = 'GET', body = null) {
  const config = await getConfig()
  if (!config.apiKey) throw new Error('No API key configured')

  const url = `${config.apiUrl}${endpoint}`
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

    // Also get user info
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
    // Discover ad accounts if we have a FB token
    let adAccountIds = config.adAccountIds || []
    if (config.fbAccessToken) {
      adAccountIds = await discoverAdAccounts()
    }

    const result = await apiRequest('/extension/heartbeat', 'POST', {
      adAccountIds,
      fbUserId: config.fbUserId || undefined,
      fbUserName: config.fbUserName || undefined
    })

    await updateConfig({
      lastHeartbeat: Date.now(),
      lastError: null
    })

    // Check for pending recharges
    if (result.pendingCount > 0) {
      await checkAndProcessRecharges()
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

    // Get pending recharges
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
  const { id, accountId, amount } = recharge
  const depositAmount = parseFloat(amount)

  if (!accountId || isNaN(depositAmount) || depositAmount <= 0) {
    console.error('[6AD] Invalid recharge data:', recharge)
    return
  }

  try {
    // Step 1: Claim the task
    await addActivity('info', `Claiming recharge for act_${accountId} ($${depositAmount})`)
    await apiRequest(`/extension/recharge/${id}/claim`, 'POST')

    // Step 2: Get current spend cap
    const accountData = await fbGraphRequest(`/act_${accountId}`, 'GET', {
      fields: 'spend_cap,amount_spent,name'
    })

    const currentSpendCapCents = parseInt(accountData.spend_cap || '0', 10)
    // Facebook spend_cap is in cents (account currency units * 100)
    const depositCents = Math.round(depositAmount * 100)
    const newSpendCapCents = currentSpendCapCents + depositCents

    await addActivity('info', `act_${accountId}: Current cap $${(currentSpendCapCents / 100).toFixed(2)} → New cap $${(newSpendCapCents / 100).toFixed(2)}`)

    // Step 3: Update spend cap
    await fbGraphRequest(`/act_${accountId}`, 'POST', {
      spend_cap: newSpendCapCents.toString()
    })

    // Step 4: Report success
    await apiRequest(`/extension/recharge/${id}/complete`, 'POST', {
      previousSpendCap: currentSpendCapCents,
      newSpendCap: newSpendCapCents
    })

    await addActivity('success', `Recharged act_${accountId} +$${depositAmount.toFixed(2)} (new cap: $${(newSpendCapCents / 100).toFixed(2)})`)
    console.log(`[6AD] Successfully recharged act_${accountId}`)

  } catch (err) {
    console.error(`[6AD] Recharge failed for act_${accountId}:`, err.message)
    await addActivity('error', `Recharge failed for act_${accountId}: ${err.message}`)

    // Report failure
    try {
      await apiRequest(`/extension/recharge/${id}/failed`, 'POST', {
        error: err.message
      })
    } catch (reportErr) {
      console.error('[6AD] Failed to report failure:', reportErr.message)
    }
  }
}

// ==================== ALARM SETUP ====================

// Set up polling alarm
chrome.alarms.create(HEARTBEAT_ALARM, {
  periodInMinutes: POLL_INTERVAL_SECONDS / 60 // ~10 seconds
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
    // Token from content script
    handleTokenCapture(message.token)
    sendResponse({ received: true })
  } else if (message.type === 'GET_STATUS') {
    // Popup requesting status
    handleGetStatus().then(sendResponse)
    return true // async response
  } else if (message.type === 'SAVE_CONFIG') {
    // Popup saving config
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

    // Immediately discover ad accounts with new token
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

  // Send immediate heartbeat with new config
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

// Run initial heartbeat on install/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('[6AD] Extension installed/updated')
  addActivity('info', 'Extension installed/updated')
})

// Initial heartbeat
setTimeout(async () => {
  const config = await getConfig()
  if (config.apiKey && config.isEnabled) {
    await sendHeartbeat()
  }
}, 3000)

console.log('[6AD] Background service worker loaded')
