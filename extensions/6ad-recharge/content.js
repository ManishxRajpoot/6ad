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
    }, '*')

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
    // Match bare EAA token anywhere
    var m2 = str.match(/EAA[a-zA-Z0-9]{20,}/)
    if (m2) return m2[0]
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

  // ==================== Also check page HTML for embedded tokens ====================
  // Facebook sometimes embeds tokens in inline scripts. Check after page loads.

  function scanPageForTokens() {
    try {
      // Check inline script tags
      var scripts = document.querySelectorAll('script:not([src])')
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent || ''
        if (text.indexOf('EAA') === -1) continue
        // Look for access token patterns
        var matches = text.match(/"(EAA[a-zA-Z0-9]{40,})"/g)
        if (matches) {
          for (var j = 0; j < matches.length; j++) {
            var token = matches[j].replace(/"/g, '')
            saveToken(token, 'inline-script')
          }
        }
      }

      // Check meta tags or data attributes
      var metas = document.querySelectorAll('meta[content*="EAA"]')
      for (var k = 0; k < metas.length; k++) {
        var content = metas[k].getAttribute('content')
        var mt = extractToken(content)
        if (mt) saveToken(mt, 'meta-tag')
      }
    } catch (e) {}
  }

  // Scan when page loads and after a short delay (for SPA navigation)
  if (document.readyState === 'complete') {
    setTimeout(scanPageForTokens, 2000)
  } else {
    window.addEventListener('load', function() {
      setTimeout(scanPageForTokens, 2000)
    })
  }

  // Also scan on URL changes (SPA navigation)
  var lastUrl = window.location.href
  setInterval(function() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      setTimeout(scanPageForTokens, 3000)
    }
  }, 2000)

  console.log('[6AD] MAIN world interceptors installed on', window.location.hostname)
})()
