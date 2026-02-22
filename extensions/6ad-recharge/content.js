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

  // ==================== Auto-Login Detection ====================
  // Detects Facebook login page and auto-fills credentials
  // Gets config from bridge.js (ISOLATED world) via postMessage

  var _6adApiConfig = null
  var _6adLoginAttempted = false

  // Receive API config from bridge.js
  window.addEventListener('message', function(event) {
    if (event.source !== window) return
    if (event.data && event.data.type === '__6AD_CONFIG__') {
      _6adApiConfig = { apiKey: event.data.apiKey, apiUrl: event.data.apiUrl }
      console.log('[6AD] Received API config from bridge')
      // Check if we need to auto-login
      checkAndAutoLogin()
    }
  })

  function isLoginPage() {
    var url = window.location.href.toLowerCase()
    var bodyText = (document.body && document.body.innerText || '').toLowerCase()
    // Check URL patterns
    if (url.includes('/login') || url.includes('login.php') || url.includes('/checkpoint')) return true
    // Check page content
    if (bodyText.includes('log in to facebook') || bodyText.includes('log into facebook')) return true
    // Check if login form exists
    var emailInput = document.querySelector('input[name="email"], input[id="email"], input[type="email"]')
    var passInput = document.querySelector('input[name="pass"], input[id="pass"], input[type="password"]')
    if (emailInput && passInput) return true
    return false
  }

  function isLoggedIn() {
    return !!window.__accessToken || document.cookie.includes('c_user=')
  }

  async function checkAndAutoLogin() {
    if (_6adLoginAttempted || !_6adApiConfig || isLoggedIn()) return

    // Wait for page to settle
    await new Promise(function(r) { setTimeout(r, 3000) })

    if (!isLoginPage() || isLoggedIn()) return

    _6adLoginAttempted = true
    console.log('[6AD] Login page detected, attempting auto-login...')

    try {
      // Fetch credentials from API
      var resp = await fetch(_6adApiConfig.apiUrl.replace(/\/+$/, '') + '/extension/login-credentials', {
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Key': _6adApiConfig.apiKey
        }
      })

      if (!resp.ok) {
        console.log('[6AD] No credentials configured (HTTP ' + resp.status + ')')
        return
      }

      var creds = await resp.json()
      if (!creds.email || !creds.password) {
        console.log('[6AD] No email/password in credentials response')
        return
      }

      console.log('[6AD] Got credentials for: ' + creds.email)

      // Find email input - comprehensive selectors
      var emailSelectors = [
        'input[name="email"]', 'input[id="email"]', 'input[type="email"]',
        'input[name="login"]', 'input[aria-label*="email" i]',
        'input[aria-label*="phone" i]', 'input[placeholder*="email" i]',
        'input[placeholder*="phone" i]', 'input[data-testid="royal_email"]'
      ]
      var emailInput = null
      for (var i = 0; i < emailSelectors.length; i++) {
        emailInput = document.querySelector(emailSelectors[i])
        if (emailInput) break
      }
      // Fallback: any visible text input
      if (!emailInput) {
        var allInputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')
        for (var j = 0; j < allInputs.length; j++) {
          var rect = allInputs[j].getBoundingClientRect()
          if (rect.width > 50 && rect.height > 10 && allInputs[j].type !== 'hidden' && allInputs[j].name !== 'search') {
            emailInput = allInputs[j]
            break
          }
        }
      }

      if (!emailInput) {
        console.log('[6AD] Could not find email input. URL:', window.location.href, 'Title:', document.title)
        window.postMessage({ type: '__6AD_LOGIN_RESULT__', success: false, error: 'No email input found. URL: ' + window.location.href.substring(0, 100) }, '*')
        return
      }

      // Find password input
      var passSelectors = [
        'input[name="pass"]', 'input[id="pass"]', 'input[type="password"]',
        'input[name="password"]', 'input[aria-label*="password" i]',
        'input[placeholder*="password" i]', 'input[data-testid="royal_pass"]'
      ]
      var passInput = null
      for (var k = 0; k < passSelectors.length; k++) {
        passInput = document.querySelector(passSelectors[k])
        if (passInput) break
      }

      if (!passInput) {
        console.log('[6AD] Found email but no password input')
        window.postMessage({ type: '__6AD_LOGIN_RESULT__', success: false, error: 'No password input found' }, '*')
        return
      }

      // Fill credentials using native setter
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set

      emailInput.focus()
      nativeSetter.call(emailInput, creds.email)
      emailInput.dispatchEvent(new Event('input', { bubbles: true }))
      emailInput.dispatchEvent(new Event('change', { bubbles: true }))

      await new Promise(function(r) { setTimeout(r, 800) })

      passInput.focus()
      nativeSetter.call(passInput, creds.password)
      passInput.dispatchEvent(new Event('input', { bubbles: true }))
      passInput.dispatchEvent(new Event('change', { bubbles: true }))

      await new Promise(function(r) { setTimeout(r, 800) })

      // Find and click login button
      var btnSelectors = [
        'button[name="login"]', 'button[type="submit"]',
        'button[data-testid="royal_login_button"]', 'input[type="submit"]',
        'button[id="loginbutton"]', '#loginbutton'
      ]
      var loginBtn = null
      for (var b = 0; b < btnSelectors.length; b++) {
        loginBtn = document.querySelector(btnSelectors[b])
        if (loginBtn) break
      }
      // Fallback: visible button with "Log In" text
      if (!loginBtn) {
        var buttons = document.querySelectorAll('button, [role="button"], a[role="button"]')
        for (var m = 0; m < buttons.length; m++) {
          var text = (buttons[m].textContent || '').trim().toLowerCase()
          if (/^log\s*in$|^sign\s*in$|^continue$/i.test(text)) {
            var btnRect = buttons[m].getBoundingClientRect()
            if (btnRect.width > 20 && btnRect.height > 10) {
              loginBtn = buttons[m]
              break
            }
          }
        }
      }

      if (loginBtn) {
        console.log('[6AD] Clicking login button')
        loginBtn.click()
      } else {
        // Fallback: submit form or Enter key
        var form = passInput.closest('form')
        if (form) {
          form.submit()
        } else {
          passInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
        }
      }

      console.log('[6AD] Auto-login credentials submitted!')
      window.postMessage({ type: '__6AD_LOGIN_RESULT__', success: true }, '*')

    } catch (e) {
      console.error('[6AD] Auto-login error:', e.message)
      window.postMessage({ type: '__6AD_LOGIN_RESULT__', success: false, error: e.message }, '*')
    }
  }

  // Also check on page load with delay (in case config arrives before page is ready)
  function delayedLoginCheck() {
    if (_6adApiConfig && !_6adLoginAttempted) {
      checkAndAutoLogin()
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(delayedLoginCheck, 5000)
  } else {
    window.addEventListener('load', function() {
      setTimeout(delayedLoginCheck, 5000)
    })
  }

  console.log('[6AD] MAIN world interceptors installed on', window.location.hostname)
})()
