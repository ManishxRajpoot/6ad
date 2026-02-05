import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, requireAdmin } from '../middleware/auth.js'
import { testSmtpConnection, sendTestEmail, SmtpConfig } from '../utils/email.js'

// Generate unique referral code for user
function generateReferralCode(username: string): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const userPart = username.substring(0, 3).toUpperCase()
  return `${userPart}${randomPart}`
}

const agents = new Hono()

// All routes require authentication
agents.use('*', verifyToken)

// Validation schemas
const createAgentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  realName: z.string().optional(),
  address: z.string().optional(),
  website: z.string().optional(),
  openingFee: z.number().optional(),
  fbFee: z.number().optional(),
  fbCommission: z.number().optional(),
  googleFee: z.number().optional(),
  googleCommission: z.number().optional(),
  tiktokFee: z.number().optional(),
  tiktokCommission: z.number().optional(),
  snapchatFee: z.number().optional(),
  snapchatCommission: z.number().optional(),
  bingFee: z.number().optional(),
  bingCommission: z.number().optional(),
  remarks: z.string().optional(),
})

// GET /agents - List all agents (Admin only)
agents.get('/', requireAdmin, async (c) => {
  try {
    const { search, status, page = '1', limit = '20' } = c.req.query()

    const where: any = { role: 'AGENT' }

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { realName: { contains: search, mode: 'insensitive' } },
        { uniqueId: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [agents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          plaintextPassword: true,
          phone: true,
          realName: true,
          profileImage: true,
          uniqueId: true,
          status: true,
          walletBalance: true,
          couponBalance: true,
          openingFee: true,
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
          twoFactorEnabled: true,
          twoFactorSecret: true,
          createdAt: true,
          _count: {
            select: { users: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return c.json({
      agents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get agents error:', error)
    return c.json({ error: 'Failed to get agents' }, 500)
  }
})

// GET /agents/branding - Get own branding settings (Agent only)
agents.get('/branding', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Only agents can get their branding
    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can access branding' }, 403)
    }

    const agent = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        brandLogo: true,
        brandName: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
      }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    return c.json({ branding: agent })
  } catch (error) {
    console.error('Get branding error:', error)
    return c.json({ error: 'Failed to get branding' }, 500)
  }
})

// PATCH /agents/branding - Update own branding (Agent only)
// NOTE: This route MUST be before /:id routes to avoid being matched as an ID
agents.patch('/branding', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    // Only agents can update their branding
    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can update branding' }, 403)
    }

    const body = await c.req.json()
    const { brandLogo, brandName, emailSenderName } = body

    // If emailSenderName is being updated, set status to PENDING for admin approval
    const updateData: any = {
      brandLogo: brandLogo || null,
      brandName: brandName || null,
    }

    // Handle email sender name with approval workflow
    if (emailSenderName !== undefined) {
      if (emailSenderName && emailSenderName.trim()) {
        updateData.emailSenderName = emailSenderName.trim()
        updateData.emailSenderNameStatus = 'PENDING'
      } else {
        // If clearing the email sender name, clear both pending and approved
        updateData.emailSenderName = null
        updateData.emailSenderNameApproved = null
        updateData.emailSenderNameStatus = null
      }
    }

    const agent = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        brandLogo: true,
        brandName: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
        updatedAt: true,
      }
    })

    return c.json({ message: 'Branding updated successfully. Email sender name requires admin approval.', agent })
  } catch (error) {
    console.error('Update branding error:', error)
    return c.json({ error: 'Failed to update branding' }, 500)
  }
})

// ==================== SMTP CONFIGURATION ====================

// GET /agents/smtp - Get own SMTP settings (Agent only)
agents.get('/smtp', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can access SMTP settings' }, 403)
    }

    // Fetch the full agent document (SMTP fields may not exist yet if schema not migrated)
    const agent = await prisma.user.findUnique({
      where: { id: userId }
    }) as any

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Return SMTP settings with defaults if fields don't exist
    return c.json({
      smtp: {
        smtpEnabled: agent.smtpEnabled ?? false,
        smtpHost: agent.smtpHost ?? null,
        smtpPort: agent.smtpPort ?? null,
        smtpUsername: agent.smtpUsername ?? null,
        smtpPassword: agent.smtpPassword ? '••••••••' : null,
        smtpEncryption: agent.smtpEncryption ?? null,
        smtpFromEmail: agent.smtpFromEmail ?? null,
      }
    })
  } catch (error) {
    console.error('Get SMTP settings error:', error)
    return c.json({ error: 'Failed to get SMTP settings' }, 500)
  }
})

