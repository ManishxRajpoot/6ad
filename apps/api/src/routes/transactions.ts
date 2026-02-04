import { Hono } from 'hono'
import { PrismaClient, CryptoNetwork } from '@prisma/client'
import { z } from 'zod'
import { verifyTransaction, CONTRACTS } from '../services/crypto/blockchain-verifier.js'
import { queueForVerification, getVerificationStatus, getPendingCount } from '../services/crypto/background-verifier.js'
import { processDepositReferralReward } from '../services/referral-rewards.js'
import {
  sendEmail,
  getWalletDepositSubmittedTemplate,
  getWalletDepositApprovedTemplate,
  getWalletDepositRejectedTemplate,
  getAdminNotificationTemplate
} from '../utils/email.js'

const prisma = new PrismaClient()
import { verifyToken, requireAgent, requireAdmin, requireUser } from '../middleware/auth.js'

// Helper to get admin emails for notifications
async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { email: true }
  })
  return admins.map(a => a.email)
}

const transactions = new Hono()

transactions.use('*', verifyToken)

// ============= DEPOSITS =============

// GET /transactions/deposits - List deposits
transactions.get('/deposits', requireUser, async (c) => {
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

// Generate Apply ID in format: WD{YYYYMMDD}{7-digit random}
const generateApplyId = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000000 + Math.random() * 9000000) // 7-digit random
  return `WD${year}${month}${day}${random}`
}

// POST /transactions/deposits - Create deposit request
// NEW FLOW: For crypto deposits, create PENDING immediately and verify in background
transactions.post('/deposits', requireUser, async (c) => {
  try {
    const userId = c.get('userId') as string
    const { amount, paymentMethod, transactionId, remarks, paymentProof } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    const applyId = generateApplyId()

    // Check if this is a crypto payment method by looking up the payment method
    const paymentMethodRecord = await prisma.paymentMethod.findFirst({
      where: { name: paymentMethod }
    })

    // Determine if this is a crypto payment based on name pattern
    const isCryptoPayment = paymentMethod?.toLowerCase().includes('usdt') ||
                           paymentMethod?.toLowerCase().includes('trc') ||
                           paymentMethod?.toLowerCase().includes('bep')

    if (isCryptoPayment && transactionId) {
      // Determine network based on payment method name
      const isTRC20 = paymentMethod.toLowerCase().includes('trc') ||
                      (paymentMethod.toLowerCase().includes('usdt') && !paymentMethod.toLowerCase().includes('bep'))
      const network = isTRC20 ? 'TRON_TRC20' : 'BSC_BEP20'

      // Check if transaction hash already exists
      const existingDeposit = await prisma.deposit.findFirst({
        where: { txHash: transactionId.toLowerCase() }
      })

      if (existingDeposit) {
        return c.json({ error: 'This transaction has already been submitted' }, 400)
      }

      // NEW FLOW: Create deposit as PENDING immediately
      const deposit = await prisma.deposit.create({
        data: {
          applyId,
          amount,
          paymentMethod,
          transactionId,
          txHash: transactionId.toLowerCase(),
          cryptoNetwork: network as CryptoNetwork,
          remarks: remarks || null,
          paymentProof,
          userId,
          status: 'PENDING'
        }
      })

      // Queue for background verification
      queueForVerification({
        id: deposit.id,
        txHash: transactionId,
        cryptoNetwork: network as CryptoNetwork,
        amount,
        userId,
        paymentMethod
      })

      // Return success immediately - user sees success popup
      return c.json({
        message: 'Deposit submitted successfully! Verification in progress.',
        deposit,
        status: 'pending_verification',
        note: 'Your transaction is being verified on the blockchain. It will be auto-approved once confirmed.'
      }, 201)
    }

    // Get user for email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agent: { select: { email: true, brandLogo: true, emailSenderNameApproved: true } } }
    })

    // Regular (non-crypto) deposit - create as pending
    const deposit = await prisma.deposit.create({
      data: {
        applyId,
        amount,
        paymentMethod,
        transactionId,
        remarks,
        paymentProof,
        userId,
      }
    })

    // Send email to user
    if (user) {
      const userEmailTemplate = getWalletDepositSubmittedTemplate({
        username: user.username,
        applyId,
        amount,
        paymentMethod,
        txHash: transactionId,
        agentLogo: user.agent?.brandLogo
      })
      sendEmail({ to: user.email, ...userEmailTemplate, senderName: user.agent?.emailSenderNameApproved || undefined }).catch(console.error)

      // Notify admins and agent
      const adminNotification = getAdminNotificationTemplate({
        type: 'wallet_deposit',
        applyId,
        username: user.username,
        userEmail: user.email,
        amount
      })

      getAdminEmails().then(emails => {
        emails.forEach(email => sendEmail({ to: email, ...adminNotification }).catch(console.error))
      })

      if (user.agent?.email) {
        sendEmail({ to: user.agent.email, ...adminNotification }).catch(console.error)
      }
    }

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
      include: { user: { include: { agent: { select: { brandLogo: true, emailSenderNameApproved: true } } } } }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    let newBalance = 0

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

      const balanceBefore = Number(user!.walletBalance)
      const balanceAfter = balanceBefore + Number(deposit.amount)
      newBalance = balanceAfter

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

      // Process referral rewards (first deposit bonus + lifetime commission)
      await processDepositReferralReward(deposit.userId, deposit.amount, tx)
    })

    // Send approval email to user
    const userEmailTemplate = getWalletDepositApprovedTemplate({
      username: deposit.user.username,
      applyId: deposit.applyId,
      amount: Number(deposit.amount),
      newBalance,
      agentLogo: deposit.user.agent?.brandLogo
    })
    sendEmail({ to: deposit.user.email, ...userEmailTemplate, senderName: deposit.user.agent?.emailSenderNameApproved || undefined }).catch(console.error)

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

    const deposit = await prisma.deposit.findUnique({
      where: { id },
      include: { user: { include: { agent: { select: { brandLogo: true, emailSenderNameApproved: true } } } } }
    })

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

    // Send rejection email to user
    const userEmailTemplate = getWalletDepositRejectedTemplate({
      username: deposit.user.username,
      applyId: deposit.applyId,
      amount: Number(deposit.amount),
      adminRemarks,
      agentLogo: deposit.user.agent?.brandLogo
    })
    sendEmail({ to: deposit.user.email, ...userEmailTemplate, senderName: deposit.user.agent?.emailSenderNameApproved || undefined }).catch(console.error)

    return c.json({ message: 'Deposit rejected' })
  } catch (error) {
    console.error('Reject deposit error:', error)
    return c.json({ error: 'Failed to reject deposit' }, 500)
  }
})

