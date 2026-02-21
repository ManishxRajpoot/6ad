import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import * as OTPAuth from 'otpauth'
import { sendEmail, getVerificationEmailTemplate, get2FADisabledEmailTemplate, get2FALoginEmailTemplate, buildSmtpConfig, getWelcomeEmailTemplate, getPasswordResetEmailTemplate } from '../utils/email.js'
import crypto from 'crypto'

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

// Generate secure password reset token
function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Get frontend URL for password reset (supports whitelabel domains)
function getPasswordResetUrl(token: string, customDomain?: string | null): string {
  // If agent has a custom whitelabel domain, use it
  if (customDomain) {
    // Ensure domain has https:// prefix
    const domain = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`
    return `${domain}/reset-password?token=${token}`
  }
  // Default to main platform URL
  const baseUrl = process.env.FRONTEND_URL || 'https://6ad.in'
  return `${baseUrl}/reset-password?token=${token}`
}

// Helper to get agent's approved custom domain
async function getAgentCustomDomain(agentId: string | null): Promise<string | null> {
  if (!agentId) return null

  const customDomain = await prisma.customDomain.findFirst({
    where: {
      agentId,
      status: 'APPROVED'
    },
    select: { domain: true }
  })

  return customDomain?.domain || null
}

const auth = new Hono()

// Mask email for privacy: "john@gmail.com" → "j***n@gmail.com"
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  if (local.length <= 2) return `${local[0]}***@${domain}`
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 3))}${local[local.length - 1]}@${domain}`
}

// Validation schemas
const loginSchema = z.object({
  email: z.string().min(1), // Can be email or username
  password: z.string().min(6),
  totpCode: z.string().length(6).optional(),
  emailOtp: z.string().length(6).optional(),
  rememberMe: z.boolean().optional(),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(2),
  phone: z.string().optional(),
  referralCode: z.string().optional(),
})

// GET /auth/check-username - Check if username is available
auth.get('/check-username', async (c) => {
  try {
    const { username } = c.req.query()

    if (!username || username.length < 2) {
      return c.json({ available: false, error: 'Username must be at least 2 characters' })
    }

    const existingUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    })

    return c.json({ available: !existingUser })
  } catch (error) {
    console.error('Check username error:', error)
    return c.json({ available: false, error: 'Failed to check username' }, 500)
  }
})

// GET /auth/referrer-info - Get referrer info by referral code (for registration page)
auth.get('/referrer-info', async (c) => {
  try {
    const { code } = c.req.query()

    if (!code) {
      return c.json({ found: false })
    }

    // Find the referrer by referral code
    const referrer = await prisma.user.findFirst({
      where: { referralCode: code.toUpperCase() },
      select: {
        id: true,
        username: true,
        agentId: true,
        agent: {
          select: {
            id: true,
            brandName: true,
            username: true
          }
        }
      }
    })

    if (!referrer) {
      return c.json({ found: false })
    }

    // Determine the username prefix based on agent's username (not brand name)
    let usernamePrefix = ''
    if (referrer.agent) {
      // Referrer has an agent - use agent's username as prefix
      usernamePrefix = (referrer.agent.username || '').replace(/\s+/g, '') + '_'
    } else if (referrer.agentId) {
      // Referrer is assigned to an agent but agent info not loaded
      const agent = await prisma.user.findUnique({
        where: { id: referrer.agentId },
        select: { username: true }
      })
      if (agent) {
        usernamePrefix = (agent.username || '').replace(/\s+/g, '') + '_'
      }
    }

    return c.json({
      found: true,
      referrerUsername: referrer.username,
      usernamePrefix,
      agentId: referrer.agentId || referrer.agent?.id
    })
  } catch (error) {
    console.error('Get referrer info error:', error)
    return c.json({ found: false, error: 'Failed to get referrer info' }, 500)
  }
})

