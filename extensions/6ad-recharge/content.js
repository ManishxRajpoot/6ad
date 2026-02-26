/**
 * 6AD Auto Recharge - Content Script (MAIN world)
 * Runs directly in the page context on facebook.com, business.facebook.com, adsmanager.facebook.com
 *
 * v1.4.5 — STEALTH MODE: Zero XHR/fetch monkey-patching.
 *          Only passive page scanning (window.__accessToken, <script> tags, require()).
 *          This avoids Facebook's "Malfunctioning browser extension" detection.
 *
 * Token capture is now primarily handled server-side by the CDP worker.
 * This content script is a lightweight backup that passively reads page data.
 */

(function () {
  var _6adLastToken = null

  function saveToken(token, source) {
    if (!token || token === _6adLastToken) return
    if (token.indexOf('EAA') !== 0 || token.length < 20) return

    // DO NOT mutate the token — EAA tokens can contain . _ - characters

    _6adLastToken = token

    // Since we're in MAIN world, we can't use chrome.runtime.sendMessage directly
    // Use window.postMessage + a separate ISOLATED content script (bridge.js)
    window.postMessage({
      type: '__6AD_TOKEN__',
      token: token,
      source: source
    }, '*')

    console.log('[6AD] Token found via ' + source + ' (len=' + token.length + ', ' + token.substring(0, 15) + '...)')
  }

  /** Scan text for EAA tokens in common JSON formats */
  function scanForTokensInText(text, source) {
    if (!text || typeof text !== 'string' || text.length > 2000000) return
    // Pattern 1: "access_token":"EAA..."
    var m1 = text.match(/"access_token"\s*:\s*"(EAA[a-zA-Z0-9._-]{30,500})"/)
    if (m1) saveToken(m1[1], source + '-access_token')
    // Pattern 2: "accessToken":"EAA..."
    var m2 = text.match(/"accessToken"\s*:\s*"(EAA[a-zA-Z0-9._-]{30,500})"/)
    if (m2) saveToken(m2[1], source + '-accessToken')
    // Pattern 3: set(["EAA..."]) — Facebook's requireLazy/module system
    var m3 = text.match(/set\(\["(EAA[a-zA-Z0-9._-]{30,500})"\]\)/)
    if (m3) saveToken(m3[1], source + '-moduleSet')
  }

  // ==================== Passive Page Scanning ====================
  // Reads existing page data without modifying any prototypes or intercepting traffic

  function scanPageForTokens() {
    try {
      // 1. Check window.__accessToken (Facebook's main token variable)
      if (window.__accessToken && typeof window.__accessToken === 'string' && window.__accessToken.indexOf('EAA') === 0) {
        saveToken(window.__accessToken, 'window-__accessToken')
      }

      // 2. Scan <script type="application/json"> tags (Facebook data-sjs payloads)
      var jsonScripts = document.querySelectorAll('script[type="application/json"]')
      for (var i = 0; i < jsonScripts.length; i++) {
        var text = jsonScripts[i].textContent || ''
        if (text.length > 2000000) continue
        scanForTokensInText(text, 'html-json')
      }

      // 3. Scan regular inline <script> tags (no src attribute)
      var scripts = document.querySelectorAll('script:not([type="application/json"]):not([src])')
      for (var j = 0; j < scripts.length; j++) {
        var sText = scripts[j].textContent || ''
        if (sText.length > 2000000) continue
        scanForTokensInText(sText, 'html-script')
      }

      // 4. Try Facebook's internal require system
      if (typeof require === 'function') {
        try {
          var mod = require('CurrentAccessToken')
          if (mod && mod.getToken) {
            var rToken = mod.getToken()
            if (rToken && rToken.indexOf('EAA') === 0 && rToken.length > 40) {
              saveToken(rToken, 'require-CurrentAccessToken')
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // Run page scan after initial load and periodically
  if (document.readyState === 'complete') {
    setTimeout(scanPageForTokens, 3000)
  } else {
    window.addEventListener('load', function () { setTimeout(scanPageForTokens, 3000) })
  }

  // Re-scan every 30 seconds (Facebook SPA loads data dynamically)
  setInterval(scanPageForTokens, 30000)

  // Simple diagnostic log — no interceptor stats since we don't intercept anything
  setInterval(function () {
    console.log('[6AD] content.js passive scan on ' + window.location.hostname +
      ' | LastToken:' + (_6adLastToken ? 'len=' + _6adLastToken.length : 'none'))
  }, 60000)

  console.log('[6AD] Passive page scanner installed on', window.location.hostname, '(v1.4.5 — stealth mode, no interception)')
})()