// PATCH /transactions/deposits/:id - Update deposit amount or date (Admin only)
transactions.patch('/deposits/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount, createdAt } = await c.req.json()

    const deposit = await prisma.deposit.findUnique({ where: { id } })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Cannot edit processed deposit' }, 400)
    }

    const updateData: any = {}
    if (amount !== undefined) {
      updateData.amount = amount
    }
    if (createdAt !== undefined) {
      updateData.createdAt = new Date(createdAt)
    }

    const updatedDeposit = await prisma.deposit.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, username: true, email: true, uniqueId: true }
        }
      }
    })

    return c.json({ message: 'Deposit updated successfully', deposit: updatedDeposit })
  } catch (error) {
    console.error('Update deposit error:', error)
    return c.json({ error: 'Failed to update deposit' }, 500)
  }
})

// POST /transactions/deposits/bulk-approve - Bulk approve deposits (Admin only)
transactions.post('/deposits/bulk-approve', requireAdmin, async (c) => {
  try {
    const { ids } = await c.req.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'No deposits selected' }, 400)
    }

    const deposits = await prisma.deposit.findMany({
      where: { id: { in: ids }, status: 'PENDING' },
      include: { user: true }
    })

    if (deposits.length === 0) {
      return c.json({ error: 'No pending deposits found' }, 400)
    }

    // Process each deposit in a transaction
    await prisma.$transaction(async (tx) => {
      for (const deposit of deposits) {
        // Update deposit status
        await tx.deposit.update({
          where: { id: deposit.id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date()
          }
        })

        // Get current balance
        const user = await tx.user.findUnique({ where: { id: deposit.userId } })
        const balanceBefore = Number(user!.walletBalance)
        const balanceAfter = balanceBefore + Number(deposit.amount)

        // Update wallet
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
            referenceId: deposit.id,
            referenceType: 'deposit',
            userId: deposit.userId,
            description: 'Deposit approved (bulk)'
          }
        })

        // Process referral rewards (first deposit bonus + lifetime commission)
        await processDepositReferralReward(deposit.userId, deposit.amount, tx)
      }
    })

    return c.json({ message: `${deposits.length} deposits approved successfully`, count: deposits.length })
  } catch (error) {
    console.error('Bulk approve deposits error:', error)
    return c.json({ error: 'Failed to bulk approve deposits' }, 500)
  }
})

