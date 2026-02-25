/**
 * 6AD Auto Recharge - Bridge Script (ISOLATED world)
 * Listens for postMessage from MAIN world content script
 * and forwards tokens to the background service worker via chrome.runtime
 */

window.addEventListener('message', function (event) {
  if (event.source !== window) return
  if (!event.data || event.data.type !== '__6AD_TOKEN__') return

  var token = event.data.token
  if (token && token.indexOf('EAA') === 0 && token.length > 20) {
    console.log('[6AD Bridge] Forwarding token to background (len=' + token.length + ')')

    // Try sending with retry
    function sendToken(attempt) {
      chrome.runtime.sendMessage({
        type: 'FB_TOKEN_CAPTURED',
        token: token,
        url: window.location.href,
        source: event.data.source || 'content-script',
        timestamp: Date.now()
      }).then(function(response) {
        if (response && response.received) {
          console.log('[6AD Bridge] Token forwarded successfully')
        }
      }).catch(function (err) {
        console.log('[6AD Bridge] Send attempt ' + attempt + ' failed:', err.message)
        // Retry up to 3 times with delay
        if (attempt < 3) {
          setTimeout(function() { sendToken(attempt + 1) }, 1000 * attempt)
        }
      })
    }

    sendToken(1)
  }
})

// Auto-login support REMOVED — login is handled by adspower-worker on the server side.
