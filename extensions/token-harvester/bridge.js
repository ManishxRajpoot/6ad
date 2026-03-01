// 6AD Token Harvester — Bridge Script (ISOLATED world)
// Forwards token messages from content.js (MAIN world) to background service worker.

window.addEventListener('message', function (event) {
  if (event.source !== window) return
  if (!event.data || event.data.type !== '6AD_TOKEN') return
  chrome.runtime.sendMessage({ type: '6AD_TOKEN', token: event.data.token })
})
