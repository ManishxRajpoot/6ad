'use client'

import { useState, useEffect } from 'react'
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
import { authApi, accountsApi, transactionsApi, accountDepositsApi } from '@/lib/api'

// Stats data
const statsData = [
  { label: 'Pending Applications', value: '06', trend: 'up', badge: 'Growth 10x' },
  { label: 'Pending Deposits', value: '29', trend: 'up', badge: 'Growth 10x' },
  { label: 'Pending Shares', value: '250', trend: 'up', badge: 'Growth 10x' },
  { label: 'Pending Refunds', value: '25', trend: 'down', badge: 'Decrease 10x' },
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

// Bing brand colors
const brandColor = '#00809D'
const brandColorDark = '#006B83'
const brandGradient = 'from-[#00809D] to-[#006B83]'

export default function BingPage() {
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('apply-ads-account')
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['account-manage', 'deposit-manage', 'after-sale'])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // User state from API
  const [user, setUser] = useState<any>(null)
  const [userAccounts, setUserAccounts] = useState<any[]>([])
  const [userRefunds, setUserRefunds] = useState<any[]>([])
  const [userDeposits, setUserDeposits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch user data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [userRes, accountsRes, refundsRes, depositsRes] = await Promise.all([
          authApi.me().catch(() => ({ user: null })),
          accountsApi.getAll('BING').catch(() => ({ accounts: [] })),
          transactionsApi.refunds.getAll('BING').catch(() => ({ refunds: [] })),
          accountDepositsApi.getAll('BING').catch(() => ({ deposits: [] }))
        ])
        setUser(userRes.user)
        setUserAccounts(accountsRes.accounts || [])
        setUserRefunds(refundsRes.refunds || [])
        setUserDeposits(depositsRes.deposits || [])
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Get user's Bing commission rate from API (fallback to 5% if not set)
  const bingCommissionRate = user?.bingCommission ? parseFloat(user.bingCommission) : 5

  // User wallet balance from API
  const userBalance = user?.balance ? parseFloat(user.balance) : 0

  // Modal states
  const [showBmShareModal, setShowBmShareModal] = useState(false)

  // Form states
  const [applyAdsForm, setApplyAdsForm] = useState({
    licenseNo: '',
    pageNumber: '',
    pageUrl: '',
    domainName: '',
    isApp: 'no',
    domain: 'Https:///ads.microsoft.com',
    hasShopify: 'no',
    adNumber: '',
    adsAccount: 'Https:///ads.microsoft.com',
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
      icon: '📋',
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
      icon: '💰',
      items: [
        { id: 'deposit' as SubPage, label: 'Deposit' },
        { id: 'deposit-report' as SubPage, label: 'Deposit Report' },
      ]
    },
    {
      section: 'after-sale' as MenuSection,
      title: 'After Sale',
      icon: '🔄',
      items: [
        { id: 'transfer-balance' as SubPage, label: 'Transfer Balance' },
        { id: 'refund' as SubPage, label: 'Refund' },
        { id: 'refund-report' as SubPage, label: 'Refund Report' },
      ]
    }
  ]

  return (
    <DashboardLayout title="Bing User Management Account" subtitle="">
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 128, 157, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(0, 128, 157, 0.2); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.3s ease-out forwards; }
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
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(0, 128, 157, 0.15); }
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
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#00809D]/40 focus:border-[#00809D] focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <select className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 focus:outline-none">
          <option>Date and Time</option>
          <option>Today</option>
          <option>This Week</option>
        </select>
        <select className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600 focus:outline-none">
          <option>Action</option>
          <option>Approve</option>
          <option>Pending</option>
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons */}
        <Button variant="outline" className="border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 whitespace-nowrap text-xs px-3 py-1.5 h-auto">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export Image
        </Button>
        <Button className="bg-gradient-to-r from-[#00809D] to-[#006B83] hover:from-[#006B83] hover:to-[#005A6F] text-white rounded-md shadow-sm whitespace-nowrap text-xs px-3 py-1.5 h-auto font-semibold">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ads Account
        </Button>
      </div>

      {/* Row 2: Stats Cards - Compact */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {statsData.map((stat, index) => (
          <Card key={index} className="stat-card p-3 border border-gray-100/50 bg-gradient-to-br from-white to-gray-50/30 relative overflow-hidden">
            {/* Decorative accent */}
            <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-br from-[#00809D]/20 to-transparent rounded-bl-full" />

            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{stat.label}</p>
                <p className="text-xl font-bold text-gray-800">{stat.value}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                stat.trend === 'up'
                  ? 'bg-[#52B788] text-white'
                  : 'bg-[#EF4444] text-white'
              }`}>
                {stat.badge}
              </span>
            </div>
            {/* Mini wave chart */}
            <div className="mt-2 h-8 relative z-10">
              <svg viewBox="0 0 120 40" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`gradient-bing-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={stat.trend === 'up' ? '#00809D' : '#EF4444'} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={stat.trend === 'up' ? '#00809D' : '#EF4444'} stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <path
                  d={stat.trend === 'up'
                    ? "M0,30 C10,28 20,25 30,22 C40,19 50,18 60,16 C70,14 80,12 90,10 C100,8 110,6 120,5"
                    : "M0,10 C10,12 20,15 30,18 C40,21 50,22 60,24 C70,26 80,28 90,30 C100,32 110,34 120,35"}
                  fill="none"
                  stroke={stat.trend === 'up' ? '#006B83' : '#EF4444'}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d={stat.trend === 'up'
                    ? "M0,30 C10,28 20,25 30,22 C40,19 50,18 60,16 C70,14 80,12 90,10 C100,8 110,6 120,5 L120,40 L0,40 Z"
                    : "M0,10 C10,12 20,15 30,18 C40,21 50,22 60,24 C70,26 80,28 90,30 C100,32 110,34 120,35 L120,40 L0,40 Z"}
                  fill={`url(#gradient-bing-${index})`}
                />
              </svg>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 3: Main Content - Sidebar + Form */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 flex-shrink-0">
          <Card className="p-4 h-full border border-gray-100/50 bg-gradient-to-b from-white to-gray-50/50 relative overflow-hidden">
            {/* Decorative gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00809D]/5 via-transparent to-[#52B788]/5" />

            {/* Bing Logo */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#26B8F4] to-[#1B48EF] flex items-center justify-center shadow-md shadow-blue-500/20">
                  <svg viewBox="0 0 29700 21000" className="w-7 h-7" fill="white">
                    <polygon points="8475.16,1399.66 12124.09,2685.03 12136.1,15485.22 17223.25,12520.22 14741.02,11358.99 13148.22,7402.88 21223.77,10231.3 21217.16,14376.26 12123.05,19614.59 8487.02,17591.25"/>
                  </svg>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100">
                  <div className="w-4 h-4 bg-[#52B788] rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-gray-500">Ad Management</p>
            </div>

            {/* Navigation Menu */}
            <div className="relative z-10 space-y-2">
              {menuItems.map((menu) => (
                <div key={menu.section}>
                  <button
                    onClick={() => toggleSection(menu.section)}
                    className="w-full flex items-center justify-between px-2 py-2 text-sm font-semibold text-gray-700 hover:bg-[#00809D]/10 rounded-lg transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span>{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    {expandedSections.includes(menu.section) ? (
                      <ChevronUp className="w-4 h-4 text-[#006B83]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {expandedSections.includes(menu.section) && (
                    <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-[#00809D]/30 pl-3">
                      {menu.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setActiveSubPage(item.id)}
                          className={`w-full text-left px-2 py-1.5 text-sm rounded transition-all ${
                            activeSubPage === item.id
                              ? 'bg-gradient-to-r from-[#00809D] to-[#006B83] text-white font-semibold shadow-sm'
                              : 'text-gray-600 hover:bg-[#00809D]/10 hover:text-gray-800'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
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
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00809D]/30 focus:border-[#00809D] focus:bg-white transition-all"
                    />
                  </div>

                  {/* Checkbox */}
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" id="shareProfile" className="w-4 h-4 rounded border-gray-300 text-[#00809D] focus:ring-[#00809D]" />
                    <label htmlFor="shareProfile" className="text-sm text-gray-600">
                      Please make sure you have already shared your page with this profile
                    </label>
                  </div>

                  {/* URL Box */}
                  <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#00809D]/10 to-[#52B788]/5 border border-[#00809D]/30 rounded-lg">
                    <span className="text-sm text-gray-700 font-medium">Https:///ads.microsoft.com</span>
                    <button
                      onClick={() => copyToClipboard('Https:///ads.microsoft.com', 1)}
                      className="p-1.5 hover:bg-white/80 rounded transition-colors"
                    >
                      {copiedId === 1 ? <Check className="w-4 h-4 text-[#52B788]" /> : <Copy className="w-4 h-4 text-[#006B83]" />}
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
                            ? 'bg-[#00809D] text-white shadow-sm shadow-teal-500/25 font-semibold'
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
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#52B788]/5 to-[#00809D]/10 border border-[#52B788]/20 rounded-lg">
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
                            ? 'bg-[#00809D] text-white shadow-sm shadow-teal-500/25 font-semibold'
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
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#52B788]/5 to-[#00809D]/10 border border-[#52B788]/20 rounded-lg">
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
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00809D]/30 focus:border-[#00809D] focus:bg-white transition-all"
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
                  <div className="p-3 bg-gradient-to-r from-[#00809D]/15 to-[#52B788]/10 border border-[#00809D]/30 rounded-lg">
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
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00809D]/30 focus:border-[#00809D] focus:bg-white resize-none transition-all"
                    />
                  </div>

                  {/* Privacy Policy */}
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" id="privacyPolicy" className="w-4 h-4 rounded border-gray-300 text-[#00809D] focus:ring-[#00809D]" />
                    <label htmlFor="privacyPolicy" className="text-sm text-gray-600">
                      You agree to our friendly <span className="text-gray-800 underline cursor-pointer hover:text-black font-medium">privacy policy</span>.
                    </label>
                  </div>

                  {/* Summary Cards */}
                  <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-gradient-to-br from-white to-[#00809D]/10 border border-[#00809D]/30 rounded-lg text-center">
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
                  <Button className="w-full bg-gradient-to-r from-[#00809D] to-[#006B83] hover:from-[#006B83] hover:to-[#005A6F] text-white rounded-lg py-3 text-base font-bold shadow-lg shadow-teal-500/30 transition-all hover:shadow-xl hover:shadow-teal-500/40">
                    Pay and Submit
                  </Button>
                </div>
              )}

              {/* Account List Table */}
              {activeSubPage === 'account-list' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-[#00809D]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">License</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Operate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {accountListData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#00809D]/5 transition-all duration-300" style={{ opacity: 0 }}>
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
                    <tr className="bg-gradient-to-r from-[#00809D]/10 to-gray-50">
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
                      <tr key={item.id} className="table-row-animate hover:bg-[#00809D]/5 transition-all duration-300" style={{ opacity: 0 }}>
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
                    <tr className="bg-gradient-to-r from-[#00809D]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account Name</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Ads Account ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bmShareLogData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#00809D]/5 transition-all duration-300" style={{ opacity: 0 }}>
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
                    <tr className="bg-gradient-to-r from-[#00809D]/10 to-gray-50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-700 uppercase tracking-wider">Transaction ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {depositReportData.map((item) => (
                      <tr key={item.id} className="table-row-animate hover:bg-[#00809D]/5 transition-all duration-300" style={{ opacity: 0 }}>
                        <td className="py-4 px-5">
                          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00809D]/20 to-[#00809D]/10 flex items-center justify-center text-sm font-semibold text-gray-800">
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
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#00809D]/20 to-[#52B788]/10 flex items-center justify-center">
                    <span className="text-3xl">🚧</span>
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#00809D]/10 hover:border-[#00809D]/40 hover:text-gray-800 transition-all"
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
                        ? 'bg-gradient-to-r from-[#00809D] to-[#006B83] text-white font-semibold shadow-sm'
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#00809D]/15 hover:text-gray-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#00809D]/10 hover:border-[#00809D]/40 hover:text-gray-800 transition-all"
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00809D]/30 focus:border-[#00809D] focus:bg-white transition-all"
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00809D]/30 focus:border-[#00809D] focus:bg-white resize-none transition-all"
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
            <Button className="flex-1 bg-gradient-to-r from-[#00809D] to-[#006B83] hover:from-[#006B83] hover:to-[#005A6F] text-white font-semibold rounded-xl py-3 shadow-md shadow-teal-500/25">
              Submit
            </Button>
          </div>
        </div>
      </Modal>
      </div>
    </DashboardLayout>
  )
}
