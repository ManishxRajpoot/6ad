import { Hono } from 'hono'
import { z } from 'zod'
import { cheetahApi } from '../services/cheetah-api.js'
import { discoverAccountProfile } from '../services/adspower-worker.js'
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

import { prisma } from '../lib/prisma.js'
import { autoRechargeAssignedVccCard } from '../lib/vcc-auto-recharge.js'
import { tryBmTokenRecharge } from '../lib/bm-token-recharge.js'
import { autoLinkAdAccount } from '../lib/detect-account-ownership.js'
import { decryptToken } from '../lib/token-crypto.js'

type Platform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT' | 'BING'
import { verifyToken, requireAgent, requireAdmin, requireUser } from '../middleware/auth.js'
import { createNotification } from './notifications.js'

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

// Cheetah API credentials from environment
const CHEETAH_CREDENTIALS = {
  production: {
    appid: process.env.CHEETAH_APPID || '',
    secret: process.env.CHEETAH_SECRET || '',
    baseUrl: process.env.CHEETAH_BASE_URL || 'https://open-api.cmcm.com',
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
    const { platform, status, targetUserId, page = '1', limit = '100' } = c.req.query()

    const where: any = {}

    // Role-based filtering
    if (userRole === 'USER') {
      where.userId = userId
      // Exclude REFUNDED and SUSPENDED accounts from user's view (unless explicitly filtered)
      if (!status) {
        where.status = { notIn: ['REFUNDED', 'SUSPENDED'] }
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
          },
          refunds: {
            select: { amount: true, status: true }
          },
          // Show VCC cards assigned to this ad account in the admin table
          assignedVccCards: {
            select: {
              id: true,
              label: true,
              alias: true,
              cardNumber: true,
              yeewallexCardId: true,
              status: true,
              balance: true,
              currency: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adAccount.count({ where })
    ])

    // Balance visibility:
    //   - USER role → look up user's controlling agent; if agent.showBalanceToAgent === false, hide balances
    //   - AGENT role → check own showBalanceToAgent flag
    //   - ADMIN → always see balances
    let showBalance = true
    if (userRole === 'USER') {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { agent: { select: { showBalanceToAgent: true } } },
      })
      if (me?.agent && me.agent.showBalanceToAgent === false) {
        showBalance = false
      }
    } else if (userRole === 'AGENT') {
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { showBalanceToAgent: true },
      })
      if (me?.showBalanceToAgent === false) showBalance = false
    }

    const safeAccounts = showBalance
      ? accountsList
      : accountsList.map(a => ({ ...a, balance: null, totalDeposit: null, totalSpend: null }))

    return c.json({
      accounts: safeAccounts,
      showBalance,
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
    const { platform, status, page = '1', limit = '100' } = c.req.query()

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
    const { platform, status, cardPaymentStatus, page = '1', limit = '10000' } = c.req.query()

    const where: any = {}
    if (platform) {
      where.adAccount = { platform: platform.toUpperCase() }
    }
    if (status) {
      where.status = status.toUpperCase()
    }
    if (cardPaymentStatus) {
      where.cardPaymentStatus = cardPaymentStatus.toUpperCase()
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
              fundingSources: true,
              sourceBmId: true,
              sourceBmName: true,
              extensionProfileId: true,
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

    // Fetch extension profiles: first by extensionProfileId, then fallback by managedAdAccountIds
    const profileIds = [...new Set(deposits.map(d => d.adAccount?.extensionProfileId).filter(Boolean))] as string[]
    const accountIds = [...new Set(deposits.map(d => d.adAccount?.accountId).filter(Boolean))] as string[]

    const [profilesById, profilesByAccount] = await Promise.all([
      profileIds.length > 0
        ? prisma.facebookAutomationProfile.findMany({
            where: { id: { in: profileIds } },
            select: { id: true, label: true, adsPowerSerialNumber: true }
          })
        : [],
      accountIds.length > 0
        ? prisma.facebookAutomationProfile.findMany({
            where: { managedAdAccountIds: { hasSome: accountIds } },
            select: { id: true, label: true, adsPowerSerialNumber: true, managedAdAccountIds: true }
          })
        : []
    ])

    const profileMapById = new Map(profilesById.map(p => [p.id, p]))
    // Map accountId -> profile (first match)
    const profileMapByAccount = new Map<string, typeof profilesByAccount[0]>()
    for (const p of profilesByAccount) {
      for (const accId of p.managedAdAccountIds) {
        if (!profileMapByAccount.has(accId)) profileMapByAccount.set(accId, p)
      }
    }

    // Batch fetch VCC cards:
    //   1. Cards explicitly recorded on the deposit (vccCardId) — auto-recharged already
    //   2. Cards currently linked to the deposit's ad account (assignedAdAccountId) — will be auto-recharged on approval
    const vccCardIds = [...new Set(deposits.map(d => (d as any).vccCardId).filter(Boolean))] as string[]
    const adAccountIds2 = [...new Set(deposits.map(d => d.adAccountId).filter(Boolean))]

    const [cardsById, cardsByAdAccount] = await Promise.all([
      vccCardIds.length > 0
        ? prisma.vccCard.findMany({
            where: { id: { in: vccCardIds } },
            select: { id: true, yeewallexCardId: true, cardNumber: true, label: true, status: true, currency: true, balance: true, assignedAdAccountId: true },
          })
        : [],
      adAccountIds2.length > 0
        ? prisma.vccCard.findMany({
            where: { assignedAdAccountId: { in: adAccountIds2 } },
            select: { id: true, yeewallexCardId: true, cardNumber: true, label: true, status: true, currency: true, balance: true, assignedAdAccountId: true },
          })
        : [],
    ])
    const cardByIdMap = new Map(cardsById.map(c => [c.id, c]))
    const cardByAdAccountMap = new Map<string, typeof cardsByAdAccount[0]>()
    for (const c of cardsByAdAccount) {
      if (c.assignedAdAccountId && !cardByAdAccountMap.has(c.assignedAdAccountId)) {
        cardByAdAccountMap.set(c.assignedAdAccountId, c)
      }
    }

    const depositsWithProfiles = deposits.map(d => {
      let profile = null
      if (d.adAccount?.extensionProfileId) {
        profile = profileMapById.get(d.adAccount.extensionProfileId) || null
      }
      if (!profile && d.adAccount?.accountId) {
        profile = profileMapByAccount.get(d.adAccount.accountId) || null
      }
      const recordedCardId = (d as any).vccCardId
      const vccCard = (recordedCardId && cardByIdMap.get(recordedCardId))
        || (d.adAccountId && cardByAdAccountMap.get(d.adAccountId))
        || null
      return {
        ...d,
        vccCard,
        adAccount: d.adAccount ? { ...d.adAccount, extensionProfile: profile } : d.adAccount
      }
    })

    return c.json({
      deposits: depositsWithProfiles,
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

// POST /accounts/deposits/check-cheetah - Check which accounts are from Cheetah
accounts.post('/deposits/check-cheetah', requireAdmin, async (c) => {
  try {
    const { accountIds } = await c.req.json()

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return c.json({ error: 'accountIds array required' }, 400)
    }

    const configLoaded = await loadCheetahConfig()
    if (!configLoaded) {
      return c.json({ cheetahStatus: {} })
    }

    // Parallelize all Cheetah API calls instead of sequential
    const results = await Promise.allSettled(
      accountIds.map(async (accountId: string) => {
        const result = await cheetahApi.getAccount(accountId)
        return { accountId, isCheetah: result.code === 0 && result.data && result.data.length > 0 }
      })
    )

    const cheetahStatus: Record<string, boolean> = {}
    for (const r of results) {
      if (r.status === 'fulfilled') {
        cheetahStatus[r.value.accountId] = r.value.isCheetah
      } else {
        // Failed API call — mark as not Cheetah
      }
    }

    return c.json({ cheetahStatus })
  } catch (error) {
    console.error('Check Cheetah accounts error:', error)
    return c.json({ error: 'Failed to check Cheetah accounts' }, 500)
  }
})

// ========== CARD PAYMENT TRACKING (admin-only) ==========

// GET /accounts/deposits/card-pending-count — Count deposits with pending card payments
accounts.get('/deposits/card-pending-count', requireAdmin, async (c) => {
  try {
    const count = await prisma.accountDeposit.count({
      where: { cardPaymentStatus: 'PENDING' }
    })
    return c.json({ count })
  } catch (error) {
    console.error('Card pending count error:', error)
    return c.json({ count: 0 })
  }
})

// POST /accounts/deposits/mark-card-done — Mark card payment as done (single or bulk)
accounts.post('/deposits/mark-card-done', requireAdmin, async (c) => {
  try {
    const { depositIds } = await c.req.json()
    if (!depositIds || !Array.isArray(depositIds) || depositIds.length === 0) {
      return c.json({ error: 'depositIds array required' }, 400)
    }

    const result = await prisma.accountDeposit.updateMany({
      where: {
        id: { in: depositIds },
        cardPaymentStatus: 'PENDING',
      },
      data: {
        cardPaymentStatus: 'DONE',
        cardPaymentDoneAt: new Date(),
      }
    })

    return c.json({
      message: `${result.count} deposit(s) marked as card payment done`,
      updated: result.count,
    })
  } catch (error) {
    console.error('Mark card done error:', error)
    return c.json({ error: 'Failed to mark card payment' }, 500)
  }
})

// ========== ACCOUNT REFUNDS (GET routes before /:platform) ==========

// GET /accounts/refunds - Get user's own account refunds
// NOTE: This route MUST be defined BEFORE /:platform to avoid route conflicts
accounts.get('/refunds', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const { platform, status, page = '1', limit = '100' } = c.req.query()

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
              application: { select: { applyId: true } }
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
    const { platform, status, page = '1', limit = '100' } = c.req.query()

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
              application: { select: { applyId: true } },
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
    const { platform, status, page = '1', limit = '100' } = c.req.query()

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
              application: { select: { applyId: true } }
            }
          },
          toAccount: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
              balance: true,
              application: { select: { applyId: true } }
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
    const { platform, status, page = '1', limit = '100' } = c.req.query()

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
        // Parallelize all Cheetah API calls
        const results = await Promise.allSettled(
          fbAccountIds.map(async (accountId: string) => {
            const result = await cheetahApi.getAccount(accountId)
            return { accountId, result }
          })
        )
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const { accountId, result } = r.value
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
          } else {
            // Failed — mark as not cheetah
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

// ==================== CARD WALLET TOP-UP TRACKER ====================

// GET /accounts/card-wallet-pending - Get pending card payment amount (derived from per-deposit tracking)
accounts.get('/card-wallet-pending', requireAdmin, async (c) => {
  try {
    const result = await prisma.accountDeposit.aggregate({
      where: { cardPaymentStatus: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    })
    return c.json({ pendingAmount: result._sum.amount || 0, pendingCount: result._count || 0 })
  } catch (error) {
    console.error('Get card wallet pending error:', error)
    return c.json({ pendingAmount: 0, pendingCount: 0 })
  }
})

// POST /accounts/card-wallet-mark-added - Reset pending amount after admin adds money to wallet
accounts.post('/card-wallet-mark-added', requireAdmin, async (c) => {
  try {
    await prisma.setting.upsert({
      where: { key: 'card_wallet_pending_amount' },
      update: { value: '0' },
      create: { key: 'card_wallet_pending_amount', value: '0', description: 'Pending card account wallet top-up amount' }
    })
    return c.json({ message: 'Wallet top-up marked as added', pendingAmount: 0 })
  } catch (error) {
    console.error('Mark wallet added error:', error)
    return c.json({ error: 'Failed to mark wallet as added' }, 500)
  }
})

// GET /accounts/:platform - Get accounts by platform
accounts.get('/:platform', requireUser, async (c) => {
  try {
    const { platform } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { status, page = '1', limit = '100' } = c.req.query()

    const platformUpper = platform.toUpperCase() as Platform
    if (!['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING'].includes(platformUpper)) {
      return c.json({ error: 'Invalid platform' }, 400)
    }

    const where: any = { platform: platformUpper }

    if (userRole === 'USER') {
      where.userId = userId
      // Exclude REFUNDED and SUSPENDED from user's view
      if (!status) {
        where.status = { notIn: ['REFUNDED', 'SUSPENDED'] }
      }
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
        accountId: data.accountId.trim()
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
        accountId: data.accountId.trim(),
        accountName: data.accountName,
        bmId: data.bmId,
        timezone: data.timezone,
        currency: data.currency,
        remarks: data.remarks,
        userId,
        extensionProfileId: data.extensionProfileId || null,
      }
    })

    // Auto-detect ownership: ask Cheetah + every active BM token which one owns
    // this accountId. Patches sourceBmId/sourceBmName + accountName from FB.
    // Runs in the background so the API response isn't held up by FB calls.
    if (data.platform === 'FACEBOOK') {
      autoLinkAdAccount(account.id, account.accountId, account.accountName).catch(e =>
        console.warn(`[Create Account] auto-link failed for act_${account.accountId}: ${e.message}`)
      )
    }

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

    // Mark APPROVED first so the user sees the change immediately.
    await prisma.adAccount.update({
      where: { id },
      data: { status: 'APPROVED', adminRemarks },
    })

    // For Facebook: detect Cheetah/BM-token ownership and (if admin's name
    // differs from the live FB name) rename on the platform to match.
    // Runs in background so it doesn't block the approval response.
    if (account.platform === 'FACEBOOK') {
      autoLinkAdAccount(id, account.accountId, account.accountName).then(result => {
        if (result.linked) {
          if (result.renamed) {
            console.log(`[Account Approve] act_${account.accountId} renamed on ${result.source} to "${account.accountName}"`)
          }
          // If linked to a BM token (not Cheetah), no AdsPower discovery needed.
          if (result.source === 'cheetah') return
        }
        // Not linked to Cheetah or any BM → fall back to AdsPower profile discovery.
        console.log(`[Account Approve] act_${account.accountId} not in Cheetah/BM — triggering AdsPower discovery`)
        discoverAccountProfile(account.accountId).then(profileId => {
          if (profileId) console.log(`[Account Approve] Discovery: act_${account.accountId} → profile ${profileId}`)
          else console.log(`[Account Approve] Discovery: act_${account.accountId} not found in any AdsPower profile`)
        }).catch(err => console.error(`[Account Approve] Discovery error for act_${account.accountId}:`, err.message))
      }).catch(err => {
        console.warn(`[Account Approve] auto-link failed for act_${account.accountId}: ${err.message}`)
      })
    }

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

// POST /accounts/:id/rename - Rename ad account on the platform (Cheetah or BM-token Graph API)
accounts.post('/:id/rename', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const { name } = await c.req.json().catch(() => ({}))
    const newName = typeof name === 'string' ? name.trim() : ''

    if (!newName) return c.json({ message: 'Name is required' }, 400)
    if (newName.length < 2 || newName.length > 100) {
      return c.json({ message: 'Name must be 2–100 characters' }, 400)
    }

    const account = await prisma.adAccount.findUnique({ where: { id } })
    if (!account) return c.json({ message: 'Account not found' }, 404)
    if (account.userId !== userId) return c.json({ message: 'Access denied' }, 403)
    if (account.platform !== 'FACEBOOK') {
      return c.json({ message: 'Rename is only supported for Facebook accounts' }, 400)
    }

    const sourceBmId = account.sourceBmId

    // ── Cheetah path ─────────────────────────────────────────────
    if (sourceBmId === 'cheetah') {
      const result = await cheetahApi.updateAccountName(account.accountId, newName)
      if (result.code !== 0) {
        return c.json({ message: `Cheetah rename failed: ${result.message || 'unknown error'}` }, 502)
      }
      await prisma.adAccount.update({ where: { id }, data: { accountName: newName } })
      console.log(`[Rename] act_${account.accountId} via Cheetah → "${newName}"`)
      return c.json({ message: 'Account renamed', name: newName, source: 'cheetah' })
    }

    // ── BM token / FB Graph API path ─────────────────────────────
    if (sourceBmId) {
      const bmToken = await prisma.bmToken.findUnique({
        where: { bmId: sourceBmId },
        select: { id: true, status: true, encryptedToken: true, bmName: true },
      })
      if (!bmToken) {
        return c.json({ message: 'No BM token available for this account — contact support to add one' }, 400)
      }
      if (bmToken.status !== 'ACTIVE') {
        return c.json({ message: `BM token is ${bmToken.status} — contact support` }, 400)
      }

      let token: string
      try {
        token = decryptToken(bmToken.encryptedToken)
      } catch (e: any) {
        return c.json({ message: 'Failed to decrypt BM token — contact support' }, 500)
      }

      const url = `https://graph.facebook.com/v25.0/act_${account.accountId}`
      const params = new URLSearchParams({ name: newName, access_token: token })
      const fb = await fetch(url, { method: 'POST', body: params })
      const fbJson: any = await fb.json().catch(() => ({}))
      if (!fb.ok || fbJson?.error) {
        const err = fbJson?.error?.message || `HTTP ${fb.status}`
        if (/Invalid OAuth|access token|expired/i.test(err)) {
          await prisma.bmToken.update({
            where: { id: bmToken.id },
            data: { status: 'INVALID', lastError: err.slice(0, 500), lastErrorAt: new Date() },
          }).catch(() => {})
        }
        return c.json({ message: `Facebook rename failed: ${err}` }, 502)
      }

      await prisma.adAccount.update({ where: { id }, data: { accountName: newName } })
      await prisma.bmToken.update({
        where: { id: bmToken.id },
        data: { lastUsedAt: new Date(), lastError: null, lastErrorAt: null },
      }).catch(() => {})
      console.log(`[Rename] act_${account.accountId} via BM ${bmToken.bmName || sourceBmId} → "${newName}"`)
      return c.json({ message: 'Account renamed', name: newName, source: 'bm-token' })
    }

    return c.json({ message: 'Cannot rename: account has no Cheetah or BM-token source configured' }, 400)
  } catch (err: any) {
    console.error('[Rename] error:', err)
    return c.json({ message: err.message || 'Server error' }, 500)
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

    // 10-minute cooldown: prevent duplicate recharges on the same ad account
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    const recentDeposit = await prisma.accountDeposit.findFirst({
      where: {
        adAccountId: id,
        createdAt: { gte: tenMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (recentDeposit) {
      const waitMs = recentDeposit.createdAt.getTime() + 10 * 60 * 1000 - Date.now()
      const waitMin = Math.ceil(waitMs / 60000)
      return c.json({ message: `Please wait ${waitMin} minute${waitMin > 1 ? 's' : ''} before submitting another recharge for this ad account.` }, 429)
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

    // ─── AUTO-APPROVE LOGIC FOR FACEBOOK ACCOUNTS ─────────────────
    if (account.platform === 'FACEBOOK') {
      let autoApproved = false
      const isCheetahAccount = account.sourceBmId === 'cheetah'
      let rechargeMethod = 'NONE'
      let rechargeStatus = 'NONE'

      if (isCheetahAccount) {
        // Credit Line account — try recharge via Cheetah API immediately
        try {
          const configLoaded = await loadCheetahConfig()
          if (configLoaded) {
            const accountResult = await cheetahApi.getAccount(account.accountId)
            if (accountResult.code === 0 && accountResult.data && accountResult.data.length > 0) {
              const cheetahAccount = accountResult.data[0]
              const currentSpendCap = parseFloat(cheetahAccount.spend_cap) || 0

              // SNAPSHOT-FIRST: compute target ONCE, store it
              const targetSpendCap = currentSpendCap + amount
              await prisma.accountDeposit.update({
                where: { id: accountDeposit.id },
                data: { previousSpendCap: currentSpendCap, targetSpendCap },
              })

              // GUARD: if already at target (shouldn't happen on first deposit, but safety)
              if (currentSpendCap >= targetSpendCap - 0.01) {
                rechargeMethod = 'CHEETAH'
                rechargeStatus = 'COMPLETED'
                autoApproved = true
                console.log(`[Auto-Approve] Credit Line already at target for act_${account.accountId}: cap=$${currentSpendCap} >= target=$${targetSpendCap}`)
              } else {
                const quotaResult = await cheetahApi.getQuota()
                if (quotaResult.code === 0) {
                  const availableQuota = parseFloat(quotaResult.data.available_quota) || 0
                  if (availableQuota >= amount) {
                    // Use absolute targetSpendCap, NOT currentCap + amount
                    const rechargeResult = await cheetahApi.rechargeAccount(account.accountId, targetSpendCap)
                    if (rechargeResult.code === 0) {
                      rechargeMethod = 'CHEETAH'
                      rechargeStatus = 'COMPLETED'
                      autoApproved = true
                      console.log(`[Auto-Approve] Credit Line recharge success for act_${account.accountId}: $${amount} target=$${targetSpendCap}`)
                    } else {
                      console.log(`[Auto-Approve] Credit Line recharge API failed for act_${account.accountId}: ${rechargeResult.msg}`)
                    }
                  } else {
                    console.log(`[Auto-Approve] Credit Line insufficient quota for act_${account.accountId}: available $${availableQuota}, need $${amount}`)
                  }
                }
              }
            }
          }
        } catch (err: any) {
          console.log(`[Auto-Approve] Credit Line error for act_${account.accountId}: ${err.message}`)
        }

        // If recharge failed, keep deposit PENDING — don't show "Approved" to user
        // Cron will retry once admin adds funds to Credit Line API
        if (!autoApproved) {
          rechargeMethod = 'CHEETAH'
          rechargeStatus = 'PENDING'
          // Mark approvedAt so cron picks it up, but keep status PENDING
          autoApproved = true
          console.log(`[Auto-Approve] Credit Line recharge failed, keeping PENDING for retry — act_${account.accountId}`)
        }
      } else {
        // Non-Credit-Line account: prefer BM System User token if one is linked.
        //  - Token + success → APPROVED + COMPLETED inline.
        //  - Token + fail    → keep PENDING with error (no extension fallback).
        //  - No token        → keep PENDING (admin can add a BM token later).
        const bmAttempt = await tryBmTokenRecharge({
          depositId: accountDeposit.id,
          adAccountId: account.accountId,
          sourceBmId: account.sourceBmId,
          amount,
        })

        if (bmAttempt.used && bmAttempt.success) {
          rechargeMethod = 'BM_TOKEN'
          rechargeStatus = 'COMPLETED'
          autoApproved = true
          await prisma.accountDeposit.update({
            where: { id: accountDeposit.id },
            data: {
              previousSpendCap: bmAttempt.previousSpendCap,
              newSpendCap: bmAttempt.newSpendCap,
            },
          }).catch(() => {})
          console.log(`[Auto-Approve] BM token recharge SUCCESS act_${account.accountId}: ${bmAttempt.details}`)
        } else if (bmAttempt.used && !bmAttempt.success) {
          rechargeMethod = 'BM_TOKEN'
          rechargeStatus = 'FAILED'
          autoApproved = true  // still set approvedAt so admin/cron can retry
          await prisma.accountDeposit.update({
            where: { id: accountDeposit.id },
            data: { rechargeError: bmAttempt.error.slice(0, 500) },
          }).catch(() => {})
          console.log(`[Auto-Approve] BM token recharge FAILED act_${account.accountId}: ${bmAttempt.error} — leaving PENDING`)
        } else {
          // No BM token — leave PENDING (per product decision: no extension auto-fallback)
          rechargeMethod = 'NONE'
          rechargeStatus = 'PENDING'
          autoApproved = true
          console.log(`[Auto-Approve] No BM token for act_${account.accountId} (${bmAttempt.reason}) — leaving PENDING`)
        }
      }

      if (autoApproved) {
        try {
          if (isCheetahAccount && rechargeStatus === 'COMPLETED') {
            // Credit Line: recharge succeeded → APPROVED + increment balance
            await prisma.$transaction(async (tx) => {
              await tx.accountDeposit.update({
                where: { id: accountDeposit.id },
                data: {
                  status: 'APPROVED',
                  approvedAt: new Date(),
                  rechargeMethod,
                  rechargeStatus,
                  rechargedAt: new Date(),
                }
              })
              await tx.adAccount.update({
                where: { id },
                data: {
                  totalDeposit: { increment: amount },
                  balance: { increment: amount }
                }
              })
            })

            // Send approval email
            const approvedDomain2 = account.user.agent?.customDomains?.[0]
            const agent2 = account.user.agent
            const agentLogo2 = approvedDomain2?.emailLogo || approvedDomain2?.brandLogo || agent2?.emailLogo || agent2?.brandLogo || null
            const agentBrandName2 = account.user.agent?.username || null
            const updatedAcc = await prisma.adAccount.findUnique({ where: { id }, select: { balance: true } })
            const approvalEmail = getAccountRechargeApprovedTemplate({
              username: account.user.username,
              applyId,
              amount,
              commission: commissionAmount,
              totalCost: totalAmount,
              platform: account.platform,
              accountId: account.accountId,
              accountName: account.accountName || undefined,
              newBalance: Number(updatedAcc?.balance) || 0,
              agentLogo: agentLogo2,
              agentBrandName: agentBrandName2
            })
            sendEmail({ to: account.user.email, ...approvalEmail, senderName: account.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(account.user.agent) }).catch(console.error)

            await createNotification({
              userId: account.userId,
              type: 'DEPOSIT_APPROVED',
              title: 'Ad Account Deposit Approved',
              message: `Your deposit of $${Number(amount).toLocaleString()} for account ${account.accountName || account.accountId} has been auto-approved.`,
              link: '/facebook'
            })
            console.log(`[Auto-Approve] Deposit ${accountDeposit.id} auto-approved + recharged (CREDIT LINE)`)
            return c.json({ message: 'Deposit auto-approved', deposit: accountDeposit, autoApproved: true, rechargeMethod }, 201)
          } else if (isCheetahAccount && rechargeStatus === 'PENDING') {
            // Credit Line: recharge failed/quota insufficient → keep PENDING, set approvedAt so cron retries
            await prisma.accountDeposit.update({
              where: { id: accountDeposit.id },
              data: {
                status: 'PENDING',
                approvedAt: new Date(),
                rechargeMethod,
                rechargeStatus,
              }
            })
            console.log(`[Auto-Approve] Deposit ${accountDeposit.id} kept PENDING, Credit Line recharge will retry — act_${account.accountId}`)
            return c.json({ message: 'Deposit pending — recharge will be retried when funds available', deposit: accountDeposit, autoApproved: false, rechargeMethod }, 201)
          } else if (rechargeMethod === 'BM_TOKEN' && rechargeStatus === 'COMPLETED') {
            // BM token recharge succeeded → APPROVED + increment balance.
            // NOTE: don't pre-set cardPaymentStatus — autoRechargeAssignedVccCard
            // owns that field and uses an atomic claim to prevent double-charge.
            await prisma.$transaction(async (tx) => {
              await tx.accountDeposit.update({
                where: { id: accountDeposit.id },
                data: {
                  status: 'APPROVED',
                  approvedAt: new Date(),
                  rechargeMethod,
                  rechargeStatus,
                  rechargedAt: new Date(),
                  rechargedBy: 'bm-token-auto',
                },
              })
              await tx.adAccount.update({
                where: { id },
                data: {
                  totalDeposit: { increment: amount },
                  balance: { increment: amount },
                },
              })
            })

            // Approval email + notification
            const approvedDomain3 = account.user.agent?.customDomains?.[0]
            const agent3 = account.user.agent
            const agentLogo3 = approvedDomain3?.emailLogo || approvedDomain3?.brandLogo || agent3?.emailLogo || agent3?.brandLogo || null
            const agentBrandName3 = account.user.agent?.username || null
            const updatedAcc3 = await prisma.adAccount.findUnique({ where: { id }, select: { balance: true } })
            const approvalEmail3 = getAccountRechargeApprovedTemplate({
              username: account.user.username,
              applyId,
              amount,
              commission: commissionAmount,
              totalCost: totalAmount,
              platform: account.platform,
              accountId: account.accountId,
              accountName: account.accountName || undefined,
              newBalance: Number(updatedAcc3?.balance) || 0,
              agentLogo: agentLogo3,
              agentBrandName: agentBrandName3,
            })
            sendEmail({ to: account.user.email, ...approvalEmail3, senderName: account.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(account.user.agent) }).catch(console.error)

            await createNotification({
              userId: account.userId,
              type: 'DEPOSIT_APPROVED',
              title: 'Ad Account Deposit Approved',
              message: `Your deposit of $${Number(amount).toLocaleString()} for account ${account.accountName || account.accountId} has been auto-approved.`,
              link: '/facebook',
            })
            // VCC auto-recharge: if a card is linked to this ad account, recharge it for the same amount.
            // The helper's atomic claim handles double-charge prevention internally.
            autoRechargeAssignedVccCard({
              adAccountId: id,
              amount,
              reason: 'BM_TOKEN_AUTO',
              depositId: accountDeposit.id,
            }).catch(() => { /* helper swallows errors */ })

            console.log(`[Auto-Approve] Deposit ${accountDeposit.id} auto-approved + recharged (BM TOKEN)`)
            return c.json({ message: 'Deposit auto-approved via BM token', deposit: accountDeposit, autoApproved: true, rechargeMethod }, 201)
          } else {
            // BM token failed OR no token: leave PENDING for admin/cron retry.
            await prisma.accountDeposit.update({
              where: { id: accountDeposit.id },
              data: {
                approvedAt: new Date(),
                rechargeMethod,
                rechargeStatus,
              }
            })
            console.log(`[Auto-Approve] Deposit ${accountDeposit.id} pending — ${rechargeMethod}/${rechargeStatus}`)
            return c.json({ message: 'Deposit pending — awaiting BM token recharge', deposit: accountDeposit, autoApproved: false, rechargeMethod }, 201)
          }
        } catch (err: any) {
          console.error('[Auto-Approve] Failed to auto-approve:', err.message)
          // Fall through — deposit stays PENDING for admin
        }
      }
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

    // Block if extension is currently processing this recharge
    if (deposit.rechargeStatus === 'IN_PROGRESS') {
      return c.json({ error: 'Recharge currently in progress by extension — please wait' }, 409)
    }

    // Cheetah API auto-recharge variables
    let cheetahRechargeResult: any = null
    let cheetahError: string | null = null
    let isCheetahAccount: boolean = false

    // STEP 1: For Facebook accounts, check & recharge Cheetah FIRST before approving
    if (deposit.adAccount.platform === 'FACEBOOK') {
      try {
        const configLoaded = await loadCheetahConfig()
        if (configLoaded) {
          // Check if this account exists in Cheetah
          const accountResult = await cheetahApi.getAccount(deposit.adAccount.accountId)

          if (accountResult.code === 0 && accountResult.data && accountResult.data.length > 0) {
            isCheetahAccount = true

            // Skip Cheetah API if already recharged (prevents double-spend on retry)
            if (deposit.rechargeStatus === 'COMPLETED') {
              console.log(`[Admin Approve] Cheetah already recharged for deposit ${id} — skipping API call`)
              cheetahRechargeResult = { code: 0 }
            } else {
            const cheetahAccount = accountResult.data[0]
            const currentSpendCap = parseFloat(cheetahAccount.spend_cap) || 0
            const depositAmount = Number(deposit.amount)

            // SNAPSHOT-FIRST: use stored target or compute it
            let targetSpendCap = deposit.targetSpendCap
            if (!targetSpendCap) {
              targetSpendCap = currentSpendCap + depositAmount
              await prisma.accountDeposit.update({
                where: { id },
                data: { previousSpendCap: currentSpendCap, targetSpendCap },
              })
              console.log(`[Admin Approve] Snapshot cap for deposit ${id}: current=$${currentSpendCap}, target=$${targetSpendCap}`)
            }

            // GUARD: if already at target, skip API call
            if (currentSpendCap >= targetSpendCap - 0.01) {
              console.log(`[Admin Approve] Already at target for deposit ${id}: cap=$${currentSpendCap} >= target=$${targetSpendCap}`)
              cheetahRechargeResult = { code: 0 }
              await prisma.accountDeposit.update({
                where: { id },
                data: { rechargeStatus: 'COMPLETED', rechargeMethod: 'CHEETAH', rechargedAt: new Date(), newSpendCap: targetSpendCap }
              })
            } else {
            // Check available quota before recharging
            const quotaResult = await cheetahApi.getQuota()
            if (quotaResult.code === 0) {
              const availableQuota = parseFloat(quotaResult.data.available_quota) || 0

              if (availableQuota >= depositAmount) {
                // Use absolute targetSpendCap (NOT currentCap + depositAmount)
                cheetahRechargeResult = await cheetahApi.rechargeAccount(
                  deposit.adAccount.accountId,
                  targetSpendCap
                )

                // Audit log
                await prisma.rechargeAuditLog.create({
                  data: { depositId: id, adAccountId: deposit.adAccount.accountId, action: 'FB_POST', actor: 'admin-approve', previousCap: currentSpendCap, targetCap: targetSpendCap, amount: depositAmount }
                }).catch(() => {})

                if (cheetahRechargeResult.code !== 0) {
                  // Cheetah recharge failed - DO NOT approve, keep pending
                  return c.json({
                    error: cheetahRechargeResult.msg || 'Cheetah recharge failed',
                    cheetahRecharge: 'failed',
                    isCheetahAccount: true
                  }, 400)
                }

                // Immediately mark Cheetah success BEFORE the main transaction
                await prisma.accountDeposit.update({
                  where: { id },
                  data: { rechargeStatus: 'COMPLETED', rechargeMethod: 'CHEETAH', rechargedAt: new Date(), newSpendCap: targetSpendCap }
                })
              } else {
                // Insufficient Cheetah balance - DO NOT approve, keep pending
                return c.json({
                  error: `Insufficient Cheetah balance. Available: $${availableQuota.toFixed(2)}, Required: $${depositAmount.toFixed(2)}`,
                  cheetahRecharge: 'failed',
                  isCheetahAccount: true
                }, 400)
              }
            } else {
              // Failed to check quota - DO NOT approve, keep pending
              return c.json({
                error: quotaResult.msg || 'Failed to check Cheetah quota',
                cheetahRecharge: 'failed',
                isCheetahAccount: true
              }, 400)
            }
            } // end else (not already at target)
            } // end else (not already COMPLETED)
          } else {
            // Account not found in Cheetah - not a Cheetah account, allow manual approve
            isCheetahAccount = false
          }
        } else {
          // Cheetah config not found - don't block, admin can handle manually
          cheetahError = 'Cheetah API configuration not found'
        }
      } catch (error: any) {
        // Cheetah API error - DO NOT approve for Cheetah accounts, keep pending
        return c.json({
          error: error.message || 'Cheetah API error',
          cheetahRecharge: 'failed',
          isCheetahAccount: true
        }, 400)
      }
    }

    // STEP 2: Determine recharge method and status
    let rechargeMethod = 'NONE'
    let rechargeStatus = 'NONE'
    let depositStatus = 'APPROVED' // Default for non-FB or Cheetah

    if (deposit.adAccount.platform === 'FACEBOOK') {
      if (isCheetahAccount && cheetahRechargeResult?.code === 0) {
        rechargeMethod = 'CHEETAH'
        rechargeStatus = 'COMPLETED'
        depositStatus = 'APPROVED'
      } else if (!isCheetahAccount) {
        // Non-Cheetah: try BM System User token if linked.
        //   token + success → APPROVED inline
        //   token + fail    → keep PENDING with error
        //   no token        → keep PENDING (admin must add token / wait)
        const bmAttempt = await tryBmTokenRecharge({
          depositId: id,
          adAccountId: deposit.adAccount.accountId,
          sourceBmId: deposit.adAccount.sourceBmId,
          amount: Number(deposit.amount),
        })

        if (bmAttempt.used && bmAttempt.success) {
          rechargeMethod = 'BM_TOKEN'
          rechargeStatus = 'COMPLETED'
          depositStatus = 'APPROVED'
          await prisma.accountDeposit.update({
            where: { id },
            data: {
              previousSpendCap: bmAttempt.previousSpendCap,
              newSpendCap: bmAttempt.newSpendCap,
              rechargedBy: 'bm-token-admin',
            },
          }).catch(() => {})
          console.log(`[Admin Approve] BM token recharge SUCCESS for deposit ${id}: ${bmAttempt.details}`)
        } else if (bmAttempt.used && !bmAttempt.success) {
          // Token exists but FB rejected — leave pending and surface the error
          rechargeMethod = 'BM_TOKEN'
          rechargeStatus = 'FAILED'
          depositStatus = 'PENDING'
          await prisma.accountDeposit.update({
            where: { id },
            data: { rechargeError: bmAttempt.error.slice(0, 500) },
          }).catch(() => {})
          console.log(`[Admin Approve] BM token recharge FAILED for deposit ${id}: ${bmAttempt.error}`)
        } else {
          // No BM token — keep PENDING (no extension auto-fallback)
          rechargeMethod = 'NONE'
          rechargeStatus = 'PENDING'
          depositStatus = 'PENDING'
          console.log(`[Admin Approve] No BM token for deposit ${id} (${bmAttempt.reason}) — leaving PENDING`)
        }
      }
    }

    // STEP 3: Update DB
    if (depositStatus === 'APPROVED') {
      // Cheetah or non-FB: approve + increment balance immediately
      await prisma.$transaction(async (tx) => {
        await tx.accountDeposit.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            rechargeMethod,
            rechargeStatus,
            rechargedAt: (rechargeMethod === 'CHEETAH' || rechargeMethod === 'BM_TOKEN') ? new Date() : undefined,
          }
        })
        await tx.adAccount.update({
          where: { id: deposit.adAccountId },
          data: {
            totalDeposit: { increment: deposit.amount },
            balance: { increment: deposit.amount }
          }
        })
      })

      // VCC auto-recharge: if a card is linked to this ad account, recharge it for the same amount.
      // Pre-check + atomic claim inside the helper prevent double-charge race condition.
      const preAdm = await prisma.accountDeposit.findUnique({
        where: { id }, select: { cardPaymentStatus: true }
      })
      // Only block re-firing if the card was already DONE.
      // The helper's atomic claim handles all other concurrency cases.
      if (preAdm?.cardPaymentStatus !== 'DONE') {
        autoRechargeAssignedVccCard({
          adAccountId: deposit.adAccountId,
          amount: deposit.amount,
          reason: 'ADMIN_APPROVE',
          depositId: id,
        }).catch(() => { /* helper already swallows errors */ })
      }
    } else {
      // Non-Cheetah FB: stay PENDING, set approvedAt to signal admin approved
      // Balance NOT incremented — will be incremented when recharge confirmed
      await prisma.accountDeposit.update({
        where: { id },
        data: {
          // status stays 'PENDING'
          approvedAt: new Date(),
          rechargeMethod,
          rechargeStatus,
        }
      })
    }
    // (Removed: redundant cardPaymentStatus='PENDING' write — was racing with the
    // VCC helper's atomic claim and causing it to bail without charging the card.)

    // Send notification/email
    if (depositStatus === 'APPROVED') {
      const updatedAccount = await prisma.adAccount.findUnique({
        where: { id: deposit.adAccountId },
        select: { balance: true }
      })
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

      await createNotification({
        userId: deposit.adAccount.userId,
        type: 'DEPOSIT_APPROVED',
        title: 'Ad Account Deposit Approved',
        message: `Your deposit of $${Number(deposit.amount).toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} has been approved.`,
        link: '/facebook'
      })
    } else {
      // Non-Cheetah: notify user deposit is being processed
      await createNotification({
        userId: deposit.adAccount.userId,
        type: 'DEPOSIT_APPROVED',
        title: 'Deposit Processing',
        message: `Your deposit of $${Number(deposit.amount).toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} is being processed.`,
        link: '/facebook'
      })
    }

    return c.json({
      message: depositStatus === 'APPROVED' ? 'Account deposit approved' : 'Deposit accepted, pending recharge confirmation',
      cheetahRecharge: cheetahRechargeResult?.code === 0 ? 'success' : (isCheetahAccount ? 'skipped' : 'not-cheetah'),
      cheetahError: cheetahError,
      isCheetahAccount: deposit.adAccount.platform === 'FACEBOOK' ? isCheetahAccount : null,
      rechargeStatus,
      rechargeMethod,
      depositStatus,
    })
  } catch (error) {
    console.error('Approve account deposit error:', error)
    return c.json({ error: 'Failed to approve deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/retry-recharge - Retry recharge via BM token
// Runs the BM-token recharge inline (Cheetah accounts go through their own admin-approve path).
// On success → marks deposit APPROVED + COMPLETED + increments balance + triggers VCC auto-recharge.
// On failure → leaves deposit PENDING with the error captured.
//
// Accepts either the Mongo deposit id OR the user-facing applyId (e.g. FB202604277681551).
accounts.post('/deposits/:id/retry-recharge', requireAdmin, async (c) => {
  try {
    const { id: rawId } = c.req.param()
    // Resolve by either Mongo id or applyId
    let deposit = await prisma.accountDeposit.findUnique({
      where: { id: rawId },
      include: { adAccount: { select: { id: true, accountId: true, sourceBmId: true, accountName: true, userId: true } } },
    }).catch(() => null)
    if (!deposit) {
      deposit = await prisma.accountDeposit.findFirst({
        where: { applyId: rawId },
        include: { adAccount: { select: { id: true, accountId: true, sourceBmId: true, accountName: true, userId: true } } },
      })
    }
    if (!deposit) return c.json({ error: 'Deposit not found' }, 404)
    if (deposit.status === 'APPROVED' && deposit.rechargeStatus === 'COMPLETED') {
      return c.json({ error: 'Already fully approved + recharged' }, 400)
    }
    if (deposit.rechargeStatus === 'IN_PROGRESS' || deposit.rechargeStatus === 'VERIFYING') {
      return c.json({ error: `Already ${deposit.rechargeStatus.toLowerCase()} — wait for it to settle` }, 400)
    }

    const amount = Number(deposit.amount)
    console.log(`[Recharge Retry] Deposit ${deposit.id} (${deposit.applyId || 'N/A'}) — running BM-token recharge for $${amount}`)

    const bmAttempt = await tryBmTokenRecharge({
      depositId: deposit.id,
      adAccountId: deposit.adAccount.accountId,
      sourceBmId: deposit.adAccount.sourceBmId,
      amount,
    })

    if (bmAttempt.used && bmAttempt.success) {
      await prisma.$transaction(async (tx) => {
        await tx.accountDeposit.update({
          where: { id: deposit!.id },
          data: {
            status: 'APPROVED',
            approvedAt: deposit!.approvedAt || new Date(),
            rechargeMethod: 'BM_TOKEN',
            rechargeStatus: 'COMPLETED',
            rechargedAt: new Date(),
            rechargedBy: 'bm-token-retry',
            rechargeError: null,
            previousSpendCap: bmAttempt.previousSpendCap,
            newSpendCap: bmAttempt.newSpendCap,
            // cardPaymentStatus is intentionally NOT touched — the helper owns it.
          },
        })
        // Only credit balance if it wasn't already credited (e.g. previous APPROVED with FAILED recharge)
        if (deposit!.status !== 'APPROVED') {
          await tx.adAccount.update({
            where: { id: deposit!.adAccount.id },
            data: {
              totalDeposit: { increment: amount },
              balance: { increment: amount },
            },
          })
        }
      })

      // Fire VCC auto-recharge (same hook as user-submit auto-approve).
      // The helper's atomic claim handles idempotency.
      autoRechargeAssignedVccCard({
        adAccountId: deposit.adAccount.id,
        amount,
        reason: 'BM_TOKEN_RETRY',
        depositId: deposit.id,
      }).catch(() => {})

      return c.json({
        success: true,
        message: 'Recharge completed via BM token',
        previousSpendCap: bmAttempt.previousSpendCap,
        newSpendCap: bmAttempt.newSpendCap,
      })
    }

    if (bmAttempt.used && !bmAttempt.success) {
      await prisma.accountDeposit.update({
        where: { id: deposit.id },
        data: {
          rechargeStatus: 'FAILED',
          rechargeMethod: 'BM_TOKEN',
          rechargeError: bmAttempt.error.slice(0, 500),
          rechargeAttempts: { increment: 1 },
        },
      })
      return c.json({ success: false, error: bmAttempt.error }, 400)
    }

    // No BM token for this account
    return c.json({
      success: false,
      error: `No BM token configured for sourceBmId=${deposit.adAccount.sourceBmId || '(none)'} — add a BM token first`,
    }, 400)
  } catch (error: any) {
    console.error('Retry recharge error:', error)
    return c.json({ error: error.message || 'Failed to retry recharge' }, 500)
  }
})

// POST /accounts/deposits/:id/charge-card - Manually fire the VCC card auto-recharge.
// Useful for back-filling deposits that were approved before the helper bug fix
// (they sit at status=APPROVED + cardPaymentStatus=PENDING with no actual charge).
// Accepts either Mongo id or applyId.
accounts.post('/deposits/:id/charge-card', requireAdmin, async (c) => {
  try {
    const { id: rawId } = c.req.param()
    let dep = await prisma.accountDeposit.findUnique({ where: { id: rawId } }).catch(() => null)
    if (!dep) dep = await prisma.accountDeposit.findFirst({ where: { applyId: rawId } })
    if (!dep) return c.json({ error: 'Deposit not found' }, 404)
    if (dep.cardPaymentStatus === 'DONE') {
      return c.json({ error: 'Card payment already DONE' }, 400)
    }
    // Reset to NONE so the helper's atomic claim can take over
    if (dep.cardPaymentStatus !== 'NONE') {
      await prisma.accountDeposit.update({
        where: { id: dep.id },
        data: { cardPaymentStatus: 'NONE', vccRechargeError: null },
      })
    }
    const r = await autoRechargeAssignedVccCard({
      adAccountId: dep.adAccountId,
      amount: Number(dep.amount),
      reason: 'MANUAL_CHARGE_CARD',
      depositId: dep.id,
    })
    return c.json({ success: r.triggered && !r.error, ...r })
  } catch (error: any) {
    console.error('Charge card error:', error)
    return c.json({ error: error.message || 'Failed to charge card' }, 500)
  }
})

// POST /accounts/deposits/:id/retry-verification - Retry spend cap verification (for VERIFY_FAILED deposits)
accounts.post('/deposits/:id/retry-verification', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const existing = await prisma.accountDeposit.findUnique({ where: { id }, select: { rechargeStatus: true, rechargeError: true, applyId: true } })
    if (existing?.rechargeError) {
      console.log(`[Verify Retry] Deposit ${id} (${existing.applyId || 'N/A'}) — previous error: ${existing.rechargeError}`)
    }
    await prisma.accountDeposit.update({
      where: { id },
      data: {
        rechargeStatus: 'VERIFYING',
        verificationFailed: false,
        rechargeError: null,
      }
    })
    return c.json({ message: 'Verification queued for retry' })
  } catch (error) {
    console.error('Retry verification error:', error)
    return c.json({ error: 'Failed to retry verification' }, 500)
  }
})

// POST /accounts/deposits/:id/force-approve - Force approve (skip recharge, set APPROVED + increment balance)
accounts.post('/deposits/:id/force-approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const existing = await prisma.accountDeposit.findUnique({
      where: { id },
      select: { amount: true, adAccountId: true, status: true, rechargeError: true, applyId: true,
        adAccount: { select: { sourceBmId: true, platform: true } }
      }
    })
    if (!existing) return c.json({ error: 'Deposit not found' }, 404)

    if (existing.rechargeError) {
      console.log(`[Force Approve] Deposit ${id} (${existing.applyId || 'N/A'}) — previous error: ${existing.rechargeError}`)
    }

    const isNonCheetahFb = existing.adAccount?.platform === 'FACEBOOK' && existing.adAccount?.sourceBmId !== 'cheetah'

    await prisma.$transaction(async (tx) => {
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'APPROVED',
          rechargeStatus: 'COMPLETED',
          rechargeMethod: 'MANUAL',
          rechargedAt: new Date(),
          rechargedBy: 'admin-force',
          rechargeError: null,
          cardPaymentStatus: isNonCheetahFb ? 'PENDING' : 'NONE',
        }
      })
      // Only increment balance if not already APPROVED (prevent double-increment)
      if (existing.status !== 'APPROVED') {
        await tx.adAccount.update({
          where: { id: existing.adAccountId },
          data: {
            totalDeposit: { increment: existing.amount },
            balance: { increment: existing.amount }
          }
        })
      }
    })

    return c.json({ message: 'Deposit force approved, balance updated' })
  } catch (error) {
    console.error('Force approve error:', error)
    return c.json({ error: 'Failed to force approve' }, 500)
  }
})

// POST /accounts/deposits/:id/reject - Reject account deposit (NO refund)
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

    if (deposit.status === 'APPROVED') {
      return c.json({ error: 'Cannot reject an approved deposit' }, 400)
    }

    const depositAmount = Number(deposit.amount) || 0
    const commissionAmount = Number(deposit.commissionAmount) || 0

    // Reject — NO refund to wallet
    await prisma.accountDeposit.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        approvedAt: null,
        rechargeStatus: 'FAILED',
        rechargeError: 'Deposit rejected by admin',
      }
    })

    // Send rejection email to user
    const approvedDomainReject = deposit.adAccount.user.agent?.customDomains?.[0]
    const agentReject = deposit.adAccount.user.agent
    const agentLogoReject = approvedDomainReject?.emailLogo || approvedDomainReject?.brandLogo || agentReject?.emailLogo || agentReject?.brandLogo || null
    const agentBrandNameReject = deposit.adAccount.user.agent?.username || null
    const totalCost = depositAmount + commissionAmount
    const userEmailTemplate = getAccountRechargeRejectedTemplate({
      username: deposit.adAccount.user.username,
      applyId: deposit.applyId,
      amount: depositAmount,
      commission: commissionAmount,
      totalCost,
      platform: deposit.adAccount.platform,
      accountId: deposit.adAccount.accountId,
      accountName: deposit.adAccount.accountName || undefined,
      adminRemarks,
      agentLogo: agentLogoReject,
      agentBrandName: agentBrandNameReject
    })
    sendEmail({ to: deposit.adAccount.user.email, ...userEmailTemplate, senderName: deposit.adAccount.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(deposit.adAccount.user.agent) }).catch(console.error)

    await createNotification({
      userId: deposit.adAccount.userId,
      type: 'DEPOSIT_REJECTED',
      title: 'Ad Account Deposit Rejected',
      message: `Your deposit of $${depositAmount.toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} has been rejected.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
      link: '/facebook'
    })

    return c.json({ message: 'Account deposit rejected' })
  } catch (error) {
    console.error('Reject account deposit error:', error)
    return c.json({ error: 'Failed to reject deposit' }, 500)
  }
})

// POST /accounts/deposits/:id/reject-refund - Reject with wallet refund
accounts.post('/deposits/:id/reject-refund', requireAdmin, async (c) => {
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

    if (!deposit) return c.json({ error: 'Deposit not found' }, 404)
    if (deposit.status !== 'PENDING') return c.json({ error: `Deposit already ${deposit.status.toLowerCase()} — cannot reject-refund` }, 400)

    const depositAmount = Number(deposit.amount) || 0
    const commissionAmount = Number(deposit.commissionAmount) || 0
    const refundAmount = depositAmount + commissionAmount

    await prisma.$transaction(async (tx) => {
      // Reject deposit
      await tx.accountDeposit.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminRemarks: adminRemarks ? `[Refunded] ${adminRemarks}` : '[Refunded]',
          approvedAt: null,
          rechargeStatus: 'FAILED',
          rechargeError: 'Deposit rejected by admin (refunded)',
        }
      })

      // Refund to user wallet
      await tx.user.update({
        where: { id: deposit.adAccount.userId },
        data: { walletBalance: { increment: refundAmount } }
      })

      // Create wallet flow record
      const balanceBefore = Number(deposit.adAccount.user.walletBalance)
      await tx.walletFlow.create({
        data: {
          type: 'TRANSFER',
          amount: refundAmount,
          balanceBefore,
          balanceAfter: balanceBefore + refundAmount,
          referenceId: deposit.id,
          referenceType: 'account_deposit_refund',
          userId: deposit.adAccount.userId,
          description: `Deposit rejected with refund for ${deposit.adAccount.platform} account ${deposit.adAccount.accountId}${adminRemarks ? '. Reason: ' + adminRemarks : ''}`
        }
      })
    })

    // Send rejection email
    const approvedDomainReject = deposit.adAccount.user.agent?.customDomains?.[0]
    const agentReject = deposit.adAccount.user.agent
    const agentLogoReject = approvedDomainReject?.emailLogo || approvedDomainReject?.brandLogo || agentReject?.emailLogo || agentReject?.brandLogo || null
    const agentBrandNameReject = deposit.adAccount.user.agent?.username || null
    const userEmailTemplate = getAccountRechargeRejectedTemplate({
      username: deposit.adAccount.user.username,
      applyId: deposit.applyId,
      amount: depositAmount,
      commission: commissionAmount,
      totalCost: refundAmount,
      platform: deposit.adAccount.platform,
      accountId: deposit.adAccount.accountId,
      accountName: deposit.adAccount.accountName || undefined,
      adminRemarks: adminRemarks ? `${adminRemarks} (Amount refunded to wallet)` : 'Amount refunded to wallet',
      agentLogo: agentLogoReject,
      agentBrandName: agentBrandNameReject
    })
    sendEmail({ to: deposit.adAccount.user.email, ...userEmailTemplate, senderName: deposit.adAccount.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(deposit.adAccount.user.agent) }).catch(console.error)

    await createNotification({
      userId: deposit.adAccount.userId,
      type: 'DEPOSIT_REJECTED',
      title: 'Deposit Rejected — Refunded',
      message: `Your deposit of $${depositAmount.toLocaleString()} for account ${deposit.adAccount.accountName || deposit.adAccount.accountId} has been rejected and $${refundAmount.toLocaleString()} refunded to your wallet.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
      link: '/facebook'
    })

    return c.json({ message: 'Deposit rejected with refund' })
  } catch (error) {
    console.error('Reject with refund error:', error)
    return c.json({ error: 'Failed to reject deposit' }, 500)
  }
})