// POST /transactions/deposits/bulk-reject - Bulk reject deposits (Admin only)
transactions.post('/deposits/bulk-reject', requireAdmin, async (c) => {
  try {
    const { ids, reason } = await c.req.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'No deposits selected' }, 400)
    }

    const result = await prisma.deposit.updateMany({
      where: { id: { in: ids }, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        adminRemarks: reason || 'Rejected (bulk)',
        rejectedAt: new Date()
      }
    })

    return c.json({ message: `${result.count} deposits rejected`, count: result.count })
  } catch (error) {
    console.error('Bulk reject deposits error:', error)
    return c.json({ error: 'Failed to bulk reject deposits' }, 500)
  }
})

// ============= AGENT DEPOSITS (Agent's own wallet deposits) =============

// Generate Apply ID for Agent Deposit in format: PWD{YYYYMMDD}{7-digit random}
const generateAgentDepositApplyId = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000000 + Math.random() * 9000000) // 7-digit random
  return `PWD${year}${month}${day}${random}`
}

// GET /transactions/agent-deposits - Get agent's own deposits (only deposits made by agent themselves)
transactions.get('/agent-deposits', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { status, page = '1', limit = '50' } = c.req.query()

    const where: any = {
      userId: agentId // Only agent's own deposits
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
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
    console.error('Get agent deposits error:', error)
    return c.json({ error: 'Failed to get agent deposits' }, 500)
  }
})

// POST /transactions/agent-deposits - Agent creates deposit for their own wallet
transactions.post('/agent-deposits', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId') as string
    const { applyId, amount, paymentMethod, transactionId, remarks, paymentProof } = await c.req.json()

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    // Use provided applyId or generate one with PWD prefix
    const finalApplyId = applyId || generateAgentDepositApplyId()

    // Check if this is a crypto payment method by looking up the payment method
    const isCryptoPayment = paymentMethod?.toLowerCase().includes('usdt') ||
                           paymentMethod?.toLowerCase().includes('trc') ||
                           paymentMethod?.toLowerCase().includes('bep')

    if (isCryptoPayment && transactionId) {
      // Determine network based on payment method name
      const isTRC20 = paymentMethod.toLowerCase().includes('trc') ||
                      (paymentMethod.toLowerCase().includes('usdt') && !paymentMethod.toLowerCase().includes('bep'))
      const network = isTRC20 ? 'TRON_TRC20' : 'BSC_BEP20'

      // Check if transaction hash already exists
      const existingDeposit = await prisma.deposit.findFirst({
        where: { txHash: transactionId.toLowerCase() }
      })

      if (existingDeposit) {
        return c.json({ error: 'This transaction has already been submitted' }, 400)
      }

      // Create deposit as PENDING
      const deposit = await prisma.deposit.create({
        data: {
          applyId: finalApplyId,
          amount,
          paymentMethod,
          transactionId,
          txHash: transactionId.toLowerCase(),
          cryptoNetwork: network as CryptoNetwork,
          remarks: remarks || null,
          paymentProof,
          userId: agentId,
          status: 'PENDING'
        }
      })

      // Queue for background verification
      queueForVerification({
        id: deposit.id,
        txHash: transactionId,
        cryptoNetwork: network as CryptoNetwork,
        amount,
        userId: agentId,
        paymentMethod
      })

      return c.json({
        message: 'Deposit submitted successfully! Verification in progress.',
        deposit,
        status: 'pending_verification'
      }, 201)
    }

    // Regular (non-crypto) deposit - create as pending
    const deposit = await prisma.deposit.create({
      data: {
        applyId: finalApplyId,
        amount,
        paymentMethod,
        transactionId,
        remarks,
        paymentProof,
        userId: agentId,
      }
    })

    return c.json({ message: 'Deposit request created', deposit }, 201)
  } catch (error) {
    console.error('Create agent deposit error:', error)
    return c.json({ error: 'Failed to create deposit' }, 500)
  }
})

