/**
 * 6AD Auto Recharge - Bridge Script (ISOLATED world)
 * Listens for postMessage from MAIN world content script
 * and forwards tokens to the background service worker via chrome.runtime
 */

window.addEventListener('message', function (event) {
  if (event.source !== window) return
  if (!event.data || event.data.type !== '__6AD_TOKEN__') return

  var token = event.data.token
  if (token && token.indexOf('EAA') === 0 && token.length > 50) {
    chrome.runtime.sendMessage({
      type: 'FB_TOKEN_CAPTURED',
      token: token,
      url: window.location.href,
      timestamp: Date.now()
    }).catch(function () {})
  }
})
