import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, verifyAdmin } from '../middleware/auth'

const referrals = new Hono()

// Generate unique referral code
function generateReferralCode(username: string): string {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const userPart = username.substring(0, 3).toUpperCase()
  return `${userPart}${randomPart}`
}

// GET /referrals/my-code - Get or create user's referral code
referrals.get('/my-code', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, referralCode: true, referralEarnings: true }
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Generate referral code if not exists
    if (!user.referralCode) {
      const referralCode = generateReferralCode(user.username)
      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode },
        select: { id: true, username: true, referralCode: true, referralEarnings: true }
      })
    }

    return c.json({
      referralCode: user.referralCode,
      referralEarnings: user.referralEarnings
    })
  } catch (error) {
    console.error('Get referral code error:', error)
    return c.json({ error: 'Failed to get referral code' }, 500)
  }
})

// GET /referrals/stats - Get referral statistics
referrals.get('/stats', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')

    const [user, referralsList] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true, referralEarnings: true }
      }),
      prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' }
      })
    ])

    const totalReferrals = referralsList.length
    const qualifiedReferrals = referralsList.filter(r => r.status === 'qualified' || r.status === 'rewarded').length
    const pendingRewards = referralsList.filter(r => r.status === 'qualified' && !r.rewardPaid).reduce((sum, r) => sum + r.rewardAmount, 0)
    const totalEarned = user?.referralEarnings || 0

    return c.json({
      referralCode: user?.referralCode,
      stats: {
        totalReferrals,
        qualifiedReferrals,
        pendingRewards,
        totalEarned
      },
      referrals: referralsList
    })
  } catch (error) {
    console.error('Get referral stats error:', error)
    return c.json({ error: 'Failed to get referral stats' }, 500)
  }
})

// POST /referrals/validate - Validate a referral code (used during signup)
referrals.post('/validate', async (c) => {
  try {
    const { code } = await c.req.json()

    if (!code) {
      return c.json({ valid: false, error: 'No code provided' })
    }

    const referrer = await prisma.user.findFirst({
      where: { referralCode: code.toUpperCase() },
      select: { id: true, username: true }
    })

    if (!referrer) {
      return c.json({ valid: false, error: 'Invalid referral code' })
    }

    return c.json({ valid: true, referrerName: referrer.username })
  } catch (error) {
    console.error('Validate referral code error:', error)
    return c.json({ valid: false, error: 'Failed to validate code' }, 500)
  }
})

// POST /referrals/apply - Apply referral code for new user (internal use)
referrals.post('/apply', verifyToken, async (c) => {
  try {
    const userId = c.get('userId')
    const { code } = await c.req.json()

    if (!code) {
      return c.json({ error: 'No referral code provided' }, 400)
    }

    // Check if user already has a referrer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referredBy: true }
    })

    if (user?.referredBy) {
      return c.json({ error: 'You have already used a referral code' }, 400)
    }

    // Find referrer
    const referrer = await prisma.user.findFirst({
      where: { referralCode: code.toUpperCase() }
    })

    if (!referrer) {
      return c.json({ error: 'Invalid referral code' }, 400)
    }

    if (referrer.id === userId) {
      return c.json({ error: 'You cannot use your own referral code' }, 400)
    }

    // Create referral record and update user
    await prisma.$transaction([
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredUserId: userId,
          referralCode: code.toUpperCase(),
          status: 'pending'
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { referredBy: referrer.id }
      })
    ])

    return c.json({ success: true, message: 'Referral code applied successfully' })
  } catch (error) {
    console.error('Apply referral code error:', error)
    return c.json({ error: 'Failed to apply referral code' }, 500)
  }
})

// ============= ADMIN ENDPOINTS =============

// GET /referrals/admin - Get all referrals (admin only)
referrals.get('/admin', verifyToken, verifyAdmin, async (c) => {
  try {
    const referralsList = await prisma.referral.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: {
          select: { id: true, username: true, email: true }
        },
        referredUser: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    return c.json({ referrals: referralsList })
  } catch (error) {
    console.error('Get admin referrals error:', error)
    return c.json({ error: 'Failed to get referrals' }, 500)
  }
})

export default referrals