// PATCH /accounts/:id - Update account details
accounts.patch('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    // Whitelist allowed fields to prevent arbitrary field injection
    const allowedFields = ['accountId', 'accountName', 'platform', 'status', 'bmId', 'sourceBmId', 'timezone', 'currency', 'dailyLimit', 'notes', 'adminRemarks', 'threshold', 'rechargeAmount', 'autoRecharge', 'extensionProfileId', 'cheetahAccountId', 'topupMode', 'fundingSources']
    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        data[key] = typeof body[key] === 'string' ? body[key].trim() : body[key]
      }
    }

    // Handle 'cheetah' as special extensionProfileId value
    if (data.extensionProfileId === 'cheetah') {
      data.extensionProfileId = null
      data.sourceBmId = 'cheetah'
    } else if ('extensionProfileId' in data && data.extensionProfileId) {
      // If switching away from cheetah to a real profile, clear sourceBmId
      data.sourceBmId = null
    }

    // If extensionProfileId is changing, sync managedAdAccountIds
    if ('extensionProfileId' in data) {
      const existing = await prisma.adAccount.findUnique({
        where: { id },
        select: { accountId: true, extensionProfileId: true }
      })

      if (existing && existing.accountId) {
        const oldProfileId = existing.extensionProfileId
        const newProfileId = data.extensionProfileId || null

        // Remove accountId from old profile's managedAdAccountIds
        if (oldProfileId && oldProfileId !== newProfileId) {
          const oldProfile = await prisma.extensionProfile.findUnique({
            where: { id: oldProfileId },
            select: { managedAdAccountIds: true }
          })
          if (oldProfile) {
            await prisma.extensionProfile.update({
              where: { id: oldProfileId },
              data: {
                managedAdAccountIds: oldProfile.managedAdAccountIds.filter(
                  (aid: string) => aid !== existing.accountId
                )
              }
            })
          }
        }

        // Add accountId to new profile's managedAdAccountIds
        if (newProfileId && newProfileId !== oldProfileId) {
          const newProfile = await prisma.extensionProfile.findUnique({
            where: { id: newProfileId },
            select: { managedAdAccountIds: true }
          })
          if (newProfile && !newProfile.managedAdAccountIds.includes(existing.accountId)) {
            await prisma.extensionProfile.update({
              where: { id: newProfileId },
              data: {
                managedAdAccountIds: [...newProfile.managedAdAccountIds, existing.accountId]
              }
            })
          }
        }
      }
    }

    const account = await prisma.adAccount.update({
      where: { id },
      data
    })

    return c.json({ message: 'Account updated', account })
  } catch (error) {
    console.error('Update account error:', error)
    return c.json({ error: 'Failed to update account' }, 500)
  }
})

