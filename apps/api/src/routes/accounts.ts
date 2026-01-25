import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

type Platform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT' | 'BING'
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
      // Exclude REFUNDED accounts from user's view (unless explicitly filtered)
      if (!status) {
        where.status = { not: 'REFUNDED' }
      }
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

// GET /accounts/deposits - Get user's own account deposits
// NOTE: This route MUST be defined BEFORE /:platform to avoid route conflicts
accounts.get('/deposits', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {
      adAccount: { userId }
    }
    if (platform) {
      where.adAccount.platform = platform.toUpperCase()
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [deposits, total] = await Promise.all([
      prisma.accountDeposit.findMany({
        where,
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
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.accountDeposit.count({ where })
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
    console.error('Get user account deposits error:', error)
    return c.json({ error: 'Failed to get deposits' }, 500)
  }
})

// GET /accounts/deposits/admin - Get all account deposits for admin
accounts.get('/deposits/admin', requireAdmin, async (c) => {
  try {
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}
    if (platform) {
      where.adAccount = { platform: platform.toUpperCase() }
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [deposits, total] = await Promise.all([
      prisma.accountDeposit.findMany({
        where,
        include: {
          adAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              user: {
                select: { id: true, username: true, email: true, uniqueId: true }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.accountDeposit.count({ where })
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
    console.error('Get account deposits error:', error)
    return c.json({ error: 'Failed to get deposits' }, 500)
  }
})

// ========== ACCOUNT REFUNDS (GET routes before /:platform) ==========

// GET /accounts/refunds - Get user's own account refunds
// NOTE: This route MUST be defined BEFORE /:platform to avoid route conflicts
accounts.get('/refunds', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {
      adAccount: { userId }
    }
    if (platform) {
      where.adAccount.platform = platform.toUpperCase()
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [refunds, total] = await Promise.all([
      prisma.accountRefund.findMany({
        where,
        include: {
          adAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.accountRefund.count({ where })
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
    console.error('Get user account refunds error:', error)
    return c.json({ error: 'Failed to get refunds' }, 500)
  }
})

// GET /accounts/refunds/admin - Get all account refunds for admin
accounts.get('/refunds/admin', requireAdmin, async (c) => {
  try {
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}
    if (platform) {
      where.adAccount = { platform: platform.toUpperCase() }
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [refunds, total] = await Promise.all([
      prisma.accountRefund.findMany({
        where,
        include: {
          adAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
              user: {
                select: { id: true, username: true, email: true, uniqueId: true }
              }
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.accountRefund.count({ where })
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
    console.error('Get account refunds error:', error)
    return c.json({ error: 'Failed to get refunds' }, 500)
  }
})

// ========== BALANCE TRANSFERS (GET routes before /:platform) ==========

// GET /accounts/transfers - Get user's own balance transfers
// NOTE: This route MUST be defined BEFORE /:platform to avoid route conflicts
accounts.get('/transfers', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = { userId }
    if (platform) {
      where.fromAccount = { platform: platform.toUpperCase() }
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [transfers, total] = await Promise.all([
      prisma.balanceTransfer.findMany({
        where,
        include: {
          fromAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
            }
          },
          toAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
            }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.balanceTransfer.count({ where })
    ])

    return c.json({
      transfers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get user balance transfers error:', error)
    return c.json({ error: 'Failed to get transfers' }, 500)
  }
})

// GET /accounts/transfers/admin - Get all balance transfers for admin
accounts.get('/transfers/admin', requireAdmin, async (c) => {
  try {
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}
    if (platform) {
      where.fromAccount = { platform: platform.toUpperCase() }
    }
    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [transfers, total] = await Promise.all([
      prisma.balanceTransfer.findMany({
        where,
        include: {
          fromAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
            }
          },
          toAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
            }
          },
          user: {
            select: { id: true, username: true, email: true, uniqueId: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.balanceTransfer.count({ where })
    ])

    return c.json({
      transfers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get balance transfers error:', error)
    return c.json({ error: 'Failed to get transfers' }, 500)
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

    console.log('Deposit request:', { id, userId, amount, remarks })

    if (!amount || amount <= 0) {
      return c.json({ message: 'Invalid amount' }, 400)
    }

    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!account) {
      return c.json({ message: 'Account not found' }, 404)
    }

    if (account.userId !== userId) {
      return c.json({ message: 'Access denied - this account does not belong to you' }, 403)
    }

    if (account.status !== 'APPROVED') {
      return c.json({ message: `Account is not approved. Current status: ${account.status}` }, 400)
    }

    // Check wallet balance
    if (account.user.walletBalance.lessThan(amount)) {
      return c.json({ message: `Insufficient wallet balance. Available: $${account.user.walletBalance}, Required: $${amount}` }, 400)
    }

    // Create account deposit and deduct money immediately using transaction
    const accountDeposit = await prisma.$transaction(async (tx) => {
      // Create the deposit record
      const deposit = await tx.accountDeposit.create({
        data: {
          amount,
          adAccountId: id,
          remarks,
        }
      })

      // Deduct from user wallet immediately
      const balanceBefore = account.user.walletBalance
      const balanceAfter = balanceBefore.sub(amount)

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record
      await tx.walletFlow.create({
        data: {
          type: 'TRANSFER',
          amount,
          balanceBefore,
          balanceAfter,
          referenceId: deposit.id,
          referenceType: 'account_deposit',
          userId,
          description: `Deposit to ${account.platform} account ${account.accountId} (Pending approval)`
        }
      })

      return deposit
    })

    return c.json({ message: 'Deposit request created', deposit: accountDeposit }, 201)
  } catch (error: any) {
    console.error('Account deposit error:', error)
    return c.json({ message: error.message || 'Failed to create deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/approve - Approve account deposit
// Note: Money is already deducted from wallet when user submits the deposit request
// This just approves and credits the ad account balance
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

    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date()
        }
      })

      // Update ad account balance (money was already deducted from wallet on submit)
      await tx.adAccount.update({
        where: { id: deposit.adAccountId },
        data: {
          totalDeposit: { increment: deposit.amount },
          balance: { increment: deposit.amount }
        }
      })
    })

    return c.json({ message: 'Account deposit approved' })
  } catch (error) {
    console.error('Approve account deposit error:', error)
    return c.json({ error: 'Failed to approve deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/reject - Reject account deposit
// Note: Since money was deducted on submit, we need to refund it back to user's wallet
accounts.post('/deposits/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

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

    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminRemarks
        }
      })

      // Refund money back to user's wallet
      const balanceBefore = deposit.adAccount.user.walletBalance
      const balanceAfter = balanceBefore.add(deposit.amount)

      await tx.user.update({
        where: { id: deposit.adAccount.userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record for refund
      await tx.walletFlow.create({
        data: {
          type: 'REFUND',
          amount: deposit.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'account_deposit_rejected',
          userId: deposit.adAccount.userId,
          description: `Refund for rejected deposit to ${deposit.adAccount.platform} account ${deposit.adAccount.accountId}`
        }
      })
    })

    return c.json({ message: 'Account deposit rejected and refunded' })
  } catch (error) {
    console.error('Reject account deposit error:', error)
    return c.json({ error: 'Failed to reject deposit' }, 500)
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

// ========== ACCOUNT REFUNDS (POST routes) ==========

// POST /accounts/:id/refund - Request refund from ad account
accounts.post('/:id/refund', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const { amount, reason } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ message: 'Invalid amount' }, 400)
    }

    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!account) {
      return c.json({ message: 'Account not found' }, 404)
    }

    if (account.userId !== userId) {
      return c.json({ message: 'Access denied - this account does not belong to you' }, 403)
    }

    if (account.status !== 'APPROVED') {
      return c.json({ message: `Account is not approved. Current status: ${account.status}` }, 400)
    }

    // Create account refund request
    const accountRefund = await prisma.accountRefund.create({
      data: {
        amount,
        adAccountId: id,
        reason,
      }
    })

    return c.json({ message: 'Refund request created', refund: accountRefund }, 201)
  } catch (error: any) {
    console.error('Account refund error:', error)
    return c.json({ message: error.message || 'Failed to create refund request' }, 500)
  }
})

// POST /accounts/refunds/:id/approve - Approve account refund
accounts.post('/refunds/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const refund = await prisma.accountRefund.findUnique({
      where: { id },
      include: {
        adAccount: {
          include: { user: true }
        }
      }
    })

    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404)
    }

    if (refund.status !== 'PENDING') {
      return c.json({ error: 'Refund already processed' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      // Update refund status
      await tx.accountRefund.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminRemarks,
          approvedAt: new Date()
        }
      })

      // Set ad account status to REFUNDED (this hides it from user's account list)
      await tx.adAccount.update({
        where: { id: refund.adAccountId },
        data: {
          balance: { decrement: refund.amount },
          status: 'REFUNDED'
        }
      })

      // Get current user wallet balance for wallet flow record
      const balanceBefore = Number(refund.adAccount.user.walletBalance)
      const refundAmount = Number(refund.amount)
      const balanceAfter = balanceBefore + refundAmount

      // Add to user wallet using increment
      await tx.user.update({
        where: { id: refund.adAccount.userId },
        data: { walletBalance: { increment: refund.amount } }
      })

      // Create wallet flow record
      await tx.walletFlow.create({
        data: {
          type: 'REFUND',
          amount: refund.amount,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'account_refund',
          userId: refund.adAccount.userId,
          description: `Refund from ${refund.adAccount.platform} account ${refund.adAccount.accountId}`
        }
      })
    })

    return c.json({ message: 'Account refund approved' })
  } catch (error) {
    console.error('Approve account refund error:', error)
    return c.json({ error: 'Failed to approve refund' }, 500)
  }
})

// PATCH /accounts/refunds/:id - Update account refund amount (Admin only)
accounts.patch('/refunds/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    const refund = await prisma.accountRefund.findUnique({
      where: { id },
      include: { adAccount: true }
    })

    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404)
    }

    if (refund.status !== 'PENDING') {
      return c.json({ error: 'Can only edit pending refunds' }, 400)
    }

    const updatedRefund = await prisma.accountRefund.update({
      where: { id },
      data: { amount }
    })

    return c.json({ message: 'Refund amount updated', refund: updatedRefund })
  } catch (error) {
    console.error('Update refund amount error:', error)
    return c.json({ error: 'Failed to update refund amount' }, 500)
  }
})

// POST /accounts/refunds/:id/reject - Reject account refund
accounts.post('/refunds/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const refund = await prisma.accountRefund.findUnique({
      where: { id }
    })

    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404)
    }

    if (refund.status !== 'PENDING') {
      return c.json({ error: 'Refund already processed' }, 400)
    }

    await prisma.accountRefund.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks
      }
    })

    return c.json({ message: 'Account refund rejected' })
  } catch (error) {
    console.error('Reject account refund error:', error)
    return c.json({ error: 'Failed to reject refund' }, 500)
  }
})