// PATCH /agents/smtp - Update SMTP settings (Agent only)
agents.patch('/smtp', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can update SMTP settings' }, 403)
    }

    const body = await c.req.json()
    const { smtpEnabled, smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, smtpFromEmail } = body

    // Build update data
    const updateData: any = {}

    if (smtpEnabled !== undefined) updateData.smtpEnabled = smtpEnabled

    if (smtpEnabled) {
      if (smtpHost) updateData.smtpHost = smtpHost
      if (smtpPort) updateData.smtpPort = parseInt(smtpPort)
      if (smtpUsername) updateData.smtpUsername = smtpUsername
      // Only update password if a new one is provided (not masked)
      if (smtpPassword && !smtpPassword.includes('•')) {
        updateData.smtpPassword = smtpPassword
      }
      if (smtpEncryption) updateData.smtpEncryption = smtpEncryption
      if (smtpFromEmail) updateData.smtpFromEmail = smtpFromEmail
    } else {
      // If disabling SMTP, clear all settings
      updateData.smtpHost = null
      updateData.smtpPort = null
      updateData.smtpUsername = null
      updateData.smtpPassword = null
      updateData.smtpEncryption = null
      updateData.smtpFromEmail = null
    }

    const agent = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        smtpEnabled: true,
        smtpHost: true,
        smtpPort: true,
        smtpUsername: true,
        smtpEncryption: true,
        smtpFromEmail: true,
      }
    })

    return c.json({ message: 'SMTP settings updated successfully', smtp: agent })
  } catch (error) {
    console.error('Update SMTP settings error:', error)
    return c.json({ error: 'Failed to update SMTP settings' }, 500)
  }
})

// POST /agents/smtp/test - Test SMTP connection (Agent only)
agents.post('/smtp/test', async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    if (userRole !== 'AGENT') {
      return c.json({ error: 'Only agents can test SMTP settings' }, 403)
    }

    const body = await c.req.json()
    const { smtpHost, smtpPort, smtpUsername, smtpPassword, smtpEncryption, smtpFromEmail, testEmail } = body

    if (!smtpHost || !smtpPort || !smtpUsername || !smtpFromEmail) {
      return c.json({ error: 'Missing required SMTP fields' }, 400)
    }

    // If password is masked, fetch the actual password from DB
    let actualPassword = smtpPassword
    if (smtpPassword && smtpPassword.includes('•')) {
      const agent = await prisma.user.findUnique({
        where: { id: userId },
        select: { smtpPassword: true }
      })
      actualPassword = agent?.smtpPassword
    }

    if (!actualPassword) {
      return c.json({ error: 'SMTP password is required' }, 400)
    }

    const config: SmtpConfig = {
      host: smtpHost,
      port: parseInt(smtpPort),
      username: smtpUsername,
      password: actualPassword,
      encryption: smtpEncryption || 'TLS',
      fromEmail: smtpFromEmail,
    }

    // First test connection
    const connectionResult = await testSmtpConnection(config)
    if (!connectionResult.success) {
      return c.json({ success: false, error: connectionResult.error }, 400)
    }

    // If test email provided, send test email
    if (testEmail) {
      const emailResult = await sendTestEmail(config, testEmail)
      if (!emailResult.success) {
        return c.json({ success: false, error: emailResult.error }, 400)
      }
      return c.json({ success: true, message: `Test email sent to ${testEmail}` })
    }

    return c.json({ success: true, message: 'SMTP connection successful' })
  } catch (error: any) {
    console.error('Test SMTP error:', error)
    return c.json({ success: false, error: error.message || 'SMTP test failed' }, 500)
  }
})

// ==================== ADMIN EMAIL SENDER NAME APPROVAL ====================

// GET /agents/email-settings/pending - Get all agents with pending email sender name requests (Admin only)
agents.get('/email-settings/pending', requireAdmin, async (c) => {
  try {
    const pendingRequests = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        emailSenderNameStatus: 'PENDING',
        emailSenderName: { not: null }
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
        brandName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' }
    })

    return c.json({ requests: pendingRequests })
  } catch (error) {
    console.error('Get pending email settings error:', error)
    return c.json({ error: 'Failed to get pending email settings' }, 500)
  }
})

// PATCH /agents/email-settings/:id/approve - Approve email sender name (Admin only)
agents.patch('/email-settings/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const agent = await prisma.user.findUnique({
      where: { id, role: 'AGENT' },
      select: { emailSenderName: true, emailSenderNameStatus: true }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    if (agent.emailSenderNameStatus !== 'PENDING') {
      return c.json({ error: 'No pending email sender name request found' }, 400)
    }

    const updatedAgent = await prisma.user.update({
      where: { id },
      data: {
        emailSenderNameApproved: agent.emailSenderName,
        emailSenderNameStatus: 'APPROVED',
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
      }
    })

    return c.json({ message: 'Email sender name approved successfully', agent: updatedAgent })
  } catch (error) {
    console.error('Approve email sender name error:', error)
    return c.json({ error: 'Failed to approve email sender name' }, 500)
  }
})

