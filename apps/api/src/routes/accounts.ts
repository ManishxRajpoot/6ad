import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { cheetahApi } from '../services/cheetah-api.js'
import {
  sendEmail,
  buildSmtpConfig,
  getAdAccountSubmittedTemplate,
  getAdAccountApprovedTemplate,
  getAdAccountRejectedTemplate,
  getAgentAdAccountApprovedNotificationTemplate,
  getAgentAdAccountRejectedNotificationTemplate,
  getAccountRechargeSubmittedTemplate,
  getAccountRechargeApprovedTemplate,
  getAccountRechargeRejectedTemplate,
  getAdminNotificationTemplate,
  getAccountRefundSubmittedTemplate,
  getAccountRefundApprovedTemplate,
  getAccountRefundRejectedTemplate,
  getAgentRefundApprovedNotificationTemplate,
  getAgentRefundRejectedNotificationTemplate
} from '../utils/email.js'

const prisma = new PrismaClient()

type Platform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT' | 'BING'
import { verifyToken, requireAgent, requireAdmin, requireUser } from '../middleware/auth.js'

// Helper to get admin emails for notifications
async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { email: true }
  })
  return admins.map(a => a.email)
}

// Helper to get agent email for a user
async function getAgentEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { agent: { select: { email: true } } }
  })
  return user?.agent?.email || null
}

// Generate Apply ID for Ad Account Deposit with platform-specific prefix
// FB = Facebook, GG = Google, BD = Bing, SD = Snapchat, TD = TikTok
const generateAccountDepositApplyId = (platform: string) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(1000000 + Math.random() * 9000000)

  // Get platform prefix
  let prefix = 'AD' // default
  switch (platform?.toUpperCase()) {
    case 'FACEBOOK':
      prefix = 'FB'
      break
    case 'GOOGLE':
      prefix = 'GG'
      break
    case 'BING':
      prefix = 'BD'
      break
    case 'SNAPCHAT':
      prefix = 'SD'
      break
    case 'TIKTOK':
      prefix = 'TD'
      break
  }

  return `${prefix}${year}${month}${day}${random}`
}

// Hardcoded Cheetah API credentials
const CHEETAH_CREDENTIALS = {
  production: {
    appid: 'wvLY386',
    secret: '7fd454af-84f1-4e62-9130-4989181063ed',
    baseUrl: 'https://open-api.cmcm.com',
  },
}

// Load Cheetah API config
async function loadCheetahConfig() {
  try {
    let env: 'production' = 'production'
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'cheetah_api_config' }
      })
      if (setting && setting.value) {
        const config = JSON.parse(setting.value as string)
        if (config.environment === 'production') env = 'production'
      }
    } catch (e) {
      // Use default
    }
    cheetahApi.setConfig(CHEETAH_CREDENTIALS[env])
    return true
  } catch (error) {
    console.error('Failed to load Cheetah API config:', error)
    return false
  }
}

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

// Helper function to get status text from status code
function getStatusText(status: number): string {
  const statusMap: Record<number, string> = {
    1: 'Active',
    2: 'Disabled',
    3: 'Unsettled',
    7: 'Pending Risk Review',
    8: 'Pending Settlement',
    9: 'In Grace Period',
    100: 'Pending Closure',
    101: 'Closed',
    201: 'Any Active',
    202: 'Any Closed'
  }
  return statusMap[status] || 'Unknown'
}

