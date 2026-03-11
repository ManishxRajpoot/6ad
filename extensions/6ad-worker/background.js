// 6AD Worker v3.3 — Background Service Worker
// Heartbeat-based polling, token management, recharge & BM share execution

var GRAPH_API = 'https://graph.facebook.com/v21.0'
var DEFAULT_POLL_MS = 15000 // 15 seconds default
var MAX_ACTIVITY = 30
var TOKEN_MAX_AGE_MS = 90 * 60 * 1000 // 90 minutes

var isExecuting = false
var pollTimer = null
var currentPollMs = DEFAULT_POLL_MS
var processedJobIds = {} // Track jobs we've already claimed/processed { jobId: timestamp }

// In-memory state (popup reads this via messaging — bypasses chrome.storage sync issues)
var STATE = {
  version: '3.4',
  workerAlive: true,
  lastPollAt: null,
  pollError: null,
  lastSyncAt: null,
  capturedToken: null,
  tokenCapturedAt: null,
  tokenValidated: false,
  tokenRefreshNeeded: false,
  fbUserName: null,
  profileLabel: null,
  activities: [],
  stats: { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
}

console.log('[6AD] ========== SERVICE WORKER STARTING v3.2 ==========')

// ─── Activity Log ────────────────────────────────────────────────

function addActivity(type, message, status) {
  var entry = {
    time: new Date().toISOString(),
    type: type,
    message: message,
    status: status
  }
  STATE.activities.unshift(entry)
  if (STATE.activities.length > MAX_ACTIVITY) STATE.activities = STATE.activities.slice(0, MAX_ACTIVITY)
  try {
    chrome.storage.local.set({ activities: STATE.activities })
  } catch (e) {}
}

function updateStats(key) {
  STATE.stats[key] = (STATE.stats[key] || 0) + 1
  try {
    chrome.storage.local.set({ stats: STATE.stats })
  } catch (e) {}
}

// ─── Token Request (ask content scripts to scan / open adsmanager) ──

var lastTokenRequestAt = 0
var TOKEN_REQUEST_COOLDOWN = 30000 // Don't spam — 30s cooldown

function requestTokenFromTabs() {
  var now = Date.now()
  if (now - lastTokenRequestAt < TOKEN_REQUEST_COOLDOWN) return
  lastTokenRequestAt = now

  console.log('[6AD] Requesting token from FB tabs...')

  // Send 6AD_NEED_TOKEN to all Facebook tabs (bridge.js relays to content.js)
  chrome.tabs.query({ url: ['https://www.facebook.com/*', 'https://business.facebook.com/*', 'https://adsmanager.facebook.com/*'] }, function (tabs) {
    if (chrome.runtime.lastError) return

    if (tabs && tabs.length > 0) {
      // Send message to each FB tab to trigger token scan
      for (var i = 0; i < tabs.length; i++) {
        try {
          chrome.tabs.sendMessage(tabs[i].id, { type: '6AD_NEED_TOKEN' })
        } catch (e) {}
      }
      console.log('[6AD] Sent token request to ' + tabs.length + ' FB tab(s)')
    } else {
      // No FB tabs open — open adsmanager to capture token
      console.log('[6AD] No FB tabs open — opening adsmanager...')
      addActivity('token', 'No FB tab — opening Ads Manager to capture token', 'info')
      try {
        chrome.tabs.create({ url: 'https://adsmanager.facebook.com/adsmanager', active: false }, function (tab) {
          if (chrome.runtime.lastError) {
            console.warn('[6AD] Failed to open adsmanager:', chrome.runtime.lastError.message)
          }
        })
      } catch (e) {
        console.warn('[6AD] Tab create error:', e.message)
      }
    }
  })
}

// ─── CDP Auto-Login Request ──────────────────────────────────────

var lastCdpRequestAt = 0
var CDP_REQUEST_COOLDOWN = 120000 // 2 min cooldown between CDP requests

function requestCdpLogin(apiKey, serverUrl) {
  var now = Date.now()
  if (now - lastCdpRequestAt < CDP_REQUEST_COOLDOWN) {
    console.log('[6AD] CDP login request cooldown — skipping')
    return
  }
  lastCdpRequestAt = now

  var url = serverUrl.replace(/\/+$/, '') + '/extension/request-cdp-login'
  console.log('[6AD] Requesting CDP auto-login from server...')

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    }
  })
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data.ok) {
        console.log('[6AD] CDP auto-login triggered on server')
        addActivity('token', 'CDP auto-login triggered — waiting for login...', 'info')
      } else {
        console.log('[6AD] CDP login request failed:', data.error || 'Unknown')
        addActivity('token', 'CDP login failed: ' + (data.error || 'Unknown'), 'error')
      }
    })
    .catch(function (err) {
      console.error('[6AD] CDP login request error:', err.message)
      addActivity('token', 'CDP login request error: ' + err.message, 'error')
    })
}

