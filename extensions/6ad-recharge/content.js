/**
 * 6AD Auto Recharge - Content Script (MAIN world)
 * Runs directly in the page context on facebook.com, business.facebook.com, adsmanager.facebook.com
 * Intercepts XHR/fetch to capture EAA access tokens
 */

(function () {
  var _6adLastToken = null
  var _6adTokenSendTimeout = null

  function saveToken(token, source) {
    if (!token || token === _6adLastToken) return
    if (token.indexOf('EAA') !== 0 || token.length < 20) return

    // Clean token - remove any trailing non-alphanumeric chars
    token = token.replace(/[^a-zA-Z0-9]/g, '')
    if (token.length < 20) return

    _6adLastToken = token

    // Since we're in MAIN world, we can't use chrome.runtime.sendMessage directly
    // Use window.postMessage + a separate ISOLATED content script (bridge.js)
    window.postMessage({
      type: '__6AD_TOKEN__',
      token: token,
      source: source
    }, window.location.origin)

    console.log('[6AD] Token captured via ' + source + ' (len=' + token.length + ', ' + token.substring(0, 15) + '...)')
  }

  function extractToken(str) {
    if (!str || typeof str !== 'string') return null
    // Match access_token parameter (URL-encoded or plain)
    var m = str.match(/access_token=([^&\s"']+)/)
    if (m) {
      try {
        var decoded = decodeURIComponent(m[1])
        if (decoded.indexOf('EAA') === 0) return decoded
      } catch(e) {
        if (m[1].indexOf('EAA') === 0) return m[1]
      }
    }
    // Removed: bare EAA regex was capturing garbage from response bodies
    // Only trust access_token= parameter extraction above
    return null
  }

  // ==================== Intercept XMLHttpRequest ====================

  var origOpen = XMLHttpRequest.prototype.open
  var origSend = XMLHttpRequest.prototype.send
  var origSetHeader = XMLHttpRequest.prototype.setRequestHeader

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__6adUrl = url
    this.__6adHeaders = {}
    return origOpen.apply(this, arguments)
  }

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this.__6adHeaders) {
      this.__6adHeaders[name] = value
    }
    // Check for token in Authorization header
    if (name.toLowerCase() === 'authorization' && value) {
      var t = extractToken(value)
      if (t) saveToken(t, 'xhr-auth-header')
    }
    return origSetHeader.apply(this, arguments)
  }

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__6adUrl) {
        var urlStr = String(this.__6adUrl)
        var t = extractToken(urlStr)
        if (t) saveToken(t, 'xhr-url')
      }
      if (body && typeof body === 'string') {
        var t2 = extractToken(body)
        if (t2) saveToken(t2, 'xhr-body')
      }
      if (body && typeof body === 'object' && body.get) {
        try {
          var formToken = body.get('access_token')
          if (formToken && typeof formToken === 'string' && formToken.indexOf('EAA') === 0) {
            saveToken(formToken, 'xhr-formdata')
          }
        } catch (e) {}
      }
    } catch (e) {}
    return origSend.apply(this, arguments)
  }

  // ==================== Intercept fetch ====================

  var origFetch = window.fetch
  window.fetch = function (input, init) {
    try {
      var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '')
      var t = extractToken(url)
      if (t) saveToken(t, 'fetch-url')

      if (init) {
        // Check headers for Authorization
        if (init.headers) {
          var headers = init.headers
          if (typeof headers.get === 'function') {
            var auth = headers.get('Authorization') || headers.get('authorization')
            if (auth) {
              var ht = extractToken(auth)
              if (ht) saveToken(ht, 'fetch-auth-header')
            }
          } else if (typeof headers === 'object') {
            var authVal = headers['Authorization'] || headers['authorization']
            if (authVal) {
              var ht2 = extractToken(authVal)
              if (ht2) saveToken(ht2, 'fetch-auth-header')
            }
          }
        }

        // Check body
        if (init.body) {
          if (typeof init.body === 'string') {
            var bt = extractToken(init.body)
            if (bt) saveToken(bt, 'fetch-body')
          }
          if (typeof init.body === 'object' && init.body.get) {
            try {
              var formToken = init.body.get('access_token')
              if (formToken && typeof formToken === 'string' && formToken.indexOf('EAA') === 0) {
                saveToken(formToken, 'fetch-formdata')
              }
            } catch (e) {}
          }
          // Check URLSearchParams
          if (init.body instanceof URLSearchParams) {
            var usp = init.body.get('access_token')
            if (usp && usp.indexOf('EAA') === 0) {
              saveToken(usp, 'fetch-urlsearchparams')
            }
          }
        }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments)
  }

  // Removed: scanPageForTokens() and all callers — scanning inline scripts/meta tags
  // captures garbage binary data that matches EAA pattern. Real tokens come from
  // XHR/fetch access_token= parameters intercepted above, or window.__accessToken
  // read by background.js.

  // ==================== Auto-Login Detection ====================
  // Detects Facebook login page and auto-fills credentials
  // Gets config from bridge.js (ISOLATED world) via postMessage

  // Auto-login code REMOVED — login is handled by adspower-worker on the server side

  console.log('[6AD] MAIN world interceptors installed on', window.location.hostname)
})()
