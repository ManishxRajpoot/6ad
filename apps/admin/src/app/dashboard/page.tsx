'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { dashboardApi, agentsApi } from '@/lib/api'
import {
  TrendingUp,
  TrendingDown,
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

// Mini Sparkline Chart - Same as user side (smooth bezier curves)
const MiniChart = ({ data, color, id }: { data: number[]; color: string; id: string }) => {
  if (!data || data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 120
  const height = 50
  const padding = 5

  // Generate smooth curve points
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  // Create smooth curve path using bezier curves
  const createSmoothPath = () => {
    if (points.length < 2) return ''

    let path = `M ${points[0].x} ${points[0].y}`

    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i]
      const next = points[i + 1]
      const controlX = (current.x + next.x) / 2

      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`
    }

    return path
  }

  // Create area fill path
  const createAreaPath = () => {
    const linePath = createSmoothPath()
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]

    return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path
        d={createAreaPath()}
        fill={`url(#gradient-${id})`}
      />
      {/* Line */}
      <path
        d={createSmoothPath()}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
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
      className={`rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${
        isDark ? 'bg-[#1F2937] border-gray-700' : 'bg-white'
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
            className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: color }}
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
  { name: 'Facebook', value: 60, color: '#8B5CF6', amount: 2100 },
  { name: 'Google', value: 15, color: '#94A3B8', amount: 525 },
  { name: 'Bing', value: 12, color: '#CBD5E1', amount: 420 },
  { name: 'Tiktok', value: 8, color: '#E2E8F0', amount: 280 },
  { name: 'Snapchat', value: 5, color: '#F1F5F9', amount: 175 },
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
            <Loader2 className="h-8 w-8 animate-spin text-[#52B788]" />
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
            color="#52B788"
            format="currency"
          />
          <KPICard
            title="Pending Requests"
            value={stats.pendingRequests}
            growth={stats.pendingChange}
            chartData={pendingSparkline}
            color="#8B5CF6"
            format="number"
          />
          <KPICard
            title="No of Users"
            value={stats.totalUsers}
            growth={stats.userChange}
            chartData={usersSparkline}
            color="#3B82F6"
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
          <div className="col-span-7 bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-gray-800">Total Revenue</h3>
                <button className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg">
                  This Week <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-gray-500">Income</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs text-gray-500">Outcome</span>
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
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#EF4444' }}
                />
                <Line
                  type="monotone"
                  dataKey="outcome"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* In Amount Statistics */}
          <div className="col-span-5 bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-semibold text-gray-800">In Amount Statistics</h3>
                <p className="text-xs text-gray-400">Total income details in the current time slap</p>
              </div>
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg">
                This Month <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-6">
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
                  <p className="text-[10px] text-gray-400">Total Expense</p>
                  <p className="text-lg font-bold text-gray-800">$3,500</p>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2">
                {platformDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-5 rounded text-[10px] font-medium flex items-center justify-center text-white"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.value}%
                      </div>
                      <span className="text-xs text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Growth indicator */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#52B788]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">$2,500.00 to $3500.00</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                    <div className="h-full bg-[#52B788] rounded-full" style={{ width: '70%' }} />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#52B788]">Growth increase 12.5%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-12 gap-4">
          {/* Agents Performance */}
          <div className="col-span-7 bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Agents Performance</h3>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {(['Day', 'Week', 'Month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setPerformancePeriod(period)}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      performancePeriod === period
                        ? 'bg-white text-gray-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
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
                    <stop offset="5%" stopColor="#52B788" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#52B788" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#52B788' }} />
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
                  stroke="#52B788"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorGreen)"
                  dot={{ fill: '#52B788', strokeWidth: 0, r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="orange"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOrange)"
                  dot={{ fill: '#F59E0B', strokeWidth: 0, r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top 5 Agents */}
          <div className="col-span-5 bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Top 5 Agents</h3>
                <p className="text-xs text-gray-400">Here top agents of selected time frame</p>
              </div>
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg">
                This Month <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {agents.length > 0 ? agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center overflow-hidden">
                    <span className="text-pink-500 font-semibold text-sm">
                      {agent.username?.charAt(0).toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{agent.username || 'Agent'}</p>
                    <p className="text-xs text-gray-400 truncate">{agent.email || 'agent@example.com'}</p>
                  </div>
                  <div className="flex -space-x-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-pink-100 border-2 border-white" />
                    ))}
                    <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                      <span className="text-[9px] text-gray-500">50+</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-800">${Math.round(agent.balance || 0).toLocaleString()}.00</p>
                </div>
              )) : (
                [...Array(5)].map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                      <span className="text-pink-500 font-semibold text-sm">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Ali Baloch</p>
                      <p className="text-xs text-gray-400">alibaloch103010@gmail.com</p>
                    </div>
                    <div className="flex -space-x-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-pink-100 border-2 border-white" />
                      ))}
                      <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                        <span className="text-[9px] text-gray-500">50+</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-800">$2,359.00</p>
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
