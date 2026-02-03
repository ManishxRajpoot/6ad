'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import {
  Gift,
  Users,
  DollarSign,
  TrendingUp,
  Search,
  Loader2,
  Settings,
  User,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { referralsApi, settingsApi } from '@/lib/api'

interface Referral {
  id: string
  referrerId: string
  referrer: {
    username: string
    email: string
  }
  referredUserId: string
  referredUser: {
    username: string
    email: string
  }
  status: 'PENDING' | 'QUALIFIED' | 'REWARDED'
  rewardAmount: number
  qualifiedAt?: string
  rewardedAt?: string
  createdAt: string
}

interface ReferralSettings {
  rewardAmount: number
  minimumDeposit: number
  enabled: boolean
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'QUALIFIED' | 'REWARDED'>('all')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settings, setSettings] = useState<ReferralSettings>({
    rewardAmount: 10,
    minimumDeposit: 100,
    enabled: true,
  })

  const fetchReferrals = async () => {
    try {
      const res = await referralsApi.getAll()
      setReferrals(res.referrals || [])
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await settingsApi.referrals.get()
      if (res.settings) {
        setSettings({
          rewardAmount: res.settings.commissionRate || 10,
          minimumDeposit: res.settings.minWithdrawal || 100,
          enabled: true,
        })
      }
    } catch {
      // Use defaults
    }
  }

  useEffect(() => {
    fetchReferrals()
    fetchSettings()
  }, [])

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      await settingsApi.referrals.update({
        commissionRate: settings.rewardAmount,
        minWithdrawal: settings.minimumDeposit,
      })
      setIsSettingsOpen(false)
    } catch {
      alert('Failed to save settings')
    } finally {
      setIsSavingSettings(false)
    }
  }

  const filteredReferrals = referrals.filter(ref => {
    const matchesSearch =
      ref.referrer.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referrer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredUser.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.referredUser.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || ref.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === 'PENDING').length,
    qualified: referrals.filter(r => r.status === 'QUALIFIED').length,
    rewarded: referrals.filter(r => r.status === 'REWARDED').length,
    totalRewards: referrals.filter(r => r.status === 'REWARDED').reduce((sum, r) => sum + r.rewardAmount, 0),
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-600">Pending</span>
      case 'QUALIFIED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">Qualified</span>
      case 'REWARDED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-600">Rewarded</span>
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>
    }
  }

  return (
    <DashboardLayout title="Referrals" subtitle="Manage referral program and rewards">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Referrals</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.qualified}</p>
                <p className="text-sm text-gray-500">Qualified</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.rewarded}</p>
                <p className="text-sm text-gray-500">Rewarded</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">${stats.totalRewards}</p>
                <p className="text-sm text-gray-500">Total Paid</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search referrals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {(['all', 'PENDING', 'QUALIFIED', 'REWARDED'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      statusFilter === status
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredReferrals.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No referrals found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Referrer</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase"></th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Referred User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Reward</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map((referral) => (
                    <tr key={referral.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                            {referral.referrer.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{referral.referrer.username}</p>
                            <p className="text-xs text-gray-500">{referral.referrer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                            {referral.referredUser.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{referral.referredUser.username}</p>
                            <p className="text-xs text-gray-500">{referral.referredUser.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(referral.status)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-medium ${referral.status === 'REWARDED' ? 'text-green-600' : 'text-gray-400'}`}>
                          ${referral.rewardAmount}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-500">
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Referral Settings"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Enable Referral Program</p>
              <p className="text-sm text-gray-500">Allow users to refer friends and earn rewards</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.enabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          <Input
            label="Reward Amount ($)"
            type="number"
            value={settings.rewardAmount}
            onChange={(e) => setSettings({ ...settings, rewardAmount: parseFloat(e.target.value) || 0 })}
            placeholder="10"
          />

          <Input
            label="Minimum Deposit to Qualify ($)"
            type="number"
            value={settings.minimumDeposit}
            onChange={(e) => setSettings({ ...settings, minimumDeposit: parseFloat(e.target.value) || 0 })}
            placeholder="100"
          />

          <p className="text-sm text-gray-500">
            Referrer will receive ${settings.rewardAmount} when the referred user makes a minimum deposit of ${settings.minimumDeposit}.
          </p>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