// ========== BALANCE TRANSFERS (POST routes) ==========

// POST /accounts/transfer - Create balance transfer request
accounts.post('/transfer', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { fromAccountId, toAccountId, amount, remarks } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ message: 'Invalid amount' }, 400)
    }

    if (!fromAccountId || !toAccountId) {
      return c.json({ message: 'Both from and to accounts are required' }, 400)
    }

    if (fromAccountId === toAccountId) {
      return c.json({ message: 'Cannot transfer to the same account' }, 400)
    }

    // Get both accounts
    const [fromAccount, toAccount] = await Promise.all([
      prisma.adAccount.findUnique({
        where: { id: fromAccountId },
        include: { user: true }
      }),
      prisma.adAccount.findUnique({
        where: { id: toAccountId },
        include: { user: true }
      })
    ])

    if (!fromAccount) {
      return c.json({ message: 'Source account not found' }, 404)
    }

    if (!toAccount) {
      return c.json({ message: 'Destination account not found' }, 404)
    }

    // Verify ownership
    if (fromAccount.userId !== userId) {
      return c.json({ message: 'Access denied - source account does not belong to you' }, 403)
    }

    if (toAccount.userId !== userId) {
      return c.json({ message: 'Access denied - destination account does not belong to you' }, 403)
    }

    // Verify both accounts are approved
    if (fromAccount.status !== 'APPROVED') {
      return c.json({ message: `Source account is not approved. Current status: ${fromAccount.status}` }, 400)
    }

    if (toAccount.status !== 'APPROVED') {
      return c.json({ message: `Destination account is not approved. Current status: ${toAccount.status}` }, 400)
    }

    // Create balance transfer request
    const transfer = await prisma.balanceTransfer.create({
      data: {
        amount,
        fromAccountId,
        toAccountId,
        userId,
        remarks,
      }
    })

    return c.json({ message: 'Transfer request created', transfer }, 201)
  } catch (error: any) {
    console.error('Balance transfer error:', error)
    return c.json({ message: error.message || 'Failed to create transfer request' }, 500)
  }
})

