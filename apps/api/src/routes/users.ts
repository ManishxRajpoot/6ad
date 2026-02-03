import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, requireAgent, requireAdmin } from '../middleware/auth.js'

// Generate unique referral code for user
function generateReferralCode(username: string): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const userPart = username.substring(0, 3).toUpperCase()
  return `${userPart}${randomPart}`
}

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
  website: z.string().optional(),
  personalRemarks: z.string().optional(),
  openingFee: z.number().optional(),
  fbFee: z.number().optional(),
  fbCommission: z.number().optional(),
  fbUnlimitedDomainFee: z.number().optional(),
  googleFee: z.number().optional(),
  googleCommission: z.number().optional(),
  googleUnlimitedDomainFee: z.number().optional(),
  tiktokFee: z.number().optional(),
  tiktokCommission: z.number().optional(),
  tiktokUnlimitedDomainFee: z.number().optional(),
  snapchatFee: z.number().optional(),
  snapchatCommission: z.number().optional(),
  snapchatUnlimitedDomainFee: z.number().optional(),
  bingFee: z.number().optional(),
  bingCommission: z.number().optional(),
  bingUnlimitedDomainFee: z.number().optional(),
  agentId: z.string().optional(),
})

// GET /users - List users
users.get('/', requireAgent, async (c) => {
  try {
    const userId = c.get('userId')
    const userRole = c.get('userRole')
    const { search, status, agentId, page = '1', limit = '1000' } = c.req.query()

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
          plaintextPassword: true,
          phone: true,
          phone2: true,
          realName: true,
          address: true,
          website: true,
          profileImage: true,
          uniqueId: true,
          status: true,
          walletBalance: true,
          couponBalance: true,
          openingFee: true,
          fbFee: true,
          fbCommission: true,
          fbUnlimitedDomainFee: true,
          googleFee: true,
          googleCommission: true,
          googleUnlimitedDomainFee: true,
          tiktokFee: true,
          tiktokCommission: true,
          tiktokUnlimitedDomainFee: true,
          snapchatFee: true,
          snapchatCommission: true,
          snapchatUnlimitedDomainFee: true,
          bingFee: true,
          bingCommission: true,
          bingUnlimitedDomainFee: true,
          personalRemarks: true,
          agentId: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
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

    // Convert Decimal fields to numbers
    const usersWithNumbers = usersList.map(user => ({
      ...user,
      walletBalance: Number(user.walletBalance),
      openingFee: Number(user.openingFee),
      fbFee: Number(user.fbFee),
      fbCommission: Number(user.fbCommission),
      fbUnlimitedDomainFee: Number(user.fbUnlimitedDomainFee),
      googleFee: Number(user.googleFee),
      googleCommission: Number(user.googleCommission),
      googleUnlimitedDomainFee: Number(user.googleUnlimitedDomainFee),
      tiktokFee: Number(user.tiktokFee),
      tiktokCommission: Number(user.tiktokCommission),
      tiktokUnlimitedDomainFee: Number(user.tiktokUnlimitedDomainFee),
      snapchatFee: Number(user.snapchatFee),
      snapchatCommission: Number(user.snapchatCommission),
      snapchatUnlimitedDomainFee: Number(user.snapchatUnlimitedDomainFee),
      bingFee: Number(user.bingFee),
      bingCommission: Number(user.bingCommission),
      bingUnlimitedDomainFee: Number(user.bingUnlimitedDomainFee),
    }))

    return c.json({
      users: usersWithNumbers,
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
        plaintextPassword: true,
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
        fbUnlimitedDomainFee: true,
        googleFee: true,
        googleCommission: true,
        googleUnlimitedDomainFee: true,
        tiktokFee: true,
        tiktokCommission: true,
        tiktokUnlimitedDomainFee: true,
        snapchatFee: true,
        snapchatCommission: true,
        snapchatUnlimitedDomainFee: true,
        bingFee: true,
        bingCommission: true,
        bingUnlimitedDomainFee: true,
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

    // Convert Decimal fields to numbers
    const userWithNumbers = {
      ...user,
      walletBalance: Number(user.walletBalance),
      openingFee: Number(user.openingFee),
      fbFee: Number(user.fbFee),
      fbCommission: Number(user.fbCommission),
      fbUnlimitedDomainFee: Number(user.fbUnlimitedDomainFee),
      googleFee: Number(user.googleFee),
      googleCommission: Number(user.googleCommission),
      googleUnlimitedDomainFee: Number(user.googleUnlimitedDomainFee),
      tiktokFee: Number(user.tiktokFee),
      tiktokCommission: Number(user.tiktokCommission),
      tiktokUnlimitedDomainFee: Number(user.tiktokUnlimitedDomainFee),
      snapchatFee: Number(user.snapchatFee),
      snapchatCommission: Number(user.snapchatCommission),
      snapchatUnlimitedDomainFee: Number(user.snapchatUnlimitedDomainFee),
      bingFee: Number(user.bingFee),
      bingCommission: Number(user.bingCommission),
      bingUnlimitedDomainFee: Number(user.bingUnlimitedDomainFee),
      adAccounts: user.adAccounts.map(acc => ({
        ...acc,
        balance: Number(acc.balance),
        totalDeposit: Number(acc.totalDeposit),
        totalSpend: Number(acc.totalSpend),
      }))
    }

    return c.json({ user: userWithNumbers })
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

      // Get agent's minimum fees to validate
      const agent = await prisma.user.findUnique({
        where: { id: creatorId },
        select: {
          fbFee: true,
          fbCommission: true,
          fbUnlimitedDomainFee: true,
          googleFee: true,
          googleCommission: true,
          tiktokFee: true,
          tiktokCommission: true,
          snapchatFee: true,
          snapchatCommission: true,
          bingFee: true,
          bingCommission: true,
        }
      })

      if (agent) {
        const errors: string[] = []

        // Helper to get minimum - only validates if agent has a minimum set (> 0)
        const agentFbFee = Number(agent.fbFee) || 0
        const agentFbCommission = Number(agent.fbCommission) || 0
        const agentFbUnlimitedDomainFee = Number(agent.fbUnlimitedDomainFee) || 0
        const agentGoogleFee = Number(agent.googleFee) || 0
        const agentGoogleCommission = Number(agent.googleCommission) || 0
        const agentTiktokFee = Number(agent.tiktokFee) || 0
        const agentTiktokCommission = Number(agent.tiktokCommission) || 0
        const agentSnapchatFee = Number(agent.snapchatFee) || 0
        const agentSnapchatCommission = Number(agent.snapchatCommission) || 0
        const agentBingFee = Number(agent.bingFee) || 0
        const agentBingCommission = Number(agent.bingCommission) || 0

        const userFbFee = Number(data.fbFee) || 0
        const userFbCommission = Number(data.fbCommission) || 0
        const userFbUnlimitedDomainFee = Number(data.fbUnlimitedDomainFee) || 0
        const userGoogleFee = Number(data.googleFee) || 0
        const userGoogleCommission = Number(data.googleCommission) || 0
        const userTiktokFee = Number(data.tiktokFee) || 0
        const userTiktokCommission = Number(data.tiktokCommission) || 0
        const userSnapchatFee = Number(data.snapchatFee) || 0
        const userSnapchatCommission = Number(data.snapchatCommission) || 0
        const userBingFee = Number(data.bingFee) || 0
        const userBingCommission = Number(data.bingCommission) || 0

        // Validate Facebook fees - only if agent has minimum set
        if (agentFbFee > 0 && userFbFee < agentFbFee) {
          errors.push(`Facebook Opening Fee cannot be less than $${agentFbFee}`)
        }
        if (agentFbCommission > 0 && userFbCommission < agentFbCommission) {
          errors.push(`Facebook Commission cannot be less than ${agentFbCommission}%`)
        }
        if (agentFbUnlimitedDomainFee > 0 && userFbUnlimitedDomainFee < agentFbUnlimitedDomainFee) {
          errors.push(`Facebook Unlimited Domain Fee cannot be less than $${agentFbUnlimitedDomainFee}`)
        }

        // Validate Google fees
        if (agentGoogleFee > 0 && userGoogleFee < agentGoogleFee) {
          errors.push(`Google Opening Fee cannot be less than $${agentGoogleFee}`)
        }
        if (agentGoogleCommission > 0 && userGoogleCommission < agentGoogleCommission) {
          errors.push(`Google Commission cannot be less than ${agentGoogleCommission}%`)
        }

        // Validate TikTok fees
        if (agentTiktokFee > 0 && userTiktokFee < agentTiktokFee) {
          errors.push(`TikTok Opening Fee cannot be less than $${agentTiktokFee}`)
        }
        if (agentTiktokCommission > 0 && userTiktokCommission < agentTiktokCommission) {
          errors.push(`TikTok Commission cannot be less than ${agentTiktokCommission}%`)
        }

        // Validate Snapchat fees
        if (agentSnapchatFee > 0 && userSnapchatFee < agentSnapchatFee) {
          errors.push(`Snapchat Opening Fee cannot be less than $${agentSnapchatFee}`)
        }
        if (agentSnapchatCommission > 0 && userSnapchatCommission < agentSnapchatCommission) {
          errors.push(`Snapchat Commission cannot be less than ${agentSnapchatCommission}%`)
        }

        // Validate Bing fees
        if (agentBingFee > 0 && userBingFee < agentBingFee) {
          errors.push(`Bing Opening Fee cannot be less than $${agentBingFee}`)
        }
        if (agentBingCommission > 0 && userBingCommission < agentBingCommission) {
          errors.push(`Bing Commission cannot be less than ${agentBingCommission}%`)
        }

        if (errors.length > 0) {
          return c.json({ error: errors.join('. ') }, 400)
        }
      }
    }

    // Generate unique referral code for the user with retry on collision
    let user
    let retries = 3
    while (retries > 0) {
      const referralCode = generateReferralCode(data.username)
      try {
        user = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            plaintextPassword: data.password,
            username: data.username,
            phone: data.phone,
            phone2: data.phone2,
            realName: data.realName,
            address: data.address,
            website: data.website,
            personalRemarks: data.personalRemarks,
            role: 'USER',
            agentId,
            referralCode,
            openingFee: data.openingFee || 0,
            fbFee: data.fbFee || 0,
            fbCommission: data.fbCommission || 0,
            fbUnlimitedDomainFee: data.fbUnlimitedDomainFee || 0,
            googleFee: data.googleFee || 0,
            googleCommission: data.googleCommission || 0,
            googleUnlimitedDomainFee: data.googleUnlimitedDomainFee || 0,
            tiktokFee: data.tiktokFee || 0,
            tiktokCommission: data.tiktokCommission || 0,
            tiktokUnlimitedDomainFee: data.tiktokUnlimitedDomainFee || 0,
            snapchatFee: data.snapchatFee || 0,
            snapchatCommission: data.snapchatCommission || 0,
            snapchatUnlimitedDomainFee: data.snapchatUnlimitedDomainFee || 0,
            bingFee: data.bingFee || 0,
            bingCommission: data.bingCommission || 0,
            bingUnlimitedDomainFee: data.bingUnlimitedDomainFee || 0,
            creatorId,
          },
          select: {
            id: true,
            email: true,
            username: true,
            plaintextPassword: true,
            phone: true,
            phone2: true,
            realName: true,
            address: true,
            website: true,
            uniqueId: true,
            status: true,
            walletBalance: true,
            openingFee: true,
            fbFee: true,
            fbCommission: true,
            fbUnlimitedDomainFee: true,
            googleFee: true,
            googleCommission: true,
            googleUnlimitedDomainFee: true,
            tiktokFee: true,
            tiktokCommission: true,
            tiktokUnlimitedDomainFee: true,
            snapchatFee: true,
            snapchatCommission: true,
            snapchatUnlimitedDomainFee: true,
            bingFee: true,
            bingCommission: true,
            bingUnlimitedDomainFee: true,
            personalRemarks: true,
            agentId: true,
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

    if (!user) {
      throw new Error('Failed to create user after multiple attempts')
    }

    // Convert Decimal fields to numbers
    const userWithNumbers = {
      ...user,
      walletBalance: Number(user.walletBalance),
      openingFee: Number(user.openingFee),
      fbFee: Number(user.fbFee),
      fbCommission: Number(user.fbCommission),
      fbUnlimitedDomainFee: Number(user.fbUnlimitedDomainFee),
      googleFee: Number(user.googleFee),
      googleCommission: Number(user.googleCommission),
      googleUnlimitedDomainFee: Number(user.googleUnlimitedDomainFee),
      tiktokFee: Number(user.tiktokFee),
      tiktokCommission: Number(user.tiktokCommission),
      tiktokUnlimitedDomainFee: Number(user.tiktokUnlimitedDomainFee),
      snapchatFee: Number(user.snapchatFee),
      snapchatCommission: Number(user.snapchatCommission),
      snapchatUnlimitedDomainFee: Number(user.snapchatUnlimitedDomainFee),
      bingFee: Number(user.bingFee),
      bingCommission: Number(user.bingCommission),
      bingUnlimitedDomainFee: Number(user.bingUnlimitedDomainFee),
    }

    console.log('Created user with commissions:', JSON.stringify({
      fbCommission: userWithNumbers.fbCommission,
      googleCommission: userWithNumbers.googleCommission,
      plaintextPassword: userWithNumbers.plaintextPassword
    }, null, 2))

    return c.json({ message: 'User created successfully', user: userWithNumbers }, 201)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Create user error:', error)
    // Return more detailed error message for debugging
    const errorMessage = error?.message || 'Failed to create user'
    return c.json({ error: errorMessage }, 500)
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

    // Validate minimum fees for agents
    if (currentUserRole === 'AGENT') {
      const agent = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: {
          fbFee: true,
          fbCommission: true,
          fbUnlimitedDomainFee: true,
          googleFee: true,
          googleCommission: true,
          tiktokFee: true,
          tiktokCommission: true,
          snapchatFee: true,
          snapchatCommission: true,
          bingFee: true,
          bingCommission: true,
        }
      })

      if (agent) {
        const errors: string[] = []

        // Get agent minimums - only validate if agent has a minimum set (> 0)
        const agentFbFee = Number(agent.fbFee) || 0
        const agentFbCommission = Number(agent.fbCommission) || 0
        const agentFbUnlimitedDomainFee = Number(agent.fbUnlimitedDomainFee) || 0
        const agentGoogleFee = Number(agent.googleFee) || 0
        const agentGoogleCommission = Number(agent.googleCommission) || 0
        const agentTiktokFee = Number(agent.tiktokFee) || 0
        const agentTiktokCommission = Number(agent.tiktokCommission) || 0
        const agentSnapchatFee = Number(agent.snapchatFee) || 0
        const agentSnapchatCommission = Number(agent.snapchatCommission) || 0
        const agentBingFee = Number(agent.bingFee) || 0
        const agentBingCommission = Number(agent.bingCommission) || 0

        const userFbFee = Number(body.fbFee) || 0
        const userFbCommission = Number(body.fbCommission) || 0
        const userFbUnlimitedDomainFee = Number(body.fbUnlimitedDomainFee) || 0
        const userGoogleFee = Number(body.googleFee) || 0
        const userGoogleCommission = Number(body.googleCommission) || 0
        const userTiktokFee = Number(body.tiktokFee) || 0
        const userTiktokCommission = Number(body.tiktokCommission) || 0
        const userSnapchatFee = Number(body.snapchatFee) || 0
        const userSnapchatCommission = Number(body.snapchatCommission) || 0
        const userBingFee = Number(body.bingFee) || 0
        const userBingCommission = Number(body.bingCommission) || 0

        // Validate Facebook fees - only if agent has minimum set
        if (agentFbFee > 0 && userFbFee < agentFbFee) {
          errors.push(`Facebook Opening Fee cannot be less than $${agentFbFee}`)
        }
        if (agentFbCommission > 0 && userFbCommission < agentFbCommission) {
          errors.push(`Facebook Commission cannot be less than ${agentFbCommission}%`)
        }
        if (agentFbUnlimitedDomainFee > 0 && userFbUnlimitedDomainFee < agentFbUnlimitedDomainFee) {
          errors.push(`Facebook Unlimited Domain Fee cannot be less than $${agentFbUnlimitedDomainFee}`)
        }

        // Validate Google fees
        if (agentGoogleFee > 0 && userGoogleFee < agentGoogleFee) {
          errors.push(`Google Opening Fee cannot be less than $${agentGoogleFee}`)
        }
        if (agentGoogleCommission > 0 && userGoogleCommission < agentGoogleCommission) {
          errors.push(`Google Commission cannot be less than ${agentGoogleCommission}%`)
        }

        // Validate TikTok fees
        if (agentTiktokFee > 0 && userTiktokFee < agentTiktokFee) {
          errors.push(`TikTok Opening Fee cannot be less than $${agentTiktokFee}`)
        }
        if (agentTiktokCommission > 0 && userTiktokCommission < agentTiktokCommission) {
          errors.push(`TikTok Commission cannot be less than ${agentTiktokCommission}%`)
        }

        // Validate Snapchat fees
        if (agentSnapchatFee > 0 && userSnapchatFee < agentSnapchatFee) {
          errors.push(`Snapchat Opening Fee cannot be less than $${agentSnapchatFee}`)
        }
        if (agentSnapchatCommission > 0 && userSnapchatCommission < agentSnapchatCommission) {
          errors.push(`Snapchat Commission cannot be less than ${agentSnapchatCommission}%`)
        }

        // Validate Bing fees
        if (agentBingFee > 0 && userBingFee < agentBingFee) {
          errors.push(`Bing Opening Fee cannot be less than $${agentBingFee}`)
        }
        if (agentBingCommission > 0 && userBingCommission < agentBingCommission) {
          errors.push(`Bing Commission cannot be less than ${agentBingCommission}%`)
        }

        if (errors.length > 0) {
          return c.json({ error: errors.join('. ') }, 400)
        }
      }
    }

    // Log incoming request body for debugging
    console.log('=== UPDATE USER REQUEST ===')
    console.log('User ID:', id)
    console.log('Request body:', JSON.stringify(body, null, 2))

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

    // Handle password - only update if provided and not empty
    if (body.password && body.password.trim() !== '') {
      updateData.plaintextPassword = body.password
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    // Platform fees - explicitly convert to numbers
    if (body.fbFee !== undefined) updateData.fbFee = Number(body.fbFee) || 0
    if (body.fbUnlimitedDomainFee !== undefined) updateData.fbUnlimitedDomainFee = Number(body.fbUnlimitedDomainFee) || 0
    if (body.googleFee !== undefined) updateData.googleFee = Number(body.googleFee) || 0
    if (body.tiktokFee !== undefined) updateData.tiktokFee = Number(body.tiktokFee) || 0
    if (body.snapchatFee !== undefined) updateData.snapchatFee = Number(body.snapchatFee) || 0
    if (body.bingFee !== undefined) updateData.bingFee = Number(body.bingFee) || 0

    // Commission percentages - explicitly convert to numbers
    if (body.fbCommission !== undefined) updateData.fbCommission = Number(body.fbCommission) || 0
    if (body.googleCommission !== undefined) updateData.googleCommission = Number(body.googleCommission) || 0
    if (body.tiktokCommission !== undefined) updateData.tiktokCommission = Number(body.tiktokCommission) || 0
    if (body.snapchatCommission !== undefined) updateData.snapchatCommission = Number(body.snapchatCommission) || 0
    if (body.bingCommission !== undefined) updateData.bingCommission = Number(body.bingCommission) || 0

    // Unlimited domain fees - explicitly convert to numbers
    if (body.fbUnlimitedDomainFee !== undefined) updateData.fbUnlimitedDomainFee = Number(body.fbUnlimitedDomainFee) || 0
    if (body.googleUnlimitedDomainFee !== undefined) updateData.googleUnlimitedDomainFee = Number(body.googleUnlimitedDomainFee) || 0
    if (body.tiktokUnlimitedDomainFee !== undefined) updateData.tiktokUnlimitedDomainFee = Number(body.tiktokUnlimitedDomainFee) || 0
    if (body.snapchatUnlimitedDomainFee !== undefined) updateData.snapchatUnlimitedDomainFee = Number(body.snapchatUnlimitedDomainFee) || 0
    if (body.bingUnlimitedDomainFee !== undefined) updateData.bingUnlimitedDomainFee = Number(body.bingUnlimitedDomainFee) || 0

    // Agent assignment - only admins can change
    if (currentUserRole === 'ADMIN' && body.agentId !== undefined) {
      updateData.agentId = body.agentId || null
    }

    console.log('Update data being sent to Prisma:', JSON.stringify(updateData, null, 2))

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        plaintextPassword: true,
        phone: true,
        phone2: true,
        realName: true,
        address: true,
        website: true,
        uniqueId: true,
        status: true,
        walletBalance: true,
        openingFee: true,
        fbFee: true,
        fbCommission: true,
        fbUnlimitedDomainFee: true,
        googleFee: true,
        googleCommission: true,
        googleUnlimitedDomainFee: true,
        tiktokFee: true,
        tiktokCommission: true,
        tiktokUnlimitedDomainFee: true,
        snapchatFee: true,
        snapchatCommission: true,
        snapchatUnlimitedDomainFee: true,
        bingFee: true,
        bingCommission: true,
        bingUnlimitedDomainFee: true,
        personalRemarks: true,
        agentId: true,
        updatedAt: true,
        createdAt: true,
      }
    })

    // Convert Decimal fields to numbers
    const userWithNumbers = {
      ...user,
      walletBalance: Number(user.walletBalance),
      openingFee: Number(user.openingFee),
      fbFee: Number(user.fbFee),
      fbCommission: Number(user.fbCommission),
      fbUnlimitedDomainFee: Number(user.fbUnlimitedDomainFee),
      googleFee: Number(user.googleFee),
      googleCommission: Number(user.googleCommission),
      googleUnlimitedDomainFee: Number(user.googleUnlimitedDomainFee),
      tiktokFee: Number(user.tiktokFee),
      tiktokCommission: Number(user.tiktokCommission),
      tiktokUnlimitedDomainFee: Number(user.tiktokUnlimitedDomainFee),
      snapchatFee: Number(user.snapchatFee),
      snapchatCommission: Number(user.snapchatCommission),
      snapchatUnlimitedDomainFee: Number(user.snapchatUnlimitedDomainFee),
      bingFee: Number(user.bingFee),
      bingCommission: Number(user.bingCommission),
      bingUnlimitedDomainFee: Number(user.bingUnlimitedDomainFee),
    }

    console.log('Returning updated user:', JSON.stringify({
      fbCommission: userWithNumbers.fbCommission,
      googleCommission: userWithNumbers.googleCommission,
      plaintextPassword: userWithNumbers.plaintextPassword
    }, null, 2))

    return c.json({ message: 'User updated successfully', user: userWithNumbers })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ error: 'Failed to update user' }, 500)
  }
})

