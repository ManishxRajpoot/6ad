'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Users, Wallet, TrendingUp, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const revenueData = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 5000 },
  { name: 'Apr', value: 4500 },
  { name: 'May', value: 6000 },
  { name: 'Jun', value: 5500 },
  { name: 'Jul', value: 7000 },
]

const platformData = [
  { name: 'Facebook', value: 35, color: '#1877F2' },
  { name: 'Google', value: 30, color: '#4285F4' },
  { name: 'TikTok', value: 20, color: '#000000' },
  { name: 'Snapchat', value: 10, color: '#FFFC00' },
  { name: 'Bing', value: 5, color: '#00809D' },
]

const recentUsers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', balance: '$4,500' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Active', balance: '$3,200' },
  { id: 3, name: 'Mike Johnson', email: 'mike@example.com', status: 'Pending', balance: '$1,850' },
  { id: 4, name: 'Sarah Wilson', email: 'sarah@example.com', status: 'Active', balance: '$6,720' },
]

export default function DashboardPage() {
  return (
    <DashboardLayout title="Dashboard" subtitle="Welcome back to your agency dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Users"
          value="156"
          change="+12 this month"
          changeType="positive"
          icon={Users}
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Total Balance"
          value="$45,200"
          change="+8.2% from last month"
          changeType="positive"
          icon={Wallet}
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Total Deposits"
          value="$124,500"
          change="+15.3% this month"
          changeType="positive"
          icon={ArrowDownCircle}
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Total Withdrawals"
          value="$82,300"
          change="+5.7% this month"
          changeType="neutral"
          icon={ArrowUpCircle}
          iconBgColor="bg-orange-100"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Revenue Overview</h3>
              <p className="text-sm text-gray-500">Monthly revenue trend</p>
            </div>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#7C3AED" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Platform Distribution */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Platform Distribution</h3>
          <p className="text-sm text-gray-500 mb-4">Active accounts by platform</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={platformData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
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
          <div className="flex flex-wrap gap-3 mt-4">
            {platformData.map((platform) => (
              <div key={platform.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: platform.color }} />
                <span className="text-xs text-gray-600">{platform.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Users */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recent Users</h3>
            <p className="text-sm text-gray-500">Latest user activity</p>
          </div>
          <a href="/users" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
            View All
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Balance</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-500 font-medium text-sm">{user.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{user.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  )
}
