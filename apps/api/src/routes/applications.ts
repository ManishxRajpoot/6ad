import { Hono } from 'hono'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { randomInt } from 'crypto'
import { verifyToken, requireUser, requireAdmin } from '../middleware/auth.js'
import { processAdAccountApprovalReward } from '../services/referral-rewards.js'
import { createNotification } from './notifications.js'
import { prisma } from '../lib/prisma.js'
const applications = new Hono()

applications.use('*', verifyToken)

// Generate Apply ID
// NEW license: AD{YYYYMMDD}{7-digit random}
// OLD license: AD{YYYYDDMM}{7-digit random}
const PLATFORM_PREFIX: Record<string, string> = {
  FACEBOOK: 'FB',
  GOOGLE: 'GG',
  TIKTOK: 'TT',
  SNAPCHAT: 'SC',
  BING: 'BG',
}

function generateApplyId(licenseType: 'NEW' | 'OLD', platform?: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = randomInt(1000000, 10000000)
  const prefix = (platform && PLATFORM_PREFIX[platform]) || 'AD'

  if (licenseType === 'NEW') {
    return `${prefix}${year}${month}${day}${random}`
  } else {
    return `${prefix}${year}${day}${month}${random}`
  }
}

// Validation schemas
const createApplicationSchema = z.object({
  platform: z.enum(['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING']),
  licenseType: z.enum(['NEW', 'OLD']),
  licenseNo: z.string().optional(),
  pageUrls: z.string().optional(),
  isApp: z.string().optional(),
  shopifyShop: z.boolean().default(false),
  accountDetails: z.array(z.object({
    name: z.string().min(1),
  })).min(1).max(5),
  depositAmount: z.number().min(0),
  remarks: z.string().optional(),
  useCoupon: z.boolean().optional().default(false),
})

const updateApplicationSchema = z.object({
  licenseType: z.enum(['NEW', 'OLD']).optional(),
  licenseNo: z.string().optional(),
  pageUrls: z.string().optional(),
  isApp: z.string().optional(),
  shopifyShop: z.boolean().optional(),
  accountDetails: z.array(z.object({
    name: z.string().min(1),
    accountId: z.string().optional(),
  })).optional(),
  depositAmount: z.number().min(0).optional(),
  remarks: z.string().optional(),
  adminRemarks: z.string().optional(),
})

// ============= USER ROUTES =============

