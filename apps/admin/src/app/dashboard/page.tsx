'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { dashboardApi, agentsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BarChart3,
} from 'lucide-react'
import {
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
  AreaChart,
  Area,
} from 'recharts'

// Sample data matching Figma
const revenueData = [
  { name: 'Jan', value: 30000 },
  { name: 'Feb', value: 25000 },
  { name: 'Mar', value: 35000 },
  { name: 'Apr', value: 28000 },
  { name: 'May', value: 42000 },
  { name: 'Jun', value: 38000 },
  { name: 'Jul', value: 45000 },
  { name: 'Aug', value: 43000 },
]

const agentPerformanceData = [
  { name: 'Jan', agent1: 4000, agent2: 2400, agent3: 2400 },
  { name: 'Feb', agent1: 3000, agent2: 1398, agent3: 2210 },
  { name: 'Mar', agent1: 2000, agent2: 9800, agent3: 2290 },
  { name: 'Apr', agent1: 2780, agent2: 3908, agent3: 2000 },
  { name: 'May', agent1: 1890, agent2: 4800, agent3: 2181 },
  { name: 'Jun', agent1: 2390, agent2: 3800, agent3: 2500 },
]

const platformData = [
  { name: 'Facebook', value: 3500, color: '#8B5CF6' },
  { name: 'Google', value: 2800, color: '#3B82F6' },
  { name: 'TikTok', value: 1800, color: '#10B981' },
  { name: 'Snapchat', value: 1200, color: '#F59E0B' },
  { name: 'Bing', value: 700, color: '#EC4899' },
]

const topAgents = [
  { name: 'Ali Batala', balance: '$10000', avatar: 'A' },
  { name: 'Ali Batala', balance: '$9000', avatar: 'A' },
  { name: 'Ali Batala', balance: '$8500', avatar: 'A' },
  { name: 'Ali Batala', balance: '$7200', avatar: 'A' },
  { name: 'Ali Batala', balance: '$6800', avatar: 'A' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalRevenue: 43000,
    pendingRequests: 6643,
    avgDailyUsers: 25.5456,
    monthlyGrowth: 13.59,
  })
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardData, agentsData] = await Promise.all([
          dashboardApi.getStats().catch(() => ({})),
          agentsApi.getAll().catch(() => ({ agents: [] })),
        ])

        if (dashboardData.stats) {
          setStats({
            totalRevenue: dashboardData.stats.totalRevenue || 43000,
            pendingRequests: dashboardData.stats.pendingRequests || 6643,
            avgDailyUsers: dashboardData.stats.avgDailyUsers || 25.5456,
            monthlyGrowth: dashboardData.stats.monthlyGrowth || 13.59,
          })
        }

        setAgents(agentsData.agents?.slice(0, 5) || [])
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <DashboardLayout title="Super Admin Dashboard">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Super Admin Dashboard">
      {/* Stats Cards Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-500 bg-green-50 text-green-600 px-2 py-0.5 rounded">Agents</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">+12.5%</span>
            <span className="text-xs text-gray-400">from last month</span>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">Request</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Pending Requests</p>
          <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingDown className="h-3 w-3 text-red-500" />
            <span className="text-xs text-red-500">-2.3%</span>
            <span className="text-xs text-gray-400">from last week</span>
          </div>
        </div>

        {/* Avg Daily Users */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Users</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Avg Daily Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgDailyUsers.toFixed(4)}</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">+5.2%</span>
            <span className="text-xs text-gray-400">from yesterday</span>
          </div>
        </div>

        {/* Monthly Growth */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Growth</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Monthly Growth</p>
          <p className="text-2xl font-bold text-gray-900">{stats.monthlyGrowth}%</p>
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">+1.2%</span>
            <span className="text-xs text-gray-400">from last month</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Total Revenue Chart */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Total Revenue</h3>
            <select className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ad Amount Statistics */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Ad Amount Statistics</h3>
            <select className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>
          <div className="flex items-center">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2">
              {platformData.map((platform) => (
                <div key={platform.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: platform.color }} />
                    <span className="text-xs text-gray-600">{platform.name}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-900">${platform.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Agent Performance */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Agents Performance</h3>
            <select className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={agentPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip />
              <Line type="monotone" dataKey="agent1" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="agent2" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="agent3" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Agents */}
        <div className="bg-white rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Top 5 Agents</h3>
            <a href="/agents" className="text-xs text-primary-500 hover:underline">View All</a>
          </div>
          <div className="space-y-3">
            {(agents.length > 0 ? agents : topAgents).map((agent, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                    {agent.username?.charAt(0) || agent.avatar || 'A'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{agent.username || agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.email || 'Agent'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {agent.walletBalance ? `$${agent.walletBalance}` : agent.balance}
                  </p>
                  <p className="text-xs text-green-500">Active</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
