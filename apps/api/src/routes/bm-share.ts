import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { verifyToken, requireUser, requireAdmin } from '../middleware/auth.js'
import { cheetahApi } from '../services/cheetah-api.js'
import {
  sendEmail,
  buildSmtpConfig,
  getBMShareSubmittedTemplate,
  getBMShareApprovedTemplate,
  getBMShareRejectedTemplate,
  getAdminNotificationTemplate
} from '../utils/email.js'

const prisma = new PrismaClient()
const bmShare = new Hono()

// Helper to get admin emails for notifications
async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { email: true }
  })
  return admins.map(a => a.email)
}

// Hardcoded Cheetah API credentials
const CHEETAH_CREDENTIALS = {
  test: {
    appid: 'D6lVRPk',
    secret: 'f38d64ad-0d0b-4e94-8c5f-27a9e014bf87',
    baseUrl: 'https://test-open-api.neverbugs.com',
  },
  production: {
    appid: 'wvLY386',
    secret: '7fd454af-84f1-4e62-9130-4989181063ed',
    baseUrl: 'https://open-api.cmcm.com',
  },
}

// Load Cheetah API config - defaults to production
async function loadCheetahConfig() {
  try {
    let env: 'test' | 'production' = 'production' // Default to production

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: 'cheetah_api_config' }
      })
      if (setting && setting.value) {
        const config = JSON.parse(setting.value as string)
        env = config.environment || 'production'
      }
    } catch (dbError) {
      // If DB fails, use production default
      console.log('Using default production config')
    }

    const credentials = CHEETAH_CREDENTIALS[env]
    cheetahApi.setConfig(credentials)
    console.log(`Cheetah API configured for ${env} environment:`, credentials.baseUrl)
    return true
  } catch (error) {
    console.error('Failed to load Cheetah API config:', error)
    return false
  }
}

bmShare.use('*', verifyToken)

// Generate Apply ID: BM{YYYYMMDD}{7-digit random}
function generateApplyId(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = String(Math.floor(1000000 + Math.random() * 9000000))
  return `BM${year}${month}${day}${random}`
}

const createBmShareSchema = z.object({
  platform: z.enum(['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING']),
  adAccountId: z.string().min(1),
  adAccountName: z.string().min(1),
  bmId: z.string().min(1),
  message: z.string().optional(),
})

// Background process for BM share
async function processBMShareInBackground(requestId: string, adAccountId: string, bmId: string, platform: string) {
  console.log(`[BM Share Background] Processing request ${requestId}`)

  let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'REJECTED'
  let adminRemarks: string | null = null
  let approvedAt: Date | null = null
  let shareMethod: string | null = null

  if (platform === 'FACEBOOK') {
    // ===== STEP 1: Try Cheetah API first =====
    let cheetahHandled = false
    try {
      const configLoaded = await loadCheetahConfig()

      if (configLoaded) {
        console.log(`[BM Share Background] Calling Cheetah API for account ${adAccountId}`)
        const result = await cheetahApi.bindAccountToBM(adAccountId, bmId, 2)
        console.log(`[BM Share Background] Cheetah Response:`, JSON.stringify(result))

        if (result.code === 0) {
          status = 'APPROVED'
          approvedAt = new Date()
          adminRemarks = 'BM share completed successfully! Ad account has been shared to your Business Manager.'
          shareMethod = 'CHEETAH'
          cheetahHandled = true
          console.log(`[BM Share Background] SUCCESS via Cheetah!`)
        } else if (result.code === 999) {
          // BM has agency account — this is a definitive rejection
          status = 'REJECTED'
          adminRemarks = 'This Business Manager already has an agency ad account or cannot receive this ad account. Please provide a fresh BM ID that does not have any existing agency ad accounts.'
          shareMethod = 'CHEETAH'
          cheetahHandled = true
        } else if (result.code === 110) {
          // Account not found in Cheetah — not a Cheetah account, try other methods
          console.log(`[BM Share Background] Not a Cheetah account, trying Facebook Graph API...`)
          cheetahHandled = false
        } else {
          // Other Cheetah error — account might not be Cheetah, try other methods
          let errorMsg = result.msg || ''
          if (errorMsg.includes('成功')) {
            status = 'APPROVED'
            approvedAt = new Date()
            adminRemarks = 'BM share completed successfully!'
            shareMethod = 'CHEETAH'
            cheetahHandled = true
          } else {
            console.log(`[BM Share Background] Cheetah failed (${result.msg}), trying Facebook Graph API...`)
            cheetahHandled = false
          }
        }
      }
    } catch (apiError: any) {
      console.log(`[BM Share Background] Cheetah API error: ${apiError.message}, trying Facebook Graph API...`)
      cheetahHandled = false
    }

    // ===== STEP 2: If Cheetah didn't handle it, leave PENDING for Chrome extension =====
    // The extension polls for PENDING shares via heartbeat and executes them
    // using its local Facebook token (which works in browser context).
    // Server-side Graph API calls don't work because Facebook's first-party
    // tokens are bound to the browser session and can't be used externally.
    if (!cheetahHandled) {
      status = 'PENDING'
      adminRemarks = 'Waiting for Chrome extension to process. Make sure the 6AD extension is running in a browser logged into Facebook.'
      shareMethod = 'EXTENSION'
      console.log(`[BM Share Background] Cheetah failed, leaving PENDING for extension pickup (act_${adAccountId} → BM ${bmId})`)
    }
  } else {
    // Non-Facebook - reject with message
    status = 'REJECTED'
    adminRemarks = 'BM share is only available for Facebook accounts.'
  }

  // Update the request with result
  try {
    await prisma.bmShareRequest.update({
      where: { id: requestId },
      data: {
        status,
        adminRemarks,
        approvedAt,
        shareMethod,
        shareAttempts: { increment: 1 },
      }
    })
    console.log(`[BM Share Background] Request ${requestId} updated to ${status} (method: ${shareMethod})`)
  } catch (updateError) {
    console.error(`[BM Share Background] Failed to update request:`, updateError)
  }
}