// POST /applications - Submit new ad account application (User)
applications.post('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const data = createApplicationSchema.parse(body)

    // Get user to calculate fees
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletBalance: true,
        couponBalance: true,
        fbFee: true,
        fbCommission: true,
        googleFee: true,
        googleCommission: true,
        tiktokFee: true,
        tiktokCommission: true,
        snapchatFee: true,
        snapchatCommission: true,
        bingFee: true,
        bingCommission: true,
        openingFee: true,
      }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check if using coupon and has available coupons
    const useCoupon = data.useCoupon && user.couponBalance > 0

    // Get platform-specific commission rate AND opening fee (convert Decimal to number for calculations)
    let platformCommission = 0
    let platformOpeningFee = 0
    const DEFAULT_OPENING_FEE = 30

    switch (data.platform) {
      case 'FACEBOOK':
        platformCommission = Number(user.fbCommission) || 0
        platformOpeningFee = Number(user.fbFee) || DEFAULT_OPENING_FEE
        break
      case 'GOOGLE':
        platformCommission = Number(user.googleCommission) || 0
        platformOpeningFee = Number(user.googleFee) || DEFAULT_OPENING_FEE
        break
      case 'TIKTOK':
        platformCommission = Number(user.tiktokCommission) || 0
        platformOpeningFee = Number(user.tiktokFee) || DEFAULT_OPENING_FEE
        break
      case 'SNAPCHAT':
        platformCommission = Number(user.snapchatCommission) || 0
        platformOpeningFee = Number(user.snapchatFee) || DEFAULT_OPENING_FEE
        break
      case 'BING':
        platformCommission = Number(user.bingCommission) || 0
        platformOpeningFee = Number(user.bingFee) || DEFAULT_OPENING_FEE
        break
    }

    const adAccountQty = data.accountDetails.length
    const depositAmount = Number(data.depositAmount)
    // Use platform-specific opening fee (fbFee, googleFee, etc.)
    const openingFeePerAccount = platformOpeningFee
    const openingFee = openingFeePerAccount * adAccountQty
    const commissionAmount = (depositAmount * platformCommission) / 100

    // If using coupon, only opening fee is waived - deposit + commission still charged
    const totalCost = useCoupon
      ? depositAmount + commissionAmount
      : depositAmount + openingFee + commissionAmount

    // Check if user has enough balance
    if (Number(user.walletBalance) < totalCost) {
      return c.json({
        error: 'Insufficient balance',
        required: totalCost.toString(),
        available: user.walletBalance.toString()
      }, 400)
    }

    // Verify coupon if trying to use one
    if (data.useCoupon && user.couponBalance <= 0) {
      return c.json({ error: 'No coupons available' }, 400)
    }

    // Generate unique Apply ID with platform prefix (FB, GG, TT, SC, BG)
    let applyId = generateApplyId(data.licenseType, data.platform)
    let attempts = 0
    while (attempts < 10) {
      const existing = await prisma.adAccountApplication.findUnique({ where: { applyId } })
      if (!existing) break
      applyId = generateApplyId(data.licenseType, data.platform)
      attempts++
    }

    // Create application and deduct from wallet/coupon in a transaction
    const application = await prisma.$transaction(async (tx) => {
      // Get current balance and coupon count
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true, couponBalance: true }
      })

      if (!currentUser) {
        throw new Error('User not found')
      }

      // Check balance
      if (Number(currentUser.walletBalance) < totalCost) {
        throw new Error('Insufficient balance')
      }

      if (useCoupon) {
        // Verify user still has coupons
        if (currentUser.couponBalance <= 0) {
          throw new Error('No coupons available')
        }

        // Deduct 1 coupon and deduct totalCost from wallet
        await tx.user.update({
          where: { id: userId },
          data: {
            couponBalance: { decrement: 1 },
            walletBalance: { decrement: totalCost }
          }
        })

        // Create wallet flow record (deposit + commission charged, opening fee waived)
        await tx.walletFlow.create({
          data: {
            type: 'WITHDRAWAL',
            amount: totalCost,
            balanceBefore: Number(currentUser.walletBalance),
            balanceAfter: Number(currentUser.walletBalance) - totalCost,
            referenceType: 'ad_account_apply_coupon',
            userId,
            description: `Ad account application (Opening Fee Waived - Coupon used) - ${data.platform} (${adAccountQty} account${adAccountQty > 1 ? 's' : ''})`
          }
        })
      } else {
        // Regular payment flow - deduct from wallet
        await tx.user.update({
          where: { id: userId },
          data: {
            walletBalance: { decrement: totalCost }
          }
        })

        // Create wallet flow record
        await tx.walletFlow.create({
          data: {
            type: 'WITHDRAWAL',
            amount: totalCost,
            balanceBefore: Number(currentUser.walletBalance),
            balanceAfter: Number(currentUser.walletBalance) - totalCost,
            referenceType: 'ad_account_apply',
            userId,
            description: `Ad account application - ${data.platform} (${adAccountQty} account${adAccountQty > 1 ? 's' : ''})`
          }
        })
      }

      // Create application
      // When using coupon: opening fee is 0, but deposit + commission are still charged
      return tx.adAccountApplication.create({
        data: {
          applyId,
          platform: data.platform,
          licenseType: data.licenseType,
          licenseNo: data.licenseNo,
          pageUrls: data.pageUrls,
          isApp: data.isApp,
          shopifyShop: data.shopifyShop,
          accountDetails: JSON.stringify(data.accountDetails.map(a => ({ name: a.name, accountId: '' }))),
          adAccountQty,
          depositAmount,
          openingFee: useCoupon ? 0 : openingFee,
          platformFee: commissionAmount,
          totalCost,
          userId,
          remarks: useCoupon ? `${data.remarks || ''} [Opening Fee Waived - Coupon Used]`.trim() : data.remarks,
        },
        include: {
          user: {
            select: { id: true, username: true, email: true }
          }
        }
      })
    })

    return c.json({
      message: 'Application submitted successfully',
      application,
      // Debug info - remove after testing
      debug: {
        platform: data.platform,
        platformOpeningFee,
        openingFeePerAccount,
        adAccountQty,
        depositAmount,
        platformCommission,
        openingFee,
        commissionAmount,
        useCoupon,
        totalCost,
        walletDeducted: totalCost
      }
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create application error:', error)
    return c.json({ error: 'Failed to submit application' }, 500)
  }
})

