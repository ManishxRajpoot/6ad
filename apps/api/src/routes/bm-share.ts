import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { verifyToken, requireUser, requireAdmin } from '../middleware/auth.js'

const prisma = new PrismaClient()
const bmShare = new Hono()

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

// POST /bm-share - Create BM share request (User)
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

    const bmShareRequest = await prisma.bmShareRequest.create({
      data: {
        applyId,
        platform: data.platform,
        adAccountId: data.adAccountId,
        adAccountName: data.adAccountName,
        bmId: data.bmId,
        message: data.message,
        userId,
      },
      include: {
        user: {
          select: { id: true, username: true, email: true }
        }
      }
    })

    return c.json({
      message: 'BM share request submitted successfully',
      bmShareRequest
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
bmShare.post('/:id/approve', requireAdmin, async (c) => {
  try {
    const { id } = c.req.param()
    const { adminRemarks } = await c.req.json().catch(() => ({}))

    const request = await prisma.bmShareRequest.findUnique({ where: { id } })

    if (!request) {
      return c.json({ error: 'BM share request not found' }, 404)
    }

    if (request.status !== 'PENDING') {
      return c.json({ error: 'Request already processed' }, 400)
    }

    await prisma.bmShareRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        adminRemarks,
        approvedAt: new Date()
      }
    })

    return c.json({ message: 'BM share request approved' })
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

    const request = await prisma.bmShareRequest.findUnique({ where: { id } })

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

    return c.json({ message: 'BM share request rejected' })
  } catch (error) {
    console.error('Reject BM share request error:', error)
    return c.json({ error: 'Failed to reject request' }, 500)
  }
})

export default bmShare
