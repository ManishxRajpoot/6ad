import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAgent } from '../middleware/auth.js'

const prisma = new PrismaClient()
const bmAdRequest = new Hono()

bmAdRequest.use('*', verifyToken)

// GET /bm-ad-request/stats - Get BM & AD request stats for agent
bmAdRequest.get('/stats', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')

    // Get all users under this agent
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    // Total Applications = Total ad accounts opened by agent's users (all time)
    const totalAdAccounts = await prisma.adAccount.count({
      where: {
        userId: { in: userIds }
      }
    })

    // Total Approved Requests = Total approved ad account recharges (all time)
    const totalApprovedRecharges = await prisma.accountDeposit.count({
      where: {
        adAccount: { userId: { in: userIds } },
        status: 'APPROVED'
      }
    })

    // Total Pending Requests = All pending requests (ad account opening + ad account recharge + wallet recharge)
    const [pendingApplications, pendingRecharges, pendingWalletDeposits] = await Promise.all([
      prisma.adAccountApplication.count({
        where: {
          userId: { in: userIds },
          status: 'PENDING'
        }
      }),
      prisma.accountDeposit.count({
        where: {
          adAccount: { userId: { in: userIds } },
          status: 'PENDING'
        }
      }),
      prisma.deposit.count({
        where: {
          userId: { in: userIds },
          status: 'PENDING'
        }
      })
    ])
    const totalPendingRequests = pendingApplications + pendingRecharges + pendingWalletDeposits

    // Total Rejected Requests = All rejected requests (all time)
    const [rejectedApplications, rejectedRecharges, rejectedWalletDeposits] = await Promise.all([
      prisma.adAccountApplication.count({
        where: {
          userId: { in: userIds },
          status: 'REJECTED'
        }
      }),
      prisma.accountDeposit.count({
        where: {
          adAccount: { userId: { in: userIds } },
          status: 'REJECTED'
        }
      }),
      prisma.deposit.count({
        where: {
          userId: { in: userIds },
          status: 'REJECTED'
        }
      })
    ])
    const totalRejectedRequests = rejectedApplications + rejectedRecharges + rejectedWalletDeposits

    return c.json({
      totalAdAccounts,
      totalApprovedRecharges,
      totalPendingRequests,
      totalRejectedRequests
    })
  } catch (error) {
    console.error('Get BM & AD request stats error:', error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

// GET /bm-ad-request/applications - Get ad account applications for agent's users
bmAdRequest.get('/applications', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { page = '1', limit = '20', status, platform, search } = c.req.query()

    // Get all users under this agent
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    const where: any = { userId: { in: userIds } }
    if (status) where.status = status.toUpperCase()
    if (platform) where.platform = platform.toUpperCase()
    if (search) {
      where.OR = [
        { accountName: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [applications, total] = await Promise.all([
      prisma.adAccountApplication.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.adAccountApplication.count({ where })
    ])

    return c.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get applications error:', error)
    return c.json({ error: 'Failed to get applications' }, 500)
  }
})

// GET /bm-ad-request/applications/:id - Get single application details
bmAdRequest.get('/applications/:id', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { id } = c.req.param()

    // Get all users under this agent
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    const application = await prisma.adAccountApplication.findFirst({
      where: {
        id,
        userId: { in: userIds }
      },
      include: {
        user: { select: { id: true, username: true, email: true, realName: true } }
      }
    })

    if (!application) {
      return c.json({ error: 'Application not found' }, 404)
    }

    return c.json({ application })
  } catch (error) {
    console.error('Get application details error:', error)
    return c.json({ error: 'Failed to get application details' }, 500)
  }
})

// GET /bm-ad-request/bm-shares - Get BM share requests for agent's users
bmAdRequest.get('/bm-shares', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')
    const { page = '1', limit = '20', status, platform, search } = c.req.query()

    // Get all users under this agent
    const agentUsers = await prisma.user.findMany({
      where: { agentId },
      select: { id: true }
    })
    const userIds = agentUsers.map(u => u.id)

    const where: any = { userId: { in: userIds } }
    if (status) where.status = status.toUpperCase()
    if (platform) where.platform = platform.toUpperCase()
    if (search) {
      where.OR = [
        { bmId: { contains: search, mode: 'insensitive' } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [bmShares, total] = await Promise.all([
      prisma.bmShareRequest.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.bmShareRequest.count({ where })
    ])

    return c.json({
      bmShares,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get BM shares error:', error)
    return c.json({ error: 'Failed to get BM shares' }, 500)
  }
})

export default bmAdRequest
