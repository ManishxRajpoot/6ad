import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { prisma } from '@6ad/database'
import { z } from 'zod'
import { verifyToken, generateToken } from '../middleware/auth.js'

const auth = new Hono()

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2),
  phone: z.string().optional(),
})

// POST /auth/login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = loginSchema.parse(body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        agent: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Check if blocked
    if (user.status === 'BLOCKED') {
      return c.json({ error: 'Your account has been blocked' }, 403)
    }

    // Get modules for this role
    const modules = await prisma.module.findMany({
      where: { role: user.role, isActive: true },
      orderBy: { priority: 'asc' }
    })

    // Generate token
    const token = generateToken(user)

    // Return user data (excluding password)
    const { password: _, ...userData } = user

    return c.json({
      token,
      user: userData,
      modules,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// POST /auth/register (for user self-registration)
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, username, phone } = registerSchema.parse(body)

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        phone,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      }
    })

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, role: user.role })

    return c.json({
      message: 'Registration successful',
      token,
      user,
    }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid input', details: error.errors }, 400)
    }
    console.error('Register error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// GET /auth/me - Get current user
auth.get('/me', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        role: true,
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
        twoFactorEnabled: true,
        agentId: true,
        agent: {
          select: { id: true, username: true, email: true }
        },
        createdAt: true,
        updatedAt: true,
      }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Get modules
    const modules = await prisma.module.findMany({
      where: { role: user.role, isActive: true },
      orderBy: { priority: 'asc' }
    })

    return c.json({ user, modules })
  } catch (error) {
    console.error('Get me error:', error)
    return c.json({ error: 'Failed to get user data' }, 500)
  }
})

// POST /auth/change-password
auth.post('/change-password', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { currentPassword, newPassword } = await c.req.json()

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return c.json({ error: 'Invalid input' }, 400)
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return c.json({ error: 'Current password is incorrect' }, 401)
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    return c.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json({ error: 'Failed to change password' }, 500)
  }
})

export default auth
