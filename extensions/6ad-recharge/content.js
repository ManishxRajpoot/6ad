/**
 * 6AD Auto Recharge - Content Script (MAIN world)
 * Runs directly in the page context on facebook.com, business.facebook.com, adsmanager.facebook.com
 * Intercepts XHR/fetch to capture EAA access tokens
 */

(function () {
  var _6adLastToken = null

  function saveToken(token, source) {
    if (!token || token === _6adLastToken) return
    if (token.indexOf('EAA') !== 0 || token.length < 50) return
    _6adLastToken = token

    // Since we're in MAIN world, we can't use chrome.runtime.sendMessage directly
    // Use window.postMessage + a separate ISOLATED content script, OR use storage
    // But with MAIN world we lose chrome API access. Use postMessage to bridge.
    window.postMessage({
      type: '__6AD_TOKEN__',
      token: token,
      source: source
    }, '*')

    console.log('[6AD] Token captured via ' + source + ' (' + token.substring(0, 15) + '...)')
  }

  // ==================== Intercept XMLHttpRequest ====================

  var origOpen = XMLHttpRequest.prototype.open
  var origSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__6adUrl = url
    return origOpen.apply(this, arguments)
  }

  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (this.__6adUrl) {
        var urlStr = String(this.__6adUrl)
        var m = urlStr.match(/access_token=(EAA[a-zA-Z0-9]+)/)
        if (m) saveToken(m[1], 'xhr-url')
      }
      if (body && typeof body === 'string') {
        var m2 = body.match(/access_token=(EAA[a-zA-Z0-9]+)/)
        if (m2) saveToken(m2[1], 'xhr-body')
      }
      if (body && typeof body === 'object' && body.get) {
        try {
          var t = body.get('access_token')
          if (t && typeof t === 'string') saveToken(t, 'xhr-formdata')
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
      var m = url.match(/access_token=(EAA[a-zA-Z0-9]+)/)
      if (m) saveToken(m[1], 'fetch-url')

      if (init && init.body) {
        if (typeof init.body === 'string') {
          var m2 = init.body.match(/access_token=(EAA[a-zA-Z0-9]+)/)
          if (m2) saveToken(m2[1], 'fetch-body')
        }
        if (typeof init.body === 'object' && init.body.get) {
          try {
            var t = init.body.get('access_token')
            if (t && typeof t === 'string') saveToken(t, 'fetch-params')
          } catch (e) {}
        }
      }
    } catch (e) {}
    return origFetch.apply(this, arguments)
  }

  console.log('[6AD] MAIN world interceptors installed on', window.location.hostname)
})()