// ─── Token Management ────────────────────────────────────────────

// Validate token via Graph API — returns { valid, id, name } or { valid: false }
function validateToken(token) {
  if (!token || !token.startsWith('EAA') || token.length < 50) {
    return Promise.resolve({ valid: false })
  }
  return fetch(GRAPH_API + '/me?fields=id,name&access_token=' + encodeURIComponent(token))
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data.error) {
        console.log('[6AD] Token validation failed:', data.error.message)
        return { valid: false }
      }
      if (data.id) {
        console.log('[6AD] Token validated — user:', data.name, '(' + data.id + ')')
        return { valid: true, id: data.id, name: data.name }
      }
      return { valid: false }
    })
    .catch(function (err) {
      console.warn('[6AD] Token validation error:', err.message)
      return { valid: false }
    })
}

// Get current token if valid (format + age check only, no API call)
function getLocalToken() {
  return new Promise(function (resolve) {
    chrome.storage.local.get(['capturedToken', 'tokenCapturedAt', 'tokenValidated'], function (s) {
      var token = s.capturedToken
      if (!token || !token.startsWith('EAA') || token.length < 50) {
        resolve({ valid: false, reason: 'No token captured' })
        return
      }
      var capturedAt = s.tokenCapturedAt ? new Date(s.tokenCapturedAt).getTime() : 0
      var age = Date.now() - capturedAt
      if (age > TOKEN_MAX_AGE_MS) {
        resolve({ valid: false, reason: 'Token expired (' + Math.round(age / 60000) + 'min old)' })
        return
      }
      resolve({ valid: true, token: token, validated: !!s.tokenValidated })
    })
  })
}

// Full token check with Graph API validation before task execution
function getValidatedToken() {
  return getLocalToken().then(function (local) {
    if (!local.valid) return local
    // Validate via Graph API to make sure it actually works
    return validateToken(local.token).then(function (result) {
      if (result.valid) {
        chrome.storage.local.set({
          tokenValidated: true,
          tokenValidatedAt: new Date().toISOString(),
          fbUserId: result.id,
          fbUserName: result.name
        })
        return { valid: true, token: local.token, id: result.id, name: result.name }
      } else {
        chrome.storage.local.set({ tokenValidated: false })
        return { valid: false, reason: 'Token rejected by Graph API' }
      }
    })
  })
}

// ─── Funding Source Sync (VCC Cards — triggered by admin via heartbeat) ──

function syncFundingSources(apiKey, serverUrl) {
  console.log('[6AD] Starting funding source sync (admin requested)...')
  addActivity('funding', 'VCC sync started (admin request)', 'info')

  getLocalToken().then(function (local) {
    if (!local.valid) {
      console.log('[6AD] Funding sync skipped — no valid token')
      addActivity('funding', 'VCC sync skipped — no token', 'error')
      return
    }

    var token = local.token
    fetchAllAdAccountsFunding(token, null, {}).then(function (fundingSources) {
      var accountIds = Object.keys(fundingSources)
      if (accountIds.length === 0) {
        console.log('[6AD] Funding sync — no accounts with card info found')
        addActivity('funding', 'VCC sync — no cards found', 'info')
        return
      }

      console.log('[6AD] Funding sync — found ' + accountIds.length + ' accounts with cards, posting to server')

      var url = serverUrl.replace(/\/+$/, '') + '/extension/funding-sources'
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ fundingSources: fundingSources })
      })
        .then(function (r) { return r.json() })
        .then(function (data) {
          console.log('[6AD] Funding sync OK — updated ' + (data.updated || 0) + '/' + (data.total || 0))
          addActivity('funding', 'VCC synced: ' + (data.updated || 0) + ' accounts updated', 'success')
        })
        .catch(function (err) {
          console.error('[6AD] Funding sync error:', err.message)
          addActivity('funding', 'VCC sync error: ' + err.message, 'error')
        })
    })
  })
}