// DELETE /users/:id - Delete user (Admin only - agents cannot delete users)
users.delete('/:id', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()

    // Get user to check if exists
    const existingUser = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Delete the user
    await prisma.user.delete({
      where: { id }
    })

    return c.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user error:', error)
    return c.json({ error: 'Failed to delete user' }, 500)
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

// POST /users/:id/coupons - Add coupons to user (Admin only - direct add)
users.post('/:id/coupons', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        couponBalance: { increment: amount }
      },
      select: {
        id: true,
        username: true,
        email: true,
        couponBalance: true,
      }
    })

    return c.json({
      message: `Added ${amount} coupon(s) to ${user.role === 'AGENT' ? 'agent' : 'user'} successfully`,
      user: updatedUser
    })
  } catch (error) {
    console.error('Add coupons error:', error)
    return c.json({ error: 'Failed to add coupons' }, 500)
  }
})

// POST /users/:id/give-coupons - Agent gives coupons to their user (deducts from agent's balance)
users.post('/:id/give-coupons', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()
    const agentId = c.get('userId')
    const agentRole = c.get('userRole')

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    // Get the target user
    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Agents can only give coupons to their own users
    if (agentRole === 'AGENT' && user.agentId !== agentId) {
      return c.json({ error: 'Access denied - user does not belong to you' }, 403)
    }

    // Get agent's coupon balance
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { couponBalance: true }
    })

    if (!agent || agent.couponBalance < amount) {
      return c.json({
        error: `Insufficient coupons. You have ${agent?.couponBalance || 0} coupon(s) available.`
      }, 400)
    }

    // Transfer coupons from agent to user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from agent
      await tx.user.update({
        where: { id: agentId },
        data: { couponBalance: { decrement: amount } }
      })

      // Add to user
      const updatedUser = await tx.user.update({
        where: { id },
        data: { couponBalance: { increment: amount } },
        select: {
          id: true,
          username: true,
          email: true,
          couponBalance: true,
        }
      })

      return updatedUser
    })

    // Get updated agent balance
    const updatedAgent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { couponBalance: true }
    })

    return c.json({
      message: `Successfully gave ${amount} coupon(s) to ${result.username}`,
      user: result,
      agentCouponsRemaining: updatedAgent?.couponBalance || 0
    })
  } catch (error) {
    console.error('Give coupons error:', error)
    return c.json({ error: 'Failed to give coupons' }, 500)
  }
})

