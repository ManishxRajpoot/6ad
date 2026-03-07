// 6AD Worker v3.2 — Popup Script
// Gets status from background via messaging (primary) + storage (fallback)

var $apiKey = document.getElementById('apiKey')
var $serverUrl = document.getElementById('serverUrl')
var $save = document.getElementById('save')
var $statusDot = document.getElementById('statusDot')
var $statusLabel = document.getElementById('statusLabel')
var $tokenStatus = document.getElementById('tokenStatus')
var $pollStatus = document.getElementById('pollStatus')
var $tasksCompleted = document.getElementById('tasksCompleted')
var $lastSync = document.getElementById('lastSync')
var $activityList = document.getElementById('activityList')
var $clearActivity = document.getElementById('clearActivity')
var $settingsToggle = document.getElementById('settingsToggle')
var $settingsBody = document.getElementById('settingsBody')
var $settingsArrow = document.getElementById('settingsArrow')

// ─── Load Data (try messaging first, storage fallback) ──

function loadAll() {
  // Try to get state directly from background worker
  try {
    chrome.runtime.sendMessage({ type: '6AD_GET_STATE' }, function (state) {
      if (chrome.runtime.lastError || !state) {
        // Background not responding — fall back to storage
        loadFromStorage()
        return
      }
      // Got state from background — render it
      renderState(state)
    })
  } catch (e) {
    loadFromStorage()
  }
}

function loadFromStorage() {
  chrome.storage.local.get([
    'apiKey', 'serverUrl', 'workerStatus', 'capturedToken', 'tokenCapturedAt',
    'tokenValidated', 'tokenValidatedAt', 'tokenRefreshNeeded',
    'lastPollAt', 'lastSyncAt', 'pollError', 'activities', 'stats',
    'profileLabel', 'fbUserName'
  ], function (cfg) {
    // Load settings inputs only on first load
    if (firstLoad) {
      $apiKey.value = cfg.apiKey || ''
      $serverUrl.value = cfg.serverUrl || 'https://api.6ad.in'
    }

    renderState({
      lastPollAt: cfg.lastPollAt,
      pollError: cfg.pollError,
      capturedToken: cfg.capturedToken,
      tokenCapturedAt: cfg.tokenCapturedAt,
      tokenValidated: cfg.tokenValidated,
      tokenRefreshNeeded: cfg.tokenRefreshNeeded,
      fbUserName: cfg.fbUserName,
      profileLabel: cfg.profileLabel,
      lastSyncAt: cfg.lastSyncAt,
      activities: cfg.activities || [],
      stats: cfg.stats || {},
      _source: 'storage',
      _apiKey: cfg.apiKey
    })
  })
}

function renderState(s) {
  // If from messaging, load settings from storage on first load only
  if (!s._source && firstLoad) {
    chrome.storage.local.get(['apiKey', 'serverUrl'], function (cfg) {
      $apiKey.value = cfg.apiKey || ''
      $serverUrl.value = cfg.serverUrl || 'https://api.6ad.in'
    })
  }

  var hasApiKey = s._apiKey || $apiKey.value.trim()
  updateHeader(s, hasApiKey)
  updateCards(s, hasApiKey)
  updateStats(s.stats || {})
  updateActivities(s.activities || [])
  firstLoad = false
}

// ─── Header Status ───────────────────────────────────────

function updateHeader(s, hasApiKey) {
  var label = s.profileLabel || ''

  if (!hasApiKey) {
    $statusDot.className = 'status-dot offline'
    $statusLabel.textContent = 'Not configured'
    return
  }
  if (s.pollError) {
    $statusDot.className = 'status-dot error'
    $statusLabel.textContent = 'Error'
    return
  }
  if (s.lastPollAt) {
    var pollAge = (Date.now() - new Date(s.lastPollAt).getTime()) / 1000
    if (pollAge < 60) {
      $statusDot.className = 'status-dot online'
      $statusLabel.textContent = label ? label + ' — Online' : 'Online'
    } else if (pollAge < 120) {
      $statusDot.className = 'status-dot stale'
      $statusLabel.textContent = 'Stale'
    } else {
      $statusDot.className = 'status-dot error'
      $statusLabel.textContent = 'Disconnected'
    }
  } else {
    $statusDot.className = 'status-dot stale'
    $statusLabel.textContent = 'Connecting...'
  }
}

// ─── Status Cards ────────────────────────────────────────