function fetchAllAdAccountsFunding(token, afterCursor, accumulated) {
  var url = GRAPH_API + '/me/adaccounts?fields=account_id,funding_source_details&limit=100&access_token=' + encodeURIComponent(token)
  if (afterCursor) {
    url += '&after=' + encodeURIComponent(afterCursor)
  }

  return fetch(url)
    .then(function (r) { return r.json() })
    .then(function (data) {
      if (data.error) {
        console.error('[6AD] Graph API funding fetch error:', data.error.message)
        return accumulated
      }

      var accounts = data.data || []
      for (var i = 0; i < accounts.length; i++) {
        var acc = accounts[i]
        var accountId = acc.account_id
        if (!accountId) continue

        var fsd = acc.funding_source_details
        if (fsd && fsd.display_string) {
          accumulated[accountId] = [{ id: fsd.id || null, display: fsd.display_string }]
        }
      }

      var paging = data.paging
      if (paging && paging.cursors && paging.cursors.after && accounts.length === 100) {
        return fetchAllAdAccountsFunding(token, paging.cursors.after, accumulated)
      }

      return accumulated
    })
    .catch(function (err) {
      console.error('[6AD] Funding fetch error:', err.message)
      return accumulated
    })
}

// Handle incoming token from content script
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // Handle status request from popup
  if (msg.type === '6AD_GET_STATE') {
    sendResponse(STATE)
    return true
  }

  // Handle clear from popup
  if (msg.type === '6AD_CLEAR') {
    STATE.activities = []
    STATE.stats = { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
    return
  }

  // Handle wake-up ping from popup
  if (msg.type === '6AD_PING') {
    console.log('[6AD] Received ping from popup — triggering heartbeat')
    sendResponse({ alive: true, version: '3.2' })
    doHeartbeat()
    return true
  }

  if (msg.type !== '6AD_TOKEN' || !msg.token) return
  var token = msg.token

  if (!token.startsWith('EAA') || token.length < 50) return

  chrome.storage.local.get(['capturedToken'], function (s) {
    if (token === s.capturedToken) return

    updateStats('tokensFound')
    addActivity('token', 'Token captured (' + token.substring(0, 15) + '...)', 'info')

    STATE.capturedToken = token
    STATE.tokenCapturedAt = new Date().toISOString()
    STATE.tokenValidated = false

    chrome.storage.local.set({
      capturedToken: token,
      tokenCapturedAt: STATE.tokenCapturedAt,
      tokenValidated: false,
      workerStatus: 'online'
    })

    // Validate immediately
    validateToken(token).then(function (result) {
      if (result.valid) {
        STATE.tokenValidated = true
        STATE.fbUserName = result.name
        chrome.storage.local.set({
          tokenValidated: true,
          tokenValidatedAt: new Date().toISOString(),
          fbUserId: result.id,
          fbUserName: result.name
        })
        addActivity('token', 'Token validated — ' + result.name, 'success')
        // Trigger heartbeat immediately to send token to server & pick up tasks
        doHeartbeat()
      } else {
        STATE.tokenValidated = false
        chrome.storage.local.set({ tokenValidated: false })
        addActivity('token', 'Token captured but validation failed', 'error')
      }
    })
  })
})

// ─── Heartbeat (Main Loop) ──────────────────────────────────────

