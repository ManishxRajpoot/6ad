'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/ui/StatCard'
import { Plus, Search, MoreVertical, DollarSign, Users, TrendingUp, Activity } from 'lucide-react'

interface PlatformPageProps {
  platform: string
  platformColor: string
}

const accounts = [
  { id: '1', name: 'Business Account 1', accountId: 'ACC-001', user: 'John Doe', status: 'ACTIVE', balance: 45000, spend: 32000 },
  { id: '2', name: 'Personal Account', accountId: 'ACC-002', user: 'Jane Smith', status: 'ACTIVE', balance: 28000, spend: 15000 },
  { id: '3', name: 'Agency Account', accountId: 'ACC-003', user: 'Mike Johnson', status: 'SUSPENDED', balance: 0, spend: 0 },
  { id: '4', name: 'E-commerce Account', accountId: 'ACC-004', user: 'Sarah Wilson', status: 'ACTIVE', balance: 67000, spend: 42000 },
]

export function PlatformPage({ platform, platformColor }: PlatformPageProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAccounts = accounts.filter(acc =>
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    acc.user.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <DashboardLayout title={`${platform} Accounts`} subtitle={`Manage ${platform} ad accounts`}>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Accounts"
          value="24"
          icon={Users}
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Total Balance"
          value="$4,52,000"
          icon={DollarSign}
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Monthly Spend"
          value="$2,89,000"
          icon={TrendingUp}
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Active Campaigns"
          value="18"
          icon={Activity}
          iconBgColor="bg-orange-100"
        />
      </div>

      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Account</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Balance</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Spend</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500">{account.accountId}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600">{account.user}</td>
                  <td className="py-4 px-4">{getStatusBadge(account.status)}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">${account.balance.toLocaleString()}</td>
                  <td className="py-4 px-4 text-gray-600">${account.spend.toLocaleString()}</td>
                  <td className="py-4 px-4">
                    <div className="flex justify-end">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  )
}
