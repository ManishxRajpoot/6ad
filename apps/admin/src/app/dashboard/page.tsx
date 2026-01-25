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
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
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
  { name: 'Facebook', value: 3500, color: '#1877F2' },
  { name: 'Google', value: 2800, color: '#4285F4' },
  { name: 'TikTok', value: 1800, color: '#000000' },
  { name: 'Snapchat', value: 1200, color: '#FFFC00' },
  { name: 'Bing', value: 700, color: '#00809D' },
]

const topAgents = [
  { name: 'Ali Batala', balance: '$10000', avatar: 'A', trend: 'up', change: '+12.5%' },
  { name: 'Sarah Wilson', balance: '$9000', avatar: 'S', trend: 'up', change: '+8.3%' },
  { name: 'Mike Johnson', balance: '$8500', avatar: 'M', trend: 'down', change: '-2.1%' },
  { name: 'Emma Davis', balance: '$7200', avatar: 'E', trend: 'up', change: '+15.2%' },
  { name: 'John Smith', balance: '$6800', avatar: 'J', trend: 'up', change: '+5.7%' },
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
  const [selectedYear, setSelectedYear] = useState(2025)

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Super Admin Dashboard">
      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stat-card {
          animation: fadeInUp 0.3s ease-out forwards;
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(139, 92, 246, 0.2);
        }
        .stat-card:nth-child(1) { animation-delay: 0.05s; }
        .stat-card:nth-child(2) { animation-delay: 0.1s; }
        .stat-card:nth-child(3) { animation-delay: 0.15s; }
        .stat-card:nth-child(4) { animation-delay: 0.2s; }
      `}</style>

      {/* Overview Section Title */}
      <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Overview</h2>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <div className="stat-card bg-white rounded-xl p-5 border border-gray-100/50 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#52B788]/5 to-transparent rounded-full -mr-12 -mt-12" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#52B788]/10 to-[#52B788]/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-[#52B788]" />
              </div>
              <span className="text-xs font-semibold text-[#52B788] bg-emerald-50 px-2.5 py-1 rounded-full">Agents</span>
            </div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">${stats.totalRevenue.toLocaleString()}</p>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-[#52B788]" />
              <span className="text-xs font-semibold text-[#52B788]">+12.5%</span>
              <span className="text-xs text-gray-400">from last month</span>
            </div>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="stat-card bg-white rounded-xl p-5 border border-gray-100/50 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#8B5CF6]/5 to-transparent rounded-full -mr-12 -mt-12" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <span className="text-xs font-semibold text-[#8B5CF6] bg-purple-50 px-2.5 py-1 rounded-full">Requests</span>
            </div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Pending Requests</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{stats.pendingRequests.toLocaleString()}</p>
            <div className="flex items-center gap-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-[#EF4444]" />
              <span className="text-xs font-semibold text-[#EF4444]">-2.3%</span>
              <span className="text-xs text-gray-400">from last week</span>
            </div>
          </div>
        </div>

        {/* Avg Daily Users */}
        <div className="stat-card bg-white rounded-xl p-5 border border-gray-100/50 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#3B82F6]/5 to-transparent rounded-full -mr-12 -mt-12" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3B82F6]/10 to-[#3B82F6]/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-[#3B82F6]" />
              </div>
              <span className="text-xs font-semibold text-[#3B82F6] bg-blue-50 px-2.5 py-1 rounded-full">Users</span>
            </div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Avg Daily Users</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{stats.avgDailyUsers.toFixed(2)}</p>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-[#52B788]" />
              <span className="text-xs font-semibold text-[#52B788]">+5.2%</span>
              <span className="text-xs text-gray-400">from yesterday</span>
            </div>
          </div>
        </div>

        {/* Monthly Growth */}
        <div className="stat-card bg-white rounded-xl p-5 border border-gray-100/50 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#F59E0B]/5 to-transparent rounded-full -mr-12 -mt-12" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <span className="text-xs font-semibold text-[#F59E0B] bg-orange-50 px-2.5 py-1 rounded-full">Growth</span>
            </div>
            <p className="text-xs text-gray-500 mb-1 font-medium">Monthly Growth</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{stats.monthlyGrowth}%</p>
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-[#52B788]" />
              <span className="text-xs font-semibold text-[#52B788]">+1.2%</span>
              <span className="text-xs text-gray-400">from last month</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Total Revenue Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-100/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Total Revenue</h3>
              <p className="text-xs text-gray-500 mt-0.5">Monthly revenue trend</p>
            </div>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8B5CF6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ad Amount Statistics */}
        <div className="bg-white rounded-xl p-6 border border-gray-100/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Platform Distribution</h3>
              <p className="text-xs text-gray-500 mt-0.5">Active accounts by platform</p>
            </div>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]">
              <option>This Month</option>
              <option>Last Month</option>
            </select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {platformData.map((platform) => (
                <div key={platform.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: platform.color }}
                    />
                    <span className="text-sm text-gray-700 font-medium">{platform.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">${platform.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Performance */}
        <div className="bg-white rounded-xl p-6 border border-gray-100/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Agent Performance</h3>
              <p className="text-xs text-gray-500 mt-0.5">Top performing agents this month</p>
            </div>
            <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]">
              <option>Last 6 Months</option>
              <option>This Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={agentPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Line type="monotone" dataKey="agent1" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 4 }} />
              <Line type="monotone" dataKey="agent2" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} />
              <Line type="monotone" dataKey="agent3" stroke="#52B788" strokeWidth={2} dot={{ fill: '#52B788', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Agents */}
        <div className="bg-white rounded-xl p-6 border border-gray-100/50 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Top Agents</h3>
              <p className="text-xs text-gray-500 mt-0.5">Highest revenue generators</p>
            </div>
            <button className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] font-semibold">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {topAgents.map((agent, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-md">
                      <span className="text-white font-semibold text-sm">{agent.avatar}</span>
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                      agent.trend === 'up' ? 'bg-[#52B788]' : 'bg-[#EF4444]'
                    }`}>
                      {agent.trend === 'up' ? (
                        <TrendingUp className="w-2.5 h-2.5 text-white" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`text-xs font-semibold ${
                        agent.trend === 'up' ? 'text-[#52B788]' : 'text-[#EF4444]'
                      }`}>
                        {agent.change}
                      </span>
                      <span className="text-xs text-gray-400">this month</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{agent.balance}</p>
                  <span className="text-xs text-gray-400">Revenue</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
