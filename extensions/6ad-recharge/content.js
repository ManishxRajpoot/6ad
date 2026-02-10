/**
 * 6AD Auto Recharge - Content Script
 * Runs on facebook.com and business.facebook.com
 * Captures EAAG access tokens from the page
 */

(function () {
  'use strict'

  const TOKEN_REGEX = /(?:"accessToken"|"access_token"|accessToken)\s*[:=]\s*"?(EAAG[a-zA-Z0-9]+)"?/g
  let lastToken = null
  let scanCount = 0

  /**
   * Scan all script tags on the page for EAAG tokens
   */
  function scanForTokens() {
    const scripts = document.querySelectorAll('script:not([src])')
    let foundToken = null

    for (const script of scripts) {
      const text = script.textContent || ''
      if (!text.includes('EAAG')) continue

      let match
      TOKEN_REGEX.lastIndex = 0
      while ((match = TOKEN_REGEX.exec(text)) !== null) {
        const token = match[1]
        // EAAG tokens are typically 100+ characters
        if (token && token.length > 50) {
          foundToken = token
          break
        }
      }
      if (foundToken) break
    }

    // Also check meta tags and data attributes
    if (!foundToken) {
      const allElements = document.querySelectorAll('[data-access-token], [data-token]')
      for (const el of allElements) {
        const token = el.getAttribute('data-access-token') || el.getAttribute('data-token')
        if (token && token.startsWith('EAAG') && token.length > 50) {
          foundToken = token
          break
        }
      }
    }

    // Check for token in page source via regex on body innerHTML (last resort, limited)
    if (!foundToken) {
      const bodyText = document.body?.innerHTML || ''
      const quickMatch = bodyText.match(/EAAG[a-zA-Z0-9]{50,}/)
      if (quickMatch) {
        foundToken = quickMatch[0]
      }
    }

    if (foundToken && foundToken !== lastToken) {
      lastToken = foundToken
      // Send token to background script
      chrome.runtime.sendMessage({
        type: 'FB_TOKEN_CAPTURED',
        token: foundToken,
        url: window.location.href,
        timestamp: Date.now()
      }).catch(() => {
        // Extension context may be invalidated
      })
      console.log('[6AD] Access token captured (' + foundToken.substring(0, 12) + '...)')
    }

    scanCount++
  }

  // Initial scan after page load
  setTimeout(scanForTokens, 2000)

  // Observe DOM changes for SPA navigation
  const observer = new MutationObserver((mutations) => {
    // Debounce: only scan if there were significant DOM changes
    let hasScriptChanges = false
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'SCRIPT' || (node.nodeType === 1 && node.querySelector?.('script'))) {
          hasScriptChanges = true
          break
        }
      }
      if (hasScriptChanges) break
    }

    if (hasScriptChanges) {
      // Debounce scans to avoid excessive processing
      clearTimeout(window._6adScanTimeout)
      window._6adScanTimeout = setTimeout(scanForTokens, 1500)
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  // Periodic scan every 30 seconds (FB may load new data)
  setInterval(scanForTokens, 30000)

  // Listen for scan requests from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REQUEST_TOKEN_SCAN') {
      scanForTokens()
      sendResponse({ scanned: true, hasToken: !!lastToken })
    }
    return true
  })

  console.log('[6AD] Content script loaded on', window.location.hostname)
})()
