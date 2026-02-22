import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client'
import { verifyToken, requireAdmin } from '../middleware/auth.js'

const prisma = new PrismaClient()
const reports = new Hono()

reports.use('*', verifyToken)

// GET /reports/agent-earnings - Agent commission & opening fee report
reports.get('/agent-earnings', requireAdmin, async (c) => {
  try {
    const agentId = c.req.query('agentId') || 'all'
    const period = c.req.query('period') || 'daily' // daily | weekly | monthly
    const months = parseInt(c.req.query('months') || '6')

    // Date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setHours(0, 0, 0, 0)

    // Get all agents for the dropdown
    const allAgents = await prisma.user.findMany({
      where: { role: 'AGENT', status: 'ACTIVE' },
      select: { id: true, username: true, email: true, realName: true }
    })

    // Determine which agents to report on
    const targetAgentIds = agentId === 'all'
      ? allAgents.map(a => a.id)
      : [agentId]

    // Get all users under target agent(s)
    const agentUsers = await prisma.user.findMany({
      where: { agentId: { in: targetAgentIds } },
      select: { id: true, agentId: true }
    })
    const userIds = agentUsers.map(u => u.id)

    // ============= SUMMARY STATS =============

    // Lifetime commission from account deposits
    const lifetimeCommission = await prisma.accountDeposit.aggregate({
      where: {
        adAccount: { userId: { in: userIds } },
        status: 'APPROVED'
      },
      _sum: { commissionAmount: true }
    })

    // Lifetime opening fees
    const lifetimeOpeningFees = await prisma.adAccountApplication.aggregate({
      where: {
        userId: { in: userIds },
        status: 'APPROVED'
      },
      _sum: { openingFee: true }
    })

    // Total withdrawn
    const totalWithdrawn = await prisma.agentWithdrawal.aggregate({
      where: {
        agentId: { in: targetAgentIds },
        status: 'APPROVED'
      },
      _sum: { amount: true, approvedAmount: true }
    })

    // Pending withdrawals
    const pendingWithdrawals = await prisma.agentWithdrawal.aggregate({
      where: {
        agentId: { in: targetAgentIds },
        status: 'PENDING'
      },
      _sum: { amount: true }
    })

    const totalCommission = lifetimeCommission._sum.commissionAmount || 0
    const totalFees = lifetimeOpeningFees._sum.openingFee || 0
    const totalEarned = totalCommission + totalFees
    const withdrawn = totalWithdrawn._sum.approvedAmount || totalWithdrawn._sum.amount || 0
    const pending = pendingWithdrawals._sum.amount || 0

    // ============= CURRENT MONTH STATS (for cards) =============
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthlyCommission = await prisma.accountDeposit.aggregate({
      where: {
        adAccount: { userId: { in: userIds } },
        status: 'APPROVED',
        approvedAt: { gte: monthStart }
      },
      _sum: { commissionAmount: true }
    })

    const monthlyOpeningFees = await prisma.adAccountApplication.aggregate({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        approvedAt: { gte: monthStart }
      },
      _sum: { openingFee: true }
    })

    const monthlyWithdrawn = await prisma.agentWithdrawal.aggregate({
      where: {
        agentId: { in: targetAgentIds },
        status: 'APPROVED',
        approvedAt: { gte: monthStart }
      },
      _sum: { approvedAmount: true, amount: true }
    })

    const mCommission = monthlyCommission._sum.commissionAmount || 0
    const mFees = monthlyOpeningFees._sum.openingFee || 0
    const mWithdrawn = monthlyWithdrawn._sum.approvedAmount || monthlyWithdrawn._sum.amount || 0

    // ============= TIMELINE DATA =============

    // Fetch approved account deposits in date range
    const deposits = await prisma.accountDeposit.findMany({
      where: {
        adAccount: { userId: { in: userIds } },
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate }
      },
      select: {
        commissionAmount: true,
        approvedAt: true,
        adAccount: {
          select: { platform: true, userId: true }
        }
      }
    })

    // Fetch approved applications in date range
    const applications = await prisma.adAccountApplication.findMany({
      where: {
        userId: { in: userIds },
        status: 'APPROVED',
        approvedAt: { gte: startDate, lte: endDate }
      },
      select: {
        openingFee: true,
        approvedAt: true,
        platform: true,
        userId: true
      }
    })

    // Group by time period
    const getKey = (date: Date): string => {
      const d = new Date(date)
      if (period === 'daily') {
        return d.toISOString().split('T')[0] // YYYY-MM-DD
      } else if (period === 'weekly') {
        // Get start of week (Monday)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(d)
        monday.setDate(diff)
        return monday.toISOString().split('T')[0]
      } else {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
      }
    }

    const timelineMap = new Map<string, { commission: number; openingFees: number }>()

    deposits.forEach(d => {
      if (!d.approvedAt) return
      const key = getKey(d.approvedAt)
      const entry = timelineMap.get(key) || { commission: 0, openingFees: 0 }
      entry.commission += d.commissionAmount || 0
      timelineMap.set(key, entry)
    })

    applications.forEach(a => {
      if (!a.approvedAt) return
      const key = getKey(a.approvedAt)
      const entry = timelineMap.get(key) || { commission: 0, openingFees: 0 }
      entry.openingFees += a.openingFee || 0
      timelineMap.set(key, entry)
    })

    // Sort timeline by date
    const timeline = Array.from(timelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        commission: Math.round(data.commission * 100) / 100,
        openingFees: Math.round(data.openingFees * 100) / 100,
        total: Math.round((data.commission + data.openingFees) * 100) / 100
      }))

    // ============= PLATFORM BREAKDOWN =============

    const platformMap = new Map<string, { commission: number; openingFees: number; accounts: number }>()

    deposits.forEach(d => {
      const p = d.adAccount.platform
      const entry = platformMap.get(p) || { commission: 0, openingFees: 0, accounts: 0 }
      entry.commission += d.commissionAmount || 0
      platformMap.set(p, entry)
    })

    applications.forEach(a => {
      const p = a.platform
      const entry = platformMap.get(p) || { commission: 0, openingFees: 0, accounts: 0 }
      entry.openingFees += a.openingFee || 0
      entry.accounts += 1
      platformMap.set(p, entry)
    })

    const platformBreakdown = Array.from(platformMap.entries()).map(([platform, data]) => ({
      platform,
      commission: Math.round(data.commission * 100) / 100,
      openingFees: Math.round(data.openingFees * 100) / 100,
      total: Math.round((data.commission + data.openingFees) * 100) / 100,
      accounts: data.accounts
    }))

    // ============= PER-AGENT BREAKDOWN =============

    // Build map of agentId -> userIds
    const agentUserMap = new Map<string, string[]>()
    agentUsers.forEach(u => {
      if (!u.agentId) return
      const list = agentUserMap.get(u.agentId) || []
      list.push(u.id)
      agentUserMap.set(u.agentId, list)
    })

    const agentBreakdown = allAgents
      .filter(a => agentId === 'all' || a.id === agentId)
      .map(agent => {
        const uIds = agentUserMap.get(agent.id) || []

        let commission = 0
        let openingFees = 0

        deposits.forEach(d => {
          if (uIds.includes(d.adAccount.userId)) {
            commission += d.commissionAmount || 0
          }
        })

        applications.forEach(a => {
          if (uIds.includes(a.userId)) {
            openingFees += a.openingFee || 0
          }
        })

        return {
          id: agent.id,
          username: agent.username,
          email: agent.email,
          realName: agent.realName,
          commission: Math.round(commission * 100) / 100,
          openingFees: Math.round(openingFees * 100) / 100,
          total: Math.round((commission + openingFees) * 100) / 100,
          users: uIds.length
        }
      })
      .sort((a, b) => b.total - a.total) // Sort by highest earner

    return c.json({
      agents: allAgents,
      summary: {
        totalCommission: Math.round(totalCommission * 100) / 100,
        totalOpeningFees: Math.round(totalFees * 100) / 100,
        totalEarned: Math.round(totalEarned * 100) / 100,
        totalWithdrawn: Math.round(withdrawn * 100) / 100,
        pendingWithdrawals: Math.round(pending * 100) / 100,
        availableBalance: Math.round((totalEarned - withdrawn - pending) * 100) / 100,
      },
      currentMonth: {
        commission: Math.round(mCommission * 100) / 100,
        openingFees: Math.round(mFees * 100) / 100,
        totalEarned: Math.round((mCommission + mFees) * 100) / 100,
        withdrawn: Math.round(mWithdrawn * 100) / 100,
      },
      timeline,
      platformBreakdown,
      agentBreakdown
    })
  } catch (error) {
    console.error('Reports agent-earnings error:', error)
    return c.json({ error: 'Failed to generate report' }, 500)
  }
})

export default reports