// GET /applications - Get user's applications
applications.get('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { platform, status, page = '1', limit = '5000' } = c.req.query()

    const where: any = {}

    // Role-based filtering
    if (userRole === 'USER') {
      where.userId = userId
    } else if (userRole === 'AGENT') {
      // Agents see applications from their users
      where.user = { agentId: userId }
    }
    // Admins see all

    if (platform) where.platform = platform.toUpperCase()
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [applicationsList, total] = await Promise.all([
      prisma.adAccountApplication.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true, uniqueId: true, realName: true }
          },
          adAccounts: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adAccountApplication.count({ where })
    ])

    return c.json({
      applications: applicationsList,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get applications error:', error)
    return c.json({ error: 'Failed to get applications' }, 500)
  }
})

// ============= ADMIN ROUTES =============

// GET /applications/admin - Get all applications (Admin)
applications.get('/admin', requireAdmin, async (c) => {
  try {
    const { platform, status, page = '1', limit = '5000', search } = c.req.query()

    const where: any = {}

    if (platform) where.platform = platform.toUpperCase()
    if (status) where.status = status.toUpperCase()
    if (search) {
      where.OR = [
        { applyId: { contains: search, mode: 'insensitive' } },
        { licenseNo: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [applicationsList, total, stats] = await Promise.all([
      prisma.adAccountApplication.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, email: true, uniqueId: true }
          },
          adAccounts: true
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.adAccountApplication.count({ where }),
      // Get stats for this platform
      prisma.adAccountApplication.groupBy({
        by: ['status'],
        where: platform ? { platform: platform.toUpperCase() as any } : {},
        _count: true,
        _sum: { totalCost: true }
      })
    ])

    // Calculate stats
    const statsMap = {
      totalBalance: 0,
      totalApproved: 0,
      totalPending: 0,
      totalRejected: 0
    }

    stats.forEach(s => {
      if (s.status === 'APPROVED') {
        statsMap.totalApproved = s._count
        statsMap.totalBalance = statsMap.totalBalance + Number(s._sum.totalCost || 0)
      } else if (s.status === 'PENDING') {
        statsMap.totalPending = s._count
      } else if (s.status === 'REJECTED') {
        statsMap.totalRejected = s._count
      }
    })

    return c.json({
      applications: applicationsList,
      stats: statsMap,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get admin applications error:', error)
    return c.json({ error: 'Failed to get applications' }, 500)
  }
})

// GET /applications/admin/stats - Get application stats (Admin)
applications.get('/admin/stats', requireAdmin, async (c) => {
  try {
    const { platform } = c.req.query()

    const where: any = {}
    if (platform) where.platform = platform.toUpperCase()

    const [total, pending, approved, rejected, totalBalance] = await Promise.all([
      prisma.adAccountApplication.count({ where }),
      prisma.adAccountApplication.count({ where: { ...where, status: 'PENDING' } }),
      prisma.adAccountApplication.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.adAccountApplication.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.adAccountApplication.aggregate({
        where: { ...where, status: 'APPROVED' },
        _sum: { totalCost: true }
      })
    ])

    return c.json({
      total,
      pending,
      approved,
      rejected,
      totalBalance: totalBalance._sum.totalCost || 0
    })
  } catch (error) {
    console.error('Get application stats error:', error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

// GET /applications/:id - Get single application
applications.get('/:id', requireUser, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    const application = await prisma.adAccountApplication.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, username: true, email: true, uniqueId: true }
        },
        adAccounts: true
      }
    })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    // Users can only view their own applications
    if (userRole === 'USER' && application.userId !== userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    return c.json({ application })
  } catch (error) {
    console.error('Get application error:', error)
    return c.json({ error: 'Failed to get application' }, 500)
  }
})

// PUT /applications/:id - Update application (Admin)
applications.put('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const data = updateApplicationSchema.parse(body)

    const application = await prisma.adAccountApplication.findUnique({ where: { id } })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    const updateData: any = {}
    if (data.licenseType) updateData.licenseType = data.licenseType
    if (data.licenseNo !== undefined) updateData.licenseNo = data.licenseNo
    if (data.pageUrls !== undefined) updateData.pageUrls = data.pageUrls
    if (data.isApp !== undefined) updateData.isApp = data.isApp
    if (data.shopifyShop !== undefined) updateData.shopifyShop = data.shopifyShop
    if (data.accountDetails) updateData.accountDetails = JSON.stringify(data.accountDetails)
    if (data.remarks !== undefined) updateData.remarks = data.remarks
    if (data.adminRemarks !== undefined) updateData.adminRemarks = data.adminRemarks

    const updated = await prisma.adAccountApplication.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    return c.json({ message: 'Application updated', application: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Update application error:', error)
    return c.json({ error: 'Failed to update application' }, 500)
  }
})

// POST /applications/:id/approve - Approve application and assign account IDs (Admin)
applications.post('/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { accountIds, adminRemarks, extensionProfileId } = await c.req.json()
    // accountIds is an array of { name, accountId, vcard? }
    // extensionProfileId: which AdsPower/extension profile manages these accounts

    const application = await prisma.adAccountApplication.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    if (application.status !== 'PENDING') {
      return c.json({ error: 'Application already processed' }, 400)
    }

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return c.json({ error: 'Account IDs are required' }, 400)
    }

    // Create ad accounts and update application in a transaction
    await prisma.$transaction(async (tx) => {
      // Create ad accounts
      for (const acc of accountIds) {
        if (acc.accountId) {
          // Convert per-account vcard string to JSON array: "Visa *1234" -> [{"id":null,"display":"Visa *1234"}]
          const vcardStr = acc.vcard?.trim()
          const fundingSourcesJson = vcardStr
            ? JSON.stringify(vcardStr.split(',').map((s: string) => s.trim()).filter(Boolean).map((d: string) => ({ id: null, display: d })))
            : null

          await tx.adAccount.create({
            data: {
              platform: application.platform,
              accountId: acc.accountId,
              accountName: acc.name,
              licenseName: application.licenseNo || undefined,
              status: 'APPROVED',
              userId: application.userId,
              applicationId: application.id,
              extensionProfileId: extensionProfileId || null,
              fundingSources: fundingSourcesJson,
              fundingSourceUpdatedAt: fundingSourcesJson ? new Date() : undefined,
            }
          })
        }
      }

      // Update application
      await tx.adAccountApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          accountDetails: JSON.stringify(accountIds),
          adminRemarks,
          approvedAt: new Date()
        }
      })

      // Process referral reward for ad account approval ($15 for first approval)
      await processAdAccountApprovalReward(application.userId, tx)
    })

    // Auto-add account IDs to extension profile's managedAdAccountIds
    if (extensionProfileId) {
      const newAccountIds = accountIds.filter((a: any) => a.accountId).map((a: any) => a.accountId)
      if (newAccountIds.length > 0) {
        const profile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: extensionProfileId },
          select: { managedAdAccountIds: true }
        })
        if (profile) {
          const existing = new Set(profile.managedAdAccountIds || [])
          const toAdd = newAccountIds.filter((id: string) => !existing.has(id))
          if (toAdd.length > 0) {
            await prisma.facebookAutomationProfile.update({
              where: { id: extensionProfileId },
              data: { managedAdAccountIds: { push: toAdd } }
            })
          }
        }
      }
    }

    // Send in-app notification
    await createNotification({
      userId: application.userId,
      type: 'ACCOUNT_APPROVED',
      title: 'Ad Account Approved',
      message: `Your ad account application (${application.applyId}) has been approved.`,
      link: '/facebook'
    })

    return c.json({ message: 'Application approved and accounts created' })
  } catch (error) {
    console.error('Approve application error:', error)
    return c.json({ error: 'Failed to approve application' }, 500)
  }
})

