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

    // Also store in sessionStorage as backup (background can read this)
    try {
      sessionStorage.setItem('__6ad_token', token)
      sessionStorage.setItem('__6ad_token_time', Date.now().toString())
    } catch(e) {}
  }
})

// Also periodically check if there's a token in the page that wasn't caught by interceptors
setInterval(function() {
  // Look for EAA tokens in the page DOM
  try {
    var scripts = document.querySelectorAll('script:not([src])')
    for (var i = 0; i < Math.min(scripts.length, 50); i++) {
      var text = scripts[i].textContent || ''
      if (text.indexOf('EAA') === -1) continue
      var match = text.match(/"(EAA[a-zA-Z0-9]{40,})"/)
      if (match) {
        var token = match[1]
        // Only send if different from last sent
        var lastSent = sessionStorage.getItem('__6ad_bridge_last')
        if (token !== lastSent) {
          sessionStorage.setItem('__6ad_bridge_last', token)
          console.log('[6AD Bridge] Found token in page HTML, forwarding...')
          chrome.runtime.sendMessage({
            type: 'FB_TOKEN_CAPTURED',
            token: token,
            url: window.location.href,
            source: 'bridge-scan',
            timestamp: Date.now()
          }).catch(function() {})
        }
        break
      }
    }
  } catch(e) {}
}, 10000) // Check every 10 seconds