function doHeartbeat() {
  console.log('[6AD] heartbeat() called at', new Date().toISOString())

  chrome.storage.local.get([
    'apiKey', 'serverUrl', 'capturedToken', 'tokenCapturedAt',
    'tokenValidated', 'fbUserId', 'fbUserName'
  ], function (cfg) {
    if (!cfg.apiKey || !cfg.serverUrl) {
      console.log('[6AD] Heartbeat skipped — not configured')
      return
    }

    // Build heartbeat body
    var body = {}

    // Include token if we have a valid one
    var token = cfg.capturedToken
    var tokenAge = cfg.tokenCapturedAt ? (Date.now() - new Date(cfg.tokenCapturedAt).getTime()) : Infinity
    if (token && token.startsWith('EAA') && tokenAge < TOKEN_MAX_AGE_MS && cfg.tokenValidated) {
      body.fbAccessToken = token
    }
    if (cfg.fbUserId) body.fbUserId = cfg.fbUserId
    if (cfg.fbUserName) body.fbUserName = cfg.fbUserName

    var url = cfg.serverUrl.replace(/\/+$/, '') + '/extension/heartbeat'
    console.log('[6AD] Heartbeat:', url)

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiKey
      },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        console.log('[6AD] Heartbeat response:', r.status)
        if (!r.ok) {
          return r.text().then(function (t) {
            throw new Error('HTTP ' + r.status + ': ' + t.substring(0, 200))
          })
        }
        return r.json()
      })
      .then(function (data) {
        console.log('[6AD] Heartbeat OK — jobs:', (data.jobs || []).length,
          'pending:', data.pendingCount, 'bm:', data.pendingBmShareCount,
          'tokenRefresh:', data.tokenRefreshNeeded, 'nextPoll:', data.nextPollMs)

        STATE.lastPollAt = new Date().toISOString()
        STATE.pollError = null
        STATE.profileLabel = data.profileLabel || null

        chrome.storage.local.set({
          lastPollAt: STATE.lastPollAt,
          workerStatus: 'online',
          pollError: null,
          profileLabel: data.profileLabel || null,
          nextPollMs: data.nextPollMs || DEFAULT_POLL_MS
        })

        // Adjust polling speed (adaptive: faster when tasks pending)
        if (data.nextPollMs && data.nextPollMs !== currentPollMs) {
          currentPollMs = data.nextPollMs
          restartPolling()
        }

        // Server says token refresh needed — log it
        STATE.tokenRefreshNeeded = !!data.tokenRefreshNeeded
        if (data.tokenRefreshNeeded) {
          addActivity('token', 'Server needs token — requesting from FB tabs', 'error')
          requestTokenFromTabs()
        }
        chrome.storage.local.set({ tokenRefreshNeeded: STATE.tokenRefreshNeeded })

        // Process jobs
        if (data.jobs && data.jobs.length > 0) {
          addActivity('heartbeat', 'Received ' + data.jobs.length + ' job(s)', 'info')

          // Check if we have a token before attempting jobs
          getLocalToken().then(function (localResult) {
            if (!localResult.valid) {
              // No token — open adsmanager, wait 15s, if still none → trigger CDP auto-login
              console.log('[6AD] Jobs received but no valid token — starting token capture flow...')
              addActivity('token', 'No token — opening Ads Manager + waiting 15s', 'info')
              requestTokenFromTabs()

              // Wait 15 seconds for content script to capture token from adsmanager
              setTimeout(function () {
                getLocalToken().then(function (retryResult) {
                  if (retryResult.valid) {
                    // Token captured after opening adsmanager — process jobs
                    console.log('[6AD] Token captured after 15s wait — processing jobs')
                    addActivity('token', 'Token captured from Ads Manager', 'success')
                    processJobs(data.jobs, cfg.apiKey, cfg.serverUrl)
                  } else {
                    // Still no token — request CDP auto-login from server
                    console.log('[6AD] Still no token after 15s — requesting CDP auto-login...')
                    addActivity('token', 'No token after 15s — requesting CDP auto-login', 'info')
                    requestCdpLogin(cfg.apiKey, cfg.serverUrl)
                    // Don't process jobs now — next heartbeat will retry after CDP login
                  }
                })
              }, 15000)
            } else {
              // Have token — process immediately
              processJobs(data.jobs, cfg.apiKey, cfg.serverUrl)
            }
          })
        }

        // Admin requested VCC card sync — run it from this browser context
        if (data.syncFundingSources) {
          syncFundingSources(cfg.apiKey, cfg.serverUrl)
        }
      })
      .catch(function (err) {
        console.error('[6AD] Heartbeat FAILED:', err.message)
        STATE.pollError = err.message
        chrome.storage.local.set({
          pollError: err.message,
          workerStatus: 'error'
        })
        addActivity('heartbeat', 'Error: ' + err.message, 'error')
      })
  })
}

// ─── Polling Control ─────────────────────────────────────────────