// POST /applications/:id/reject - Reject application (Admin)
applications.post('/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks, refund } = await c.req.json()

    const application = await prisma.adAccountApplication.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    if (application.status !== 'PENDING') {
      return c.json({ error: 'Application already processed' }, 400)
    }

    await prisma.$transaction(async (tx) => {
      // If refund is requested, add back to wallet
      if (refund) {
        const currentUser = await tx.user.findUnique({
          where: { id: application.userId },
          select: { walletBalance: true }
        })

        if (currentUser) {
          await tx.user.update({
            where: { id: application.userId },
            data: {
              walletBalance: { increment: application.totalCost }
            }
          })

          // Create wallet flow record for refund
          await tx.walletFlow.create({
            data: {
              type: 'REFUND',
              amount: application.totalCost,
              balanceBefore: Number(currentUser.walletBalance),
              balanceAfter: Number(currentUser.walletBalance) + Number(application.totalCost),
              referenceType: 'refund',
              referenceId: application.id,
              userId: application.userId,
              description: `Refund for rejected application - ${application.applyId}`
            }
          })
        }
      }

      // Update application status
      await tx.adAccountApplication.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminRemarks
        }
      })
    })

    // Send in-app notification
    await createNotification({
      userId: application.userId,
      type: 'ACCOUNT_REJECTED',
      title: 'Ad Account Rejected',
      message: `Your ad account application (${application.applyId}) has been rejected.${adminRemarks ? ' Reason: ' + adminRemarks : ''}`,
      link: '/facebook'
    })

    return c.json({ message: 'Application rejected' + (refund ? ' and refunded' : '') })
  } catch (error) {
    console.error('Reject application error:', error)
    return c.json({ error: 'Failed to reject application' }, 500)
  }
})

