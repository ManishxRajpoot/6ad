'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { accountsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react'

type AdAccount = {
  id: string
  accountId: string
  accountName: string
  platform: string
  status: string
  totalDeposit: number
  totalSpend: number
  balance: number
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    realName: string | null
  }
  cheetahData?: {
    isCheetah: boolean
    remainingBalance?: number
    status?: number
    statusText?: string
    spendCap?: number
    amountSpent?: number
    disableReason?: number
    disableReasonText?: string
  } | null
}

export default function AdAccountsPage() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [pagination, setPagination] = useState<any>(null)
  const [showBalance, setShowBalance] = useState(false) // Controlled by admin setting

  // Dropdown states
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  // Tab refs for sliding indicator
  const allTabRef = useRef<HTMLButtonElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const disabledTabRef = useRef<HTMLButtonElement>(null)
  const reviewTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      let activeRef = allTabRef
      if (statusFilter === 'active') activeRef = activeTabRef
      else if (statusFilter === 'disabled') activeRef = disabledTabRef
      else if (statusFilter === 'review') activeRef = reviewTabRef

      if (activeRef.current) {
        setIndicatorStyle({
          left: activeRef.current.offsetLeft,
          width: activeRef.current.offsetWidth,
        })
      }
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [statusFilter])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowPlatformDropdown(false)
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchAccounts = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      else setLoading(true)

      const params: any = { page: currentPage, limit: itemsPerPage }
      if (platformFilter !== 'all') params.platform = platformFilter
      if (searchQuery) params.search = searchQuery

      const response = await accountsApi.getAgentAll(params)
      setAccounts(response.accounts || [])
      setPagination(response.pagination)
      // Update balance visibility from admin setting
      if (response.showBalanceToAgents !== undefined) {
        setShowBalance(response.showBalanceToAgents)
      }
    } catch (error: any) {
      console.error('Failed to fetch accounts:', error)
      toast.error('Error', error.message || 'Failed to load ad accounts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [currentPage, itemsPerPage, platformFilter])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchAccounts()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter accounts by status
  const filteredAccounts = accounts.filter(acc => {
    if (statusFilter === 'all') return true
    const cheetahStatus = acc.cheetahData?.status
    if (statusFilter === 'active') return cheetahStatus === 1
    if (statusFilter === 'disabled') return cheetahStatus === 2
    if (statusFilter === 'review') return [3, 7, 8, 9].includes(cheetahStatus || 0)
    return true
  })

  // Stats calculations
  const totalAccounts = accounts.length
  const activeAccounts = accounts.filter(a => a.cheetahData?.status === 1).length
  const disabledAccounts = accounts.filter(a => a.cheetahData?.status === 2).length
  const reviewAccounts = accounts.filter(a => [3, 7, 8, 9].includes(a.cheetahData?.status || 0)).length

  // Get account status badge
  const getAccountStatusBadge = (cheetahData: AdAccount['cheetahData']) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"

    if (!cheetahData?.isCheetah) {
      return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>Manual</span>
    }

    const status = cheetahData.status
    if (status === 1) {
      return (
        <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      )
    } else if (status === 2) {
      return (
        <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
          <XCircle className="w-3 h-3" />
          Banned
        </span>
      )
    } else if ([3, 7, 8, 9].includes(status || 0)) {
      return (
        <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}>
          <AlertCircle className="w-3 h-3" />
          Under Review
        </span>
      )
    } else if ([100, 101].includes(status || 0)) {
      return (
        <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>
          <Clock className="w-3 h-3" />
          Closed
        </span>
      )
    }
    return (
      <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-500`}>
        {cheetahData.statusText || 'Unknown'}
      </span>
    )
  }

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'FACEBOOK':
        return (
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
        )
      case 'GOOGLE':
        return (
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
        )
      case 'TIKTOK':
        return (
          <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-[#0D9488]/10 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-[#0D9488]" />
          </div>
        )
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Pagination
  const totalPages = pagination?.totalPages || Math.ceil(filteredAccounts.length / itemsPerPage)
  const paginatedAccounts = filteredAccounts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <DashboardLayout title="Ad Accounts" subtitle="View all ad accounts from your users">
      <div className="space-y-3">
        {/* Top Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] lg:flex-none group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-[#0D9488]" />
              <input
                type="text"
                placeholder="Search account, user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[220px] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] bg-white transition-all"
              />
            </div>

            {/* Platform Filter */}
            <div className="relative dropdown-container">
              <button
                onClick={() => { setShowPlatformDropdown(!showPlatformDropdown); setShowStatusDropdown(false) }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white"
              >
                <span>
                  {platformFilter === 'all' ? 'All Platforms' : platformFilter.charAt(0) + platformFilter.slice(1).toLowerCase()}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showPlatformDropdown ? 'rotate-180' : ''}`} />
              </button>
              <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                showPlatformDropdown
                  ? 'opacity-100 scale-y-100 translate-y-0 visible'
                  : 'opacity-0 scale-y-95 -translate-y-1 invisible'
              }`}>
                {[
                  { value: 'all', label: 'All Platforms' },
                  { value: 'FACEBOOK', label: 'Facebook' },
                  { value: 'GOOGLE', label: 'Google' },
                  { value: 'TIKTOK', label: 'TikTok' },
                  { value: 'SNAPCHAT', label: 'Snapchat' },
                  { value: 'BING', label: 'Bing' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setPlatformFilter(option.value); setShowPlatformDropdown(false); setCurrentPage(1) }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${platformFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAccounts(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#0D9488] text-white rounded-lg text-[12px] font-medium hover:bg-[#0F766E] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Accounts */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Accounts</span>
                <p className="text-xl font-bold text-gray-800">{totalAccounts}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#0D9488] text-white text-[10px] font-medium rounded">All</span>
            </div>
            <StatsChart value={totalAccounts} color="#0D9488" filterId="glowPurpleAcc" gradientId="fadePurpleAcc" clipId="clipPurpleAcc" />
          </Card>

          {/* Active Accounts */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Active</span>
                <p className="text-xl font-bold text-gray-800">{activeAccounts}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#52B788] text-white text-[10px] font-medium rounded">Running</span>
            </div>
            <StatsChart value={activeAccounts} color="#52B788" filterId="glowGreenAcc" gradientId="fadeGreenAcc" clipId="clipGreenAcc" />
          </Card>

          {/* Disabled Accounts */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Banned</span>
                <p className="text-xl font-bold text-gray-800">{disabledAccounts}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-medium rounded">Disabled</span>
            </div>
            <StatsChart value={disabledAccounts} color="#EF4444" filterId="glowRedAcc" gradientId="fadeRedAcc" clipId="clipRedAcc" />
          </Card>

          {/* Under Review */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Under Review</span>
                <p className="text-xl font-bold text-gray-800">{reviewAccounts}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded">Review</span>
            </div>
            <StatsChart value={reviewAccounts} color="#F59E0B" filterId="glowOrangeAcc" gradientId="fadeOrangeAcc" clipId="clipOrangeAcc" />
          </Card>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100 flex-shrink-0">
            <div className="flex relative">
              <button
                ref={allTabRef}
                onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'all'
                    ? 'text-[#0D9488]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Accounts
              </button>
              <button
                ref={activeTabRef}
                onClick={() => { setStatusFilter('active'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'active'
                    ? 'text-[#0D9488]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                ref={disabledTabRef}
                onClick={() => { setStatusFilter('disabled'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'disabled'
                    ? 'text-[#0D9488]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Banned
              </button>
              <button
                ref={reviewTabRef}
                onClick={() => { setStatusFilter('review'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'review'
                    ? 'text-[#0D9488]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Under Review
              </button>
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-[#0D9488] transition-all duration-300 ease-out"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1 min-h-0" key={statusFilter}>
            <table className="w-full animate-tabFadeIn text-[11px] xl:text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[20%]">Account</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">User</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Account ID</th>
                  {showBalance && (
                    <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Balance</th>
                  )}
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Status</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={showBalance ? 6 : 5} className="py-6 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin mb-1" />
                        <span className="text-gray-500">Loading accounts...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={showBalance ? 6 : 5} className="py-6 text-center text-gray-500">
                      {searchQuery ? 'No matching accounts found' : 'No ad accounts found'}
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account, index) => (
                    <tr
                      key={account.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      {/* Account Info */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(account.platform)}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate max-w-[140px]">{account.accountName || 'Unnamed'}</p>
                            <p className="text-gray-500 text-[10px]">{account.platform}</p>
                          </div>
                        </div>
                      </td>

                      {/* User */}
                      <td className="py-2.5 px-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[120px]">{account.user?.realName || account.user?.username}</p>
                          <p className="text-gray-500 text-[10px] truncate max-w-[120px]">{account.user?.username}</p>
                        </div>
                      </td>

                      {/* Account ID */}
                      <td className="py-2.5 px-3 text-center">
                        <code className="font-medium text-[#0D9488] bg-[#0D9488]/5 px-2 py-1 rounded text-[11px]">
                          {account.accountId}
                        </code>
                      </td>

                      {/* Balance - Only shown if admin enabled */}
                      {showBalance && (
                        <td className="py-2.5 px-3 text-right">
                          <p className="font-semibold text-[#52B788]">
                            ${(account.cheetahData?.remainingBalance || account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </td>
                      )}

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {getAccountStatusBadge(account.cheetahData)}
                      </td>

                      {/* Created */}
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap text-center">
                        {formatDate(account.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-[12px]">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Show</span>
              <PaginationSelect
                value={itemsPerPage}
                onChange={(val) => { setItemsPerPage(val === -1 ? filteredAccounts.length : val); setCurrentPage(1) }}
              />
              <span className="text-gray-500">
                of {pagination?.total || filteredAccounts.length} accounts
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex items-center gap-1">
                {totalPages <= 5 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-[#6366F1] text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                        currentPage === 1
                          ? 'bg-[#6366F1] text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className="w-4 text-center text-gray-400">...</span>}
                    {currentPage > 2 && currentPage < totalPages - 1 && (
                      <button
                        className="w-8 h-8 rounded-lg font-medium bg-[#6366F1] text-white shadow-sm"
                      >
                        {currentPage}
                      </button>
                    )}
                    {currentPage < totalPages - 2 && <span className="w-4 text-center text-gray-400">...</span>}
                    {totalPages > 1 && (
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                          currentPage === totalPages
                            ? 'bg-[#6366F1] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {totalPages}
                      </button>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