// GET /transactions/agent-wallet-flow - Get agent's own wallet flow (only agent's transactions)
transactions.get('/agent-wallet-flow', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { page = '1', limit = '50' } = c.req.query()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [flows, total] = await Promise.all([
      prisma.walletFlow.findMany({
        where: { userId: agentId }, // Only agent's own wallet flow
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.walletFlow.count({ where: { userId: agentId } })
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
    console.error('Get agent wallet flow error:', error)
    return c.json({ error: 'Failed to get agent wallet flow' }, 500)
  }
})

// GET /transactions/agent-pay-link-requests - Get agent's own pay link requests
transactions.get('/agent-pay-link-requests', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {
      userId: agentId // Only agent's own pay link requests
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [requests, total] = await Promise.all([
      prisma.payLinkRequest.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.payLinkRequest.count({ where })
    ])

    return c.json({
      payLinkRequests: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get agent pay link requests error:', error)
    return c.json({ error: 'Failed to get agent pay link requests' }, 500)
  }
})

// POST /transactions/agent-pay-link-requests - Agent creates pay link request for themselves
transactions.post('/agent-pay-link-requests', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { type, fullName, email, country, amount, companyName, website } = await c.req.json()

    if (!type || !fullName || !email || !country || !amount || amount <= 0) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    if (!['INDIVIDUAL', 'COMPANY'].includes(type)) {
      return c.json({ error: 'Invalid type. Must be INDIVIDUAL or COMPANY' }, 400)
    }

    if (type === 'COMPANY' && !companyName) {
      return c.json({ error: 'Company name is required for company type' }, 400)
    }

    const applyId = generatePayLinkApplyId()

    const request = await prisma.payLinkRequest.create({
      data: {
        applyId,
        type,
        fullName,
        email,
        country,
        amount,
        companyName: type === 'COMPANY' ? companyName : null,
        website: type === 'COMPANY' ? website : null,
        userId: agentId,
      }
    })

    return c.json({ message: 'Pay link request created', payLinkRequest: request }, 201)
  } catch (error) {
    console.error('Create agent pay link request error:', error)
    return c.json({ error: 'Failed to create pay link request' }, 500)
  }
})

// ============= AD ACCOUNT DEPOSITS (Recharges) =============

// Generate Apply ID for Ad Account Deposit in format: AD{YYYYMMDD}{7-digit random}
const generateAdDepositApplyId = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000000 + Math.random() * 9000000)
  return `AD${year}${month}${day}${random}`
}