// POST /applications/bulk-approve - Bulk approve applications (Admin)
applications.post('/bulk-approve', requireAdmin, async (c) => {
  try {
    const { applicationIds, accountData, extensionProfileId } = await c.req.json()
    // accountData is { [applicationId]: [{name, accountId}] }

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return c.json({ error: 'Application IDs are required' }, 400)
    }

    const results = []
    for (const appId of applicationIds) {
      try {
        const application = await prisma.adAccountApplication.findUnique({
          where: { id: appId }
        })

        if (!application || application.status !== 'PENDING') {
          results.push({ id: appId, success: false, error: 'Not found or already processed' })
          continue
        }

        const accounts = accountData?.[appId] || []

        await prisma.$transaction(async (tx) => {
          // Create ad accounts
          for (const acc of accounts) {
            if (acc.accountId) {
              await tx.adAccount.create({
                data: {
                  platform: application.platform,
                  accountId: acc.accountId,
                  accountName: acc.name,
                  licenseName: application.licenseNo || undefined,
                  status: 'APPROVED',
                  userId: application.userId,
                  applicationId: application.id,
                  extensionProfileId: extensionProfileId || null,
                }
              })
            }
          }

          // Update application
          await tx.adAccountApplication.update({
            where: { id: appId },
            data: {
              status: 'APPROVED',
              accountDetails: accounts.length > 0 ? JSON.stringify(accounts) : undefined,
              approvedAt: new Date()
            }
          })

          // Process referral reward for ad account approval ($15 for first approval)
          await processAdAccountApprovalReward(application.userId, tx)
        })

        await createNotification({
          userId: application.userId,
          type: 'ACCOUNT_APPROVED',
          title: 'Ad Account Approved',
          message: `Your ad account application (${application.applyId}) has been approved.`,
          link: '/facebook'
        })

        results.push({ id: appId, success: true })
      } catch (err) {
        results.push({ id: appId, success: false, error: 'Failed to process' })
      }
    }

    // Auto-add all account IDs to extension profile's managedAdAccountIds
    if (extensionProfileId) {
      const allNewIds: string[] = []
      for (const appId of applicationIds) {
        const accounts = accountData?.[appId] || []
        for (const acc of accounts) {
          if (acc.accountId) allNewIds.push(acc.accountId)
        }
      }
      if (allNewIds.length > 0) {
        const profile = await prisma.facebookAutomationProfile.findUnique({
          where: { id: extensionProfileId },
          select: { managedAdAccountIds: true }
        })
        if (profile) {
          const existing = new Set(profile.managedAdAccountIds || [])
          const toAdd = allNewIds.filter((id: string) => !existing.has(id))
          if (toAdd.length > 0) {
            await prisma.facebookAutomationProfile.update({
              where: { id: extensionProfileId },
              data: { managedAdAccountIds: { push: toAdd } }
            })
          }
        }
      }
    }

    return c.json({ message: 'Bulk operation completed', results })
  } catch (error) {
    console.error('Bulk approve error:', error)
    return c.json({ error: 'Failed to bulk approve' }, 500)
  }
})

