// 6AD Worker v3.2 — Bridge Script (ISOLATED world)
// Relays tokens from content.js (MAIN) → background.js via chrome.runtime
// Also relays token requests from background.js → content.js (MAIN)

// Content → Background: token found
window.addEventListener('message', function (event) {
  if (event.source !== window) return
  if (!event.data || event.data.type !== '6AD_TOKEN') return
  if (!event.data.token || typeof event.data.token !== 'string') return

  chrome.runtime.sendMessage({
    type: '6AD_TOKEN',
    token: event.data.token
  })
})

// Background → Content: request token scan
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg && msg.type === '6AD_NEED_TOKEN') {
    window.postMessage({ type: '6AD_NEED_TOKEN' }, '*')
  }
})
