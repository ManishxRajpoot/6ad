'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Download,
  Copy,
  Check,
} from 'lucide-react'
import { authApi, accountsApi, transactionsApi, accountDepositsApi, dashboardApi, settingsApi, PlatformStatus } from '@/lib/api'
import { AccountManageIcon, DepositManageIcon, AfterSaleIcon, ComingSoonIcon } from '@/components/icons/MenuIcons'

// Animated Counter Component - smoothly animates number changes
function AnimatedCounter({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)

  useEffect(() => {
    if (previousValue.current === value) return

    const startValue = previousValue.current
    const endValue = value
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart)
      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <>{String(displayValue).padStart(2, '0')}</>
}

// Stats data will be computed from dashboard API response

// Date filter options
const dateFilterOptions = [
  { value: '', label: 'Date and Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
]

// Action filter options
const actionFilterOptions = [
  { value: '', label: 'Action' },
  { value: 'approve', label: 'Approve' },
  { value: 'pending', label: 'Pending' },
]

// Export options
const exportOptions = [
  { id: 'account-list', label: 'Account List' },
  { id: 'account-applied-records', label: 'Account Applied Records' },
  { id: 'bm-share-log', label: 'BM Share Log' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'deposit-report', label: 'Deposit Report' },
  { id: 'transfer-balance', label: 'Transfer Balance' },
  { id: 'refund', label: 'Refund' },
  { id: 'refund-report', label: 'Refund Report' },
]

// Account List data
const accountListData = [
  { id: 1, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 2, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 3, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 4, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 5, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 6, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 7, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 8, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
]

// Account Applied Records data
const appliedRecordsData = [
  { id: 1, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 270, status: 'APPROVED' },
  { id: 2, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 223, status: 'APPROVED' },
  { id: 3, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 232, status: 'PENDING' },
  { id: 4, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 1323, status: 'APPROVED' },
  { id: 5, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 4334, status: 'REJECTED' },
  { id: 6, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 222, status: 'APPROVED' },
  { id: 7, applyId: '17420455677Br3fgryyr', license: 'ADM Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 2342, status: 'APPROVED' },
]

// Organization Share Log data
const bmShareLogData = [
  { id: 1, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 2, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 3, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'PENDING' },
  { id: 4, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 5, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'REJECTED' },
  { id: 6, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 7, applyId: '17420455677Br3fgryyr', adsAccountName: 'gyan creative', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
]

// Deposit Report data
const depositReportData = [
  { id: 1, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 2, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 3, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 4, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 5, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 6, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 7, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
  { id: 8, applyId: '4564545321', transactionId: '7675644654', date: '14/05/2024' },
]

type SubPage = 'apply-ads-account' | 'account-list' | 'account-applied-records' | 'bm-share-log' | 'deposit' | 'deposit-report' | 'transfer-balance' | 'refund' | 'refund-report'

type MenuSection = 'account-manage' | 'deposit-manage' | 'after-sale'

// Snapchat brand colors
const brandColor = '#FFFC00'
const brandColorDark = '#E6E300'
const brandGradient = 'from-[#FFFC00] to-[#E6E300]'

export default function SnapchatPage() {
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('apply-ads-account')
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['account-manage', 'deposit-manage', 'after-sale'])
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // User state from API
  const [user, setUser] = useState<any>(null)
  const [userAccounts, setUserAccounts] = useState<any[]>([])
  const [userRefunds, setUserRefunds] = useState<any[]>([])
  const [userDeposits, setUserDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [previousStats, setPreviousStats] = useState<any>(null)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>('active')

  // Generate dynamic chart path based on count
  const generateChartPath = (count: number, trend: 'up' | 'down') => {
    if (count === 0) return 'M0,38 L120,38'
    const numPeaks = Math.min(count, 6)
    const segmentWidth = 120 / numPeaks
    let path = 'M0,35'
    for (let i = 0; i < numPeaks; i++) {
      const startX = i * segmentWidth
      const peakX = startX + segmentWidth * 0.5
      const endX = (i + 1) * segmentWidth
      const baseHeight = trend === 'up' ? 8 : 25
      const variation = (i % 2 === 0) ? 0 : 8
      const peakY = trend === 'up' ? baseHeight + variation + (i * 2) : baseHeight - variation + (i * 2)
      const cp1x = startX + segmentWidth * 0.2
      const cp2x = peakX - segmentWidth * 0.15
      const cp3x = peakX + segmentWidth * 0.15
      const cp4x = startX + segmentWidth * 0.8
      path += ` C${cp1x},35 ${cp2x},${peakY} ${peakX},${peakY}`
      path += ` C${cp3x},${peakY} ${cp4x},35 ${endX},35`
    }
    return path
  }

  // Calculate growth percentage and trend
  const calculateGrowth = (current: number, previous: number | undefined, isRefund: boolean = false) => {
    if (previous === undefined) {
      if (current > 0) return { trend: isRefund ? 'down' as const : 'up' as const, badge: `${current} Active` }
      return { trend: 'neutral' as const, badge: 'None' }
    }
    const diff = current - previous
    if (diff > 0) return { trend: 'up' as const, badge: `+${diff} New` }
    if (diff < 0) return { trend: 'down' as const, badge: `${diff} Resolved` }
    if (current > 0) return { trend: isRefund ? 'down' as const : 'up' as const, badge: `${current} Active` }
    return { trend: 'neutral' as const, badge: 'None' }
  }

  // Compute statsData from dashboard API
  const statsData = useMemo(() => {
    const pendingApps = dashboardStats?.pendingApplications || 0
    const pendingDeps = dashboardStats?.pendingDeposits || 0
    const pendingSharesCount = dashboardStats?.pendingShares || 0
    const pendingRefundsCount = dashboardStats?.pendingRefunds || 0
    const prevApps = previousStats?.pendingApplications
    const prevDeps = previousStats?.pendingDeposits
    const prevShares = previousStats?.pendingShares
    const prevRefunds = previousStats?.pendingRefunds
    const appsGrowth = calculateGrowth(pendingApps, prevApps, false)
    const depsGrowth = calculateGrowth(pendingDeps, prevDeps, false)
    const sharesGrowth = calculateGrowth(pendingSharesCount, prevShares, false)
    const refundsGrowth = calculateGrowth(pendingRefundsCount, prevRefunds, true)
    return [
      { label: 'Pending Applications', numericValue: pendingApps, trend: appsGrowth.trend, badge: appsGrowth.badge, color: '#FFFC00', chartPath: generateChartPath(pendingApps, 'up') },
      { label: 'Pending Deposits', numericValue: pendingDeps, trend: depsGrowth.trend, badge: depsGrowth.badge, color: '#22C55E', chartPath: generateChartPath(pendingDeps, 'up') },
      { label: 'Pending Shares', numericValue: pendingSharesCount, trend: sharesGrowth.trend, badge: sharesGrowth.badge, color: '#F97316', chartPath: generateChartPath(pendingSharesCount, 'up') },
      { label: 'Pending Refunds', numericValue: pendingRefundsCount, trend: refundsGrowth.trend, badge: refundsGrowth.badge, color: '#EF4444', chartPath: generateChartPath(pendingRefundsCount, 'down') },
    ]
  }, [dashboardStats, previousStats])

  // Refresh only dashboard stats
  const refreshStats = async () => {
    try {
      const statsRes = await dashboardApi.getStats().catch(() => ({}))
      if (dashboardStats && (
        statsRes.pendingApplications !== dashboardStats.pendingApplications ||
        statsRes.pendingDeposits !== dashboardStats.pendingDeposits ||
        statsRes.pendingShares !== dashboardStats.pendingShares ||
        statsRes.pendingRefunds !== dashboardStats.pendingRefunds
      )) {
        setPreviousStats(dashboardStats)
      }
      setDashboardStats(statsRes)
    } catch (error) {}
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [userRes, accountsRes, refundsRes, depositsRes, statsRes, platformRes] = await Promise.all([
          authApi.me().catch(() => ({ user: null })),
          accountsApi.getAll('SNAPCHAT').catch(() => ({ accounts: [] })),
          transactionsApi.refunds.getAll('SNAPCHAT').catch(() => ({ refunds: [] })),
          accountDepositsApi.getAll('SNAPCHAT').catch(() => ({ deposits: [] })),
          dashboardApi.getStats().catch(() => ({})),
          settingsApi.platforms.get().catch(() => ({ platforms: { facebook: 'active', google: 'active', tiktok: 'active', snapchat: 'active', bing: 'active' } }))
        ])
        setUser(userRes.user)
        setUserAccounts(accountsRes.accounts || [])
        setUserRefunds(refundsRes.refunds || [])
        setUserDeposits(depositsRes.deposits || [])
        setDashboardStats(statsRes)
        setPlatformStatus((platformRes.platforms?.snapchat || 'active') as PlatformStatus)
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Auto-refresh stats every 1 second
  useEffect(() => {
    const interval = setInterval(() => refreshStats(), 1000)
    return () => clearInterval(interval)
  }, [])

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Export to Excel function
  const exportToExcel = (exportType: string) => {
    let data: any[] = []
    let filename = ''
    let headers: string[] = []

    switch (exportType) {
      case 'account-list':
        filename = 'snapchat_account_list'
        headers = ['License', 'Account ID', 'Account Name', 'Status', 'Created At']
        data = userAccounts.map(acc => ({
          'License': acc.licenseName || '-',
          'Account ID': acc.accountId || '-',
          'Account Name': acc.accountName || '-',
          'Status': acc.status || '-',
          'Created At': acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '-'
        }))
        break

      case 'account-applied-records':
        filename = 'snapchat_applied_records'
        headers = ['Apply ID', 'License', 'Request Time', 'Total Cost', 'Status']
        data = userAccounts.map(acc => ({
          'Apply ID': acc.id || '-',
          'License': acc.licenseName || '-',
          'Request Time': acc.createdAt ? new Date(acc.createdAt).toLocaleString() : '-',
          'Total Cost': `$${acc.totalCost || 0}`,
          'Status': acc.status || '-'
        }))
        break

      case 'refund':
      case 'refund-report':
        filename = exportType === 'refund' ? 'snapchat_refunds' : 'snapchat_refund_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Request Date']
        data = userRefunds.map(refund => ({
          'Account ID': refund.accountId || '-',
          'Account Name': refund.accountName || '-',
          'Amount': `$${refund.amount || 0}`,
          'Status': refund.status || '-',
          'Request Date': refund.createdAt ? new Date(refund.createdAt).toLocaleString() : '-'
        }))
        break

      default:
        alert('Export not available for this option')
        return
    }

    if (data.length === 0) {
      alert('No data available to export')
      return
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] || ''
        const escaped = String(value).replace(/"/g, '""')
        return escaped.includes(',') ? `"${escaped}"` : escaped
      }).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Get user's Snapchat commission rate from API (fallback to 5% if not set)
  const snapchatCommissionRate = user?.snapchatCommission ? parseFloat(user.snapchatCommission) : 5

  // User wallet balance from API
  const userBalance = user?.balance ? parseFloat(user.balance) : 0

  // Check if platform is enabled and if user has existing accounts
  // platformStatus: 'active' = can apply, 'stop' = visible but can't apply, 'hidden' = not shown
  const platformEnabled = platformStatus === 'active'
  const platformStopped = platformStatus === 'stop'
  const hasExistingAccounts = userAccounts.length > 0

  // Modal states
  const [showBmShareModal, setShowBmShareModal] = useState(false)

  // Form states
  const [applyAdsForm, setApplyAdsForm] = useState({
    licenseNo: '',
    pageNumber: '',
    pageUrl: '',
    domainName: '',
    isApp: 'no',
    domain: 'Https:///ads.snapchat.com',
    hasShopify: 'no',
    adNumber: '',
    adsAccount: 'Https:///ads.snapchat.com',
    timeZone: '',
    depositAmount: '',
    message: ''
  })

  const [bmShareForm, setBmShareForm] = useState({
    bmId: '',
    message: ''
  })

  const toggleSection = (section: MenuSection) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1.5 rounded-full text-xs font-semibold"
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-[#52B788] text-white`}>Approved</span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-[#F59E0B] text-white`}>Pending</span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-[#EF4444] text-white`}>Rejected</span>
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-600`}>{status}</span>
    }
  }

  const menuItems = [
    {
      section: 'account-manage' as MenuSection,
      title: 'Account Manage',
      icon: <AccountManageIcon />,
      items: [
        { id: 'apply-ads-account' as SubPage, label: 'Apply Ads Account' },
        { id: 'account-list' as SubPage, label: 'Account List' },
        { id: 'account-applied-records' as SubPage, label: 'Account Applied Records' },
        { id: 'bm-share-log' as SubPage, label: 'Organization Share Log' },
      ]
    },
    {
      section: 'deposit-manage' as MenuSection,
      title: 'Deposit Manage',
      icon: <DepositManageIcon />,
      items: [
        { id: 'deposit' as SubPage, label: 'Deposit' },
        { id: 'deposit-report' as SubPage, label: 'Deposit Report' },
      ]
    },
    {
      section: 'after-sale' as MenuSection,
      title: 'After Sale',
      icon: <AfterSaleIcon />,
      items: [
        { id: 'transfer-balance' as SubPage, label: 'Transfer Balance' },
        { id: 'refund' as SubPage, label: 'Refund' },
        { id: 'refund-report' as SubPage, label: 'Refund Report' },
      ]
    }
  ]

  return (
    <DashboardLayout title="Snapchat User Management Account" subtitle="">
      <div className="flex flex-col h-full">
      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 252, 0, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(255, 252, 0, 0.2); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.3s ease-out forwards; }
        .animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
        .table-row-animate { animation: fadeInUp 0.3s ease-out forwards; }
        .table-row-animate:nth-child(1) { animation-delay: 0.05s; }
        .table-row-animate:nth-child(2) { animation-delay: 0.1s; }
        .table-row-animate:nth-child(3) { animation-delay: 0.15s; }
        .table-row-animate:nth-child(4) { animation-delay: 0.2s; }
        .table-row-animate:nth-child(5) { animation-delay: 0.25s; }
        .table-row-animate:nth-child(6) { animation-delay: 0.3s; }
        .table-row-animate:nth-child(7) { animation-delay: 0.35s; }
        .table-row-animate:nth-child(8) { animation-delay: 0.4s; }
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(255, 252, 0, 0.15); }
        .brand-glow { animation: pulse-glow 3s ease-in-out infinite; }
      `}</style>

      {/* Row 1: Header Bar - Compact */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-xl shadow-sm border border-gray-100/50">
        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#FFFC00]/40 focus:border-[#FFFC00] focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="w-36">
          <Select
            options={dateFilterOptions}
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Date and Time"
            size="sm"
            
          />
        </div>
        <div className="w-28">
          <Select
            options={actionFilterOptions}
            value={actionFilter}
            onChange={setActionFilter}
            placeholder="Action"
            size="sm"
            
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 whitespace-nowrap text-xs px-3 py-1.5 h-auto"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
            <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
          </Button>

          {showExportDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="py-1">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      exportToExcel(option.id)
                      setShowExportDropdown(false)
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#FFFC00]/20 hover:text-gray-900 transition-colors duration-150 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={() => setActiveSubPage('apply-ads-account')}
          className="bg-gradient-to-r from-[#FFFC00] to-[#E6E300] hover:from-[#E6E300] hover:to-[#CCCA00] text-black rounded-md shadow-sm whitespace-nowrap text-xs px-3 py-1.5 h-auto font-semibold"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ads Account
        </Button>
      </div>

      {/* Row 2: Stats Cards - Compact with Real-time Updates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-3 lg:mb-4">
        {statsData.map((stat, index) => (
          <Card key={index} className="stat-card p-2.5 lg:p-4 border border-gray-100 bg-white rounded-xl relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
            {/* Top row: Title and Badge */}
            <div className="flex items-center justify-between mb-1.5 lg:mb-2">
              <p className="text-[11px] lg:text-sm text-gray-500 font-medium">{stat.label}</p>
              {stat.badge !== 'None' && (
                <span className={`text-[8px] lg:text-[10px] px-1.5 lg:px-2.5 py-0.5 lg:py-1 rounded-full font-semibold whitespace-nowrap transition-all duration-500 ${
                  stat.trend === 'up'
                    ? 'bg-[#22C55E] text-white animate-pulse'
                    : stat.trend === 'down'
                      ? 'bg-[#EF4444] text-white animate-pulse'
                      : 'bg-blue-100 text-blue-600'
                }`}>
                  {stat.badge}
                </span>
              )}
            </div>
            {/* Bottom row: Number on left, Chart on right */}
            <div className="flex items-end justify-between">
              <p className="text-lg lg:text-2xl font-bold text-gray-900 tabular-nums">
                <AnimatedCounter value={stat.numericValue} duration={600} />
              </p>
              <div className="w-16 h-8 lg:w-24 lg:h-12 relative hidden sm:block">
                <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`stat-gradient-snap-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`}
                    fill={`url(#stat-gradient-snap-${index})`}
                    className="transition-all duration-700 ease-in-out"
                  />
                  <path
                    d={stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')}
                    fill="none"
                    stroke={stat.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700 ease-in-out"
                  />
                </svg>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 3: Main Content */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Balanced size, scroll only on small screens */}
        <div className="w-64 lg:w-72 flex-shrink-0 hidden md:block">
          <Card className="p-4 h-full border border-gray-100/50 bg-gradient-to-b from-white to-gray-50/50 relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFFC00]/5 via-transparent to-[#52B788]/5" />

            {/* Snapchat Logo - Larger and balanced */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFFC00] to-[#E6E300] flex items-center justify-center shadow-lg shadow-yellow-500/30">
                  <svg viewBox="0 0 500 500" className="w-8 h-8" fill="white">
                    <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
                  </svg>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                  <div className="w-4 h-4 bg-[#52B788] rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">Ad Management</p>
            </div>

            {/* Navigation Menu - Scroll only on small screens */}
            <div className="relative z-10 space-y-2 overflow-y-auto flex-1 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
              {menuItems.map((menu) => (
                <div key={menu.section}>
                  <button
                    onClick={() => toggleSection(menu.section)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#FFFC00]/10 rounded-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-all duration-300 ${
                        expandedSections.includes(menu.section)
                          ? 'rotate-180 text-[#CCCA00]'
                          : 'rotate-0 text-gray-400'
                      }`}
                    />
                  </button>

                  <div className={`ml-5 space-y-1 border-l-2 border-[#FFFC00]/30 pl-4 overflow-hidden transition-all duration-300 ease-in-out ${
                    expandedSections.includes(menu.section) ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'
                  }`}>
                    {menu.items.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveSubPage(item.id)
                          setCurrentPage(1)
                        }}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ease-out transform hover:translate-x-0.5 active:scale-95 ${
                          expandedSections.includes(menu.section) ? 'animate-slideIn' : ''
                        } ${
                          activeSubPage === item.id
                            ? 'bg-gradient-to-r from-[#FFFC00] to-[#E6E300] text-black font-semibold shadow-md'
                            : 'text-gray-600 hover:bg-[#FFFC00]/10 hover:text-gray-800'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Content */}
        <Card className="flex-1 p-0 rounded-xl lg:rounded-2xl overflow-hidden border border-gray-100/50 shadow-sm flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-white to-gray-50/30 scroll-smooth">
              {/* Apply Ads Account Form */}
              {activeSubPage === 'apply-ads-account' && (
                <>
                  {/* Show message if platform stopped - user can see but can't apply */}
                  {platformStopped ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F59E0B]/10 to-[#EF4444]/10 flex items-center justify-center">
                        <span className="text-3xl">⏸️</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-700">New Applications Paused</p>
                      <p className="text-sm text-gray-500 mt-2">New ad account applications are temporarily paused</p>
                      {hasExistingAccounts && (
                        <p className="text-xs text-gray-400 mt-3">You can still manage your existing accounts through the menu</p>
                      )}
                    </div>
                  ) : (
                <div className="px-8 py-6 space-y-4">
                  {/* License No */}
                  <Select
                    label="License No"
                    options={[
                      { value: 'license1', label: 'ADM Marketing' },
                      { value: 'license2', label: 'License 2' },
                    ]}
                    value={applyAdsForm.licenseNo}
                    onChange={(value) => setApplyAdsForm({...applyAdsForm, licenseNo: value})}
                    placeholder="Select"
                  />

                  {/* Page Number */}
                  <Select
                    label="Page Number"
                    options={[
                      { value: 'page1', label: 'Page 1' },
                      { value: 'page2', label: 'Page 2' },
                    ]}
                    value={applyAdsForm.pageNumber}
                    onChange={(value) => setApplyAdsForm({...applyAdsForm, pageNumber: value})}
                    placeholder="Select"
                  />

                  {/* Page URL */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      Page URL
                      <span className="text-gray-400 text-xs">⚙️</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter Page URL"
                      value={applyAdsForm.pageUrl}
                      onChange={(e) => setApplyAdsForm({...applyAdsForm, pageUrl: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFFC00]/30 focus:border-[#FFFC00] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Checkbox */}
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" id="shareProfile" className="w-4 h-4 rounded border-gray-300 text-[#FFFC00] focus:ring-[#FFFC00]" />
                    <label htmlFor="shareProfile" className="text-sm text-gray-600">
                      Please make sure you have already shared your page with this profile
                    </label>
                  </div>

                  {/* URL Box */}
                  <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#FFFC00]/10 to-[#52B788]/5 border border-[#FFFC00]/30 rounded-lg">
                    <span className="text-sm text-gray-700 font-medium">Https:///ads.snapchat.com</span>
                    <button
                      onClick={() => copyToClipboard('Https:///ads.snapchat.com', 1)}
                      className="p-1.5 hover:bg-white/80 rounded transition-colors"
                    >
                      {copiedId === 1 ? <Check className="w-4 h-4 text-[#52B788]" /> : <Copy className="w-4 h-4 text-[#CCCA00]" />}
                    </button>
                  </div>

                  {/* Domain Name */}
                  <Select
                    label="Domain Name"
                    options={[
                      { value: 'domain1', label: 'Domain 1' },
                      { value: 'domain2', label: 'Domain 2' },
                    ]}
                    value={applyAdsForm.domainName}
                    onChange={(value) => setApplyAdsForm({...applyAdsForm, domainName: value})}
                    placeholder="Select"
                  />

                  {/* Is App? Toggle */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Is App?</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApplyAdsForm({...applyAdsForm, isApp: 'yes'})}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          applyAdsForm.isApp === 'yes'
                            ? 'bg-[#FFFC00] text-black shadow-sm shadow-yellow-500/25 font-semibold'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setApplyAdsForm({...applyAdsForm, isApp: 'no'})}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          applyAdsForm.isApp === 'no'
                            ? 'bg-[#52B788] text-white shadow-sm shadow-green-500/25'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Domain */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Domain</label>
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#52B788]/5 to-[#FFFC00]/10 border border-[#52B788]/20 rounded-lg">
                      <span className="text-sm text-gray-700 font-medium">{applyAdsForm.domain}</span>
                    </div>
                  </div>

                  {/* Do you have a shopify shop? */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Do you have a shopify shop in this time applying ads?</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApplyAdsForm({...applyAdsForm, hasShopify: 'yes'})}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          applyAdsForm.hasShopify === 'yes'
                            ? 'bg-[#FFFC00] text-black shadow-sm shadow-yellow-500/25 font-semibold'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setApplyAdsForm({...applyAdsForm, hasShopify: 'no'})}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          applyAdsForm.hasShopify === 'no'
                            ? 'bg-[#52B788] text-white shadow-sm shadow-green-500/25'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Ad Number */}
                  <Select
                    label="Ad Number"
                    options={[
                      { value: '1', label: '1' },
                      { value: '2', label: '2' },
                      { value: '3', label: '3' },
                    ]}
                    value={applyAdsForm.adNumber}
                    onChange={(value) => setApplyAdsForm({...applyAdsForm, adNumber: value})}
                    placeholder="Select"
                  />

                  {/* Ads Account here */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Ads Account here</label>
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#52B788]/5 to-[#FFFC00]/10 border border-[#52B788]/20 rounded-lg">
                      <span className="text-sm text-gray-700 font-medium">{applyAdsForm.adsAccount}</span>
                    </div>
                  </div>

                  {/* Time zone */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Time zone</label>
                    <input
                      type="text"
                      placeholder="Time zone"
                      value={applyAdsForm.timeZone}
                      onChange={(e) => setApplyAdsForm({...applyAdsForm, timeZone: e.target.value})}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFFC00]/30 focus:border-[#FFFC00] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Deposit Amount List */}
                  <Select
                    label="Deposit Amount List"
                    options={[
                      { value: '0-100', label: '0-100' },
                      { value: '100-500', label: '100-500' },
                      { value: '500-1000', label: '500-1000' },
                    ]}
                    value={applyAdsForm.depositAmount}
                    onChange={(value) => setApplyAdsForm({...applyAdsForm, depositAmount: value})}
                    placeholder="0-100"
                  />

                  {/* Note */}
                  <div className="p-3 bg-gradient-to-r from-[#FFFC00]/15 to-[#52B788]/10 border border-[#FFFC00]/30 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Note:</span> Ads account 2 is free No need opening fee
                    </p>
                  </div>

                  {/* Message */}
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Message</label>
                    <textarea
                      placeholder="Enter your message"
                      value={applyAdsForm.message}
                      onChange={(e) => setApplyAdsForm({...applyAdsForm, message: e.target.value})}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFFC00]/30 focus:border-[#FFFC00] focus:bg-white resize-none transition-all"
                    />
                  </div>

                  {/* Privacy Policy */}
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" id="privacyPolicy" className="w-4 h-4 rounded border-gray-300 text-[#FFFC00] focus:ring-[#FFFC00]" />
                    <label htmlFor="privacyPolicy" className="text-sm text-gray-600">
                      You agree to our friendly <span className="text-gray-800 underline cursor-pointer hover:text-black font-medium">privacy policy</span>.
                    </label>
                  </div>

                  {/* Summary Cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#FFFC00]/10 border border-[#FFFC00]/30 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Total Deposit of Ads</p>
                      <p className="text-base font-bold text-gray-800">50 USD</p>
                    </div>
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#52B788]/5 border border-[#52B788]/20 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Total Cost</p>
                      <p className="text-base font-bold text-[#52B788]">500 USD</p>
                    </div>
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-lg text-center">
                      <p className="text-xs text-gray-500">Total Balance</p>
                      <p className="text-base font-bold text-[#3B82F6]">500 USD</p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button className="w-full bg-gradient-to-r from-[#FFFC00] to-[#E6E300] hover:from-[#E6E300] hover:to-[#CCCA00] text-black rounded-lg py-3 text-base font-bold shadow-lg shadow-yellow-500/30 transition-all hover:shadow-xl hover:shadow-yellow-500/40">
                    Pay and Submit
                  </Button>
                </div>
                  )}
                </>
              )}

              {/* Account List Table */}
              {activeSubPage === 'account-list' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FFFC00]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {accountListData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FFFC00]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.license}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-gray-800 font-medium font-mono">{item.adsAccountId}</span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.adsAccountName}</td>
                        <td className="py-4 px-5">
                          <div className="flex gap-2">
                            <button className="text-sm text-gray-700 hover:underline font-medium">Org Share</button>
                            <span className="text-gray-300">|</span>
                            <button className="text-sm text-[#52B788] hover:underline font-medium">Ads Deposit</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Account Applied Records Table */}
              {activeSubPage === 'account-applied-records' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FFFC00]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Request Start Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Details</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {appliedRecordsData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FFFC00]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.license}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-gray-800 font-medium">06:04:24</span>
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700 font-medium">{item.totalCost}</td>
                        <td className="py-4 px-5">
                          <button className="text-sm text-gray-700 hover:underline font-medium">View Details</button>
                        </td>
                        <td className="py-4 px-5">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Organization Share Log Table */}
              {activeSubPage === 'bm-share-log' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FFFC00]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bmShareLogData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FFFC00]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.adsAccountName}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-gray-800 font-medium font-mono">{item.adsAccountId}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-gray-800 font-medium">06:04:24</span>
                          </span>
                        </td>
                        <td className="py-4 px-5">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Deposit Report Table */}
              {(activeSubPage === 'deposit' || activeSubPage === 'deposit-report') && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FFFC00]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depositReportData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FFFC00]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFFC00]/20 to-[#FFFC00]/10 flex items-center justify-center text-sm font-semibold text-gray-800">
                            {item.id}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-gray-800 font-medium font-mono">{item.transactionId}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Transfer Balance / Refund / Refund Report - Placeholder */}
              {(activeSubPage === 'transfer-balance' || activeSubPage === 'refund' || activeSubPage === 'refund-report') && (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FFFC00]/20 to-[#52B788]/10 flex items-center justify-center text-[#FFCC00]">
                    <ComingSoonIcon />
                  </div>
                  <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                  <p className="text-sm text-gray-500 mt-2">This section is under development</p>
                </div>
              )}
          </div>

          {/* Pagination */}
          {activeSubPage !== 'apply-ads-account' && activeSubPage !== 'transfer-balance' && activeSubPage !== 'refund' && activeSubPage !== 'refund-report' && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#FFFC00]/10 hover:border-[#FFFC00]/40 hover:text-gray-800 transition-all"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {[1, 2, 3, '...', 8, 9, 10].map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof page === 'number' && setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-[#FFFC00] to-[#E6E300] text-black font-semibold shadow-sm'
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#FFFC00]/15 hover:text-gray-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#FFFC00]/10 hover:border-[#FFFC00]/40 hover:text-gray-800 transition-all"
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Organization Share Ad Account Modal */}
      <Modal
        isOpen={showBmShareModal}
        onClose={() => setShowBmShareModal(false)}
        title="Organization Share Ad Account"
        className="max-w-md"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          Share your Organization ID to connect accounts
        </p>

        <div className="space-y-5">
          {/* Organization ID */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Organization Id</label>
            <input
              type="text"
              placeholder="Organization Id"
              value={bmShareForm.bmId}
              onChange={(e) => setBmShareForm({...bmShareForm, bmId: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFFC00]/30 focus:border-[#FFFC00] focus:bg-white transition-all"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Message</label>
            <textarea
              placeholder="Enter your message"
              value={bmShareForm.message}
              onChange={(e) => setBmShareForm({...bmShareForm, message: e.target.value})}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FFFC00]/30 focus:border-[#FFFC00] focus:bg-white resize-none transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-200 rounded-xl py-3 hover:bg-gray-50"
              onClick={() => setShowBmShareModal(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1 bg-gradient-to-r from-[#FFFC00] to-[#E6E300] hover:from-[#E6E300] hover:to-[#CCCA00] text-black font-semibold rounded-xl py-3 shadow-md shadow-yellow-500/25">
              Submit
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </DashboardLayout>
  )
}
