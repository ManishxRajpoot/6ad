import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
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

    // Monthly revenue (last 12 months) - MongoDB compatible
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const approvedDepositsForRevenue = await prisma.deposit.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: twelveMonthsAgo }
      },
      select: {
        amount: true,
        approvedAt: true
      }
    })

    // Group by month manually
    const monthlyRevenueMap = new Map<string, number>()
    approvedDepositsForRevenue.forEach(deposit => {
      if (deposit.approvedAt) {
        const monthKey = `${deposit.approvedAt.getFullYear()}-${String(deposit.approvedAt.getMonth() + 1).padStart(2, '0')}`
        const current = monthlyRevenueMap.get(monthKey) || 0
        monthlyRevenueMap.set(monthKey, current + Number(deposit.amount || 0))
      }
    })

    // Convert to sorted array
    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month))

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
    const { period = 'today' } = c.req.query()
    console.log('Agent dashboard - agentId:', agentId, 'period:', period)

    // Get agent's coupon balance
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { couponBalance: true }
    })
    const availableCoupons = agent?.couponBalance || 0

    // Get all users for this agent to calculate total balance
    const agentUsers = await prisma.user.findMany({
      where: { agentId, role: 'USER' },
      select: { id: true, walletBalance: true, status: true }
    })
    console.log('Agent dashboard - found users:', agentUsers.length, agentUsers)

    // Calculate totals from users
    const totalUsers = agentUsers.length
    const activeUsers = agentUsers.filter(u => u.status === 'ACTIVE').length
    const blockedUsers = agentUsers.filter(u => u.status === 'BLOCKED').length
    const totalWalletBalance = agentUsers.reduce((sum, u) => sum + Number(u.walletBalance || 0), 0)
    console.log('Agent dashboard - totalWalletBalance:', totalWalletBalance)

    // Get counts for accounts (all ad accounts of agent's users)
    const [
      totalAccounts,
      pendingApplications
    ] = await Promise.all([
      prisma.adAccount.count({ where: { user: { agentId } } }),
      prisma.adAccountApplication.count({ where: { user: { agentId }, status: 'PENDING' } }),
    ])

    // Get deposits and withdrawals totals for agent's users
    const [totalDepositsData, totalWithdrawalsData] = await Promise.all([
      prisma.deposit.aggregate({
        where: { user: { agentId }, status: 'APPROVED' },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { user: { agentId }, status: 'APPROVED' },
        _sum: { amount: true }
      })
    ])

    // Get this month's stats
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    lastMonth.setDate(1)
    lastMonth.setHours(0, 0, 0, 0)

    const endOfLastMonth = new Date()
    endOfLastMonth.setDate(0)
    endOfLastMonth.setHours(23, 59, 59, 999)

    const [
      usersThisMonth,
      usersLastMonth,
      depositsThisMonth,
      depositsLastMonth,
      withdrawalsThisMonth,
      withdrawalsLastMonth
    ] = await Promise.all([
      prisma.user.count({ where: { agentId, role: 'USER', createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { agentId, role: 'USER', createdAt: { gte: lastMonth, lte: endOfLastMonth } } }),
      prisma.deposit.aggregate({
        where: { user: { agentId }, status: 'APPROVED', approvedAt: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.deposit.aggregate({
        where: { user: { agentId }, status: 'APPROVED', approvedAt: { gte: lastMonth, lte: endOfLastMonth } },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { user: { agentId }, status: 'APPROVED', approvedAt: { gte: startOfMonth } },
        _sum: { amount: true }
      }),
      prisma.withdrawal.aggregate({
        where: { user: { agentId }, status: 'APPROVED', approvedAt: { gte: lastMonth, lte: endOfLastMonth } },
        _sum: { amount: true }
      })
    ])

    // Calculate percentage changes
    const depositsThisMonthAmount = Number(depositsThisMonth._sum.amount) || 0
    const depositsLastMonthAmount = Number(depositsLastMonth._sum.amount) || 0
    const withdrawalsThisMonthAmount = Number(withdrawalsThisMonth._sum.amount) || 0
    const withdrawalsLastMonthAmount = Number(withdrawalsLastMonth._sum.amount) || 0

    const depositsChange = depositsLastMonthAmount > 0
      ? ((depositsThisMonthAmount - depositsLastMonthAmount) / depositsLastMonthAmount * 100).toFixed(1)
      : depositsThisMonthAmount > 0 ? '100' : '0'

    const withdrawalsChange = withdrawalsLastMonthAmount > 0
      ? ((withdrawalsThisMonthAmount - withdrawalsLastMonthAmount) / withdrawalsLastMonthAmount * 100).toFixed(1)
      : withdrawalsThisMonthAmount > 0 ? '100' : '0'

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

    // Calculate date range based on period
    const now = new Date()
    let startDate = new Date()
    let intervalType: 'hour' | 'day' | 'month' = 'day'
    let intervalCount = 7

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        intervalType = 'hour'
        intervalCount = 24
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
        intervalType = 'hour'
        intervalCount = 24
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        intervalType = 'day'
        intervalCount = 7
        break
      case '1m':
        startDate.setMonth(now.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        intervalType = 'day'
        intervalCount = 30
        break
      case '6m':
        startDate.setMonth(now.getMonth() - 6)
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        intervalType = 'month'
        intervalCount = 6
        break
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1)
        startDate.setDate(1)
        startDate.setHours(0, 0, 0, 0)
        intervalType = 'month'
        intervalCount = 12
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        intervalType = 'hour'
        intervalCount = 24
    }

    // Get user IDs for this agent
    const agentUserIds = agentUsers.map(u => u.id)

    // Get wallet flow data for agent's users to calculate balances
    const walletFlows = agentUserIds.length > 0 ? await prisma.walletFlow.findMany({
      where: {
        userId: { in: agentUserIds },
        createdAt: { gte: startDate }
      },
      select: {
        userId: true,
        balanceAfter: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    }) : []

    // Get user wallet deposits for agent's users (GREEN line - wallet recharges)
    const walletDeposits = agentUserIds.length > 0 ? await prisma.deposit.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate },
        userId: { in: agentUserIds }
      },
      select: {
        amount: true,
        approvedAt: true
      }
    }) : []

    // Get ad account deposits for agent's users (BLUE line - ad account recharges)
    const adAccountDeposits = agentUserIds.length > 0 ? await prisma.accountDeposit.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { gte: startDate },
        adAccount: { userId: { in: agentUserIds } }
      },
      select: {
        amount: true,
        approvedAt: true
      }
    }) : []

    // Generate chart data based on interval type
    const chartData = []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let i = intervalCount - 1; i >= 0; i--) {
      let intervalStart: Date
      let intervalEnd: Date
      let label: string

      if (intervalType === 'hour') {
        // Hourly intervals for today
        intervalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 0, 0)
        intervalEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 59, 59, 999)
        label = `${intervalStart.getHours().toString().padStart(2, '0')}:00`
      } else if (intervalType === 'day') {
        // Daily intervals
        intervalStart = new Date(now)
        intervalStart.setDate(now.getDate() - i)
        intervalStart.setHours(0, 0, 0, 0)
        intervalEnd = new Date(intervalStart)
        intervalEnd.setHours(23, 59, 59, 999)
        label = `${intervalStart.getDate()} ${months[intervalStart.getMonth()].substring(0, 3)}`
      } else {
        // Monthly intervals
        const monthIndex = (now.getMonth() - i + 12) % 12
        const year = now.getFullYear() - (now.getMonth() - i < 0 ? 1 : 0)
        intervalStart = new Date(year, monthIndex, 1)
        intervalEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
        label = months[monthIndex].toUpperCase()
      }

      // Calculate wallet deposits for this interval (GREEN line)
      const intervalWalletDeposits = walletDeposits
        .filter(d => d.approvedAt && d.approvedAt >= intervalStart && d.approvedAt <= intervalEnd)
        .reduce((sum, d) => sum + Number(d.amount || 0), 0)

      // Calculate ad account deposits for this interval (BLUE line)
      const intervalAdDeposits = adAccountDeposits
        .filter(d => d.approvedAt && d.approvedAt >= intervalStart && d.approvedAt <= intervalEnd)
        .reduce((sum, d) => sum + Number(d.amount || 0), 0)

      chartData.push({
        name: label,
        walletDeposits: intervalWalletDeposits,
        adAccountDeposits: intervalAdDeposits
      })
    }

    // Get total ad account recharges
    const totalAdRecharges = await prisma.accountDeposit.aggregate({
      where: {
        status: 'APPROVED',
        adAccount: { user: { agentId } }
      },
      _sum: { amount: true }
    })

    // Top 5 users by wallet balance
    const topUsers = await prisma.user.findMany({
      where: { agentId, role: 'USER' },
      select: {
        id: true,
        username: true,
        walletBalance: true,
      },
      orderBy: { walletBalance: 'desc' },
      take: 5
    })

    // Calculate week dates for top spenders
    const { weekFilter = 'current' } = c.req.query()
    const todayForWeek = new Date()
    const dayOfWeek = todayForWeek.getDay()

    let weekStart: Date
    let weekEnd: Date

    if (weekFilter === 'last') {
      // Last week: Sunday to Saturday of previous week
      weekStart = new Date(todayForWeek)
      weekStart.setDate(todayForWeek.getDate() - dayOfWeek - 7)
      weekStart.setHours(0, 0, 0, 0)
      weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)
    } else {
      // Current week: Sunday to today
      weekStart = new Date(todayForWeek)
      weekStart.setDate(todayForWeek.getDate() - dayOfWeek)
      weekStart.setHours(0, 0, 0, 0)
      weekEnd = new Date(todayForWeek)
      weekEnd.setHours(23, 59, 59, 999)
    }

    // Get top 5 users by ad account recharge submissions this week
    const topSpendersData = await prisma.accountDeposit.groupBy({
      by: ['adAccountId'],
      where: {
        adAccount: { user: { agentId } },
        createdAt: { gte: weekStart, lte: weekEnd }
      },
      _sum: { amount: true }
    })

    // Get user details for the ad accounts
    const adAccountIds = topSpendersData.map(d => d.adAccountId)
    const adAccountsWithUsers = adAccountIds.length > 0 ? await prisma.adAccount.findMany({
      where: { id: { in: adAccountIds } },
      select: {
        id: true,
        user: { select: { id: true, username: true } }
      }
    }) : []

    // Aggregate by user
    const userSpendMap = new Map<string, { username: string; totalSpend: number }>()
    topSpendersData.forEach(spend => {
      const adAccount = adAccountsWithUsers.find(a => a.id === spend.adAccountId)
      if (adAccount?.user) {
        const userId = adAccount.user.id
        const existing = userSpendMap.get(userId)
        const amount = Number(spend._sum.amount) || 0
        if (existing) {
          existing.totalSpend += amount
        } else {
          userSpendMap.set(userId, {
            username: adAccount.user.username || 'Unknown',
            totalSpend: amount
          })
        }
      }
    })

    // Convert to array and sort by spend
    const topSpenders = Array.from(userSpendMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5)

    // Get recent activity for agent's users (last 20 activities)
    // 1. Ad Account Applications
    const recentApplications = await prisma.adAccountApplication.findMany({
      where: { user: { agentId } },
      select: {
        id: true,
        platform: true,
        status: true,
        createdAt: true,
        user: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // 2. Ad Account Recharges
    const recentRecharges = await prisma.accountDeposit.findMany({
      where: { adAccount: { user: { agentId } } },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        adAccount: {
          select: {
            platform: true,
            user: { select: { username: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // 3. Wallet Deposits
    const recentWalletDeposits = await prisma.deposit.findMany({
      where: { user: { agentId } },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        user: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // Combine and format all activities
    const allActivities: any[] = []

    recentApplications.forEach(app => {
      allActivities.push({
        id: app.id,
        type: 'application',
        username: app.user?.username || 'Unknown',
        platform: app.platform,
        status: app.status,
        amount: null,
        createdAt: app.createdAt
      })
    })

    recentRecharges.forEach(recharge => {
      allActivities.push({
        id: recharge.id,
        type: 'recharge',
        username: recharge.adAccount?.user?.username || 'Unknown',
        platform: recharge.adAccount?.platform || 'UNKNOWN',
        status: recharge.status,
        amount: Number(recharge.amount) || 0,
        createdAt: recharge.createdAt
      })
    })

    recentWalletDeposits.forEach(deposit => {
      allActivities.push({
        id: deposit.id,
        type: 'wallet_deposit',
        username: deposit.user?.username || 'Unknown',
        platform: null,
        status: deposit.status,
        amount: Number(deposit.amount) || 0,
        createdAt: deposit.createdAt
      })
    })

    // Sort by date and take top 15
    const recentActivity = allActivities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15)

    // Get all ad accounts for agent's users with their creation date and platform
    const adAccountsData = await prisma.adAccount.findMany({
      where: {
        user: { agentId },
        createdAt: { gte: startDate }
      },
      select: {
        id: true,
        platform: true,
        createdAt: true
      }
    })

    // Generate platform chart data - count of ad accounts per platform over time
    const platformChartData = []
    const platforms = ['FACEBOOK', 'GOOGLE', 'TIKTOK', 'SNAPCHAT', 'BING']

    for (let i = intervalCount - 1; i >= 0; i--) {
      let intervalStart: Date
      let intervalEnd: Date
      let label: string

      if (intervalType === 'hour') {
        intervalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 0, 0)
        intervalEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i, 59, 59, 999)
        label = `${intervalStart.getHours().toString().padStart(2, '0')}:00`
      } else if (intervalType === 'day') {
        intervalStart = new Date(now)
        intervalStart.setDate(now.getDate() - i)
        intervalStart.setHours(0, 0, 0, 0)
        intervalEnd = new Date(intervalStart)
        intervalEnd.setHours(23, 59, 59, 999)
        label = `${intervalStart.getDate()} ${months[intervalStart.getMonth()].substring(0, 3)}`
      } else {
        const monthIndex = (now.getMonth() - i + 12) % 12
        const year = now.getFullYear() - (now.getMonth() - i < 0 ? 1 : 0)
        intervalStart = new Date(year, monthIndex, 1)
        intervalEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
        label = months[monthIndex]
      }

      const dataPoint: any = { name: label }

      // Count accounts for each platform in this interval
      platforms.forEach(platform => {
        const count = adAccountsData.filter(acc =>
          acc.platform === platform &&
          acc.createdAt >= intervalStart &&
          acc.createdAt <= intervalEnd
        ).length

        // Use lowercase keys for frontend
        dataPoint[platform.toLowerCase()] = count
      })

      platformChartData.push(dataPoint)
    }

    return c.json({
      stats: {
        totalUsers,
        activeUsers,
        blockedUsers,
        totalAccounts,
        pendingApplications,
        availableCoupons,
        totalWalletBalance: totalWalletBalance,
        totalDeposits: totalDepositsData._sum.amount ? Number(totalDepositsData._sum.amount) : 0,
        totalAdRecharges: totalAdRecharges._sum.amount ? Number(totalAdRecharges._sum.amount) : 0,
        totalWithdrawals: totalWithdrawalsData._sum.amount ? Number(totalWithdrawalsData._sum.amount) : 0,
        usersThisMonth,
        usersLastMonth,
        depositsChange: `${depositsChange}%`,
        withdrawalsChange: `${withdrawalsChange}%`,
      },
      platformStats,
      recentUsers,
      recentDeposits,
      chartData,
      platformChartData,
      topUsers,
      topSpenders,
      recentActivity,
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
      pendingAccounts,
      pendingApplications,
      pendingShares,
      pendingRefunds,
      pendingAccountDeposits
    ] = await Promise.all([
      prisma.deposit.count({ where: { userId, status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { userId, status: 'PENDING' } }),
      prisma.adAccount.count({ where: { userId, status: 'PENDING' } }),
      prisma.adAccountApplication.count({ where: { userId, status: 'PENDING' } }),
      prisma.bmShareRequest.count({ where: { userId, status: 'PENDING' } }),
      prisma.accountRefund.count({ where: { adAccount: { userId }, status: 'PENDING' } }),
      prisma.accountDeposit.count({ where: { adAccount: { userId }, status: 'PENDING' } }),
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
      pendingApplications,
      pendingDeposits: pendingAccountDeposits,
      pendingShares,
      pendingRefunds,
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
