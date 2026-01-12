import { Hono } from 'hono'
import { prisma, Platform } from '@6ad/database'
import { z } from 'zod'
import { verifyToken, requireAgent, requireAdmin, requireUser } from '../middleware/auth.js'

const accounts = new Hono()

accounts.use('*', verifyToken)

const createAccountSchema = z.object({
  platform: z.enum(['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING']),
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  bmId: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().default('USD'),
  remarks: z.string().optional(),
})

// GET /accounts - List ad accounts
accounts.get('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { platform, status, targetUserId, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    // Role-based filtering
    if (userRole === 'USER') {
      where.userId = userId
    } else if (userRole === 'AGENT') {
      if (targetUserId) {
        // Verify the user belongs to this agent
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
        if (targetUser?.agentId !== userId) {
          return c.json({ error: 'Access denied' }, 403)
        }
        where.userId = targetUserId
      } else {
        // Get all accounts for users under this agent
        where.user = { agentId: userId }
      }
    } else if (userRole === 'ADMIN') {
      if (targetUserId) {
        where.userId = targetUserId
      }
    }

    if (platform) where.platform = platform.toUpperCase()
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [accountsList, total] = await Promise.all([
      prisma.adAccount.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              uniqueId: true,
              agent: {
                select: { id: true, username: true }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adAccount.count({ where })
    ])

    return c.json({
      accounts: accountsList,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get accounts error:', error)
    return c.json({ error: 'Failed to get accounts' }, 500)
  }
})

// GET /accounts/stats - Get account statistics (Admin only)
accounts.get('/stats', requireAdmin, async (c) => {
  try {
    const { platform } = c.req.query()

    const where: any = {}
    if (platform) where.platform = platform.toUpperCase()

    const [totalAccounts, pendingAccounts, approvedAccounts, totalDeposit, totalSpend] = await Promise.all([
      prisma.adAccount.count({ where }),
      prisma.adAccount.count({ where: { ...where, status: 'PENDING' } }),
      prisma.adAccount.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.adAccount.aggregate({ where, _sum: { totalDeposit: true } }),
      prisma.adAccount.aggregate({ where, _sum: { totalSpend: true } })
    ])

    return c.json({
      totalAccounts,
      pendingAccounts,
      approvedAccounts,
      totalDeposit: totalDeposit._sum.totalDeposit || 0,
      totalSpend: totalSpend._sum.totalSpend || 0,
    })
  } catch (error) {
    console.error('Get account stats error:', error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

// GET /accounts/:platform - Get accounts by platform
accounts.get('/:platform', requireUser, async (c) => {
  try {
    const { platform } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, page = '1', limit = '20' } = c.req.query()

    const platformUpper = platform.toUpperCase() as Platform
    if (!['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING'].includes(platformUpper)) {
      return c.json({ error: 'Invalid platform' }, 400)
    }

    const where: any = { platform: platformUpper }

    if (userRole === 'USER') {
      where.userId = userId
    } else if (userRole === 'AGENT') {
      where.user = { agentId: userId }
    }

    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [accountsList, total, stats] = await Promise.all([
      prisma.adAccount.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true, uniqueId: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adAccount.count({ where }),
      prisma.adAccount.aggregate({
        where: { ...where, status: 'APPROVED' },
        _sum: { totalDeposit: true, totalSpend: true, balance: true },
        _count: true
      })
    ])

    return c.json({
      accounts: accountsList,
      stats: {
        totalAccounts: stats._count,
        totalDeposit: stats._sum.totalDeposit || 0,
        totalSpend: stats._sum.totalSpend || 0,
        totalBalance: stats._sum.balance || 0,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get platform accounts error:', error)
    return c.json({ error: 'Failed to get accounts' }, 500)
  }
})

// POST /accounts - Create new ad account application
accounts.post('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const data = createAccountSchema.parse(body)

    // Check if account ID already exists for this platform
    const existing = await prisma.adAccount.findFirst({
      where: {
        platform: data.platform,
        accountId: data.accountId
      }
    })

    if (existing) {
      return c.json({ error: 'Account ID already exists' }, 409)
    }

    const account = await prisma.adAccount.create({
      data: {
        platform: data.platform,
        accountId: data.accountId,
        accountName: data.accountName,
        bmId: data.bmId,
        timezone: data.timezone,
        currency: data.currency,
        remarks: data.remarks,
        userId,
      }
    })

    return c.json({ message: 'Account application submitted', account }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create account error:', error)
    return c.json({ error: 'Failed to create account' }, 500)
  }
})

// POST /accounts/:id/approve - Approve account (Admin only)
accounts.post('/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const account = await prisma.adAccount.findUnique({ where: { id } })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    if (account.status !== 'PENDING') {
      return c.json({ error: 'Account already processed' }, 400)
    }

    await prisma.adAccount.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks
      }
    })

    return c.json({ message: 'Account approved successfully' })
  } catch (error) {
    console.error('Approve account error:', error)
    return c.json({ error: 'Failed to approve account' }, 500)
  }
})

