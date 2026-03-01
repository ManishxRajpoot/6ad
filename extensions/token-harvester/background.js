// 6AD Worker — Background Service Worker v2.0
// 1. Captures FB tokens from browser (with cookies — session-bound tokens work here)
// 2. Polls server for pending tasks (recharge, BM share)
// 3. Executes Graph API calls from browser context (cookies included)
// 4. Reports results back to server

var GRAPH_API = 'https://graph.facebook.com/v21.0'
var POLL_INTERVAL = 30 * 1000 // 30 seconds
var MAX_ACTIVITY = 20

var lastCapturedToken = ''
var pollTimer = null
var isExecuting = false

// ─── Activity Log ───────────────────────────────────────────────

function addActivity(type, message, status) {
  chrome.storage.local.get(['activities'], function (s) {
    var activities = s.activities || []
    activities.unshift({
      time: new Date().toISOString(),
      type: type,
      message: message,
      status: status // 'success', 'error', 'info'
    })
    if (activities.length > MAX_ACTIVITY) activities = activities.slice(0, MAX_ACTIVITY)
    chrome.storage.local.set({ activities: activities })
  })
}

function updateStats(key) {
  chrome.storage.local.get(['stats'], function (s) {
    var stats = s.stats || { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
    stats[key] = (stats[key] || 0) + 1
    chrome.storage.local.set({ stats: stats })
  })
}

// ─── Token Capture ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type !== '6AD_TOKEN' || !msg.token) return
  if (msg.token === lastCapturedToken) return
  lastCapturedToken = msg.token

  updateStats('tokensFound')

  // Store token locally (used for Graph API calls from this browser)
  chrome.storage.local.set({
    capturedToken: msg.token,
    tokenCapturedAt: new Date().toISOString(),
    workerStatus: 'online'
  })

  addActivity('token', 'Token captured (' + msg.token.substring(0, 12) + '...)', 'info')

  // Also send to server for reference/heartbeat
  chrome.storage.local.get(['apiKey', 'serverUrl'], function (cfg) {
    if (!cfg.apiKey || !cfg.serverUrl) return
    var url = cfg.serverUrl.replace(/\/+$/, '') + '/extension/token'
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
      body: JSON.stringify({ token: msg.token })
    }).then(function (r) { return r.json() }).then(function (data) {
      if (data.ok) {
        chrome.storage.local.set({ lastSyncAt: new Date().toISOString() })
      }
    }).catch(function () {})
  })
})

// ─── Task Polling ───────────────────────────────────────────────

function startPolling() {
  if (pollTimer) return
  console.log('[6AD] Starting task polling (every 30s)')

  // First poll after 5 seconds
  setTimeout(pollForTasks, 5000)

  pollTimer = setInterval(pollForTasks, POLL_INTERVAL)
}

function pollForTasks() {
  chrome.storage.local.get(['apiKey', 'serverUrl'], function (cfg) {
    if (!cfg.apiKey || !cfg.serverUrl) return

    var url = cfg.serverUrl.replace(/\/+$/, '') + '/extension/poll'
    fetch(url, {
      headers: { 'X-API-Key': cfg.apiKey }
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        chrome.storage.local.set({
          lastPollAt: new Date().toISOString(),
          workerStatus: 'online',
          pollError: null
        })

        if (data.tasks && data.tasks.length > 0) {
          console.log('[6AD] Received ' + data.tasks.length + ' task(s)')
          processTasks(data.tasks)
        }
      })
      .catch(function (err) {
        chrome.storage.local.set({ pollError: err.message })
        console.warn('[6AD] Poll error:', err.message)
      })
  })
}

// ─── Task Execution ─────────────────────────────────────────────

function processTasks(tasks) {
  if (isExecuting) return
  isExecuting = true

  var chain = Promise.resolve()
  tasks.forEach(function (task) {
    chain = chain.then(function () {
      if (task.type === 'RECHARGE') return executeRecharge(task)
      if (task.type === 'BM_SHARE') return executeBmShare(task)
    })
  })

  chain.finally(function () { isExecuting = false })
}