// PATCH /agents/email-settings/:id/reject - Reject email sender name (Admin only)
agents.patch('/email-settings/:id/reject', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { reason } = body

    const agent = await prisma.user.findUnique({
      where: { id, role: 'AGENT' },
      select: { emailSenderName: true, emailSenderNameStatus: true }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    if (agent.emailSenderNameStatus !== 'PENDING') {
      return c.json({ error: 'No pending email sender name request found' }, 400)
    }

    // Reset the pending name and status
    const updatedAgent = await prisma.user.update({
      where: { id },
      data: {
        emailSenderName: null,
        emailSenderNameStatus: 'REJECTED',
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailSenderName: true,
        emailSenderNameApproved: true,
        emailSenderNameStatus: true,
      }
    })

    return c.json({ message: 'Email sender name rejected', agent: updatedAgent })
  } catch (error) {
    console.error('Reject email sender name error:', error)
    return c.json({ error: 'Failed to reject email sender name' }, 500)
  }
})

// GET /agents/:id - Get single agent
agents.get('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    const agent = await prisma.user.findUnique({
      where: { id, role: 'AGENT' },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        phone2: true,
        realName: true,
        address: true,
        website: true,
        profileImage: true,
        uniqueId: true,
        status: true,
        walletBalance: true,
        openingFee: true,
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
        personalRemarks: true,
        contactRemarks: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            username: true,
            email: true,
            status: true,
            walletBalance: true,
            createdAt: true,
          }
        },
        blockHistory: {
          orderBy: { blockedAt: 'desc' },
          take: 10,
          include: {
            blockedBy: {
              select: { username: true }
            }
          }
        }
      }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    return c.json({ agent })
  } catch (error) {
    console.error('Get agent error:', error)
    return c.json({ error: 'Failed to get agent' }, 500)
  }
})

// POST /agents - Create new agent (Admin only)
agents.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const data = createAgentSchema.parse(body)

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Create agent with unique referral code (retry on collision)
    let agent
    let retries = 3
    while (retries > 0) {
      const referralCode = generateReferralCode(data.username)
      try {
        agent = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            plaintextPassword: data.password, // Store plaintext for admin visibility
            username: data.username,
            phone: data.phone,
            phone2: data.phone2,
            realName: data.realName,
            address: data.address,
            website: data.website,
            role: 'AGENT',
            referralCode,
            openingFee: data.openingFee || 0,
            fbFee: data.fbFee || 0,
            fbCommission: data.fbCommission || 0,
            googleFee: data.googleFee || 0,
            googleCommission: data.googleCommission || 0,
            tiktokFee: data.tiktokFee || 0,
            tiktokCommission: data.tiktokCommission || 0,
            snapchatFee: data.snapchatFee || 0,
            snapchatCommission: data.snapchatCommission || 0,
            bingFee: data.bingFee || 0,
            bingCommission: data.bingCommission || 0,
            personalRemarks: data.remarks,
            creatorId: c.get('userId'),
          },
          select: {
            id: true,
            email: true,
            username: true,
            uniqueId: true,
            role: true,
            createdAt: true,
          }
        })
        break // Success, exit loop
      } catch (err: any) {
        // If referral code collision, retry with new code
        if (err?.message?.includes('referralCode') && retries > 1) {
          retries--
          continue
        }
        throw err // Re-throw other errors
      }
    }

    if (!agent) {
      throw new Error('Failed to create agent after multiple attempts')
    }

    return c.json({ message: 'Agent created successfully', agent }, 201)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create agent error:', error)
    const errorMessage = error?.message || 'Failed to create agent'
    return c.json({ error: errorMessage }, 500)
  }
})

