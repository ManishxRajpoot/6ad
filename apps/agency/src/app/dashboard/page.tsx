'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Users, UserX, CheckCircle, Clock, Briefcase, Ticket, TrendingUp, FileText, CreditCard, Wallet, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { dashboardApi, settingsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function DashboardPage() {
  const updateUser = useAuthStore((state) => state.updateUser)
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [chartPeriod, setChartPeriod] = useState<'today' | '7d' | '1m' | '6m' | '1y'>('today')
  const [platformChartPeriod, setPlatformChartPeriod] = useState<'today' | 'yesterday' | '7d' | '1m' | '6m' | '1y'>('1m')
  const [platformChartLoading, setPlatformChartLoading] = useState(false)
  const [platformChartDataState, setPlatformChartDataState] = useState<any[]>([])
  const [visiblePlatforms, setVisiblePlatforms] = useState<string[]>(['facebook', 'google', 'tiktok', 'snapchat', 'bing'])
  const [topSpendersWeek, setTopSpendersWeek] = useState<'current' | 'last'>('current')
  const [topSpendersData, setTopSpendersData] = useState<any[]>([])
  const [topSpendersLoading, setTopSpendersLoading] = useState(false)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  // Use ref to store updateUser to prevent infinite re-renders
  const updateUserRef = useRef(updateUser)
  useEffect(() => {
    updateUserRef.current = updateUser
  }, [updateUser])

  useEffect(() => {
    let isMounted = true
    const fetchDashboardData = async () => {
      try {
        const data = await dashboardApi.getStats(chartPeriod)
        if (!isMounted) return
        setDashboardData(data)
        // Sync coupon balance to auth store so other pages can use it
        if (data?.stats?.availableCoupons !== undefined) {
          updateUserRef.current({ couponBalance: data.stats.availableCoupons })
        }
        // Set initial top spenders data
        if (data?.topSpenders) {
          setTopSpendersData(data.topSpenders)
        }
        // Set recent activity
        if (data?.recentActivity) {
          setRecentActivity(data.recentActivity)
        }
      } catch {
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchDashboardData()
    return () => { isMounted = false }
  }, [chartPeriod])

  // Fetch platform visibility settings (only show platforms that admin hasn't hidden)
  useEffect(() => {
    const fetchPlatformSettings = async () => {
      try {
        const { platforms } = await settingsApi.platforms.get()
        // Filter out platforms that are 'hidden'
        const visible = Object.entries(platforms)
          .filter(([_, status]) => status !== 'hidden')
          .map(([platform]) => platform)
        setVisiblePlatforms(visible)
      } catch {
        // Default to all platforms if API fails
        setVisiblePlatforms(['facebook', 'google', 'tiktok', 'snapchat', 'bing'])
      }
    }
    fetchPlatformSettings()
  }, [])

  // Fetch platform chart data when period changes
  useEffect(() => {
    const fetchPlatformChartData = async () => {
      setPlatformChartLoading(true)
      try {
        // Pass the period directly to the API - backend supports 'yesterday'
        const data = await dashboardApi.getStats(platformChartPeriod)
        setPlatformChartDataState(data?.platformChartData || [])
      } catch {
      } finally {
        setPlatformChartLoading(false)
      }
    }
    fetchPlatformChartData()
  }, [platformChartPeriod])

  // Fetch top spenders when week filter changes
  useEffect(() => {
    const fetchTopSpenders = async () => {
      setTopSpendersLoading(true)
      try {
        const data = await dashboardApi.getTopSpenders(topSpendersWeek)
        setTopSpendersData(data?.topSpenders || [])
      } catch {
        setTopSpendersData([])
      } finally {
        setTopSpendersLoading(false)
      }
    }
    fetchTopSpenders()
  }, [topSpendersWeek])

  const totalUsers = dashboardData?.stats?.totalUsers || 0
  const activeUsers = dashboardData?.stats?.activeUsers || 0
  const blockedUsers = dashboardData?.stats?.blockedUsers || 0
  const totalBalance = dashboardData?.stats?.totalWalletBalance || 0
  const totalDeposits = dashboardData?.stats?.totalDeposits || 0
  const totalWithdrawals = dashboardData?.stats?.totalWithdrawals || 0
  const totalAccounts = dashboardData?.stats?.totalAccounts || 0
  const pendingApplications = dashboardData?.stats?.pendingApplications || 0
  const availableCoupons = dashboardData?.stats?.availableCoupons || 0
  const depositsChange = dashboardData?.stats?.depositsChange || '0%'

  const platformAccounts = dashboardData?.platformStats?.map((platform: any) => ({
    name: platform.platform.charAt(0) + platform.platform.slice(1).toLowerCase(),
    accounts: platform._count || 0,
    deposits: Number(platform._sum?.totalDeposit) || 0,
  })) || []

  const recentUsers = dashboardData?.recentUsers || []

  // Live chart data from API
  const chartData = dashboardData?.chartData || []

  // Top users from API
  const apiTopUsers = dashboardData?.topUsers || []

  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}k`
    return `${amount}`
  }

  // Sparkline data
  const sparklines = {
    green: [{ v: 20 }, { v: 35 }, { v: 25 }, { v: 45 }, { v: 35 }, { v: 55 }, { v: 45 }, { v: 60 }],
    red: [{ v: 30 }, { v: 45 }, { v: 35 }, { v: 50 }, { v: 40 }, { v: 55 }, { v: 50 }, { v: 65 }],
    purple: [{ v: 25 }, { v: 40 }, { v: 30 }, { v: 50 }, { v: 35 }, { v: 45 }, { v: 40 }, { v: 55 }],
    orange: [{ v: 20 }, { v: 30 }, { v: 25 }, { v: 40 }, { v: 30 }, { v: 45 }, { v: 35 }, { v: 50 }],
    blue: [{ v: 30 }, { v: 40 }, { v: 35 }, { v: 55 }, { v: 45 }, { v: 60 }, { v: 50 }, { v: 65 }],
  }

  // Use live chart data - Green = Wallet Deposits, Blue = Ad Account Deposits
  const balanceData = chartData.length > 0
    ? chartData.map((d: any) => ({
        name: d.name,
        walletDeposits: Number(d.walletDeposits) || 0,
        adAccountDeposits: Number(d.adAccountDeposits) || 0
      }))
    : [
        { name: '00:00', walletDeposits: 0, adAccountDeposits: 0 },
        { name: '06:00', walletDeposits: 0, adAccountDeposits: 0 },
        { name: '12:00', walletDeposits: 0, adAccountDeposits: 0 },
        { name: '18:00', walletDeposits: 0, adAccountDeposits: 0 },
        { name: '24:00', walletDeposits: 0, adAccountDeposits: 0 },
      ]

  // Calculate max value for Y axis domain
  const maxChartValue = Math.max(
    ...balanceData.map((d: any) => Math.max(d.walletDeposits || 0, d.adAccountDeposits || 0)),
    100
  ) * 1.2

  // Platform chart data from API - shows ad accounts created per platform over time
  const platformChartData = platformChartDataState.length > 0 ? platformChartDataState : (dashboardData?.platformChartData || [])

  // Platform colors for the chart
  const platformChartColors: Record<string, string> = {
    facebook: '#3B82F6',
    google: '#F59E0B',
    tiktok: '#000000',
    snapchat: '#FFFC00',
    bing: '#00A4EF',
  }

  // Check which platforms have data (to only show active ones that admin hasn't hidden)
  const activePlatforms = visiblePlatforms.filter(platform => {
    return platformChartData.some((d: any) => (d[platform] || 0) > 0) ||
           platformAccounts.some((p: any) => p.name.toLowerCase() === platform)
  })

  // Use API data or fallback
  const usersChartData = platformChartData.length > 0 ? platformChartData : [
    { name: 'No Data', facebook: 0, google: 0, tiktok: 0, snapchat: 0, bing: 0 },
  ]

  // Pie chart data from platform stats
  const platformColors: Record<string, string> = {
    'Facebook': '#3B82F6',
    'Google': '#EAB308',
    'Snapchat': '#FACC15',
    'Tiktok': '#000000',
    'Bing': '#00A4EF',
  }

  const totalPlatformAccounts = platformAccounts.reduce((s: number, p: any) => s + p.accounts, 0) || 1
  const pieData = platformAccounts.length > 0
    ? platformAccounts.map((p: any) => ({
        name: p.name,
        value: Math.round((p.accounts / totalPlatformAccounts) * 100),
        color: platformColors[p.name] || '#8B5CF6'
      }))
    : [
        { name: 'Facebook', value: 25, color: '#3B82F6' },
        { name: 'Google', value: 25, color: '#EAB308' },
        { name: 'Snapchat', value: 20, color: '#FACC15' },
        { name: 'Tiktok', value: 15, color: '#000000' },
        { name: 'Bing', value: 15, color: '#00A4EF' },
      ]

  // Top users by wallet balance (from API)
  const colors = ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#F97316']
  const topUsers = apiTopUsers.length > 0
    ? apiTopUsers.map((u: any, i: number) => ({
        name: u.username || `User ${i + 1}`,
        amount: Number(u.walletBalance) || 0,
        color: colors[i % colors.length]
      }))
    : recentUsers.length > 0
      ? recentUsers.slice(0, 5).map((u: any, i: number) => ({
          name: u.username || `User ${i + 1}`,
          amount: Number(u.walletBalance) || 0,
          color: colors[i % colors.length]
        }))
      : []

  // Max balance for progress bar calculation
  const maxUserBalance = Math.max(...topUsers.map((u: any) => u.amount), 1000)

  // Platform deposits from API
  const platformDeposits = platformAccounts.length > 0
    ? platformAccounts.map((p: any) => ({
        name: p.name,
        amount: p.deposits
      }))
    : []

  // Max deposit for progress bar calculation
  const maxPlatformDeposit = Math.max(...platformDeposits.map((p: any) => p.amount), 100)

  // Compact Stat Card - fills container
  const StatCard = ({ icon: Icon, value, label, iconBg, iconColor, labelColor, sparklineData, sparklineColor, sparklineFill }: any) => (
    <div className="bg-white rounded-xl p-2 lg:p-2.5 shadow-sm h-full flex flex-col min-h-[90px] lg:min-h-0">
      <div className="flex items-start justify-between flex-shrink-0">
        <div className={`w-7 h-7 lg:w-9 lg:h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <Icon className={`w-3 h-3 lg:w-4 lg:h-4 ${iconColor}`} />
        </div>
        <div className="flex items-center gap-0.5 text-[8px] lg:text-[9px] text-emerald-500 font-medium">
          2.78%
          <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
        </div>
      </div>
      <div className="mt-1 flex-shrink-0">
        <p className="text-base lg:text-xl font-bold text-slate-800 leading-tight">{value}</p>
        <p className={`text-[8px] lg:text-[9px] font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
      </div>
      <div className="flex-1 min-h-0 mt-1 hidden lg:block">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id={`gradient-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparklineFill} stopOpacity={0.4} />
                <stop offset="100%" stopColor={sparklineFill} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={sparklineColor} strokeWidth={2} fill={`url(#gradient-${label.replace(/\s/g, '')})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  return (
    <DashboardLayout title="Dashboard" subtitle="">
      <div className="h-full flex flex-col gap-2 overflow-hidden overflow-y-auto">
        {/* Row 1: Stats Cards + Balance Chart - Takes ~40% height on desktop */}
        <div className="grid grid-cols-6 lg:grid-cols-12 gap-2 lg:gap-2.5 min-h-fit lg:h-[42%]">
          {/* Left: 6 Stat Cards */}
          <div className="col-span-6 lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 lg:grid-rows-3 gap-2">
            <StatCard icon={Users} value={activeUsers} label="Active Users" iconBg="bg-emerald-100" iconColor="text-emerald-600" labelColor="text-emerald-600" sparklineData={sparklines.green} sparklineColor="#52B788" sparklineFill="#52B788" />
            <StatCard icon={UserX} value={blockedUsers} label="Blocked Users" iconBg="bg-red-100" iconColor="text-red-500" labelColor="text-red-500" sparklineData={sparklines.red} sparklineColor="#EF4444" sparklineFill="#EF4444" />
            <StatCard icon={CheckCircle} value={'$' + formatAmount(totalDeposits)} label="Total Deposits" iconBg="bg-purple-100" iconColor="text-purple-500" labelColor="text-emerald-600" sparklineData={sparklines.purple} sparklineColor="#8B5CF6" sparklineFill="#8B5CF6" />
            <StatCard icon={Clock} value={pendingApplications} label="Pending Applications" iconBg="bg-orange-100" iconColor="text-orange-500" labelColor="text-orange-500" sparklineData={sparklines.orange} sparklineColor="#F97316" sparklineFill="#F97316" />
            <StatCard icon={Briefcase} value={totalAccounts} label="Ads Accounts" iconBg="bg-blue-100" iconColor="text-blue-500" labelColor="text-blue-500" sparklineData={sparklines.blue} sparklineColor="#3B82F6" sparklineFill="#3B82F6" />
            <StatCard icon={Ticket} value={availableCoupons} label="Available Coupons" iconBg="bg-violet-100" iconColor="text-violet-500" labelColor="text-violet-500" sparklineData={sparklines.purple} sparklineColor="#8B5CF6" sparklineFill="#8B5CF6" />
          </div>

          {/* Right: Balance Chart - Modern Design */}
          <div className="col-span-6 lg:col-span-7 bg-white rounded-xl p-3 lg:p-4 shadow-sm flex flex-col min-h-[280px] lg:min-h-0">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-3 flex-shrink-0 gap-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-800">Financial Overview</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-400">Wallet Deposits vs Ad Account Recharges</p>
                </div>
                {/* Time Period Filter */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-lg p-0.5">
                  {[
                    { key: 'today', label: 'Today' },
                    { key: '7d', label: '7D' },
                    { key: '1m', label: '1M' },
                    { key: '6m', label: '6M' },
                    { key: '1y', label: '1Y' },
                  ].map((period) => (
                    <button
                      key={period.key}
                      onClick={() => setChartPeriod(period.key as any)}
                      className={`px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-medium rounded-md transition-all ${
                        chartPeriod === period.key
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl sm:text-2xl font-bold text-emerald-500">${Number(totalBalance).toLocaleString()}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400">Total Users Balance</p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceData}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#22C55E" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="balanceGradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="50%" stopColor="#3B82F6" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 500 }} dy={5} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}`} width={45} domain={[0, maxChartValue]} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name === 'walletDeposits' ? 'Wallet Deposits' : 'Ad Account Recharges']}
                    contentStyle={{
                      fontSize: 11,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      background: 'white'
                    }}
                  />
                  <Area type="monotone" dataKey="walletDeposits" stroke="#22C55E" strokeWidth={2.5} fill="url(#balanceGradient)" dot={{ fill: '#22C55E', strokeWidth: 2, r: 3, stroke: 'white' }} activeDot={{ r: 5, stroke: '#22C55E', strokeWidth: 2, fill: 'white' }} />
                  <Area type="monotone" dataKey="adAccountDeposits" stroke="#3B82F6" strokeWidth={2.5} fill="url(#balanceGradient2)" dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3, stroke: 'white' }} activeDot={{ r: 5, stroke: '#3B82F6', strokeWidth: 2, fill: 'white' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[11px] text-slate-600 font-medium">Wallet Deposits</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-[11px] text-slate-600 font-medium">Ad Account Recharges</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Line Chart + Pie Chart - Takes ~35% height on desktop */}
        <div className="grid grid-cols-6 lg:grid-cols-12 gap-2 lg:gap-2.5 min-h-fit lg:h-[35%]">
          {/* Platform Analytics - Matching UI Theme */}
          <div className="col-span-6 lg:col-span-7 bg-white rounded-xl p-3 lg:p-4 shadow-sm flex flex-col min-h-[250px] lg:min-h-0">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-3 flex-shrink-0 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-800">Platform Analytics</h3>
                <p className="text-[9px] sm:text-[10px] text-slate-400">Ad accounts created over time</p>
              </div>
              {/* Time Period Filter */}
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 rounded-lg p-0.5 flex-wrap">
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yest' },
                  { key: '7d', label: '7D' },
                  { key: '1m', label: '1M' },
                  { key: '6m', label: '6M' },
                  { key: '1y', label: '1Y' },
                ].map((period) => (
                  <button
                    key={period.key}
                    onClick={() => setPlatformChartPeriod(period.key as any)}
                    className={`px-1.5 sm:px-2 py-1 text-[9px] sm:text-[10px] font-medium rounded-md transition-all ${
                      platformChartPeriod === period.key
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usersChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 500 }}
                    dy={5}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 9 }}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      background: 'white'
                    }}
                  />
                  {(activePlatforms.length > 0 ? activePlatforms : visiblePlatforms).map((platform) => (
                    <Line
                      key={platform}
                      type="monotone"
                      dataKey={platform}
                      stroke={platformChartColors[platform]}
                      strokeWidth={2.5}
                      dot={{ fill: platformChartColors[platform], strokeWidth: 2, r: 3, stroke: 'white' }}
                      activeDot={{ r: 5, stroke: platformChartColors[platform], strokeWidth: 2, fill: 'white' }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2 flex-shrink-0">
              {(activePlatforms.length > 0 ? activePlatforms : visiblePlatforms).map((platform) => (
                <div key={platform} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: platformChartColors[platform] }}
                  />
                  <span className="text-[11px] text-slate-600 font-medium capitalize">{platform}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Account Distribution - Donut Chart */}
          <div className="col-span-6 lg:col-span-5 bg-white rounded-xl p-3 lg:p-4 shadow-sm flex flex-col min-h-[250px] lg:min-h-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-800">Account Distribution</h3>
                <p className="text-[9px] sm:text-[10px] text-slate-400">By platform</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="relative w-full h-full max-w-[140px] max-h-[140px] lg:max-w-[180px] lg:max-h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="85%"
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      paddingAngle={2}
                    >
                      {pieData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell
                          key={index}
                          fill={entry.color}
                          stroke="white"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value}%`, name]}
                      contentStyle={{
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        background: 'white'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-800">{totalPlatformAccounts}</p>
                    <p className="text-[9px] text-slate-400">Total Accounts</p>
                  </div>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2 flex-shrink-0">
              {pieData.map((entry: { name: string; value: number; color: string }, index: number) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[10px] text-slate-600">{entry.name}</span>
                  <span className="text-[10px] font-semibold text-slate-700">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Platform Deposits + Recent Activity Feed - Takes ~23% height on desktop */}
        <div className="flex-1 grid grid-cols-6 lg:grid-cols-12 gap-2 lg:gap-2.5 min-h-fit">
          {/* Top Spenders */}
          <div className="col-span-6 lg:col-span-4 bg-white rounded-xl p-3 shadow-sm flex flex-col min-h-[200px] lg:min-h-0">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Top Spenders</h3>
                <p className="text-[9px] text-slate-400">By ad account recharges</p>
              </div>
              {/* Week Filter */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTopSpendersWeek('current')}
                  className={`px-2 py-1 text-[9px] font-medium rounded-md transition-all ${
                    topSpendersWeek === 'current'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setTopSpendersWeek('last')}
                  className={`px-2 py-1 text-[9px] font-medium rounded-md transition-all ${
                    topSpendersWeek === 'last'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Last Week
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {topSpendersLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                </div>
              ) : topSpendersData.length > 0 ? topSpendersData.map((spender: any, i: number) => {
                const maxSpend = Math.max(...topSpendersData.map((s: any) => s.totalSpend), 1)
                const rankColors = ['#F59E0B', '#94A3B8', '#CD7F32', '#3B82F6', '#8B5CF6']
                return (
                  <div key={spender.id} className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: rankColors[i] || '#64748B' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700 truncate">{spender.username}</span>
                        <span className="text-xs font-semibold text-slate-800">${formatAmount(spender.totalSpend)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (spender.totalSpend / maxSpend) * 100)}%`,
                            backgroundColor: rankColors[i] || '#64748B'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <TrendingUp className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No spenders yet</p>
                  <p className="text-[10px] text-slate-300">{topSpendersWeek === 'current' ? 'This week' : 'Last week'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="col-span-6 lg:col-span-8 bg-white rounded-xl p-3 shadow-sm flex flex-col min-h-[200px] lg:min-h-0">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
                  <p className="text-[9px] text-slate-400">Real-time user activities</p>
                </div>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-600">Live</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 'calc(100% - 40px)' }}>
              {recentActivity.length > 0 ? recentActivity.map((activity: any, i: number) => {
                const getActivityIcon = () => {
                  switch (activity.type) {
                    case 'application':
                      return <FileText className="w-3.5 h-3.5 text-blue-500" />
                    case 'recharge':
                      return <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                    case 'wallet_deposit':
                      return <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                    default:
                      return <Activity className="w-3.5 h-3.5 text-slate-400" />
                  }
                }

                const getActivityBg = () => {
                  switch (activity.type) {
                    case 'application':
                      return 'bg-blue-50'
                    case 'recharge':
                      return 'bg-purple-50'
                    case 'wallet_deposit':
                      return 'bg-emerald-50'
                    default:
                      return 'bg-slate-50'
                  }
                }

                const getActivityText = () => {
                  switch (activity.type) {
                    case 'application':
                      return `applied for ${activity.platform?.toLowerCase() || 'ad'} account`
                    case 'recharge':
                      return `submitted ${activity.platform?.toLowerCase() || 'ad'} recharge`
                    case 'wallet_deposit':
                      return 'submitted wallet deposit'
                    default:
                      return 'performed an action'
                  }
                }

                const getStatusColor = () => {
                  switch (activity.status) {
                    case 'APPROVED':
                      return 'text-emerald-600 bg-emerald-50'
                    case 'PENDING':
                      return 'text-amber-600 bg-amber-50'
                    case 'REJECTED':
                      return 'text-red-600 bg-red-50'
                    default:
                      return 'text-slate-600 bg-slate-50'
                  }
                }

                const timeAgo = (date: string) => {
                  const now = new Date()
                  const activityDate = new Date(date)
                  const diffMs = now.getTime() - activityDate.getTime()
                  const diffMins = Math.floor(diffMs / 60000)
                  const diffHours = Math.floor(diffMins / 60)
                  const diffDays = Math.floor(diffHours / 24)

                  if (diffMins < 1) return 'Just now'
                  if (diffMins < 60) return `${diffMins}m ago`
                  if (diffHours < 24) return `${diffHours}h ago`
                  if (diffDays < 7) return `${diffDays}d ago`
                  return activityDate.toLocaleDateString()
                }

                return (
                  <div
                    key={`${activity.type}-${activity.id}-${i}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-lg ${getActivityBg()} flex items-center justify-center flex-shrink-0`}>
                      {getActivityIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">{activity.username}</span>
                        <span className="text-[10px] text-slate-400">{getActivityText()}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {activity.amount && (
                          <span className="text-[11px] font-semibold text-slate-700">${formatAmount(activity.amount)}</span>
                        )}
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${getStatusColor()}`}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(activity.createdAt)}</span>
                  </div>
                )
              }) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs text-slate-400">No recent activity</p>
                  <p className="text-[10px] text-slate-300">Activities will appear here in real-time</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
