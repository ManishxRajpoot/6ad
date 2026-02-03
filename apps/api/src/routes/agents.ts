import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, requireAdmin } from '../middleware/auth.js'

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
    const { brandLogo, brandName } = body

    const agent = await prisma.user.update({
      where: { id: userId },
      data: {
        brandLogo: brandLogo || null,
        brandName: brandName || null,
      },
      select: {
        id: true,
        brandLogo: true,
        brandName: true,
        updatedAt: true,
      }
    })

    return c.json({ message: 'Branding updated successfully', agent })
  } catch (error) {
    console.error('Update branding error:', error)
    return c.json({ error: 'Failed to update branding' }, 500)
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
