'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Search, Plus, MoreVertical } from 'lucide-react'

const accounts = [
  { id: '1', name: 'Facebook Business Account', platform: 'Facebook', accountId: 'FB-123456', status: 'ACTIVE', balance: 25000, spend: 42000 },
  { id: '2', name: 'Google Ads Main', platform: 'Google', accountId: 'GA-789012', status: 'ACTIVE', balance: 18000, spend: 35000 },
  { id: '3', name: 'TikTok For Business', platform: 'TikTok', accountId: 'TT-345678', status: 'PENDING', balance: 0, spend: 0 },
  { id: '4', name: 'Snapchat Ads', platform: 'Snapchat', accountId: 'SC-901234', status: 'ACTIVE', balance: 12000, spend: 8000 },
]

export default function AccountsPage() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'Facebook':
        return 'bg-[#1877F2]'
      case 'Google':
        return 'bg-[#4285F4]'
      case 'TikTok':
        return 'bg-black'
      case 'Snapchat':
        return 'bg-[#FFFC00] !text-black'
      case 'Bing':
        return 'bg-[#00809D]'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <DashboardLayout title="My Accounts" subtitle="Manage your ad accounts across platforms">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Request New Account
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${getPlatformColor(account.platform)}`}>
                    <span className="font-bold">{account.platform.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{account.name}</h3>
                    <p className="text-sm text-gray-500">{account.accountId}</p>
                  </div>
                </div>
                <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                {getStatusBadge(account.status)}
                <span className="text-sm text-gray-500">{account.platform}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Balance</p>
                  <p className="text-lg font-semibold text-gray-900">₹{account.balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Total Spend</p>
                  <p className="text-lg font-semibold text-gray-900">₹{account.spend.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  )
}
