import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, requireAgent, requireAdmin } from '../middleware/auth.js'

const users = new Hono()

users.use('*', verifyToken)

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  realName: z.string().optional(),
  address: z.string().optional(),
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
  agentId: z.string().optional(),
})

// GET /users - List users
users.get('/', requireAgent, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { search, status, agentId, page = '1', limit = '20' } = c.req.query()

    const where: any = { role: 'USER' }

    // Agents can only see their own users
    if (userRole === 'AGENT') {
      where.agentId = userId
    } else if (agentId) {
      where.agentId = agentId
    }

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

    const [usersList, total] = await Promise.all([
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
          googleFee: true,
          tiktokFee: true,
          snapchatFee: true,
          bingFee: true,
          createdAt: true,
          agent: {
            select: { id: true, username: true }
          }
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ])

    return c.json({
      users: usersList,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ error: 'Failed to get users' }, 500)
  }
})

// GET /users/:id - Get single user
users.get('/:id', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const userId = c.get('userId')
    const userRole = c.get('userRole')

    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' },
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
        agentId: true,
        agent: {
          select: { id: true, username: true, email: true }
        },
        createdAt: true,
        updatedAt: true,
        adAccounts: {
          select: {
            id: true,
            platform: true,
            accountId: true,
            accountName: true,
            status: true,
            balance: true,
          }
        },
        _count: {
          select: {
            deposits: true,
            withdrawals: true,
            refunds: true,
          }
        }
      }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check if agent has access to this user
    if (userRole === 'AGENT' && user.agentId !== userId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    return c.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    return c.json({ error: 'Failed to get user' }, 500)
  }
})

// POST /users - Create user (Admin/Agent)
users.post('/', requireAgent, async (c) => {
  try {
    const body = await c.req.json()
    const data = createUserSchema.parse(body)
    const creatorId = c.get('userId')
    const creatorRole = c.get('userRole')

    // Check if email exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existing) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // Set agent ID (if creator is agent, use their ID)
    let agentId = data.agentId
    if (creatorRole === 'AGENT') {
      agentId = creatorId
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        username: data.username,
        phone: data.phone,
        phone2: data.phone2,
        realName: data.realName,
        address: data.address,
        role: 'USER',
        agentId,
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
        creatorId,
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

    return c.json({ message: 'User created successfully', user }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create user error:', error)
    return c.json({ error: 'Failed to create user' }, 500)
  }
})

// PATCH /users/:id - Update user
users.patch('/:id', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const currentUserId = c.get('userId')
    const currentUserRole = c.get('userRole')

    // Get user to check ownership
    const existingUser = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Agents can only update their own users
    if (currentUserRole === 'AGENT' && existingUser.agentId !== currentUserId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Handle password
    if (body.password === '' || body.password === undefined) {
      delete body.password
    } else if (body.password) {
      body.password = await bcrypt.hash(body.password, 10)
    }

    // Agents cannot change agentId
    if (currentUserRole === 'AGENT') {
      delete body.agentId
    }

    const user = await prisma.user.update({
      where: { id },
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

    return c.json({ message: 'User updated successfully', user })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// POST /users/:id/block
users.post('/:id/block', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const { reason } = await c.req.json()
    const blockerId = c.get('userId')
    const blockerRole = c.get('userRole')

    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (blockerRole === 'AGENT' && user.agentId !== blockerId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'BLOCKED' }
    })

    await prisma.blockHistory.create({
      data: {
        userId: id,
        blockedById: blockerId,
        reason,
      }
    })

    return c.json({ message: 'User blocked successfully' })
  } catch (error) {
    console.error('Block user error:', error)
    return c.json({ error: 'Failed to block user' }, 500)
  }
})

// POST /users/:id/unblock
users.post('/:id/unblock', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const unblockerId = c.get('userId')
    const unblockerRole = c.get('userRole')

    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (unblockerRole === 'AGENT' && user.agentId !== unblockerId) {
      return c.json({ error: 'Access denied' }, 403)
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' }
    })

    await prisma.blockHistory.updateMany({
      where: { userId: id, unblockedAt: null },
      data: { unblockedAt: new Date() }
    })

    return c.json({ message: 'User unblocked successfully' })
  } catch (error) {
    console.error('Unblock user error:', error)
    return c.json({ error: 'Failed to unblock user' }, 500)
  }
})

export default users
