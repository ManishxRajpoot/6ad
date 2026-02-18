import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'
import { getWorkerStats } from '../services/extension-worker.js'
import { startFbLogin, submit2FACode, getLoginStatus, cancelLogin, getActiveLoginSessions } from '../services/fb-browser.js'

const prisma = new PrismaClient()
const app = new Hono()

// All routes require admin auth
app.use('*', verifyToken)
app.use('*', requireAdmin)

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

function generateApiKey(): string {
  return 'ext_' + crypto.randomBytes(24).toString('hex')
}

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
    const fbRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(fbAccessToken)}`)
    const fbData = await fbRes.json() as any

    if (fbData.error) {
      return c.json({ error: `Invalid token: ${fbData.error.message}` }, 400)
    }

    if (!fbData.id || !fbData.name) {
      return c.json({ error: 'Could not verify token — no user info returned' }, 400)
    }

    // Exchange for long-lived token (60 days)
    let finalToken = fbAccessToken
    const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

    if (FB_APP_ID && FB_APP_SECRET) {
      try {
        const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(fbAccessToken)}`
        const exchangeRes = await fetch(exchangeUrl)
        const exchangeData = await exchangeRes.json() as any
        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token
          console.log(`[Admin] Token exchanged for long-lived (expires in ${exchangeData.expires_in || 'unknown'}s)`)
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

// POST /extension-admin/fb-login - Add a new FB login directly (no extension needed)
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
    const fbRes = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${encodeURIComponent(fbAccessToken)}`)
    const fbData = await fbRes.json() as any

    if (fbData.error) {
      return c.json({ error: `Invalid token: ${fbData.error.message}` }, 400)
    }

    if (!fbData.id || !fbData.name) {
      return c.json({ error: 'Could not verify token' }, 400)
    }

    // Exchange for long-lived token
    let finalToken = fbAccessToken
    const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
    const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

    if (FB_APP_ID && FB_APP_SECRET) {
      try {
        const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(fbAccessToken)}`
        const exchangeRes = await fetch(exchangeUrl)
        const exchangeData = await exchangeRes.json() as any
        if (exchangeData.access_token) {
          finalToken = exchangeData.access_token
        }
      } catch {
        // Use original
      }
    }

    // Create session with a dummy API key (not used for server-side worker)
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

// ==================== Browser-Based FB Login ====================

// POST /extension-admin/fb-browser-login - Start a new browser login session
app.post('/fb-browser-login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }

    const result = await startFbLogin(email, password)
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