function startPolling() {
  if (pollTimer) return
  console.log('[6AD] Starting heartbeat polling (every ' + (currentPollMs / 1000) + 's)')
  pollTimer = setInterval(doHeartbeat, currentPollMs)
}

function restartPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  console.log('[6AD] Restarting polling (every ' + (currentPollMs / 1000) + 's)')
  pollTimer = setInterval(doHeartbeat, currentPollMs)
}

// Also use chrome.alarms as backup (wakes service worker if it sleeps)
try {
  chrome.alarms.create('6ad_heartbeat', { periodInMinutes: 0.5 })
  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name === '6ad_heartbeat') {
      console.log('[6AD] Alarm fired — heartbeat')
      doHeartbeat()
    }
  })
} catch (e) {
  console.warn('[6AD] chrome.alarms setup failed:', e.message)
}

// ─── Job Execution ───────────────────────────────────────────────

function processJobs(jobs, apiKey, serverUrl) {
  if (isExecuting) return
  isExecuting = true

  // Clean old entries from processedJobIds (older than 2 minutes — allow retries)
  var now = Date.now()
  for (var id in processedJobIds) {
    if (now - processedJobIds[id] > 120000) delete processedJobIds[id]
  }

  // Filter out jobs we've already processed recently
  var newJobs = []
  for (var j = 0; j < jobs.length; j++) {
    if (!processedJobIds[jobs[j].jobId]) {
      newJobs.push(jobs[j])
    } else {
      console.log('[6AD] Skipping already-processed job:', jobs[j].jobId)
    }
  }

  if (newJobs.length === 0) {
    isExecuting = false
    return
  }

  var chain = Promise.resolve()
  for (var i = 0; i < newJobs.length; i++) {
    ;(function (job) {
      chain = chain.then(function () {
        // Mark job as processed BEFORE executing
        processedJobIds[job.jobId] = Date.now()
        if (job.type === 'RECHARGE') return executeRechargeJob(job, apiKey, serverUrl)
        if (job.type === 'BM_SHARE') return executeBmShareJob(job, apiKey, serverUrl)
        console.warn('[6AD] Unknown job type:', job.type)
      })
    })(newJobs[i])
  }

  chain.finally(function () { isExecuting = false })
}

// ─── Server Job API Helpers ──────────────────────────────────────

function claimJob(jobId, apiKey, serverUrl) {
  var url = serverUrl.replace(/\/+$/, '') + '/extension/job/' + jobId + '/claim'
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }
  }).then(function (r) { return r.json() })
}

function completeJob(jobId, result, apiKey, serverUrl) {
  var url = serverUrl.replace(/\/+$/, '') + '/extension/job/' + jobId + '/complete'
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ result: result })
  }).then(function (r) { return r.json() }).then(function (data) {
    if (data.ok) {
      STATE.lastSyncAt = new Date().toISOString()
      chrome.storage.local.set({ lastSyncAt: STATE.lastSyncAt })
    }
  })
}

function failJob(jobId, error, shouldRetry, apiKey, serverUrl) {
  var url = serverUrl.replace(/\/+$/, '') + '/extension/job/' + jobId + '/failed'
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ error: error, shouldRetry: !!shouldRetry })
  }).then(function (r) { return r.json() })
}

// ─── Recharge Execution ─────────────────────────────────────────