// POST /users/:id/take-coupons - Agent takes back coupons from their user (returns to agent's balance)
users.post('/:id/take-coupons', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()
    const agentId = c.get('userId')
    const agentRole = c.get('userRole')

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    // Get the target user
    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Agents can only take coupons from their own users
    if (agentRole === 'AGENT' && user.agentId !== agentId) {
      return c.json({ error: 'Access denied - user does not belong to you' }, 403)
    }

    // Check if user has enough coupons
    if (user.couponBalance < amount) {
      return c.json({
        error: `User only has ${user.couponBalance} coupon(s) available.`
      }, 400)
    }

    // Transfer coupons from user back to agent in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct from user
      const updatedUser = await tx.user.update({
        where: { id },
        data: { couponBalance: { decrement: amount } },
        select: {
          id: true,
          username: true,
          email: true,
          couponBalance: true,
        }
      })

      // Add back to agent
      await tx.user.update({
        where: { id: agentId },
        data: { couponBalance: { increment: amount } }
      })

      return updatedUser
    })

    // Get updated agent balance
    const updatedAgent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { couponBalance: true }
    })

    return c.json({
      message: `Successfully took back ${amount} coupon(s) from ${result.username}`,
      user: result,
      agentCouponsRemaining: updatedAgent?.couponBalance || 0
    })
  } catch (error) {
    console.error('Take coupons error:', error)
    return c.json({ error: 'Failed to take coupons' }, 500)
  }
})

