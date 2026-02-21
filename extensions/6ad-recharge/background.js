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
            return { error: 'Invalid response from FB GET: ' + getText.substring(0, 200) }
          }

          if (accountData.error) return { error: accountData.error.message || JSON.stringify(accountData.error) }

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
            return { error: 'Invalid response: ' + postText.substring(0, 200) + ' | ' + debugInfo }
          }
          if (postData.error) return { error: (postData.error.message || JSON.stringify(postData.error)) + ' | ' + debugInfo }

          return {
            success: true,
            debugInfo,
            currentCapDollars,
            spentDollars,
            newCapDollars
          }
        } catch (e) {
          return { error: e.message }
        }
      },
      args: [accountId, accessToken, depositAmount]
    })

    const result = results?.[0]?.result
    if (!result) throw new Error('Script injection returned no result')
    if (result.error) throw new Error(result.error)

    await addActivity('info', `act_${accountId}: ${result.debugInfo || ''} | cap $${result.currentCapDollars} → $${result.newCapDollars}`)

    await apiRequest(`/extension/recharge/${depositId}/complete`, 'POST', {
      previousSpendCap: result.currentCapDollars,
      newSpendCap: result.newCapDollars
    })

    await addActivity('success', `Recharged act_${accountId} +$${depositAmount.toFixed(2)} (new cap: $${result.newCapDollars.toFixed(2)})`)
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
