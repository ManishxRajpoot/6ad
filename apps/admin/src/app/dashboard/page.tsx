'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { dashboardApi, agentsApi } from '@/lib/api'
import {
  TrendingUp,
  ChevronDown,
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

type Agent = {
  id: string
  username: string
  email: string
  balance: number
  totalUsers?: number
}

// ============================================
// CHART DATA
// ============================================
const revenueChartData = [
  { name: 'Mon', income: 100000, outcome: 80000 },
  { name: 'Tues', income: 150000, outcome: 120000 },
  { name: 'Wed', income: 400000, outcome: 200000 },
  { name: 'Thurs', income: 520000, outcome: 250000 },
  { name: 'Fri', income: 350000, outcome: 180000 },
  { name: 'Sat', income: 450000, outcome: 220000 },
]

const agentsPerformanceData = [
  { name: 'May 5', green: 180, orange: 120 },
  { name: 'May 6', green: 200, orange: 150 },
  { name: 'May 7', green: 250, orange: 180 },
  { name: 'May 8', green: 340, orange: 280 },
  { name: 'May 9', green: 300, orange: 220 },
  { name: 'May 10', green: 280, orange: 200 },
  { name: 'May 11', green: 260, orange: 190 },
]

const platformDistribution = [
  { name: 'Facebook', value: 60, color: '#111827', amount: 2100 },
  { name: 'Google', value: 15, color: '#6B7280', amount: 525 },
  { name: 'Bing', value: 12, color: '#9CA3AF', amount: 420 },
  { name: 'Tiktok', value: 8, color: '#D1D5DB', amount: 280 },
  { name: 'Snapchat', value: 5, color: '#E5E7EB', amount: 175 },
]

// Sparkline data - Smooth curves with 10 data points (like user side)
const revenueSparkline = [30, 45, 35, 50, 40, 60, 55, 70, 65, 80]
const pendingSparkline = [25, 40, 30, 55, 45, 65, 50, 75, 60, 85]
const usersSparkline = [35, 50, 40, 60, 45, 70, 55, 75, 65, 90]
const growthSparkline = [20, 35, 25, 45, 40, 55, 50, 65, 60, 75]

// ============================================
// MAIN COMPONENT
// ============================================
export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 43000,
    revenueChange: 1.78,
    pendingRequests: 66435,
    pendingChange: 2.34,
    totalAgents: 0,
    agentChange: 0.85,
    totalUsers: 255456,
    userChange: 3.12,
    overallGrowth: 13.59,
  })
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [performancePeriod, setPerformancePeriod] = useState<'Day' | 'Week' | 'Month'>('Day')

  const fetchData = useCallback(async () => {
    try {
      const [dashboardData, agentsData] = await Promise.all([
        dashboardApi.getStats().catch(() => ({ stats: {} })),
        agentsApi.getAll().catch(() => ({ agents: [] })),
      ])

      if (dashboardData.stats) {
        setStats({
          totalRevenue: dashboardData.stats.totalRevenue || 43000,
          revenueChange: dashboardData.stats.revenueChange || 1.78,
          pendingRequests: dashboardData.stats.pendingRequests || 66435,
          pendingChange: dashboardData.stats.pendingChange || 2.34,
          totalAgents: dashboardData.stats.totalAgents || agentsData.agents?.length || 0,
          agentChange: dashboardData.stats.agentChange || 0.85,
          totalUsers: dashboardData.stats.totalUsers || 255456,
          userChange: dashboardData.stats.userChange || 3.12,
          overallGrowth: dashboardData.stats.overallGrowth || 13.59,
        })
      }

      const sortedAgents = (agentsData.agents || [])
        .sort((a: Agent, b: Agent) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 5)
      setAgents(sortedAgents)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
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
        {/* KPI Cards Row - Using single reusable component */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Total Revenue"
            value={stats.totalRevenue}
            growth={stats.revenueChange}
            chartData={revenueSparkline}
            color="#111827"
            format="currency"
          />
          <KPICard
            title="Pending Requests"
            value={stats.pendingRequests}
            growth={stats.pendingChange}
            chartData={pendingSparkline}
            color="#111827"
            format="number"
          />
          <KPICard
            title="No of Users"
            value={stats.totalUsers}
            growth={stats.userChange}
            chartData={usersSparkline}
            color="#111827"
            format="number"
          />
          <KPICard
            title="Overall Growth"
            value={stats.overallGrowth}
            growth={stats.revenueChange}
            chartData={growthSparkline}
            color="#52B788"
            format="percent"
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
                <button className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 border border-gray-200 rounded-lg">
                  This Week <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-900" />
                  <span className="text-[10px] text-gray-400">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-[10px] text-gray-400">Outcome</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  width={50}
                  tickFormatter={(v) => v === 0 ? '0' : `${(v/1000)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={{ fill: '#111827', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#111827' }}
                />
                <Line
                  type="monotone"
                  dataKey="outcome"
                  stroke="#D1D5DB"
                  strokeWidth={2}
                  dot={{ fill: '#D1D5DB', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#D1D5DB' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* In Amount Statistics */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">In Amount Statistics</h3>
                <p className="text-[11px] text-gray-400">Platform distribution overview</p>
              </div>
              <button className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 border border-gray-200 rounded-lg">
                This Month <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-5">
              {/* Donut Chart */}
              <div className="relative">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={platformDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {platformDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-gray-400">Total</p>
                  <p className="text-lg font-bold text-gray-900">$3,500</p>
                </div>
              </div>

              {/* Legend — dot style */}
              <div className="flex-1 space-y-2.5">
                {platformDistribution.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gray-900" style={{ opacity: 1 - idx * 0.18 }} />
                      <span className="text-[11px] text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-900">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth indicator */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-gray-400">$2,500 → $3,500</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                    <div className="h-full bg-gray-900 rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>
                <span className="text-[10px] font-medium text-gray-600">+12.5%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-12 gap-4">
          {/* Agents Performance */}
          <div className="col-span-7 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Agents Performance</h3>
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                {(['Day', 'Week', 'Month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setPerformancePeriod(period)}
                    className={`px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                      performancePeriod === period
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-400'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={agentsPerformanceData}>
                <defs>
                  <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9CA3AF" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#9CA3AF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="green"
                  stroke="#111827"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGreen)"
                  dot={{ fill: '#111827', strokeWidth: 0, r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="orange"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOrange)"
                  dot={{ fill: '#9CA3AF', strokeWidth: 0, r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 Agents */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top 5 Agents</h3>
                <p className="text-[11px] text-gray-400">Best performing agents</p>
              </div>
              <button className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 border border-gray-200 rounded-lg">
                This Month <ChevronDown className="w-3 h-3" />
              </button>
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
                    <p className="text-[10px] text-gray-400 truncate">{agent.email || 'agent@example.com'}</p>
                  </div>
                  <div className="flex -space-x-1.5">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white" />
                    ))}
                    <div className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                      <span className="text-[7px] text-gray-400">+50</span>
                    </div>
                  </div>
                  <p className="text-[12px] font-bold text-gray-900">${Math.round(agent.balance || 0).toLocaleString()}.00</p>
                </div>
              )) : (
                [...Array(5)].map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                      <span className="text-[11px] font-semibold text-gray-500">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-900">Ali Baloch</p>
                      <p className="text-[10px] text-gray-400">alibaloch103010@gmail.com</p>
                    </div>
                    <div className="flex -space-x-1.5">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="w-5 h-5 rounded-full bg-gray-200 border-2 border-white" />
                      ))}
                      <div className="w-5 h-5 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                        <span className="text-[7px] text-gray-400">+50</span>
                      </div>
                    </div>
                    <p className="text-[12px] font-bold text-gray-900">$2,359.00</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