// POST /bm-share - Create BM share request (User)
// Accepts immediately and processes in background
bmShare.post('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const body = await c.req.json()
    const data = createBmShareSchema.parse(body)

    // Generate unique Apply ID
    let applyId = generateApplyId()
    let attempts = 0
    while (attempts < 10) {
      const existing = await prisma.bmShareRequest.findUnique({ where: { applyId } })
      if (!existing) break
      applyId = generateApplyId()
      attempts++
    }

    // Get user with agent info for email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agent: { select: { email: true, brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } }
    })

    // Create request with PROCESSING status immediately
    const bmShareRequest = await prisma.bmShareRequest.create({
      data: {
        applyId,
        platform: data.platform,
        adAccountId: data.adAccountId,
        adAccountName: data.adAccountName,
        bmId: data.bmId,
        message: data.message,
        userId,
        status: 'PENDING', // Will be updated by background process
        adminRemarks: 'Processing your request...',
      },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    // Send email to user
    if (user) {
      const approvedDomain = user.agent?.customDomains?.[0]
      const agentLogo = approvedDomain?.emailLogo || approvedDomain?.brandLogo || user.agent?.emailLogo || user.agent?.brandLogo || null
      const agentBrandName = user.agent?.username || null
      const userEmailTemplate = getBMShareSubmittedTemplate({
        username: user.username,
        applyId,
        platform: data.platform,
        adAccountId: data.adAccountId,
        bmId: data.bmId,
        agentLogo,
        agentBrandName
      })
      sendEmail({ to: user.email, ...userEmailTemplate, senderName: user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(user.agent) }).catch(console.error)

      // Notify admins and agent
      const adminNotification = getAdminNotificationTemplate({
        type: 'bm_share',
        applyId,
        username: user.username,
        userEmail: user.email,
        platform: data.platform,
        details: `Account: ${data.adAccountId}, BM: ${data.bmId}`
      })

      getAdminEmails().then(emails => {
        emails.forEach(email => sendEmail({ to: email, ...adminNotification }).catch(console.error))
      })

      if (user.agent?.email) {
        sendEmail({ to: user.agent.email, ...adminNotification }).catch(console.error)
      }
    }

    // Process in background (don't await - respond immediately to user)
    processBMShareInBackground(
      bmShareRequest.id,
      data.adAccountId,
      data.bmId,
      data.platform
    ).catch(err => console.error('[BM Share Background] Unhandled error:', err))

    // Respond immediately to user
    return c.json({
      message: 'BM share request submitted! Processing your request...',
      bmShareRequest,
      processing: true
    }, 201)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create BM share request error:', error)
    return c.json({ error: 'Failed to submit BM share request' }, 500)
  }
})