// GET /transactions/account-deposits - Get ad account deposits (recharge requests)
transactions.get('/account-deposits', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, platform, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    // Filter based on role
    if (userRole === 'AGENT') {
      // Get all deposits for accounts owned by users under this agent
      where.adAccount = { user: { agentId: userId } }
    } else if (userRole === 'USER') {
      where.adAccount = { userId }
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    if (platform) {
      where.adAccount = { ...where.adAccount, platform: platform.toUpperCase() }
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
                select: {
                  id: true,
                  username: true,
                  email: true,
                  uniqueId: true,
                  realName: true
                }
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

    // Commission rate and amount are now stored in the deposit record at creation time
    // For backward compatibility, calculate commission for old records that don't have it stored
    const depositsWithCommission = deposits.map(deposit => {
      // If commission is already stored (new records), use it directly
      if (deposit.commissionRate !== undefined && deposit.commissionRate !== null) {
        return deposit
      }

      // For old records without stored commission, return 0 (or we could calculate from current rate)
      return {
        ...deposit,
        commissionRate: 0,
        commissionAmount: 0
      }
    })

    return c.json({
      deposits: depositsWithCommission,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get account deposits error:', error)
    return c.json({ error: 'Failed to get account deposits' }, 500)
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
    if (!user || Number(user.walletBalance) < amount) {
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
    if (Number(withdrawal.user.walletBalance) < Number(withdrawal.amount)) {
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

      const balanceBefore = Number(withdrawal.user.walletBalance)
      const balanceAfter = balanceBefore - Number(withdrawal.amount)

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

      const balanceBefore = Number(refund.user.walletBalance)
      const balanceAfter = balanceBefore + Number(refund.amount)

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
      const balanceBefore = Number(user.walletBalance)
      const balanceAfter = balanceBefore + Number(amount)

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

// POST /transactions/credit-action - Admin deposit/remove money from user/agent wallet
transactions.post('/credit-action', requireAdmin, async (c) => {
  try {
    const { userId, amount, mode, transactionId, payway, description, paymentProof, remarks } = await c.req.json()

    if (!userId || !amount || amount <= 0) {
      return c.json({ error: 'Invalid input' }, 400)
    }

    if (!mode || !['deposit', 'remove'].includes(mode)) {
      return c.json({ error: 'Invalid mode. Must be deposit or remove' }, 400)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const balanceBefore = Number(user.walletBalance)
    let balanceAfter: number

    if (mode === 'deposit') {
      balanceAfter = balanceBefore + Number(amount)
    } else {
      // Remove mode
      if (balanceBefore < Number(amount)) {
        return c.json({ error: 'Insufficient balance' }, 400)
      }
      balanceAfter = balanceBefore - Number(amount)
    }

    await prisma.$transaction(async (tx) => {
      // Update user wallet balance
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter }
      })

      // Create deposit record (for Add Money history)
      // For remove mode, store negative amount to show as deduction
      await tx.deposit.create({
        data: {
          applyId: generateApplyId(),
          amount: mode === 'deposit' ? Number(amount) : -Number(amount),
          status: 'APPROVED',
          paymentMethod: mode === 'deposit' ? (payway || 'Wallet') : 'Deduction',
          transactionId: transactionId || null,
          paymentProof: paymentProof || null,
          remarks: remarks || null,
          userId,
          approvedAt: new Date()
        }
      })

      // Create wallet flow record
      await tx.walletFlow.create({
        data: {
          type: mode === 'deposit' ? 'CREDIT' : 'WITHDRAWAL',
          amount: Number(amount),
          balanceBefore,
          balanceAfter,
          userId,
          referenceId: transactionId || null,
          referenceType: payway || 'wallet',
          description: mode === 'deposit' ? 'Deposit approved' : (remarks || 'Amount deducted')
        }
      })
    })

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, walletBalance: true, role: true }
    })

    return c.json({
      message: mode === 'deposit' ? 'Amount deposited successfully' : 'Amount removed successfully',
      user: updatedUser
    })
  } catch (error) {
    console.error('Credit action error:', error)
    return c.json({ error: 'Failed to process credit action' }, 500)
  }
})

// ============= PAY LINK REQUESTS =============

// Generate Pay Link Apply ID in format: PL{YYYYMMDD}{7-digit random}
const generatePayLinkApplyId = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000000 + Math.random() * 9000000) // 7-digit random
  return `PL${year}${month}${day}${random}`
}