// POST /applications/bulk-reject - Bulk reject applications (Admin)
applications.post('/bulk-reject', requireAdmin, async (c) => {
  try {
    const { applicationIds, refund, adminRemarks } = await c.req.json()

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return c.json({ error: 'Application IDs are required' }, 400)
    }

    const results = []
    for (const appId of applicationIds) {
      try {
        const application = await prisma.adAccountApplication.findUnique({
          where: { id: appId },
          include: { user: true }
        })

        if (!application || application.status !== 'PENDING') {
          results.push({ id: appId, success: false, error: 'Not found or already processed' })
          continue
        }

        await prisma.$transaction(async (tx) => {
          if (refund) {
            const currentUser = await tx.user.findUnique({
              where: { id: application.userId },
              select: { walletBalance: true }
            })

            if (currentUser) {
              await tx.user.update({
                where: { id: application.userId },
                data: {
                  walletBalance: { increment: application.totalCost }
                }
              })

              await tx.walletFlow.create({
                data: {
                  type: 'CREDIT',
                  amount: application.totalCost,
                  balanceBefore: Number(currentUser.walletBalance),
                  balanceAfter: Number(currentUser.walletBalance) + Number(application.totalCost),
                  referenceType: 'refund',
                  referenceId: application.id,
                  userId: application.userId,
                  description: `Refund for rejected application - ${application.applyId}`
                }
              })
            }
          }

          await tx.adAccountApplication.update({
            where: { id: appId },
            data: {
              status: 'REJECTED',
              adminRemarks
            }
          })
        })

        results.push({ id: appId, success: true })
      } catch (err) {
        results.push({ id: appId, success: false, error: 'Failed to process' })
      }
    }

    return c.json({ message: 'Bulk operation completed', results })
  } catch (error) {
    console.error('Bulk reject error:', error)
    return c.json({ error: 'Failed to bulk reject' }, 500)
  }
})

// POST /applications/create-direct - Admin creates account directly for user (without application)
applications.post('/create-direct', requireAdmin, async (c) => {
  try {
    const { userId, platform, accounts, extensionProfileId } = await c.req.json()
    // accounts is array of { name, accountId, vcard? }

    if (!userId || !platform || !accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return c.json({ error: 'User ID, platform, and accounts are required' }, 400)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const createdAccounts = []
    for (const acc of accounts) {
      if (acc.name && acc.accountId) {
        // Convert per-account vcard string to JSON array
        const vcardStr = acc.vcard?.trim()
        const fundingSourcesJson = vcardStr
          ? JSON.stringify(vcardStr.split(',').map((s: string) => s.trim()).filter(Boolean).map((d: string) => ({ id: null, display: d })))
          : null

        const account = await prisma.adAccount.create({
          data: {
            platform: platform.toUpperCase(),
            accountId: acc.accountId.trim(),
            accountName: acc.name,
            licenseName: acc.licenseName || undefined,
            status: 'APPROVED',
            userId,
            extensionProfileId: extensionProfileId || null,
            fundingSources: fundingSourcesJson,
            fundingSourceUpdatedAt: fundingSourcesJson ? new Date() : undefined,
          }
        })
        createdAccounts.push(account)
      }
    }

    // Auto-add account IDs to extension profile's managedAdAccountIds
    if (extensionProfileId && createdAccounts.length > 0) {
      const newAccountIds = createdAccounts.map((a: any) => a.accountId)
      const profile = await prisma.facebookAutomationProfile.findUnique({
        where: { id: extensionProfileId },
        select: { managedAdAccountIds: true }
      })
      if (profile) {
        const existing = new Set(profile.managedAdAccountIds || [])
        const toAdd = newAccountIds.filter((id: string) => !existing.has(id))
        if (toAdd.length > 0) {
          await prisma.facebookAutomationProfile.update({
            where: { id: extensionProfileId },
            data: { managedAdAccountIds: { push: toAdd } }
          })
        }
      }
    }

    // Send notification so user gets real-time update + confetti
    if (createdAccounts.length > 0) {
      await createNotification({
        userId,
        type: 'ACCOUNT_APPROVED',
        title: 'Ad Account Created',
        message: `${createdAccounts.length} new ${platform} ad account(s) have been added to your account.`,
        link: `/${platform.toLowerCase()}`
      })
    }

    return c.json({
      message: `${createdAccounts.length} account(s) created successfully`,
      accounts: createdAccounts
    }, 201)
  } catch (error) {
    console.error('Create direct account error:', error)
    return c.json({ error: 'Failed to create accounts' }, 500)
  }
})

export default applications