function executeRechargeJob(job, apiKey, serverUrl) {
  var p = job.payload
  var accountId = p.fbAdAccountId
  var amount = parseFloat(p.amount) || 0

  return getValidatedToken().then(function (result) {
    if (!result.valid) {
      addActivity('recharge', 'Skipped act_' + accountId + ' — ' + result.reason, 'info')
      // Report failure so server knows and can retry
      return failJob(job.jobId, 'No valid token: ' + result.reason, true, apiKey, serverUrl)
    }

    var token = result.token
    updateStats('tasksReceived')

    // Step 1: Claim the job on server
    return claimJob(job.jobId, apiKey, serverUrl).then(function (claimResult) {
      if (claimResult.error) {
        addActivity('recharge', 'Claim failed act_' + accountId + ': ' + claimResult.error, 'error')
        return
      }

      addActivity('recharge', 'Recharging act_' + accountId + ' (+$' + amount + ')', 'info')

      // Step 2: GET current spend cap
      var getUrl = GRAPH_API + '/act_' + accountId + '?fields=spend_cap&access_token=' + encodeURIComponent(token)
      return fetch(getUrl)
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.error) throw new Error(data.error.message)

          var currentCapCents = parseInt(data.spend_cap) || 0
          var currentCapDollars = currentCapCents / 100
          var newCapDollars = currentCapDollars + amount

          // Step 3: POST new spend cap
          var postUrl = GRAPH_API + '/act_' + accountId
          return fetch(postUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'spend_cap=' + newCapDollars + '&access_token=' + encodeURIComponent(token)
          })
            .then(function (r) { return r.json() })
            .then(function (postResult) {
              if (postResult.error) throw new Error(postResult.error.message)
              if (!postResult.success) throw new Error('Graph API unexpected response')

              addActivity('recharge', 'Recharged act_' + accountId + ' $' + currentCapDollars + ' -> $' + newCapDollars, 'success')
              updateStats('tasksCompleted')

              return completeJob(job.jobId, {
                previousSpendCap: currentCapDollars,
                newSpendCap: newCapDollars
              }, apiKey, serverUrl)
            })
        })
        .catch(function (err) {
          addActivity('recharge', 'Failed act_' + accountId + ': ' + err.message, 'error')
          updateStats('tasksFailed')
          // shouldRetry=true for Graph API errors (might be temporary)
          return failJob(job.jobId, err.message, true, apiKey, serverUrl)
        })
    })
  })
}

// ─── BM Share Execution ─────────────────────────────────────────