// GET /accounts/agent-all - Get all ad accounts for agent's users with Cheetah status
// IMPORTANT: This route must be defined BEFORE /:platform to avoid being caught by the wildcard
accounts.get('/agent-all', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can access this endpoint' }, 403)
    }

    const { platform, status, search, page = '1', limit = '50' } = c.req.query()

    // Build where clause for accounts belonging to users under this agent
    const where: any = {
      user: { agentId: userId },
      status: 'APPROVED' // Only show approved accounts
    }

    if (platform) {
      where.platform = platform.toUpperCase()
    }

    // Get accounts with user info
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const [accounts, total] = await Promise.all([
      prisma.adAccount.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              realName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.adAccount.count({ where })
    ])

    // Filter by search if provided (on username or accountName)
    let filteredAccounts = accounts
    if (search) {
      const searchLower = search.toLowerCase()
      filteredAccounts = accounts.filter(acc =>
        acc.accountName?.toLowerCase().includes(searchLower) ||
        acc.accountId?.toLowerCase().includes(searchLower) ||
        acc.user?.username?.toLowerCase().includes(searchLower) ||
        acc.user?.realName?.toLowerCase().includes(searchLower)
      )
    }

    // Fetch Cheetah status for Facebook accounts
    const fbAccountIds = filteredAccounts
      .filter(acc => acc.platform === 'FACEBOOK')
      .map(acc => acc.accountId)
      .filter(Boolean)

    let cheetahStatuses: Record<string, any> = {}

    if (fbAccountIds.length > 0) {
      const configLoaded = await loadCheetahConfig()
      if (configLoaded) {
        for (const accountId of fbAccountIds) {
          try {
            const result = await cheetahApi.getAccount(accountId)
            if (result.code === 0 && result.data && result.data.length > 0) {
              const cheetahAccount = result.data[0]
              const spendCap = parseFloat(cheetahAccount.spend_cap) || 0
              const amountSpent = parseFloat(cheetahAccount.amount_spent) || 0
              cheetahStatuses[accountId] = {
                isCheetah: true,
                spendCap,
                amountSpent,
                balance: parseFloat(cheetahAccount.balance) || 0,
                remainingBalance: spendCap - amountSpent,
                currency: cheetahAccount.currency,
                status: cheetahAccount.account_status,
                statusText: cheetahAccount.account_status_text || getStatusText(cheetahAccount.account_status),
                disableReason: cheetahAccount.disable_reason,
                disableReasonText: cheetahAccount.disable_reason_text
              }
            } else {
              cheetahStatuses[accountId] = { isCheetah: false }
            }
          } catch (err) {
            cheetahStatuses[accountId] = { isCheetah: false, error: true }
          }
        }
      }
    }

    // Merge Cheetah data with accounts
    const accountsWithStatus = filteredAccounts.map(acc => ({
      ...acc,
      cheetahData: cheetahStatuses[acc.accountId] || null
    }))

    // Get balance visibility setting from this agent's profile
    let showBalanceToAgents = false
    try {
      const agent = await prisma.user.findUnique({
        where: { id: userId },
        select: { showBalanceToAgent: true }
      })
      showBalanceToAgents = agent?.showBalanceToAgent ?? false
    } catch (e) {
      // Silently fail - use default (false)
    }

    return c.json({
      accounts: accountsWithStatus,
      showBalanceToAgents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Get agent accounts error:', error)
    return c.json({ error: 'Failed to get accounts' }, 500)
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

    // Get user details for email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agent: {
          select: {
            email: true,
            brandLogo: true,
            emailLogo: true,
            username: true,
            emailSenderNameApproved: true,
            smtpEnabled: true,
            smtpHost: true,
            smtpPort: true,
            smtpUsername: true,
            smtpPassword: true,
            smtpEncryption: true,
            smtpFromEmail: true,
            customDomains: {
              where: { status: 'APPROVED' },
              select: { brandLogo: true, emailLogo: true },
              take: 1
            }
          }
        }
      }
    })

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

    // Send email to user
    if (user) {
      // Use approved domain logo if available, otherwise fall back to agent's brand logo
      const approvedDomain = user.agent?.customDomains?.[0]
      const agent = user.agent
      const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agent?.emailLogo || agent?.brandLogo || null
      const agentBrandName = user.agent?.username || null
      const userEmail = getAdAccountSubmittedTemplate({
        username: user.username,
        applyId: account.id.slice(-8).toUpperCase(),
        platform: data.platform,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: user.email, ...userEmail, senderName: user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(user.agent) }).catch(console.error)

      // Send notification to admin and agent
      const adminNotification = getAdminNotificationTemplate({
        type: 'ad_account',
        applyId: account.id.slice(-8).toUpperCase(),
        username: user.username,
        userEmail: user.email,
        platform: data.platform
      })

      // Notify admins
      getAdminEmails().then(emails => {
        emails.forEach(email => sendEmail({ to: email, ...adminNotification }).catch(console.error))
      })

      // Notify agent if user has one
      if (user.agent?.email) {
        sendEmail({ to: user.agent.email, ...adminNotification }).catch(console.error)
      }
    }

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

    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: { user: { include: { agent: { select: { email: true, brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
    })

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

    // Send approval email to user
    const approvedDomain = account.user.agent?.customDomains?.[0]
    const agent = account.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agent?.emailLogo || agent?.brandLogo || null
    const agentBrandName = account.user.agent?.username || null
    const userEmail = getAdAccountApprovedTemplate({
      username: account.user.username,
      applyId: id.slice(-8).toUpperCase(),
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName || undefined,
      adminRemarks,
      agentLogo,
      agentBrandName
    })
    sendEmail({ to: account.user.email, ...userEmail, senderName: account.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(account.user.agent) }).catch(console.error)

    // Send approval notification to agent
    if (account.user.agent?.email) {
      const agentEmail = getAgentAdAccountApprovedNotificationTemplate({
        username: account.user.username,
        userEmail: account.user.email,
        applyId: id.slice(-8).toUpperCase(),
        platform: account.platform,
        accountId: account.accountId,
        accountName: account.accountName || undefined,
        adminRemarks,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: account.user.agent.email, ...agentEmail }).catch(console.error)
    }

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

    const account = await prisma.adAccount.findUnique({
      where: { id },
      include: { user: { include: { agent: { select: { email: true, brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
    })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    await prisma.adAccount.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks
      }
    })

    // Send rejection email to user
    const approvedDomain = account.user.agent?.customDomains?.[0]
    const agent = account.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agent?.emailLogo || agent?.brandLogo || null
    const agentBrandName = account.user.agent?.username || null
    const userEmail = getAdAccountRejectedTemplate({
      username: account.user.username,
      applyId: id.slice(-8).toUpperCase(),
      platform: account.platform,
      adminRemarks,
      agentLogo,
      agentBrandName
    })
    sendEmail({ to: account.user.email, ...userEmail, senderName: account.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(account.user.agent) }).catch(console.error)

    // Send rejection notification to agent
    if (account.user.agent?.email) {
      const agentEmail = getAgentAdAccountRejectedNotificationTemplate({
        username: account.user.username,
        userEmail: account.user.email,
        applyId: id.slice(-8).toUpperCase(),
        platform: account.platform,
        adminRemarks,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: account.user.agent.email, ...agentEmail }).catch(console.error)
    }

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
      include: { user: { include: { agent: { select: { brandLogo: true, emailLogo: true, username: true, email: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
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

    // Get user's commission rate for this platform at time of deposit
    let commissionRate = 0
    switch (account.platform) {
      case 'FACEBOOK':
        commissionRate = Number(account.user.fbCommission) || 0
        break
      case 'GOOGLE':
        commissionRate = Number(account.user.googleCommission) || 0
        break
      case 'TIKTOK':
        commissionRate = Number(account.user.tiktokCommission) || 0
        break
      case 'SNAPCHAT':
        commissionRate = Number(account.user.snapchatCommission) || 0
        break
      case 'BING':
        commissionRate = Number(account.user.bingCommission) || 0
        break
    }
    const commissionAmount = (amount * commissionRate) / 100
    const totalAmount = amount + commissionAmount  // Total to deduct from wallet

    // Check wallet balance for total amount (deposit + commission)
    if (Number(account.user.walletBalance) < totalAmount) {
      return c.json({ message: `Insufficient wallet balance. Available: $${account.user.walletBalance}, Required: $${totalAmount.toFixed(2)} (Deposit: $${amount} + Fee: $${commissionAmount.toFixed(2)})` }, 400)
    }

    // Generate apply ID for tracking with platform-specific prefix
    const applyId = generateAccountDepositApplyId(account.platform)

    // Create account deposit and deduct money immediately using transaction
    const accountDeposit = await prisma.$transaction(async (tx) => {
      // Create the deposit record with commission stored at creation time
      const deposit = await tx.accountDeposit.create({
        data: {
          applyId,
          amount,
          commissionRate,
          commissionAmount,
          adAccountId: id,
          remarks,
        }
      })

      // Deduct total amount (deposit + commission) from user wallet immediately
      const balanceBefore = Number(account.user.walletBalance)
      const balanceAfter = balanceBefore - totalAmount

      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record for total amount (deposit + commission)
      await tx.walletFlow.create({
        data: {
          type: 'TRANSFER',
          amount: totalAmount,
          balanceBefore,
          balanceAfter,
          referenceId: deposit.id,
          referenceType: 'account_deposit',
          userId,
          description: `Deposit $${amount} + Fee $${commissionAmount.toFixed(2)} (${commissionRate}%) to ${account.platform} account ${account.accountId}`
        }
      })

      return deposit
    })

    // Send email to user
    const approvedDomain = account.user.agent?.customDomains?.[0]
    const agent = account.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agent?.emailLogo || agent?.brandLogo || null
    const agentBrandName = account.user.agent?.username || null
    const userEmailTemplate = getAccountRechargeSubmittedTemplate({
      username: account.user.username,
      applyId,
      amount,
      commission: commissionAmount,
      totalCost: totalAmount,
      platform: account.platform,
      accountId: account.accountId,
      accountName: account.accountName || undefined,
      agentLogo,
      agentBrandName
    })
    sendEmail({ to: account.user.email, ...userEmailTemplate, senderName: account.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(account.user.agent) }).catch(console.error)

    // Notify admins and agent
    const adminNotification = getAdminNotificationTemplate({
      type: 'account_recharge',
      applyId,
      username: account.user.username,
      userEmail: account.user.email,
      platform: account.platform,
      amount,
      details: `Account: ${account.accountId}`
    })

    getAdminEmails().then(emails => {
      emails.forEach(email => sendEmail({ to: email, ...adminNotification }).catch(console.error))
    })

    const agentEmail = await getAgentEmail(userId)
    if (agentEmail) {
      sendEmail({ to: agentEmail, ...adminNotification }).catch(console.error)
    }

    return c.json({ message: 'Deposit request created', deposit: accountDeposit }, 201)
  } catch (error: any) {
    console.error('Account deposit error:', error)
    return c.json({ message: error.message || 'Failed to create deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/approve - Approve account deposit
// Note: Money is already deducted from wallet when user submits the deposit request
// This just approves and credits the ad account balance
// Also updates the spending limit on Cheetah API for Facebook accounts
accounts.post('/deposits/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const deposit = await prisma.accountDeposit.findUnique({
      where: { id },
      include: {
        adAccount: {
          include: { user: { include: { agent: { select: { brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
        }
      }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    // Cheetah API auto-recharge disabled
    // let cheetahRechargeResult: any = null
    // let cheetahError: string | null = null

    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
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

    // Get updated account balance
    const updatedAccount = await prisma.adAccount.findUnique({
      where: { id: deposit.adAccountId },
      select: { balance: true }
    })

    // Send approval email to user
    const approvedDomainDeposit = deposit.adAccount.user.agent?.customDomains?.[0]
    const agentDeposit = deposit.adAccount.user.agent
    const agentLogoDeposit = approvedDomainDeposit?.emailLogo || approvedDomainDeposit?.brandLogo || agentDeposit?.emailLogo || agentDeposit?.brandLogo || null
    const agentBrandNameDeposit = deposit.adAccount.user.agent?.username || null
    const userEmailTemplate = getAccountRechargeApprovedTemplate({
      username: deposit.adAccount.user.username,
      applyId: deposit.applyId,
      amount: Number(deposit.amount),
      commission: Number(deposit.commissionAmount) || 0,
      totalCost: Number(deposit.amount) + (Number(deposit.commissionAmount) || 0),
      platform: deposit.adAccount.platform,
      accountId: deposit.adAccount.accountId,
      accountName: deposit.adAccount.accountName || undefined,
      newBalance: Number(updatedAccount?.balance) || 0,
      agentLogo: agentLogoDeposit,
      agentBrandName: agentBrandNameDeposit
    })
    sendEmail({ to: deposit.adAccount.user.email, ...userEmailTemplate, senderName: deposit.adAccount.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(deposit.adAccount.user.agent) }).catch(console.error)

    return c.json({
      message: 'Account deposit approved',
      cheetahRecharge: cheetahRechargeResult?.code === 0 ? 'success' : (cheetahError ? 'failed' : 'skipped'),
      cheetahError: cheetahError
    })
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
          include: { user: { include: { agent: { select: { brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
        }
      }
    })

    if (!deposit) {
      return c.json({ error: 'Deposit not found' }, 404)
    }

    if (deposit.status !== 'PENDING') {
      return c.json({ error: 'Deposit already processed' }, 400)
    }

    const depositAmount = Number(deposit.amount) || 0
    const commissionAmount = Number(deposit.commissionAmount) || 0
    const totalRefund = depositAmount + commissionAmount

    await prisma.$transaction(async (tx) => {
      // Update deposit status
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminRemarks
        }
      })

      // Refund total cost (deposit + commission) back to user's wallet
      const balanceBefore = Number(deposit.adAccount.user.walletBalance)
      const balanceAfter = balanceBefore + totalRefund

      await tx.user.update({
        where: { id: deposit.adAccount.userId },
        data: { walletBalance: balanceAfter }
      })

      // Create wallet flow record for refund
      await tx.walletFlow.create({
        data: {
          type: 'REFUND',
          amount: totalRefund,
          balanceBefore,
          balanceAfter,
          referenceId: id,
          referenceType: 'account_deposit_rejected',
          userId: deposit.adAccount.userId,
          description: `Refund for rejected deposit: $${depositAmount.toFixed(2)} + Fee $${commissionAmount.toFixed(2)} = $${totalRefund.toFixed(2)} to ${deposit.adAccount.platform} account ${deposit.adAccount.accountId}`
        }
      })
    })

    // Send rejection email to user with refund info
    const approvedDomainReject = deposit.adAccount.user.agent?.customDomains?.[0]
    const agentReject = deposit.adAccount.user.agent
    const agentLogoReject = approvedDomainReject?.emailLogo || approvedDomainReject?.brandLogo || agentReject?.emailLogo || agentReject?.brandLogo || null
    const agentBrandNameReject = deposit.adAccount.user.agent?.username || null
    const userEmailTemplate = getAccountRechargeRejectedTemplate({
      username: deposit.adAccount.user.username,
      applyId: deposit.applyId,
      amount: depositAmount,
      commission: commissionAmount,
      totalCost: totalRefund,
      platform: deposit.adAccount.platform,
      accountId: deposit.adAccount.accountId,
      accountName: deposit.adAccount.accountName || undefined,
      adminRemarks,
      agentLogo: agentLogoReject,
      agentBrandName: agentBrandNameReject
    })
    sendEmail({ to: deposit.adAccount.user.email, ...userEmailTemplate, senderName: deposit.adAccount.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(deposit.adAccount.user.agent) }).catch(console.error)

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
      include: {
        user: {
          include: {
            agent: {
              select: {
                email: true,
                brandLogo: true,
                emailLogo: true,
                username: true,
                emailSenderNameApproved: true,
                smtpEnabled: true,
                smtpHost: true,
                smtpPort: true,
                smtpUsername: true,
                smtpPassword: true,
                smtpEncryption: true,
                smtpFromEmail: true,
                customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 }
              }
            }
          }
        }
      }
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

    // Get agent branding
    const approvedDomain = account.user.agent?.customDomains?.[0]
    const agentRef = account.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agentRef?.emailLogo || agentRef?.brandLogo || null
    const agentBrandName = account.user.agent?.username || null

    // Send confirmation email to user
    const userEmail = getAccountRefundSubmittedTemplate({
      username: account.user.username,
      refundId: accountRefund.id.slice(-8).toUpperCase(),
      amount: Number(amount),
      platform: account.platform,
      accountId: account.accountId,
      reason,
      agentLogo,
      agentBrandName
    })
    sendEmail({
      to: account.user.email,
      ...userEmail,
      senderName: account.user.agent?.emailSenderNameApproved || undefined,
      smtpConfig: buildSmtpConfig(account.user.agent)
    }).catch(console.error)

    // Send notification to admin
    const adminEmails = await getAdminEmails()
    if (adminEmails.length > 0) {
      const adminNotification = getAdminNotificationTemplate({
        type: 'account_refund',
        applyId: accountRefund.id.slice(-8).toUpperCase(),
        username: account.user.username,
        userEmail: account.user.email,
        platform: account.platform,
        amount: Number(amount),
        details: reason ? `Account: ${account.accountId}. Reason: ${reason}` : `Account: ${account.accountId}`
      })
      for (const adminEmail of adminEmails) {
        sendEmail({ to: adminEmail, ...adminNotification }).catch(console.error)
      }
    }

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
          include: {
            user: {
              include: {
                agent: {
                  select: {
                    email: true,
                    brandLogo: true,
                    emailLogo: true,
                    username: true,
                    emailSenderNameApproved: true,
                    smtpEnabled: true,
                    smtpHost: true,
                    smtpPort: true,
                    smtpUsername: true,
                    smtpPassword: true,
                    smtpEncryption: true,
                    smtpFromEmail: true,
                    customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!refund) {
      return c.json({ error: 'Refund not found' }, 404)
    }

    if (refund.status !== 'PENDING') {
      return c.json({ error: 'Refund already processed' }, 400)
    }

    // Get current user wallet balance for wallet flow record
    const balanceBefore = Number(refund.adAccount.user.walletBalance)
    const refundAmount = Number(refund.amount)
    const balanceAfter = balanceBefore + refundAmount

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

    // Get agent branding
    const approvedDomain = refund.adAccount.user.agent?.customDomains?.[0]
    const agentRef = refund.adAccount.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agentRef?.emailLogo || agentRef?.brandLogo || null
    const agentBrandName = refund.adAccount.user.agent?.username || null

    // Send approval email to user
    const userEmailTemplate = getAccountRefundApprovedTemplate({
      username: refund.adAccount.user.username,
      refundId: id.slice(-8).toUpperCase(),
      amount: refundAmount,
      platform: refund.adAccount.platform,
      accountId: refund.adAccount.accountId,
      adminRemarks,
      newBalance: balanceAfter,
      agentLogo,
      agentBrandName
    })
    sendEmail({
      to: refund.adAccount.user.email,
      ...userEmailTemplate,
      senderName: refund.adAccount.user.agent?.emailSenderNameApproved || undefined,
      smtpConfig: buildSmtpConfig(refund.adAccount.user.agent)
    }).catch(console.error)

    // Send notification to agent
    if (refund.adAccount.user.agent?.email) {
      const agentNotification = getAgentRefundApprovedNotificationTemplate({
        username: refund.adAccount.user.username,
        userEmail: refund.adAccount.user.email,
        refundId: id.slice(-8).toUpperCase(),
        amount: refundAmount,
        platform: refund.adAccount.platform,
        accountId: refund.adAccount.accountId,
        adminRemarks,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: refund.adAccount.user.agent.email, ...agentNotification }).catch(console.error)
    }

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
      where: { id },
      include: {
        adAccount: {
          include: {
            user: {
              include: {
                agent: {
                  select: {
                    email: true,
                    brandLogo: true,
                    emailLogo: true,
                    username: true,
                    emailSenderNameApproved: true,
                    smtpEnabled: true,
                    smtpHost: true,
                    smtpPort: true,
                    smtpUsername: true,
                    smtpPassword: true,
                    smtpEncryption: true,
                    smtpFromEmail: true,
                    customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 }
                  }
                }
              }
            }
          }
        }
      }
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

    // Get agent branding
    const approvedDomain = refund.adAccount.user.agent?.customDomains?.[0]
    const agentRef = refund.adAccount.user.agent
    const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || agentRef?.emailLogo || agentRef?.brandLogo || null
    const agentBrandName = refund.adAccount.user.agent?.username || null

    // Send rejection email to user
    const userEmailTemplate = getAccountRefundRejectedTemplate({
      username: refund.adAccount.user.username,
      refundId: id.slice(-8).toUpperCase(),
      amount: Number(refund.amount),
      platform: refund.adAccount.platform,
      accountId: refund.adAccount.accountId,
      adminRemarks,
      agentLogo,
      agentBrandName
    })
    sendEmail({
      to: refund.adAccount.user.email,
      ...userEmailTemplate,
      senderName: refund.adAccount.user.agent?.emailSenderNameApproved || undefined,
      smtpConfig: buildSmtpConfig(refund.adAccount.user.agent)
    }).catch(console.error)

    // Send notification to agent
    if (refund.adAccount.user.agent?.email) {
      const agentNotification = getAgentRefundRejectedNotificationTemplate({
        username: refund.adAccount.user.username,
        userEmail: refund.adAccount.user.email,
        refundId: id.slice(-8).toUpperCase(),
        amount: Number(refund.amount),
        platform: refund.adAccount.platform,
        accountId: refund.adAccount.accountId,
        adminRemarks,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: refund.adAccount.user.agent.email, ...agentNotification }).catch(console.error)
    }

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

// GET /accounts/:id/cheetah-balance - Get account balance from Cheetah API
accounts.get('/:id/cheetah-balance', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Find account
    const account = await prisma.adAccount.findUnique({
      where: { id }
    })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Check ownership for non-admin users
    if (userRole === 'USER' && account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }

    // Only Facebook accounts supported
    if (account.platform !== 'FACEBOOK') {
      return c.json({ error: 'Only Facebook accounts supported', cheetahAccount: null })
    }

    // Load Cheetah config and fetch account
    const configLoaded = await loadCheetahConfig()
    if (!configLoaded) {
      return c.json({ error: 'Cheetah API not configured', cheetahAccount: null })
    }

    const result = await cheetahApi.getAccount(account.accountId)

    if (result.code === 0 && result.data && result.data.length > 0) {
      const cheetahAccount = result.data[0]
      return c.json({
        cheetahAccount: {
          accountId: cheetahAccount.account_id,
          accountName: cheetahAccount.account_name,
          spendCap: parseFloat(cheetahAccount.spend_cap) || 0,
          amountSpent: parseFloat(cheetahAccount.amount_spent) || 0,
          balance: parseFloat(cheetahAccount.balance) || 0,
          remainingBalance: (parseFloat(cheetahAccount.spend_cap) || 0) - (parseFloat(cheetahAccount.amount_spent) || 0),
          currency: cheetahAccount.currency,
          status: cheetahAccount.account_status,
          statusText: cheetahAccount.account_status_text,
        }
      })
    } else if (result.code === 999 || result.code === 110) {
      // Account not from Cheetah
      return c.json({ error: 'Account not from Cheetah', cheetahAccount: null })
    } else {
      return c.json({ error: result.msg || 'Failed to fetch from Cheetah', cheetahAccount: null })
    }
  } catch (error) {
    console.error('Get Cheetah balance error:', error)
    return c.json({ error: 'Failed to get Cheetah balance' }, 500)
  }
})

// GET /accounts/cheetah-balances - Get balances for multiple accounts from Cheetah API
accounts.get('/cheetah-balances/batch', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { accountIds } = c.req.query()

    if (!accountIds) {
      return c.json({ error: 'accountIds required' }, 400)
    }

    const ids = accountIds.split(',')

    // Find accounts
    const where: any = {
      accountId: { in: ids },
      platform: 'FACEBOOK'
    }

    if (userRole === 'USER') {
      where.userId = userId
    }

    const accounts = await prisma.adAccount.findMany({ where })

    if (accounts.length === 0) {
      return c.json({ balances: {} })
    }

    // Load Cheetah config
    const configLoaded = await loadCheetahConfig()
    if (!configLoaded) {
      return c.json({ error: 'Cheetah API not configured', balances: {} })
    }

    // Fetch each account from Cheetah
    const balances: Record<string, any> = {}

    for (const account of accounts) {
      try {
        const result = await cheetahApi.getAccount(account.accountId)

        if (result.code === 0 && result.data && result.data.length > 0) {
          const cheetahAccount = result.data[0]
          const spendCap = parseFloat(cheetahAccount.spend_cap) || 0
          const amountSpent = parseFloat(cheetahAccount.amount_spent) || 0

          balances[account.accountId] = {
            spendCap,
            amountSpent,
            balance: parseFloat(cheetahAccount.balance) || 0,
            remainingBalance: spendCap - amountSpent,
            currency: cheetahAccount.currency,
            status: cheetahAccount.account_status,
            statusText: cheetahAccount.account_status_text,
            isCheetah: true
          }
        } else {
          balances[account.accountId] = { isCheetah: false }
        }
      } catch (err) {
        balances[account.accountId] = { isCheetah: false, error: true }
      }
    }

    return c.json({ balances })
  } catch (error) {
    console.error('Get Cheetah balances batch error:', error)
    return c.json({ error: 'Failed to get Cheetah balances' }, 500)
  }
})

// GET /accounts/:id/insights - Get account insights from Cheetah API
accounts.get('/:id/insights', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { startDate, endDate } = c.req.query()

    // Find account
    const account = await prisma.adAccount.findUnique({
      where: { id }
    })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Check ownership for non-admin users
    if (userRole === 'USER' && account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }

    // Only Facebook accounts supported
    if (account.platform !== 'FACEBOOK') {
      return c.json({ error: 'Only Facebook accounts supported', insights: null })
    }

    // Load Cheetah config
    const configLoaded = await loadCheetahConfig()
    if (!configLoaded) {
      return c.json({ error: 'Cheetah API not configured', insights: null })
    }

    // Get insights for date range (last 6 months if not specified)
    const end = endDate || new Date().toISOString().split('T')[0]
    const start = startDate || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const result = await cheetahApi.getAccountInsightsDateRange(
      account.accountId,
      start,
      end,
      'impressions,clicks,spend,actions'
    )

    if (result.code === 0) {
      return c.json({ insights: result.data, startDate: start, endDate: end })
    } else if (result.code === 999 || result.code === 110) {
      return c.json({ error: 'Account not from Cheetah', insights: null })
    } else {
      return c.json({ error: result.msg || 'Failed to fetch insights', insights: null })
    }
  } catch (error) {
    console.error('Get account insights error:', error)
    return c.json({ error: 'Failed to get account insights' }, 500)
  }
})

// GET /accounts/insights/monthly - Get monthly aggregated insights for an account
accounts.get('/insights/monthly/:accountId', requireUser, async (c) => {
  try {
    const { accountId } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Find account by accountId (Facebook account ID)
    const account = await prisma.adAccount.findFirst({
      where: { accountId }
    })

    if (!account) {
      return c.json({ error: 'Account not found' }, 404)
    }

    // Check ownership for non-admin users
    if (userRole === 'USER' && account.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }

    // Only Facebook accounts supported
    if (account.platform !== 'FACEBOOK') {
      return c.json({ error: 'Only Facebook accounts supported', monthlyData: [] })
    }

    // Load Cheetah config
    const configLoaded = await loadCheetahConfig()
    if (!configLoaded) {
      return c.json({ error: 'Cheetah API not configured', monthlyData: [] })
    }

    // Get last 6 months of data
    const months = []
    const now = new Date()

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth()

      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

      months.push({
        month: date.toLocaleString('en-US', { month: 'short' }),
        year,
        startDate,
        endDate
      })
    }

    // High-value conversion action types for CPA calculation
    // These are meaningful business outcomes (purchases, leads, registrations)
    const HIGH_VALUE_ACTION_TYPES = [
      'purchase', 'omni_purchase', 'web_in_store_purchase', 'offline_purchase',
      'lead', 'onsite_conversion.lead', 'offsite_conversion.fb_pixel_lead',
      'complete_registration', 'offsite_complete_registration_add_meta_leads',
      'submit_application', 'subscribe', 'start_trial',
      'onsite_conversion.purchase', 'onsite_conversion.complete_registration'
    ]

    // Helper function to count conversions (high-value actions only)
    const countConversions = (actions: any[]): number => {
      if (!actions || !Array.isArray(actions)) return 0
      return actions
        .filter((action: any) => HIGH_VALUE_ACTION_TYPES.some(type =>
          action.action_type?.toLowerCase().includes(type.toLowerCase())
        ))
        .reduce((sum: number, action: any) => sum + (parseInt(action.value) || 0), 0)
    }

    // Helper function to count all results
    const countAllResults = (actions: any[]): number => {
      if (!actions || !Array.isArray(actions)) return 0
      return actions.reduce((sum: number, action: any) => sum + (parseInt(action.value) || 0), 0)
    }

    // Fetch insights for each month with full analytics
    const monthlyData = []
    let totalImpressions = 0
    let totalClicks = 0
    let totalSpent = 0
    let totalResults = 0
    let totalConversions = 0

    for (const monthInfo of months) {
      try {
        let deposits = 0
        let spent = 0
        let impressions = 0
        let clicks = 0
        let results = 0
        let conversions = 0

        // Try getAccountInsightsDateRange first (without cost_per_action_type as Cheetah doesn't support it)
        const result = await cheetahApi.getAccountInsightsDateRange(
          accountId,
          monthInfo.startDate,
          monthInfo.endDate,
          'impressions,clicks,spend,actions'
        )

        // Debug logging
        console.log(`[Monthly Insights] Account: ${accountId}, Month: ${monthInfo.month} ${monthInfo.year}`)
        console.log(`[Monthly Insights] API Response code: ${result.code}, msg: ${result.msg}`)

        if (result.code === 0 && result.data) {
          // Log raw data for debugging
          console.log(`[Monthly Insights] Raw data:`, JSON.stringify(result.data)?.substring(0, 300))

          // Sum up metrics from insights
          if (Array.isArray(result.data)) {
            result.data.forEach((day: any) => {
              spent += parseFloat(day.spend) || 0
              impressions += parseInt(day.impressions) || 0
              clicks += parseInt(day.clicks) || 0
              if (day.actions && Array.isArray(day.actions)) {
                results += countAllResults(day.actions)
                conversions += countConversions(day.actions)
              } else if (day.actions) {
                results += parseInt(day.actions) || 0
              }
            })
          } else {
            spent = parseFloat(result.data.spend) || 0
            impressions = parseInt(result.data.impressions) || 0
            clicks = parseInt(result.data.clicks) || 0
            if (result.data.actions && Array.isArray(result.data.actions)) {
              results = countAllResults(result.data.actions)
              conversions = countConversions(result.data.actions)
            } else if (result.data.actions) {
              results = parseInt(result.data.actions) || 0
            }
          }
          console.log(`[Monthly Insights] Parsed: spent=${spent}, impressions=${impressions}, clicks=${clicks}, results=${results}, conversions=${conversions}`)
        } else {
          // Fallback to getDaySpend if insights API fails
          console.log(`[Monthly Insights] Trying getDaySpend fallback for ${accountId}`)
          const spendResult = await cheetahApi.getDaySpend(accountId, monthInfo.startDate, monthInfo.endDate)
          if (spendResult.code === 0 && spendResult.data) {
            if (Array.isArray(spendResult.data)) {
              spendResult.data.forEach((day: any) => {
                spent += parseFloat(day.spend) || 0
              })
            }
            console.log(`[Monthly Insights] getDaySpend success: spent=${spent}`)
          } else {
            console.log(`[Monthly Insights] getDaySpend also failed: code=${spendResult.code}, msg=${spendResult.msg}`)
          }
        }

        // Calculate analytics metrics
        const cpc = clicks > 0 ? spent / clicks : 0 // Cost Per Click
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0 // Click Through Rate (%)
        const cpr = results > 0 ? spent / results : 0 // Cost Per Result (all actions)
        const cpm = impressions > 0 ? (spent / impressions) * 1000 : 0 // Cost Per Mille (1000 impressions)
        // CPA = Cost Per Acquisition (purchases, leads, registrations only)
        const cpa = conversions > 0 ? spent / conversions : 0

        // Aggregate totals
        totalImpressions += impressions
        totalClicks += clicks
        totalSpent += spent
        totalResults += results
        totalConversions += conversions

        // Get deposit amount from our database for this month
        const depositsInMonth = await prisma.accountDeposit.aggregate({
          where: {
            adAccountId: account.id,
            status: 'APPROVED',
            createdAt: {
              gte: new Date(monthInfo.startDate),
              lte: new Date(monthInfo.endDate + 'T23:59:59.999Z')
            }
          },
          _sum: {
            amount: true
          }
        })

        deposits = depositsInMonth._sum.amount || 0

        monthlyData.push({
          month: monthInfo.month,
          year: monthInfo.year,
          deposits,
          spent,
          impressions,
          clicks,
          results,
          conversions,
          cpc: parseFloat(cpc.toFixed(2)),
          ctr: parseFloat(ctr.toFixed(2)),
          cpr: parseFloat(cpr.toFixed(2)),
          cpm: parseFloat(cpm.toFixed(2)),
          cpa: parseFloat(cpa.toFixed(2))
        })
      } catch (err) {
        monthlyData.push({
          month: monthInfo.month,
          year: monthInfo.year,
          deposits: 0,
          spent: 0,
          impressions: 0,
          clicks: 0,
          results: 0,
          conversions: 0,
          cpc: 0,
          ctr: 0,
          cpr: 0,
          cpm: 0,
          cpa: 0
        })
      }
    }

    // Calculate overall totals
    const totalCpr = totalResults > 0 ? totalSpent / totalResults : 0
    const totalCpa = totalConversions > 0 ? totalSpent / totalConversions : 0
    const totals = {
      impressions: totalImpressions,
      clicks: totalClicks,
      spent: parseFloat(totalSpent.toFixed(2)),
      results: totalResults,
      conversions: totalConversions,
      cpc: totalClicks > 0 ? parseFloat((totalSpent / totalClicks).toFixed(2)) : 0,
      ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
      cpr: parseFloat(totalCpr.toFixed(2)),
      cpm: totalImpressions > 0 ? parseFloat(((totalSpent / totalImpressions) * 1000).toFixed(2)) : 0,
      cpa: parseFloat(totalCpa.toFixed(2)) // Cost Per Acquisition (purchases, leads, registrations)
    }

    return c.json({ monthlyData, totals, isCheetah: true })
  } catch (error) {
    console.error('Get monthly insights error:', error)
    return c.json({ error: 'Failed to get monthly insights', monthlyData: [], totals: null }, 500)
  }
})

export default accounts
