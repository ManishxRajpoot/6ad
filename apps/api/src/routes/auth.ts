import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import * as OTPAuth from 'otpauth'
import { sendEmail, getVerificationEmailTemplate, get2FADisabledEmailTemplate } from '../utils/email.js'

const prisma = new PrismaClient()
import { z } from 'zod'
import { verifyToken, generateToken } from '../middleware/auth.js'

// Generate a random base32 secret for 2FA
function generateSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

// Create TOTP instance for verification
function createTOTP(secret: string, email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: '6AD',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  })
}

// Verify TOTP token
function verifyTOTP(token: string, secret: string, email: string): boolean {
  const totp = createTOTP(secret, email)
  const delta = totp.validate({ token, window: 2 })
  console.log(`TOTP verify: token=${token}, delta=${delta}`)
  return delta !== null
}

const auth = new Hono()

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpCode: z.string().length(6).optional(),
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
    const { email, password, totpCode } = loginSchema.parse(body)

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        agent: {
          select: { id: true, username: true, email: true, brandLogo: true, brandName: true }
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
      return c.json({
        error: 'Account Blocked',
        message: 'Your account has been blocked by the administrator. Please contact the main headquarters for assistance.',
        blocked: true
      }, 403)
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      // If no TOTP code provided, return requires2FA flag
      if (!totpCode) {
        return c.json({
          requires2FA: true,
          message: 'Two-factor authentication required'
        }, 200)
      }

      // Verify TOTP code
      const isValidTotp = verifyTOTP(totpCode, user.twoFactorSecret, user.email)
      if (!isValidTotp) {
        return c.json({ error: 'Invalid verification code' }, 401)
      }
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
        twoFactorEnabled: true,
        emailVerified: true,
        agentId: true,
        brandLogo: true,
        brandName: true,
        agent: {
          select: { id: true, username: true, email: true, brandLogo: true, brandName: true }
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

// ============= TWO-FACTOR AUTHENTICATION =============

// POST /auth/2fa/setup - Generate 2FA secret and QR code
auth.post('/2fa/setup', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true, twoFactorSecret: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (user.twoFactorEnabled) {
      return c.json({ error: '2FA is already enabled' }, 400)
    }

    // Generate a new secret
    const secret = generateSecret()

    // Store the secret temporarily (not enabled yet until verified)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret }
    })

    // Generate otpauth URL for QR code using the library
    const totp = createTOTP(secret, user.email)
    const otpauthUrl = totp.toString()

    return c.json({
      secret,
      otpauthUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code'
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    return c.json({ error: 'Failed to setup 2FA' }, 500)
  }
})

// POST /auth/2fa/verify - Verify and enable 2FA
auth.post('/2fa/verify', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { code } = await c.req.json()

    if (!code || code.length !== 6) {
      return c.json({ error: 'Please provide a valid 6-digit code' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorSecret: true, twoFactorEnabled: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (user.twoFactorEnabled) {
      return c.json({ error: '2FA is already enabled' }, 400)
    }

    if (!user.twoFactorSecret) {
      return c.json({ error: 'Please setup 2FA first' }, 400)
    }

    // Verify the code
    console.log(`2FA verify attempt: code=${code}, secret=${user.twoFactorSecret}`)
    const isValid = verifyTOTP(code, user.twoFactorSecret, user.email)
    console.log(`2FA verify result: ${isValid}`)

    if (!isValid) {
      return c.json({ error: 'Invalid verification code. Please try a fresh code from your authenticator app.' }, 401)
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true }
    })

    return c.json({ message: 'Two-factor authentication enabled successfully' })
  } catch (error) {
    console.error('2FA verify error:', error)
    return c.json({ error: 'Failed to verify 2FA' }, 500)
  }
})

// POST /auth/2fa/disable - Disable 2FA
auth.post('/2fa/disable', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { code, password } = await c.req.json()

    if (!password) {
      return c.json({ error: 'Password is required to disable 2FA' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (!user.twoFactorEnabled) {
      return c.json({ error: '2FA is not enabled' }, 400)
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid password' }, 401)
    }

    // Optionally verify 2FA code if provided
    if (code && user.twoFactorSecret) {
      const isValidCode = verifyTOTP(code, user.twoFactorSecret, user.email)
      if (!isValidCode) {
        return c.json({ error: 'Invalid 2FA code' }, 401)
      }
    }

    // Disable 2FA and clear secret
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    })

    return c.json({ message: 'Two-factor authentication disabled successfully' })
  } catch (error) {
    console.error('2FA disable error:', error)
    return c.json({ error: 'Failed to disable 2FA' }, 500)
  }
})

// GET /auth/2fa/status - Get 2FA status
auth.get('/2fa/status', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json({ enabled: user.twoFactorEnabled })
  } catch (error) {
    console.error('2FA status error:', error)
    return c.json({ error: 'Failed to get 2FA status' }, 500)
  }
})

// ============= EMAIL VERIFICATION =============

// Generate a random 6-digit verification code
function generateEmailCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /auth/email/send-code - Send email verification code
auth.post('/email/send-code', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true, emailVerified: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (user.emailVerified) {
      return c.json({ error: 'Email is already verified' }, 400)
    }

    // Generate verification code
    const code = generateEmailCode()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store the code
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyToken: code,
        emailVerifyExpiry: expiry
      }
    })

    // Send verification email
    const emailTemplate = getVerificationEmailTemplate(code, user.username)
    const emailSent = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })

    if (!emailSent) {
      console.error(`Failed to send verification email to ${user.email}`)
      // Still return success - code is stored and user can try again
    }

    console.log(`Email verification code for ${user.email}: ${code}`)

    return c.json({
      message: 'Verification code sent to your email'
    })
  } catch (error) {
    console.error('Send email code error:', error)
    return c.json({ error: 'Failed to send verification code' }, 500)
  }
})

// POST /auth/email/verify - Verify email with code
auth.post('/email/verify', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { code } = await c.req.json()

    if (!code || code.length !== 6) {
      return c.json({ error: 'Please provide a valid 6-digit code' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, emailVerifyToken: true, emailVerifyExpiry: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (user.emailVerified) {
      return c.json({ error: 'Email is already verified' }, 400)
    }

    if (!user.emailVerifyToken || !user.emailVerifyExpiry) {
      return c.json({ error: 'Please request a verification code first' }, 400)
    }

    // Check if code is expired
    if (new Date() > user.emailVerifyExpiry) {
      return c.json({ error: 'Verification code has expired. Please request a new one.' }, 400)
    }

    // Verify the code
    if (code !== user.emailVerifyToken) {
      return c.json({ error: 'Invalid verification code' }, 401)
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null
      }
    })

    return c.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Verify email error:', error)
    return c.json({ error: 'Failed to verify email' }, 500)
  }
})

export default auth
