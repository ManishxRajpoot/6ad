'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { dashboardApi, agentsApi, transactionsApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  DollarSign,
  Users,
  UserCog,
  TrendingUp,
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
} from 'recharts'

const revenueData = [
  { name: 'Jan', revenue: 4000 },
  { name: 'Feb', revenue: 3000 },
  { name: 'Mar', revenue: 5000 },
  { name: 'Apr', revenue: 4500 },
  { name: 'May', revenue: 6000 },
  { name: 'Jun', revenue: 5500 },
]

const platformData = [
  { name: 'Facebook', value: 40, color: '#4267B2' },
  { name: 'Google', value: 25, color: '#DB4437' },
  { name: 'TikTok', value: 20, color: '#000000' },
  { name: 'Snapchat', value: 10, color: '#FFFC00' },
  { name: 'Bing', value: 5, color: '#008373' },
]

type Stats = {
  totalRevenue: number
  totalAgents: number
  totalUsers: number
  pendingDeposits: number
  pendingWithdrawals: number
  monthlyGrowth: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalAgents: 0,
    totalUsers: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    monthlyGrowth: 0,
  })
  const [recentAgents, setRecentAgents] = useState<any[]>([])
  const [recentDeposits, setRecentDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashboardData, agentsData, depositsData] = await Promise.all([
          dashboardApi.getStats(),
          agentsApi.getAll(),
          transactionsApi.deposits.getAll(),
        ])

        setStats({
          totalRevenue: dashboardData.stats?.totalRevenue || 43000,
          totalAgents: dashboardData.stats?.totalAgents || agentsData.agents?.length || 0,
          totalUsers: dashboardData.stats?.totalUsers || 0,
          pendingDeposits: dashboardData.stats?.pendingDeposits || 0,
          pendingWithdrawals: dashboardData.stats?.pendingWithdrawals || 0,
          monthlyGrowth: dashboardData.stats?.monthlyGrowth || 13.59,
        })

        setRecentAgents(agentsData.agents?.slice(0, 5) || [])
        setRecentDeposits(depositsData.deposits?.slice(0, 5) || [])
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
      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          change="+12.5% from last month"
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-green-100 text-green-600"
        />
        <StatCard
          title="Total Agents"
          value={stats.totalAgents}
          change="+3 this week"
          changeType="positive"
          icon={UserCog}
          iconColor="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          change="+25 this month"
          changeType="positive"
          icon={Users}
          iconColor="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Monthly Growth"
          value={`${stats.monthlyGrowth}%`}
          change="Compared to last month"
          changeType="positive"
          icon={TrendingUp}
          iconColor="bg-orange-100 text-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Ad Amount Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {platformData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {platformData.map((platform) => (
                <div key={platform.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: platform.color }}
                  />
                  <span className="text-sm text-gray-600">{platform.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top Agents</CardTitle>
            <a href="/agents" className="text-sm text-primary-500 hover:underline">
              View All
            </a>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Agent</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Balance</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAgents.length > 0 ? (
                  recentAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-600">
                            {agent.username?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <div>
                            <p className="font-medium">{agent.username}</p>
                            <p className="text-xs text-gray-500">{agent.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(agent.balance || 0)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">
                      No agents found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Deposits */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Deposits</CardTitle>
            <a href="/transactions" className="text-sm text-primary-500 hover:underline">
              View All
            </a>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>User</TableCell>
                  <TableCell header>Amount</TableCell>
                  <TableCell header>Status</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentDeposits.length > 0 ? (
                  recentDeposits.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ArrowUpRight className="h-4 w-4 text-green-500" />
                          <span>{deposit.user?.username || 'User'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        +{formatCurrency(deposit.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            deposit.status === 'APPROVED'
                              ? 'success'
                              : deposit.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {deposit.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500">
                      No deposits found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
