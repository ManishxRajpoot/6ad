'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Input } from '@/components/ui/Input'
import { applicationsApi, authApi, accountsApi, transactionsApi, accountDepositsApi, bmShareApi, balanceTransfersApi, accountRefundsApi, dashboardApi, settingsApi, PlatformStatus } from '@/lib/api'
import { Confetti, useConfetti } from '@/components/ui/Confetti'
import { AccountManageIcon, DepositManageIcon, AfterSaleIcon, ComingSoonIcon, EmptyStateIcon } from '@/components/icons/MenuIcons'
import { useAuthStore } from '@/store/auth'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Download,
  Copy,
  Check,
  Wallet,
  Loader2,
} from 'lucide-react'

// Mock data - In real app, these would come from API/admin settings
const ADMIN_SETTINGS = {
  openingFee: 30,
  unlimitedDomainFee: 50,
  extraPageFee: 5,
  depositMarkupPercent: 5,
  minimumDeposit: 100,
  profileShareLink: 'https://www.facebook.com/profile/6adplatform',
  platformsEnabled: {
    facebook: true,
    google: false,  // Example: Google is disabled
    tiktok: true,
    snapchat: true,
    bing: true,
  }
}

// Note: existingLicenses will be derived dynamically from user's approved accounts
// See userLicenseOptions useMemo below

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

// Page count options
const pageCountOptions = [
  { value: '1', label: '1 Page' },
  { value: '2', label: '2 Pages' },
  { value: '3', label: '3 Pages' },
  { value: '4', label: '4 Pages' },
  { value: '5', label: '5 Pages' },
  { value: '6', label: '6 Pages' },
  { value: '7', label: '7 Pages' },
  { value: '8', label: '8 Pages' },
  { value: '9', label: '9 Pages' },
  { value: '10', label: '10 Pages' },
]

// Domain count options
const domainCountOptions = [
  { value: '1', label: '1 Domain' },
  { value: '2', label: '2 Domains' },
  { value: '3', label: '3 Domains' },
  { value: '4', label: '4 Domains' },
  { value: '5', label: '5 Domains' },
]

// Ad account count options
const adAccountCountOptions = [
  { value: '1', label: '1 Ad Account' },
  { value: '2', label: '2 Ad Accounts' },
  { value: '3', label: '3 Ad Accounts' },
  { value: '4', label: '4 Ad Accounts' },
  { value: '5', label: '5 Ad Accounts' },
]

// Deposit options for apply form
const depositOptions = [
  { value: '50', label: '$50' },
  { value: '100', label: '$100' },
  { value: '150', label: '$150' },
  { value: '200', label: '$200' },
]

// Deposit amount options for deposit page (fixed amounts only)
const depositAmountOptions = [
  { value: '50', label: '$50' },
  { value: '100', label: '$100' },
  { value: '150', label: '$150' },
  { value: '200', label: '$200' },
  { value: '250', label: '$250' },
]

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

// Stats data will be computed from dashboard API response

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

// NOTE: Mock data has been removed - now using real API data from:
// - userAccounts: accountsApi.getAll('FACEBOOK')
// - userApplications: applicationsApi.getAll('FACEBOOK')
// - userRefunds: transactionsApi.refunds.getAll('FACEBOOK')
// The following sections still need backend APIs:
// - BM Share Log (showing empty state)
// - Account Deposits (showing empty state)

type SubPage = 'apply-ads-account' | 'account-list' | 'account-applied-records' | 'bm-share-log' | 'deposit' | 'deposit-report' | 'transfer-balance' | 'refund' | 'refund-report'

type MenuSection = 'account-manage' | 'deposit-manage' | 'after-sale'

type AdAccountEntry = {
  name: string
  timezone: string
  deposit: string
}

type ApplicationDetails = {
  licenseType: 'new' | 'existing'
  pages: number
  pageUrls: string[]
  unlimitedDomain: boolean
  domains: number
  domainUrls: string[]
  isApp: boolean
  appId: string
  adAccounts: { name: string; timezone: string; deposit: number }[]
  message: string
}

type AppliedRecord = {
  id: number
  applyId: string
  license: string
  requestTime: string
  totalCost: number
  status: string
  details: ApplicationDetails
}

type DepositRow = {
  id: number
  accountId: string
  amount: string
}