// GET /bm-share - Get user's BM share requests
bmShare.get('/', requireUser, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { platform, status, page = '1', limit = '20' } = c.req.query()

    const where: any = {}

    // Only users see their own, admins see all
    if (userRole === 'USER') {
      where.userId = userId
    }

    if (platform) where.platform = platform.toUpperCase()
    if (status) where.status = status.toUpperCase()

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [requests, total] = await Promise.all([
      prisma.bmShareRequest.findMany({
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
      prisma.bmShareRequest.count({ where })
    ])

    return c.json({
      bmShareRequests: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get BM share requests error:', error)
    return c.json({ error: 'Failed to get BM share requests' }, 500)
  }
})

// GET /bm-share/admin - Get all BM share requests (Admin)
bmShare.get('/admin', requireAdmin, async (c) => {
  try {
    const { platform, status, page = '1', limit = '20', search } = c.req.query()

    const where: any = {}

    if (platform) where.platform = platform.toUpperCase()
    if (status) where.status = status.toUpperCase()
    if (search) {
      where.OR = [
        { applyId: { contains: search, mode: 'insensitive' } },
        { bmId: { contains: search, mode: 'insensitive' } },
        { adAccountName: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [requests, total, stats] = await Promise.all([
      prisma.bmShareRequest.findMany({
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
      prisma.bmShareRequest.count({ where }),
      prisma.bmShareRequest.groupBy({
        by: ['status'],
        where: platform ? { platform: platform.toUpperCase() as any } : {},
        _count: true
      })
    ])

    // Calculate stats
    const statsMap = {
      totalPending: 0,
      totalApproved: 0,
      totalRejected: 0
    }

    stats.forEach(s => {
      if (s.status === 'PENDING') statsMap.totalPending = s._count
      else if (s.status === 'APPROVED') statsMap.totalApproved = s._count
      else if (s.status === 'REJECTED') statsMap.totalRejected = s._count
    })

    return c.json({
      bmShareRequests: requests,
      stats: statsMap,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get admin BM share requests error:', error)
    return c.json({ error: 'Failed to get BM share requests' }, 500)
  }
})

// POST /bm-share/:id/approve - Approve BM share request (Admin)
// Also calls Cheetah API to bind account to BM
bmShare.post('/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json().catch(() => ({}))

    const request = await prisma.bmShareRequest.findUnique({
      where: { id },
      include: { user: { include: { agent: { select: { brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
    })

    if (!request) {
      return c.json({ error: 'BM share request not found' }, 404)
    }

    if (request.status !== 'PENDING') {
      return c.json({ error: 'Request already processed' }, 400)
    }

    // Try to bind via Cheetah API for Facebook accounts
    let apiMessage = ''
    if (request.platform === 'FACEBOOK') {
      const configLoaded = await loadCheetahConfig()
      if (configLoaded) {
        try {
          // type=2 means MANAGE access (can manage campaigns)
          const result = await cheetahApi.bindAccountToBM(request.adAccountId, request.bmId, 2)
          if (result.code === 0) {
            apiMessage = ' BM share completed via Cheetah API.'
          } else {
            apiMessage = ` Warning: Cheetah API returned error: ${result.msg}`
          }
        } catch (apiError: any) {
          apiMessage = ` Warning: Cheetah API call failed: ${apiError.message}`
          console.error('Cheetah API error during manual approval:', apiError)
        }
      } else {
        apiMessage = ' Note: Cheetah API not configured - manual BM share may be required.'
      }
    }

    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks: (adminRemarks || '') + apiMessage,
        approvedAt: new Date()
      }
    })

    // Send approval email to user
    const approvedDomainApprove = request.user.agent?.customDomains?.[0]
    const agentLogoApprove = approvedDomainApprove?.emailLogo || approvedDomainApprove?.brandLogo || request.user.agent?.emailLogo || request.user.agent?.brandLogo || null
    const agentBrandNameApprove = request.user.agent?.username || null
    const userEmailTemplate = getBMShareApprovedTemplate({
      username: request.user.username,
      applyId: request.applyId,
      platform: request.platform,
      adAccountId: request.adAccountId,
      bmId: request.bmId,
      adminRemarks: (adminRemarks || '') + apiMessage,
      agentLogo: agentLogoApprove,
      agentBrandName: agentBrandNameApprove
    })
    sendEmail({ to: request.user.email, ...userEmailTemplate, senderName: request.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(request.user.agent) }).catch(console.error)

    return c.json({ message: 'BM share request approved.' + apiMessage })
  } catch (error) {
    console.error('Approve BM share request error:', error)
    return c.json({ error: 'Failed to approve request' }, 500)
  }
})

// POST /bm-share/:id/reject - Reject BM share request (Admin)
bmShare.post('/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json().catch(() => ({}))

    const request = await prisma.bmShareRequest.findUnique({
      where: { id },
      include: { user: { include: { agent: { select: { brandLogo: true, emailLogo: true, username: true, emailSenderNameApproved: true, smtpEnabled: true, smtpHost: true, smtpPort: true, smtpUsername: true, smtpPassword: true, smtpEncryption: true, smtpFromEmail: true, customDomains: { where: { status: 'APPROVED' }, select: { brandLogo: true, emailLogo: true }, take: 1 } } } } } }
    })

    if (!request) {
      return c.json({ error: 'BM share request not found' }, 404)
    }

    if (request.status !== 'PENDING') {
      return c.json({ error: 'Request already processed' }, 400)
    }

    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminRemarks,
        rejectedAt: new Date()
      }
    })

    // Send rejection email to user
    const approvedDomainReject = request.user.agent?.customDomains?.[0]
    const agentLogoReject = approvedDomainReject?.emailLogo || approvedDomainReject?.brandLogo || request.user.agent?.emailLogo || request.user.agent?.brandLogo || null
    const agentBrandNameReject = request.user.agent?.username || null
    const userEmailTemplate = getBMShareRejectedTemplate({
      username: request.user.username,
      applyId: request.applyId,
      platform: request.platform,
      adAccountId: request.adAccountId,
      bmId: request.bmId,
      adminRemarks,
      agentLogo: agentLogoReject,
      agentBrandName: agentBrandNameReject
    })
    sendEmail({ to: request.user.email, ...userEmailTemplate, senderName: request.user.agent?.emailSenderNameApproved || undefined, smtpConfig: buildSmtpConfig(request.user.agent) }).catch(console.error)

    return c.json({ message: 'BM share request rejected' })
  } catch (error) {
    console.error('Reject BM share request error:', error)
    return c.json({ error: 'Failed to reject request' }, 500)
  }
})

export default bmShare
