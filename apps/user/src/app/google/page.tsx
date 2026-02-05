'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
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
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { authApi, accountsApi, transactionsApi, accountDepositsApi, dashboardApi, settingsApi, applicationsApi, PlatformStatus } from '@/lib/api'
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

      // Easing function for smooth animation
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

// Mock admin settings - In real app, these would come from API
const ADMIN_SETTINGS = {
  platformsEnabled: {
    facebook: true,
    google: true,
    tiktok: true,
    snapchat: true,
    bing: true,
  }
}

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

// Stats data will be computed from dashboard API response

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

// BM Share Log data
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

// Timezone options - comprehensive list for search
const timezoneOptions = [
  { value: 'UTC+0', label: 'UTC+0 (London, UK)' },
  { value: 'UTC+1', label: 'UTC+1 (Paris, France)' },
  { value: 'UTC+2', label: 'UTC+2 (Cairo, Egypt)' },
  { value: 'UTC+3', label: 'UTC+3 (Moscow, Russia)' },
  { value: 'UTC+3:30', label: 'UTC+3:30 (Tehran, Iran)' },
  { value: 'UTC+4', label: 'UTC+4 (Dubai, UAE)' },
  { value: 'UTC+4:30', label: 'UTC+4:30 (Kabul, Afghanistan)' },
  { value: 'UTC+5', label: 'UTC+5 (Karachi, Pakistan)' },
  { value: 'UTC+5:30', label: 'UTC+5:30 (Kolkata, India)' },
  { value: 'UTC+5:45', label: 'UTC+5:45 (Kathmandu, Nepal)' },
  { value: 'UTC+6', label: 'UTC+6 (Dhaka, Bangladesh)' },
  { value: 'UTC+6:30', label: 'UTC+6:30 (Yangon, Myanmar)' },
  { value: 'UTC+7', label: 'UTC+7 (Bangkok, Thailand)' },
  { value: 'UTC+8', label: 'UTC+8 (Singapore, Hong Kong)' },
  { value: 'UTC+9', label: 'UTC+9 (Tokyo, Japan)' },
  { value: 'UTC+9:30', label: 'UTC+9:30 (Adelaide, Australia)' },
  { value: 'UTC+10', label: 'UTC+10 (Sydney, Australia)' },
  { value: 'UTC+11', label: 'UTC+11 (Solomon Islands)' },
  { value: 'UTC+12', label: 'UTC+12 (Auckland, New Zealand)' },
  { value: 'UTC-12', label: 'UTC-12 (Baker Island)' },
  { value: 'UTC-11', label: 'UTC-11 (American Samoa)' },
  { value: 'UTC-10', label: 'UTC-10 (Hawaii, USA)' },
  { value: 'UTC-9', label: 'UTC-9 (Alaska, USA)' },
  { value: 'UTC-8', label: 'UTC-8 (Los Angeles, USA)' },
  { value: 'UTC-7', label: 'UTC-7 (Denver, USA)' },
  { value: 'UTC-6', label: 'UTC-6 (Chicago, USA)' },
  { value: 'UTC-5', label: 'UTC-5 (New York, USA)' },
  { value: 'UTC-4', label: 'UTC-4 (Santiago, Chile)' },
  { value: 'UTC-3', label: 'UTC-3 (Buenos Aires, Argentina)' },
  { value: 'UTC-2', label: 'UTC-2 (Mid-Atlantic)' },
  { value: 'UTC-1', label: 'UTC-1 (Azores, Portugal)' },
]

// Google brand colors
const brandColor = '#4285F4'
const brandColorDark = '#3367D6'
const brandGradient = 'from-[#4285F4] to-[#3367D6]'