export default function FacebookPage() {
  const ITEMS_PER_PAGE = 10
  const { updateUser } = useAuthStore()
  const { showConfetti, triggerConfetti } = useConfetti()

  const [activeSubPage, setActiveSubPage] = useState<SubPage>('account-list')
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['account-manage', 'deposit-manage', 'after-sale'])
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // Modal states
  const [showBmShareModal, setShowBmShareModal] = useState(false)
  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false)
  const [showRefundReasonModal, setShowRefundReasonModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<AppliedRecord | null>(null)
  const [selectedAccountForBmShare, setSelectedAccountForBmShare] = useState<{ id: number; license: string; adsAccountId: string; adsAccountName: string } | null>(null)
  const [refundReason, setRefundReason] = useState('')

  // Form states for Apply Ads Account
  const [licenseType, setLicenseType] = useState<'new' | 'existing'>('new')
  const [newLicenseName, setNewLicenseName] = useState('')
  const [selectedLicense, setSelectedLicense] = useState('')
  const [pageCount, setPageCount] = useState('1')
  const [pageUrls, setPageUrls] = useState<string[]>([''])
  const [pageShareConfirmed, setPageShareConfirmed] = useState(false)
  const [unlimitedDomain, setUnlimitedDomain] = useState<'yes' | 'no'>('no')
  const [domainCount, setDomainCount] = useState('1')
  const [domainUrls, setDomainUrls] = useState<string[]>([''])
  const [isApp, setIsApp] = useState<'yes' | 'no'>('no')
  const [appId, setAppId] = useState('')
  const [adAccountCount, setAdAccountCount] = useState('1')
  const [adAccounts, setAdAccounts] = useState<AdAccountEntry[]>([{ name: '', timezone: '', deposit: '50' }])
  const [message, setMessage] = useState('')
  const [useCoupon, setUseCoupon] = useState(false)

  const [bmShareForm, setBmShareForm] = useState({
    bmId: '',
    message: ''
  })
  const [bmShareSubmitting, setBmShareSubmitting] = useState(false)
  const [bmShareSuccess, setBmShareSuccess] = useState(false)
  const [bmShareError, setBmShareError] = useState<string | null>(null)

  // Deposit form state
  const [depositRows, setDepositRows] = useState<DepositRow[]>([{ id: 1, accountId: '', amount: '' }])
  const [depositToastSuccess, setDepositToastSuccess] = useState(false)

  // Application toast state
  const [applicationToastSuccess, setApplicationToastSuccess] = useState(false)

  // Transfer balance form state
  const [transferRows, setTransferRows] = useState<{ id: number; fromAccount: string; toAccount: string; amount: string }[]>([
    { id: 1, fromAccount: '', toAccount: '', amount: '' }
  ])
  const [transferToastSuccess, setTransferToastSuccess] = useState(false)

  // Refund form state
  const [refundRows, setRefundRows] = useState<{ id: number; accountId: string; amount: string }[]>([
    { id: 1, accountId: '', amount: '' }
  ])
  const [refundToastSuccess, setRefundToastSuccess] = useState(false)

  // API states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userAccounts, setUserAccounts] = useState<any[]>([])
  const [userApplications, setUserApplications] = useState<any[]>([])
  const [userRefunds, setUserRefunds] = useState<any[]>([])
  const [balanceTransfers, setBalanceTransfers] = useState<any[]>([])
  const [bmShareHistory, setBmShareHistory] = useState<any[]>([])
  const [accountDeposits, setAccountDeposits] = useState<any[]>([])
  const [cheetahBalances, setCheetahBalances] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [reportTab, setReportTab] = useState<'transfer' | 'refund'>('transfer')
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [previousStats, setPreviousStats] = useState<any>(null)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>('active')
  const [profileShareLink, setProfileShareLink] = useState<string>('https://www.facebook.com/profile/6adplatform')
  const [seenApprovals, setSeenApprovals] = useState<Set<string>>(new Set())

  // Generate dynamic chart path based on count - creates wave peaks for each pending item
  const generateChartPath = (count: number, trend: 'up' | 'down') => {
    // If count is 0, show flat line at bottom
    if (count === 0) {
      return 'M0,38 L120,38'
    }

    // Generate peaks based on count (max 6 peaks for readability)
    const numPeaks = Math.min(count, 6)
    const segmentWidth = 120 / numPeaks

    let path = 'M0,35' // Start slightly above bottom

    for (let i = 0; i < numPeaks; i++) {
      const startX = i * segmentWidth
      const peakX = startX + segmentWidth * 0.5
      const endX = (i + 1) * segmentWidth

      // Create varying peak heights for visual interest
      const baseHeight = trend === 'up' ? 8 : 25
      const variation = (i % 2 === 0) ? 0 : 8 // Alternate peak heights
      const peakY = trend === 'up'
        ? baseHeight + variation + (i * 2)
        : baseHeight - variation + (i * 2)

      // Create smooth wave using cubic bezier for rounder peaks
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
    // If no previous data, show current count as status
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

    // No change - show current count
    if (current > 0) {
      return {
        trend: isRefund ? 'down' as const : 'up' as const,
        badge: `${current} Active`
      }
    }
    return { trend: 'neutral' as const, badge: 'None' }
  }

  // Compute statsData from dashboard API with dynamic chart paths based on pending counts
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
        color: '#8B5CF6',
        chartPath: generateChartPath(pendingApps, 'up')
      },
      {
        label: 'Pending Deposits',
        numericValue: pendingDeps,
        trend: depsGrowth.trend,
        badge: depsGrowth.badge,
        color: '#22C55E',
        chartPath: generateChartPath(pendingDeps, 'up')
      },
      {
        label: 'Pending Shares',
        numericValue: pendingSharesCount,
        trend: sharesGrowth.trend,
        badge: sharesGrowth.badge,
        color: '#F97316',
        chartPath: generateChartPath(pendingSharesCount, 'up')
      },
      {
        label: 'Pending Refunds',
        numericValue: pendingRefundsCount,
        trend: refundsGrowth.trend,
        badge: refundsGrowth.badge,
        color: '#EF4444',
        chartPath: generateChartPath(pendingRefundsCount, 'down')
      },
    ]
  }, [dashboardStats, previousStats])

  // Function to refresh only dashboard stats (for real-time updates)
  const refreshStats = async () => {
    try {
      const statsRes = await dashboardApi.getStats().catch(() => ({}))
      // Store previous stats before updating (only if values changed)
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

  // Function to refresh all data
  const refreshAllData = async () => {
    try {
      const [userRes, accountsRes, applicationsRes, refundsRes, transfersRes, bmShareRes, depositsRes, statsRes, platformRes, profileLinksRes] = await Promise.all([
        authApi.me().catch(() => ({ user: null })),
        accountsApi.getAll('FACEBOOK').catch(() => ({ accounts: [] })),
        applicationsApi.getAll('FACEBOOK').catch(() => ({ applications: [] })),
        accountRefundsApi.getAll('FACEBOOK').catch(() => ({ refunds: [] })),
        balanceTransfersApi.getAll('FACEBOOK').catch(() => ({ transfers: [] })),
        bmShareApi.getAll('FACEBOOK').catch(() => ({ bmShareRequests: [] })),
        accountDepositsApi.getAll('FACEBOOK').catch(() => ({ deposits: [] })),
        dashboardApi.getStats().catch(() => ({})),
        settingsApi.platforms.get().catch(() => ({ platforms: { facebook: 'active', google: 'active', tiktok: 'active', snapchat: 'active', bing: 'active' } })),
        settingsApi.profileShareLinks.get().catch(() => ({ profileShareLinks: { facebook: 'https://www.facebook.com/profile/6adplatform', tiktok: 'https://business.tiktok.com/share/6adplatform' } }))
      ])
      if (userRes.user) {
        setUser(userRes.user)
        updateUser(userRes.user)
      }
      const accounts = accountsRes.accounts || []
      setUserAccounts(accounts)
      setUserApplications(applicationsRes.applications || [])
      setUserRefunds(refundsRes.refunds || [])
      setBalanceTransfers(transfersRes.transfers || [])
      setBmShareHistory(bmShareRes.bmShareRequests || [])
      setAccountDeposits(depositsRes.deposits || [])
      setDashboardStats(statsRes)
      setPlatformStatus((platformRes.platforms?.facebook || 'active') as PlatformStatus)
      setProfileShareLink(profileLinksRes.profileShareLinks?.facebook || 'https://www.facebook.com/profile/6adplatform')

      // Fetch Cheetah balances for Facebook accounts
      if (accounts.length > 0) {
        const fbAccountIds = accounts.map((acc: any) => acc.accountId).filter(Boolean)
        if (fbAccountIds.length > 0) {
          try {
            const balancesRes = await accountsApi.getCheetahBalancesBatch(fbAccountIds)
            if (balancesRes.balances) {
              setCheetahBalances(balancesRes.balances)
            }
          } catch (err) {
            // Silently handle - Cheetah balance is optional
          }
        }
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true)
        await refreshAllData()
      } catch (error) {
        // Silently handle errors
      } finally {
        setIsLoading(false)
      }
    }
    fetchUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-refresh stats every 1 second for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStats()
    }, 1000) // 1 second

    return () => clearInterval(interval)
  }, [])

  // Check for new approvals and trigger confetti celebration
  useEffect(() => {
    if (userApplications.length > 0) {
      // Get stored seen approvals from localStorage
      const storedApprovals = localStorage.getItem('fb_seen_approvals')
      const previouslySeenSet = new Set<string>(storedApprovals ? JSON.parse(storedApprovals) : [])

      // Find newly approved applications
      const approvedApps = userApplications.filter(app =>
        app.status === 'APPROVED' || app.status === 'approved'
      )

      const newApprovals = approvedApps.filter(app => !previouslySeenSet.has(app.id))

      // If there are new approvals, trigger confetti!
      if (newApprovals.length > 0) {
        triggerConfetti()

        // Update the seen approvals set
        const newSeenSet = new Set([...previouslySeenSet, ...newApprovals.map(app => app.id)])
        setSeenApprovals(newSeenSet)
        localStorage.setItem('fb_seen_approvals', JSON.stringify([...newSeenSet]))
      }
    }
  }, [userApplications, triggerConfetti])

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
        filename = 'facebook_account_list'
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
        filename = 'facebook_applied_records'
        headers = ['Apply ID', 'License', 'Request Time', 'Total Cost', 'Status']
        data = userApplications.map(app => ({
          'Apply ID': app.id || '-',
          'License': app.licenseName || '-',
          'Request Time': app.createdAt ? new Date(app.createdAt).toLocaleString() : '-',
          'Total Cost': `$${app.totalCost || 0}`,
          'Status': app.status || '-'
        }))
        break

      case 'bm-share-log':
        filename = 'facebook_bm_share_log'
        headers = ['Account ID', 'Account Name', 'BM ID', 'Shared At', 'Status']
        data = bmShareHistory.map(share => ({
          'Account ID': share.accountId || '-',
          'Account Name': share.accountName || '-',
          'BM ID': share.bmId || '-',
          'Shared At': share.createdAt ? new Date(share.createdAt).toLocaleString() : '-',
          'Status': share.status || '-'
        }))
        break

      case 'deposit':
        filename = 'facebook_deposits'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Created At']
        data = accountDeposits.map(dep => ({
          'Account ID': dep.accountId || '-',
          'Account Name': dep.accountName || '-',
          'Amount': `$${dep.amount || 0}`,
          'Status': dep.status || '-',
          'Created At': dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '-'
        }))
        break

      case 'deposit-report':
        filename = 'facebook_deposit_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Fee', 'Total', 'Status', 'Date']
        data = accountDeposits.map(dep => ({
          'Account ID': dep.accountId || '-',
          'Account Name': dep.accountName || '-',
          'Amount': `$${dep.amount || 0}`,
          'Fee': `$${dep.fee || 0}`,
          'Total': `$${(dep.amount || 0) + (dep.fee || 0)}`,
          'Status': dep.status || '-',
          'Date': dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '-'
        }))
        break

      case 'transfer-balance':
        filename = 'facebook_balance_transfers'
        headers = ['From Account', 'To Account', 'Amount', 'Status', 'Transfer Date']
        data = balanceTransfers.map(transfer => ({
          'From Account': transfer.fromAccountId || '-',
          'To Account': transfer.toAccountId || '-',
          'Amount': `$${transfer.amount || 0}`,
          'Status': transfer.status || '-',
          'Transfer Date': transfer.createdAt ? new Date(transfer.createdAt).toLocaleString() : '-'
        }))
        break

      case 'refund':
        filename = 'facebook_refunds'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Request Date']
        data = userRefunds.map(refund => ({
          'Account ID': refund.accountId || '-',
          'Account Name': refund.accountName || '-',
          'Amount': `$${refund.amount || 0}`,
          'Status': refund.status || '-',
          'Request Date': refund.createdAt ? new Date(refund.createdAt).toLocaleString() : '-'
        }))
        break

      case 'refund-report':
        filename = 'facebook_refund_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Reason', 'Status', 'Request Date', 'Processed Date']
        data = userRefunds.map(refund => ({
          'Account ID': refund.accountId || '-',
          'Account Name': refund.accountName || '-',
          'Amount': `$${refund.amount || 0}`,
          'Reason': refund.reason || '-',
          'Status': refund.status || '-',
          'Request Date': refund.createdAt ? new Date(refund.createdAt).toLocaleString() : '-',
          'Processed Date': refund.processedAt ? new Date(refund.processedAt).toLocaleString() : '-'
        }))
        break

      default:
        return
    }

    if (data.length === 0) {
      alert('No data available to export')
      return
    }

    // Create CSV content (Excel compatible)
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] || ''
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value).replace(/"/g, '""')
        return escaped.includes(',') ? `"${escaped}"` : escaped
      }).join(','))
    ].join('\n')

    // Create and download file
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

  // Handle submit application
  const handleSubmitApplication = async () => {
    if (!pageShareConfirmed) {
      setSubmitError('Please confirm that you have shared your pages')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      // Prepare account details
      const accountDetails = adAccounts.map(acc => ({
        name: acc.name || `Ad Account ${adAccounts.indexOf(acc) + 1}`
      }))

      // Calculate total deposit amount
      const totalDeposit = adAccounts.reduce((sum, acc) => sum + parseInt(acc.deposit || '0'), 0)

      const applicationData = {
        platform: 'FACEBOOK',
        licenseType: licenseType === 'new' ? 'NEW' as const : 'OLD' as const,
        licenseNo: licenseType === 'new' ? newLicenseName : selectedLicense,
        pageUrls: pageUrls.filter(url => url.trim()).join(','),
        isApp: isApp === 'yes' ? appId : undefined,
        shopifyShop: false,
        accountDetails,
        depositAmount: totalDeposit,
        remarks: message || undefined,
        useCoupon: useCoupon,
      }

      const response = await applicationsApi.create(applicationData)

      setSubmitSuccess(true)
      // Refresh stats immediately to update pending count
      refreshStats()

      // Reset form
      setLicenseType('new')
      setNewLicenseName('')
      setSelectedLicense('')
      setPageCount('1')
      setPageUrls([''])
      setPageShareConfirmed(false)
      setUnlimitedDomain('no')
      setDomainCount('1')
      setDomainUrls([''])
      setIsApp('no')
      setAppId('')
      setAdAccountCount('1')
      setAdAccounts([{ name: '', timezone: '', deposit: '50' }])
      setMessage('')
      setUseCoupon(false)

      // Refresh user data
      const [userRes, applicationsRes] = await Promise.all([
        authApi.me(),
        applicationsApi.getAll('FACEBOOK')
      ])
      setUser(userRes.user)
      // Also update auth store so Header balance updates
      updateUser(userRes.user)
      setUserApplications(applicationsRes.applications || [])

      // Show floating toast success
      setApplicationToastSuccess(true)
      setTimeout(() => {
        setApplicationToastSuccess(false)
        setActiveSubPage('account-applied-records')
      }, 2500)

    } catch (error: any) {
      console.error('Failed to submit application:', error)
      setSubmitError(error.message || 'Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if platform is enabled and if user has existing accounts
  // platformStatus: 'active' = can apply, 'stop' = visible but can't apply, 'hidden' = not shown
  const platformEnabled = platformStatus === 'active'
  const platformStopped = platformStatus === 'stop'
  const hasExistingAccounts = userAccounts.length > 0

  // Generate ad account options for searchable dropdown from userAccounts
  // Note: value should be the database ID (acc.id) for API calls, but display the accountId
  // Only show APPROVED accounts for deposits/transfers/refunds
  const adAccountOptions = useMemo(() => {
    return userAccounts
      .filter(acc => acc.status === 'APPROVED')
      .map(acc => ({
        value: acc.id, // Use database ID for API calls
        label: `${acc.accountName || 'Unknown'} (${acc.accountId || acc.id})`
      }))
  }, [userAccounts])

  // Get unique license names from user's approved accounts for "Existing License" dropdown
  // This shows licenses like Yo1, Yo2 that the user created with their previous ad accounts
  const userLicenseOptions = useMemo(() => {
    const licenseSet = new Set<string>()

    // Collect unique license names from approved accounts
    userAccounts.forEach(acc => {
      if (acc.licenseName && acc.licenseName.trim()) {
        licenseSet.add(acc.licenseName.trim())
      }
    })

    // Also check applications for license names (in case account not yet approved but has license)
    userApplications.forEach(app => {
      if (app.licenseNo && app.licenseNo.trim() && app.status === 'APPROVED') {
        licenseSet.add(app.licenseNo.trim())
      }
    })

    // Convert to options format for Select component
    return Array.from(licenseSet).map(license => ({
      value: license,
      label: license
    }))
  }, [userAccounts, userApplications])

  // User wallet balance (from API or fallback to 0)
  const userBalance = user?.walletBalance ? parseFloat(user.walletBalance) : 0

  // Get user's Facebook commission rate from API (fallback to 5% if not set)
  const fbCommissionRate = user?.fbCommission ? parseFloat(user.fbCommission) : 5

  // Calculate deposit totals using user's actual commission rate
  const depositTotals = useMemo(() => {
    const totalCharge = depositRows.reduce((sum, row) => {
      const amount = parseInt(row.amount) || 0
      return sum + amount
    }, 0)
    const markupPercent = fbCommissionRate
    const markupAmount = totalCharge * (markupPercent / 100)
    const totalCost = totalCharge + markupAmount
    return { totalCharge, markupPercent, markupAmount, totalCost }
  }, [depositRows, fbCommissionRate])

  // Add new deposit row
  const addDepositRow = () => {
    const newId = Math.max(...depositRows.map(r => r.id)) + 1
    setDepositRows([...depositRows, { id: newId, accountId: '', amount: '' }])
  }

  // Remove deposit row
  const removeDepositRow = (id: number) => {
    if (depositRows.length > 1) {
      setDepositRows(depositRows.filter(r => r.id !== id))
    }
  }

  // Update deposit row
  const updateDepositRow = (id: number, field: 'accountId' | 'amount', value: string) => {
    setDepositRows(depositRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Check if deposit form is valid
  const isDepositFormValid = depositRows.every(row =>
    row.accountId &&
    row.amount &&
    parseFloat(row.amount) >= ADMIN_SETTINGS.minimumDeposit &&
    parseFloat(row.amount) % 50 === 0
  ) && depositTotals.totalCost <= userBalance

  // Transfer row functions
  const addTransferRow = () => {
    const newId = Math.max(...transferRows.map(r => r.id), 0) + 1
    setTransferRows([...transferRows, { id: newId, fromAccount: '', toAccount: '', amount: '' }])
  }

  const removeTransferRow = (id: number) => {
    if (transferRows.length > 1) {
      setTransferRows(transferRows.filter(r => r.id !== id))
    }
  }

  const updateTransferRow = (id: number, field: 'fromAccount' | 'toAccount' | 'amount', value: string) => {
    setTransferRows(transferRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Calculate transfer totals
  const transferTotals = useMemo(() => {
    const totalAmount = transferRows.reduce((sum, row) => {
      return sum + (row.amount ? parseFloat(row.amount) : 0)
    }, 0)

    return {
      totalAmount,
      totalCost: totalAmount
    }
  }, [transferRows])

  // Check if transfer form is valid
  const isTransferFormValid = transferRows.every(row =>
    row.fromAccount &&
    row.toAccount &&
    row.fromAccount !== row.toAccount &&
    row.amount &&
    parseFloat(row.amount) >= ADMIN_SETTINGS.minimumDeposit &&
    parseFloat(row.amount) % 50 === 0
  )

  // Refund row functions
  const addRefundRow = () => {
    const newId = Math.max(...refundRows.map(r => r.id), 0) + 1
    setRefundRows([...refundRows, { id: newId, accountId: '', amount: '' }])
  }

  const removeRefundRow = (id: number) => {
    if (refundRows.length > 1) {
      setRefundRows(refundRows.filter(r => r.id !== id))
    }
  }

  const updateRefundRow = (id: number, field: 'accountId' | 'amount', value: string) => {
    setRefundRows(refundRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Calculate refund totals
  const refundTotals = useMemo(() => {
    const totalAmount = refundRows.reduce((sum, row) => {
      return sum + (row.amount ? parseFloat(row.amount) : 0)
    }, 0)

    return {
      totalAmount,
      totalCost: totalAmount
    }
  }, [refundRows])

  // Check if refund form is valid
  const isRefundFormValid = refundRows.every(row =>
    row.accountId &&
    row.amount &&
    parseFloat(row.amount) >= ADMIN_SETTINGS.minimumDeposit &&
    parseFloat(row.amount) % 50 === 0
  )

  // Handle refund submit
  const handleRefundSubmit = () => {
    if (isRefundFormValid) {
      setShowRefundReasonModal(true)
    }
  }

  // Handle refund reason submit
  const handleRefundReasonSubmit = async () => {
    if (refundReason.trim() && !isSubmitting) {
      setIsSubmitting(true)
      try {
        // Submit each refund request
        for (const row of refundRows) {
          if (row.accountId && row.amount) {
            await accountRefundsApi.create(row.accountId, {
              amount: parseFloat(row.amount),
              reason: refundReason
            })
          }
        }
        setShowRefundReasonModal(false)
        setRefundReason('')
        setRefundRows([{ id: 1, accountId: '', amount: '' }])
        // Show success toast
        setRefundToastSuccess(true)
        setTimeout(() => setRefundToastSuccess(false), 3000)
        // Refresh data and stats immediately
        const refundsRes = await accountRefundsApi.getAll('FACEBOOK').catch(() => ({ refunds: [] }))
        setUserRefunds(refundsRes.refunds || [])
        refreshStats()
      } catch (error: any) {
        alert(error.message || 'Failed to submit refund request')
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  // Handle transfer balance submit
  const handleTransferSubmit = async () => {
    if (!isTransferFormValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      // Submit each transfer request
      for (const row of transferRows) {
        if (row.fromAccount && row.toAccount && row.amount) {
          await balanceTransfersApi.create({
            fromAccountId: row.fromAccount,
            toAccountId: row.toAccount,
            amount: parseFloat(row.amount)
          })
        }
      }
      // Reset form
      setTransferRows([{ id: 1, fromAccount: '', toAccount: '', amount: '' }])
      // Show success toast
      setTransferToastSuccess(true)
      setTimeout(() => setTransferToastSuccess(false), 3000)
      // Refresh stats immediately
      refreshStats()
    } catch (error: any) {
      alert(error.message || 'Failed to submit transfer request')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle View Details click
  const handleViewDetails = (record: AppliedRecord) => {
    setSelectedApplication(record)
    setShowViewDetailsModal(true)
  }

  // Handle BM Share click from Account List
  const handleBmShareClick = (account: any) => {
    setSelectedAccountForBmShare({
      id: account.id,
      license: account.license || account.licenseName || 'N/A',
      adsAccountId: account.accountId || account.adsAccountId,
      adsAccountName: account.accountName || account.adsAccountName || 'Unknown Account'
    })
    setBmShareForm({ bmId: '', message: '' })
    setBmShareSuccess(false)
    setBmShareError(null)
    setShowBmShareModal(true)
  }

  // Handle BM Share Submit
  const handleBmShareSubmit = async () => {
    if (!bmShareForm.bmId.trim() || !selectedAccountForBmShare) return

    setBmShareSubmitting(true)
    setBmShareError(null)

    try {
      await bmShareApi.create({
        platform: 'FACEBOOK',
        adAccountId: selectedAccountForBmShare.adsAccountId,
        adAccountName: selectedAccountForBmShare.adsAccountName,
        bmId: bmShareForm.bmId.trim(),
        message: bmShareForm.message.trim() || undefined
      })

      // Refresh BM share history
      const bmShareRes = await bmShareApi.getAll('FACEBOOK')
      setBmShareHistory(bmShareRes.bmShareRequests || [])

      // Close modal and show floating toast
      setShowBmShareModal(false)
      setBmShareForm({ bmId: '', message: '' })
      setBmShareSuccess(true)
      // Refresh stats immediately to update pending shares count
      refreshStats()

      // Hide toast after 2.5 seconds
      setTimeout(() => {
        setBmShareSuccess(false)
      }, 2500)

    } catch (error: any) {
      console.error('Failed to submit BM share request:', error)
      setBmShareError(error.message || 'Failed to submit request. Please try again.')
    } finally {
      setBmShareSubmitting(false)
    }
  }

  // Handle Deposit Submit
  const handleDepositSubmit = async () => {
    if (!isDepositFormValid) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Submit each deposit row
      for (const row of depositRows) {
        await accountDepositsApi.create(row.accountId, {
          amount: parseFloat(row.amount),
          remarks: `Deposit of $${row.amount}`
        })
      }

      // Reset form
      setDepositRows([{ id: 1, accountId: '', amount: '' }])

      // Refresh user data to update balance and deposits list
      const [userRes, depositsRes] = await Promise.all([
        authApi.me(),
        accountDepositsApi.getAll('FACEBOOK')
      ])
      setUser(userRes.user)
      // Also update auth store so Header balance updates
      updateUser(userRes.user)
      setAccountDeposits(depositsRes.deposits || [])
      // Refresh stats immediately to update pending deposits count
      refreshStats()

      // Show floating toast success
      setDepositToastSuccess(true)
      setTimeout(() => {
        setDepositToastSuccess(false)
        setActiveSubPage('deposit-report')
      }, 2500)

    } catch (error: any) {
      console.error('Failed to submit deposit:', error)
      setSubmitError(error.message || 'Failed to submit deposit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get current data based on active page
  const getCurrentData = () => {
    let data: any[] = []
    if (activeSubPage === 'account-list') {
      // Use userAccounts from API
      data = userAccounts
    } else if (activeSubPage === 'account-applied-records') {
      // Use userApplications from API
      data = userApplications
    } else if (activeSubPage === 'deposit-report') {
      // Use accountDeposits from API
      data = accountDeposits
    } else if (activeSubPage === 'refund-report') {
      // Use userRefunds from API
      data = userRefunds
    }
    return data
  }

  // Calculate pagination
  const currentData = getCurrentData()
  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedData = currentData.slice(startIndex, endIndex)

  // Generate page numbers for pagination
  const generatePageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, '...', totalPages]
    }

    if (currentPage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }

  const pageNumbers = generatePageNumbers()

  // Handle Deposit click - redirect to Deposit section with optional pre-selected account
  const handleDepositClick = (accountId?: string) => {
    if (accountId) {
      // Pre-select the account in deposit form
      setDepositRows([{ id: 1, accountId: accountId, amount: '' }])
    }
    setActiveSubPage('deposit')
  }

  // Get user's coupon balance
  const userCouponBalance = user?.couponBalance || 0

  // Calculate costs using user's actual commission rate
  const costs = useMemo(() => {
    const pageNum = parseInt(pageCount)
    const extraPages = Math.max(0, pageNum - 5)
    const extraPagesCost = extraPages * ADMIN_SETTINGS.extraPageFee
    // Use user's configured unlimited domain fee, fallback to admin settings if not set
    const userUnlimitedDomainFee = user?.fbUnlimitedDomainFee !== undefined ? Number(user.fbUnlimitedDomainFee) : ADMIN_SETTINGS.unlimitedDomainFee
    const domainCost = unlimitedDomain === 'yes' ? userUnlimitedDomainFee : 0
    const totalDeposits = adAccounts.reduce((sum, acc) => sum + parseInt(acc.deposit || '0'), 0)
    const depositMarkupAmount = totalDeposits * fbCommissionRate / 100
    const depositWithMarkup = totalDeposits + depositMarkupAmount
    // Opening fee is per ad account (multiply by quantity)
    const adAccountQty = adAccounts.length
    // Use platform-specific opening fee (fbFee for Facebook)
    const openingFeePerAccount = user?.fbFee ? parseFloat(user.fbFee) : ADMIN_SETTINGS.openingFee
    const openingFee = openingFeePerAccount * adAccountQty
    const totalCostRegular = openingFee + domainCost + extraPagesCost + depositWithMarkup

    // If using coupon, only opening fee is waived - deposit with markup still charged
    const totalCost = useCoupon ? depositWithMarkup : totalCostRegular
    const savings = useCoupon ? openingFee + domainCost + extraPagesCost : 0

    return {
      totalDeposits,
      depositMarkupAmount,
      depositWithMarkup,
      totalCost,
      totalCostRegular,
      savings,
      openingFee,
      domainCost,
      extraPagesCost,
      commissionRate: fbCommissionRate
    }
  }, [pageCount, unlimitedDomain, adAccounts, fbCommissionRate, user, useCoupon])

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

  // Handle page count change
  const handlePageCountChange = (count: string) => {
    setPageCount(count)
    const num = parseInt(count)
    const newUrls = Array(num).fill('').map((_, i) => pageUrls[i] || '')
    setPageUrls(newUrls)
  }

  // Handle domain count change
  const handleDomainCountChange = (count: string) => {
    setDomainCount(count)
    const num = parseInt(count)
    const newUrls = Array(num).fill('').map((_, i) => domainUrls[i] || '')
    setDomainUrls(newUrls)
  }

  // Handle ad account count change
  const handleAdAccountCountChange = (count: string) => {
    setAdAccountCount(count)
    const num = parseInt(count)
    const newAccounts = Array(num).fill(null).map((_, i) =>
      adAccounts[i] || { name: '', timezone: '', deposit: '50' }
    )
    setAdAccounts(newAccounts)
  }

  // Update page URL
  const updatePageUrl = (index: number, value: string) => {
    const newUrls = [...pageUrls]
    newUrls[index] = value
    setPageUrls(newUrls)
  }

  // Update domain URL
  const updateDomainUrl = (index: number, value: string) => {
    const newUrls = [...domainUrls]
    newUrls[index] = value
    setDomainUrls(newUrls)
  }

  // Update ad account
  const updateAdAccount = (index: number, field: keyof AdAccountEntry, value: string) => {
    const newAccounts = [...adAccounts]
    newAccounts[index] = { ...newAccounts[index], [field]: value }
    setAdAccounts(newAccounts)
  }

  const menuItems = [
    {
      section: 'account-manage' as MenuSection,
      title: 'Account Manage',
      icon: <AccountManageIcon />,
      tutorialId: 'account-manage-section',
      items: [
        { id: 'apply-ads-account' as SubPage, label: 'Apply Ads Account', tutorialId: 'apply-account-btn' },
        { id: 'account-list' as SubPage, label: 'Account List', tutorialId: 'account-list-btn' },
        { id: 'account-applied-records' as SubPage, label: 'Account Applied Records' },
        { id: 'bm-share-log' as SubPage, label: 'BM Share Log' },
      ]
    },
    {
      section: 'deposit-manage' as MenuSection,
      title: 'Deposit Manage',
      icon: <DepositManageIcon />,
      tutorialId: 'deposit-manage-section',
      items: [
        { id: 'deposit' as SubPage, label: 'Deposit', tutorialId: 'deposit-menu-btn' },
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
    <DashboardLayout title="Facebook User Management Account" subtitle="">
      {/* Confetti celebration for new approvals */}
      <Confetti active={showConfetti} />
      {/* Show Coming Soon if platform disabled and no existing accounts */}
      {!platformEnabled && !hasExistingAccounts ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#52B788]/10 flex items-center justify-center text-[#8B5CF6]">
              <ComingSoonIcon />
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</p>
            <p className="text-base text-gray-600 mb-4">Facebook Ads platform is currently unavailable</p>
            <p className="text-sm text-gray-400">Please check back later or contact support for more information</p>
          </div>
        </div>
      ) : (
      <div className="flex flex-col h-full">
      {/* Global styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes toastPop {
          0% { opacity: 0; transform: scale(0.5); }
          50% { transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.25s ease-out forwards; }
        .animate-checkBounce { animation: checkBounce 0.4s ease-out 0.1s forwards; }
        .animate-toastPop { animation: toastPop 0.35s ease-out forwards; }
        .animate-slideIn { animation: slideIn 0.25s ease-out forwards; }
        .table-row-animate { animation: fadeInUp 0.25s ease-out forwards; }
        .table-row-animate:nth-child(1) { animation-delay: 0.03s; }
        .table-row-animate:nth-child(2) { animation-delay: 0.06s; }
        .table-row-animate:nth-child(3) { animation-delay: 0.09s; }
        .table-row-animate:nth-child(4) { animation-delay: 0.12s; }
        .table-row-animate:nth-child(5) { animation-delay: 0.15s; }
        .table-row-animate:nth-child(6) { animation-delay: 0.18s; }
        .table-row-animate:nth-child(7) { animation-delay: 0.21s; }
        .table-row-animate:nth-child(8) { animation-delay: 0.24s; }
        .stat-card { transition: all 0.2s ease; }
        .stat-card:hover { transform: translateY(-1px); box-shadow: 0 4px 15px -3px rgba(139, 92, 246, 0.12); }
        /* Smooth scrolling */
        .scroll-smooth { scroll-behavior: smooth; }
        /* Custom scrollbar */
        .scroll-smooth::-webkit-scrollbar { width: 4px; }
        .scroll-smooth::-webkit-scrollbar-track { background: transparent; }
        .scroll-smooth::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .scroll-smooth::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
      `}</style>

      {/* Row 1: Header Bar - Responsive */}
      <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 mb-2 lg:mb-3 p-1.5 lg:p-2 bg-white rounded-lg lg:rounded-xl shadow-sm border border-gray-100/50">
        <div className="relative w-32 lg:w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 lg:w-3.5 h-3 lg:h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 lg:pl-8 pr-2 lg:pr-3 py-1 lg:py-1.5 bg-gray-50 border border-gray-200 rounded-md text-[10px] lg:text-xs focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
          />
        </div>

        <div className="w-28 lg:w-36 hidden sm:block">
          <Select
            options={dateFilterOptions}
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Date"
            size="sm"

          />
        </div>
        <div className="w-24 lg:w-28 hidden sm:block">
          <Select
            options={actionFilterOptions}
            value={actionFilter}
            onChange={setActionFilter}
            placeholder="Action"
            size="sm"

          />
        </div>

        <div className="flex-1" />

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 whitespace-nowrap text-[10px] lg:text-xs px-2 lg:px-3 py-1 lg:py-1.5 h-auto"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
          >
            <Download className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-1" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className={`w-3 lg:w-3.5 h-3 lg:h-3.5 ml-1 transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
          </Button>

          {showExportDropdown && (
            <div className="absolute right-0 mt-2 w-48 lg:w-56 bg-white border border-gray-200 rounded-lg lg:rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="py-1">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      exportToExcel(option.id)
                      setShowExportDropdown(false)
                    }}
                    className="w-full px-3 lg:px-4 py-2 text-xs lg:text-sm text-left text-gray-700 hover:bg-[#52B788]/10 hover:text-[#52B788] transition-colors duration-150 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={() => setActiveSubPage('apply-ads-account')}
          className="bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-md shadow-sm whitespace-nowrap text-[10px] lg:text-xs px-2 lg:px-3 py-1 lg:py-1.5 h-auto"
        >
          <Plus className="w-3 lg:w-3.5 h-3 lg:h-3.5 mr-0.5 lg:mr-1" />
          <span className="hidden sm:inline">Ads Account</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Row 2: Stats Cards - Matching reference design with animations */}
      <style jsx>{`
        @keyframes chartPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .chart-animate {
          transition: d 0.6s ease-in-out;
        }
        .chart-glow {
          animation: chartPulse 2s ease-in-out infinite;
        }
      `}</style>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 lg:gap-3 mb-2 lg:mb-3">
        {statsData.map((stat, index) => (
          <Card key={index} className="stat-card p-2 lg:p-3 border border-gray-100 bg-white rounded-lg lg:rounded-xl relative overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
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
                    <linearGradient id={`stat-gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {/* Area fill with transition */}
                  <path
                    d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`}
                    fill={`url(#stat-gradient-${index})`}
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
            <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/5 via-transparent to-[#52B788]/5" />

            {/* Facebook Logo - Larger and balanced */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#1877F2] to-[#0C5DC7] flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
                    <path d="M9.198 21.5h4v-8.01h3.604l.396-3.98h-4V7.5a1 1 0 0 1 1-1h3v-4h-3a5 5 0 0 0-5 5v2.01h-2l-.396 3.98h2.396v8.01Z" />
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
                    data-tutorial={(menu as any).tutorialId}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#8B5CF6]/5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-all duration-300 ${
                        expandedSections.includes(menu.section)
                          ? 'rotate-180 text-[#8B5CF6]'
                          : 'rotate-0 text-gray-400'
                      }`}
                    />
                  </button>

                  <div
                    className={`ml-5 space-y-1 border-l-2 border-[#8B5CF6]/20 pl-4 overflow-hidden transition-all duration-300 ease-in-out ${
                      expandedSections.includes(menu.section)
                        ? 'max-h-96 opacity-100 mt-1'
                        : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    {menu.items.map((item, index) => (
                      <button
                        key={item.id}
                        data-tutorial={(item as any).tutorialId}
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
                            ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white font-medium shadow-md shadow-purple-200'
                            : 'text-gray-600 hover:bg-[#8B5CF6]/5 hover:text-[#8B5CF6]'
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
                  ) : !platformEnabled && !hasExistingAccounts ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#52B788]/10 flex items-center justify-center text-[#8B5CF6]">
                        <ComingSoonIcon />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                      <p className="text-sm text-gray-500 mt-2">Facebook Ads platform is currently unavailable</p>
                    </div>
                  ) : !platformEnabled && hasExistingAccounts ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#52B788]/10 flex items-center justify-center text-[#8B5CF6]">
                        <ComingSoonIcon />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                      <p className="text-sm text-gray-500 mt-2">New account applications are currently disabled</p>
                      <p className="text-xs text-gray-400 mt-3">You can still manage your existing accounts through the menu</p>
                    </div>
                  ) : (
                    <div className="px-4 lg:px-6 py-4 lg:py-5 space-y-4">

                      {/* License */}
                      <div className="space-y-2" data-tutorial="license-section">
                    <label className="block text-xs lg:text-sm font-semibold text-gray-800">License</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setLicenseType('new')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-medium transition-all ${
                          licenseType === 'new'
                            ? 'bg-[#8B5CF6] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        New License
                      </button>
                      <button
                        onClick={() => setLicenseType('existing')}
                        className={`px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-medium transition-all ${
                          licenseType === 'existing'
                            ? 'bg-[#8B5CF6] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Existing
                      </button>
                    </div>

                    {licenseType === 'new' && (
                      <input
                        type="text"
                        placeholder="Enter license name"
                        value={newLicenseName}
                        onChange={(e) => setNewLicenseName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                      />
                    )}

                    {licenseType === 'existing' && (
                      userLicenseOptions.length > 0 ? (
                        <Select
                          options={userLicenseOptions}
                          value={selectedLicense}
                          onChange={setSelectedLicense}
                          placeholder="Select license"
                          size="sm"
                        />
                      ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <p className="text-xs text-gray-500">No existing licenses</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Create a new license first</p>
                        </div>
                      )
                    )}
                  </div>

                  {/* Pages */}
                  <div className="space-y-2" data-tutorial="pages-section">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs lg:text-sm font-semibold text-gray-800">
                        Pages
                        <span className="text-[9px] lg:text-[10px] font-normal text-gray-500 ml-1">(1-5 free, +$5/extra)</span>
                      </label>
                    </div>
                    <Select
                      options={pageCountOptions}
                      value={pageCount}
                      onChange={handlePageCountChange}
                      placeholder="Select pages"
                      size="sm"
                    />
                    <div className="space-y-1.5">
                      {pageUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <input
                            type="text"
                            placeholder={`Page ${index + 1} URL`}
                            value={url}
                            onChange={(e) => updatePageUrl(index, e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all pr-8"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">#{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Share Profile */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2" data-tutorial="share-profile-checkbox">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          id="shareProfile"
                          checked={pageShareConfirmed}
                          onChange={(e) => setPageShareConfirmed(e.target.checked)}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor="shareProfile"
                          className={`flex items-center justify-center w-4 h-4 rounded border-2 cursor-pointer transition-all duration-200 ease-out
                            ${pageShareConfirmed
                              ? 'bg-[#8B5CF6] border-[#8B5CF6] scale-110'
                              : 'bg-white border-gray-300 hover:border-[#8B5CF6]/50 active:scale-95'
                            }`}
                        >
                          <svg
                            className={`w-2.5 h-2.5 text-white transition-all duration-200 ${pageShareConfirmed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </label>
                      </div>
                      <label htmlFor="shareProfile" className="text-[10px] lg:text-xs text-gray-600 cursor-pointer select-none">
                        Confirm you shared your page with this profile
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-gradient-to-r from-[#8B5CF6]/5 to-[#52B788]/5 border border-[#8B5CF6]/20 rounded-lg">
                      <span className="text-[10px] lg:text-xs text-gray-700 font-medium truncate flex-1">
                        {profileShareLink}
                      </span>
                      <button
                        onClick={() => copyToClipboard(profileShareLink, 999)}
                        className="p-1 hover:bg-white/80 rounded transition-colors ml-1.5 flex-shrink-0"
                      >
                        {copiedId === 999 ? <Check className="w-3.5 h-3.5 text-[#52B788]" /> : <Copy className="w-3.5 h-3.5 text-[#8B5CF6]" />}
                      </button>
                    </div>
                  </div>

                  {/* Domain */}
                  <div className="space-y-2">
                    <label className="block text-xs lg:text-sm font-semibold text-gray-800">Unlimited Domain?</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setUnlimitedDomain('yes')}
                        className={`px-3 py-1.5 rounded-full text-[10px] lg:text-xs font-medium transition-all ${
                          unlimitedDomain === 'yes'
                            ? 'bg-[#8B5CF6] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setUnlimitedDomain('no')}
                        className={`px-3 py-1.5 rounded-full text-[10px] lg:text-xs font-medium transition-all ${
                          unlimitedDomain === 'no'
                            ? 'bg-[#52B788] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        No
                      </button>
                    </div>

                    {unlimitedDomain === 'no' && (
                      <>
                        <Select
                          options={domainCountOptions}
                          value={domainCount}
                          onChange={handleDomainCountChange}
                          placeholder="Select domains"
                          size="sm"
                        />
                        <div className="space-y-1.5">
                          {domainUrls.map((url, index) => (
                            <input
                              key={index}
                              type="text"
                              placeholder={`Domain ${index + 1} (e.g., example.com)`}
                              value={url}
                              onChange={(e) => updateDomainUrl(index, e.target.value)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Is App */}
                  <div className="space-y-2">
                    <label className="block text-xs lg:text-sm font-semibold text-gray-800">Is App?</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setIsApp('yes')}
                        className={`px-3 py-1.5 rounded-full text-[10px] lg:text-xs font-medium transition-all ${
                          isApp === 'yes'
                            ? 'bg-[#8B5CF6] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setIsApp('no')}
                        className={`px-3 py-1.5 rounded-full text-[10px] lg:text-xs font-medium transition-all ${
                          isApp === 'no'
                            ? 'bg-[#52B788] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        No
                      </button>
                    </div>
                    {isApp === 'yes' && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          placeholder="Enter App ID"
                          value={appId}
                          onChange={(e) => setAppId(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                        />
                        <p className="text-[9px] lg:text-[10px] text-green-600">App ID is free - no additional charge</p>
                      </div>
                    )}
                  </div>

                  {/* Ad Accounts */}
                  <div className="space-y-2" data-tutorial="ad-accounts-section">
                    <label className="block text-xs lg:text-sm font-semibold text-gray-800">
                      Ad Accounts
                      <span className="text-[9px] lg:text-[10px] font-normal text-gray-500 ml-1">(1-5, same fee)</span>
                    </label>
                    <Select
                      options={adAccountCountOptions}
                      value={adAccountCount}
                      onChange={handleAdAccountCountChange}
                      placeholder="Select"
                      size="sm"
                    />

                    <div className="space-y-2">
                      {adAccounts.map((account, index) => (
                        <div key={index} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2 overflow-visible" style={{ position: 'relative', zIndex: adAccounts.length - index }}>
                          <span className="text-[10px] lg:text-xs font-semibold text-[#8B5CF6]">Account {index + 1}</span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Account Name"
                              value={account.name}
                              onChange={(e) => updateAdAccount(index, 'name', e.target.value)}
                              className="px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                            />
                            <SearchableSelect
                              options={timezoneOptions}
                              value={account.timezone}
                              onChange={(value) => updateAdAccount(index, 'timezone', value)}
                              placeholder="Timezone"
                              searchPlaceholder="Search timezone"
                            />
                            <Select
                              options={depositOptions}
                              value={account.deposit}
                              onChange={(value) => updateAdAccount(index, 'deposit', value)}
                              placeholder="Deposit"
                              size="sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-1">
                    <label className="block text-xs lg:text-sm font-semibold text-gray-800">Message</label>
                    <textarea
                      placeholder="Remarks for admin (optional)"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white resize-none transition-all"
                    />
                  </div>

                  {/* Cost Summary - Compact */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Cost Items - Inline */}
                    <div className="px-3 py-2 bg-gray-50 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] lg:text-xs">
                      <span className="text-gray-500">Fee: <span className={useCoupon ? 'line-through text-gray-400' : 'font-medium text-gray-700'}>${costs.openingFee.toFixed(2)}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">Deposit: <span className="font-medium text-gray-700">${costs.totalDeposits}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">{costs.commissionRate}%: <span className="font-medium text-[#F59E0B]">+${costs.depositMarkupAmount.toFixed(2)}</span></span>
                      {costs.domainCost > 0 && <><span className="text-gray-300">|</span><span className="text-gray-500">Domain: <span className={useCoupon ? 'line-through text-gray-400' : 'font-medium text-gray-700'}>${costs.domainCost}</span></span></>}
                      {costs.extraPagesCost > 0 && <><span className="text-gray-300">|</span><span className="text-gray-500">Pages: <span className={useCoupon ? 'line-through text-gray-400' : 'font-medium text-gray-700'}>${costs.extraPagesCost}</span></span></>}
                      {useCoupon && costs.savings > 0 && <><span className="text-gray-300">|</span><span className="text-[#22C55E]">-${costs.savings.toFixed(2)}</span></>}
                    </div>
                    {/* Total Row */}
                    <div className="px-3 py-2 bg-white flex items-center justify-between border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] lg:text-xs text-gray-500">Total:</span>
                          <span className="text-sm lg:text-base font-bold text-[#52B788]">${costs.totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] lg:text-xs text-gray-500">Bal:</span>
                          <span className="text-sm lg:text-base font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                        </div>
                      </div>
                      {userBalance < costs.totalCost && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#EF4444]/10 text-[#EF4444]">
                          Insufficient
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Coupon Section */}
                  {userCouponBalance > 0 && (
                    <div className="p-2.5 bg-gradient-to-br from-[#F59E0B]/5 to-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#F59E0B]/20 rounded-lg flex items-center justify-center">
                            <span className="text-sm">🎟️</span>
                          </div>
                          <div>
                            <p className="text-[10px] lg:text-xs font-semibold text-gray-800">Coupons</p>
                            <p className="text-[9px] lg:text-[10px] text-gray-500"><span className="font-bold text-[#F59E0B]">{userCouponBalance}</span> available</p>
                          </div>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10px] lg:text-xs text-gray-600">{useCoupon ? 'On' : 'Use'}</span>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={useCoupon}
                              onChange={(e) => setUseCoupon(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F59E0B]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#F59E0B]"></div>
                          </div>
                        </label>
                      </div>
                      {useCoupon && (
                        <p className="text-[9px] text-[#F59E0B] mt-1.5">
                          ✓ Save ${costs.savings.toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Error Message */}
                  {submitError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-[10px] lg:text-xs text-red-700 font-medium text-center">
                        {submitError}
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    data-tutorial="submit-application"
                    className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-lg py-2.5 text-xs lg:text-sm font-semibold shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!pageShareConfirmed || userBalance < costs.totalCost || isSubmitting || submitSuccess}
                    onClick={handleSubmitApplication}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </span>
                    ) : userBalance < costs.totalCost ? (
                      'Insufficient Balance'
                    ) : useCoupon ? (
                      `Pay $${costs.totalCost.toFixed(2)}`
                    ) : (
                      `Pay $${costs.totalCost.toFixed(2)} & Submit`
                    )}
                  </Button>

                    </div>
                  )}
                </>
              )}

              {/* Account List Table */}
              {activeSubPage === 'account-list' && (
                <div className="p-3 lg:p-5">
                  {isLoading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6] mx-auto mb-3" />
                      <p className="text-xs text-gray-500">Loading your accounts...</p>
                    </div>
                  ) : (
                  <>
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm lg:text-base font-semibold text-gray-800">Your Ad Accounts</h3>
                      <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">Manage your advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] lg:text-xs text-gray-500 hidden sm:inline">Total:</span>
                      <span className="px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full text-[10px] lg:text-xs font-semibold">{currentData.length}</span>
                    </div>
                  </div>

                  {/* Account Cards Grid */}
                  <div className="grid gap-2 lg:gap-3">
                    {paginatedData.length === 0 ? (
                      <div className="text-center py-8 lg:py-12 bg-gray-50 rounded-lg lg:rounded-xl border border-dashed border-gray-200">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-[#8B5CF6]" />
                        </div>
                        <h4 className="text-sm lg:text-base font-semibold text-gray-800 mb-1.5">No Ad Accounts Yet</h4>
                        <p className="text-[10px] lg:text-xs text-gray-500 mb-3 max-w-xs mx-auto px-4">
                          Apply for a new ad account or check your application status.
                        </p>
                        <div className="flex items-center justify-center gap-2 flex-wrap px-4">
                          <button
                            onClick={() => setActiveSubPage('apply-ads-account')}
                            className="px-3 py-1.5 bg-[#8B5CF6] text-white rounded-lg text-[10px] lg:text-xs font-medium hover:bg-[#7C3AED] transition-colors"
                          >
                            Apply Now
                          </button>
                          <button
                            onClick={() => setActiveSubPage('account-applied-records')}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-[10px] lg:text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            View Apps
                          </button>
                        </div>
                      </div>
                    ) : paginatedData.map((item: any, index: number) => {
                      const cheetahData = cheetahBalances[item.accountId]
                      const isCheetahAccount = cheetahData?.isCheetah
                      const remainingBalance = cheetahData?.remainingBalance

                      return (
                      <div
                        key={item.id}
                        className="table-row-animate p-3 lg:p-4 bg-white border border-gray-100 rounded-xl hover:border-[#8B5CF6]/30 hover:shadow-md hover:shadow-[#8B5CF6]/5 transition-all duration-300 group"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="grid grid-cols-3 items-center gap-4">
                          {/* Left Side - Account Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Account Avatar */}
                            <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 flex items-center justify-center group-hover:from-[#8B5CF6]/20 group-hover:to-[#8B5CF6]/10 transition-all flex-shrink-0">
                              <span className="text-base lg:text-lg font-bold text-[#8B5CF6]">{(item.accountName || item.adsAccountName || 'A').charAt(0).toUpperCase()}</span>
                            </div>

                            {/* Account Details */}
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-gray-800 truncate">{item.accountName || item.adsAccountName || 'Unknown'}</h4>
                                {isCheetahAccount && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#52B788]/10 text-[#52B788]">
                                    ${remainingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400">License:</span>
                                <span className="text-gray-600 font-medium truncate">{item.licenseName || item.license || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Center - Account ID */}
                          <div className="flex justify-center">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
                              <span className="text-xs text-gray-400">ID:</span>
                              <span className="text-xs text-[#8B5CF6] font-mono font-medium">{item.accountId || item.adsAccountId}</span>
                            </div>
                          </div>

                          {/* Right Side - Actions */}
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleBmShareClick(item)}
                              data-tutorial="get-bm-access-btn"
                              className="px-3.5 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg text-xs font-medium hover:bg-[#8B5CF6] hover:text-white transition-all duration-200"
                            >
                              Access
                            </button>
                            <button
                              onClick={() => handleDepositClick(item.id)}
                              data-tutorial="account-deposit-btn"
                              className="px-3.5 py-1.5 bg-[#52B788]/10 text-[#52B788] rounded-lg text-xs font-medium hover:bg-[#52B788] hover:text-white transition-all duration-200"
                            >
                              Deposit
                            </button>
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                  </>
                  )}
                </div>
              )}

              {/* Account Applied Records Table */}
              {activeSubPage === 'account-applied-records' && (
                <>
                  {isLoading ? (
                    <div className="p-16 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6] mx-auto mb-4" />
                      <p className="text-sm text-gray-500">Loading applications...</p>
                    </div>
                  ) : paginatedData.length === 0 ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#52B788]/10 flex items-center justify-center text-[#8B5CF6]">
                        <EmptyStateIcon />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">No Applications Yet</p>
                      <p className="text-sm text-gray-500 mt-2">Submit your first ad account application to get started</p>
                      <Button
                        onClick={() => setActiveSubPage('apply-ads-account')}
                        className="mt-4 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white"
                      >
                        Apply for Ad Account
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#8B5CF6]/5 to-gray-50">
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">License</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">Time</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Accounts</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedData.map((item: any) => {
                          const createdDate = new Date(item.createdAt)
                          const dateStr = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')
                          const timeStr = createdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          return (
                            <tr key={item.id} className="table-row-animate hover:bg-[#8B5CF6]/5 transition-all duration-300" style={{ opacity: 0 }}>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700 font-mono">{item.applyId}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 hidden sm:table-cell">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] lg:text-[10px] font-semibold ${
                                    item.licenseType === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {item.licenseType}
                                  </span>
                                  <span className="text-[10px] lg:text-xs text-gray-700 truncate max-w-[80px]">{item.licenseNo || '-'}</span>
                                </div>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">
                                <span className="text-[10px] lg:text-xs">
                                  <span className="text-gray-700 hidden lg:inline">{dateStr}/</span>
                                  <span className="text-[#8B5CF6] font-medium">{timeStr}</span>
                                </span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700 font-medium">${parseFloat(item.totalCost).toFixed(2)}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 hidden md:table-cell">
                                <span className="px-1.5 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded text-[9px] lg:text-xs font-semibold">
                                  {item.adAccountQty}
                                </span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">{getStatusBadge(item.status)}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">
                                <button
                                  onClick={() => {
                                    // Parse accountDetails if it's a string
                                    let parsedAccounts: any[] = []
                                    try {
                                      if (typeof item.accountDetails === 'string') {
                                        parsedAccounts = JSON.parse(item.accountDetails)
                                      } else if (Array.isArray(item.accountDetails)) {
                                        parsedAccounts = item.accountDetails
                                      }
                                    } catch (e) {
                                      parsedAccounts = []
                                    }

                                    // Parse pageUrls
                                    let pageUrlsList: string[] = []
                                    if (item.pageUrls) {
                                      if (typeof item.pageUrls === 'string') {
                                        pageUrlsList = item.pageUrls.split(',').map((url: string) => url.trim()).filter(Boolean)
                                      } else if (Array.isArray(item.pageUrls)) {
                                        pageUrlsList = item.pageUrls
                                      }
                                    }

                                    handleViewDetails({
                                      id: item.id,
                                      applyId: item.applyId,
                                      license: item.licenseNo || 'N/A',
                                      requestTime: `${dateStr}/${timeStr}`,
                                      totalCost: parseFloat(item.totalCost),
                                      status: item.status,
                                      details: {
                                        licenseType: item.licenseType?.toLowerCase() as 'new' | 'existing',
                                        pages: pageUrlsList.length || item.adAccountQty || 0,
                                        pageUrls: pageUrlsList,
                                        unlimitedDomain: false,
                                        domains: 1,
                                        domainUrls: [],
                                        isApp: !!item.isApp,
                                        appId: item.isApp || '',
                                        adAccounts: parsedAccounts.map((acc: any, idx: number) => ({
                                          name: acc.name || `Account ${idx + 1}`,
                                          timezone: acc.timezone || 'N/A',
                                          deposit: parseFloat(item.depositAmount) / (item.adAccountQty || 1)
                                        })),
                                        message: item.remarks || ''
                                      }
                                    })
                                  }}
                                  className="px-3 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg text-xs font-medium hover:bg-[#8B5CF6] hover:text-white transition-all duration-200"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* BM Share Log Table */}
              {activeSubPage === 'bm-share-log' && (
                <div className="p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">BM Share History</h3>
                      <p className="text-sm text-gray-500 mt-1">View your Business Manager share requests</p>
                    </div>
                  </div>

                  {bmShareHistory.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
                        <span className="text-2xl">📤</span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">No BM Share Requests</h4>
                      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                        You haven't made any Business Manager share requests yet. Use the "BM Share" button on your accounts to request sharing.
                      </p>
                      <button
                        onClick={() => setActiveSubPage('account-list')}
                        className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg text-sm font-medium hover:bg-[#7C3AED] transition-colors"
                      >
                        View Your Accounts
                      </button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#8B5CF6]/5 to-gray-50">
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Account</th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">BM ID</th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                          <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bmShareHistory.map((item: any, index: number) => (
                          <tr key={item.id} className="table-row-animate hover:bg-[#8B5CF6]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                            <td className="py-4 px-4 text-sm text-gray-700 font-mono">{item.applyId}</td>
                            <td className="py-4 px-4">
                              <div className="space-y-0.5">
                                <p className="text-sm text-gray-700 font-medium">{item.adAccountName}</p>
                                <p className="text-xs text-gray-400 font-mono">{item.adAccountId}</p>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm font-mono text-[#8B5CF6]">{item.bmId}</span>
                            </td>
                            <td className="py-4 px-4 max-w-[280px]">
                              <p className="text-sm text-gray-600 whitespace-normal leading-relaxed">
                                {item.adminRemarks || '-'}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-700">
                                {new Date(item.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </td>
                            <td className="py-4 px-4">{getStatusBadge(item.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Deposit Form */}
              {activeSubPage === 'deposit' && (
                <div className="p-6 space-y-6" data-tutorial="deposit-form-section">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit to Ad Account</h3>
                      <p className="text-sm text-gray-500 mt-1">Add funds to your advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3B82F6]/10 to-[#3B82F6]/5 rounded-xl border border-[#3B82F6]/20">
                        <Wallet className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-sm text-gray-600">Wallet Balance:</span>
                        <span className="text-sm font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit Rows */}
                  <div className="space-y-4" data-tutorial="deposit-rows-section">
                    {depositRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-5 bg-white border border-gray-100 rounded-xl hover:border-[#8B5CF6]/30 hover:shadow-lg hover:shadow-[#8B5CF6]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: depositRows.length - index }}
                        data-tutorial={index === 0 ? "deposit-row-first" : undefined}
                      >
                        <div className="flex items-center gap-4">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#8B5CF6]">{index + 1}</span>
                          </div>

                          {/* Ad Account Select */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">Choose Ad Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                !depositRows.some(r => r.id !== row.id && r.accountId === opt.value)
                              )}
                              value={row.accountId}
                              onChange={(value) => updateDepositRow(row.id, 'accountId', value)}
                              placeholder="Search ad account name or ID..."
                              searchPlaceholder="Type to search (e.g., gyan, 767...)"
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Deposit Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min={ADMIN_SETTINGS.minimumDeposit}
                                step="50"
                                value={row.amount}
                                onChange={(e) => updateDepositRow(row.id, 'amount', e.target.value)}
                                placeholder={`Min $${ADMIN_SETTINGS.minimumDeposit} (50s)`}
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < ADMIN_SETTINGS.minimumDeposit && (
                              <p className="text-xs text-red-500 mt-1">Minimum deposit is ${ADMIN_SETTINGS.minimumDeposit}</p>
                            )}
                            {row.amount && parseFloat(row.amount) % 50 !== 0 && (
                              <p className="text-xs text-red-500 mt-1">Amount must be in $50 increments</p>
                            )}
                          </div>

                          {/* Remove Button */}
                          <div className="flex-shrink-0 pt-5">
                            {depositRows.length > 1 && (
                              <button
                                onClick={() => removeDepositRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    onClick={addDepositRow}
                    className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Another Ad Account</span>
                  </button>

                  {/* Cost Breakdown */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 space-y-4" data-tutorial="deposit-cost-breakdown">
                    <h4 className="text-sm font-semibold text-gray-700">Cost Breakdown</h4>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Deposit Amount</span>
                        <span className="text-gray-700 font-medium">${depositTotals.totalCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Service Fee ({depositTotals.markupPercent}%)</span>
                        <span className="text-[#8B5CF6] font-medium">+${depositTotals.markupAmount.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">Total Cost</span>
                          <span className="text-lg font-bold text-[#52B788]">${depositTotals.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#3B82F6]/5 to-[#3B82F6]/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-sm text-gray-600">Your Wallet Balance</span>
                      </div>
                      <span className="text-sm font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                    </div>

                    {depositTotals.totalCost > userBalance && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">Insufficient balance. Please add funds to your wallet.</p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    data-tutorial="deposit-submit-btn"
                    className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl py-3.5 text-base font-semibold shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isDepositFormValid || isSubmitting}
                    onClick={handleDepositSubmit}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : depositTotals.totalCost > userBalance ? (
                      'Insufficient Balance'
                    ) : depositRows.some(r => !r.accountId || !r.amount) ? (
                      'Select Ad Account & Amount'
                    ) : (
                      `Submit Deposit Request ($${depositTotals.totalCost.toFixed(2)})`
                    )}
                  </Button>

                  {/* Error Message */}
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 font-medium text-center">{submitError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Deposit Report Table */}
              {activeSubPage === 'deposit-report' && (
                <div className="p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit History</h3>
                      <p className="text-sm text-gray-500 mt-1">View all your ad account deposit requests and their status</p>
                    </div>
                  </div>

                  {paginatedData.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-[#52B788]" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">No Deposit History</h4>
                      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                        You haven't made any deposits to your ad accounts yet.
                      </p>
                      <button
                        onClick={() => setActiveSubPage('deposit')}
                        className="px-4 py-2 bg-[#52B788] text-white rounded-lg text-sm font-medium hover:bg-[#3D9970] transition-colors"
                      >
                        Make a Deposit
                      </button>
                    </div>
                  ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#8B5CF6]/5 to-gray-50">
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">Apply ID</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#52B788] uppercase tracking-wider">Deposit</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#F59E0B] uppercase tracking-wider">Fee</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">Total</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedData.map((item: any, index: number) => {
                        const depositAmount = parseFloat(item.amount) || 0
                        const commissionRate = item.commissionRate || 0
                        const commissionAmount = item.commissionAmount || 0
                        const totalDeducted = depositAmount + commissionAmount
                        return (
                        <tr key={item.id} className="table-row-animate hover:bg-[#8B5CF6]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                          <td className="py-4 px-4">
                            <code className="text-xs font-mono text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-1 rounded font-semibold">
                              {item.applyId || '-'}
                            </code>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <p className="text-sm text-gray-700 font-medium">{item.adAccount?.accountName || '-'}</p>
                              <p className="text-xs text-gray-400 font-mono">{item.adAccount?.accountId || '-'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-semibold text-[#52B788]">${depositAmount.toLocaleString()}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <span className="text-sm font-semibold text-[#F59E0B]">${commissionAmount.toFixed(2)}</span>
                              {commissionRate > 0 && (
                                <p className="text-xs text-gray-400">({commissionRate}%)</p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-bold text-[#8B5CF6]">${totalDeducted.toFixed(2)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-700">
                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>
                          <td className="py-4 px-4">{getStatusBadge(item.status)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              )}

              {/* Transfer Balance Form */}
              {activeSubPage === 'transfer-balance' && (
                <div className="p-6 space-y-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Transfer Balance</h3>
                      <p className="text-sm text-gray-500 mt-1">Transfer balance between your advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3B82F6]/10 to-[#3B82F6]/5 rounded-xl border border-[#3B82F6]/20">
                        <Wallet className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-sm text-gray-600">Wallet Balance:</span>
                        <span className="text-sm font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Rows */}
                  <div className="space-y-4">
                    {transferRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-5 bg-white border border-gray-100 rounded-xl hover:border-[#8B5CF6]/30 hover:shadow-lg hover:shadow-[#8B5CF6]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: transferRows.length - index }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#8B5CF6]">{index + 1}</span>
                          </div>

                          {/* From Account */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">From Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                opt.value !== row.toAccount &&
                                !transferRows.some(r => r.id !== row.id && r.fromAccount === opt.value)
                              )}
                              value={row.fromAccount}
                              onChange={(value) => updateTransferRow(row.id, 'fromAccount', value)}
                              placeholder="Search account..."
                              searchPlaceholder="Type to search (e.g., gyan, 767...)"
                            />
                          </div>

                          {/* Transfer Icon */}
                          <div className="flex-shrink-0 pt-5">
                            <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>

                          {/* To Account */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">To Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                opt.value !== row.fromAccount &&
                                !transferRows.some(r => r.id !== row.id && r.toAccount === opt.value)
                              )}
                              value={row.toAccount}
                              onChange={(value) => updateTransferRow(row.id, 'toAccount', value)}
                              placeholder="Search account..."
                              searchPlaceholder="Type to search (e.g., gyan, 767...)"
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Transfer Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min={ADMIN_SETTINGS.minimumDeposit}
                                step="50"
                                value={row.amount}
                                onChange={(e) => updateTransferRow(row.id, 'amount', e.target.value)}
                                placeholder={`Min $${ADMIN_SETTINGS.minimumDeposit} (50s)`}
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < ADMIN_SETTINGS.minimumDeposit && (
                              <p className="text-xs text-red-500 mt-1">Min ${ADMIN_SETTINGS.minimumDeposit}</p>
                            )}
                            {row.amount && parseFloat(row.amount) % 50 !== 0 && (
                              <p className="text-xs text-red-500 mt-1">Must be $50 increments</p>
                            )}
                          </div>

                          {/* Remove Button */}
                          <div className="flex-shrink-0 pt-5">
                            {transferRows.length > 1 && (
                              <button
                                onClick={() => removeTransferRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    onClick={addTransferRow}
                    className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#8B5CF6]/50 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Another Transfer</span>
                  </button>

                  {/* Transfer Summary */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Transfer Summary</h4>

                    {/* Individual Transfer Details */}
                    <div className="space-y-3 mb-4">
                      {transferRows.filter(row => row.fromAccount && row.toAccount && row.amount).map((row, index) => {
                        const fromAccountLabel = adAccountOptions.find(opt => opt.value === row.fromAccount)?.label || 'Unknown'
                        const toAccountLabel = adAccountOptions.find(opt => opt.value === row.toAccount)?.label || 'Unknown'
                        return (
                          <div key={row.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 truncate">
                                <span className="font-medium text-gray-700 truncate max-w-[120px]" title={fromAccountLabel}>{fromAccountLabel}</span>
                                <svg className="w-3 h-3 text-[#8B5CF6] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="font-medium text-gray-700 truncate max-w-[120px]" title={toAccountLabel}>{toAccountLabel}</span>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-[#8B5CF6] ml-3">${parseFloat(row.amount).toFixed(2)}</span>
                          </div>
                        )
                      })}
                      {transferRows.filter(row => row.fromAccount && row.toAccount && row.amount).length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No transfers added yet</p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-700">Total Transfer Amount</span>
                      <span className="text-lg font-bold text-[#8B5CF6]">${transferTotals.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleTransferSubmit}
                    disabled={!isTransferFormValid || isSubmitting}
                    className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl py-3 text-base font-semibold shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Transfers'}
                  </button>
                </div>
              )}

              {/* Refund Form */}
              {activeSubPage === 'refund' && (
                <div className="p-6 space-y-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Ads Refund Request</h3>
                      <p className="text-sm text-gray-500 mt-1">Create an deposit process which you want to enter in your wallet</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3B82F6]/10 to-[#3B82F6]/5 rounded-xl border border-[#3B82F6]/20">
                        <Wallet className="w-4 h-4 text-[#3B82F6]" />
                        <span className="text-sm text-gray-600">Wallet Balance:</span>
                        <span className="text-sm font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Refund Rows */}
                  <div className="space-y-4">
                    {refundRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-5 bg-white border border-gray-100 rounded-xl hover:border-[#8B5CF6]/30 hover:shadow-lg hover:shadow-[#8B5CF6]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: refundRows.length - index }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#8B5CF6]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#8B5CF6]">{index + 1}</span>
                          </div>

                          {/* Ad Account Select */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">Ad Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                !refundRows.some(r => r.id !== row.id && r.accountId === opt.value)
                              )}
                              value={row.accountId}
                              onChange={(value) => updateRefundRow(row.id, 'accountId', value)}
                              placeholder="Select Ads Account"
                              searchPlaceholder="Type to search (e.g., gyan, 767...)"
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Money</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min={ADMIN_SETTINGS.minimumDeposit}
                                step="50"
                                value={row.amount}
                                onChange={(e) => updateRefundRow(row.id, 'amount', e.target.value)}
                                placeholder="Enter Amount"
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < ADMIN_SETTINGS.minimumDeposit && (
                              <p className="text-xs text-red-500 mt-1">Min ${ADMIN_SETTINGS.minimumDeposit}</p>
                            )}
                            {row.amount && parseFloat(row.amount) % 50 !== 0 && (
                              <p className="text-xs text-red-500 mt-1">Must be $50 increments</p>
                            )}
                          </div>

                          {/* Add/Remove Buttons */}
                          <div className="flex-shrink-0 pt-5 flex gap-2">
                            <button
                              onClick={addRefundRow}
                              className="p-2 text-[#52B788] hover:text-white hover:bg-[#52B788] rounded-lg transition-all duration-200"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                            {refundRows.length > 1 && (
                              <button
                                onClick={() => removeRefundRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleRefundSubmit}
                    disabled={!isRefundFormValid}
                    className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl py-3 text-base font-semibold shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              )}

              {/* Refund Report - With tabs to switch between Transfer and Refund History */}
              {activeSubPage === 'refund-report' && (
                <div className="p-6">
                  {isLoading ? (
                    <div className="py-16 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#8B5CF6] mx-auto mb-4" />
                      <p className="text-sm text-gray-500">Loading history...</p>
                    </div>
                  ) : (
                  <>
                  {/* Header with Tabs */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {reportTab === 'transfer' ? 'Balance Transfer History' : 'Refund Request History'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {reportTab === 'transfer'
                          ? 'View all your balance transfers between ad accounts'
                          : 'View all your refund requests and their status'}
                      </p>
                    </div>
                    {/* Tab Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setReportTab('transfer')}
                        className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                          reportTab === 'transfer'
                            ? 'bg-white text-[#8B5CF6] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Transfer History
                      </button>
                      <button
                        onClick={() => setReportTab('refund')}
                        className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                          reportTab === 'refund'
                            ? 'bg-white text-[#EF4444] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Refund History
                      </button>
                    </div>
                  </div>

                  {/* Transfer History Tab Content */}
                  {reportTab === 'transfer' && (
                    <>
                      {balanceTransfers.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#8B5CF6]/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-2">No Transfer History</h4>
                          <p className="text-sm text-gray-500 mb-4">You haven't made any balance transfers yet.</p>
                          <button
                            onClick={() => setActiveSubPage('transfer-balance')}
                            className="px-4 py-2 bg-[#8B5CF6] text-white rounded-lg text-sm font-medium hover:bg-[#7C3AED] transition-colors"
                          >
                            Transfer Balance
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#8B5CF6]/5 to-gray-50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">From Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">To Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-[#8B5CF6] uppercase tracking-wider">Amount</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {balanceTransfers.map((transfer: any, index: number) => (
                                <tr key={transfer.id} className="table-row-animate hover:bg-[#8B5CF6]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                                  <td className="py-3 px-4">
                                    <div className="text-sm text-gray-700 font-medium">{transfer.fromAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{transfer.fromAccount?.accountId || '-'}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="text-sm text-gray-700 font-medium">{transfer.toAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{transfer.toAccount?.accountId || '-'}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-sm font-semibold text-[#8B5CF6]">${Number(transfer.amount).toFixed(2)}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-xs text-gray-600">
                                      {new Date(transfer.createdAt).toLocaleDateString()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">{getStatusBadge(transfer.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Refund History Tab Content */}
                  {reportTab === 'refund' && (
                    <>
                      {userRefunds.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
                            <span className="text-2xl">💸</span>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-2">No Refund Requests</h4>
                          <p className="text-sm text-gray-500 mb-4">You haven't made any refund requests yet.</p>
                          <button
                            onClick={() => setActiveSubPage('refund')}
                            className="px-4 py-2 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] transition-colors"
                          >
                            Request a Refund
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#EF4444]/5 to-gray-50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-[#EF4444] uppercase tracking-wider">Amount</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {userRefunds.map((item: any, index: number) => (
                                <tr key={item.id} className="table-row-animate hover:bg-[#EF4444]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                                  <td className="py-3 px-4">
                                    <div className="text-sm text-gray-700 font-medium">{item.adAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{item.adAccount?.accountId || item.accountId || '-'}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-sm font-semibold text-[#EF4444]">${Number(item.amount).toFixed(2)}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-xs text-gray-600">
                                      {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                                  <td className="py-3 px-4">
                                    <span className="text-xs text-gray-600 line-clamp-2" title={item.reason}>{item.reason || '-'}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                  </>
                  )}
                </div>
              )}
          </div>

          {/* Pagination */}
          {activeSubPage !== 'apply-ads-account' && activeSubPage !== 'deposit' && activeSubPage !== 'transfer-balance' && activeSubPage !== 'refund' && totalPages > 0 && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg transition-all ${
                  currentPage === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-[#8B5CF6]/5 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                }`}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof page === 'number' && setCurrentPage(page)}
                    disabled={page === '...'}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-sm'
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#8B5CF6]/10 hover:text-[#8B5CF6]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg transition-all ${
                  currentPage === totalPages
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-[#8B5CF6]/5 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                }`}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* BM Share Success Toast - Floating */}
      {bmShareSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-toastPop">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-checkBounce">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">Request submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Deposit Success Toast - Floating */}
      {depositToastSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-toastPop">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-checkBounce">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">Deposit request submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Application Success Toast - Floating */}
      {applicationToastSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-toastPop">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-checkBounce">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">Application submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Transfer Success Toast - Floating */}
      {transferToastSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-toastPop">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-checkBounce">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">Transfer request submitted successfully!</span>
          </div>
        </div>
      )}

      {/* Refund Success Toast - Floating */}
      {refundToastSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-toastPop">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-checkBounce">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">Refund request submitted successfully!</span>
          </div>
        </div>
      )}

      {/* BM Share Modal */}
      <Modal
        isOpen={showBmShareModal}
        onClose={() => setShowBmShareModal(false)}
        title="Get Access to Ad Account"
        className="max-w-md"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          {selectedAccountForBmShare
            ? `Share your BM ID to get access to ${selectedAccountForBmShare.adsAccountName}`
            : 'Share your BM ID to connect accounts'}
        </p>
        <div className="space-y-5">
          {selectedAccountForBmShare && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ad Account Name:</span>
                <span className="text-gray-700 font-medium">{selectedAccountForBmShare.adsAccountName}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Account ID:</span>
                <span className="text-[#8B5CF6] font-mono font-medium">{selectedAccountForBmShare.adsAccountId}</span>
              </div>
            </div>
          )}
          <div className="space-y-1.5" data-tutorial="bm-id-input">
            <label className="block text-sm font-medium text-gray-700">Business Manager ID (BM ID)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter your BM ID (numbers only)"
              value={bmShareForm.bmId}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '')
                setBmShareForm({...bmShareForm, bmId: value})
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Message (Optional)</label>
            <textarea
              placeholder="Enter any additional message for admin"
              value={bmShareForm.message}
              onChange={(e) => setBmShareForm({...bmShareForm, message: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white resize-none transition-all"
            />
          </div>

          {/* Error Message */}
          {bmShareError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">{bmShareError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 border-gray-200 rounded-xl py-3 hover:bg-gray-50" onClick={() => setShowBmShareModal(false)}>
              Cancel
            </Button>
            <Button
              data-tutorial="bm-share-submit"
              className="flex-1 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] rounded-xl py-3 shadow-md shadow-purple-500/25"
              disabled={!bmShareForm.bmId.trim() || bmShareSubmitting}
              onClick={handleBmShareSubmit}
            >
              {bmShareSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Get Access'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={showViewDetailsModal}
        onClose={() => setShowViewDetailsModal(false)}
        title="Application Details"
        className="max-w-2xl"
      >
        {selectedApplication && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Apply ID</p>
                <p className="text-sm font-mono text-gray-700">{selectedApplication.applyId}</p>
              </div>
              {getStatusBadge(selectedApplication.status)}
            </div>

            {/* License Info */}
            <div className="p-4 bg-gradient-to-r from-[#8B5CF6]/5 to-[#52B788]/5 rounded-xl border border-[#8B5CF6]/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">License</p>
                  <p className="text-sm font-medium text-gray-800">{selectedApplication.license}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">License Type</p>
                  <p className="text-sm font-medium text-gray-800 capitalize">{selectedApplication.details.licenseType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Request Time</p>
                  <p className="text-sm font-medium text-gray-800">{selectedApplication.requestTime}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Cost</p>
                  <p className="text-sm font-bold text-[#52B788]">${selectedApplication.totalCost}</p>
                </div>
              </div>
            </div>

            {/* Pages */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">Pages ({selectedApplication.details.pages})</p>
              <div className="space-y-1.5">
                {selectedApplication.details.pageUrls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="w-5 h-5 flex items-center justify-center bg-[#8B5CF6]/10 text-[#8B5CF6] rounded text-xs font-medium">{idx + 1}</span>
                    <span className="text-sm text-gray-600 truncate">{url}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domains */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">
                Domains
                {selectedApplication.details.unlimitedDomain ? (
                  <span className="ml-2 text-xs font-normal text-[#8B5CF6]">(Unlimited)</span>
                ) : (
                  <span className="ml-2 text-xs font-normal text-gray-500">({selectedApplication.details.domains} domains)</span>
                )}
              </p>
              {selectedApplication.details.unlimitedDomain ? (
                <div className="p-3 bg-gradient-to-r from-[#8B5CF6]/10 to-[#8B5CF6]/5 rounded-lg">
                  <p className="text-sm text-[#8B5CF6] font-medium">Unlimited domains enabled</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedApplication.details.domainUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#52B788]/10 text-[#52B788] rounded text-xs font-medium">{idx + 1}</span>
                      <span className="text-sm text-gray-600">{url}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* App */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">App</p>
              {selectedApplication.details.isApp ? (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">App ID:</span>
                    <span className="text-sm font-mono text-[#8B5CF6] font-medium">{selectedApplication.details.appId}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No app linked</p>
              )}
            </div>

            {/* Ad Accounts */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800">Ad Accounts ({selectedApplication.details.adAccounts.length})</p>
              <div className="space-y-2">
                {selectedApplication.details.adAccounts.map((acc, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#8B5CF6]">Account {idx + 1}</span>
                      <span className="text-sm font-bold text-[#52B788]">${acc.deposit}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Name: </span>
                        <span className="text-gray-700">{acc.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Timezone: </span>
                        <span className="text-gray-700">{acc.timezone}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Message */}
            {selectedApplication.details.message && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-800">Message / Remarks</p>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{selectedApplication.details.message}</p>
                </div>
              </div>
            )}

            {/* Close Button */}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full border-gray-200 rounded-xl py-3 hover:bg-gray-50"
                onClick={() => setShowViewDetailsModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Reason Modal */}
      <Modal
        isOpen={showRefundReasonModal}
        onClose={() => {
          setShowRefundReasonModal(false)
          setRefundReason('')
        }}
        title="Refund Reason"
        className="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for this refund request. This is required to process your refund.
          </p>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Enter your refund reason..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] transition-all resize-none"
            />
            {refundReason.trim() === '' && (
              <p className="text-xs text-gray-500 mt-1">
                Reason is required to submit refund request
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setShowRefundReasonModal(false)
                setRefundReason('')
              }}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleRefundReasonSubmit}
              disabled={!refundReason.trim()}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white rounded-xl font-medium shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Refund
            </button>
          </div>
        </div>
      </Modal>
      </div>
      )}
    </DashboardLayout>
  )
}
