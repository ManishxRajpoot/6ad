import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { getWorkerStats } from '../services/extension-worker.js'
import { startFbLogin, submit2FACode, getLoginStatus, cancelLogin, getActiveLoginSessions, finishTokenCapture } from '../services/fb-browser.js'

const prisma = new PrismaClient()
const app = new Hono()

const FB_GRAPH = 'https://graph.facebook.com/v21.0'
const JWT_SECRET = process.env.JWT_SECRET || '6ad-secret'

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return 'ext_' + crypto.randomBytes(24).toString('hex')
}

// ==================== Facebook OAuth Flow ====================
// These 2 routes do NOT require auth middleware —
// fb-oauth-url requires admin JWT, fb-oauth-callback is hit by Facebook redirect

// GET /extension-admin/fb-oauth-url - Get Facebook OAuth URL to redirect admin
app.get('/fb-oauth-url', verifyToken, requireAdmin, async (c) => {
  try {
    const FB_APP_ID = process.env.FACEBOOK_APP_ID
    const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 5001}`

    if (!FB_APP_ID) {
      return c.json({ error: 'Facebook App ID not configured' }, 500)
    }

    const sessionId = c.req.query('sessionId') || '' // For refreshing existing session
    const adminId = (c as any).user?.id || ''

    // Encode state as JWT so we can verify it in callback
    const state = jwt.sign(
      { adminId, sessionId, ts: Date.now() },
      JWT_SECRET,
      { expiresIn: '10m' }
    )

    const redirectUri = `${API_URL}/extension-admin/fb-oauth-callback`
    const oauthUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    oauthUrl.searchParams.set('client_id', FB_APP_ID)
    oauthUrl.searchParams.set('redirect_uri', redirectUri)
    oauthUrl.searchParams.set('scope', 'ads_management')
    oauthUrl.searchParams.set('state', state)
    oauthUrl.searchParams.set('response_type', 'code')

    return c.json({ url: oauthUrl.toString() })
  } catch (error: any) {
    console.error('FB OAuth URL error:', error)
    return c.json({ error: 'Failed to generate OAuth URL' }, 500)
  }
})

// GET /extension-admin/fb-oauth-callback - Facebook redirects here after login
// This route does NOT use auth middleware — it's a redirect from Facebook
app.get('/fb-oauth-callback', async (c) => {
  const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3001'
  const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
  const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''
  const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 5001}`
  const redirectUri = `${API_URL}/extension-admin/fb-oauth-callback`

  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const errorParam = c.req.query('error')

    // User denied permission or error
    if (errorParam || !code) {
      const errorDesc = c.req.query('error_description') || 'Login was cancelled'
      return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent(errorDesc)}`)
    }

    // Verify state JWT
    let stateData: any
    try {
      stateData = jwt.verify(state || '', JWT_SECRET) as any
    } catch {
      return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent('Invalid or expired state. Please try again.')}`)
    }

    if (!FB_APP_ID || !FB_APP_SECRET) {
      return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent('Facebook OAuth not configured on server.')}`)
    }

    // Step 1: Exchange code for short-lived token
    const tokenUrl = new URL(`${FB_GRAPH}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', FB_APP_ID)
    tokenUrl.searchParams.set('client_secret', FB_APP_SECRET)
    tokenUrl.searchParams.set('redirect_uri', redirectUri)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenData = await tokenRes.json() as any

    if (tokenData.error) {
      console.error('FB token exchange error:', tokenData.error)
      return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent(tokenData.error.message || 'Token exchange failed')}`)
    }

    // Step 2: Exchange for long-lived token (60 days)
    const longLivedUrl = new URL(`${FB_GRAPH}/oauth/access_token`)
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token')
    longLivedUrl.searchParams.set('client_id', FB_APP_ID)
    longLivedUrl.searchParams.set('client_secret', FB_APP_SECRET)
    longLivedUrl.searchParams.set('fb_exchange_token', tokenData.access_token)

    const longLivedRes = await fetch(longLivedUrl.toString())
    const longLivedData = await longLivedRes.json() as any

    const accessToken = longLivedData.access_token || tokenData.access_token
    const expiresIn = longLivedData.expires_in || tokenData.expires_in || 5184000 // default 60 days

    // Step 3: Get Facebook user info
    const meRes = await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`)
    const meData = await meRes.json() as any

    if (meData.error) {
      return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent(meData.error.message || 'Failed to get user info')}`)
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)

    // Step 4: Create or update ExtensionSession
    const refreshSessionId = stateData.sessionId

    if (refreshSessionId) {
      // Refreshing existing session
      await prisma.extensionSession.update({
        where: { id: refreshSessionId },
        data: {
          fbAccessToken: accessToken,
          fbUserId: meData.id,
          fbUserName: meData.name,
          tokenExpiresAt,
          lastError: null,
        }
      })
      console.log(`[OAuth] Refreshed token for session ${refreshSessionId}: ${meData.name}`)
    } else {
      // New session
      const rawKey = generateApiKey()
      const keyHash = hashApiKey(rawKey)
      const keyPrefix = rawKey.substring(0, 12) + '...'

      await prisma.extensionSession.create({
        data: {
          name: `FB: ${meData.name}`,
          apiKey: keyHash,
          apiKeyPrefix: keyPrefix,
          adAccountIds: [],
          fbAccessToken: accessToken,
          fbUserId: meData.id,
          fbUserName: meData.name,
          tokenExpiresAt,
        }
      })
      console.log(`[OAuth] New session created: ${meData.name} (${meData.id})`)
    }

    // Redirect back to admin
    const action = refreshSessionId ? 'refreshed' : 'success'
    return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=${action}&name=${encodeURIComponent(meData.name)}`)
  } catch (error: any) {
    console.error('FB OAuth callback error:', error)
    return c.redirect(`${ADMIN_URL}/fb-logins?fb_login=error&message=${encodeURIComponent('Server error during login')}`)
  }
})