export default function GooglePage() {
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

  // Generate dynamic chart path based on count - creates wave peaks for each pending item
  const generateChartPath = (count: number, trend: 'up' | 'down') => {
    if (count === 0) {
      return 'M0,38 L120,38'
    }
    const numPeaks = Math.min(count, 6)
    const segmentWidth = 120 / numPeaks
    let path = 'M0,35'
    for (let i = 0; i < numPeaks; i++) {
      const startX = i * segmentWidth
      const peakX = startX + segmentWidth * 0.5
      const endX = (i + 1) * segmentWidth
      const baseHeight = trend === 'up' ? 8 : 25
      const variation = (i % 2 === 0) ? 0 : 8
      const peakY = trend === 'up'
        ? baseHeight + variation + (i * 2)
        : baseHeight - variation + (i * 2)
      const cp1x = startX + segmentWidth * 0.2
      const cp2x = peakX - segmentWidth * 0.15
      const cp3x = peakX + segmentWidth * 0.15
      const cp4x = startX + segmentWidth * 0.8
      path += ` C${cp1x},35 ${cp2x},${peakY} ${peakX},${peakY}`
      path += ` C${cp3x},${peakY} ${cp4x},35 ${endX},35`
    }
    return path
  }

  // Helper function to calculate growth percentage and trend
  const calculateGrowth = (current: number, previous: number | undefined, isRefund: boolean = false) => {
    if (previous === undefined) {
      if (current > 0) {
        return {
          trend: isRefund ? 'down' as const : 'up' as const,
          badge: `${current} Active`
        }
      }
      return { trend: 'neutral' as const, badge: 'None' }
    }
    const diff = current - previous
    if (diff > 0) {
      return { trend: 'up' as const, badge: `+${diff} New` }
    } else if (diff < 0) {
      return { trend: 'down' as const, badge: `${diff} Resolved` }
    }
    if (current > 0) {
      return {
        trend: isRefund ? 'down' as const : 'up' as const,
        badge: `${current} Active`
      }
    }
    return { trend: 'neutral' as const, badge: 'None' }
  }

  // Compute statsData from dashboard API with dynamic chart paths
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
      {
        label: 'Pending Applications',
        numericValue: pendingApps,
        trend: appsGrowth.trend,
        badge: appsGrowth.badge,
        color: '#4285F4',
        chartPath: generateChartPath(pendingApps, 'up')
      },
      {
        label: 'Pending Deposits',
        numericValue: pendingDeps,
        trend: depsGrowth.trend,
        badge: depsGrowth.badge,
        color: '#34A853',
        chartPath: generateChartPath(pendingDeps, 'up')
      },
      {
        label: 'Pending Shares',
        numericValue: pendingSharesCount,
        trend: sharesGrowth.trend,
        badge: sharesGrowth.badge,
        color: '#FBBC04',
        chartPath: generateChartPath(pendingSharesCount, 'up')
      },
      {
        label: 'Pending Refunds',
        numericValue: pendingRefundsCount,
        trend: refundsGrowth.trend,
        badge: refundsGrowth.badge,
        color: '#EA4335',
        chartPath: generateChartPath(pendingRefundsCount, 'down')
      },
    ]
  }, [dashboardStats, previousStats])

  // Function to refresh only dashboard stats (for real-time updates)
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
    } catch (error) {
      // Silently handle errors
    }
  }

  // Handle Google ad account application submission
  const handleSubmitApplication = async () => {
    // Validation
    if (!privacyAccepted) {
      setSubmitError('Please accept the privacy policy')
      return
    }

    // Validate form fields
    for (let i = 0; i < adAccounts.length; i++) {
      const acc = adAccounts[i]
      if (businessType === 'clean' && !acc.domain) {
        setSubmitError(`Please enter domain for account ${i + 1}`)
        return
      }
      if (!acc.timezone) {
        setSubmitError(`Please select timezone for account ${i + 1}`)
        return
      }
      if (!acc.gmail) {
        setSubmitError(`Please enter Gmail for account ${i + 1}`)
        return
      }
      if (businessType === 'clean' && !acc.targetMarket) {
        setSubmitError(`Please enter target market for account ${i + 1}`)
        return
      }
    }

    // Check balance
    const totalDeposit = adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0)
    const openingFee = 30
    const totalCost = totalDeposit + openingFee

    if (userBalance < totalCost) {
      setSubmitError(`Insufficient balance. You need $${totalCost} but have $${userBalance.toFixed(2)}`)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      // Prepare account details - include all Google-specific fields in the name/remarks
      const accountDetails = adAccounts.map((acc, index) => ({
        name: businessType === 'clean'
          ? `${acc.domain} | ${acc.gmail} | ${acc.timezone} | ${acc.targetMarket}`
          : `${acc.gmail} | ${acc.timezone}`,
      }))

      const applicationData = {
        platform: 'GOOGLE',
        licenseType: 'NEW' as const,
        licenseNo: businessType === 'clean' ? 'Clean Business' : 'Black Hat',
        accountDetails,
        depositAmount: totalDeposit,
        remarks: `Business Type: ${businessType === 'clean' ? 'Clean (White Hat)' : 'Black Hat'}\n` +
          adAccounts.map((acc, i) =>
            `Account ${i + 1}: ${businessType === 'clean' ? `Domain: ${acc.domain}, ` : ''}Gmail: ${acc.gmail}, Timezone: ${acc.timezone}${businessType === 'clean' ? `, Target Market: ${acc.targetMarket}` : ''}, Deposit: $${acc.deposit}`
          ).join('\n'),
      }

      await applicationsApi.create(applicationData)

      setSubmitSuccess(true)
      // Refresh stats immediately to update pending count
      refreshStats()

      // Reset form
      setBusinessType('clean')
      setAdAccountCount('1')
      setAdAccounts([{ domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }])
      setPrivacyAccepted(false)

      // Refresh user data
      const [userRes, accountsRes] = await Promise.all([
        authApi.me(),
        accountsApi.getAll('GOOGLE')
      ])
      setUser(userRes.user)
      setUserAccounts(accountsRes.accounts || [])

    } catch (error: any) {
      console.error('Submit error:', error)
      setSubmitError(error.message || 'Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch each endpoint separately to handle individual failures gracefully
        const [userRes, accountsRes, refundsRes, depositsRes, statsRes, platformRes] = await Promise.all([
          authApi.me().catch(() => ({ user: null })),
          accountsApi.getAll('GOOGLE').catch(() => ({ accounts: [] })),
          transactionsApi.refunds.getAll('GOOGLE').catch(() => ({ refunds: [] })),
          accountDepositsApi.getAll('GOOGLE').catch(() => ({ deposits: [] })),
          dashboardApi.getStats().catch(() => ({})),
          settingsApi.platforms.get().catch(() => ({ platforms: { facebook: 'active', google: 'active', tiktok: 'active', snapchat: 'active', bing: 'active' } }))
        ])
        setUser(userRes.user)
        setUserAccounts(accountsRes.accounts || [])
        setUserRefunds(refundsRes.refunds || [])
        setUserDeposits(depositsRes.deposits || [])
        setDashboardStats(statsRes)
        setPlatformStatus((platformRes.platforms?.google || 'active') as PlatformStatus)
      } catch (error) {
        // Silently handle errors - user will see empty data
      } finally {
        setLoading(false)
      }
    }
    fetchData()
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
        filename = 'google_account_list'
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
        filename = 'google_applied_records'
        headers = ['Apply ID', 'License', 'Request Time', 'Total Cost', 'Status']
        data = userAccounts.map(acc => ({
          'Apply ID': acc.id || '-',
          'License': acc.licenseName || '-',
          'Request Time': acc.createdAt ? new Date(acc.createdAt).toLocaleString() : '-',
          'Total Cost': `$${acc.totalCost || 0}`,
          'Status': acc.status || '-'
        }))
        break

      case 'deposit':
      case 'deposit-report':
        filename = exportType === 'deposit' ? 'google_deposits' : 'google_deposit_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Created At']
        data = userDeposits.map(dep => ({
          'Account ID': dep.accountId || '-',
          'Account Name': dep.accountName || '-',
          'Amount': `$${dep.amount || 0}`,
          'Status': dep.status || '-',
          'Created At': dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '-'
        }))
        break

      case 'refund':
      case 'refund-report':
        filename = exportType === 'refund' ? 'google_refunds' : 'google_refund_report'
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

  // Auto-refresh stats every 1 second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStats()
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Get user's Google commission rate from API (fallback to 5% if not set)
  const googleCommissionRate = user?.googleCommission ? parseFloat(user.googleCommission) : 5

  // User wallet balance from API (walletBalance is the correct field name)
  const userBalance = user?.walletBalance ? parseFloat(user.walletBalance) : 0

  // Check if platform is enabled and if user has existing accounts
  // platformStatus: 'active' = can apply, 'stop' = visible but can't apply, 'hidden' = not shown
  const platformEnabled = platformStatus === 'active'
  const platformStopped = platformStatus === 'stop'
  const hasExistingAccounts = userAccounts.length > 0

  // Modal states
  const [showBmShareModal, setShowBmShareModal] = useState(false)

  // Form states
  const [businessType, setBusinessType] = useState<'clean' | 'blackhat'>('clean')
  const [adAccountCount, setAdAccountCount] = useState('1')
  const [adAccounts, setAdAccounts] = useState<{ domain: string; timezone: string; gmail: string; targetMarket: string; deposit: string }[]>([
    { domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }
  ])
  const [applyAdsForm, setApplyAdsForm] = useState({
    licenseNo: '',
    pageNumber: '',
    pageUrl: '',
    domainName: '',
    isApp: 'no',
    domain: 'Https:///ads.google.com',
    hasShopify: 'no',
    adNumber: '',
    adsAccount: 'Https:///ads.google.com',
    timeZone: '',
    depositAmount: '',
    message: ''
  })

  const [bmShareForm, setBmShareForm] = useState({
    bmId: '',
    message: ''
  })

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

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
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}><CheckCircle className="w-3 h-3" /> Approved</span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}><Clock className="w-3 h-3" /> Pending</span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}><XCircle className="w-3 h-3" /> Rejected</span>
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
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
        { id: 'bm-share-log' as SubPage, label: 'MCC Share Log' },
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
    <DashboardLayout title="Google User Management Account" subtitle="">
      {/* Show Coming Soon if platform disabled and no existing accounts */}
      {!platformEnabled && !hasExistingAccounts ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 flex items-center justify-center text-[#4285F4]">
              <ComingSoonIcon />
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</p>
            <p className="text-base text-gray-600 mb-4">Google Ads platform is currently unavailable</p>
            <p className="text-sm text-gray-400">Please check back later or contact support for more information</p>
          </div>
        </div>
      ) : (
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(66, 133, 244, 0.2); }
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
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(66, 133, 244, 0.15); }
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
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#4285F4]/20 focus:border-[#4285F4] focus:bg-white transition-all"
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
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#4285F4]/10 hover:text-[#4285F4] transition-colors duration-150 flex items-center gap-2"
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
          className={`bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-md shadow-sm whitespace-nowrap text-xs px-3 py-1.5 h-auto`}
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
              {/* Chart container - positioned on the right with smooth transitions */}
              <div className="w-16 h-8 lg:w-24 lg:h-12 relative hidden sm:block">
                <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`stat-gradient-google-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {/* Area fill with transition */}
                  <path
                    d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`}
                    fill={`url(#stat-gradient-google-${index})`}
                    className="transition-all duration-700 ease-in-out"
                  />
                  {/* Line stroke with transition */}
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
            <div className="absolute inset-0 bg-gradient-to-br from-[#4285F4]/5 via-transparent to-[#52B788]/5" />

            {/* Google Logo - Larger and balanced */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg shadow-blue-500/20 border border-gray-100">
                  <svg viewBox="0 0 24 24" className="w-8 h-8">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#4285F4]/5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-all duration-300 ${
                        expandedSections.includes(menu.section)
                          ? 'rotate-180 text-[#4285F4]'
                          : 'rotate-0 text-gray-400'
                      }`}
                    />
                  </button>

                  <div
                    className={`ml-5 space-y-1 border-l-2 border-[#4285F4]/20 pl-4 overflow-hidden transition-all duration-300 ease-in-out ${
                      expandedSections.includes(menu.section)
                        ? 'max-h-96 opacity-100 mt-1'
                        : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
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
                            ? 'bg-gradient-to-r from-[#4285F4] to-[#3367D6] text-white font-medium shadow-md shadow-blue-200'
                            : 'text-gray-600 hover:bg-[#4285F4]/5 hover:text-[#4285F4]'
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

        {/* Right Content - Scrollable Form */}
        <Card className="flex-1 p-0 rounded-2xl overflow-hidden border border-gray-100/50 shadow-sm flex flex-col min-h-0">
          {/* Scrollable Content Area */}
          <div className="overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-white to-gray-50/30">
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
                  ) : !platformEnabled && hasExistingAccounts ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 flex items-center justify-center text-[#4285F4]">
                        <ComingSoonIcon />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                      <p className="text-sm text-gray-500 mt-2">New account applications are currently disabled</p>
                      <p className="text-xs text-gray-400 mt-3">You can still manage your existing accounts through the menu</p>
                    </div>
                  ) : (
                <div className="px-8 py-6 space-y-6">
                  {/* Business Type Toggle */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">Business Type</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setBusinessType('clean')}
                        className={`flex-1 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                          businessType === 'clean'
                            ? 'bg-gradient-to-r from-[#4285F4] to-[#3367D6] text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Clean Business (White Hat)
                      </button>
                      <button
                        onClick={() => setBusinessType('blackhat')}
                        className={`flex-1 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                          businessType === 'blackhat'
                            ? 'bg-gradient-to-r from-[#1F2937] to-[#374151] text-white shadow-lg shadow-gray-500/30'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Black Hat
                      </button>
                    </div>
                  </div>

                  {/* Ad Num Selector */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">
                      <span className="text-red-500">*</span> Ad Num
                    </label>
                    <Select
                      options={[
                        { value: '1', label: '1' },
                        { value: '2', label: '2' },
                        { value: '3', label: '3' },
                        { value: '4', label: '4' },
                        { value: '5', label: '5' },
                      ]}
                      value={adAccountCount}
                      onChange={(value) => {
                        setAdAccountCount(value)
                        const count = parseInt(value)
                        setAdAccounts(Array.from({ length: count }, (_, i) =>
                          adAccounts[i] || { domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }
                        ))
                      }}
                      placeholder="Select number of accounts"
                    />
                  </div>

                  {/* Ad Account Fields */}
                  <div className="space-y-6">
                    {adAccounts.map((account, index) => (
                      <div key={index} className="p-5 bg-gradient-to-br from-[#4285F4]/5 to-[#34A853]/5 rounded-xl border border-[#4285F4]/10 space-y-4">
                        {/* Clean Business Fields */}
                        {businessType === 'clean' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.clean domain</label>
                              <input
                                type="text"
                                placeholder="Please enter domain"
                                value={account.domain}
                                onChange={(e) => {
                                  const updated = [...adAccounts]
                                  updated[index].domain = e.target.value
                                  setAdAccounts(updated)
                                }}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.ads timezone</label>
                              <SearchableSelect
                                options={timezoneOptions}
                                value={account.timezone}
                                onChange={(value) => {
                                  const updated = [...adAccounts]
                                  updated[index].timezone = value
                                  setAdAccounts(updated)
                                }}
                                placeholder="Select Timezone"
                                searchPlaceholder="Type to search (e.g., kol)"
                              />
                            </div>
                          </div>
                        )}

                        {/* Common Fields for both types */}
                        <div className="grid grid-cols-2 gap-4">
                          {businessType === 'blackhat' && (
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.ads timezone</label>
                              <SearchableSelect
                                options={timezoneOptions}
                                value={account.timezone}
                                onChange={(value) => {
                                  const updated = [...adAccounts]
                                  updated[index].timezone = value
                                  setAdAccounts(updated)
                                }}
                                placeholder="Select Timezone"
                                searchPlaceholder="Type to search (e.g., kol)"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">{index + 1}.gmail</label>
                            <input
                              type="email"
                              placeholder="Please enter Ads Gmail"
                              value={account.gmail}
                              onChange={(e) => {
                                const updated = [...adAccounts]
                                updated[index].gmail = e.target.value
                                setAdAccounts(updated)
                              }}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                            />
                          </div>
                          {businessType === 'clean' && (
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.target market</label>
                              <input
                                type="text"
                                placeholder="Please enter target market"
                                value={account.targetMarket}
                                onChange={(e) => {
                                  const updated = [...adAccounts]
                                  updated[index].targetMarket = e.target.value
                                  setAdAccounts(updated)
                                }}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                          )}
                        </div>

                        {/* Deposit Field */}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">{index + 1}.ads deposit</label>
                          <Select
                            options={[
                              { value: '50', label: '$50' },
                              { value: '100', label: '$100' },
                              { value: '200', label: '$200' },
                              { value: '500', label: '$500' },
                              { value: '1000', label: '$1000' },
                            ]}
                            value={account.deposit}
                            onChange={(value) => {
                              const updated = [...adAccounts]
                              updated[index].deposit = value
                              setAdAccounts(updated)
                            }}
                            placeholder="Please enter Ads Deposit"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Privacy Policy */}
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="privacyPolicy"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#4285F4] focus:ring-[#4285F4]"
                    />
                    <label htmlFor="privacyPolicy" className="text-sm text-gray-600">
                      You agree to our friendly <span className="text-[#4285F4] underline cursor-pointer hover:text-[#3367D6]">privacy policy</span>.
                    </label>
                  </div>

                  {/* Error/Success Messages */}
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                      {submitError}
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">
                      Application submitted successfully! Your request is now pending review.
                    </div>
                  )}

                  {/* Summary Cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 p-4 bg-gradient-to-br from-white to-[#4285F4]/5 border border-[#4285F4]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Total Deposit</p>
                      <p className="text-lg font-bold text-[#4285F4]">
                        ${adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex-1 p-4 bg-gradient-to-br from-white to-[#52B788]/5 border border-[#52B788]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Opening Fee</p>
                      <p className="text-lg font-bold text-[#52B788]">$30</p>
                    </div>
                    <div className="flex-1 p-4 bg-gradient-to-br from-white to-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Total Cost</p>
                      <p className="text-lg font-bold text-[#3B82F6]">
                        ${(adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0) + 30).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmitApplication}
                    disabled={isSubmitting || userBalance < (adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0) + 30)}
                    className={`w-full bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-xl py-3.5 text-base font-semibold shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </span>
                    ) : userBalance < (adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0) + 30) ? (
                      'Insufficient Balance'
                    ) : (
                      `Pay $${(adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0) + 30).toLocaleString()} and Submit`
                    )}
                  </Button>
                </div>
                  )}
                </>
              )}

              {/* Account List Cards */}
              {activeSubPage === 'account-list' && (
                <div className="p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Your Ad Accounts</h3>
                      <p className="text-sm text-gray-500 mt-1">Manage your Google advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Total:</span>
                      <span className="px-3 py-1 bg-[#4285F4]/10 text-[#4285F4] rounded-full text-sm font-semibold">{userAccounts.length} accounts</span>
                    </div>
                  </div>

                  {/* Account Cards Grid */}
                  <div className="grid gap-4">
                    {userAccounts.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4285F4]/10 flex items-center justify-center">
                          <span className="text-2xl">📊</span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">No Ad Accounts Yet</h4>
                        <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                          You don't have any approved ad accounts. Apply for a new ad account to get started.
                        </p>
                        <button
                          onClick={() => setActiveSubPage('apply-ads-account')}
                          className="px-4 py-2 bg-[#4285F4] text-white rounded-lg text-sm font-medium hover:bg-[#3367D6] transition-colors"
                        >
                          Apply for Ad Account
                        </button>
                      </div>
                    ) : userAccounts.map((item: any, index: number) => (
                      <div
                        key={item.id}
                        className="table-row-animate p-4 bg-white border border-gray-100 rounded-xl hover:border-[#4285F4]/30 hover:shadow-lg hover:shadow-[#4285F4]/5 transition-all duration-300 group"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="grid grid-cols-3 items-center gap-4">
                          {/* Left Side - Account Info */}
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Account Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center group-hover:from-[#4285F4]/20 group-hover:to-[#4285F4]/10 transition-all flex-shrink-0">
                              <span className="text-lg font-bold text-[#4285F4]">{(item.accountName || 'G').charAt(0).toUpperCase()}</span>
                            </div>

                            {/* Account Details */}
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-800">{item.accountName || 'Google Ad Account'}</h4>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-gray-500">License:</span>
                                <span className="text-gray-700 font-medium">{item.licenseName || item.license || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Center - Account ID */}
                          <div className="flex justify-center">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                              <span className="text-xs text-gray-500">ID:</span>
                              <span className="text-sm text-[#4285F4] font-mono font-semibold">{item.accountId}</span>
                            </div>
                          </div>

                          {/* Right Side - Actions */}
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              className="px-4 py-2 bg-[#4285F4]/10 text-[#4285F4] rounded-lg text-sm font-medium hover:bg-[#4285F4] hover:text-white transition-all duration-200"
                            >
                              MCC Share
                            </button>
                            <button
                              className="px-4 py-2 bg-[#52B788]/10 text-[#52B788] rounded-lg text-sm font-medium hover:bg-[#52B788] hover:text-white transition-all duration-200"
                            >
                              Deposit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Applied Records Table */}
              {activeSubPage === 'account-applied-records' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Request Start Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Details</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {appliedRecordsData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.license}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-[#4285F4] font-medium">06:04:24</span>
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700 font-medium">{item.totalCost}</td>
                        <td className="py-4 px-5">
                          <button className="text-sm text-[#4285F4] hover:underline font-medium">View Details</button>
                        </td>
                        <td className="py-4 px-5">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* MCC Share Log Table */}
              {activeSubPage === 'bm-share-log' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bmShareLogData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.adsAccountName}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-[#4285F4] font-medium font-mono">{item.adsAccountId}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-[#4285F4] font-medium">06:04:24</span>
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
                    <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depositReportData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center text-sm font-semibold text-[#4285F4]">
                            {item.id}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-[#4285F4] font-medium font-mono">{item.transactionId}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Transfer Balance / Refund / Refund Report - Placeholder */}
              {(activeSubPage === 'transfer-balance' || activeSubPage === 'refund' || activeSubPage === 'refund-report') && (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#4285F4]/10 to-[#52B788]/10 flex items-center justify-center text-[#4285F4]">
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#4285F4]/5 hover:border-[#4285F4]/30 hover:text-[#4285F4] transition-all"
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
                        ? `bg-gradient-to-r ${brandGradient} text-white shadow-sm`
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#4285F4]/10 hover:text-[#4285F4]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#4285F4]/5 hover:border-[#4285F4]/30 hover:text-[#4285F4] transition-all"
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* MCC Share Ad Account Modal */}
      <Modal
        isOpen={showBmShareModal}
        onClose={() => setShowBmShareModal(false)}
        title="MCC Share Ad Account"
        className="max-w-md"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          Share your MCC ID to connect accounts
        </p>

        <div className="space-y-5">
          {/* MCC ID */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">MCC Id</label>
            <input
              type="text"
              placeholder="MCC Id"
              value={bmShareForm.bmId}
              onChange={(e) => setBmShareForm({...bmShareForm, bmId: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] focus:bg-white transition-all"
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] focus:bg-white resize-none transition-all"
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
            <Button className={`flex-1 bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] rounded-xl py-3 shadow-md shadow-blue-500/25`}>
              Submit
            </Button>
          </div>
        </div>
      </Modal>
      </div>
      )}
    </DashboardLayout>
  )
}
