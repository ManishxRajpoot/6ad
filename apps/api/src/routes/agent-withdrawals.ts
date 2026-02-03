import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { verifyToken, requireAgent, requireAdmin } from '../middleware/auth.js'

const prisma = new PrismaClient()
const agentWithdrawals = new Hono()

agentWithdrawals.use('*', verifyToken)

// Validation schema for creating withdrawal
const createWithdrawalSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  paymentAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
})

// ============= AGENT ROUTES =============

// Minimum amount required to withdraw
const MINIMUM_WITHDRAWAL_AMOUNT = 200

// GET /agent-withdrawals/stats - Get agent's withdrawal stats
agentWithdrawals.get('/stats', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')

    // Get agent's data
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: {
        walletBalance: true,
        referralEarnings: true,
      }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Get all users under this agent
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    // ============= LIFETIME EARNINGS =============
    // Get total commission earned from account deposits (lifetime)
    const lifetimeDepositsCommission = await prisma.accountDeposit.aggregate({
      where: {
        adAccount: {
          userId: { in: userIds }
        },
        status: 'APPROVED'
      },
      _sum: {
        commissionAmount: true
      }
    })

    // Get total opening fees from approved applications (lifetime)
    const lifetimeOpeningFees = await prisma.adAccountApplication.aggregate({
      where: {
        userId: { in: userIds },
        status: 'APPROVED'
      },
      _sum: {
        openingFee: true
      }
    })

    // ============= TODAY'S REVENUE =============
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Today's commission from account deposits
    const todayDepositsCommission = await prisma.accountDeposit.aggregate({
      where: {
        adAccount: {
          userId: { in: userIds }
        },
        status: 'APPROVED',
        approvedAt: { gte: today }
      },
      _sum: {
        commissionAmount: true
      }
    })

    // Today's opening fees from approved applications
    const todayOpeningFees = await prisma.adAccountApplication.aggregate({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        approvedAt: { gte: today }
      },
      _sum: {
        openingFee: true
      }
    })

    // ============= WITHDRAWAL DATA =============
    // Get total withdrawn amount
    const withdrawnAmount = await prisma.agentWithdrawal.aggregate({
      where: {
        agentId,
        status: 'APPROVED'
      },
      _sum: {
        amount: true
      }
    })

    // Get pending withdrawals
    const pendingWithdrawals = await prisma.agentWithdrawal.aggregate({
      where: {
        agentId,
        status: 'PENDING'
      },
      _sum: {
        amount: true
      }
    })

    // ============= AD ACCOUNTS =============
    // Get total active ad accounts count (all users under agent)
    const totalAdAccounts = await prisma.adAccount.count({
      where: {
        userId: { in: userIds },
        status: 'APPROVED'
      }
    })

    // Get pending accounts count
    const pendingAccounts = await prisma.adAccountApplication.count({
      where: {
        userId: { in: userIds },
        status: 'PENDING'
      }
    })

    // ============= CALCULATIONS =============
    // Total lifetime earned = commission from deposits + opening fees
    const totalEarned =
      (lifetimeDepositsCommission._sum.commissionAmount || 0) +
      (lifetimeOpeningFees._sum.openingFee || 0)

    // Today's revenue = today's commission + today's opening fees
    const todayRevenue =
      (todayDepositsCommission._sum.commissionAmount || 0) +
      (todayOpeningFees._sum.openingFee || 0)

    // Available to withdraw = total earned - already withdrawn - pending withdrawals
    const availableBalance = totalEarned - (withdrawnAmount._sum.amount || 0) - (pendingWithdrawals._sum.amount || 0)

    // Only show available if >= minimum withdrawal amount ($200)
    const availableToWithdraw = Math.max(0, availableBalance)
    const canWithdraw = availableToWithdraw >= MINIMUM_WITHDRAWAL_AMOUNT

    return c.json({
      availableToWithdraw,
      todayRevenue,
      totalAdAccounts,
      pendingAccounts,
      totalEarned,
      totalWithdrawn: withdrawnAmount._sum.amount || 0,
      pendingWithdrawalAmount: pendingWithdrawals._sum.amount || 0,
      minimumWithdrawal: MINIMUM_WITHDRAWAL_AMOUNT,
      canWithdraw,
    })
  } catch (error) {
    console.error('Get agent withdrawal stats error:', error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

// GET /agent-withdrawals - Get agent's withdrawal history
agentWithdrawals.get('/', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { page = '1', limit = '20', status } = c.req.query()

    const where: any = { agentId }
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [withdrawals, total] = await Promise.all([
      prisma.agentWithdrawal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.agentWithdrawal.count({ where })
    ])

    return c.json({
      withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get agent withdrawals error:', error)
    return c.json({ error: 'Failed to get withdrawals' }, 500)
  }
})

// POST /agent-withdrawals - Create new withdrawal request
agentWithdrawals.post('/', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const body = await c.req.json()
    const data = createWithdrawalSchema.parse(body)

    // Get agent's available balance first
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Calculate available to withdraw (same logic as stats)
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    const depositsCommission = await prisma.accountDeposit.aggregate({
      where: {
        adAccount: { userId: { in: userIds } },
        status: 'APPROVED'
      },
      _sum: { commissionAmount: true }
    })

    const openingFees = await prisma.adAccountApplication.aggregate({
      where: {
        userId: { in: userIds },
        status: 'APPROVED'
      },
      _sum: { openingFee: true }
    })

    const withdrawnAmount = await prisma.agentWithdrawal.aggregate({
      where: { agentId, status: 'APPROVED' },
      _sum: { amount: true }
    })

    const pendingWithdrawals = await prisma.agentWithdrawal.aggregate({
      where: { agentId, status: 'PENDING' },
      _sum: { amount: true }
    })

    const totalEarned =
      (depositsCommission._sum.commissionAmount || 0) +
      (openingFees._sum.openingFee || 0)

    const availableToWithdraw = totalEarned -
      (withdrawnAmount._sum.amount || 0) -
      (pendingWithdrawals._sum.amount || 0)

    // Check minimum withdrawal amount
    if (availableToWithdraw < MINIMUM_WITHDRAWAL_AMOUNT) {
      return c.json({
        error: `Minimum withdrawal amount is $${MINIMUM_WITHDRAWAL_AMOUNT}. Your available balance is $${availableToWithdraw.toFixed(2)}`,
        available: availableToWithdraw,
        minimum: MINIMUM_WITHDRAWAL_AMOUNT
      }, 400)
    }

    if (data.amount > availableToWithdraw) {
      return c.json({
        error: 'Insufficient balance',
        available: availableToWithdraw,
        requested: data.amount
      }, 400)
    }

    if (data.amount < MINIMUM_WITHDRAWAL_AMOUNT) {
      return c.json({
        error: `Minimum withdrawal amount is $${MINIMUM_WITHDRAWAL_AMOUNT}`,
        minimum: MINIMUM_WITHDRAWAL_AMOUNT,
        requested: data.amount
      }, 400)
    }

    // Create withdrawal request
    const withdrawal = await prisma.agentWithdrawal.create({
      data: {
        amount: data.amount,
        paymentAddress: data.paymentAddress,
        paymentMethod: data.paymentMethod,
        description: data.description,
        agentId,
      }
    })

    return c.json({
      message: 'Withdrawal request submitted successfully',
      withdrawal
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create agent withdrawal error:', error)
    return c.json({ error: 'Failed to create withdrawal request' }, 500)
  }
})

// ============= ADMIN ROUTES =============

// GET /agent-withdrawals/admin - Get all agent withdrawals (Admin)
agentWithdrawals.get('/admin', requireAdmin, async (c) => {
  try {
    const { page = '1', limit = '20', status, search } = c.req.query()

    const where: any = {}
    if (status) where.status = status.toUpperCase()
    if (search) {
      where.OR = [
        { agent: { username: { contains: search, mode: 'insensitive' } } },
        { agent: { email: { contains: search, mode: 'insensitive' } } },
        { paymentAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [withdrawals, total] = await Promise.all([
      prisma.agentWithdrawal.findMany({
        where,
        include: {
          agent: {
            select: { id: true, username: true, email: true, realName: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.agentWithdrawal.count({ where })
    ])

    return c.json({
      withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get all agent withdrawals error:', error)
    return c.json({ error: 'Failed to get withdrawals' }, 500)
  }
})

// POST /agent-withdrawals/:id/approve - Approve withdrawal (Admin)
agentWithdrawals.post('/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const withdrawal = await prisma.agentWithdrawal.findUnique({ where: { id } })

    if (!withdrawal) {
      return c.json({ error: 'Withdrawal not found' }, 404)
    }

    if (withdrawal.status !== 'PENDING') {
      return c.json({ error: 'Withdrawal already processed' }, 400)
    }

    await prisma.agentWithdrawal.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks,
        approvedAt: new Date(),
        clearedAt: new Date(),
      }
    })

    return c.json({ message: 'Withdrawal approved' })
  } catch (error) {
    console.error('Approve agent withdrawal error:', error)
    return c.json({ error: 'Failed to approve withdrawal' }, 500)
  }
})

// POST /agent-withdrawals/:id/reject - Reject withdrawal (Admin)
agentWithdrawals.post('/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const withdrawal = await prisma.agentWithdrawal.findUnique({ where: { id } })

    if (!withdrawal) {
      return c.json({ error: 'Withdrawal not found' }, 404)
    }

    if (withdrawal.status !== 'PENDING') {
      return c.json({ error: 'Withdrawal already processed' }, 400)
    }

    await prisma.agentWithdrawal.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date(),
      }
    })

    return c.json({ message: 'Withdrawal rejected' })
  } catch (error) {
    console.error('Reject agent withdrawal error:', error)
    return c.json({ error: 'Failed to reject withdrawal' }, 500)
  }
})

export default agentWithdrawals
