'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { accountsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { useDateFilterStore } from '@/store/dateFilter'
import {
  Search, ChevronDown, ChevronLeft, ChevronRight, Loader2,
  Copy, Monitor, Ban, Check, Trash2
} from 'lucide-react'

type AccountRefund = {
  amount: number
  status: string
}

type AdAccount = {
  id: string
  platform: string
  accountId: string
  accountName: string
  status: string
  totalDeposit: number
  totalSpend: number
  balance: number
  currency: string
  timezone: string | null
  bmId: string | null
  sourceBmId: string | null
  licenseName: string | null
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    uniqueId: string
    agent?: {
      id: string
      username: string
    } | null
  }
  refunds?: AccountRefund[]
}

// Platform icons
const PlatformIcon = ({ platform }: { platform: string }) => {
  switch (platform) {
    case 'FACEBOOK':
      return <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    case 'GOOGLE':
      return <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1z"/><path fill="#34A853" d="M1.26 9.76A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4-3.1a7.15 7.15 0 0 1 0-4.44l-4-3.1z"/><path fill="#4285F4" d="M12 18.06c-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14z"/><path fill="#FBBC05" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/></svg>
    case 'TIKTOK':
      return <svg className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
    case 'SNAPCHAT':
      return <svg className="w-4 h-4 text-[#FFFC00]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .272-.063c.12 0 .24.03.345.09.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345 4.2 4.2 0 0 1-.84.12c-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465-.015.135.015.27.075.405.06.135.135.27.225.405.18.27.285.585.255.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.15-.015-.3-.015-.45 0-.195.015-.39.045-.585.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-.375 0-.75-.045-1.11-.135a7.316 7.316 0 0 1-.84-.255l-.075-.03a8.06 8.06 0 0 0-.765-.225 3.975 3.975 0 0 0-.585-.09c-.15-.015-.3-.015-.45 0-.225.015-.45.06-.675.12-.195.045-.39.075-.585.075-.225 0-.45-.03-.66-.09-.39-.12-.69-.435-.735-.84-.03-.3.075-.615.255-.885.09-.135.165-.27.225-.405.06-.135.09-.27.075-.405 0-.135-.105-.3-.315-.465a1.11 1.11 0 0 0-.405-.21 4.62 4.62 0 0 0-.675-.105 4.2 4.2 0 0 1-.84-.12 1.665 1.665 0 0 1-.765-.345c-.21-.18-.315-.405-.285-.615.015-.21.165-.435.435-.6.105-.075.225-.15.375-.225.27-.135.54-.3.81-.495.465-.36.885-.81 1.245-1.35.285-.42.54-.885.66-1.125.105-.195.195-.39.285-.585.045-.135.045-.255 0-.36-.045-.09-.15-.165-.3-.225a1.665 1.665 0 0 0-.225-.075 6.6 6.6 0 0 1-.51-.135c-.06-.015-.12-.03-.18-.045-.405-.12-.645-.255-.795-.39a.585.585 0 0 1-.21-.515c0-.24.126-.45.39-.585a.69.69 0 0 1 .345-.09c.09 0 .18.015.27.063.375.18.735.285 1.035.3.198 0 .326-.044.4-.089a4.95 4.95 0 0 1-.032-.51l-.004-.06c-.103-1.628-.229-3.654.3-4.847C7.86 1.069 11.215.793 12.206.793z"/></svg>
    case 'BING':
      return <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/><path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/><path fill="#00C8B4" d="M9.5 10l8 3.5v4l-8 4.5v-12z"/></svg>
    default:
      return <Monitor className="w-4 h-4 text-gray-400" />
  }
}

const platformLabel = (p: string) => {
  switch (p) {
    case 'FACEBOOK': return 'Facebook'
    case 'GOOGLE': return 'Google'
    case 'TIKTOK': return 'TikTok'
    case 'SNAPCHAT': return 'Snapchat'
    case 'BING': return 'Bing'
    default: return p
  }
}