// POST /users/:id/distribute-money - Agent distributes money from their wallet to user wallet
users.post('/:id/distribute-money', requireAgent, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount, remarks } = await c.req.json()
    const agentId = c.get('userId')
    const agentRole = c.get('userRole')

    if (!amount || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400)
    }

    // Get the target user
    const user = await prisma.user.findUnique({
      where: { id, role: 'USER' }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Agents can only distribute money to their own users
    if (agentRole === 'AGENT' && user.agentId !== agentId) {
      return c.json({ error: 'Access denied - user does not belong to you' }, 403)
    }

    // Get agent's wallet balance
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { walletBalance: true, username: true }
    })

    if (!agent || Number(agent.walletBalance) < amount) {
      return c.json({
        error: `Insufficient balance. You have $${Number(agent?.walletBalance || 0).toFixed(2)} available.`
      }, 400)
    }

    // Generate Apply ID for the distribution
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(1000000 + Math.random() * 9000000)
    const applyId = `DTB${year}${month}${day}${random}`

    // Transfer money from agent to user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get balances before
      const agentBalanceBefore = Number(agent.walletBalance)
      const userBalanceBefore = Number(user.walletBalance)

      // Deduct from agent
      await tx.user.update({
        where: { id: agentId },
        data: { walletBalance: { decrement: amount } }
      })

      // Add to user
      const updatedUser = await tx.user.update({
        where: { id },
        data: { walletBalance: { increment: amount } },
        select: {
          id: true,
          username: true,
          email: true,
          walletBalance: true,
        }
      })

      // Create wallet flow record for agent (deduction)
      await tx.walletFlow.create({
        data: {
          type: 'WITHDRAWAL',
          amount: amount,
          balanceBefore: agentBalanceBefore,
          balanceAfter: agentBalanceBefore - amount,
          referenceId: applyId,
          referenceType: 'distribution',
          userId: agentId,
          description: `Distributed to ${user.username}${remarks ? ': ' + remarks : ''}`
        }
      })

      // Create wallet flow record for user (credit) - include agent name
      await tx.walletFlow.create({
        data: {
          type: 'CREDIT',
          amount: amount,
          balanceBefore: userBalanceBefore,
          balanceAfter: userBalanceBefore + amount,
          referenceId: applyId,
          referenceType: 'distribution',
          userId: id,
          description: `${agent.username || 'Agent'} added${remarks ? ': ' + remarks : ''}`
        }
      })

      // Create deposit record for the user (so it shows in their add money history)
      await tx.deposit.create({
        data: {
          applyId: applyId,
          amount: amount,
          status: 'APPROVED',
          paymentMethod: `${agent.username || 'Agent'} Distribution`,
          transactionId: `${agent.username || 'Agent'} Agency Added`,
          remarks: remarks || null,
          userId: id,
          approvedAt: new Date()
        }
      })

      return updatedUser
    })

    // Get updated agent balance
    const updatedAgent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { walletBalance: true }
    })

    return c.json({
      message: `Successfully distributed $${amount.toFixed(2)} to ${result.username}`,
      user: {
        ...result,
        walletBalance: Number(result.walletBalance)
      },
      agentBalance: Number(updatedAgent?.walletBalance || 0)
    })
  } catch (error) {
    console.error('Distribute money error:', error)
    return c.json({ error: 'Failed to distribute money' }, 500)
  }
})

// POST /users/:id/remove-coupons - Admin removes coupons from user (does not return to anyone)
users.post('/:id/remove-coupons', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { amount } = await c.req.json()

    if (!amount || amount < 1) {
      return c.json({ error: 'Invalid coupon amount' }, 400)
    }

    // Get the target user
    const user = await prisma.user.findUnique({
      where: { id }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Check if user has enough coupons
    if (user.couponBalance < amount) {
      return c.json({
        error: `User only has ${user.couponBalance} coupon(s) available.`
      }, 400)
    }

    // Remove coupons from user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { couponBalance: { decrement: amount } },
      select: {
        id: true,
        username: true,
        email: true,
        couponBalance: true,
        role: true,
      }
    })

    return c.json({
      message: `Successfully removed ${amount} coupon(s) from ${updatedUser.username}`,
      user: updatedUser
    })
  } catch (error) {
    console.error('Remove coupons error:', error)
    return c.json({ error: 'Failed to remove coupons' }, 500)
  }
})

export default users