// GET /transactions/pay-link-requests - Get all pay link requests (Admin) or user's own requests (User)
transactions.get('/pay-link-requests', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    // Users can only see their own requests
    if (userRole === 'USER') {
      where.userId = userId
    } else if (userRole === 'AGENT') {
      // Agents can see requests from their users
      where.user = { agentId: userId }
    }
    // Admin sees all

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [requests, total] = await Promise.all([
      prisma.payLinkRequest.findMany({
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
      prisma.payLinkRequest.count({ where })
    ])

    return c.json({
      payLinkRequests: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get pay link requests error:', error)
    return c.json({ error: 'Failed to get pay link requests' }, 500)
  }
})

// POST /transactions/pay-link-requests - Create pay link request (User)
transactions.post('/pay-link-requests', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { type, fullName, email, country, amount, companyName, website } = await c.req.json()

    if (!type || !fullName || !email || !country || !amount || amount <= 0) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    // Validate type
    if (!['INDIVIDUAL', 'COMPANY'].includes(type)) {
      return c.json({ error: 'Invalid type. Must be INDIVIDUAL or COMPANY' }, 400)
    }

    // For company type, require company name
    if (type === 'COMPANY' && !companyName) {
      return c.json({ error: 'Company name is required for company type' }, 400)
    }

    const applyId = generatePayLinkApplyId()

    const request = await prisma.payLinkRequest.create({
      data: {
        applyId,
        type,
        fullName,
        email,
        country,
        amount,
        companyName: type === 'COMPANY' ? companyName : null,
        website: type === 'COMPANY' ? website : null,
        userId,
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, uniqueId: true }
        }
      }
    })

    return c.json({ message: 'Pay link request created', payLinkRequest: request }, 201)
  } catch (error) {
    console.error('Create pay link request error:', error)
    return c.json({ error: 'Failed to create pay link request' }, 500)
  }
})

// POST /transactions/pay-link-requests/:id/create-link - Admin creates pay link
transactions.post('/pay-link-requests/:id/create-link', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { payLink, adminRemarks } = await c.req.json()

    if (!payLink) {
      return c.json({ error: 'Pay link URL is required' }, 400)
    }

    const request = await prisma.payLinkRequest.findUnique({ where: { id } })

    if (!request) {
      return c.json({ error: 'Pay link request not found' }, 404)
    }

    if (request.status !== 'PENDING') {
      return c.json({ error: 'Request already processed' }, 400)
    }

    const updatedRequest = await prisma.payLinkRequest.update({
      where: { id },
      data: {
        payLink,
        status: 'LINK_CREATED',
        adminRemarks
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, uniqueId: true }
        }
      }
    })

    return c.json({ message: 'Pay link created successfully', payLinkRequest: updatedRequest })
  } catch (error) {
    console.error('Create pay link error:', error)
    return c.json({ error: 'Failed to create pay link' }, 500)
  }
})

// POST /transactions/pay-link-requests/:id/reject - Admin rejects request
transactions.post('/pay-link-requests/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json()

    const request = await prisma.payLinkRequest.findUnique({ where: { id } })

    if (!request) {
      return c.json({ error: 'Pay link request not found' }, 404)
    }

    if (request.status !== 'PENDING') {
      return c.json({ error: 'Request already processed' }, 400)
    }

    await prisma.payLinkRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks
      }
    })

    return c.json({ message: 'Pay link request rejected' })
  } catch (error) {
    console.error('Reject pay link request error:', error)
    return c.json({ error: 'Failed to reject pay link request' }, 500)
  }
})

// POST /transactions/pay-link-requests/:id/complete - Mark as completed (Admin)
transactions.post('/pay-link-requests/:id/complete', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const request = await prisma.payLinkRequest.findUnique({ where: { id } })

    if (!request) {
      return c.json({ error: 'Pay link request not found' }, 404)
    }

    if (request.status !== 'LINK_CREATED') {
      return c.json({ error: 'Request must have link created first' }, 400)
    }

    await prisma.payLinkRequest.update({
      where: { id },
      data: { status: 'COMPLETED' }
    })

    return c.json({ message: 'Pay link request completed' })
  } catch (error) {
    console.error('Complete pay link request error:', error)
    return c.json({ error: 'Failed to complete pay link request' }, 500)
  }
})

// ============= GLOBAL SETTINGS =============

// GET /transactions/settings/pay-link - Get pay link setting
transactions.get('/settings/pay-link', requireUser, async (c) => {
  try {
    // For MongoDB, use findFirst instead of findUnique with string ID
    let settings = await prisma.globalSettings.findFirst()

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: { payLinkEnabled: true }
      })
    }

    return c.json({ payLinkEnabled: settings.payLinkEnabled })
  } catch (error) {
    console.error('Get pay link setting error:', error)
    return c.json({ error: 'Failed to get pay link setting' }, 500)
  }
})

