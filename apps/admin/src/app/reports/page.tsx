'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { reportsApi } from '@/lib/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  ChevronDown,
  Loader2,
  TrendingUp,
  DollarSign,
  Users,
  Briefcase,
  Download,
} from 'lucide-react'

type Agent = {
  id: string
  username: string
  email: string
  realName?: string
}

type TimelineEntry = {
  date: string
  commission: number
  openingFees: number
  total: number
}

type PlatformEntry = {
  platform: string
  commission: number
  openingFees: number
  total: number
  accounts: number
}

type AgentEntry = {
  id: string
  username: string
  email: string
  realName?: string
  commission: number
  openingFees: number
  total: number
  users: number
}

type PeriodType = 'daily' | 'weekly' | 'monthly'

const PLATFORM_COLORS: Record<string, string> = {
  FACEBOOK: '#1877F2',
  GOOGLE: '#EA4335',
  TIKTOK: '#000000',
  SNAPCHAT: '#FFFC00',
  BING: '#00809D',
}

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
  SNAPCHAT: 'Snapchat',
  BING: 'Bing',
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [months, setMonths] = useState(6)
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false)

  // Data
  const [summary, setSummary] = useState({
    totalCommission: 0,
    totalOpeningFees: 0,
    totalEarned: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
    availableBalance: 0,
  })
  const [currentMonth, setCurrentMonth] = useState({
    commission: 0,
    openingFees: 0,
    totalEarned: 0,
    withdrawn: 0,
  })
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [platformBreakdown, setPlatformBreakdown] = useState<PlatformEntry[]>([])
  const [agentBreakdown, setAgentBreakdown] = useState<AgentEntry[]>([])

  // Period tabs
  const [activePeriod, setActivePeriod] = useState<PeriodType>('monthly')
  const dailyRef = useRef<HTMLButtonElement>(null)
  const weeklyRef = useRef<HTMLButtonElement>(null)
  const monthlyRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const tabRefMap: Record<PeriodType, React.RefObject<HTMLButtonElement | null>> = {
      daily: dailyRef,
      weekly: weeklyRef,
      monthly: monthlyRef,
    }
    const el = tabRefMap[activePeriod]?.current
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth })
    }
  }, [activePeriod])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const data = await reportsApi.getAgentEarnings({
        agentId: selectedAgent === 'all' ? undefined : selectedAgent,
        period: activePeriod,
        months,
      })
      setAgents(data.agents || [])
      setSummary(data.summary || {})
      setCurrentMonth(data.currentMonth || { commission: 0, openingFees: 0, totalEarned: 0, withdrawn: 0 })
      setTimeline(data.timeline || [])
      setPlatformBreakdown(data.platformBreakdown || [])
      setAgentBreakdown(data.agentBreakdown || [])
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [selectedAgent, activePeriod, months])

  const formatDate = (dateStr: string) => {
    if (activePeriod === 'monthly') {
      const [year, month] = dateStr.split('-')
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      return `${monthNames[parseInt(month) - 1]} ${year}`
    }
    if (activePeriod === 'weekly') {
      const d = new Date(dateStr + 'T00:00:00')
      const endOfWeek = new Date(d)
      endOfWeek.setDate(d.getDate() + 6)
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <DashboardLayout title="Reports">
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.25s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Agent Filter */}
          <div className="relative">
            <button
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 flex items-center gap-2 transition-all min-w-[180px]"
            >
              <Users className="h-4 w-4 text-gray-400" />
              <span>{selectedAgent === 'all' ? 'All Agents' : agents.find(a => a.id === selectedAgent)?.username || 'Select Agent'}</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform duration-200 ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAgentDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setIsAgentDropdownOpen(false)} />
                <div className="absolute left-0 top-12 z-[70] w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 max-h-72 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedAgent('all'); setIsAgentDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedAgent === 'all' ? 'bg-violet-50 text-violet-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Agents
                  </button>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => { setSelectedAgent(agent.id); setIsAgentDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        selectedAgent === agent.id ? 'bg-violet-50 text-violet-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium">{agent.username}</span>
                      <span className="text-gray-400 ml-2 text-xs">{agent.email}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Time Range */}
          <div className="relative">
            <select
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value))}
              className="h-10 appearance-none rounded-lg border border-gray-200 bg-white pl-4 pr-10 text-sm text-gray-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value={1}>Last 1 Month</option>
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="w-6 h-6 text-violet-600 animate-spin mb-2" />
            <span className="text-gray-500 text-sm">Loading report...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards — Current Month Only (resets each month) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <Card className="p-4 relative overflow-hidden min-h-[95px]">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[13px] text-gray-500">This Month Earned</span>
                  <p className="text-2xl font-bold text-gray-800">${currentMonth.totalEarned.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-violet-500 text-white text-[11px] font-medium rounded">
                  {new Date().toLocaleString('en-US', { month: 'short' })}
                </span>
              </div>
              <StatsChart value={currentMonth.totalEarned} color="#8B5CF6" filterId="glowVioletRp" gradientId="fadeVioletRp" clipId="clipVioletRp" />
            </Card>

            <Card className="p-4 relative overflow-hidden min-h-[95px]">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[13px] text-gray-500">This Month Commission</span>
                  <p className="text-2xl font-bold text-gray-800">${currentMonth.commission.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-[11px] font-medium rounded">Deposits</span>
              </div>
              <StatsChart value={currentMonth.commission} color="#3B82F6" filterId="glowBlueRp" gradientId="fadeBlueRp" clipId="clipBlueRp" />
            </Card>

            <Card className="p-4 relative overflow-hidden min-h-[95px]">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[13px] text-gray-500">This Month Fees</span>
                  <p className="text-2xl font-bold text-gray-800">${currentMonth.openingFees.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-amber-500 text-white text-[11px] font-medium rounded">Accounts</span>
              </div>
              <StatsChart value={currentMonth.openingFees} color="#F59E0B" filterId="glowAmberRp" gradientId="fadeAmberRp" clipId="clipAmberRp" />
            </Card>

            <Card className="p-4 relative overflow-hidden min-h-[95px]">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-[13px] text-gray-500">This Month Withdrawn</span>
                  <p className="text-2xl font-bold text-gray-800">${currentMonth.withdrawn.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#0D9488] text-white text-[11px] font-medium rounded">Paid</span>
              </div>
              <StatsChart value={currentMonth.withdrawn} color="#0D9488" filterId="glowTealRp" gradientId="fadeTealRp" clipId="clipTealRp" />
            </Card>
          </div>

          {/* Earnings Chart */}
          <Card className="p-0 overflow-hidden mb-5">
            {/* Period Tabs */}
            <div className="border-b border-gray-100">
              <div className="flex relative px-2">
                <button
                  ref={dailyRef}
                  onClick={() => setActivePeriod('daily')}
                  className={`px-5 py-3.5 text-[14px] font-medium transition-all duration-300 ease-out relative z-10 ${
                    activePeriod === 'daily' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Daily
                </button>
                <button
                  ref={weeklyRef}
                  onClick={() => setActivePeriod('weekly')}
                  className={`px-5 py-3.5 text-[14px] font-medium transition-all duration-300 ease-out relative z-10 ${
                    activePeriod === 'weekly' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Weekly
                </button>
                <button
                  ref={monthlyRef}
                  onClick={() => setActivePeriod('monthly')}
                  className={`px-5 py-3.5 text-[14px] font-medium transition-all duration-300 ease-out relative z-10 ${
                    activePeriod === 'monthly' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Monthly
                </button>
                <div
                  className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out"
                  style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
                />
              </div>
            </div>

            <div className="p-5">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No earnings data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        padding: '12px 16px',
                        fontSize: '13px',
                      }}
                      formatter={(value: number, name: string) => [
                        `$${value.toLocaleString()}`,
                        name === 'commission' ? 'Commission' : 'Opening Fees'
                      ]}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Area
                      type="monotone"
                      dataKey="commission"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      fill="url(#colorCommission)"
                      name="commission"
                    />
                    <Area
                      type="monotone"
                      dataKey="openingFees"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fill="url(#colorFees)"
                      name="openingFees"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Bottom Section: Platform Breakdown + Agent Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Platform Breakdown — Table style */}
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-gray-900">Platform Breakdown</h3>
                <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                  {platformBreakdown.reduce((s, p) => s + p.accounts, 0)} total accounts
                </span>
              </div>
              {platformBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No platform data</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/80">
                      <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Platform</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Commission</th>
                      <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Fees</th>
                      <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformBreakdown.map((p, index) => {
                      const grandTotal = platformBreakdown.reduce((s, x) => s + x.total, 0)
                      const pct = grandTotal > 0 ? Math.round((p.total / grandTotal) * 100) : 0
                      return (
                        <tr
                          key={p.platform}
                          className="border-b border-gray-50 hover:bg-gray-50/50 tab-row-animate"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: PLATFORM_COLORS[p.platform] || '#6B7280' }}
                              >
                                {(PLATFORM_LABELS[p.platform] || p.platform).charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{PLATFORM_LABELS[p.platform] || p.platform}</p>
                                <p className="text-[11px] text-gray-400">{p.accounts} accounts · {pct}%</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="text-sm text-violet-600 font-medium">${p.commission.toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="text-sm text-amber-600 font-medium">${p.openingFees.toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-sm font-bold text-gray-900">${p.total.toLocaleString()}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-violet-50/40 border-t border-violet-100">
                      <td className="py-3 px-5 text-sm font-bold text-violet-700">Total</td>
                      <td className="py-3 px-3 text-right text-sm font-bold text-violet-600">
                        ${platformBreakdown.reduce((s, p) => s + p.commission, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-bold text-amber-600">
                        ${platformBreakdown.reduce((s, p) => s + p.openingFees, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-5 text-right text-sm font-bold text-gray-900">
                        ${platformBreakdown.reduce((s, p) => s + p.total, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>

            {/* Agent Leaderboard — Table style */}
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-gray-900">
                  {selectedAgent === 'all' ? 'Agent Leaderboard' : 'Agent Details'}
                </h3>
                <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                  {agentBreakdown.length} agents
                </span>
              </div>
              {agentBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No agent data</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                        <th className="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">Agent</th>
                        <th className="text-center py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">Users</th>
                        <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">Commission</th>
                        <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">Fees</th>
                        <th className="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentBreakdown.map((agent, index) => (
                        <tr
                          key={agent.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 tab-row-animate"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' :
                                index === 1 ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' :
                                index === 2 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {index < 3 ? (index + 1) : agent.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{agent.username}</p>
                                <p className="text-[11px] text-gray-400">{agent.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                              {agent.users}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="text-sm text-violet-600 font-medium">${agent.commission.toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <span className="text-sm text-amber-600 font-medium">${agent.openingFees.toLocaleString()}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-sm font-bold text-gray-900">${agent.total.toLocaleString()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10">
                      <tr className="bg-violet-50/90 border-t border-violet-100 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
                        <td className="py-3 px-5 text-sm font-bold text-violet-700 bg-violet-50/90">Total</td>
                        <td className="py-3 px-3 text-center text-sm font-bold text-gray-600 bg-violet-50/90">
                          {agentBreakdown.reduce((s, a) => s + a.users, 0)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-bold text-violet-600 bg-violet-50/90">
                          ${agentBreakdown.reduce((s, a) => s + a.commission, 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-bold text-amber-600 bg-violet-50/90">
                          ${agentBreakdown.reduce((s, a) => s + a.openingFees, 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-right text-sm font-bold text-gray-900 bg-violet-50/90">
                          ${agentBreakdown.reduce((s, a) => s + a.total, 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Detailed Table */}
          {timeline.length > 0 && (
            <Card className="p-0 overflow-hidden mt-5">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h3 className="text-[15px] font-semibold text-gray-900">
                  {activePeriod === 'daily' ? 'Daily' : activePeriod === 'weekly' ? 'Weekly' : 'Monthly'} Earnings Breakdown
                </h3>
              </div>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                      <th className="text-left py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Period</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Commission</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Opening Fees</th>
                      <th className="text-right py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...timeline].reverse().map((entry, index) => (
                      <tr
                        key={entry.date}
                        className="border-b border-gray-100 hover:bg-gray-50/50 tab-row-animate"
                        style={{ animationDelay: `${index * 15}ms` }}
                      >
                        <td className="py-2.5 px-4 text-gray-700 font-medium">{formatDate(entry.date)}</td>
                        <td className="py-2.5 px-4 text-right text-violet-600 font-medium">${entry.commission.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-amber-600 font-medium">${entry.openingFees.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right text-gray-900 font-bold">${entry.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-violet-50/50 border-t-2 border-violet-200">
                      <td className="py-3 px-4 text-violet-700 font-bold">Total</td>
                      <td className="py-3 px-4 text-right text-violet-600 font-bold">
                        ${timeline.reduce((s, e) => s + e.commission, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600 font-bold">
                        ${timeline.reduce((s, e) => s + e.openingFees, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 font-bold">
                        ${timeline.reduce((s, e) => s + e.total, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
