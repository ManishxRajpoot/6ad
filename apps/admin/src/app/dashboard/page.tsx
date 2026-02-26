'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { dashboardApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  TrendingUp,
  Loader2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ============================================
// KPI CARD COMPONENT - Single Reusable Component
// ============================================
type KPICardProps = {
  title: string
  value: number
  growth: number
  chartData: number[]
  color: string
  format: 'currency' | 'number' | 'percent'
  variant?: 'light' | 'dark'
}

// Format value based on type
const formatValue = (value: number, format: 'currency' | 'number' | 'percent'): string => {
  if (format === 'currency') {
    return `$${Math.round(value).toLocaleString()}`
  }
  if (format === 'percent') {
    return `${value.toFixed(2)}%`
  }
  return Math.round(value).toLocaleString()
}

// Mini Sparkline Chart — Catmull-Rom spline for smooth curves
const MiniChart = ({ data, color, id }: { data: number[]; color: string; id: string }) => {
  if (!data || data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const vw = 200
  const vh = 60
  const px = 4
  const py = 6

  const points = data.map((value, index) => ({
    x: px + (index / (data.length - 1)) * (vw - px * 2),
    y: py + (1 - (value - min) / range) * (vh - py * 2),
  }))

  // Catmull-Rom to cubic bezier conversion for truly smooth curves
  const catmullRomPath = () => {
    if (points.length < 2) return ''
    const tension = 0.3
    let d = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[Math.min(i + 2, points.length - 1)]

      const cp1x = p1.x + (p2.x - p0.x) * tension
      const cp1y = p1.y + (p2.y - p0.y) * tension
      const cp2x = p2.x - (p3.x - p1.x) * tension
      const cp2y = p2.y - (p3.y - p1.y) * tension

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  }

  const linePath = catmullRomPath()
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${vh} L ${points[0].x} ${vh} Z`

  return (
    <svg
      width="100%"
      height={56}
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#gradient-${id})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// KPI Card Component - Compact design matching user side
const KPICard = ({ title, value, growth, chartData, color, format, variant = 'light' }: KPICardProps) => {
  const isDark = variant === 'dark'
  const cardId = title.replace(/\s+/g, '-').toLowerCase()

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
      }`}
    >
      <div className="p-5">
        {/* Title */}
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {title}
        </p>

        {/* Value + Badge */}
        <div className="flex items-center gap-3 mb-3">
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatValue(value, format)}
          </p>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-100 text-gray-900'
            }`}
          >
            +{Math.abs(growth).toFixed(2)}%
          </span>
        </div>

        {/* Mini Chart - aligned to right */}
        <div className="flex justify-end -mb-2 -mr-2">
          <MiniChart data={chartData} color={color} id={cardId} />
        </div>
      </div>
    </div>
  )
}

// ============================================
// TYPES
// ============================================
type DashboardStats = {
  totalRevenue: number
  revenueChange: number
  pendingRequests: number
  pendingChange: number
  totalAgents: number
  agentChange: number
  totalUsers: number
  userChange: number
  overallGrowth: number
}

// Platform color map
const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#111827',
  GOOGLE: '#6B7280',
  BING: '#9CA3AF',
  TIKTOK: '#D1D5DB',
  SNAPCHAT: '#E5E7EB',
}

// Default sparkline (flat) when no real data
const defaultSparkline = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

// ============================================
// MAIN COMPONENT
// ============================================
type PlatformStat = {
  platform: string
  _count: number
  _sum: { totalDeposit: number | null; totalSpend: number | null }
}

type TopAgent = {
  id: string
  username: string
  email: string
  profileImage: string | null
  walletBalance: number
  _count: { users: number }
}

type MonthlyRevenue = {
  month: string
  total: number
}

export default function DashboardPage() {
  const toast = useToast()
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    revenueChange: 0,
    pendingRequests: 0,
    pendingChange: 0,
    totalAgents: 0,
    agentChange: 0,
    totalUsers: 0,
    userChange: 0,
    overallGrowth: 0,
  })
  const [agents, setAgents] = useState<TopAgent[]>([])
  const [platformStats, setPlatformStats] = useState<PlatformStat[]>([])
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [revenuePeriod, setRevenuePeriod] = useState<'3M' | '6M' | '12M'>('12M')
  const [performancePeriod, setPerformancePeriod] = useState<'3M' | '6M' | '12M'>('6M')

  const fetchData = useCallback(async () => {
    try {
      setFetchError(false)
      const dashboardData = await dashboardApi.getStats()

      if (dashboardData.stats) {
        const s = dashboardData.stats
        setStats({
          totalRevenue: s.totalRevenue || 0,
          revenueChange: 0,
          pendingRequests: (s.pendingDeposits || 0) + (s.pendingWithdrawals || 0) + (s.pendingRefunds || 0) + (s.pendingAccounts || 0),
          pendingChange: 0,
          totalAgents: s.totalAgents || 0,
          agentChange: 0,
          totalUsers: s.totalUsers || 0,
          userChange: 0,
          overallGrowth: 0,
        })
      }

      if (dashboardData.topAgents) {
        setAgents(dashboardData.topAgents)
      }
      if (dashboardData.platformStats) {
        setPlatformStats(dashboardData.platformStats)
      }
      if (dashboardData.monthlyRevenue) {
        setMonthlyRevenue(dashboardData.monthlyRevenue)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      setFetchError(true)
      toast.error('Dashboard Error', 'Failed to load dashboard data. Showing cached values.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-gray-900" />
            <span className="text-sm text-slate-500">Loading dashboard...</span>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <div className="space-y-5">
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
            <span className="text-red-600 text-sm font-medium">⚠ Failed to load dashboard data.</span>
            <button onClick={fetchData} className="text-red-700 text-sm underline hover:no-underline">Retry</button>
          </div>
        )}
        {/* KPI Cards Row - Using single reusable component */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Total Revenue"
            value={stats.totalRevenue}
            growth={stats.revenueChange}
            chartData={monthlyRevenue.length > 0 ? monthlyRevenue.map(m => m.total) : defaultSparkline}
            color="#111827"
            format="currency"
          />
          <KPICard
            title="Pending Requests"
            value={stats.pendingRequests}
            growth={stats.pendingChange}
            chartData={defaultSparkline}
            color="#111827"
            format="number"
          />
          <KPICard
            title="No of Users"
            value={stats.totalUsers}
            growth={stats.userChange}
            chartData={defaultSparkline}
            color="#111827"
            format="number"
          />
          <KPICard
            title="Total Agents"
            value={stats.totalAgents}
            growth={stats.agentChange}
            chartData={defaultSparkline}
            color="#52B788"
            format="number"
            variant="dark"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-12 gap-4">
          {/* Total Revenue Chart */}
          <div className="col-span-7 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Total Revenue</h3>
                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {(['3M', '6M', '12M'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setRevenuePeriod(p)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                        revenuePeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-900" />
                <span className="text-[10px] text-gray-400">Revenue</span>
              </div>
            </div>
            {(() => {
              const monthCount = revenuePeriod === '3M' ? 3 : revenuePeriod === '6M' ? 6 : 12
              const filteredRevenue = monthlyRevenue.slice(-monthCount)
              if (filteredRevenue.length === 0) return (
                <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
                  No revenue data yet
                </div>
              )
              return (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filteredRevenue.map(m => ({ name: m.month, revenue: m.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94A3B8' }}
                    width={50}
                    tickFormatter={(v) => v === 0 ? '0' : `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '11px',
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#111827"
                    strokeWidth={2}
                    dot={{ fill: '#111827', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#111827' }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )
            })()}
          </div>

          {/* In Amount Statistics */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">In Amount Statistics</h3>
                <p className="text-[11px] text-gray-400">Platform distribution — all time</p>
              </div>
            </div>

            {(() => {
              const pieData = platformStats.map(ps => ({
                name: ps.platform.charAt(0) + ps.platform.slice(1).toLowerCase(),
                value: ps._count || 0,
                color: PLATFORM_COLORS[ps.platform] || '#E5E7EB',
                amount: Number(ps._sum?.totalDeposit) || 0,
              })).filter(d => d.value > 0)
              const totalAmount = pieData.reduce((sum, d) => sum + d.amount, 0)

              if (pieData.length === 0) {
                return (
                  <div className="flex items-center justify-center h-[180px] text-sm text-gray-400">
                    No platform data yet
                  </div>
                )
              }

              return (
                <>
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[10px] text-gray-400">Total</p>
                        <p className="text-lg font-bold text-gray-900">${Math.round(totalAmount).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2.5">
                      {pieData.map((item, idx) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="text-[11px] text-gray-600">{item.name}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-900">${Math.round(item.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-gray-400">{pieData.reduce((s, d) => s + d.value, 0)} total accounts</p>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-12 gap-4">
          {/* Agents Performance */}
          <div className="col-span-7 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Agents Performance</h3>
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(['3M', '6M', '12M'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPerformancePeriod(p)}
                    className={`px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                      performancePeriod === p
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const monthCount = performancePeriod === '3M' ? 3 : performancePeriod === '6M' ? 6 : 12
              const filteredPerf = monthlyRevenue.slice(-monthCount)
              if (filteredPerf.length === 0) return (
                <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
                  No performance data yet
                </div>
              )
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={filteredPerf.map(m => ({ name: m.month, revenue: m.total }))}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#94A3B8' }}
                      width={40}
                      tickFormatter={(v) => v === 0 ? '0' : `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        fontSize: '11px',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#111827"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      dot={{ fill: '#111827', strokeWidth: 0, r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            })()}
          </div>

          {/* Top 5 Agents */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top 5 Agents</h3>
                <p className="text-[11px] text-gray-400">By user count</p>
              </div>
            </div>

            <div className="space-y-3">
              {agents.length > 0 ? agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    <span className="text-[11px] font-semibold text-gray-500">
                      {agent.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-900 truncate">{agent.username || 'Agent'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{agent.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-gray-900">{agent._count?.users || 0} users</p>
                    <p className="text-[10px] text-gray-400">${Math.round(agent.walletBalance || 0).toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
                  No agents yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
