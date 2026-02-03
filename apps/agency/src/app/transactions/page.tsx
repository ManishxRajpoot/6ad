'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { Loader2, Search, ChevronLeft, ChevronRight, Download, X, Eye, ChevronDown, Calendar, Wallet, CreditCard, FileText, Copy, ImageIcon } from 'lucide-react'
import { transactionsApi, applicationsApi, usersApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import * as XLSX from 'xlsx'

type Deposit = {
  id: string
  uniqueId?: string
  applyId?: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  paymentMethod?: string
  transactionId?: string
  paymentProof?: string
  createdAt: string
  user?: {
    id: string
    username: string
    email: string
    realName?: string
  }
}

type AccountDeposit = {
  id: string
  applyId?: string
  amount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks?: string
  adminRemarks?: string
  createdAt: string
  approvedAt?: string
  commissionRate?: number
  commissionAmount?: number
  adAccount?: {
    id: string
    accountId: string
    accountName: string
    platform: string
    user?: {
      id: string
      username: string
      email: string
      realName?: string
      uniqueId?: string
    }
  }
}

type Application = {
  id: string
  applyId: string
  platform: string
  licenseType: string
  licenseNo?: string
  adAccountQty: number
  depositAmount: number
  openingFee: number
  platformFee: number
  totalCost: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks?: string
  adminRemarks?: string
  createdAt: string
  approvedAt?: string
  user?: {
    id: string
    username: string
    email: string
    realName?: string
    uniqueId?: string
  }
}

type TabType = 'wallet' | 'adAccount' | 'adOpening'

export default function TransactionsPage() {
  const toast = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('wallet')
  const [loading, setLoading] = useState(true)

  // Tab refs for dynamic indicator positioning
  const walletTabRef = useRef<HTMLButtonElement>(null)
  const adAccountTabRef = useRef<HTMLButtonElement>(null)
  const adOpeningTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Wallet deposits state
  const [deposits, setDeposits] = useState<Deposit[]>([])

  // Ad account deposits state
  const [accountDeposits, setAccountDeposits] = useState<AccountDeposit[]>([])

  // Ad account applications state
  const [applications, setApplications] = useState<Application[]>([])

  // Common state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Dropdown states
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false)

  // Export popup state
  const [showExportPopup, setShowExportPopup] = useState(false)
  const [exportPlatform, setExportPlatform] = useState('all')
  const [exportStatus, setExportStatus] = useState('all')
  const [exportUserSearch, setExportUserSearch] = useState('')
  const [exportSelectedUsers, setExportSelectedUsers] = useState<string[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [exportDateFrom, setExportDateFrom] = useState<Date | null>(null)
  const [exportDateTo, setExportDateTo] = useState<Date | null>(null)
  const [showFromCalendar, setShowFromCalendar] = useState(false)
  const [showToCalendar, setShowToCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [exporting, setExporting] = useState(false)

  // All users for export filter
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; email: string }[]>([])

  // Stats
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0
  })

  // Memoize the indicator update function to prevent recreating it
  const updateIndicator = useCallback(() => {
    const activeRef = activeTab === 'wallet' ? walletTabRef : activeTab === 'adAccount' ? adAccountTabRef : adOpeningTabRef
    if (activeRef.current) {
      setIndicatorStyle({
        left: activeRef.current.offsetLeft,
        width: activeRef.current.offsetWidth,
      })
    }
  }, [activeTab])

  // Update indicator position when tab changes
  useEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  // Separate effect for resize listener - only attaches once
  useEffect(() => {
    const handleResize = () => {
      // Re-run indicator update on resize
      const activeRef = activeTab === 'wallet' ? walletTabRef : activeTab === 'adAccount' ? adAccountTabRef : adOpeningTabRef
      if (activeRef.current) {
        setIndicatorStyle({
          left: activeRef.current.offsetLeft,
          width: activeRef.current.offsetWidth,
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeTab])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowDateDropdown(false)
        setShowStatusDropdown(false)
        setShowPlatformDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Lock body scroll when popup is open
  useEffect(() => {
    if (showExportPopup || previewImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showExportPopup, previewImage])

  // Close export popup dropdowns when clicking outside
  useEffect(() => {
    const handleExportClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.user-dropdown-container')) {
        setShowUserDropdown(false)
      }
      if (!target.closest('.calendar-container')) {
        setShowFromCalendar(false)
        setShowToCalendar(false)
      }
    }
    if (showExportPopup) {
      document.addEventListener('mousedown', handleExportClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleExportClickOutside)
  }, [showExportPopup])

  const fetchDeposits = async () => {
    try {
      const response = await transactionsApi.deposits.getAll()
      setDeposits(response.deposits || [])
    } catch (error) {
      console.error('Failed to fetch deposits:', error)
    }
  }

  const fetchAccountDeposits = async () => {
    try {
      const response = await transactionsApi.accountDeposits.getAll()
      setAccountDeposits(response.deposits || [])
    } catch (error) {
      console.error('Failed to fetch account deposits:', error)
    }
  }

  const fetchApplications = async () => {
    try {
      const response = await applicationsApi.getAll()
      setApplications(response.applications || [])
    } catch (error) {
      console.error('Failed to fetch applications:', error)
    }
  }

  const fetchAllUsers = async () => {
    try {
      const res = await usersApi.getAll()
      setAllUsers(res.users || [])
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([fetchDeposits(), fetchAccountDeposits(), fetchApplications(), fetchAllUsers()])
      setLoading(false)
    }
    fetchData()
  }, [])

  // Calculate stats based on active tab data
  useEffect(() => {
    if (activeTab === 'wallet') {
      setStats({
        totalDeposits: deposits.length,
        totalApproved: deposits.filter(d => d.status === 'APPROVED').length,
        totalPending: deposits.filter(d => d.status === 'PENDING').length,
        totalRejected: deposits.filter(d => d.status === 'REJECTED').length
      })
    } else if (activeTab === 'adAccount') {
      setStats({
        totalDeposits: accountDeposits.length,
        totalApproved: accountDeposits.filter(d => d.status === 'APPROVED').length,
        totalPending: accountDeposits.filter(d => d.status === 'PENDING').length,
        totalRejected: accountDeposits.filter(d => d.status === 'REJECTED').length
      })
    } else {
      setStats({
        totalDeposits: applications.length,
        totalApproved: applications.filter(a => a.status === 'APPROVED').length,
        totalPending: applications.filter(a => a.status === 'PENDING').length,
        totalRejected: applications.filter(a => a.status === 'REJECTED').length
      })
    }
  }, [activeTab, deposits, accountDeposits, applications])

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, platformFilter, dateFilter])

  // Filter data based on search and filters
  const filterByDate = (dateString: string) => {
    if (dateFilter === 'all') return true
    const date = new Date(dateString)
    const now = new Date()
    if (dateFilter === 'today') {
      return date.toDateString() === now.toDateString()
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return date >= weekAgo
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return date >= monthAgo
    }
    return true
  }

  const filteredDeposits = deposits
    .filter((deposit) => {
      const query = searchQuery.toLowerCase().trim()
      if (!query) return true
      return (
        deposit.user?.username?.toLowerCase().includes(query) ||
        deposit.user?.email?.toLowerCase().includes(query) ||
        deposit.user?.realName?.toLowerCase().includes(query) ||
        deposit.uniqueId?.toLowerCase().includes(query) ||
        deposit.applyId?.toLowerCase().includes(query) ||
        deposit.transactionId?.toLowerCase().includes(query) ||
        deposit.amount.toString().includes(query) ||
        deposit.paymentMethod?.toLowerCase().includes(query)
      )
    })
    .filter(d => !statusFilter || d.status === statusFilter)
    .filter(d => filterByDate(d.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const filteredAccountDeposits = accountDeposits
    .filter((deposit) => {
      const query = searchQuery.toLowerCase().trim()
      if (!query) return true
      return (
        deposit.adAccount?.user?.username?.toLowerCase().includes(query) ||
        deposit.adAccount?.user?.email?.toLowerCase().includes(query) ||
        deposit.adAccount?.user?.realName?.toLowerCase().includes(query) ||
        deposit.adAccount?.accountId?.toLowerCase().includes(query) ||
        deposit.adAccount?.accountName?.toLowerCase().includes(query) ||
        deposit.applyId?.toLowerCase().includes(query) ||
        deposit.amount.toString().includes(query)
      )
    })
    .filter(d => !statusFilter || d.status === statusFilter)
    .filter(d => platformFilter === 'all' || d.adAccount?.platform?.toUpperCase() === platformFilter)
    .filter(d => filterByDate(d.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const filteredApplications = applications
    .filter((app) => {
      const query = searchQuery.toLowerCase().trim()
      if (!query) return true
      return (
        app.user?.username?.toLowerCase().includes(query) ||
        app.user?.email?.toLowerCase().includes(query) ||
        app.user?.realName?.toLowerCase().includes(query) ||
        app.applyId?.toLowerCase().includes(query) ||
        app.licenseNo?.toLowerCase().includes(query) ||
        app.platform?.toLowerCase().includes(query)
      )
    })
    .filter(a => !statusFilter || a.status === statusFilter)
    .filter(a => platformFilter === 'all' || a.platform?.toUpperCase() === platformFilter)
    .filter(a => filterByDate(a.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Pagination
  const getCurrentData = () => {
    if (activeTab === 'wallet') return filteredDeposits
    if (activeTab === 'adAccount') return filteredAccountDeposits
    return filteredApplications
  }

  const currentData = getCurrentData()
  const totalPages = Math.ceil(currentData.length / itemsPerPage)
  const paginatedData = currentData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount && amount !== 0) return '---'
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toUpperCase()
    switch (normalizedStatus) {
      case 'APPROVED':
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#52B788] text-white">Approved</span>
      case 'PENDING':
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#F59E0B] text-white">Pending</span>
      case 'REJECTED':
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#EF4444] text-white">Rejected</span>
      default:
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const getPlatformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      FACEBOOK: 'bg-blue-100 text-blue-700',
      GOOGLE: 'bg-red-100 text-red-700',
      TIKTOK: 'bg-gray-900 text-white',
      SNAPCHAT: 'bg-yellow-100 text-yellow-700',
      BING: 'bg-cyan-100 text-cyan-700',
    }
    return (
      <span className={`px-3 py-1 rounded-lg text-xs font-medium ${colors[platform?.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}>
        {platform}
      </span>
    )
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  // Export helpers
  const filteredUsers = allUsers.filter(user =>
    user.username?.toLowerCase().includes(exportUserSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(exportUserSearch.toLowerCase())
  )

  const toggleUserSelection = (userId: string) => {
    setExportSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(u => u !== userId)
        : [...prev, userId]
    )
  }

  const removeSelectedUser = (userId: string) => {
    setExportSelectedUsers(prev => prev.filter(u => u !== userId))
  }

  const getUserById = (userId: string) => {
    return allUsers.find(u => u.id === userId)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    return { daysInMonth, startingDay }
  }

  const formatCalendarDate = (date: Date | null) => {
    if (!date) return ''
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  const handleExport = async () => {
    try {
      setExporting(true)

      let dataToExport: any[] = []

      if (activeTab === 'wallet') {
        dataToExport = filteredDeposits
      } else if (activeTab === 'adAccount') {
        dataToExport = filteredAccountDeposits
      } else {
        dataToExport = filteredApplications
      }

      // Apply export filters
      if (exportStatus !== 'all') {
        dataToExport = dataToExport.filter((item: any) => item.status === exportStatus)
      }
      if (exportPlatform !== 'all' && activeTab !== 'wallet') {
        dataToExport = dataToExport.filter((item: any) => {
          const platform = activeTab === 'adAccount' ? item.adAccount?.platform : item.platform
          return platform?.toUpperCase() === exportPlatform
        })
      }
      if (exportSelectedUsers.length > 0) {
        dataToExport = dataToExport.filter((item: any) => {
          const userId = activeTab === 'adAccount' ? item.adAccount?.user?.id : item.user?.id
          return exportSelectedUsers.includes(userId)
        })
      }
      if (exportDateFrom) {
        dataToExport = dataToExport.filter((item: any) => new Date(item.createdAt) >= exportDateFrom)
      }
      if (exportDateTo) {
        const endDate = new Date(exportDateTo)
        endDate.setHours(23, 59, 59, 999)
        dataToExport = dataToExport.filter((item: any) => new Date(item.createdAt) <= endDate)
      }

      // Prepare Excel data
      const excelData = dataToExport.map((item: any) => {
        if (activeTab === 'wallet') {
          return {
            'Apply ID': item.applyId || '',
            'User': item.user?.username || '',
            'Email': item.user?.email || '',
            'Amount': item.amount || 0,
            'Payment Method': item.paymentMethod || '',
            'Transaction ID': item.transactionId || '',
            'Status': item.status || '',
            'Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
          }
        } else if (activeTab === 'adAccount') {
          return {
            'Apply ID': item.applyId || '',
            'User': item.adAccount?.user?.username || '',
            'Email': item.adAccount?.user?.email || '',
            'Account Name': item.adAccount?.accountName || '',
            'Account ID': item.adAccount?.accountId || '',
            'Platform': item.adAccount?.platform || '',
            'Amount': item.amount || 0,
            'Commission': item.commissionAmount || 0,
            'Commission Rate': item.commissionRate ? `${item.commissionRate}%` : '',
            'Status': item.status || '',
            'Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
          }
        } else {
          return {
            'Apply ID': item.applyId || '',
            'User': item.user?.username || '',
            'Email': item.user?.email || '',
            'Platform': item.platform || '',
            'Ad Account Qty': item.adAccountQty || 0,
            'Opening Fee': item.openingFee || 0,
            'Deposit Amount': item.depositAmount || 0,
            'Total Cost': item.totalCost || 0,
            'Status': item.status || '',
            'Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
          }
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }))
      ws['!cols'] = colWidths

      const sheetName = activeTab === 'wallet' ? 'Wallet Deposits' : activeTab === 'adAccount' ? 'Ad Account Recharges' : 'Ad Account Applications'
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `transactions_${activeTab}_${dateStr}.xlsx`
      XLSX.writeFile(wb, filename)

      setShowExportPopup(false)
      setExportPlatform('all')
      setExportStatus('all')
      setExportSelectedUsers([])
      setExportDateFrom(null)
      setExportDateTo(null)
      setExportUserSearch('')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const getTabLabel = () => {
    if (activeTab === 'wallet') return 'Total Deposits'
    if (activeTab === 'adAccount') return 'Total Recharges'
    return 'Total Applications'
  }

  return (
    <DashboardLayout title="Transactions" subtitle="">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Fixed Top Section */}
        <div className="flex-shrink-0 bg-[#F6F6F6] pb-3 lg:pb-4">
          {/* Top Actions Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-0 mb-4 lg:mb-6">
            <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px] lg:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, ID, amount..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 lg:py-2.5 border border-gray-200 rounded-lg text-sm w-full lg:w-[250px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent bg-white"
                />
              </div>

              {/* Date Filter */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => { setShowDateDropdown(!showDateDropdown); setShowStatusDropdown(false); setShowPlatformDropdown(false) }}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5 border border-gray-200 rounded-lg text-xs lg:text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[100px] lg:min-w-[150px] justify-between bg-white"
                >
                  <span>{dateFilter === 'all' ? 'All Time' : dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`} />
                </button>
                <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                  showDateDropdown ? 'opacity-100 scale-y-100 translate-y-0 visible' : 'opacity-0 scale-y-95 -translate-y-1 invisible'
                }`}>
                  {[
                    { value: 'all', label: 'All Time' },
                    { value: 'today', label: 'Today' },
                    { value: 'week', label: 'This Week' },
                    { value: 'month', label: 'This Month' },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => { setDateFilter(option.value); setShowDateDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${dateFilter === option.value ? 'text-[#7C3AED] bg-[#7C3AED]/5 font-medium' : 'text-gray-600'}`}
                      style={{ transitionDelay: showDateDropdown ? `${index * 30}ms` : '0ms' }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowDateDropdown(false); setShowPlatformDropdown(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white"
                >
                  <span>{!statusFilter ? 'All Status' : statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'PENDING' ? 'Pending' : 'Rejected'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
                </button>
                <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                  showStatusDropdown ? 'opacity-100 scale-y-100 translate-y-0 visible' : 'opacity-0 scale-y-95 -translate-y-1 invisible'
                }`}>
                  {[
                    { value: '', label: 'All Status' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => { setStatusFilter(option.value); setShowStatusDropdown(false) }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${statusFilter === option.value ? 'text-[#7C3AED] bg-[#7C3AED]/5 font-medium' : 'text-gray-600'}`}
                      style={{ transitionDelay: showStatusDropdown ? `${index * 30}ms` : '0ms' }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Filter (only for ad account and opening tabs) */}
              {activeTab !== 'wallet' && (
                <div className="relative dropdown-container">
                  <button
                    onClick={() => { setShowPlatformDropdown(!showPlatformDropdown); setShowDateDropdown(false); setShowStatusDropdown(false) }}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[140px] justify-between bg-white"
                  >
                    <span>{platformFilter === 'all' ? 'All Platforms' : platformFilter}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showPlatformDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                    showPlatformDropdown ? 'opacity-100 scale-y-100 translate-y-0 visible' : 'opacity-0 scale-y-95 -translate-y-1 invisible'
                  }`}>
                    {[
                      { value: 'all', label: 'All Platforms' },
                      { value: 'FACEBOOK', label: 'Facebook' },
                      { value: 'GOOGLE', label: 'Google' },
                      { value: 'TIKTOK', label: 'TikTok' },
                      { value: 'SNAPCHAT', label: 'Snapchat' },
                      { value: 'BING', label: 'Bing' },
                    ].map((option, index) => (
                      <button
                        key={option.value}
                        onClick={() => { setPlatformFilter(option.value); setShowPlatformDropdown(false) }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${platformFilter === option.value ? 'text-[#7C3AED] bg-[#7C3AED]/5 font-medium' : 'text-gray-600'}`}
                        style={{ transitionDelay: showPlatformDropdown ? `${index * 30}ms` : '0ms' }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export Button */}
            <button
              onClick={() => setShowExportPopup(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#52B788] text-[#52B788] rounded-lg text-sm font-medium hover:bg-[#52B788]/5 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-4 lg:mb-6">
            {/* Total - Purple */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">{getTabLabel()}</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalDeposits.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-xs font-medium rounded">Total</span>
              </div>
              <StatsChart value={stats.totalDeposits} color="#7C3AED" filterId="glowPurpleTx" gradientId="fadePurpleTx" clipId="clipPurpleTx" />
            </Card>

            {/* Approved - Green */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Approved</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalApproved.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#52B788] text-white text-xs font-medium rounded">Approved</span>
              </div>
              <StatsChart value={stats.totalApproved} color="#52B788" filterId="glowGreenTx" gradientId="fadeGreenTx" clipId="clipGreenTx" />
            </Card>

            {/* Pending - Orange */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Pending</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalPending.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-xs font-medium rounded">Pending</span>
              </div>
              <StatsChart value={stats.totalPending} color="#F59E0B" filterId="glowOrangeTx" gradientId="fadeOrangeTx" clipId="clipOrangeTx" />
            </Card>

            {/* Rejected - Red */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Rejected</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalRejected.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#EF4444] text-white text-xs font-medium rounded">Rejected</span>
              </div>
              <StatsChart value={stats.totalRejected} color="#EF4444" filterId="glowRedTx" gradientId="fadeRedTx" clipId="clipRedTx" />
            </Card>
          </div>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100">
            <div className="flex relative">
              <button
                ref={walletTabRef}
                onClick={() => { setActiveTab('wallet'); setCurrentPage(1); setPlatformFilter('all') }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'wallet' ? 'text-[#7C3AED]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Wallet Deposits
              </button>
              <button
                ref={adAccountTabRef}
                onClick={() => { setActiveTab('adAccount'); setCurrentPage(1) }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'adAccount' ? 'text-[#7C3AED]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Ad Account Recharge
              </button>
              <button
                ref={adOpeningTabRef}
                onClick={() => { setActiveTab('adOpening'); setCurrentPage(1) }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'adOpening' ? 'text-[#7C3AED]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Ad Account Opening
              </button>
              <div
                className="absolute bottom-0 h-0.5 bg-[#7C3AED] transition-all duration-300 ease-out"
                style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
              />
            </div>
          </div>

          {/* Table - Scrollable area */}
          <div className="overflow-auto flex-1 min-h-0" key={activeTab}>
            <table className="w-full animate-tabFadeIn">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Apply ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">User</th>
                  {activeTab === 'wallet' && (
                    <>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Payment Method</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Transaction ID</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Proof</th>
                    </>
                  )}
                  {activeTab === 'adAccount' && (
                    <>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Ad Account</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Platform</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Commission</th>
                    </>
                  )}
                  {activeTab === 'adOpening' && (
                    <>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Platform</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Qty</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Opening Fee</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Total Cost</th>
                    </>
                  )}
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mb-2" />
                        <span className="text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      {searchQuery ? 'No matching records found' : 'No records found'}
                    </td>
                  </tr>
                ) : activeTab === 'wallet' ? (
                  (paginatedData as Deposit[]).map((deposit, index) => (
                    <tr key={deposit.id} className="border-b border-gray-50 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${index * 50}ms` }}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded font-semibold">{deposit.applyId || '---'}</code>
                          {deposit.applyId && (
                            <button onClick={() => copyToClipboard(deposit.applyId || '')} className="p-1 rounded text-gray-400 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{deposit.user?.username || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{deposit.user?.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm font-semibold text-[#52B788]">{formatCurrency(deposit.amount)}</td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium">{deposit.paymentMethod || 'N/A'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                            {deposit.transactionId ? `${deposit.transactionId.slice(0, 8)}...` : '---'}
                          </code>
                          {deposit.transactionId && (
                            <button onClick={() => copyToClipboard(deposit.transactionId || '')} className="p-1 rounded text-gray-400 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center">
                          {deposit.paymentProof ? (
                            <button
                              onClick={() => setPreviewImage(deposit.paymentProof || null)}
                              className="w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#7C3AED] transition-all"
                            >
                              <img src={deposit.paymentProof} alt="Proof" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">No image</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(deposit.status)}</td>
                      <td className="py-4 px-4 text-sm text-gray-500">{formatDate(deposit.createdAt)}</td>
                    </tr>
                  ))
                ) : activeTab === 'adAccount' ? (
                  (paginatedData as AccountDeposit[]).map((deposit, index) => (
                    <tr key={deposit.id} className="border-b border-gray-50 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${index * 50}ms` }}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded font-semibold">{deposit.applyId || '---'}</code>
                          {deposit.applyId && (
                            <button onClick={() => copyToClipboard(deposit.applyId || '')} className="p-1 rounded text-gray-400 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{deposit.adAccount?.user?.username || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{deposit.adAccount?.user?.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{deposit.adAccount?.accountName || '---'}</p>
                          <p className="text-xs text-gray-500 font-mono">{deposit.adAccount?.accountId || '---'}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getPlatformBadge(deposit.adAccount?.platform || '')}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-[#52B788]">{formatCurrency(deposit.amount)}</td>
                      <td className="py-4 px-4">
                        <div>
                          <span className="text-sm font-semibold text-orange-600">{formatCurrency(deposit.commissionAmount)}</span>
                          <span className="text-xs text-gray-500 ml-1">({deposit.commissionRate || 0}%)</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(deposit.status)}</td>
                      <td className="py-4 px-4 text-sm text-gray-500">{formatDate(deposit.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  (paginatedData as Application[]).map((app, index) => (
                    <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50/50 tab-row-animate" style={{ animationDelay: `${index * 50}ms` }}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded font-semibold">{app.applyId}</code>
                          <button onClick={() => copyToClipboard(app.applyId)} className="p-1 rounded text-gray-400 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{app.user?.username || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{app.user?.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getPlatformBadge(app.platform)}</td>
                      <td className="py-4 px-4">
                        <div className="flex justify-center">
                          <span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center">{app.adAccountQty}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm font-semibold text-[#7C3AED]">{formatCurrency(app.openingFee)}</td>
                      <td className="py-4 px-4 text-sm font-semibold text-orange-600">{formatCurrency(app.totalCost)}</td>
                      <td className="py-4 px-4">{getStatusBadge(app.status)}</td>
                      <td className="py-4 px-4 text-sm text-gray-500">{formatDate(app.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-t border-gray-100 bg-white">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {totalPages <= 7 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ? 'bg-[#7C3AED] text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))
              ) : (
                <>
                  {[1, 2, 3].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page ? 'bg-[#7C3AED] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
                  {[totalPages - 2, totalPages - 1, totalPages].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page ? 'bg-[#7C3AED] text-white' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative max-w-3xl w-full max-h-[90vh]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-2xl overflow-hidden bg-white">
              <img src={previewImage} alt="Payment Proof" className="w-full h-auto max-h-[80vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Export Popup Modal */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 transition-all duration-300 ease-out ${
          showExportPopup ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
        onClick={() => setShowExportPopup(false)}
      />
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 transition-all duration-300 ease-out ${
          showExportPopup ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-2xl p-6 max-w-md w-[calc(100vw-2rem)] relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowExportPopup(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-bold text-gray-800 mb-1">Export Data</h3>
          <p className="text-sm text-gray-500 mb-6">Select filters to export specific data</p>

          <div className="space-y-4">
            {/* Platform Selection (only for non-wallet tabs) */}
            {activeTab !== 'wallet' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'FACEBOOK', label: 'Meta' },
                    { value: 'GOOGLE', label: 'Google' },
                    { value: 'TIKTOK', label: 'TikTok' },
                    { value: 'SNAPCHAT', label: 'Snapchat' },
                    { value: 'BING', label: 'Bing' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setExportPlatform(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        exportPlatform === option.value ? 'bg-[#7C3AED] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Status Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'REJECTED', label: 'Rejected' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setExportStatus(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportStatus === option.value ? 'bg-[#7C3AED] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Filter */}
            <div className="relative user-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">User (Optional)</label>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`w-full flex items-center justify-between px-4 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                  showUserDropdown ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={exportSelectedUsers.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
                  {exportSelectedUsers.length > 0 ? `${exportSelectedUsers.length} user${exportSelectedUsers.length > 1 ? 's' : ''} selected` : 'Select Users'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute top-full left-0 right-0 mt-2 bg-white border-2 border-[#7C3AED]/20 rounded-xl shadow-xl z-50 transition-all duration-200 overflow-hidden ${
                showUserDropdown ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2 pointer-events-none'
              }`}>
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={exportUserSearch}
                      onChange={(e) => setExportUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-[#7C3AED]/30 rounded-xl text-sm focus:outline-none focus:border-[#7C3AED]"
                    />
                  </div>
                </div>
                {exportSelectedUsers.length > 0 && (
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap gap-1.5">
                      {exportSelectedUsers.map(userId => {
                        const user = getUserById(userId)
                        return (
                          <span key={userId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#7C3AED] text-white text-xs font-medium rounded-lg">
                            {user?.username || userId}
                            <button onClick={() => removeSelectedUser(userId)} className="hover:bg-white/20 rounded"><X className="w-3 h-3" /></button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                          exportSelectedUsers.includes(user.id) ? 'bg-[#7C3AED]/5' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-gray-700 font-medium">{user.username}</span>
                          <span className="text-gray-400 text-xs">{user.email}</span>
                        </div>
                        {exportSelectedUsers.includes(user.id) && (
                          <div className="w-5 h-5 bg-[#7C3AED] rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No users found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="relative calendar-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowFromCalendar(!showFromCalendar); setShowToCalendar(false); setCalendarMonth(exportDateFrom || new Date()) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                    showFromCalendar ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className={exportDateFrom ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateFrom ? formatCalendarDate(exportDateFrom) : 'From date'}
                  </span>
                </button>
                <button
                  onClick={() => { setShowToCalendar(!showToCalendar); setShowFromCalendar(false); setCalendarMonth(exportDateTo || new Date()) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                    showToCalendar ? 'border-[#7C3AED] ring-2 ring-[#7C3AED]/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className={exportDateTo ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateTo ? formatCalendarDate(exportDateTo) : 'To date'}
                  </span>
                </button>
              </div>

              {(showFromCalendar || showToCalendar) && (
                <div className="mt-2 bg-white border-2 border-[#7C3AED]/20 rounded-xl shadow-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <span className="text-sm font-semibold text-gray-800">{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  <div className="text-center mb-3">
                    <span className="text-xs text-[#7C3AED] font-medium bg-[#7C3AED]/10 px-3 py-1 rounded-full">
                      {showFromCalendar ? 'Select start date' : 'Select end date'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const { daysInMonth, startingDay } = getDaysInMonth(calendarMonth)
                      const days = []
                      for (let i = 0; i < startingDay; i++) {
                        days.push(<div key={`empty-${i}`} className="py-2" />)
                      }
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
                        const isSelectedFrom = exportDateFrom && date.toDateString() === exportDateFrom.toDateString()
                        const isSelectedTo = exportDateTo && date.toDateString() === exportDateTo.toDateString()
                        const isToday = date.toDateString() === new Date().toDateString()
                        days.push(
                          <button
                            key={day}
                            onClick={() => {
                              if (showFromCalendar) { setExportDateFrom(date); setShowFromCalendar(false) }
                              else { setExportDateTo(date); setShowToCalendar(false) }
                            }}
                            className={`py-2 text-sm rounded-lg transition-colors ${
                              isSelectedFrom || isSelectedTo ? 'bg-[#7C3AED] text-white font-medium' : isToday ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      }
                      return days
                    })()}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (showFromCalendar) setExportDateFrom(null)
                        else setExportDateTo(null)
                        setShowFromCalendar(false)
                        setShowToCalendar(false)
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowExportPopup(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 px-4 py-2.5 bg-[#52B788] text-white rounded-lg text-sm font-medium hover:bg-[#3d9970] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Exporting...</> : <><Download className="w-4 h-4" />Export</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
