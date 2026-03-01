// 6AD Worker — Popup Script v2.0

var $apiKey = document.getElementById('apiKey')
var $serverUrl = document.getElementById('serverUrl')
var $save = document.getElementById('save')
var $statusDot = document.getElementById('statusDot')
var $statusLabel = document.getElementById('statusLabel')
var $tokenStatus = document.getElementById('tokenStatus')
var $pollStatus = document.getElementById('pollStatus')
var $lastPoll = document.getElementById('lastPoll')
var $lastSync = document.getElementById('lastSync')
var $activityList = document.getElementById('activityList')
var $clearActivity = document.getElementById('clearActivity')
var $settingsToggle = document.getElementById('settingsToggle')
var $settingsBody = document.getElementById('settingsBody')
var $settingsArrow = document.getElementById('settingsArrow')

// ─── Load Data ──────────────────────────────────────────────────

function loadAll() {
  chrome.storage.local.get([
    'apiKey', 'serverUrl', 'workerStatus', 'capturedToken', 'tokenCapturedAt',
    'lastPollAt', 'lastSyncAt', 'pollError', 'activities', 'stats'
  ], function (cfg) {
    $apiKey.value = cfg.apiKey || ''
    $serverUrl.value = cfg.serverUrl || 'https://api.6ad.in'

    // Collapse settings if already configured
    if (cfg.apiKey) {
      $settingsBody.classList.add('hidden')
      $settingsArrow.classList.add('collapsed')
    }

    updateHeader(cfg)
    updateStatus(cfg)
    updateActivities(cfg.activities || [])
    updateStats(cfg.stats || {})
  })
}

// ─── Header Status ──────────────────────────────────────────────

function updateHeader(cfg) {
  if (!cfg.apiKey) {
    $statusDot.className = 'status-dot offline'
    $statusLabel.textContent = 'Not configured'
    return
  }
  if (cfg.pollError) {
    $statusDot.className = 'status-dot offline'
    $statusLabel.textContent = 'Error'
    return
  }
  if (cfg.lastPollAt) {
    var pollAge = (Date.now() - new Date(cfg.lastPollAt).getTime()) / 1000
    if (pollAge < 60) {
      $statusDot.className = 'status-dot online'
      $statusLabel.textContent = 'Online'
    } else {
      $statusDot.className = 'status-dot waiting'
      $statusLabel.textContent = 'Stale'
    }
  } else {
    $statusDot.className = 'status-dot waiting'
    $statusLabel.textContent = 'Connecting...'
  }
}

// ─── Status Grid ────────────────────────────────────────────────

function updateStatus(cfg) {
  // Token
  if (cfg.capturedToken && cfg.tokenCapturedAt) {
    $tokenStatus.textContent = 'Captured ' + timeSince(new Date(cfg.tokenCapturedAt))
    $tokenStatus.className = 'value ok'
  } else {
    $tokenStatus.textContent = 'Waiting...'
    $tokenStatus.className = 'value warn'
  }

  // Polling
  if (!cfg.apiKey) {
    $pollStatus.textContent = 'Not configured'
    $pollStatus.className = 'value err'
  } else if (cfg.pollError) {
    $pollStatus.textContent = 'Error'
    $pollStatus.className = 'value err'
  } else {
    $pollStatus.textContent = 'Active (30s)'
    $pollStatus.className = 'value ok'
  }

  // Last Poll
  if (cfg.lastPollAt) {
    $lastPoll.textContent = timeSince(new Date(cfg.lastPollAt))
    $lastPoll.className = 'value'
  } else {
    $lastPoll.textContent = '--'
    $lastPoll.className = 'value'
  }

  // Last Sync
  if (cfg.lastSyncAt) {
    $lastSync.textContent = timeSince(new Date(cfg.lastSyncAt))
    $lastSync.className = 'value'
  } else {
    $lastSync.textContent = '--'
    $lastSync.className = 'value'
  }
}

// ─── Activity Log ───────────────────────────────────────────────

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

// ─── Stats Bar ──────────────────────────────────────────────────

function updateStats(stats) {
  document.getElementById('statTokens').textContent = stats.tokensFound || 0
  document.getElementById('statReceived').textContent = stats.tasksReceived || 0
  document.getElementById('statCompleted').textContent = stats.tasksCompleted || 0
  document.getElementById('statFailed').textContent = stats.tasksFailed || 0
}

// ─── Settings Toggle ────────────────────────────────────────────

$settingsToggle.addEventListener('click', function () {
  $settingsBody.classList.toggle('hidden')
  $settingsArrow.classList.toggle('collapsed')
})

// ─── Save Settings ──────────────────────────────────────────────

$save.addEventListener('click', function () {
  var apiKey = $apiKey.value.trim()
  var serverUrl = $serverUrl.value.trim()
  if (!apiKey) return alert('API Key is required')
  if (!serverUrl) return alert('Server URL is required')
  chrome.storage.local.set({ apiKey: apiKey, serverUrl: serverUrl }, function () {
    $settingsBody.classList.add('hidden')
    $settingsArrow.classList.add('collapsed')
    loadAll()
  })
})

// ─── Clear Activity ─────────────────────────────────────────────

$clearActivity.addEventListener('click', function () {
  chrome.storage.local.set({
    activities: [],
    stats: { tasksReceived: 0, tasksCompleted: 0, tasksFailed: 0, tokensFound: 0 }
  }, loadAll)
})

// ─── Helpers ────────────────────────────────────────────────────

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

// ─── Auto-refresh every 5 seconds ──────────────────────────────

loadAll()
setInterval(loadAll, 5000)
