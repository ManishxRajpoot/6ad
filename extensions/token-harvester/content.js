// 6AD Token Harvester — Content Script (MAIN world)
// Intercepts XHR and fetch to capture Facebook EAA access tokens.
// Checks: URL params, POST body, response body

(function () {
  const TOKEN_RE = /EAA[A-Za-z0-9+/=]{20,}/
  let lastToken = ''

  function emit(token) {
    if (token === lastToken) return
    lastToken = token
    window.postMessage({ type: '6AD_TOKEN', token }, '*')
  }

  function scanText(text) {
    if (typeof text !== 'string') return
    var m = text.match(TOKEN_RE)
    if (m) emit(m[0])
  }

  // --- Patch XMLHttpRequest.open (capture URL) ---
  var origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    this._6adUrl = typeof url === 'string' ? url : String(url)
    this.addEventListener('load', function () {
      try {
        // Check URL params
        var urlMatch = this._6adUrl.match(/access_token=(EAA[A-Za-z0-9+/=]{20,})/)
        if (urlMatch) { emit(urlMatch[1]); return }
        // Check response body
        scanText(this.responseText)
      } catch (_) {}
    })
    return origOpen.apply(this, arguments)
  }

  // --- Patch XMLHttpRequest.send (capture POST body) ---
  var origSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (body) {
        var bodyStr = typeof body === 'string' ? body : ''
        if (body instanceof FormData) {
          // FormData — check access_token field
          var token = body.get('access_token')
          if (token && typeof token === 'string' && token.startsWith('EAA')) emit(token)
        } else if (body instanceof URLSearchParams) {
          var token2 = body.get('access_token')
          if (token2 && token2.startsWith('EAA')) emit(token2)
        } else if (bodyStr) {
          // String body — could be URL-encoded or JSON
          var m = bodyStr.match(/access_token=(EAA[A-Za-z0-9+/=]{20,})/)
          if (m) emit(m[1])
          else scanText(bodyStr)
        }
      }
    } catch (_) {}
    return origSend.apply(this, arguments)
  }

  // --- Patch fetch (capture URL, body, and response) ---
  var origFetch = window.fetch
  window.fetch = function (input, init) {
    try {
      // Check request URL
      var reqUrl = typeof input === 'string' ? input : (input && input.url) || ''
      var urlMatch = reqUrl.match(/access_token=(EAA[A-Za-z0-9+/=]{20,})/)
      if (urlMatch) emit(urlMatch[1])

      // Check request body (POST data)
      if (init && init.body) {
        var body = init.body
        if (typeof body === 'string') {
          var m = body.match(/access_token=(EAA[A-Za-z0-9+/=]{20,})/)
          if (m) emit(m[1])
          else scanText(body)
        } else if (body instanceof URLSearchParams) {
          var t = body.get('access_token')
          if (t && t.startsWith('EAA')) emit(t)
        } else if (body instanceof FormData) {
          var t2 = body.get('access_token')
          if (t2 && typeof t2 === 'string' && t2.startsWith('EAA')) emit(t2)
        }
      }
    } catch (_) {}

    return origFetch.apply(this, arguments).then(function (response) {
      var clone = response.clone()
      clone.text().then(function (text) { scanText(text) }).catch(function () {})
      return response
    })
  }
})()
