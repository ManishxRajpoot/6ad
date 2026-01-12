'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Wallet, TrendingUp, ArrowDownCircle, ArrowUpCircle, Plus } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const spendData = [
  { name: 'Jan', value: 2000 },
  { name: 'Feb', value: 3500 },
  { name: 'Mar', value: 2800 },
  { name: 'Apr', value: 4200 },
  { name: 'May', value: 3800 },
  { name: 'Jun', value: 5000 },
  { name: 'Jul', value: 4500 },
]

const recentAccounts = [
  { id: '1', name: 'Facebook Business', platform: 'Facebook', status: 'ACTIVE', balance: 25000 },
  { id: '2', name: 'Google Ads Main', platform: 'Google', status: 'ACTIVE', balance: 18000 },
  { id: '3', name: 'TikTok Ads', platform: 'TikTok', status: 'PENDING', balance: 0 },
]

const recentTransactions = [
  { id: 'TXN001', type: 'DEPOSIT', amount: 50000, status: 'COMPLETED', date: '2024-01-15' },
  { id: 'TXN002', type: 'SPEND', amount: -12000, status: 'COMPLETED', date: '2024-01-14' },
  { id: 'TXN003', type: 'WITHDRAWAL', amount: -20000, status: 'PENDING', date: '2024-01-13' },
]

export default function DashboardPage() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'COMPLETED':
        return <Badge variant="success">{status === 'ACTIVE' ? 'Active' : 'Completed'}</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <DashboardLayout title="Dashboard" subtitle="Welcome back! Here's your account overview">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Balance"
          value="₹43,000"
          change="Available to spend"
          changeType="neutral"
          icon={Wallet}
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Total Spent"
          value="₹1,25,000"
          change="+15% from last month"
          changeType="positive"
          icon={TrendingUp}
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Total Deposits"
          value="₹2,00,000"
          change="All time"
          changeType="neutral"
          icon={ArrowDownCircle}
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Withdrawals"
          value="₹32,000"
          change="All time"
          changeType="neutral"
          icon={ArrowUpCircle}
          iconBgColor="bg-orange-100"
        />
      </div>

      {/* Charts and Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Spend Chart */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold">Spending Overview</h3>
              <p className="text-sm text-gray-500">Your ad spend trend</p>
            </div>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
              <option>This Year</option>
              <option>Last Year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={spendData}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#7C3AED" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Funds
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Withdraw Funds
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Wallet className="w-4 h-4 mr-2" />
              Request Account
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Support</h4>
            <p className="text-sm text-gray-600 mb-2">Need help? Contact your agent</p>
            <Button size="sm" variant="secondary">Contact Agent</Button>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Accounts */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">My Accounts</h3>
            <a href="/accounts" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
              View All
            </a>
          </div>
          <div className="space-y-3">
            {recentAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 font-medium text-sm">{account.platform.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{account.name}</p>
                    <p className="text-sm text-gray-500">{account.platform}</p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(account.status)}
                  <p className="text-sm font-medium text-gray-900 mt-1">₹{account.balance.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <a href="/transactions" className="text-sm text-primary-500 hover:text-primary-600 font-medium">
              View All
            </a>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    txn.type === 'DEPOSIT' ? 'bg-green-100' : txn.type === 'SPEND' ? 'bg-purple-100' : 'bg-orange-100'
                  }`}>
                    {txn.type === 'DEPOSIT' ? (
                      <ArrowDownCircle className="w-5 h-5 text-green-600" />
                    ) : txn.type === 'SPEND' ? (
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    ) : (
                      <ArrowUpCircle className="w-5 h-5 text-orange-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{txn.type}</p>
                    <p className="text-sm text-gray-500">{txn.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${txn.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {txn.amount > 0 ? '+' : ''}₹{Math.abs(txn.amount).toLocaleString()}
                  </p>
                  {getStatusBadge(txn.status)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
