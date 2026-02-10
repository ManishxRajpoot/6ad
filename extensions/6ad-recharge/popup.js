/**
 * 6AD Auto Recharge - Popup Script
 * Handles the extension popup UI
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const enableToggle = document.getElementById('enableToggle')
  const statusBar = document.getElementById('statusBar')
  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const apiUrlInput = document.getElementById('apiUrl')
  const apiKeyInput = document.getElementById('apiKey')
  const saveBtn = document.getElementById('saveBtn')
  const configSection = document.getElementById('configSection')
  const infoGrid = document.getElementById('infoGrid')
  const fbProfile = document.getElementById('fbProfile')
  const adAccounts = document.getElementById('adAccounts')
  const lastHeartbeat = document.getElementById('lastHeartbeat')
  const fbToken = document.getElementById('fbToken')
  const errorBanner = document.getElementById('errorBanner')
  const errorText = document.getElementById('errorText')
  const activitySection = document.getElementById('activitySection')
  const activityList = document.getElementById('activityList')
  const refreshBtn = document.getElementById('refreshBtn')

  // Load status
  async function loadStatus() {
    try {
      const status = await chrome.runtime.sendMessage({ type: 'GET_STATUS' })
      updateUI(status)
    } catch (err) {
      setStatus('disconnected', 'Extension error')
      console.error('Failed to get status:', err)
    }
  }

  // Update UI with status
  function updateUI(status) {
    // Toggle
    enableToggle.checked = status.isEnabled

    // API config
    if (status.apiUrl) apiUrlInput.value = status.apiUrl
    if (status.apiKeySet) {
      apiKeyInput.placeholder = status.apiKey || 'ext_xxxx...'
      apiKeyInput.value = ''
    }

    // Status bar
    if (!status.apiKeySet) {
      setStatus('warning', 'No API key configured')
      configSection.style.display = 'block'
      infoGrid.style.display = 'none'
      activitySection.style.display = 'none'
      return
    }

    if (!status.isEnabled) {
      setStatus('disconnected', 'Extension disabled')
    } else if (!status.hasFbToken) {
      setStatus('warning', 'No FB token — open Facebook to capture')
    } else if (status.lastHeartbeat && (Date.now() - status.lastHeartbeat) < 30000) {
      setStatus('connected', `Connected — ${status.adAccountIds?.length || 0} accounts`)
    } else {
      setStatus('warning', 'Connecting...')
    }

    // Info grid
    infoGrid.style.display = 'grid'
    activitySection.style.display = 'block'

    fbProfile.textContent = status.fbUserName || 'Not connected'
    adAccounts.textContent = status.adAccountIds?.length || 0
    fbToken.textContent = status.hasFbToken ? 'Captured' : 'Missing'
    fbToken.style.color = status.hasFbToken ? '#28a745' : '#dc3545'

    if (status.lastHeartbeat) {
      const ago = Math.floor((Date.now() - status.lastHeartbeat) / 1000)
      lastHeartbeat.textContent = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`
    } else {
      lastHeartbeat.textContent = 'Never'
    }

    // Error
    if (status.lastError) {
      errorBanner.style.display = 'block'
      errorText.textContent = status.lastError
    } else {
      errorBanner.style.display = 'none'
    }

    // Activity log
    renderActivity(status.recentActivity || [])
  }

  function setStatus(type, text) {
    statusBar.className = `status-bar ${type}`
    statusText.textContent = text
  }

  function renderActivity(activities) {
    if (activities.length === 0) {
      activityList.innerHTML = '<div class="activity-empty">No activity yet</div>'
      return
    }

    activityList.innerHTML = activities.map(a => {
      const time = formatTime(a.timestamp)
      return `
        <div class="activity-item">
          <span class="activity-dot ${a.type}"></span>
          <span class="activity-message">${escapeHtml(a.message)}</span>
          <span class="activity-time">${time}</span>
        </div>
      `
    }).join('')
  }

  function formatTime(ts) {
    const date = new Date(ts)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return date.toLocaleDateString()
  }

  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  // Save config
  saveBtn.addEventListener('click', async () => {
    const config = {}
    if (apiKeyInput.value) config.apiKey = apiKeyInput.value.trim()
    if (apiUrlInput.value) config.apiUrl = apiUrlInput.value.trim()

    if (!config.apiKey && !apiKeyInput.placeholder.includes('ext_')) {
      apiKeyInput.style.borderColor = '#dc3545'
      return
    }

    saveBtn.textContent = 'Saving...'
    saveBtn.disabled = true

    try {
      await chrome.runtime.sendMessage({ type: 'SAVE_CONFIG', config })
      saveBtn.textContent = 'Saved!'
      saveBtn.style.background = '#28a745'

      setTimeout(() => {
        saveBtn.textContent = 'Save & Connect'
        saveBtn.style.background = ''
        saveBtn.disabled = false
        loadStatus()
      }, 1500)
    } catch (err) {
      saveBtn.textContent = 'Error!'
      saveBtn.style.background = '#dc3545'
      setTimeout(() => {
        saveBtn.textContent = 'Save & Connect'
        saveBtn.style.background = ''
        saveBtn.disabled = false
      }, 1500)
    }
  })

  // Toggle enabled
  enableToggle.addEventListener('change', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_ENABLED',
        enabled: enableToggle.checked
      })
      setTimeout(loadStatus, 500)
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  })

  // Force heartbeat
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.style.opacity = '0.5'
    try {
      await chrome.runtime.sendMessage({ type: 'FORCE_HEARTBEAT' })
      setTimeout(() => {
        refreshBtn.style.opacity = '1'
        loadStatus()
      }, 2000)
    } catch (err) {
      refreshBtn.style.opacity = '1'
    }
  })

  // Initial load
  loadStatus()

  // Auto-refresh every 5 seconds while popup is open
  setInterval(loadStatus, 5000)
})
