/**
 * 6AD Auto Recharge - Ads-Check Token Injection (ISOLATED world)
 * Reads the stored fbAccessToken from chrome.storage.local
 * and sends it to the ads-check page via window.postMessage.
 * Retries up to 3 times in case React hasn't hydrated yet.
 */

;(function () {
  var origin = window.location.origin

  chrome.storage.local.get(['fbAccessToken'], function (data) {
    var token = data.fbAccessToken
    if (!token || token.indexOf('EAA') !== 0 || token.length < 40) {
      console.log('[6AD] No valid token to inject to ads-check')
      return
    }

    console.log('[6AD] Injecting token to ads-check page (len=' + token.length + ')')
    sendToken(token, 0)
  })

  function sendToken(token, attempt) {
    window.postMessage(
      {
        type: '__6AD_ADS_CHECK_TOKEN__',
        token: token,
      },
      origin
    )

    // Retry up to 3 times in case React hasn't hydrated yet
    if (attempt < 2) {
      setTimeout(function () {
        sendToken(token, attempt + 1)
      }, 1000)
    }
  }
})()