// POST /accounts/transfers/:id/approve - Approve balance transfer
accounts.post('/transfers/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const transfer = await prisma.balanceTransfer.findUnique({
      where: { id },
      include: {
        fromAccount: true,
        toAccount: true,
        user: true
      }
    })

    if (!transfer) {
      return c.json({ error: 'Transfer not found' }, 404)
    }

    if (transfer.status !== 'PENDING') {
      return c.json({ error: 'Transfer already processed' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      // Update transfer status
      await tx.balanceTransfer.update({
        where: { id },
        data: {
          status: 'APPROVED',
          adminRemarks,
          approvedAt: new Date()
        }
      })

      // Deduct from source account
      await tx.adAccount.update({
        where: { id: transfer.fromAccountId },
        data: {
          balance: { decrement: transfer.amount }
        }
      })

      // Add to destination account
      await tx.adAccount.update({
        where: { id: transfer.toAccountId },
        data: {
          balance: { increment: transfer.amount },
          totalDeposit: { increment: transfer.amount }
        }
      })
    })

    return c.json({ message: 'Balance transfer approved' })
  } catch (error) {
    console.error('Approve balance transfer error:', error)
    return c.json({ error: 'Failed to approve transfer' }, 500)
  }
})

// PATCH /accounts/transfers/:id - Update balance transfer amount (Admin only)
accounts.patch('/transfers/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    const transfer = await prisma.balanceTransfer.findUnique({
      where: { id },
      include: { fromAccount: true }
    })

    if (!transfer) {
      return c.json({ error: 'Transfer not found' }, 404)
    }

    if (transfer.status !== 'PENDING') {
      return c.json({ error: 'Can only edit pending transfers' }, 400)
    }

    const updatedTransfer = await prisma.balanceTransfer.update({
      where: { id },
      data: { amount }
    })

    return c.json({ message: 'Transfer amount updated', transfer: updatedTransfer })
  } catch (error) {
    console.error('Update transfer amount error:', error)
    return c.json({ error: 'Failed to update transfer amount' }, 500)
  }
})

// POST /accounts/transfers/:id/reject - Reject balance transfer
accounts.post('/transfers/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const transfer = await prisma.balanceTransfer.findUnique({
      where: { id }
    })

    if (!transfer) {
      return c.json({ error: 'Transfer not found' }, 404)
    }

    if (transfer.status !== 'PENDING') {
      return c.json({ error: 'Transfer already processed' }, 400)
    }

    await prisma.balanceTransfer.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    return c.json({ message: 'Balance transfer rejected' })
  } catch (error) {
    console.error('Reject balance transfer error:', error)
    return c.json({ error: 'Failed to reject transfer' }, 500)
  }
})

export default accounts
