'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { accountsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Search, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'

interface AdAccount {
  id: string
  platform: string
  accountId: string
  accountName?: string
  status: string
  createdAt: string
}

export default function AccountsPage() {
  const { isHydrated, isAuthenticated } = useAuthStore()
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return
    fetchAccounts()
  }, [isHydrated, isAuthenticated])

  const fetchAccounts = async () => {
    try {
      const data = await accountsApi.getAll()
      setAccounts(data.accounts || [])
    } catch {
      // Show empty state
    } finally {
      setLoading(false)
    }
  }

  const filtered = accounts.filter(a =>
    !search ||
    a.accountId?.toLowerCase().includes(search.toLowerCase()) ||
    a.accountName?.toLowerCase().includes(search.toLowerCase()) ||
    a.platform?.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (status) {
      case 'ACTIVE':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
          <CheckCircle className="w-3 h-3" /> Active
        </span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}>
          <Clock className="w-3 h-3" /> Pending
        </span>
      case 'SUSPENDED':
      case 'REFUNDED':
        return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
          <XCircle className="w-3 h-3" /> {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform?.toUpperCase()) {
      case 'FACEBOOK': return 'bg-[#1877F2]'
      case 'GOOGLE': return 'bg-[#4285F4]'
      case 'TIKTOK': return 'bg-black'
      case 'SNAPCHAT': return 'bg-[#FFFC00] !text-black'
      case 'BING': return 'bg-[#00809D]'
      default: return 'bg-gray-500'
    }
  }

  const getPlatformLabel = (platform: string) => {
    return platform?.charAt(0).toUpperCase() + platform?.slice(1).toLowerCase()
  }

  return (
    <DashboardLayout title="My Accounts" subtitle="All your ad accounts across platforms">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <span className="text-sm text-gray-500">{filtered.length} account{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No accounts match your search' : 'No ad accounts yet. Apply for an account from a platform page.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((account) => (
              <div key={account.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${getPlatformColor(account.platform)}`}>
                      <span className="font-bold">{account.platform?.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.accountName || account.accountId}</h3>
                      <p className="text-sm text-gray-500">{account.accountId}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {getStatusBadge(account.status)}
                  <span className="text-sm text-gray-500">{getPlatformLabel(account.platform)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