export default function AllAdAccountsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const { startDate, endDate } = useDateFilterStore()

  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false)
  const [sortBy, setSortBy] = useState<string>('newest')
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Copy & Action loading
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Tab refs for sliding indicator
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Update indicator position
  useEffect(() => {
    const updateIndicator = () => {
      const ref = tabRefs.current[statusFilter]
      if (ref) {
        setIndicatorStyle({
          left: ref.offsetLeft,
          width: ref.offsetWidth,
        })
      }
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [statusFilter])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowPlatformDropdown(false)
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch data
  const fetchData = async () => {
    try {
      const data = await accountsApi.getAllAdmin()
      setAccounts(data.accounts || [])
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSuspend = async (acc: AdAccount) => {
    const confirmed = await confirm({ title: 'Suspend Account', message: `Suspend "${acc.accountName || acc.accountId}"? It will be hidden from the user's panel.`, variant: 'danger' })
    if (!confirmed) return
    setActionLoadingId(acc.id)
    try {
      await accountsApi.updateStatus(acc.id, 'SUSPENDED')
      toast.success('Account Suspended', `${acc.accountName || acc.accountId} has been suspended`)
      fetchData()
    } catch (error: any) {
      toast.error('Failed to suspend', error.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleActivate = async (acc: AdAccount) => {
    setActionLoadingId(acc.id)
    try {
      await accountsApi.updateStatus(acc.id, 'APPROVED')
      toast.success('Account Activated', `${acc.accountName || acc.accountId} is now active`)
      fetchData()
    } catch (error: any) {
      toast.error('Failed to activate', error.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async (acc: AdAccount) => {
    const confirmed = await confirm({ title: 'Delete Account', message: `Permanently delete "${acc.accountName || acc.accountId}"? This cannot be undone.`, variant: 'danger' })
    if (!confirmed) return
    setActionLoadingId(acc.id)
    try {
      await accountsApi.delete(acc.id)
      toast.success('Account Deleted', `${acc.accountName || acc.accountId} has been permanently deleted`)
      fetchData()
    } catch (error: any) {
      toast.error('Failed to delete', error.message || 'An error occurred')
    } finally {
      setActionLoadingId(null)
    }
  }

  const getRefundTotal = (acc: AdAccount) => {
    if (!acc.refunds || acc.refunds.length === 0) return 0
    return acc.refunds
      .filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED')
      .reduce((sum, r) => sum + r.amount, 0)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Approved</span>
      case 'PENDING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Pending</span>
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Suspended</span>
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Rejected</span>
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Refunded</span>
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{status}</span>
    }
  }

  // Filter & sort
  const filteredAccounts = accounts
    .filter((acc) => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch = !query ||
        acc.accountId?.toLowerCase().includes(query) ||
        acc.accountName?.toLowerCase().includes(query) ||
        acc.user?.username?.toLowerCase().includes(query) ||
        acc.user?.email?.toLowerCase().includes(query) ||
        acc.user?.agent?.username?.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        acc.status === statusFilter.toUpperCase()

      const matchesPlatform =
        platformFilter === 'all' ||
        acc.platform === platformFilter.toUpperCase()

      const accDate = new Date(acc.createdAt)
      const matchesDate =
        (!startDate || accDate >= startDate) &&
        (!endDate || accDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1))

      return matchesSearch && matchesStatus && matchesPlatform && matchesDate
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'deposit-high':
          return (b.totalDeposit || 0) - (a.totalDeposit || 0)
        case 'spend-high':
          return (b.totalSpend || 0) - (a.totalSpend || 0)
        case 'balance-high':
          return (b.balance || 0) - (a.balance || 0)
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  // Pagination
  const effectivePerPage = itemsPerPage === -1 ? filteredAccounts.length : itemsPerPage
  const totalPages = Math.ceil(filteredAccounts.length / effectivePerPage)
  const startIndex = (currentPage - 1) * effectivePerPage
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + effectivePerPage)

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, platformFilter, sortBy, startDate, endDate])

  // Stats
  const totalAccountsCount = accounts.length
  const approvedCount = accounts.filter(a => a.status === 'APPROVED').length
  const totalDeposit = accounts.reduce((sum, a) => sum + (a.totalDeposit || 0), 0)
  const totalSpend = accounts.reduce((sum, a) => sum + (a.totalSpend || 0), 0)
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)

  const statusTabs = [
    { key: 'all', label: 'All Accounts' },
    { key: 'approved', label: 'Approved' },
    { key: 'pending', label: 'Pending' },
    { key: 'suspended', label: 'Suspended' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'refunded', label: 'Refunded' },
  ]

  const platformOptions = [
    { value: 'all', label: 'All Platforms' },
    { value: 'FACEBOOK', label: 'Facebook' },
    { value: 'GOOGLE', label: 'Google' },
    { value: 'TIKTOK', label: 'TikTok' },
    { value: 'SNAPCHAT', label: 'Snapchat' },
    { value: 'BING', label: 'Bing' },
  ]

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'deposit-high', label: 'Highest Deposit' },
    { value: 'spend-high', label: 'Highest Spend' },
    { value: 'balance-high', label: 'Highest Balance' },
  ]

  // Pagination window
  const getPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const end = Math.min(totalPages, start + maxVisible - 1)
    start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <DashboardLayout title="All Ad Accounts">
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      <div className="space-y-3">
        {/* Top Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] lg:flex-none group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-violet-600" />
              <input
                type="text"
                placeholder="Search account, user, agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[240px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white transition-all"
              />
            </div>

            {/* Platform Filter */}
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowPlatformDropdown(!showPlatformDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[140px] justify-between bg-white"
              >
                <span className="flex items-center gap-1.5">
                  {platformFilter !== 'all' && <PlatformIcon platform={platformFilter.toUpperCase()} />}
                  {platformFilter === 'all' ? 'All Platforms' : platformLabel(platformFilter.toUpperCase())}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showPlatformDropdown ? 'rotate-180' : ''}`} />
              </button>
              <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                showPlatformDropdown
                  ? 'opacity-100 scale-y-100 translate-y-0 visible'
                  : 'opacity-0 scale-y-95 -translate-y-1 invisible'
              }`}>
                {platformOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => { setPlatformFilter(option.value); setShowPlatformDropdown(false) }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 flex items-center gap-2 ${platformFilter === option.value ? 'text-violet-600 bg-violet-500/5 font-medium' : 'text-gray-600'}`}
                    style={{ transitionDelay: showPlatformDropdown ? `${index * 30}ms` : '0ms' }}
                  >
                    {option.value !== 'all' && <PlatformIcon platform={option.value} />}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Filter */}
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[140px] justify-between bg-white"
              >
                <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>
              <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                showSortDropdown
                  ? 'opacity-100 scale-y-100 translate-y-0 visible'
                  : 'opacity-0 scale-y-95 -translate-y-1 invisible'
              }`}>
                {sortOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setShowSortDropdown(false) }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${sortBy === option.value ? 'text-violet-600 bg-violet-500/5 font-medium' : 'text-gray-600'}`}
                    style={{ transitionDelay: showSortDropdown ? `${index * 30}ms` : '0ms' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Count badge */}
          <div className="text-[12px] text-gray-500">
            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Accounts</span>
                <p className="text-xl font-bold text-gray-800">{totalAccountsCount.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-violet-500 text-white text-[10px] font-medium rounded">+{approvedCount} active</span>
            </div>
            <StatsChart value={totalAccountsCount} color="#7C3AED" filterId="glowVioletAccounts" gradientId="fadeVioletAccounts" clipId="clipVioletAccounts" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Deposit</span>
                <p className="text-xl font-bold text-gray-800">${totalDeposit.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-medium rounded">All</span>
            </div>
            <StatsChart value={totalDeposit} color="#10B981" filterId="glowGreenAccounts" gradientId="fadeGreenAccounts" clipId="clipGreenAccounts" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Spend</span>
                <p className="text-xl font-bold text-gray-800">${totalSpend.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-orange-500 text-white text-[10px] font-medium rounded">All</span>
            </div>
            <StatsChart value={totalSpend} color="#F97316" filterId="glowOrangeAccounts" gradientId="fadeOrangeAccounts" clipId="clipOrangeAccounts" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Balance</span>
                <p className="text-xl font-bold text-gray-800">${totalBalance.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-medium rounded">All</span>
            </div>
            <StatsChart value={totalBalance} color="#3B82F6" filterId="glowBlueAccounts" gradientId="fadeBlueAccounts" clipId="clipBlueAccounts" />
          </Card>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Status Tabs */}
          <div className="border-b border-gray-100 flex-shrink-0">
            <div className="flex relative overflow-x-auto">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  ref={(el) => { tabRefs.current[tab.key] = el }}
                  onClick={() => { setStatusFilter(tab.key); setCurrentPage(1) }}
                  className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'text-violet-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.key !== 'all' && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      statusFilter === tab.key ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {accounts.filter(a => a.status === tab.key.toUpperCase()).length}
                    </span>
                  )}
                </button>
              ))}
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1 min-h-0" key={statusFilter}>
            <table className="w-full text-[11px] xl:text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Platform</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Account ID</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Account Name</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">User</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Agent</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Deposit</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Spend</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Balance</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Status</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Created</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                        <span className="text-gray-500">Loading accounts...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-gray-500">
                      {searchQuery || platformFilter !== 'all' ? 'No matching accounts found' : 'No ad accounts found'}
                    </td>
                  </tr>
                ) : (
                  paginatedAccounts.map((acc, index) => (
                    <tr
                      key={acc.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      {/* Platform */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <PlatformIcon platform={acc.platform} />
                          <span className="text-gray-700 font-medium">{platformLabel(acc.platform)}</span>
                        </div>
                      </td>

                      {/* Account ID */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <code className="text-[11px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{acc.accountId}</code>
                          <button
                            onClick={() => copyToClipboard(acc.accountId, acc.id)}
                            className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                            title="Copy Account ID"
                          >
                            {copiedId === acc.id ? (
                              <span className="text-emerald-500 text-[10px] font-medium">✓</span>
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Account Name */}
                      <td className="py-2.5 px-3">
                        <span className="text-gray-700 truncate block max-w-[140px]" title={acc.accountName}>
                          {acc.accountName || '—'}
                        </span>
                      </td>

                      {/* User */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold text-[10px] flex-shrink-0">
                            {acc.user?.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[100px]">{acc.user?.username || '—'}</p>
                            <p className="text-gray-400 text-[10px]">#{acc.user?.uniqueId?.slice(-5) || '00000'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Agent */}
                      <td className="py-2.5 px-3">
                        {acc.user?.agent ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-[9px] flex-shrink-0">
                              {acc.user.agent.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-gray-700 font-medium truncate max-w-[80px]">{acc.user.agent.username}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">No Agent</span>
                        )}
                      </td>

                      {/* Deposit */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-semibold text-emerald-600">${(acc.totalDeposit || 0).toLocaleString()}</span>
                      </td>

                      {/* Spend */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-semibold text-orange-600">${(acc.totalSpend || 0).toLocaleString()}</span>
                      </td>

                      {/* Balance */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-semibold text-blue-600">${(acc.balance || 0).toLocaleString()}</span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {getStatusBadge(acc.status)}
                          {acc.status === 'REFUNDED' && getRefundTotal(acc) > 0 && (
                            <span className="text-[10px] text-blue-600 font-medium">${getRefundTotal(acc).toLocaleString()} refunded</span>
                          )}
                        </div>
                      </td>

                      {/* Created */}
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap text-center">
                        {formatDate(acc.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {actionLoadingId === acc.id ? (
                            <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                          ) : (
                            <>
                              {acc.status === 'SUSPENDED' ? (
                                <button
                                  onClick={() => handleActivate(acc)}
                                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-green-600 bg-green-50 hover:bg-green-100 transition-colors"
                                  title="Activate"
                                >
                                  <Check className="w-3 h-3" />
                                  Activate
                                </button>
                              ) : acc.status !== 'REFUNDED' ? (
                                <button
                                  onClick={() => handleSuspend(acc)}
                                  className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                  title="Suspend"
                                >
                                  <Ban className="w-3 h-3" />
                                  Suspend
                                </button>
                              ) : null}
                              <button
                                onClick={() => handleDelete(acc)}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                title="Delete permanently"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredAccounts.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-gray-500">
                  {startIndex + 1}-{Math.min(startIndex + effectivePerPage, filteredAccounts.length)} of {filteredAccounts.length}
                </span>
                <PaginationSelect
                  value={itemsPerPage}
                  onChange={(val) => { setItemsPerPage(val); setCurrentPage(1) }}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-[13px] font-medium transition-all ${
                      currentPage === pageNum
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