// POST /transactions/settings/pay-link - Toggle pay link setting (Admin only)
transactions.post('/settings/pay-link', requireAdmin, async (c) => {
  try {
    const { enabled } = await c.req.json()

    if (typeof enabled !== 'boolean') {
      return c.json({ error: 'Invalid value for enabled' }, 400)
    }

    // For MongoDB, find existing or create new
    let settings = await prisma.globalSettings.findFirst()

    if (settings) {
      settings = await prisma.globalSettings.update({
        where: { id: settings.id },
        data: { payLinkEnabled: enabled }
      })
    } else {
      settings = await prisma.globalSettings.create({
        data: { payLinkEnabled: enabled }
      })
    }

    return c.json({ message: `Pay link ${enabled ? 'enabled' : 'disabled'}`, payLinkEnabled: settings.payLinkEnabled })
  } catch (error) {
    console.error('Toggle pay link setting error:', error)
    return c.json({ error: 'Failed to toggle pay link setting' }, 500)
  }
})

// ============= CRYPTO DEPOSITS =============

// GET /transactions/crypto/wallets - Get available crypto wallet addresses for deposits
transactions.get('/crypto/wallets', requireUser, async (c) => {
  try {
    const wallets = await prisma.cryptoWalletConfig.findMany({
      where: { isEnabled: true },
      select: {
        network: true,
        walletAddress: true,
        contractAddress: true
      }
    })

    return c.json({ wallets })
  } catch (error) {
    console.error('Get crypto wallets error:', error)
    return c.json({ error: 'Failed to get crypto wallets' }, 500)
  }
})

// POST /transactions/crypto/deposits - Create crypto deposit (background verification)
// NEW FLOW: Create PENDING immediately, verify in background, auto-approve when confirmed
transactions.post('/crypto/deposits', requireUser, async (c) => {
  try {
    const userId = c.get('userId') as string
    const { network, txHash, amount } = await c.req.json()

    // Validate input
    if (!network || !['TRON_TRC20', 'BSC_BEP20'].includes(network)) {
      return c.json({ error: 'Invalid network. Must be TRON_TRC20 or BSC_BEP20' }, 400)
    }

    if (!txHash || typeof txHash !== 'string' || txHash.length < 10) {
      return c.json({ error: 'Invalid transaction hash' }, 400)
    }

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    // Check if TX hash already used
    const existingDeposit = await prisma.deposit.findFirst({
      where: { txHash: txHash.toLowerCase() }
    })

    if (existingDeposit) {
      return c.json({ error: 'This transaction has already been used for a deposit' }, 400)
    }

    // Get wallet config for this network
    const walletConfig = await prisma.cryptoWalletConfig.findUnique({
      where: { network: network as CryptoNetwork }
    })

    if (!walletConfig || !walletConfig.isEnabled) {
      return c.json({ error: `${network} deposits are not enabled` }, 400)
    }

    // Generate apply ID
    const applyId = generateApplyId()
    const paymentMethod = network === 'TRON_TRC20' ? 'USDT TRC 20' : 'USDT BEP20'

    // NEW FLOW: Create deposit as PENDING immediately
    const deposit = await prisma.deposit.create({
      data: {
        applyId,
        amount,
        status: 'PENDING',
        paymentMethod,
        transactionId: txHash,
        cryptoNetwork: network as CryptoNetwork,
        txHash: txHash.toLowerCase(),
        userId,
        remarks: null
      }
    })

    // Queue for background verification
    queueForVerification({
      id: deposit.id,
      txHash,
      cryptoNetwork: network as CryptoNetwork,
      amount,
      userId,
      paymentMethod
    })

    // Return success immediately - user sees success popup
    return c.json({
      message: 'Deposit submitted successfully!',
      deposit,
      status: 'pending_verification',
      note: 'Your transaction is being verified on the blockchain. It will be auto-approved once confirmed (typically 1-3 minutes).'
    }, 201)
  } catch (error: any) {
    console.error('Crypto deposit error:', error)
    return c.json({ error: error.message || 'Failed to process crypto deposit' }, 500)
  }
})