// DELETE /accounts/:id - Delete account permanently
accounts.delete('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    await prisma.adAccount.delete({ where: { id } })
    return c.json({ message: 'Account deleted' })
  } catch (error) {
    console.error('Delete account error:', error)
    return c.json({ error: 'Failed to delete account' }, 500)
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

    // Validate refund amount does not exceed account balance
    if (amount > Number(account.balance)) {
      return c.json({ message: `Refund amount ($${amount}) exceeds account balance ($${Number(account.balance).toFixed(2)})` }, 400)
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

    // Remove all BM partner access from the ad account via FB Graph API (fire-and-forget)
    ;(async () => {
      try {
        const actId = refund.adAccount.accountId

        // Cheetah accounts — use Cheetah API to unbind all BM partners
        if (refund.adAccount.sourceBmId === 'cheetah') {
          await cheetahApi.loadConfig()
          const bindingsRes = await cheetahApi.getBMBindings(actId)
          if (bindingsRes.code !== 0) {
            console.warn(`[Refund] Cheetah getBMBindings failed for act_${actId}:`, bindingsRes.msg)
            await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: false } })
            return
          }
          const businessIds: string[] = bindingsRes.data?.business_id || []
          if (businessIds.length === 0) {
            console.log(`[Refund] No BM partners on Cheetah act_${actId}`)
            await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: true } })
            return
          }
          console.log(`[Refund] Cheetah unbinding ${businessIds.length} BM(s) from act_${actId}: ${businessIds.join(', ')}`)
          for (const bmId of businessIds) {
            const res = await cheetahApi.bindAccountToBM(actId, bmId, 0) // type 0 = unbind
            if (res.code === 0) {
              console.log(`[Refund] Cheetah unbound BM ${bmId} from act_${actId}`)
            } else {
              console.warn(`[Refund] Cheetah unbind failed BM ${bmId}:`, res.msg)
            }
          }
          await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: true } })
          return
        }

        // Find profile by extensionProfileId first, fallback to managedAdAccountIds
        let profile = refund.adAccount.extensionProfileId
          ? await prisma.facebookAutomationProfile.findUnique({
              where: { id: refund.adAccount.extensionProfileId },
              select: { fbAccessToken: true, label: true }
            }).catch(() => null)
          : null

        if (!profile?.fbAccessToken) {
          profile = await prisma.facebookAutomationProfile.findFirst({
            where: { managedAdAccountIds: { has: actId } },
            select: { fbAccessToken: true, label: true }
          }).catch(() => null)
        }

        const fbToken = profile?.fbAccessToken
        if (!fbToken) {
          // No token — mark refund as pending BM unbind so extension retries when token available
          await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: false } })
          console.log(`[Refund] No FB token for act_${actId} — queued for extension BM unbind`)
          return
        }

        const fbGraph = 'https://graph.facebook.com/v21.0'
        const agenciesRes = await fetch(`${fbGraph}/act_${actId}/agencies?fields=id,name&access_token=${encodeURIComponent(fbToken)}`)
        const agenciesData: any = await agenciesRes.json()

        if (agenciesData.error) {
          console.warn(`[Refund] FB agencies fetch error for act_${actId}:`, agenciesData.error.message)
          await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: false } })
          return
        }

        const partners: { id: string; name: string }[] = agenciesData?.data || []
        if (partners.length === 0) {
          console.log(`[Refund] No BM partners on act_${actId}`)
          await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: true } })
          return
        }

        console.log(`[Refund] Removing ${partners.length} BM partner(s) from act_${actId}: ${partners.map(p => p.name || p.id).join(', ')}`)
        for (const partner of partners) {
          const res = await fetch(`${fbGraph}/act_${actId}/agencies`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `business=${partner.id}&access_token=${encodeURIComponent(fbToken)}`
          })
          const result: any = await res.json()
          if (result.success) {
            console.log(`[Refund] Removed BM ${partner.name || partner.id} from act_${actId}`)
          } else {
            console.warn(`[Refund] Failed to remove BM ${partner.id} from act_${actId}:`, result.error?.message)
          }
        }
        await prisma.accountRefund.update({ where: { id: refund.id }, data: { bmUnbindDone: true } })
      } catch (err: any) {
        console.error(`[Refund] BM unbind error for act_${refund.adAccount.accountId}:`, err.message)
      }
    })()

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

    await createNotification({
      userId: refund.adAccount.userId,
      type: 'REFUND_PROCESSED',
      title: 'Refund Approved',
      message: `Your refund of $${Number(refund.amount).toLocaleString()} for account ${refund.adAccount.accountName || refund.adAccount.accountId} has been approved.`,
      link: '/facebook'
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

    await createNotification({
      userId: refund.adAccount.userId,
      type: 'REFUND_PROCESSED',
      title: 'Refund Rejected',
      message: `Your refund of $${Number(refund.amount).toLocaleString()} for account ${refund.adAccount.accountName || refund.adAccount.accountId} has been rejected.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
      link: '/facebook'
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

    await createNotification({
      userId: transfer.userId,
      type: 'SYSTEM',
      title: 'Transfer Approved',
      message: `Your balance transfer of $${Number(transfer.amount).toLocaleString()} has been approved.`,
      link: '/facebook'
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

    await createNotification({
      userId: transfer.userId,
      type: 'SYSTEM',
      title: 'Transfer Rejected',
      message: `Your balance transfer of $${Number(transfer.amount).toLocaleString()} has been rejected.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
      link: '/facebook'
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

    const accounts = await prisma.adAccount.findMany({
      where,
      select: { accountId: true, sourceBmId: true, balance: true, totalDeposit: true, totalSpend: true, currency: true }
    })

    if (accounts.length === 0) {
      return c.json({ balances: {} })
    }

    const balances: Record<string, any> = {}

    const cheetahAccounts = accounts.filter(a => a.sourceBmId === 'cheetah')
    const nonCheetahAccounts = accounts.filter(a => a.sourceBmId !== 'cheetah')

    // Default placeholder for non-Cheetah; overwritten below if a BM token can fetch live data
    for (const acc of nonCheetahAccounts) {
      balances[acc.accountId] = { isCheetah: false }
    }

    // ─── In-memory balance cache (30s TTL) ────────────────────────────
    // Repeated requests within 30s for the same account are served from
    // memory — instant. Cuts page load from ~3s to <100ms on second visit.
    const now = Date.now()
    const TTL = 30_000
    const fromCache: string[] = []
    for (const acc of accounts) {
      const c = (globalThis as any).__balCache?.[acc.accountId]
      if (c && (now - c.t) < TTL) {
        balances[acc.accountId] = c.v
        fromCache.push(acc.accountId)
      }
    }
    const missing = accounts.filter(a => !fromCache.includes(a.accountId))
    const cheetahMissing = missing.filter(a => a.sourceBmId === 'cheetah')
    const bmTokenMissing = missing.filter(a => a.sourceBmId !== 'cheetah')

    // Generic timeout helper
    const withTimeoutMs = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([p, new Promise<null>(resolve => setTimeout(() => resolve(null), ms))])

    // ─── BM-token branch (parallel with Cheetah) ──────────────────────
    const bmTokenJob = (async () => {
      if (bmTokenMissing.length === 0) return
      const bmIdsNeeded = Array.from(new Set(bmTokenMissing.map(a => a.sourceBmId).filter(Boolean) as string[]))
      if (bmIdsNeeded.length === 0) return
      const tokens = await prisma.bmToken.findMany({
        where: { bmId: { in: bmIdsNeeded }, status: 'ACTIVE' },
        select: { bmId: true, encryptedToken: true },
      })
      const tokenByBm: Record<string, string> = {}
      for (const t of tokens) {
        try { tokenByBm[t.bmId] = decryptToken(t.encryptedToken) } catch {}
      }
      const FB = 'https://graph.facebook.com/v21.0'
      await Promise.allSettled(bmTokenMissing.map(async (acc) => {
        if (!acc.sourceBmId) return
        const tok = tokenByBm[acc.sourceBmId]
        if (!tok) return
        try {
          const url = `${FB}/act_${acc.accountId}?fields=spend_cap,amount_spent,balance,currency,account_status&access_token=${encodeURIComponent(tok)}`
          // 2s timeout — most calls return in <500ms; trim the slow tail.
          const resp = await withTimeoutMs(fetch(url).then(r => r.json()), 2000)
          if (!resp || resp.error) return
          const spendCap = resp.spend_cap ? parseFloat(resp.spend_cap) / 100 : 0
          const amountSpent = resp.amount_spent ? parseFloat(resp.amount_spent) / 100 : 0
          const fbBalance = resp.balance ? parseFloat(resp.balance) / 100 : 0
          const remainingBalance = spendCap > 0 ? Math.max(spendCap - amountSpent, 0) : fbBalance
          const data = {
            spendCap, amountSpent,
            balance: fbBalance,
            remainingBalance,
            currency: resp.currency || acc.currency || 'USD',
            status: resp.account_status,
            statusText: resp.account_status === 1 ? 'Active' : resp.account_status === 2 ? 'Disabled' : 'Other',
            isCheetah: false,
            isBmToken: true,
          }
          balances[acc.accountId] = data
          ;(globalThis as any).__balCache = (globalThis as any).__balCache || {}
          ;(globalThis as any).__balCache[acc.accountId] = { t: Date.now(), v: data }
        } catch { /* keep placeholder */ }
      }))
    })()

    // ─── Cheetah branch (parallel with BM-token) ──────────────────────
    const cheetahJob = (async () => {
      if (cheetahMissing.length === 0) return
      const configLoaded = await loadCheetahConfig()
      if (!configLoaded) return
      const results = await Promise.allSettled(
        cheetahMissing.map(async (account) => {
        try {
          const result = await withTimeoutMs(cheetahApi.getAccount(account.accountId), 2500)
          if (result === null) {
            // Timeout — return DB-cached balance as fallback (no cache write)
            return {
              accountId: account.accountId,
              data: {
                spendCap: 0,
                amountSpent: Number(account.totalSpend) || 0,
                balance: Number(account.balance) || 0,
                remainingBalance: Number(account.balance) || 0,
                currency: account.currency || 'USD',
                isCheetah: true,
                cached: true
              }
            }
          }
          if (result.code === 0 && result.data && result.data.length > 0) {
            const cheetahAccount = result.data[0]
            const spendCap = parseFloat(cheetahAccount.spend_cap) || 0
            const amountSpent = parseFloat(cheetahAccount.amount_spent) || 0
            return {
              accountId: account.accountId,
              data: {
                spendCap,
                amountSpent,
                balance: parseFloat(cheetahAccount.balance) || 0,
                remainingBalance: spendCap - amountSpent,
                currency: cheetahAccount.currency,
                status: cheetahAccount.account_status,
                statusText: cheetahAccount.account_status_text,
                isCheetah: true
              }
            }
          }
          return { accountId: account.accountId, data: { isCheetah: false } }
        } catch (err) {
          return { accountId: account.accountId, data: { isCheetah: false, error: true } }
        }
      })
      )
      ;(globalThis as any).__balCache = (globalThis as any).__balCache || {}
      for (const result of results) {
        if (result.status === 'fulfilled') {
          balances[result.value.accountId] = result.value.data
          // Cache only fresh (non-fallback) entries
          if (!result.value.data.cached) {
            ;(globalThis as any).__balCache[result.value.accountId] = { t: Date.now(), v: result.value.data }
          }
        }
      }
    })()

    // Run BOTH branches in parallel — total wait = max(slowest BM, slowest Cheetah)
    await Promise.all([bmTokenJob, cheetahJob])

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

    // Find account by database ID or by Facebook accountId
    let account = null
    try {
      account = await prisma.adAccount.findUnique({
        where: { id }
      })
    } catch {
      // id is not a valid ObjectId - try as accountId instead
    }
    if (!account) {
      account = await prisma.adAccount.findFirst({
        where: { accountId: id }
      })
    }

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
      // Conversion action keywords — only real business outcomes, not engagement metrics
      // We pick the one with the HIGHEST value among these (at account level we don't know campaign objective)
      const CONVERSION_KEYWORDS = [
        'purchase',
        'lead',
        'complete_registration',
        'messaging_conversation_started',
        'messaging_first_reply',
        'submit_application',
        'subscribe',
        'start_trial',
      ]

      const getResultFromActions = (actions: any[]): { results: number, resultType: string } => {
        if (!actions || !Array.isArray(actions)) return { results: 0, resultType: '' }

        // Find all conversion actions and pick the one with the highest value
        let bestResult = 0
        let bestType = ''

        for (const keyword of CONVERSION_KEYWORDS) {
          // Use exact match on action_type to avoid 'purchase' matching 'web_in_store_purchase' etc.
          const found = actions.find((a: any) => a.action_type === keyword)
          if (found) {
            const val = parseInt(found.value) || 0
            if (val > bestResult) {
              bestResult = val
              bestType = keyword
            }
          }
        }

        // If no conversion found, fallback to link_click
        if (bestResult === 0) {
          const linkClick = actions.find((a: any) => a.action_type === 'link_click')
          if (linkClick) {
            bestResult = parseInt(linkClick.value) || 0
            bestType = 'link_click'
          }
        }

        return { results: bestResult, resultType: bestType }
      }

      // Normalize: Cheetah may return a single object or an array
      const rawData = Array.isArray(result.data) ? result.data : [result.data]

      // Process each day and compute totals on server
      let totalSpent = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0

      const processedData = rawData.map((day: any) => {
        const spent = parseFloat(day.spend) || 0
        const impressions = parseInt(day.impressions) || 0
        const clicks = parseInt(day.clicks) || 0
        const { results, resultType } = Array.isArray(day.actions)
          ? getResultFromActions(day.actions)
          : { results: parseInt(day.actions) || 0, resultType: '' }

        totalSpent += spent
        totalImpressions += impressions
        totalClicks += clicks
        totalResults += results

        return {
          date_start: day.date_start || day.date || '',
          spend: spent,
          impressions,
          clicks,
          results,
          resultType,
          cpc: clicks > 0 ? parseFloat((spent / clicks).toFixed(4)) : 0,
          ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
          cpm: impressions > 0 ? parseFloat(((spent / impressions) * 1000).toFixed(2)) : 0,
          cpr: results > 0 ? parseFloat((spent / results).toFixed(2)) : 0,
        }
      })

      // Return insights + pre-computed totals so frontend doesn't need to calculate
      const totals = {
        spent: parseFloat(totalSpent.toFixed(2)),
        impressions: totalImpressions,
        clicks: totalClicks,
        results: totalResults,
        cpc: totalClicks > 0 ? parseFloat((totalSpent / totalClicks).toFixed(4)) : 0,
        ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
        cpm: totalImpressions > 0 ? parseFloat(((totalSpent / totalImpressions) * 1000).toFixed(2)) : 0,
        cpr: totalResults > 0 ? parseFloat((totalSpent / totalResults).toFixed(2)) : 0,
      }

      return c.json({ insights: processedData, totals, startDate: start, endDate: end })
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

    // Count results — pick highest-value conversion action (same logic as daily route)
    const MONTHLY_CONVERSION_KEYWORDS = [
      'purchase', 'lead', 'complete_registration',
      'messaging_conversation_started', 'messaging_first_reply',
      'submit_application', 'subscribe', 'start_trial'
    ]

    const countAllResults = (actions: any[]): number => {
      if (!actions || !Array.isArray(actions)) return 0
      let best = 0
      for (const keyword of MONTHLY_CONVERSION_KEYWORDS) {
        const found = actions.find((a: any) => a.action_type === keyword)
        if (found) {
          const val = parseInt(found.value) || 0
          if (val > best) best = val
        }
      }
      // Fallback to link_click
      if (best === 0) {
        const lc = actions.find((a: any) => a.action_type === 'link_click')
        if (lc) best = parseInt(lc.value) || 0
      }
      return best
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

        if (result.code === 0 && result.data) {
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
        } else {
          // Fallback to getDaySpend if insights API fails
          const spendResult = await cheetahApi.getDaySpend(accountId, monthInfo.startDate, monthInfo.endDate)
          if (spendResult.code === 0 && spendResult.data) {
            if (Array.isArray(spendResult.data)) {
              spendResult.data.forEach((day: any) => {
                spent += parseFloat(day.spend) || 0
              })
            }
          } else {
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
