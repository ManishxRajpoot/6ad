'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
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
  Minus,
  Download,
  Copy,
  Check,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { authApi, accountsApi, transactionsApi, accountDepositsApi, dashboardApi, settingsApi, PlatformStatus } from '@/lib/api'
import { AccountManageIcon, DepositManageIcon, AfterSaleIcon, ComingSoonIcon } from '@/components/icons/MenuIcons'

// Animated Counter Component
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
      if (progress < 1) requestAnimationFrame(animate)
      else previousValue.current = value
    }
    requestAnimationFrame(animate)
  }, [value, duration])

  return <>{String(displayValue).padStart(2, '0')}</>
}

// TikTok brand colors
const brandColor = '#FF0050'
const brandColorDark = '#E60045'
const brandGradient = 'from-[#FF0050] to-[#00F2EA]'

// Mock data - In real app, these would come from API/admin settings
const ADMIN_SETTINGS = {
  openingFee: 35,
  unlimitedDomainFee: 60,
  extraPageFee: 5,
  depositMarkupPercent: 5,
  profileShareLink: 'https://business.tiktok.com/share/6adplatform',
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

// Note: existingLicenses will be derived dynamically from user's approved accounts
// See userLicenseOptions useMemo below

// Page count options
const pageCountOptions = [
  { value: '1', label: '1 Page' },
  { value: '2', label: '2 Pages' },
  { value: '3', label: '3 Pages' },
  { value: '4', label: '4 Pages' },
  { value: '5', label: '5 Pages' },
  { value: '6', label: '6 Pages (+$5)' },
  { value: '7', label: '7 Pages (+$10)' },
  { value: '8', label: '8 Pages (+$15)' },
  { value: '9', label: '9 Pages (+$20)' },
  { value: '10', label: '10 Pages (+$25)' },
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

// Timezone options
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

// Account List data
const accountListData = [
  { id: 1, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 2, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 3, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 4, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 5, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 6, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 7, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
  { id: 8, license: 'TikTok Marketing', adsAccountId: '7675646567785', adsAccountName: 'viral campaign' },
]

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

// Account Applied Records data
const appliedRecordsData: AppliedRecord[] = [
  {
    id: 1,
    applyId: '17420455677Br3fgryyr',
    license: 'TikTok Marketing',
    requestTime: '14/05/2024/06:04:24',
    totalCost: 270,
    status: 'APPROVED',
    details: {
      licenseType: 'new',
      pages: 3,
      pageUrls: ['https://tiktok.com/@page1', 'https://tiktok.com/@page2', 'https://tiktok.com/@page3'],
      unlimitedDomain: false,
      domains: 2,
      domainUrls: ['example.com', 'test.com'],
      isApp: true,
      appId: 'APP123456',
      adAccounts: [
        { name: 'Campaign 1', timezone: 'UTC+5:30 (Kolkata, India)', deposit: 100 },
        { name: 'Campaign 2', timezone: 'UTC+0 (London, UK)', deposit: 50 }
      ],
      message: 'Please approve this quickly'
    }
  },
  {
    id: 2,
    applyId: '17420455677Br3fgryyr',
    license: 'TikTok Marketing',
    requestTime: '14/05/2024/06:04:24',
    totalCost: 223,
    status: 'APPROVED',
    details: {
      licenseType: 'existing',
      pages: 2,
      pageUrls: ['https://tiktok.com/@page1', 'https://tiktok.com/@page2'],
      unlimitedDomain: true,
      domains: 0,
      domainUrls: [],
      isApp: false,
      appId: '',
      adAccounts: [
        { name: 'My Campaign', timezone: 'UTC+8 (Singapore, Hong Kong)', deposit: 150 }
      ],
      message: ''
    }
  },
  {
    id: 3,
    applyId: '17420455677Br3fgryyr',
    license: 'TikTok Marketing',
    requestTime: '14/05/2024/06:04:24',
    totalCost: 232,
    status: 'PENDING',
    details: {
      licenseType: 'new',
      pages: 5,
      pageUrls: ['https://tiktok.com/@p1', 'https://tiktok.com/@p2', 'https://tiktok.com/@p3', 'https://tiktok.com/@p4', 'https://tiktok.com/@p5'],
      unlimitedDomain: false,
      domains: 1,
      domainUrls: ['mysite.com'],
      isApp: false,
      appId: '',
      adAccounts: [
        { name: 'Test Account', timezone: 'UTC-5 (New York, USA)', deposit: 200 }
      ],
      message: 'Need this for marketing campaign'
    }
  },
  { id: 4, applyId: '17420455677Br3fgryyr', license: 'TikTok Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 1323, status: 'APPROVED', details: { licenseType: 'new', pages: 1, pageUrls: ['https://tiktok.com/@mybusiness'], unlimitedDomain: true, domains: 0, domainUrls: [], isApp: true, appId: 'APP789012', adAccounts: [{ name: 'Main Account', timezone: 'UTC+5:30 (Kolkata, India)', deposit: 500 }], message: '' } },
  { id: 5, applyId: '17420455677Br3fgryyr', license: 'TikTok Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 4334, status: 'REJECTED', details: { licenseType: 'existing', pages: 10, pageUrls: ['https://tiktok.com/@p1', 'https://tiktok.com/@p2', 'https://tiktok.com/@p3', 'https://tiktok.com/@p4', 'https://tiktok.com/@p5', 'https://tiktok.com/@p6', 'https://tiktok.com/@p7', 'https://tiktok.com/@p8', 'https://tiktok.com/@p9', 'https://tiktok.com/@p10'], unlimitedDomain: true, domains: 0, domainUrls: [], isApp: true, appId: 'BIGAPP999', adAccounts: [{ name: 'Enterprise 1', timezone: 'UTC+9 (Tokyo, Japan)', deposit: 1000 }, { name: 'Enterprise 2', timezone: 'UTC+1 (Paris, France)', deposit: 1000 }, { name: 'Enterprise 3', timezone: 'UTC-8 (Los Angeles, USA)', deposit: 1000 }], message: 'Large campaign request' } },
  { id: 6, applyId: '17420455677Br3fgryyr', license: 'TikTok Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 222, status: 'APPROVED', details: { licenseType: 'new', pages: 2, pageUrls: ['https://tiktok.com/@shop1', 'https://tiktok.com/@shop2'], unlimitedDomain: false, domains: 2, domainUrls: ['shop1.com', 'shop2.com'], isApp: false, appId: '', adAccounts: [{ name: 'Shop Account', timezone: 'UTC+5:30 (Kolkata, India)', deposit: 100 }], message: 'E-commerce campaign' } },
  { id: 7, applyId: '17420455677Br3fgryyr', license: 'TikTok Marketing', requestTime: '14/05/2024/06:04:24', totalCost: 2342, status: 'APPROVED', details: { licenseType: 'existing', pages: 4, pageUrls: ['https://tiktok.com/@brand1', 'https://tiktok.com/@brand2', 'https://tiktok.com/@brand3', 'https://tiktok.com/@brand4'], unlimitedDomain: true, domains: 0, domainUrls: [], isApp: true, appId: 'BRANDAPP', adAccounts: [{ name: 'Brand Campaign', timezone: 'UTC+5:30 (Kolkata, India)', deposit: 500 }, { name: 'Brand Campaign 2', timezone: 'UTC+0 (London, UK)', deposit: 500 }], message: 'Brand awareness campaign' } },
]

// BC Share Log data
const bmShareLogData = [
  { id: 1, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 2, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 3, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'PENDING' },
  { id: 4, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 5, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'REJECTED' },
  { id: 6, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 7, applyId: '17420455677Br3fgryyr', adsAccountName: 'viral campaign', adsAccountId: '4556676453347B7756', requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
]

// Deposit Report data
const depositReportData = [
  { id: 1, applyId: '4564545321', adsAccountId: '7675646567785', adsAccountName: 'viral campaign', chargeMoney: 100, totalCost: 105.00, requestTime: '14/05/2024/06:04:24', status: 'APPROVED' },
  { id: 2, applyId: '4564545322', adsAccountId: '7675646567786', adsAccountName: 'trending ads', chargeMoney: 200, totalCost: 210.00, requestTime: '14/05/2024/08:15:30', status: 'PENDING' },
  { id: 3, applyId: '4564545323', adsAccountId: '7675646567787', adsAccountName: 'influencer boost', chargeMoney: 150, totalCost: 157.50, requestTime: '13/05/2024/14:22:45', status: 'APPROVED' },
  { id: 4, applyId: '4564545324', adsAccountId: '7675646567788', adsAccountName: 'video promo', chargeMoney: 250, totalCost: 262.50, requestTime: '13/05/2024/10:30:00', status: 'APPROVED' },
  { id: 5, applyId: '4564545325', adsAccountId: '7675646567789', adsAccountName: 'creator hub', chargeMoney: 50, totalCost: 52.50, requestTime: '12/05/2024/16:45:12', status: 'REJECTED' },
  { id: 6, applyId: '4564545326', adsAccountId: '7675646567790', adsAccountName: 'viral spark', chargeMoney: 100, totalCost: 105.00, requestTime: '12/05/2024/09:10:33', status: 'APPROVED' },
  { id: 7, applyId: '4564545327', adsAccountId: '7675646567791', adsAccountName: 'trend master', chargeMoney: 200, totalCost: 210.00, requestTime: '11/05/2024/11:55:20', status: 'PENDING' },
  { id: 8, applyId: '4564545328', adsAccountId: '7675646567792', adsAccountName: 'viral zone', chargeMoney: 150, totalCost: 157.50, requestTime: '10/05/2024/13:40:55', status: 'APPROVED' },
]

type SubPage = 'apply-ads-account' | 'account-list' | 'account-applied-records' | 'bm-share-log' | 'deposit' | 'deposit-report' | 'transfer-balance' | 'refund' | 'refund-report'

type MenuSection = 'account-manage' | 'deposit-manage' | 'after-sale'

type AdAccountEntry = {
  name: string
  timezone: string
  deposit: string
}

type DepositRow = {
  id: number
  accountId: string
  amount: string
}

export default function TikTokPage() {
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
  const [profileShareLink, setProfileShareLink] = useState<string>('https://business.tiktok.com/share/6adplatform')

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
      { label: 'Pending Applications', numericValue: pendingApps, trend: appsGrowth.trend, badge: appsGrowth.badge, color: '#FF0050', chartPath: generateChartPath(pendingApps, 'up') },
      { label: 'Pending Deposits', numericValue: pendingDeps, trend: depsGrowth.trend, badge: depsGrowth.badge, color: '#00F2EA', chartPath: generateChartPath(pendingDeps, 'up') },
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
        const [userRes, accountsRes, refundsRes, depositsRes, statsRes, platformRes, profileLinksRes] = await Promise.all([
          authApi.me().catch(() => ({ user: null })),
          accountsApi.getAll('TIKTOK').catch(() => ({ accounts: [] })),
          transactionsApi.refunds.getAll('TIKTOK').catch(() => ({ refunds: [] })),
          accountDepositsApi.getAll('TIKTOK').catch(() => ({ deposits: [] })),
          dashboardApi.getStats().catch(() => ({})),
          settingsApi.platforms.get().catch(() => ({ platforms: { facebook: 'active', google: 'active', tiktok: 'active', snapchat: 'active', bing: 'active' } })),
          settingsApi.profileShareLinks.get().catch(() => ({ profileShareLinks: { facebook: 'https://www.facebook.com/profile/6adplatform', tiktok: 'https://business.tiktok.com/share/6adplatform' } }))
        ])
        setUser(userRes.user)
        setUserAccounts(accountsRes.accounts || [])
        setUserRefunds(refundsRes.refunds || [])
        setUserDeposits(depositsRes.deposits || [])
        setDashboardStats(statsRes)
        setPlatformStatus((platformRes.platforms?.tiktok || 'active') as PlatformStatus)
        setProfileShareLink(profileLinksRes.profileShareLinks?.tiktok || 'https://business.tiktok.com/share/6adplatform')
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
        filename = 'tiktok_account_list'
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
        filename = 'tiktok_applied_records'
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
        filename = exportType === 'refund' ? 'tiktok_refunds' : 'tiktok_refund_report'
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

  // Get user's TikTok commission rate from API (fallback to 5% if not set)
  const tiktokCommissionRate = user?.tiktokCommission ? parseFloat(user.tiktokCommission) : 5

  // User wallet balance from API
  const userBalance = user?.balance ? parseFloat(user.balance) : 0

  // Check if platform is enabled and if user has existing accounts
  // platformStatus: 'active' = can apply, 'stop' = visible but can't apply, 'hidden' = not shown
  const platformEnabled = platformStatus === 'active'
  const platformStopped = platformStatus === 'stop'
  const hasExistingAccounts = userAccounts.length > 0

  // Modal states
  const [showBcShareModal, setShowBcShareModal] = useState(false)
  const [showViewDetailsModal, setShowViewDetailsModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<AppliedRecord | null>(null)
  const [selectedAccountForBcShare, setSelectedAccountForBcShare] = useState<{ id: number; license: string; adsAccountId: string; adsAccountName: string } | null>(null)

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

  const [bcShareForm, setBcShareForm] = useState({
    bcId: '',
    message: ''
  })

  // Deposit form state
  const [depositRows, setDepositRows] = useState<DepositRow[]>([{ id: 1, accountId: '', amount: '' }])

  // Generate ad account options for searchable dropdown from userAccounts (real API data)
  const adAccountOptions = useMemo(() => {
    return userAccounts.map(acc => ({
      value: acc.accountId,
      label: `${acc.accountName} (${acc.accountId})`
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

    // Convert to options format for Select component
    return Array.from(licenseSet).map(license => ({
      value: license,
      label: license
    }))
  }, [userAccounts])

  // Calculate deposit totals using user's actual commission rate
  const depositTotals = useMemo(() => {
    const totalCharge = depositRows.reduce((sum, row) => {
      const amount = parseInt(row.amount) || 0
      return sum + amount
    }, 0)
    const markupPercent = tiktokCommissionRate
    const markupAmount = totalCharge * (markupPercent / 100)
    const totalCost = totalCharge + markupAmount
    return { totalCharge, markupPercent, markupAmount, totalCost }
  }, [depositRows, tiktokCommissionRate])

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
  const isDepositFormValid = depositRows.every(row => row.accountId && row.amount) && depositTotals.totalCost <= userBalance

  // Calculate costs using user's actual commission rate
  const costs = useMemo(() => {
    const pageNum = parseInt(pageCount)
    const extraPages = Math.max(0, pageNum - 5)
    const extraPagesCost = extraPages * ADMIN_SETTINGS.extraPageFee
    // Use user's configured unlimited domain fee, fallback to admin settings if not set
    const userUnlimitedDomainFee = user?.tiktokUnlimitedDomainFee !== undefined ? Number(user.tiktokUnlimitedDomainFee) : ADMIN_SETTINGS.unlimitedDomainFee
    const domainCost = unlimitedDomain === 'yes' ? userUnlimitedDomainFee : 0
    const totalDeposits = adAccounts.reduce((sum, acc) => sum + parseInt(acc.deposit || '0'), 0)
    const depositMarkupAmount = totalDeposits * tiktokCommissionRate / 100
    const depositWithMarkup = totalDeposits + depositMarkupAmount
    // Opening fee is per ad account (multiply by quantity)
    const adAccountQty = adAccounts.length
    // Use platform-specific opening fee (tiktokFee for TikTok)
    const openingFeePerAccount = user?.tiktokFee ? parseFloat(user.tiktokFee) : ADMIN_SETTINGS.openingFee
    const openingFee = openingFeePerAccount * adAccountQty
    const totalCost = openingFee + domainCost + extraPagesCost + depositWithMarkup

    return { totalDeposits, depositMarkupAmount, depositWithMarkup, totalCost, openingFee, commissionRate: tiktokCommissionRate }
  }, [pageCount, unlimitedDomain, adAccounts, tiktokCommissionRate, user])

  // Handle View Details click
  const handleViewDetails = (record: AppliedRecord) => {
    setSelectedApplication(record)
    setShowViewDetailsModal(true)
  }

  // Handle BC Share click from Account List
  const handleBcShareClick = (account: { id: number; license: string; adsAccountId: string; adsAccountName: string }) => {
    setSelectedAccountForBcShare(account)
    setBcShareForm({ bcId: '', message: '' })
    setShowBcShareModal(true)
  }

  // Handle Deposit click - redirect to Deposit section
  const handleDepositClick = () => {
    setActiveSubPage('deposit')
  }

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
        return (
          <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        )
      case 'PENDING':
        return (
          <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}>
            <Clock className="w-3 h-3" />
            Pending
          </span>
        )
      case 'REJECTED':
        return (
          <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        )
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
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
      items: [
        { id: 'apply-ads-account' as SubPage, label: 'Apply Ads Account' },
        { id: 'account-list' as SubPage, label: 'Account List' },
        { id: 'account-applied-records' as SubPage, label: 'Account Applied Records' },
        { id: 'bm-share-log' as SubPage, label: 'BC Share Log' },
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
    <DashboardLayout title="TikTok User Management Account" subtitle="">
      <div className="flex flex-col h-full">
      {/* Global styles */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(255, 0, 80, 0.15); }
      `}</style>

      {/* Row 1: Header Bar */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-xl shadow-sm border border-gray-100/50">
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all"
          />
        </div>

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
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#FF0050]/10 hover:text-[#FF0050] transition-colors duration-150 flex items-center gap-2"
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
          className="bg-gradient-to-r from-[#FF0050] to-[#00F2EA] hover:from-[#E60045] hover:to-[#00D9D1] text-white rounded-md shadow-sm whitespace-nowrap text-xs px-3 py-1.5 h-auto"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ads Account
        </Button>
      </div>

      {/* Row 2: Stats Cards - Real-time Updates */}
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
                    <linearGradient id={`stat-gradient-tiktok-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`}
                    fill={`url(#stat-gradient-tiktok-${index})`}
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
            <div className="absolute inset-0 bg-gradient-to-br from-[#FF0050]/5 via-transparent to-[#00F2EA]/5" />

            {/* TikTok Logo - Larger and balanced */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF0050] via-[#000000] to-[#00F2EA] flex items-center justify-center shadow-lg shadow-pink-500/30">
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="white">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
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
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#FF0050]/5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-all duration-300 ${
                        expandedSections.includes(menu.section)
                          ? 'rotate-180 text-[#FF0050]'
                          : 'rotate-0 text-gray-400'
                      }`}
                    />
                  </button>

                  <div
                    className={`ml-5 space-y-1 border-l-2 border-[#FF0050]/20 pl-4 overflow-hidden transition-all duration-300 ease-in-out ${
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
                            ? 'bg-gradient-to-r from-[#FF0050] to-[#00F2EA] text-white font-medium shadow-md shadow-pink-200'
                            : 'text-gray-600 hover:bg-[#FF0050]/5 hover:text-[#FF0050]'
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
                <div className="px-8 py-6 space-y-5">

                  {/* License */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-800">License</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setLicenseType('new')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          licenseType === 'new'
                            ? 'bg-[#FF0050] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        New License
                      </button>
                      <button
                        onClick={() => setLicenseType('existing')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          licenseType === 'existing'
                            ? 'bg-[#FF0050] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Existing License
                      </button>
                    </div>

                    {licenseType === 'new' && (
                      <input
                        type="text"
                        placeholder="Enter license name (e.g., TikTok Marketing 1)"
                        value={newLicenseName}
                        onChange={(e) => setNewLicenseName(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all"
                      />
                    )}

                    {licenseType === 'existing' && (
                      userLicenseOptions.length > 0 ? (
                        <Select
                          options={userLicenseOptions}
                          value={selectedLicense}
                          onChange={setSelectedLicense}
                          placeholder="Select existing license"
                        />
                      ) : (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
                          <p className="text-sm text-gray-500">No existing licenses found</p>
                          <p className="text-xs text-gray-400 mt-1">Create a new license first by applying for an ad account</p>
                        </div>
                      )
                    )}
                  </div>

                  {/* Pages */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-gray-800">
                        Number of Pages
                        <span className="text-xs font-normal text-gray-500 ml-2">(1-5 free, 6-10 +$5 each)</span>
                      </label>
                    </div>
                    <Select
                      options={pageCountOptions}
                      value={pageCount}
                      onChange={handlePageCountChange}
                      placeholder="Select pages"
                    />
                    <div className="space-y-2">
                      {pageUrls.map((url, index) => (
                        <div key={index} className="relative">
                          <input
                            type="text"
                            placeholder={`Enter TikTok Page ${index + 1} URL`}
                            value={url}
                            onChange={(e) => updatePageUrl(index, e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all pr-10"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">#{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Share Profile */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="shareProfile"
                        checked={pageShareConfirmed}
                        onChange={(e) => setPageShareConfirmed(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#FF0050] focus:ring-[#FF0050]"
                      />
                      <label htmlFor="shareProfile" className="text-sm text-gray-600">
                        Please make sure you have already shared your page with this profile
                      </label>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#FF0050]/5 to-[#00F2EA]/5 border border-[#FF0050]/20 rounded-xl">
                      <span className="text-sm text-gray-700 font-medium truncate flex-1">
                        {profileShareLink}
                      </span>
                      <button
                        onClick={() => copyToClipboard(profileShareLink, 999)}
                        className="p-1.5 hover:bg-white/80 rounded transition-colors ml-2 flex-shrink-0"
                      >
                        {copiedId === 999 ? <Check className="w-4 h-4 text-[#52B788]" /> : <Copy className="w-4 h-4 text-[#FF0050]" />}
                      </button>
                    </div>
                  </div>

                  {/* Domain */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-gray-800">Unlimited Domain?</label>
                      {unlimitedDomain === 'yes' && (
                        <span className="text-xs text-[#FF0050] font-medium">+${ADMIN_SETTINGS.unlimitedDomainFee}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUnlimitedDomain('yes')}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          unlimitedDomain === 'yes'
                            ? 'bg-[#FF0050] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setUnlimitedDomain('no')}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          unlimitedDomain === 'no'
                            ? 'bg-[#00F2EA] text-black shadow-sm'
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
                        />
                        <div className="space-y-2">
                          {domainUrls.map((url, index) => (
                            <input
                              key={index}
                              type="text"
                              placeholder={`Enter Domain ${index + 1} (e.g., example.com)`}
                              value={url}
                              onChange={(e) => updateDomainUrl(index, e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all"
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Is App */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-800">Is App?</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsApp('yes')}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          isApp === 'yes'
                            ? 'bg-[#FF0050] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setIsApp('no')}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                          isApp === 'no'
                            ? 'bg-[#00F2EA] text-black shadow-sm'
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
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all"
                        />
                        <p className="text-xs text-green-600">App ID is free - no additional charge</p>
                      </div>
                    )}
                  </div>

                  {/* Ad Accounts */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-800">
                      How many Ad Accounts?
                      <span className="text-xs font-normal text-gray-500 ml-2">(1-5 accounts, same fee)</span>
                    </label>
                    <Select
                      options={adAccountCountOptions}
                      value={adAccountCount}
                      onChange={handleAdAccountCountChange}
                      placeholder="Select ad accounts"
                    />

                    <div className="space-y-3">
                      {adAccounts.map((account, index) => (
                        <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                          <span className="text-sm font-semibold text-[#FF0050]">Ad Account {index + 1}</span>
                          <div className="grid grid-cols-3 gap-3">
                            <input
                              type="text"
                              placeholder="Account Name"
                              value={account.name}
                              onChange={(e) => updateAdAccount(index, 'name', e.target.value)}
                              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] transition-all"
                            />
                            <SearchableSelect
                              options={timezoneOptions}
                              value={account.timezone}
                              onChange={(value) => updateAdAccount(index, 'timezone', value)}
                              placeholder="Timezone"
                              searchPlaceholder="Type to search (e.g., kol)"
                            />
                            <Select
                              options={depositOptions}
                              value={account.deposit}
                              onChange={(value) => updateAdAccount(index, 'deposit', value)}
                              placeholder="Deposit"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">Message / Remarks</label>
                    <textarea
                      placeholder="Enter any message or remarks for admin"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white resize-none transition-all"
                    />
                  </div>

                  {/* Summary Cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#FF0050]/5 border border-[#FF0050]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Total Deposit of Ads</p>
                      <p className="text-lg font-bold text-[#FF0050]">${costs.depositWithMarkup.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#52B788]/5 border border-[#52B788]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Total Cost</p>
                      <p className="text-lg font-bold text-[#52B788]">${costs.totalCost.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#00F2EA]/5 border border-[#00F2EA]/20 rounded-xl text-center">
                      <p className="text-xs text-gray-500">Your Balance</p>
                      <p className="text-lg font-bold text-[#00F2EA]">${userBalance.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-[#FF0050] to-[#00F2EA] hover:from-[#E60045] hover:to-[#00D9D1] text-white rounded-xl py-3 text-base font-semibold shadow-lg shadow-pink-500/30 transition-all hover:shadow-xl hover:shadow-pink-500/40"
                    disabled={!pageShareConfirmed || userBalance < costs.totalCost}
                  >
                    {userBalance < costs.totalCost
                      ? 'Insufficient Balance'
                      : `Pay $${costs.totalCost.toFixed(2)} and Submit`
                    }
                  </Button>

                  {!pageShareConfirmed && (
                    <p className="text-xs text-center text-red-500">
                      Please confirm that you have shared your pages with the profile above
                    </p>
                  )}
                </div>
                  )}
                </>
              )}

              {/* Account List Table */}
              {activeSubPage === 'account-list' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FF0050]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#FF0050] uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {accountListData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FF0050]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.license}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-[#FF0050] font-medium font-mono">{item.adsAccountId}</span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.adsAccountName}</td>
                        <td className="py-4 px-5">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBcShareClick(item)}
                              className="text-sm text-[#FF0050] hover:underline font-medium"
                            >
                              BC Share
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={handleDepositClick}
                              className="text-sm text-[#00F2EA] hover:underline font-medium"
                            >
                              Deposit
                            </button>
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
                    <tr className="bg-gradient-to-r from-[#FF0050]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#FF0050] uppercase tracking-wider">Request Start Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account Details</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {appliedRecordsData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FF0050]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.license}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-[#FF0050] font-medium">06:04:24</span>
                          </span>
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-700 font-medium">${item.totalCost}</td>
                        <td className="py-4 px-5">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className="text-sm text-[#FF0050] hover:underline font-medium"
                          >
                            View Details
                          </button>
                        </td>
                        <td className="py-4 px-5">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* BC Share Log Table */}
              {activeSubPage === 'bm-share-log' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#FF0050]/5 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#FF0050] uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bmShareLogData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#FF0050]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5 text-sm text-gray-700 font-mono">{item.applyId}</td>
                        <td className="py-4 px-5 text-sm text-gray-700">{item.adsAccountName}</td>
                        <td className="py-4 px-5">
                          <span className="text-sm text-[#FF0050] font-medium font-mono">{item.adsAccountId}</span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="text-sm">
                            <span className="text-gray-700">14/05/2024/</span>
                            <span className="text-[#FF0050] font-medium">06:04:24</span>
                          </span>
                        </td>
                        <td className="py-4 px-5">{getStatusBadge(item.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Deposit Form */}
              {activeSubPage === 'deposit' && (
                <div className="p-6 space-y-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit to Ad Account</h3>
                      <p className="text-sm text-gray-500 mt-1">Add funds to your advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00F2EA]/10 to-[#00F2EA]/5 rounded-xl border border-[#00F2EA]/20">
                        <Wallet className="w-4 h-4 text-[#00F2EA]" />
                        <span className="text-sm text-gray-600">Wallet Balance:</span>
                        <span className="text-sm font-bold text-[#00F2EA]">${userBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit Rows */}
                  <div className="space-y-4">
                    {depositRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-5 bg-white border border-gray-100 rounded-xl hover:border-[#FF0050]/30 hover:shadow-lg hover:shadow-[#FF0050]/5 transition-all duration-300"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF0050]/10 to-[#FF0050]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#FF0050]">{index + 1}</span>
                          </div>

                          {/* Ad Account Select */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">Choose Ad Account</label>
                            <SearchableSelect
                              options={adAccountOptions}
                              value={row.accountId}
                              onChange={(value) => updateDepositRow(row.id, 'accountId', value)}
                              placeholder="Search ad account name or ID..."
                              searchPlaceholder="Type to search (e.g., viral, 767...)"
                            />
                          </div>

                          {/* Amount Select */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Deposit Amount</label>
                            <Select
                              options={depositAmountOptions}
                              value={row.amount}
                              onChange={(value) => updateDepositRow(row.id, 'amount', value)}
                              placeholder="Select amount"
                            />
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
                    className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#FF0050]/50 hover:text-[#FF0050] hover:bg-[#FF0050]/5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Another Ad Account</span>
                  </button>

                  {/* Cost Breakdown */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700">Cost Breakdown</h4>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Deposit Amount</span>
                        <span className="text-gray-700 font-medium">${depositTotals.totalCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Service Fee ({depositTotals.markupPercent}%)</span>
                        <span className="text-[#FF0050] font-medium">+${depositTotals.markupAmount.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">Total Cost</span>
                          <span className="text-lg font-bold text-[#52B788]">${depositTotals.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-[#00F2EA]/5 to-[#00F2EA]/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#00F2EA]" />
                        <span className="text-sm text-gray-600">Your Wallet Balance</span>
                      </div>
                      <span className="text-sm font-bold text-[#00F2EA]">${userBalance.toLocaleString()}</span>
                    </div>

                    {depositTotals.totalCost > userBalance && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">Insufficient balance. Please add funds to your wallet.</p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    className="w-full bg-gradient-to-r from-[#FF0050] to-[#00F2EA] hover:from-[#E60045] hover:to-[#00D9D1] text-white rounded-xl py-3.5 text-base font-semibold shadow-lg shadow-pink-500/30 transition-all hover:shadow-xl hover:shadow-pink-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isDepositFormValid}
                  >
                    {depositTotals.totalCost > userBalance
                      ? 'Insufficient Balance'
                      : depositRows.some(r => !r.accountId || !r.amount)
                      ? 'Select Ad Account & Amount'
                      : `Submit Deposit Request ($${depositTotals.totalCost.toFixed(2)})`
                    }
                  </Button>
                </div>
              )}

              {/* Deposit Report Table */}
              {activeSubPage === 'deposit-report' && (
                <div className="p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit History</h3>
                      <p className="text-sm text-gray-500 mt-1">View all your deposit requests and their status</p>
                    </div>
                  </div>

                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#FF0050]/5 to-gray-50">
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#52B788] uppercase tracking-wider">Charge Money</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-[#FF0050] uppercase tracking-wider">Total Cost</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {depositReportData.map((item) => (
                        <tr key={item.id} className="table-row-animate hover:bg-[#FF0050]/5 transition-all duration-300" style={{ opacity: 0 }}>
                          <td className="py-4 px-4 text-sm text-gray-700 font-mono">{item.applyId}</td>
                          <td className="py-4 px-4">
                            <div className="space-y-0.5">
                              <p className="text-sm text-gray-700 font-medium">{item.adsAccountName}</p>
                              <p className="text-xs text-gray-400 font-mono">{item.adsAccountId}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-semibold text-[#52B788]">${item.chargeMoney}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm font-semibold text-[#FF0050]">${item.totalCost.toFixed(2)}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm">
                              <span className="text-gray-700">{item.requestTime.split('/').slice(0, 3).join('/')}/</span>
                              <span className="text-[#FF0050] font-medium">{item.requestTime.split('/')[3]}</span>
                            </span>
                          </td>
                          <td className="py-4 px-4">{getStatusBadge(item.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Placeholder */}
              {(activeSubPage === 'transfer-balance' || activeSubPage === 'refund' || activeSubPage === 'refund-report') && (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#FF0050]/10 to-[#00F2EA]/10 flex items-center justify-center text-[#FF0050]">
                    <ComingSoonIcon />
                  </div>
                  <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                  <p className="text-sm text-gray-500 mt-2">This section is under development</p>
                </div>
              )}
          </div>

          {/* Pagination */}
          {activeSubPage !== 'apply-ads-account' && activeSubPage !== 'deposit' && activeSubPage !== 'transfer-balance' && activeSubPage !== 'refund' && activeSubPage !== 'refund-report' && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#FF0050]/5 hover:border-[#FF0050]/30 hover:text-[#FF0050] transition-all"
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
                        ? 'bg-gradient-to-r from-[#FF0050] to-[#00F2EA] text-white shadow-sm'
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#FF0050]/10 hover:text-[#FF0050]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#FF0050]/5 hover:border-[#FF0050]/30 hover:text-[#FF0050] transition-all"
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* BC Share Modal */}
      <Modal
        isOpen={showBcShareModal}
        onClose={() => setShowBcShareModal(false)}
        title="BC Share Ad Account"
        className="max-w-md"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          {selectedAccountForBcShare
            ? `Share BC ID for ${selectedAccountForBcShare.adsAccountName}`
            : 'Share your BC ID to connect accounts'}
        </p>
        <div className="space-y-5">
          {selectedAccountForBcShare && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Account ID:</span>
                <span className="text-[#FF0050] font-mono font-medium">{selectedAccountForBcShare.adsAccountId}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">License:</span>
                <span className="text-gray-700">{selectedAccountForBcShare.license}</span>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Business Center ID (BC ID)</label>
            <input
              type="text"
              placeholder="Enter your BC ID"
              value={bcShareForm.bcId}
              onChange={(e) => setBcShareForm({...bcShareForm, bcId: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Message (Optional)</label>
            <textarea
              placeholder="Enter any additional message for admin"
              value={bcShareForm.message}
              onChange={(e) => setBcShareForm({...bcShareForm, message: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0050]/20 focus:border-[#FF0050] focus:bg-white resize-none transition-all"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1 border-gray-200 rounded-xl py-3 hover:bg-gray-50" onClick={() => setShowBcShareModal(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-[#FF0050] to-[#00F2EA] hover:from-[#E60045] hover:to-[#00D9D1] rounded-xl py-3 shadow-md shadow-pink-500/25"
              disabled={!bcShareForm.bcId.trim()}
            >
              Submit Request
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
            <div className="p-4 bg-gradient-to-r from-[#FF0050]/5 to-[#00F2EA]/5 rounded-xl border border-[#FF0050]/20">
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
                    <span className="w-5 h-5 flex items-center justify-center bg-[#FF0050]/10 text-[#FF0050] rounded text-xs font-medium">{idx + 1}</span>
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
                  <span className="ml-2 text-xs font-normal text-[#FF0050]">(Unlimited)</span>
                ) : (
                  <span className="ml-2 text-xs font-normal text-gray-500">({selectedApplication.details.domains} domains)</span>
                )}
              </p>
              {selectedApplication.details.unlimitedDomain ? (
                <div className="p-3 bg-gradient-to-r from-[#FF0050]/10 to-[#FF0050]/5 rounded-lg">
                  <p className="text-sm text-[#FF0050] font-medium">Unlimited domains enabled</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedApplication.details.domainUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="w-5 h-5 flex items-center justify-center bg-[#00F2EA]/10 text-[#00F2EA] rounded text-xs font-medium">{idx + 1}</span>
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
                    <span className="text-sm font-mono text-[#FF0050] font-medium">{selectedApplication.details.appId}</span>
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
                      <span className="text-sm font-medium text-[#FF0050]">Account {idx + 1}</span>
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
      </div>
    </DashboardLayout>
  )
}