function updateCards(s, hasApiKey) {
  // Token card
  if (s.tokenRefreshNeeded) {
    $tokenStatus.textContent = 'Refresh needed'
    $tokenStatus.className = 'card-value err'
  } else if (s.capturedToken && s.tokenCapturedAt) {
    var tokenAge = Date.now() - new Date(s.tokenCapturedAt).getTime()
    if (s.tokenValidated) {
      $tokenStatus.textContent = s.fbUserName || 'Valid'
      $tokenStatus.className = 'card-value ok'
    } else if (tokenAge > 90 * 60 * 1000) {
      $tokenStatus.textContent = 'Expired'
      $tokenStatus.className = 'card-value err'
    } else {
      $tokenStatus.textContent = Math.round(tokenAge / 60000) + 'm ago'
      $tokenStatus.className = 'card-value warn'
    }
  } else {
    $tokenStatus.textContent = 'No Token'
    $tokenStatus.className = 'card-value err'
  }

  // Polling card
  if (!hasApiKey) {
    $pollStatus.textContent = 'No Key'
    $pollStatus.className = 'card-value err'
  } else if (s.pollError) {
    $pollStatus.textContent = 'Error'
    $pollStatus.className = 'card-value err'
  } else if (s.lastPollAt) {
    var pollAge = (Date.now() - new Date(s.lastPollAt).getTime()) / 1000
    if (pollAge < 60) {
      $pollStatus.textContent = 'Active'
      $pollStatus.className = 'card-value ok'
    } else {
      $pollStatus.textContent = timeSince(new Date(s.lastPollAt))
      $pollStatus.className = 'card-value warn'
    }
  } else {
    $pollStatus.textContent = 'Waiting'
    $pollStatus.className = 'card-value warn'
  }

  // Tasks completed
  var stats = s.stats || {}
  $tasksCompleted.textContent = stats.tasksCompleted || 0
  $tasksCompleted.className = 'card-value' + ((stats.tasksCompleted || 0) > 0 ? ' ok' : '')

  // Last sync
  if (s.lastSyncAt) {
    $lastSync.textContent = timeSince(new Date(s.lastSyncAt))
  } else {
    $lastSync.textContent = '--'
  }
  $lastSync.className = 'card-value'
}

// ─── Stats Bar ───────────────────────────────────────────

function updateStats(stats) {
  document.getElementById('statTokens').textContent = stats.tokensFound || 0
  document.getElementById('statReceived').textContent = stats.tasksReceived || 0
  document.getElementById('statCompleted').textContent = stats.tasksCompleted || 0
  document.getElementById('statFailed').textContent = stats.tasksFailed || 0
}

// ─── Activity Log ────────────────────────────────────────

function updateActivities(activities) {
  if (!activities || activities.length === 0) {
    $activityList.innerHTML = '<div class="empty-state">No activity yet</div>'
    return
  }

  var html = ''
  for (var i = 0; i < activities.length; i++) {
    var a = activities[i]
    var icon = a.status === 'success' ? '\u2713' : a.status === 'error' ? '\u2717' : '\u2022'
    var iconClass = a.status || 'info'
    html += '<div class="activity-item">'
    html += '<div class="activity-icon ' + iconClass + '">' + icon + '</div>'
    html += '<div class="activity-content">'
    html += '<div class="activity-msg">' + escapeHtml(a.message) + '</div>'
    html += '<div class="activity-time">' + formatTime(a.time) + '</div>'
    html += '</div></div>'
  }
  $activityList.innerHTML = html
}

// ─── Settings Toggle ─────────────────────────────────────

$settingsToggle.addEventListener('click', function () {
  $settingsBody.classList.toggle('hidden')
  $settingsArrow.classList.toggle('collapsed')
})

// ─── Save Settings ───────────────────────────────────────

$save.addEventListener('click', function () {
  var apiKey = $apiKey.value.trim()
  var serverUrl = $serverUrl.value.trim()
  if (!apiKey) { alert('API Key is required'); return }
  if (!serverUrl) { alert('Server URL is required'); return }

  chrome.storage.local.set({ apiKey: apiKey, serverUrl: serverUrl }, function () {
    $save.textContent = 'Saved!'
    setTimeout(function () { $save.textContent = 'Save Settings' }, 1500)

    // Trigger immediate heartbeat
    try { chrome.runtime.sendMessage({ type: '6AD_PING' }) } catch (e) {}
    setTimeout(loadAll, 2000)
  })
})

// ─── Test Connection ─────────────────────────────────────

document.getElementById('testConnection').addEventListener('click', function () {
  var apiKey = $apiKey.value.trim()
  var serverUrl = $serverUrl.value.trim()
  var $result = document.getElementById('testResult')

  if (!apiKey || !serverUrl) {
    $result.className = 'test-result fail'
    $result.textContent = 'API Key and Server URL are required'
    return
  }

  $result.className = 'test-result'
  $result.textContent = 'Testing...'

  var url = serverUrl.replace(/\/+$/, '') + '/extension/heartbeat'
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({})
  })
    .then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ': ' + t) })
      return r.json()
    })
    .then(function (data) {
      $result.className = 'test-result ok'
      var info = 'Connected!'
      if (data.profileLabel) info += ' Profile: ' + data.profileLabel
      info += ' | Jobs: ' + (data.jobs || []).length
      info += ' | Token: ' + (data.tokenRefreshNeeded ? 'NEEDED' : 'OK')
      $result.textContent = info
    })
    .catch(function (err) {
      $result.className = 'test-result fail'
      $result.textContent = 'Failed: ' + err.message
    })
})

// ─── Clear Activity ──────────────────────────────────────

$clearActivity.addEventListener('click', function () {
  chrome.storage.local.set({
    activities: [],
    stats: { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
  })
  // Also clear in background
  try { chrome.runtime.sendMessage({ type: '6AD_CLEAR' }) } catch (e) {}
  setTimeout(loadAll, 500)
})

// ─── Helpers ─────────────────────────────────────────────

function timeSince(date) {
  var s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function formatTime(iso) {
  try {
    var d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch (e) { return '' }
}

function escapeHtml(str) {
  var div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// ─── Init: wake background + load ────────────────────────

var firstLoad = true

try {
  chrome.runtime.sendMessage({ type: '6AD_PING' }, function () {
    if (chrome.runtime.lastError) {
      console.log('[6AD Popup] Background not responding')
    }
  })
} catch (e) {}

loadAll()
setInterval(loadAll, 3000)