// POST /accounts/:id/reject
accounts.post('/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    await prisma.adAccount.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks
      }
    })

    return c.json({ message: 'Account rejected' })
  } catch (error) {
    console.error('Reject account error:', error)
    return c.json({ error: 'Failed to reject account' }, 500)
  }
})

// POST /accounts/:id/deposit - Deposit to ad account
accounts.post('/:id/deposit', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const { amount, remarks } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    if (account.userId !== userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    if (account.status !== 'APPROVED') {
      return c.json({ error: 'Account is not approved' }, 400)
    }

    // Check wallet balance
    if (account.user.walletBalance.lessThan(amount)) {
      return c.json({ error: 'Insufficient wallet balance' }, 400)
    }

    // Create account deposit
    const accountDeposit = await prisma.accountDeposit.create({
      data: {
        amount,
        adAccountId: id,
        remarks,
      }
    })

    return c.json({ message: 'Deposit request created', deposit: accountDeposit }, 201)
  } catch (error) {
    console.error('Account deposit error:', error)
    return c.json({ error: 'Failed to create deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/approve - Approve account deposit
accounts.post('/deposits/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const deposit = await prisma.accountDeposit.findUnique({
      where: { id },
      include: {
        adAccount: {
          include: { user: true }
        }
      }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    // Check wallet balance
    if (deposit.adAccount.user.walletBalance.lessThan(deposit.amount)) {
      return c.json({ error: 'Insufficient wallet balance' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date()
        }
      })

      // Update ad account balance
      await tx.adAccount.update({
        where: { id: deposit.adAccountId },
        data: {
          totalDeposit: { increment: deposit.amount },
          balance: { increment: deposit.amount }
        }
      })

      // Deduct from user wallet
      const balanceBefore = deposit.adAccount.user.walletBalance
      const balanceAfter = balanceBefore.sub(deposit.amount)

      await tx.user.update({
        where: { id: deposit.adAccount.userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow
      await tx.walletFlow.create({
        data: {
          type: 'TRANSFER',
          amount: deposit.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'account_deposit',
          userId: deposit.adAccount.userId,
          description: `Deposit to ${deposit.adAccount.platform} account ${deposit.adAccount.accountId}`
        }
      })
    })

    return c.json({ message: 'Account deposit approved' })
  } catch (error) {
    console.error('Approve account deposit error:', error)
    return c.json({ error: 'Failed to approve deposit' }, 500)
  }
})

// PATCH /accounts/:id - Update account details
accounts.patch('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    const account = await prisma.adAccount.update({
      where: { id },
      data: body
    })

    return c.json({ message: 'Account updated', account })
  } catch (error) {
    console.error('Update account error:', error)
    return c.json({ error: 'Failed to update account' }, 500)
  }
})

export default accounts