// POST /auth/login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email: emailOrUsername, password, totpCode, emailOtp, rememberMe } = loginSchema.parse(body)

    // Find user by email or username (case-insensitive)
    const isEmail = emailOrUsername.includes('@')
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: emailOrUsername, mode: 'insensitive' } }
        : { username: { equals: emailOrUsername, mode: 'insensitive' } },
      include: {
        agent: {
          select: { id: true, username: true, email: true, brandLogo: true, brandName: true }
        }
      }
    })

    if (!user) {
      return c.json({ error: 'Account not found. Please check your email/username or contact support.' }, 401)
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid email/username or password' }, 401)
    }

    // Check if blocked
    if (user.status === 'BLOCKED') {
      return c.json({
        error: 'Account Blocked',
        message: 'Your account has been blocked. Please contact support group for assistance. Thank you.',
        blocked: true
      }, 403)
    }

    // Check if 2FA is enabled (skip if rememberMe is checked - trusted device)
    if (user.twoFactorEnabled && user.twoFactorSecret && !rememberMe) {
      // If no TOTP code and no email OTP provided, return requires2FA flag
      if (!totpCode && !emailOtp) {
        return c.json({
          requires2FA: true,
          maskedEmail: maskEmail(user.email),
          message: 'Two-factor authentication required'
        }, 200)
      }

      // Verify via email OTP if provided
      if (emailOtp) {
        if (!user.twoFactorEmailCode || !user.twoFactorEmailExpiry) {
          return c.json({ error: 'No email code requested. Please request a code first.' }, 401)
        }
        if (new Date() > new Date(user.twoFactorEmailExpiry)) {
          return c.json({ error: 'Email code has expired. Please request a new one.' }, 401)
        }
        if (user.twoFactorEmailCode !== emailOtp) {
          return c.json({ error: 'Invalid email verification code' }, 401)
        }
        // Clear the used code
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorEmailCode: null, twoFactorEmailExpiry: null }
        })
      } else if (totpCode) {
        // Verify TOTP code
        const isValidTotp = verifyTOTP(totpCode, user.twoFactorSecret, user.email)
        if (!isValidTotp) {
          return c.json({ error: 'Invalid verification code' }, 401)
        }
      }
    }

    // Get modules for this role
    const modules = await prisma.module.findMany({
      where: { role: user.role, isActive: true },
      orderBy: { priority: 'asc' }
    })

    // Generate token (24hr default, 72hr if rememberMe)
    const token = generateToken(user, !!rememberMe)

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
    const { email, password, username, phone, referralCode } = registerSchema.parse(body)

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()

    // Check if email exists (case-insensitive)
    const existingEmail = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    })

    if (existingEmail) {
      return c.json({ error: 'Email already registered' }, 409)
    }

    // Check if username exists
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    })

    if (existingUsername) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    // Handle referral code if provided
    let referrerId: string | null = null
    let agentId: string | null = null

    if (referralCode) {
      const referrer = await prisma.user.findFirst({
        where: { referralCode: referralCode.toUpperCase() },
        select: { id: true, agentId: true }
      })

      if (referrer) {
        referrerId = referrer.id
        agentId = referrer.agentId // Inherit agent from referrer
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate password reset token for welcome email
    const passwordResetToken = generatePasswordResetToken()

    // Get agent info for branding and custom domain if user has an agent
    let agentBrandInfo: { brandLogo?: string | null; emailLogo?: string | null; username?: string | null } = {}
    let agentCustomDomain: string | null = null
    if (agentId) {
      const agentData = await prisma.user.findUnique({
        where: { id: agentId },
        select: { brandLogo: true, emailLogo: true, username: true }
      })
      if (agentData) {
        agentBrandInfo = agentData
      }
      // Get agent's whitelabel domain
      agentCustomDomain = await getAgentCustomDomain(agentId)
    }

    // Create user with referral info
    // If referred, give $50 opening balance and 5% deposit fee for all platforms
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        plaintextPassword: password,
        username,
        phone,
        role: 'USER',
        referredBy: referrerId,
        agentId: agentId,
        passwordResetToken,
        requirePasswordChange: true, // Force password change on first login
        // Referral benefits: $50 opening balance and 5% deposit fee for all platforms
        ...(referrerId ? {
          walletBalance: 50,
          openingFee: 50,
          fbFee: 5,
          googleFee: 5,
          tiktokFee: 5,
          snapchatFee: 5,
          bingFee: 5,
        } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      }
    })

    // Create referral record if referrer exists
    if (referrerId && referralCode) {
      await prisma.referral.create({
        data: {
          referrerId: referrerId,
          referredUserId: user.id,
          referralCode: referralCode.toUpperCase(),
          status: 'pending'
        }
      })
    }

    // Send welcome email with password reset link (uses agent's whitelabel domain if available)
    const passwordResetLink = getPasswordResetUrl(passwordResetToken, agentCustomDomain)
    const welcomeEmail = getWelcomeEmailTemplate({
      username,
      email: normalizedEmail,
      passwordResetLink,
      agentLogo: agentBrandInfo.emailLogo || agentBrandInfo.brandLogo,
      agentBrandName: agentBrandInfo.username
    })
    sendEmail({ to: normalizedEmail, ...welcomeEmail }).catch(console.error)

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
        fbUnlimitedDomainFee: true,
        googleUnlimitedDomainFee: true,
        tiktokUnlimitedDomainFee: true,
        snapchatUnlimitedDomainFee: true,
        bingUnlimitedDomainFee: true,
        twoFactorEnabled: true,
        emailVerified: true,
        requirePasswordChange: true,
        agentId: true,
        brandLogo: true,
        brandName: true,
        agent: {
          select: { id: true, username: true, email: true, brandLogo: true, brandName: true, favicon: true }
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
      data: { password: hashedPassword, plaintextPassword: newPassword }
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

// POST /auth/2fa/send-email-code - Send email OTP for 2FA login (no auth token required)
// Single DB query upfront (user + agent), then fire-and-forget email — NO db calls in background
auth.post('/2fa/send-email-code', async (c) => {
  try {
    const body = await c.req.json()
    const { email: emailOrUsername, password } = body

    if (!emailOrUsername || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }

    // Single query: user + agent + agent SMTP — everything needed in one shot
    const isEmail = emailOrUsername.includes('@')
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: emailOrUsername, mode: 'insensitive' } }
        : { username: { equals: emailOrUsername, mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        password: true,
        username: true,
        twoFactorEnabled: true,
        twoFactorEmailSentAt: true,
        agent: {
          select: {
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
          }
        }
      }
    })

    if (!user || !user.twoFactorEnabled) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Rate limit: 60s between sends
    if (user.twoFactorEmailSentAt) {
      const timeSinceLastSend = Date.now() - new Date(user.twoFactorEmailSentAt).getTime()
      if (timeSinceLastSend < 60000) {
        const waitSeconds = Math.ceil((60000 - timeSinceLastSend) / 1000)
        return c.json({ error: `Please wait ${waitSeconds} seconds before requesting a new code` }, 429)
      }
    }

    // Generate code
    const code = generateEmailCode()
    const expiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Prepare everything for email BEFORE any DB/SMTP calls
    const agentLogo = user.agent?.emailLogo || user.agent?.brandLogo || null
    const agentBrandName = user.agent?.username || null
    const senderName = user.agent?.emailSenderNameApproved || undefined
    const smtpConfig = buildSmtpConfig(user.agent)
    const emailTemplate = get2FALoginEmailTemplate(code, user.username, agentLogo, agentBrandName)
    const maskedEmailResult = maskEmail(user.email)
    const userEmail = user.email

    // Fire BOTH in parallel: DB update + email send at the same time
    // DB update stores the code, email send delivers it — neither depends on the other
    const dbUpdatePromise = prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEmailCode: code,
        twoFactorEmailExpiry: expiry,
        twoFactorEmailSentAt: new Date()
      }
    })

    // Start email send immediately — don't wait for DB update
    sendEmail({
      to: userEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      senderName,
      smtpConfig
    }).then((sent) => {
      if (sent) {
        console.log(`[2FA-EMAIL] Sent to ${userEmail}`)
      } else {
        console.error(`[2FA-EMAIL] Failed: ${userEmail}`)
      }
    }).catch((err) => {
      console.error(`[2FA-EMAIL] Error: ${userEmail}`, err)
    })

    // Wait for DB update before responding (code must be stored)
    await dbUpdatePromise

    return c.json({
      message: 'Verification code sent to your email',
      maskedEmail: maskedEmailResult
    })
  } catch (error) {
    console.error('Send 2FA email code error:', error)
    return c.json({ error: 'Failed to send verification code' }, 500)
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
      select: {
        email: true,
        username: true,
        emailVerified: true,
        agent: {
          select: {
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

    // Send verification email - Use approved domain logo if available
    const approvedDomainLogo = user.agent?.customDomains?.[0]?.brandLogo
    const agentLogo = user.agent?.customDomains?.[0]?.emailLogo || approvedDomainLogo || user.agent?.emailLogo || user.agent?.brandLogo || null
    const agentBrandName = user.agent?.username || null
    const emailTemplate = getVerificationEmailTemplate(code, user.username, agentLogo, agentBrandName)

    const emailSent = await sendEmail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      senderName: user.agent?.emailSenderNameApproved || undefined,
      smtpConfig: buildSmtpConfig(user.agent)
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

// POST /auth/email/send-change-code - Send code to new email for email change
auth.post('/email/send-change-code', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { newEmail } = await c.req.json()

    if (!newEmail || !newEmail.includes('@')) {
      return c.json({ error: 'Please provide a valid email address' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerified: true,
        username: true,
        agentId: true,
        agent: {
          select: {
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
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (!user.emailVerified) {
      return c.json({ error: 'Please verify your current email first' }, 400)
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return c.json({ error: 'New email must be different from current email' }, 400)
    }

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() }
    })

    if (existingUser) {
      return c.json({ error: 'This email is already in use' }, 400)
    }

    // Generate 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Store the pending email and code
    await prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: newEmail.toLowerCase(),
        emailVerifyToken: verificationCode,
        emailVerifyExpiry: expiryTime
      }
    })

    // Get branding info
    const approvedDomainLogo = user.agent?.customDomains?.[0]?.brandLogo
    const agentLogo = user.agent?.customDomains?.[0]?.emailLogo || approvedDomainLogo || user.agent?.emailLogo || user.agent?.brandLogo || null
    const agentBrandName = user.agent?.username || null

    // Send verification email to the NEW email
    const { getVerificationEmailTemplate, sendEmail, buildSmtpConfig } = await import('../utils/email.js')
    const emailTemplate = getVerificationEmailTemplate(verificationCode, user.username, agentLogo, agentBrandName)

    await sendEmail({
      to: newEmail,
      subject: 'Verify Your New Email Address',
      html: emailTemplate.html,
      senderName: user.agent?.emailSenderNameApproved || undefined,
      smtpConfig: buildSmtpConfig(user.agent)
    })

    return c.json({ message: 'Verification code sent to new email' })
  } catch (error) {
    console.error('Send email change code error:', error)
    return c.json({ error: 'Failed to send verification code' }, 500)
  }
})

// POST /auth/email/verify-change - Verify code and change email
auth.post('/email/verify-change', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { newEmail, code } = await c.req.json()

    if (!code || code.length !== 6) {
      return c.json({ error: 'Please provide a valid 6-digit code' }, 400)
    }

    if (!newEmail) {
      return c.json({ error: 'Please provide the new email address' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pendingEmail: true,
        emailVerifyToken: true,
        emailVerifyExpiry: true
      }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    if (!user.pendingEmail || !user.emailVerifyToken || !user.emailVerifyExpiry) {
      return c.json({ error: 'Please request a verification code first' }, 400)
    }

    // Verify the pending email matches
    if (user.pendingEmail.toLowerCase() !== newEmail.toLowerCase()) {
      return c.json({ error: 'Email mismatch. Please request a new code.' }, 400)
    }

    // Check if code is expired
    if (new Date() > user.emailVerifyExpiry) {
      return c.json({ error: 'Verification code has expired. Please request a new one.' }, 400)
    }

    // Verify the code
    if (code !== user.emailVerifyToken) {
      return c.json({ error: 'Invalid verification code' }, 401)
    }

    // Update email
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
        emailVerified: true // Keep verified status since they verified the new email
      }
    })

    return c.json({ message: 'Email changed successfully' })
  } catch (error) {
    console.error('Verify email change error:', error)
    return c.json({ error: 'Failed to change email' }, 500)
  }
})

