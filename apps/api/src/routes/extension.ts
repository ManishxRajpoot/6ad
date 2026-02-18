import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()
const app = new Hono()

const FB_APP_ID = process.env.FACEBOOK_APP_ID || ''
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''

// Exchange short-lived FB token for long-lived token (60 days)
async function exchangeForLongLivedToken(shortToken: string): Promise<string | null> {
  if (!FB_APP_ID || !FB_APP_SECRET) {
    console.log('[Extension] No FB App credentials configured, skipping token exchange')
    return null
  }

  try {
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortToken)}`
    const res = await fetch(url)
    const data = await res.json() as any

    if (data.access_token) {
      console.log(`[Extension] Token exchanged for long-lived token (expires in ${data.expires_in || 'unknown'}s)`)
      return data.access_token
    } else if (data.error) {
      console.error('[Extension] Token exchange failed:', data.error.message)
      return null
    }
    return null
  } catch (err: any) {
    console.error('[Extension] Token exchange error:', err.message)
    return null
  }
}

// ==================== Extension Auth Middleware ====================

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Verify extension API key from X-Extension-Key header
async function verifyExtensionKey(c: any, next: any) {
  const apiKey = c.req.header('X-Extension-Key')
  if (!apiKey) {
    return c.json({ error: 'Extension API key required' }, 401)
  }

  const keyHash = hashApiKey(apiKey)
  const session = await prisma.extensionSession.findUnique({
    where: { apiKey: keyHash }
  })

  if (!session) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  if (!session.isActive) {
    return c.json({ error: 'Extension session deactivated' }, 403)
  }

  c.set('extensionSession', session)
  await next()
}

// Apply auth to all routes
app.use('*', verifyExtensionKey)

// ==================== Extension Endpoints ====================

// POST /extension/heartbeat - Extension reports health + discovered ad accounts
app.post('/heartbeat', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const body = await c.req.json()
    const { adAccountIds, fbUserId, fbUserName, fbAccessToken } = body

    const updateData: any = {
      lastSeenAt: new Date(),
      lastError: null,
    }

    if (adAccountIds && Array.isArray(adAccountIds)) {
      updateData.adAccountIds = adAccountIds
    }
    if (fbUserId) updateData.fbUserId = fbUserId
    if (fbUserName) updateData.fbUserName = fbUserName

    // If extension sends a new FB token, exchange it for a long-lived token (60 days)
    if (fbAccessToken && fbAccessToken !== session.fbAccessToken) {
      try {
        const longLivedToken = await exchangeForLongLivedToken(fbAccessToken)
        updateData.fbAccessToken = longLivedToken || fbAccessToken
      } catch (tokenErr: any) {
        console.error('[Extension] Token exchange error (non-fatal):', tokenErr.message)
        updateData.fbAccessToken = fbAccessToken
      }
    }

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: updateData
    })

    // Count ALL pending FB extension recharges (not filtered by discovered accounts)
    const [pendingCount, pendingBmShareCount] = await Promise.all([
      prisma.accountDeposit.count({
        where: {
          status: 'APPROVED',
          rechargeStatus: 'PENDING',
          rechargeMethod: 'EXTENSION',
          adAccount: {
            platform: 'FACEBOOK',
          }
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
      status: 'ok',
      sessionId: session.id,
      pendingCount,
      pendingBmShareCount
    })
  } catch (error: any) {
    console.error('Extension heartbeat error:', error)
    return c.json({ error: 'Heartbeat failed' }, 500)
  }
})

// GET /extension/pending-recharges - Get pending recharges for Facebook accounts
// Returns ALL pending extension recharges (not filtered by discovered accounts)
// because Graph API /me/adaccounts doesn't always return all accessible accounts
app.get('/pending-recharges', async (c) => {
  try {
    const session = c.get('extensionSession') as any

    const deposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: 'PENDING',
        rechargeMethod: 'EXTENSION',
        adAccount: {
          platform: 'FACEBOOK',
        }
      },
      include: {
        adAccount: {
          select: {
            id: true,
            accountId: true,
            accountName: true,
            platform: true,
          }
        }
      },
      take: 5,
      orderBy: { approvedAt: 'asc' }
    })

    const recharges = deposits.map(dep => ({
      depositId: dep.id,
      adAccountId: dep.adAccount.accountId,
      adAccountName: dep.adAccount.accountName,
      amount: dep.amount,
      approvedAt: dep.approvedAt,
    }))

    return c.json({ recharges })
  } catch (error: any) {
    console.error('Get pending recharges error:', error)
    return c.json({ error: 'Failed to get pending recharges' }, 500)
  }
})

// POST /extension/recharge/:depositId/claim - Atomically claim a recharge task
app.post('/recharge/:depositId/claim', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { depositId } = c.req.param()

    // Atomically update only if still PENDING
    const deposit = await prisma.accountDeposit.findFirst({
      where: {
        id: depositId,
        rechargeStatus: 'PENDING',
        rechargeMethod: 'EXTENSION',
      },
      include: {
        adAccount: {
          select: { accountId: true, accountName: true }
        }
      }
    })

    if (!deposit) {
      return c.json({ claimed: false, reason: 'Already claimed or not found' })
    }

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'IN_PROGRESS',
        rechargedBy: session.id,
      }
    })

    return c.json({
      claimed: true,
      depositId,
      adAccountId: deposit.adAccount.accountId,
      adAccountName: deposit.adAccount.accountName,
      amount: deposit.amount,
    })
  } catch (error: any) {
    console.error('Claim recharge error:', error)
    return c.json({ error: 'Failed to claim recharge' }, 500)
  }
})

// POST /extension/recharge/:depositId/complete - Report recharge success
app.post('/recharge/:depositId/complete', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { depositId } = c.req.param()
    const body = await c.req.json()
    const { newSpendCap, previousSpendCap } = body

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: 'COMPLETED',
        rechargedAt: new Date(),
        rechargedBy: session.id,
        rechargeError: null,
      }
    })

    // Increment session stats
    await prisma.extensionSession.update({
      where: { id: session.id },
      data: {
        totalRecharges: { increment: 1 },
        lastError: null,
      }
    })

    console.log(`[Extension] Recharge completed: deposit=${depositId}, account=${session.name}, spendCap: ${previousSpendCap} → ${newSpendCap}`)

    return c.json({ status: 'completed' })
  } catch (error: any) {
    console.error('Complete recharge error:', error)
    return c.json({ error: 'Failed to mark recharge complete' }, 500)
  }
})

// POST /extension/recharge/:depositId/failed - Report recharge failure
app.post('/recharge/:depositId/failed', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { depositId } = c.req.param()
    const body = await c.req.json()
    const { error: errorMsg, retryable = true } = body

    const deposit = await prisma.accountDeposit.findUnique({
      where: { id: depositId }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    const newAttempts = (deposit.rechargeAttempts || 0) + 1
    const maxAttempts = 3

    // If exceeded max attempts or not retryable, mark as FAILED permanently
    const newStatus = (!retryable || newAttempts >= maxAttempts) ? 'FAILED' : 'PENDING'

    await prisma.accountDeposit.update({
      where: { id: depositId },
      data: {
        rechargeStatus: newStatus,
        rechargeAttempts: newAttempts,
        rechargeError: errorMsg || 'Unknown error',
        rechargedBy: null, // Release claim so another extension can try
      }
    })

    // Increment session failed stats
    await prisma.extensionSession.update({
      where: { id: session.id },
      data: {
        failedRecharges: { increment: 1 },
        lastError: errorMsg || 'Recharge failed',
      }
    })

    console.error(`[Extension] Recharge failed: deposit=${depositId}, attempt=${newAttempts}/${maxAttempts}, error=${errorMsg}`)

    return c.json({
      status: newStatus === 'FAILED' ? 'permanently_failed' : 'will_retry',
      attemptsUsed: newAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - newAttempts),
    })
  } catch (error: any) {
    console.error('Failed recharge report error:', error)
    return c.json({ error: 'Failed to report recharge failure' }, 500)
  }
})

// ==================== BM SHARE ENDPOINTS ====================

// GET /extension/pending-bm-shares - Get pending BM share requests for extension
app.get('/pending-bm-shares', async (c) => {
  try {
    const requests = await prisma.bmShareRequest.findMany({
      where: {
        status: 'PENDING',
        platform: 'FACEBOOK',
        shareMethod: 'EXTENSION',
      },
      include: {
        user: {
          select: { id: true, username: true }
        }
      },
      take: 5,
      orderBy: { createdAt: 'asc' }
    })

    const bmShares = requests.map(req => ({
      requestId: req.id,
      adAccountId: req.adAccountId,
      adAccountName: req.adAccountName,
      userBmId: req.bmId,
      username: req.user.username,
      createdAt: req.createdAt,
    }))

    return c.json({ bmShares })
  } catch (error: any) {
    console.error('Get pending BM shares error:', error)
    return c.json({ error: 'Failed to get pending BM shares' }, 500)
  }
})

// POST /extension/bm-share/:id/claim - Claim a BM share task
app.post('/bm-share/:id/claim', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { id } = c.req.param()

    const request = await prisma.bmShareRequest.findFirst({
      where: {
        id,
        status: 'PENDING',
        shareMethod: 'EXTENSION',
      }
    })

    if (!request) {
      return c.json({ claimed: false, reason: 'Already claimed or not found' })
    }

    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        adminRemarks: `Being processed by extension (${session.name})...`,
      }
    })

    return c.json({
      claimed: true,
      requestId: id,
      adAccountId: request.adAccountId,
      adAccountName: request.adAccountName,
      userBmId: request.bmId,
    })
  } catch (error: any) {
    console.error('Claim BM share error:', error)
    return c.json({ error: 'Failed to claim BM share' }, 500)
  }
})

// POST /extension/bm-share/:id/complete - Report BM share success
app.post('/bm-share/:id/complete', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { id } = c.req.param()

    const request = await prisma.bmShareRequest.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            agent: {
              select: {
                brandLogo: true, emailLogo: true, username: true,
                emailSenderNameApproved: true, smtpEnabled: true,
                smtpHost: true, smtpPort: true, smtpUsername: true,
                smtpPassword: true, smtpEncryption: true, smtpFromEmail: true,
                customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 }
              }
            }
          }
        }
      }
    })

    if (!request) {
      return c.json({ error: 'BM share request not found' }, 404)
    }

    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks: `BM share completed automatically via extension (${session.name}). Ad account has been shared to your Business Manager.`,
        approvedAt: new Date(),
        shareMethod: 'EXTENSION',
      }
    })

    console.log(`[Extension] BM share completed: request=${id}, account=${request.adAccountId} → BM ${request.bmId}`)

    return c.json({ status: 'completed' })
  } catch (error: any) {
    console.error('Complete BM share error:', error)
    return c.json({ error: 'Failed to mark BM share complete' }, 500)
  }
})

// POST /extension/bm-share/:id/failed - Report BM share failure
app.post('/bm-share/:id/failed', async (c) => {
  try {
    const session = c.get('extensionSession') as any
    const { id } = c.req.param()
    const body = await c.req.json()
    const { error: errorMsg } = body

    const request = await prisma.bmShareRequest.findUnique({
      where: { id }
    })

    if (!request) {
      return c.json({ error: 'BM share request not found' }, 404)
    }

    const newAttempts = (request.shareAttempts || 0) + 1
    const maxAttempts = 3

    if (newAttempts >= maxAttempts) {
      // Max attempts reached — reject
      await prisma.bmShareRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminRemarks: `Auto BM share failed after ${maxAttempts} attempts: ${errorMsg}. Please contact support.`,
          rejectedAt: new Date(),
          shareAttempts: newAttempts,
          shareError: errorMsg,
        }
      })
    } else {
      // Keep pending for retry
      await prisma.bmShareRequest.update({
        where: { id },
        data: {
          shareAttempts: newAttempts,
          shareError: errorMsg,
          adminRemarks: `Auto share attempt ${newAttempts}/${maxAttempts} failed: ${errorMsg}. Retrying...`,
        }
      })
    }

    console.error(`[Extension] BM share failed: request=${id}, attempt=${newAttempts}/${maxAttempts}, error=${errorMsg}`)

    return c.json({
      status: newAttempts >= maxAttempts ? 'permanently_failed' : 'will_retry',
      attemptsUsed: newAttempts,
      attemptsRemaining: Math.max(0, maxAttempts - newAttempts),
    })
  } catch (error: any) {
    console.error('Failed BM share report error:', error)
    return c.json({ error: 'Failed to report BM share failure' }, 500)
  }
})

export default app
