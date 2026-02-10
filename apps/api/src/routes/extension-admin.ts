import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import crypto from 'crypto'

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

    return c.json({ sessions })
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

export default app