function executeBmShareJob(job, apiKey, serverUrl) {
  var p = job.payload
  var accountId = p.adAccountId
  var bmId = p.userBmId

  return getValidatedToken().then(function (result) {
    if (!result.valid) {
      addActivity('bm_share', 'Skipped act_' + accountId + ' — ' + result.reason, 'info')
      return failJob(job.jobId, 'No valid token: ' + result.reason, true, apiKey, serverUrl)
    }

    var token = result.token
    updateStats('tasksReceived')

    // Step 1: Claim the job
    return claimJob(job.jobId, apiKey, serverUrl).then(function (claimResult) {
      if (claimResult.error) {
        addActivity('bm_share', 'Claim failed act_' + accountId + ': ' + claimResult.error, 'error')
        return
      }

      addActivity('bm_share', 'Sharing act_' + accountId + ' to BM ' + bmId, 'info')

      // Step 2: Execute BM share via Graph API
      // Partial access only: ADVERTISE + ANALYZE (campaigns + performance + creative hub)
      // NOT "MANAGE" which gives full control over ad account settings
      var tasks = '["ADVERTISE","ANALYZE"]'
      var url1 = GRAPH_API + '/act_' + accountId + '/agencies'
      var body1 = 'business=' + bmId + '&permitted_tasks=' + encodeURIComponent(tasks) + '&access_token=' + encodeURIComponent(token)

      return fetch(url1, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body1
      })
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.error && data.error.message && data.error.message.toLowerCase().indexOf('unsupported') !== -1) {
            // Method 1 failed — try method 2: POST /{bmId}/client_ad_accounts
            console.log('[6AD] BM share method 1 failed, trying method 2...')
            addActivity('bm_share', 'Trying alternate BM share method...', 'info')
            var url2 = GRAPH_API + '/' + bmId + '/client_ad_accounts'
            var body2 = 'adaccount_id=act_' + accountId + '&access_token=' + encodeURIComponent(token)
            return fetch(url2, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body2
            }).then(function (r2) { return r2.json() })
          }
          return data
        })
        .then(function (data) {
          if (data.error) {
            // Check if error means BM is already shared (duplicate)
            var errMsg = (data.error.message || '').toLowerCase()
            if (errMsg.indexOf('duplicate') !== -1 ||
                errMsg.indexOf('already claimed') !== -1 ||
                errMsg.indexOf('already has access') !== -1 ||
                errMsg.indexOf('already exists') !== -1 ||
                errMsg.indexOf('already been added') !== -1 ||
                errMsg.indexOf('already associated') !== -1 ||
                errMsg.indexOf('already shared') !== -1 ||
                errMsg.indexOf('already assigned') !== -1 ||
                errMsg.indexOf('already a member') !== -1 ||
                errMsg.indexOf('has already been') !== -1 ||
                errMsg.indexOf('relationship already exists') !== -1) {
              // Fetch BM name for duplicate too
              return fetch(GRAPH_API + '/' + bmId + '?fields=name&access_token=' + encodeURIComponent(token))
                .then(function (r) { return r.json() })
                .then(function (bmData) {
                  var bmName = (bmData && bmData.name) ? bmData.name : bmId
                  addActivity('bm_share', 'Already shared act_' + accountId + ' to ' + bmName + ' (duplicate)', 'success')
                  updateStats('tasksCompleted')
                  return completeJob(job.jobId, { method: 'graph_api', wasDuplicate: true, bmName: bmName }, apiKey, serverUrl)
                })
                .catch(function () {
                  addActivity('bm_share', 'Already shared act_' + accountId + ' to BM ' + bmId + ' (duplicate)', 'success')
                  updateStats('tasksCompleted')
                  return completeJob(job.jobId, { method: 'graph_api', wasDuplicate: true, bmName: bmId }, apiKey, serverUrl)
                })
            }
            // Check if BM ID is invalid (non-retryable — reject immediately)
            if (errMsg.indexOf('invalid') !== -1 ||
                errMsg.indexOf('does not exist') !== -1 ||
                errMsg.indexOf('nonexist') !== -1 ||
                errMsg.indexOf('not found') !== -1 ||
                errMsg.indexOf('invalid parameter') !== -1 ||
                errMsg.indexOf('invalid id') !== -1 ||
                (data.error.code && (data.error.code === 100 || data.error.code === 803))) {
              addActivity('bm_share', 'Invalid BM ID ' + bmId + ' for act_' + accountId, 'error')
              updateStats('tasksFailed')
              return failJob(job.jobId, 'BM ID is invalid. Please submit a new request with a correct BM ID.', false, apiKey, serverUrl)
            }
            throw new Error(data.error.message)
          }
          if (!data.success && !data.id) throw new Error('Graph API unexpected response: ' + JSON.stringify(data))

          // Fetch BM name before completing
          return fetch(GRAPH_API + '/' + bmId + '?fields=name&access_token=' + encodeURIComponent(token))
            .then(function (r) { return r.json() })
            .then(function (bmData) {
              var bmName = (bmData && bmData.name) ? bmData.name : bmId
              addActivity('bm_share', 'Shared act_' + accountId + ' to ' + bmName, 'success')
              updateStats('tasksCompleted')
              return completeJob(job.jobId, { method: 'graph_api', bmName: bmName }, apiKey, serverUrl)
            })
            .catch(function () {
              // BM name fetch failed — still complete the job
              addActivity('bm_share', 'Shared act_' + accountId + ' to BM ' + bmId, 'success')
              updateStats('tasksCompleted')
              return completeJob(job.jobId, { method: 'graph_api', bmName: bmId }, apiKey, serverUrl)
            })
        })
        .catch(function (err) {
          addActivity('bm_share', 'Failed act_' + accountId + ': ' + err.message, 'error')
          updateStats('tasksFailed')
          // Non-retryable errors: invalid BM ID messages
          var errLower = (err.message || '').toLowerCase()
          var noRetry = errLower.indexOf('invalid') !== -1 || errLower.indexOf('does not exist') !== -1 || errLower.indexOf('not found') !== -1
          return failJob(job.jobId, err.message, !noRetry, apiKey, serverUrl)
        })
    })
  })
}

// ─── Init ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(function () {
  console.log('[6AD] onInstalled fired')
  chrome.storage.local.get(['serverUrl'], function (cfg) {
    if (!cfg.serverUrl) {
      chrome.storage.local.set({
        serverUrl: 'https://api.6ad.in',
        workerStatus: 'not_configured',
        activities: [],
        stats: { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
      })
    }
  })
  addActivity('system', 'Extension installed (v3.2)', 'info')
})

// ─── Start Everything ────────────────────────────────────────────

addActivity('system', 'Worker started', 'info')

// Start polling immediately
startPolling()

// First heartbeat after 2 seconds
setTimeout(function () {
  console.log('[6AD] Initial heartbeat (2s)')
  doHeartbeat()
}, 2000)

console.log('[6AD] ========== SERVICE WORKER READY ==========')