// ==================== Auth-Protected Routes ====================
// All routes below require admin auth
app.use('*', verifyToken)
app.use('*', requireAdmin)

// ==================== Session Management ====================

// GET /extension-admin/sessions - List all extension sessions
app.get('/sessions', async (c) => {
  try {
    const sessions = await prisma.extensionSession.findMany({
      orderBy: { createdAt: 'desc' }
    })

    // Don't expose actual token, just whether one exists
    const safeSessions = sessions.map(s => ({
      ...s,
      fbAccessToken: s.fbAccessToken ? 'has_token' : null,
    }))

    return c.json({ sessions: safeSessions })
  } catch (error: any) {
    console.error('Get extension sessions error:', error)
    return c.json({ error: 'Failed to get sessions' }, 500)
  }
})

// GET /extension-admin/expiring-sessions - Get sessions with tokens expiring within 7 days
app.get('/expiring-sessions', async (c) => {
  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const sessions = await prisma.extensionSession.findMany({
      where: {
        isActive: true,
        fbAccessToken: { not: null },
        tokenExpiresAt: {
          not: null,
          lte: sevenDaysFromNow,
        },
      },
      select: {
        id: true,
        name: true,
        fbUserName: true,
        fbUserId: true,
        tokenExpiresAt: true,
      },
      orderBy: { tokenExpiresAt: 'asc' },
    })

    return c.json({
      sessions: sessions.map(s => ({
        ...s,
        daysRemaining: s.tokenExpiresAt
          ? Math.max(0, Math.ceil((s.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : 0,
      }))
    })
  } catch (error: any) {
    console.error('Get expiring sessions error:', error)
    return c.json({ error: 'Failed to get expiring sessions' }, 500)
  }
})

// POST /extension-admin/sessions - Create new extension session (generates API key)
app.post('/sessions', async (c) => {
  try {
    const { name } = await c.req.json()

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name is required' }, 400)
    }

    // Generate a random API key
    const rawKey = generateApiKey()
    const keyHash = hashApiKey(rawKey)
    const keyPrefix = rawKey.substring(0, 12) + '...'

    const session = await prisma.extensionSession.create({
      data: {
        name,
        apiKey: keyHash,
        apiKeyPrefix: keyPrefix,
        adAccountIds: [],
      }
    })

    // Return the full key ONCE — it's never shown again
    return c.json({
      session: {
        id: session.id,
        name: session.name,
        apiKeyPrefix: session.apiKeyPrefix,
        isActive: session.isActive,
        createdAt: session.createdAt,
      },
      apiKey: rawKey, // Only returned on creation
    })
  } catch (error: any) {
    console.error('Create extension session error:', error)
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

// DELETE /extension-admin/sessions/:id - Deactivate a session
app.delete('/sessions/:id', async (c) => {
  try {
    const { id } = c.req.param()

    await prisma.extensionSession.update({
      where: { id },
      data: { isActive: false }
    })

    return c.json({ message: 'Session deactivated' })
  } catch (error: any) {
    console.error('Deactivate extension session error:', error)
    return c.json({ error: 'Failed to deactivate session' }, 500)
  }
})

// POST /extension-admin/sessions/:id/set-token - Admin manually sets FB token on a session
app.post('/sessions/:id/set-token', async (c) => {
  try {
    const { id } = c.req.param()
    const { fbAccessToken } = await c.req.json()

    if (!fbAccessToken || typeof fbAccessToken !== 'string') {
      return c.json({ error: 'FB access token is required' }, 400)
    }

    // Validate token by calling FB Graph API
    const fbRes = await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(fbAccessToken)}`)
    const fbData = await fbRes.json() as any

    if (fbData.error) {
      return c.json({ error: `Invalid token: ${fbData.error.message}` }, 400)
    }

    if (!fbData.id || !fbData.name) {
      return c.json({ error: 'Could not verify token — no user info returned' }, 400)
    }

    // Exchange for long-lived token (60 days)
    let finalToken = fbAccessToken
    let tokenExpiresAt: Date | null = null
    const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

    if (FB_APP_ID && FB_APP_SECRET) {
      try {
        const exchangeUrl = `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(fbAccessToken)}`
        const exchangeRes = await fetch(exchangeUrl)
        const exchangeData = await exchangeRes.json() as any
        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token
          const expiresIn = exchangeData.expires_in || 5184000
          tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)
          console.log(`[Admin] Token exchanged for long-lived (expires in ${expiresIn}s)`)
        }
      } catch {
        // Use original token if exchange fails
      }
    }

    await prisma.extensionSession.update({
      where: { id },
      data: {
        fbAccessToken: finalToken,
        fbUserId: fbData.id,
        fbUserName: fbData.name,
        tokenExpiresAt,
        lastError: null,
      }
    })

    return c.json({
      message: 'FB token set successfully',
      fbUserName: fbData.name,
      fbUserId: fbData.id,
    })
  } catch (error: any) {
    console.error('Set token error:', error)
    return c.json({ error: 'Failed to set token' }, 500)
  }
})

// POST /extension-admin/fb-login - Add a new FB login directly (manual token paste)
app.post('/fb-login', async (c) => {
  try {
    const { name, fbAccessToken } = await c.req.json()

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Name is required' }, 400)
    }
    if (!fbAccessToken || typeof fbAccessToken !== 'string') {
      return c.json({ error: 'FB access token is required' }, 400)
    }

    // Validate token
    const fbRes = await fetch(`${FB_GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(fbAccessToken)}`)
    const fbData = await fbRes.json() as any

    if (fbData.error) {
      return c.json({ error: `Invalid token: ${fbData.error.message}` }, 400)
    }

    if (!fbData.id || !fbData.name) {
      return c.json({ error: 'Could not verify token' }, 400)
    }

    // Exchange for long-lived token
    let finalToken = fbAccessToken
    let tokenExpiresAt: Date | null = null
    const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

    if (FB_APP_ID && FB_APP_SECRET) {
      try {
        const exchangeUrl = `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(fbAccessToken)}`
        const exchangeRes = await fetch(exchangeUrl)
        const exchangeData = await exchangeRes.json() as any
        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token
          const expiresIn = exchangeData.expires_in || 5184000
          tokenExpiresAt = new Date(Date.now() + expiresIn * 1000)
        }
      } catch {
        // Use original
      }
    }

    // Create session
    const rawKey = generateApiKey()
    const keyHash = hashApiKey(rawKey)
    const keyPrefix = rawKey.substring(0, 12) + '...'

    const session = await prisma.extensionSession.create({
      data: {
        name,
        apiKey: keyHash,
        apiKeyPrefix: keyPrefix,
        adAccountIds: [],
        fbAccessToken: finalToken,
        fbUserId: fbData.id,
        fbUserName: fbData.name,
        tokenExpiresAt,
      }
    })

    return c.json({
      message: 'FB login added successfully',
      session: {
        id: session.id,
        name: session.name,
        fbUserName: fbData.name,
        fbUserId: fbData.id,
      }
    })
  } catch (error: any) {
    console.error('Add FB login error:', error)
    return c.json({ error: 'Failed to add FB login' }, 500)
  }
})

// ==================== Recharge Queue Management ====================

// GET /extension-admin/recharges - List all extension recharges (pending/in-progress/failed/completed)
app.get('/recharges', async (c) => {
  try {
    const { status } = c.req.query()

    const where: any = {
      rechargeMethod: 'EXTENSION',
    }

    if (status && status !== 'all') {
      where.rechargeStatus = status.toUpperCase()
    } else {
      // By default show non-NONE recharges
      where.rechargeStatus = { not: 'NONE' }
    }

    const deposits = await prisma.accountDeposit.findMany({
      where,
      include: {
        adAccount: {
          select: {
            id: true,
            accountId: true,
            accountName: true,
            platform: true,
            user: {
              select: { id: true, username: true, email: true }
            }
          }
        }
      },
      orderBy: { approvedAt: 'desc' },
      take: 50,
    })

    const recharges = deposits.map(dep => ({
      depositId: dep.id,
      amount: dep.amount,
      adAccountId: dep.adAccount.accountId,
      adAccountName: dep.adAccount.accountName,
      platform: dep.adAccount.platform,
      userName: dep.adAccount.user.username,
      userEmail: dep.adAccount.user.email,
      rechargeStatus: dep.rechargeStatus,
      rechargeMethod: dep.rechargeMethod,
      rechargeAttempts: dep.rechargeAttempts,
      rechargeError: dep.rechargeError,
      rechargedAt: dep.rechargedAt,
      rechargedBy: dep.rechargedBy,
      approvedAt: dep.approvedAt,
      createdAt: dep.createdAt,
      // Calculate wait time in minutes
      waitingMinutes: dep.approvedAt
        ? Math.round((Date.now() - new Date(dep.approvedAt).getTime()) / 60000)
        : 0,
    }))

    return c.json({ recharges })
  } catch (error: any) {
    console.error('Get extension recharges error:', error)
    return c.json({ error: 'Failed to get recharges' }, 500)
  }
})

// POST /extension-admin/recharges/:id/mark-manual - Admin marks recharge as done manually
app.post('/recharges/:id/mark-manual', async (c) => {
  try {
    const { id } = c.req.param()

    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'COMPLETED',
        rechargeMethod: 'MANUAL',
        rechargedAt: new Date(),
        rechargeError: null,
      }
    })

    return c.json({ message: 'Recharge marked as manually completed' })
  } catch (error: any) {
    console.error('Mark manual recharge error:', error)
    return c.json({ error: 'Failed to mark recharge' }, 500)
  }
})

// POST /extension-admin/recharges/:id/retry - Reset failed recharge back to PENDING
app.post('/recharges/:id/retry', async (c) => {
  try {
    const { id } = c.req.param()

    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'PENDING',
        rechargeAttempts: 0,
        rechargeError: null,
        rechargedBy: null,
      }
    })

    return c.json({ message: 'Recharge reset to pending for retry' })
  } catch (error: any) {
    console.error('Retry recharge error:', error)
    return c.json({ error: 'Failed to retry recharge' }, 500)
  }
})

// ==================== Worker Status ====================

// GET /extension-admin/worker-status - Get server-side worker status
app.get('/worker-status', async (c) => {
  try {
    const stats = getWorkerStats()

    // Also get active sessions with valid tokens
    const activeSessions = await prisma.extensionSession.findMany({
      where: {
        isActive: true,
        fbAccessToken: { not: null },
      },
      select: {
        id: true,
        name: true,
        fbUserName: true,
        fbUserId: true,
        lastSeenAt: true,
        totalRecharges: true,
        failedRecharges: true,
      },
      orderBy: { lastSeenAt: 'desc' },
    })

    // Count pending tasks
    const [pendingRecharges, pendingBmShares] = await Promise.all([
      prisma.accountDeposit.count({
        where: {
          status: 'APPROVED',
          rechargeStatus: 'PENDING',
          rechargeMethod: 'EXTENSION',
          adAccount: { platform: 'FACEBOOK' }
        }
      }),
      prisma.bmShareRequest.count({
        where: {
          status: 'PENDING',
          platform: 'FACEBOOK',
          shareMethod: 'EXTENSION',
        }
      })
    ])

    return c.json({
      worker: stats,
      activeSessions,
      pendingTasks: {
        recharges: pendingRecharges,
        bmShares: pendingBmShares,
      }
    })
  } catch (error: any) {
    console.error('Get worker status error:', error)
    return c.json({ error: 'Failed to get worker status' }, 500)
  }
})

// ==================== Browser-Based FB Login (Fallback) ====================

// POST /extension-admin/fb-browser-login - Start a new browser login session
// Manual login: opens Chrome, user logs in manually, system captures tokens
app.post('/fb-browser-login', async (c) => {
  try {
    let body: any = {}
    try { body = await c.req.json() } catch {}

    const result = await startFbLogin(body.email || '', body.password || '', body.twoFASecret || undefined)
    return c.json(result)
  } catch (error: any) {
    console.error('Start FB browser login error:', error)
    return c.json({ error: error.message || 'Failed to start login' }, 500)
  }
})

// POST /extension-admin/fb-browser-login/:sessionId/2fa - Submit 2FA code
app.post('/fb-browser-login/:sessionId/2fa', async (c) => {
  try {
    const { sessionId } = c.req.param()
    const { code } = await c.req.json()

    if (!code) {
      return c.json({ error: '2FA code is required' }, 400)
    }

    await submit2FACode(sessionId, code)
    return c.json({ message: '2FA submitted' })
  } catch (error: any) {
    console.error('Submit 2FA error:', error)
    return c.json({ error: error.message || 'Failed to submit 2FA' }, 500)
  }
})

// GET /extension-admin/fb-browser-login/:sessionId/status - Check login status
app.get('/fb-browser-login/:sessionId/status', async (c) => {
  try {
    const { sessionId } = c.req.param()
    const status = getLoginStatus(sessionId)

    if (!status) {
      return c.json({ error: 'Login session not found or expired' }, 404)
    }

    return c.json(status)
  } catch (error: any) {
    console.error('Get login status error:', error)
    return c.json({ error: 'Failed to get status' }, 500)
  }
})

// POST /extension-admin/fb-browser-login/:sessionId/finish - Finish browsing, validate & save token
app.post('/fb-browser-login/:sessionId/finish', async (c) => {
  try {
    const { sessionId } = c.req.param()
    const result = await finishTokenCapture(sessionId)

    if (result.success) {
      return c.json({ message: `Token captured for ${result.fbName}`, fbName: result.fbName })
    } else {
      return c.json({ error: result.error }, 400)
    }
  } catch (error: any) {
    console.error('Finish token capture error:', error)
    return c.json({ error: error.message || 'Failed to finish' }, 500)
  }
})

// DELETE /extension-admin/fb-browser-login/:sessionId - Cancel a login session
app.delete('/fb-browser-login/:sessionId', async (c) => {
  try {
    const { sessionId } = c.req.param()
    await cancelLogin(sessionId)
    return c.json({ message: 'Login cancelled' })
  } catch (error: any) {
    console.error('Cancel login error:', error)
    return c.json({ error: 'Failed to cancel' }, 500)
  }
})

// GET /extension-admin/fb-browser-login - Get all active login sessions
app.get('/fb-browser-login', async (c) => {
  try {
    const sessions = getActiveLoginSessions()
    return c.json({ sessions })
  } catch (error: any) {
    console.error('Get active login sessions error:', error)
    return c.json({ error: 'Failed to get sessions' }, 500)
  }
})

export default app
