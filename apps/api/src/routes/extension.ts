import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()
const app = new Hono()

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
    const { adAccountIds, fbUserId, fbUserName } = body

    const updateData: any = {
      lastSeenAt: new Date(),
      lastError: null,
    }

    if (adAccountIds && Array.isArray(adAccountIds)) {
      updateData.adAccountIds = adAccountIds
    }
    if (fbUserId) updateData.fbUserId = fbUserId
    if (fbUserName) updateData.fbUserName = fbUserName

    await prisma.extensionSession.update({
      where: { id: session.id },
      data: updateData
    })

    // Count pending recharges for this session's accounts
    const sessionAccounts = adAccountIds || session.adAccountIds || []
    let pendingCount = 0

    if (sessionAccounts.length > 0) {
      pendingCount = await prisma.accountDeposit.count({
        where: {
          status: 'APPROVED',
          rechargeStatus: 'PENDING',
          rechargeMethod: 'EXTENSION',
          adAccount: {
            platform: 'FACEBOOK',
            accountId: { in: sessionAccounts }
          }
        }
      })
    }

    return c.json({
      status: 'ok',
      sessionId: session.id,
      pendingCount
    })
  } catch (error: any) {
    console.error('Extension heartbeat error:', error)
    return c.json({ error: 'Heartbeat failed' }, 500)
  }
})

// GET /extension/pending-recharges - Get pending recharges for this extension's accounts
app.get('/pending-recharges', async (c) => {
  try {
    const session = c.get('extensionSession') as any

    if (!session.adAccountIds || session.adAccountIds.length === 0) {
      return c.json({ recharges: [] })
    }

    const deposits = await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        rechargeStatus: 'PENDING',
        rechargeMethod: 'EXTENSION',
        adAccount: {
          platform: 'FACEBOOK',
          accountId: { in: session.adAccountIds }
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

    // Verify this session has access to this account
    if (!session.adAccountIds.includes(deposit.adAccount.accountId)) {
      return c.json({ claimed: false, reason: 'No access to this ad account' })
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

export default app