function executeRecharge(task) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(['capturedToken'], function (s) {
      var token = s.capturedToken
      if (!token) {
        addActivity('recharge', 'Recharge skipped — no token captured yet', 'error')
        reportResult('RECHARGE', task.depositId, null, false, 'No token captured in browser')
        resolve()
        return
      }

      updateStats('tasksReceived')
      addActivity('recharge', 'Recharging act_' + task.accountId + ' (+$' + task.amount + ')', 'info')

      // Step 1: GET current spend cap
      var getUrl = GRAPH_API + '/act_' + task.accountId + '?fields=spend_cap&access_token=' + token
      fetch(getUrl)
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.error) throw new Error(data.error.message)

          var currentCapCents = parseInt(data.spend_cap) || 0
          var currentCapDollars = currentCapCents / 100
          var newCapDollars = currentCapDollars + task.amount

          // Step 2: POST new spend cap
          var postUrl = GRAPH_API + '/act_' + task.accountId
          return fetch(postUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'spend_cap=' + newCapDollars + '&access_token=' + token
          }).then(function (r) { return r.json() }).then(function (result) {
            if (result.error) throw new Error(result.error.message)
            if (result.success) {
              addActivity('recharge', 'Recharged act_' + task.accountId + ' $' + currentCapDollars + ' -> $' + newCapDollars, 'success')
              updateStats('tasksCompleted')
              reportResult('RECHARGE', task.depositId, null, true, null, {
                previousSpendCap: currentCapDollars,
                newSpendCap: newCapDollars
              })
            } else {
              throw new Error('Unexpected response from Graph API')
            }
          })
        })
        .catch(function (err) {
          addActivity('recharge', 'Failed act_' + task.accountId + ': ' + err.message, 'error')
          updateStats('tasksFailed')
          reportResult('RECHARGE', task.depositId, null, false, err.message)
        })
        .finally(resolve)
    })
  })
}

function executeBmShare(task) {
  return new Promise(function (resolve) {
    chrome.storage.local.get(['capturedToken'], function (s) {
      var token = s.capturedToken
      if (!token) {
        addActivity('bm_share', 'BM Share skipped — no token captured yet', 'error')
        reportResult('BM_SHARE', null, task.requestId, false, 'No token captured in browser')
        resolve()
        return
      }

      updateStats('tasksReceived')
      addActivity('bm_share', 'Sharing act_' + task.accountId + ' to BM ' + task.bmId, 'info')

      var url = GRAPH_API + '/act_' + task.accountId + '/agencies'
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'business=' + task.bmId + '&permitted_tasks=' + encodeURIComponent('["MANAGE"]') + '&access_token=' + token
      })
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.error) throw new Error(data.error.message)
          if (data.success) {
            addActivity('bm_share', 'Shared act_' + task.accountId + ' to BM ' + task.bmId, 'success')
            updateStats('tasksCompleted')
            reportResult('BM_SHARE', null, task.requestId, true)
          } else {
            throw new Error('Unexpected response from Graph API')
          }
        })
        .catch(function (err) {
          addActivity('bm_share', 'Failed act_' + task.accountId + ': ' + err.message, 'error')
          updateStats('tasksFailed')
          reportResult('BM_SHARE', null, task.requestId, false, err.message)
        })
        .finally(resolve)
    })
  })
}

// ─── Report Result to Server ────────────────────────────────────

function reportResult(type, depositId, requestId, success, error, data) {
  chrome.storage.local.get(['apiKey', 'serverUrl'], function (cfg) {
    if (!cfg.apiKey || !cfg.serverUrl) return

    var url = cfg.serverUrl.replace(/\/+$/, '') + '/extension/task-result'
    var body = { type: type, success: success }
    if (depositId) body.depositId = depositId
    if (requestId) body.requestId = requestId
    if (error) body.error = error
    if (data) body.data = data

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
      body: JSON.stringify(body)
    }).catch(function (err) {
      console.warn('[6AD] Failed to report result:', err.message)
    })
  })
}

// ─── Init ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(function () {
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
  addActivity('system', 'Extension installed', 'info')
})

// Start polling on service worker startup
startPolling()
