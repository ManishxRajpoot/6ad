import { Hono } from 'hono'
import { prisma } from '@6ad/database'
import { verifyToken, requireAgent, requireAdmin } from '../middleware/auth.js'

const dashboard = new Hono()

dashboard.use('*', verifyToken)

// GET /dashboard/admin - Admin dashboard stats
dashboard.get('/admin', requireAdmin, async (c) => {
  try {
    // Get counts
    const [
      totalAgents,
      totalUsers,
      activeAgents,
      activeUsers,
      pendingDeposits,
      pendingWithdrawals,
      pendingRefunds,
      pendingAccounts
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'AGENT' } }),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'AGENT', status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
      prisma.deposit.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.refund.count({ where: { status: 'PENDING' } }),
      prisma.adAccount.count({ where: { status: 'PENDING' } }),
    ])

    // Get revenue stats
    const [totalDeposits, totalWithdrawals, totalRefunds] = await Promise.all([
      prisma.deposit.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      }),
      prisma.refund.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      })
    ])

    // Get platform-wise account stats
    const platformStats = await prisma.adAccount.groupBy({
      by: ['platform'],
      _count: true,
      _sum: { totalDeposit: true, totalSpend: true }
    })

    // Get top 5 agents by user count
    const topAgents = await prisma.user.findMany({
      where: { role: 'AGENT', status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        email: true,
        profileImage: true,
        walletBalance: true,
        _count: { select: { users: true } }
      },
      orderBy: { users: { _count: 'desc' } },
      take: 5
    })

    // Get recent transactions
    const recentDeposits = await prisma.deposit.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true, email: true } }
      }
    })

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "approvedAt") as month,
        SUM(amount) as total
      FROM deposits
      WHERE status = 'APPROVED'
        AND "approvedAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "approvedAt")
      ORDER BY month ASC
    `

    return c.json({
      stats: {
        totalAgents,
        totalUsers,
        activeAgents,
        activeUsers,
        pendingDeposits,
        pendingWithdrawals,
        pendingRefunds,
        pendingAccounts,
        totalRevenue: totalDeposits._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        totalRefunds: totalRefunds._sum.amount || 0,
      },
      platformStats,
      topAgents,
      recentDeposits,
      monthlyRevenue,
    })
  } catch (error) {
    console.error('Admin dashboard error:', error)
    return c.json({ error: 'Failed to get dashboard data' }, 500)
  }
})

// GET /dashboard/agent - Agent dashboard stats
dashboard.get('/agent', requireAgent, async (c) => {
  try {
    const agentId = c.get('userId')

    // Get counts for this agent's users
    const [
      totalUsers,
      activeUsers,
      totalAccounts,
      pendingAccounts
    ] = await Promise.all([
      prisma.user.count({ where: { agentId, role: 'USER' } }),
      prisma.user.count({ where: { agentId, role: 'USER', status: 'ACTIVE' } }),
      prisma.adAccount.count({ where: { user: { agentId } } }),
      prisma.adAccount.count({ where: { user: { agentId }, status: 'PENDING' } }),
    ])

    // Get wallet stats
    const walletStats = await prisma.user.aggregate({
      where: { agentId, role: 'USER' },
      _sum: { walletBalance: true }
    })

    // Get platform-wise stats for agent's users
    const platformStats = await prisma.adAccount.groupBy({
      by: ['platform'],
      where: { user: { agentId } },
      _count: true,
      _sum: { totalDeposit: true, totalSpend: true }
    })

    // Recent users
    const recentUsers = await prisma.user.findMany({
      where: { agentId, role: 'USER' },
      select: {
        id: true,
        username: true,
        email: true,
        profileImage: true,
        walletBalance: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    // Recent transactions from agent's users
    const recentDeposits = await prisma.deposit.findMany({
      where: { user: { agentId } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } }
      }
    })

    return c.json({
      stats: {
        totalUsers,
        activeUsers,
        totalAccounts,
        pendingAccounts,
        totalWalletBalance: walletStats._sum.walletBalance || 0,
      },
      platformStats,
      recentUsers,
      recentDeposits,
    })
  } catch (error) {
    console.error('Agent dashboard error:', error)
    return c.json({ error: 'Failed to get dashboard data' }, 500)
  }
})

// GET /dashboard/user - User dashboard stats
dashboard.get('/user', async (c) => {
  try {
    const userId = c.get('userId')

    // Get user with wallet
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletBalance: true,
      }
    })

    // Get account counts by platform
    const accountsByPlatform = await prisma.adAccount.groupBy({
      by: ['platform'],
      where: { userId },
      _count: true,
      _sum: { totalDeposit: true, balance: true }
    })

    // Get pending counts
    const [
      pendingDeposits,
      pendingWithdrawals,
      pendingAccounts
    ] = await Promise.all([
      prisma.deposit.count({ where: { userId, status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { userId, status: 'PENDING' } }),
      prisma.adAccount.count({ where: { userId, status: 'PENDING' } }),
    ])

    // Recent wallet activity
    const recentActivity = await prisma.walletFlow.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' }
    })

    // Recent accounts
    const recentAccounts = await prisma.adAccount.findMany({
      where: { userId },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    return c.json({
      walletBalance: user?.walletBalance || 0,
      accountsByPlatform,
      pending: {
        deposits: pendingDeposits,
        withdrawals: pendingWithdrawals,
        accounts: pendingAccounts,
      },
      recentActivity,
      recentAccounts,
    })
  } catch (error) {
    console.error('User dashboard error:', error)
    return c.json({ error: 'Failed to get dashboard data' }, 500)
  }
})

// GET /dashboard/reports/platform - Platform reports (Admin)
dashboard.get('/reports/platform', requireAdmin, async (c) => {
  try {
    const { startDate, endDate } = c.req.query()

    const dateFilter: any = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const platformStats = await Promise.all([
      prisma.adAccount.groupBy({
        by: ['platform'],
        _count: true,
        _sum: { totalDeposit: true, totalSpend: true, balance: true }
      }),
      prisma.adAccount.groupBy({
        by: ['platform', 'status'],
        _count: true
      })
    ])

    return c.json({
      summary: platformStats[0],
      byStatus: platformStats[1]
    })
  } catch (error) {
    console.error('Platform reports error:', error)
    return c.json({ error: 'Failed to get reports' }, 500)
  }
})

// GET /dashboard/reports/income - Income management report
dashboard.get('/reports/income', requireAdmin, async (c) => {
  try {
    const deposits = await prisma.deposit.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true
    })

    const withdrawals = await prisma.withdrawal.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true
    })

    const refunds = await prisma.refund.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true
    })

    // Get by agent
    const byAgent = await prisma.user.findMany({
      where: { role: 'AGENT' },
      select: {
        id: true,
        username: true,
        users: {
          select: {
            deposits: {
              where: { status: 'APPROVED' },
              select: { amount: true }
            }
          }
        }
      }
    })

    const agentRevenue = byAgent.map(agent => ({
      id: agent.id,
      username: agent.username,
      totalDeposits: agent.users.reduce((sum, user) =>
        sum + user.deposits.reduce((s, d) => s + Number(d.amount), 0), 0
      )
    }))

    return c.json({
      totals: {
        deposits: { count: deposits._count, amount: deposits._sum.amount || 0 },
        withdrawals: { count: withdrawals._count, amount: withdrawals._sum.amount || 0 },
        refunds: { count: refunds._count, amount: refunds._sum.amount || 0 },
      },
      byAgent: agentRevenue
    })
  } catch (error) {
    console.error('Income reports error:', error)
    return c.json({ error: 'Failed to get reports' }, 500)
  }
})

export default dashboard
