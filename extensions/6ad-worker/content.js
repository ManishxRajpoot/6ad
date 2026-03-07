// 6AD Worker v3.2 — Content Script (MAIN world)
// Intercepts XHR and fetch to capture Facebook access tokens (EAA...)
// Also ACTIVELY scans the page for tokens periodically

;(function () {
  'use strict'

  var sentTokens = {}
  var TOKEN_RE = /access_token=(EAA[A-Za-z0-9]+)/
  var MIN_TOKEN_LEN = 50
  var lastScanToken = null

  function emitToken(token) {
    if (!token || token.length < MIN_TOKEN_LEN) return
    if (!token.startsWith('EAA')) return
    if (sentTokens[token]) return
    sentTokens[token] = true
    console.log('[6AD Content] Token found (' + token.substring(0, 15) + '..., len=' + token.length + ')')
    window.postMessage({ type: '6AD_TOKEN', token: token }, '*')
  }

  function extractFromUrl(url) {
    if (!url || typeof url !== 'string') return
    var m = url.match(TOKEN_RE)
    if (m && m[1]) emitToken(m[1])
  }

  function extractFromBody(body) {
    if (!body) return
    var str = ''
    if (typeof body === 'string') {
      str = body
    } else if (body instanceof URLSearchParams) {
      str = body.toString()
    } else if (typeof FormData !== 'undefined' && body instanceof FormData) {
      try {
        var entries = body.entries()
        var entry = entries.next()
        while (!entry.done) {
          if (entry.value[0] === 'access_token') {
            var val = String(entry.value[1])
            if (val.startsWith('EAA')) emitToken(val)
            return
          }
          var valStr = String(entry.value[1])
          var m = valStr.match(TOKEN_RE)
          if (m && m[1]) emitToken(m[1])
          entry = entries.next()
        }
      } catch (e) {}
      return
    }
    if (str) {
      var m = str.match(TOKEN_RE)
      if (m && m[1]) emitToken(m[1])
      try {
        var params = new URLSearchParams(str)
        var at = params.get('access_token')
        if (at && at.startsWith('EAA')) emitToken(at)
      } catch (e) {}
    }
  }

  function extractFromText(text) {
    if (!text || typeof text !== 'string') return
    var m = text.match(TOKEN_RE)
    if (m && m[1]) emitToken(m[1])
    var jsonRe = /"access_token"\s*:\s*"(EAA[A-Za-z0-9]+)"/g
    var match
    while ((match = jsonRe.exec(text)) !== null) {
      emitToken(match[1])
    }
  }

  // ─── Patch XMLHttpRequest ──────────────────────────────────────

  var origOpen = XMLHttpRequest.prototype.open
  var origSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (method, url) {
    this._6adUrl = url
    extractFromUrl(typeof url === 'string' ? url : String(url))
    return origOpen.apply(this, arguments)
  }

  XMLHttpRequest.prototype.send = function (body) {
    extractFromBody(body)
    var xhr = this
    var origHandler = xhr.onreadystatechange
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        try { extractFromText(xhr.responseText) } catch (e) {}
      }
      if (origHandler) origHandler.apply(this, arguments)
    }
    xhr.addEventListener('load', function () {
      try { extractFromText(xhr.responseText) } catch (e) {}
    })
    return origSend.apply(this, arguments)
  }

  // ─── Patch fetch ───────────────────────────────────────────────

  var origFetch = window.fetch
  window.fetch = function (input, init) {
    var url = ''
    if (typeof input === 'string') url = input
    else if (input instanceof Request) url = input.url
    else if (input && input.toString) url = input.toString()
    extractFromUrl(url)
    if (init && init.body) extractFromBody(init.body)
    return origFetch.apply(this, arguments).then(function (response) {
      try {
        var clone = response.clone()
        clone.text().then(function (text) { extractFromText(text) }).catch(function () {})
      } catch (e) {}
      return response
    })
  }

  // ─── ACTIVE Token Scanning ─────────────────────────────────────
  // Scans the page DOM + JS context for embedded Facebook tokens
  // This catches tokens even when no new API calls are being made

  function scanPageForToken() {
    try {
      // Method 1: Scan <script> tags for accessToken / access_token patterns
      var scripts = document.querySelectorAll('script')
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent
        if (!text || text.indexOf('EAA') === -1) continue

        // "accessToken":"EAAxxxxxx"
        var m1 = text.match(/"accessToken"\s*:\s*"(EAA[A-Za-z0-9]{40,})"/g)
        if (m1) {
          for (var j = 0; j < m1.length; j++) {
            var t = m1[j].match(/"(EAA[A-Za-z0-9]{40,})"/)
            if (t && t[1]) emitToken(t[1])
          }
        }

        // "access_token":"EAAxxxxxx"
        var m2 = text.match(/"access_token"\s*:\s*"(EAA[A-Za-z0-9]{40,})"/g)
        if (m2) {
          for (var k = 0; k < m2.length; k++) {
            var t2 = m2[k].match(/"(EAA[A-Za-z0-9]{40,})"/)
            if (t2 && t2[1]) emitToken(t2[1])
          }
        }

        // access_token=EAAxxxxxx (URL-encoded in inline JS)
        var m3 = text.match(/access_token=(EAA[A-Za-z0-9]{40,})/g)
        if (m3) {
          for (var l = 0; l < m3.length; l++) {
            var t3 = m3[l].match(/=(EAA[A-Za-z0-9]{40,})/)
            if (t3 && t3[1]) emitToken(t3[1])
          }
        }
      }

      // Method 2: Scan <script type="application/json"> tags (Relay/Comet data)
      var jsonScripts = document.querySelectorAll('script[type="application/json"]')
      for (var n = 0; n < jsonScripts.length; n++) {
        var jtext = jsonScripts[n].textContent
        if (!jtext || jtext.indexOf('EAA') === -1) continue
        var jm = jtext.match(/"(EAA[A-Za-z0-9]{40,})"/g)
        if (jm) {
          for (var p = 0; p < jm.length; p++) {
            var t4 = jm[p].replace(/"/g, '')
            emitToken(t4)
          }
        }
      }

      // Method 3: Check known Facebook global JS variables
      try {
        if (window.__accessToken && typeof window.__accessToken === 'string' && window.__accessToken.startsWith('EAA')) {
          emitToken(window.__accessToken)
        }
      } catch (e) {}

      // Method 4: Check for DTSGInitData or similar globals
      try {
        if (window.require) {
          var env = window.require('DTSGInitData')
          if (env && env.token) {
            // DTSG is not an access token, skip
          }
        }
      } catch (e) {}

      // Method 5: Scan data attributes on elements (some FB components store tokens)
      try {
        var dataEls = document.querySelectorAll('[data-access-token]')
        for (var q = 0; q < dataEls.length; q++) {
          var dt = dataEls[q].getAttribute('data-access-token')
          if (dt && dt.startsWith('EAA')) emitToken(dt)
        }
      } catch (e) {}

    } catch (err) {
      console.warn('[6AD Content] Scan error:', err.message)
    }
  }

  // Method 6: Trigger a lightweight Facebook API call to force token capture
  // Makes a simple GET to a FB marketing endpoint — cookies authenticate it,
  // and FB's own JS will include the access token in subsequent calls
  function triggerTokenCapture() {
    try {
      // Navigate to a FB endpoint that forces the page to refresh its token
      // We use an image ping to a graph endpoint — this won't work for token capture
      // Instead, use XMLHttpRequest to /marketing/api which FB handles client-side
      var xhr = new XMLHttpRequest()
      xhr.open('GET', '/ajax/bootloader-endpoint/?modules=AdsLWITypedLogger&__a=1', true)
      xhr.withCredentials = true
      xhr.onload = function () {
        try { extractFromText(xhr.responseText) } catch (e) {}
      }
      xhr.send()
    } catch (e) {
      console.warn('[6AD Content] Trigger capture error:', e.message)
    }
  }

  // ─── Listen for token requests from background (via bridge) ────

  window.addEventListener('message', function (event) {
    if (event.source !== window) return
    if (event.data && event.data.type === '6AD_NEED_TOKEN') {
      console.log('[6AD Content] Token requested — scanning page...')
      scanPageForToken()
      triggerTokenCapture()
    }
  })

  // ─── Periodic Active Scan ──────────────────────────────────────
  // Run scan on page load and every 15 seconds

  function startScanning() {
    // Initial scan after page loads
    scanPageForToken()

    // Periodic scan every 15 seconds
    setInterval(function () {
      scanPageForToken()
    }, 15000)

    // Also trigger a capture attempt every 30 seconds
    setInterval(function () {
      triggerTokenCapture()
    }, 30000)
  }

  // Wait for page to load before first scan
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startScanning, 2000)
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      setTimeout(startScanning, 2000)
    })
  }

  console.log('[6AD Content] v3.2 loaded — passive interception + active scanning')
})()