// =====================================================
// PASSWORD RESET ENDPOINTS
// =====================================================

// POST /auth/password/forgot - Request password reset email
auth.post('/password/forgot', async (c) => {
  try {
    const { email } = await c.req.json()

    if (!email) {
      return c.json({ error: 'Email is required' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        agent: {
          select: { id: true, brandLogo: true, emailLogo: true, username: true }
        }
      }
    })

    if (!user) {
      // Return success even if user doesn't exist (security best practice)
      return c.json({ message: 'If this email exists, a password reset link has been sent' })
    }

    // Generate password reset token
    const passwordResetToken = generatePasswordResetToken()

    // Update user with reset token (no expiry - expires on first use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpiry: null // No expiry, invalidated on use
      }
    })

    // Get agent's whitelabel domain if user has an agent
    const agentCustomDomain = await getAgentCustomDomain(user.agentId)

    // Send password reset email (uses agent's whitelabel domain if available)
    const passwordResetLink = getPasswordResetUrl(passwordResetToken, agentCustomDomain)
    const resetEmail = getPasswordResetEmailTemplate({
      username: user.username,
      passwordResetLink,
      agentLogo: user.agent?.emailLogo || user.agent?.brandLogo,
      agentBrandName: user.agent?.username
    })
    sendEmail({ to: user.email, ...resetEmail }).catch(console.error)

    return c.json({ message: 'If this email exists, a password reset link has been sent' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return c.json({ error: 'Failed to process request' }, 500)
  }
})

