import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
import { verifyToken, requireAgent, requireAdmin, requireUser } from '../middleware/auth.js'

const transactions = new Hono()

transactions.use('*', verifyToken)

// ============= DEPOSITS =============

// GET /transactions/deposits - List deposits
transactions.get('/deposits', requireAgent, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    // Filter based on role
    if (userRole === 'AGENT') {
      // Get all users under this agent
      where.user = { agentId: userId }
    } else if (userRole === 'USER') {
      where.userId = userId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
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
      prisma.deposit.count({ where })
    ])

    return c.json({
      deposits,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get deposits error:', error)
    return c.json({ error: 'Failed to get deposits' }, 500)
  }
})

// POST /transactions/deposits - Create deposit request
transactions.post('/deposits', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { amount, paymentMethod, transactionId, remarks } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    const deposit = await prisma.deposit.create({
      data: {
        amount,
        paymentMethod,
        transactionId,
        remarks,
        userId,
      }
    })

    return c.json({ message: 'Deposit request created', deposit }, 201)
  } catch (error) {
    console.error('Create deposit error:', error)
    return c.json({ error: 'Failed to create deposit' }, 500)
  }
})

// POST /transactions/deposits/:id/approve - Approve deposit (Admin only)
transactions.post('/deposits/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const deposit = await prisma.deposit.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    // Transaction to update deposit and wallet
    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.deposit.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminRemarks,
          approvedAt: new Date()
        }
      })

      // Get current wallet balance
      const user = await tx.user.findUnique({
        where: { id: deposit.userId }
      })

      const balanceBefore = user!.walletBalance
      const balanceAfter = balanceBefore.add(deposit.amount)

      // Update user wallet
      await tx.user.update({
        where: { id: deposit.userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record
      await tx.walletFlow.create({
        data: {
          type: 'DEPOSIT',
          amount: deposit.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'deposit',
          userId: deposit.userId,
          description: `Deposit approved`
        }
      })
    })

    return c.json({ message: 'Deposit approved successfully' })
  } catch (error) {
    console.error('Approve deposit error:', error)
    return c.json({ error: 'Failed to approve deposit' }, 500)
  }
})

// POST /transactions/deposits/:id/reject
transactions.post('/deposits/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const deposit = await prisma.deposit.findUnique({ where: { id } })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    await prisma.deposit.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    return c.json({ message: 'Deposit rejected' })
  } catch (error) {
    console.error('Reject deposit error:', error)
    return c.json({ error: 'Failed to reject deposit' }, 500)
  }
})

// ============= WITHDRAWALS =============

// GET /transactions/withdrawals
transactions.get('/withdrawals', requireAgent, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    if (userRole === 'AGENT') {
      where.user = { agentId: userId }
    } else if (userRole === 'USER') {
      where.userId = userId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
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
      prisma.withdrawal.count({ where })
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
    console.error('Get withdrawals error:', error)
    return c.json({ error: 'Failed to get withdrawals' }, 500)
  }
})

// POST /transactions/withdrawals - Request withdrawal
transactions.post('/withdrawals', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { amount, bankName, accountNumber, accountHolderName, ifscCode, remarks } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    // Check wallet balance
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.walletBalance.lessThan(amount)) {
      return c.json({ error: 'Insufficient balance' }, 400)
    }

    const withdrawal = await prisma.withdrawal.create({
      data: {
        amount,
        bankName,
        accountNumber,
        accountHolderName,
        ifscCode,
        remarks,
        userId,
      }
    })

    return c.json({ message: 'Withdrawal request created', withdrawal }, 201)
  } catch (error) {
    console.error('Create withdrawal error:', error)
    return c.json({ error: 'Failed to create withdrawal' }, 500)
  }
})

// POST /transactions/withdrawals/:id/approve
transactions.post('/withdrawals/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!withdrawal) {
      return c.json({ error: 'Withdrawal not found' }, 404)
    }

    if (withdrawal.status !== 'PENDING') {
      return c.json({ error: 'Withdrawal already processed' }, 400)
    }

    // Check balance
    if (withdrawal.user.walletBalance.lessThan(withdrawal.amount)) {
      return c.json({ error: 'Insufficient balance' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminRemarks,
          approvedAt: new Date()
        }
      })

      const balanceBefore = withdrawal.user.walletBalance
      const balanceAfter = balanceBefore.sub(withdrawal.amount)

      await tx.user.update({
        where: { id: withdrawal.userId },
        data: { walletBalance: balanceAfter }
      })

      await tx.walletFlow.create({
        data: {
          type: 'WITHDRAWAL',
          amount: withdrawal.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'withdrawal',
          userId: withdrawal.userId,
          description: `Withdrawal approved`
        }
      })
    })

    return c.json({ message: 'Withdrawal approved successfully' })
  } catch (error) {
    console.error('Approve withdrawal error:', error)
    return c.json({ error: 'Failed to approve withdrawal' }, 500)
  }
})

