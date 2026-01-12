import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, requireAdmin } from '../middleware/auth.js'

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
          phone: true,
          realName: true,
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

    // Create agent
    const agent = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username,
        phone: data.phone,
        phone2: data.phone2,
        realName: data.realName,
        address: data.address,
        website: data.website,
        role: 'AGENT',
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

    return c.json({ message: 'Agent created successfully', agent }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create agent error:', error)
    return c.json({ error: 'Failed to create agent' }, 500)
  }
})

// PATCH /agents/:id - Update agent
agents.patch('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()

    // Remove password from body if empty
    if (body.password === '' || body.password === undefined) {
      delete body.password
    } else if (body.password) {
      body.password = await bcrypt.hash(body.password, 10)
    }

    const agent = await prisma.user.update({
      where: { id, role: 'AGENT' },
      data: body,
      select: {
        id: true,
        email: true,
        username: true,
        uniqueId: true,
        status: true,
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

export default agents