// GET /auth/password/verify-token - Verify password reset token is valid
auth.get('/password/verify-token', async (c) => {
  try {
    const { token } = c.req.query()

    if (!token) {
      return c.json({ valid: false, error: 'Token is required' }, 400)
    }

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
      select: { id: true, username: true, email: true }
    })

    if (!user) {
      return c.json({ valid: false, error: 'Invalid or expired token' }, 400)
    }

    return c.json({ valid: true, username: user.username })
  } catch (error) {
    console.error('Verify token error:', error)
    return c.json({ valid: false, error: 'Failed to verify token' }, 500)
  }
})

// POST /auth/password/reset - Reset password using token
auth.post('/password/reset', async (c) => {
  try {
    const { token, newPassword } = await c.req.json()

    if (!token) {
      return c.json({ error: 'Token is required' }, 400)
    }

    if (!newPassword || newPassword.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400)
    }

    // Find user with this token
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token }
    })

    if (!user) {
      return c.json({ error: 'Invalid or expired token. Please request a new password reset link.' }, 400)
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password and clear the token (one-time use)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        plaintextPassword: newPassword,
        passwordResetToken: null, // Invalidate token after use
        passwordResetExpiry: null,
        requirePasswordChange: false // User has set their password
      }
    })

    return c.json({ message: 'Password reset successful. You can now log in with your new password.' })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({ error: 'Failed to reset password' }, 500)
  }
})

// POST /auth/password/change - Change password (for logged in users who need to set strong password)
auth.post('/password/change', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { currentPassword, newPassword } = await c.req.json()

    if (!newPassword || newPassword.length < 8) {
      return c.json({ error: 'New password must be at least 8 characters' }, 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // If user has requirePasswordChange flag, they don't need to provide current password
    if (!user.requirePasswordChange) {
      if (!currentPassword) {
        return c.json({ error: 'Current password is required' }, 400)
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        return c.json({ error: 'Current password is incorrect' }, 401)
      }
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        plaintextPassword: newPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        requirePasswordChange: false // User has set their password
      }
    })

    return c.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    return c.json({ error: 'Failed to change password' }, 500)
  }
})

export default auth