// POST /transactions/withdrawals/:id/reject
transactions.post('/withdrawals/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    await prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    return c.json({ message: 'Withdrawal rejected' })
  } catch (error) {
    console.error('Reject withdrawal error:', error)
    return c.json({ error: 'Failed to reject withdrawal' }, 500)
  }
})

// ============= REFUNDS =============

// GET /transactions/refunds
transactions.get('/refunds', requireAgent, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, platform, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    if (userRole === 'AGENT') {
      where.user = { agentId: userId }
    } else if (userRole === 'USER') {
      where.userId = userId
    }

    if (status) where.status = status.toUpperCase()
    if (platform) where.platform = platform.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
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
      prisma.refund.count({ where })
    ])

    return c.json({
      refunds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get refunds error:', error)
    return c.json({ error: 'Failed to get refunds' }, 500)
  }
})

// POST /transactions/refunds
transactions.post('/refunds', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { amount, platform, accountId, reason } = await c.req.json()

    if (!amount || amount <= 0 || !platform) {
      return c.json({ error: 'Invalid input' }, 400)
    }

    const refund = await prisma.refund.create({
      data: {
        amount,
        platform,
        accountId,
        reason,
        userId,
      }
    })

    return c.json({ message: 'Refund request created', refund }, 201)
  } catch (error) {
    console.error('Create refund error:', error)
    return c.json({ error: 'Failed to create refund' }, 500)
  }
})

// POST /transactions/refunds/:id/approve
transactions.post('/refunds/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const refund = await prisma.refund.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404)
    }

    if (refund.status !== 'PENDING') {
      return c.json({ error: 'Refund already processed' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminRemarks,
          approvedAt: new Date()
        }
      })

      const balanceBefore = refund.user.walletBalance
      const balanceAfter = balanceBefore.add(refund.amount)

      await tx.user.update({
        where: { id: refund.userId },
        data: { walletBalance: balanceAfter }
      })

      await tx.walletFlow.create({
        data: {
          type: 'REFUND',
          amount: refund.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'refund',
          userId: refund.userId,
          description: `Refund approved - ${refund.platform}`
        }
      })
    })

    return c.json({ message: 'Refund approved successfully' })
  } catch (error) {
    console.error('Approve refund error:', error)
    return c.json({ error: 'Failed to approve refund' }, 500)
  }
})

// POST /transactions/refunds/:id/reject
transactions.post('/refunds/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    await prisma.refund.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    return c.json({ message: 'Refund rejected' })
  } catch (error) {
    console.error('Reject refund error:', error)
    return c.json({ error: 'Failed to reject refund' }, 500)
  }
})

// ============= WALLET FLOW =============

// GET /transactions/wallet-flow
transactions.get('/wallet-flow', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { targetUserId, page = '1', limit = '50' } = c.req.query()

    let queryUserId = userId

    // Admin/Agent can view other users' wallet flow
    if ((userRole === 'ADMIN' || userRole === 'AGENT') && targetUserId) {
      queryUserId = targetUserId
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [flows, total] = await Promise.all([
      prisma.walletFlow.findMany({
        where: { userId: queryUserId },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.walletFlow.count({ where: { userId: queryUserId } })
    ])

    return c.json({
      flows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get wallet flow error:', error)
    return c.json({ error: 'Failed to get wallet flow' }, 500)
  }
})

// POST /transactions/add-credit - Admin adds credit to user
transactions.post('/add-credit', requireAdmin, async (c) => {
  try {
    const { userId, amount, description } = await c.req.json()

    if (!userId || !amount || amount <= 0) {
      return c.json({ error: 'Invalid input' }, 400)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    await prisma.$transaction(async (tx) => {
      const balanceBefore = user.walletBalance
      const balanceAfter = balanceBefore.add(amount)

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter }
      })

      await tx.walletFlow.create({
        data: {
          type: 'CREDIT',
          amount,
          balanceBefore,
          balanceAfter,
          userId,
          description: description || 'Credit added by admin'
        }
      })
    })

    return c.json({ message: 'Credit added successfully' })
  } catch (error) {
    console.error('Add credit error:', error)
    return c.json({ error: 'Failed to add credit' }, 500)
  }
})

export default transactions