// PATCH /agents/:id - Update agent
agents.patch('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    // Build update data explicitly to avoid passing unwanted fields
    const updateData: any = {}

    // Basic fields
    if (body.username !== undefined) updateData.username = body.username
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2
    if (body.realName !== undefined) updateData.realName = body.realName
    if (body.address !== undefined) updateData.address = body.address
    if (body.website !== undefined) updateData.website = body.website
    if (body.status !== undefined) updateData.status = body.status
    if (body.personalRemarks !== undefined) updateData.personalRemarks = body.personalRemarks
    if (body.contactRemarks !== undefined) updateData.contactRemarks = body.contactRemarks

    // Password - only update if provided and not empty
    if (body.password && body.password.trim()) {
      updateData.password = await bcrypt.hash(body.password, 10)
      updateData.plaintextPassword = body.password // Store plaintext for admin visibility
    }

    // Platform fees - convert to numbers
    if (body.fbFee !== undefined) updateData.fbFee = Number(body.fbFee) || 0
    if (body.fbCommission !== undefined) updateData.fbCommission = Number(body.fbCommission) || 0
    if (body.googleFee !== undefined) updateData.googleFee = Number(body.googleFee) || 0
    if (body.googleCommission !== undefined) updateData.googleCommission = Number(body.googleCommission) || 0
    if (body.tiktokFee !== undefined) updateData.tiktokFee = Number(body.tiktokFee) || 0
    if (body.tiktokCommission !== undefined) updateData.tiktokCommission = Number(body.tiktokCommission) || 0
    if (body.snapchatFee !== undefined) updateData.snapchatFee = Number(body.snapchatFee) || 0
    if (body.snapchatCommission !== undefined) updateData.snapchatCommission = Number(body.snapchatCommission) || 0
    if (body.bingFee !== undefined) updateData.bingFee = Number(body.bingFee) || 0
    if (body.bingCommission !== undefined) updateData.bingCommission = Number(body.bingCommission) || 0

    console.log('Updating agent with data:', JSON.stringify(updateData, null, 2))

    const agent = await prisma.user.update({
      where: { id, role: 'AGENT' },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        uniqueId: true,
        status: true,
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
        updatedAt: true,
      }
    })

    return c.json({ message: 'Agent updated successfully', agent })
  } catch (error) {
    console.error('Update agent error:', error)
    return c.json({ error: 'Failed to update agent' }, 500)
  }
})

// POST /agents/:id/block - Block agent
agents.post('/:id/block', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()
    const adminId = c.get('userId')

    // Update agent status
    await prisma.user.update({
      where: { id, role: 'AGENT' },
      data: { status: 'BLOCKED' }
    })

    // Create block history
    await prisma.blockHistory.create({
      data: {
        userId: id,
        blockedById: adminId,
        reason,
      }
    })

    return c.json({ message: 'Agent blocked successfully' })
  } catch (error) {
    console.error('Block agent error:', error)
    return c.json({ error: 'Failed to block agent' }, 500)
  }
})

// POST /agents/:id/unblock - Unblock agent
agents.post('/:id/unblock', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    // Update agent status
    await prisma.user.update({
      where: { id, role: 'AGENT' },
      data: { status: 'ACTIVE' }
    })

    // Update last block history
    await prisma.blockHistory.updateMany({
      where: { userId: id, unblockedAt: null },
      data: { unblockedAt: new Date() }
    })

    return c.json({ message: 'Agent unblocked successfully' })
  } catch (error) {
    console.error('Unblock agent error:', error)
    return c.json({ error: 'Failed to unblock agent' }, 500)
  }
})

// DELETE /agents/:id - Delete agent (soft delete by setting status)
agents.delete('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    await prisma.user.update({
      where: { id, role: 'AGENT' },
      data: { status: 'INACTIVE' }
    })

    return c.json({ message: 'Agent deleted successfully' })
  } catch (error) {
    console.error('Delete agent error:', error)
    return c.json({ error: 'Failed to delete agent' }, 500)
  }
})

// POST /agents/:id/remove-coupons - Admin removes coupons from agent (does not return to anyone)
agents.post('/:id/remove-coupons', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    // Get the target agent
    const agent = await prisma.user.findUnique({
      where: { id, role: 'AGENT' }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Check if agent has enough coupons
    if (agent.couponBalance < amount) {
      return c.json({
        error: `Agent only has ${agent.couponBalance} coupon(s) available.`
      }, 400)
    }

    // Remove coupons from agent
    const updatedAgent = await prisma.user.update({
      where: { id },
      data: { couponBalance: { decrement: amount } },
      select: {
        id: true,
        username: true,
        email: true,
        couponBalance: true,
      }
    })

    return c.json({
      message: `Successfully removed ${amount} coupon(s) from ${updatedAgent.username}`,
      agent: updatedAgent
    })
  } catch (error) {
    console.error('Remove coupons from agent error:', error)
    return c.json({ error: 'Failed to remove coupons' }, 500)
  }
})

// POST /agents/:id/add-coupons - Admin adds coupons to agent
agents.post('/:id/add-coupons', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    // Get the target agent
    const agent = await prisma.user.findUnique({
      where: { id, role: 'AGENT' }
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Add coupons to agent
    const updatedAgent = await prisma.user.update({
      where: { id },
      data: { couponBalance: { increment: amount } },
      select: {
        id: true,
        username: true,
        email: true,
        couponBalance: true,
      }
    })

    return c.json({
      message: `Successfully added ${amount} coupon(s) to ${updatedAgent.username}`,
      agent: updatedAgent
    })
  } catch (error) {
    console.error('Add coupons to agent error:', error)
    return c.json({ error: 'Failed to add coupons' }, 500)
  }
})

export default agents