// GET /transactions/crypto/verification-status/:txHash - Check verification status
transactions.get('/crypto/verification-status/:txHash', requireUser, async (c) => {
  try {
    const { txHash } = c.req.param()
    const userId = c.get('userId')

    // Get the deposit
    const deposit = await prisma.deposit.findFirst({
      where: {
        txHash: txHash.toLowerCase(),
        userId
      }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    // Get queue status
    const queueStatus = getVerificationStatus(txHash)

    return c.json({
      deposit,
      verification: {
        status: deposit.status,
        queued: queueStatus.queued,
        retryCount: queueStatus.retryCount,
        isVerified: deposit.status === 'APPROVED',
        verifiedAt: deposit.verifiedAt,
        remarks: deposit.remarks
      }
    })
  } catch (error) {
    console.error('Get verification status error:', error)
    return c.json({ error: 'Failed to get verification status' }, 500)
  }
})

// GET /transactions/crypto/pending-count - Get pending verification count (Admin)
transactions.get('/crypto/pending-count', requireAdmin, async (c) => {
  return c.json({ pendingCount: getPendingCount() })
})

// ============= CRYPTO WALLET CONFIG (Admin) =============

// GET /transactions/crypto/config - Get all crypto wallet configurations
transactions.get('/crypto/config', requireAdmin, async (c) => {
  try {
    const configs = await prisma.cryptoWalletConfig.findMany({
      orderBy: { network: 'asc' }
    })

    return c.json({ configs })
  } catch (error) {
    console.error('Get crypto config error:', error)
    return c.json({ error: 'Failed to get crypto configurations' }, 500)
  }
})

// POST /transactions/crypto/config - Create or update crypto wallet config
transactions.post('/crypto/config', requireAdmin, async (c) => {
  try {
    const { network, walletAddress, isEnabled } = await c.req.json()

    if (!network || !['TRON_TRC20', 'BSC_BEP20'].includes(network)) {
      return c.json({ error: 'Invalid network' }, 400)
    }

    if (!walletAddress || typeof walletAddress !== 'string') {
      return c.json({ error: 'Wallet address is required' }, 400)
    }

    // Get the contract address for this network
    const contractAddress = CONTRACTS[network as keyof typeof CONTRACTS]

    // Upsert the configuration
    const config = await prisma.cryptoWalletConfig.upsert({
      where: { network: network as CryptoNetwork },
      update: {
        walletAddress,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        contractAddress
      },
      create: {
        network: network as CryptoNetwork,
        walletAddress,
        contractAddress,
        isEnabled: isEnabled !== undefined ? isEnabled : true
      }
    })

    return c.json({ message: 'Crypto wallet configuration saved', config })
  } catch (error) {
    console.error('Save crypto config error:', error)
    return c.json({ error: 'Failed to save crypto configuration' }, 500)
  }
})

// PATCH /transactions/crypto/config/:network - Update crypto wallet config
transactions.patch('/crypto/config/:network', requireAdmin, async (c) => {
  try {
    const { network } = c.req.param()
    const updates = await c.req.json()

    if (!['TRON_TRC20', 'BSC_BEP20'].includes(network)) {
      return c.json({ error: 'Invalid network' }, 400)
    }

    const existing = await prisma.cryptoWalletConfig.findUnique({
      where: { network: network as CryptoNetwork }
    })

    if (!existing) {
      return c.json({ error: 'Configuration not found' }, 404)
    }

    const config = await prisma.cryptoWalletConfig.update({
      where: { network: network as CryptoNetwork },
      data: {
        ...(updates.walletAddress && { walletAddress: updates.walletAddress }),
        ...(updates.isEnabled !== undefined && { isEnabled: updates.isEnabled })
      }
    })

    return c.json({ message: 'Configuration updated', config })
  } catch (error) {
    console.error('Update crypto config error:', error)
    return c.json({ error: 'Failed to update configuration' }, 500)
  }
})

export default transactions
