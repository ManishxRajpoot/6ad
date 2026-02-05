'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { Loader2, Search, ChevronLeft, ChevronRight, Download, X, Eye, ChevronDown, Calendar, Wallet, CreditCard, FileText, Copy, ImageIcon, CheckCircle, XCircle, Clock } from 'lucide-react'
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
  const [itemsPerPage, setItemsPerPage] = useState(25)
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
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (normalizedStatus) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
          <CheckCircle className="w-3 h-3" /> Approved
        </span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}>
          <Clock className="w-3 h-3" /> Pending
        </span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
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
      <span className={`px-1.5 py-0.5 rounded text-[8px] xl:text-[9px] font-medium ${colors[platform?.toUpperCase()] || 'bg-gray-100 text-gray-700'}`}>
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
      <div className="space-y-3">
        {/* Top Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] lg:flex-none group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-[#0D9488]" />
              <input
                type="text"
                placeholder="Search users, ID, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[220px] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] bg-white transition-all"
              />
            </div>

            {/* Date Filter */}
            <div className="relative dropdown-container">
              <button
                onClick={() => { setShowDateDropdown(!showDateDropdown); setShowStatusDropdown(false); setShowPlatformDropdown(false) }}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[120px] justify-between bg-white"
              >
                <span>{dateFilter === 'all' ? 'All Time' : dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`} />
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
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${dateFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
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
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[110px] justify-between bg-white"
              >
                <span>{!statusFilter ? 'All Status' : statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'PENDING' ? 'Pending' : 'Rejected'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
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
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${statusFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
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
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white"
                >
                  <span>{platformFilter === 'all' ? 'All Platforms' : platformFilter}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showPlatformDropdown ? 'rotate-180' : ''}`} />
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
                      className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${platformFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
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
            className="flex items-center gap-2 px-4 py-2 border border-[#52B788] text-[#52B788] rounded-lg text-[12px] font-medium hover:bg-[#52B788]/5 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total - Purple */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">{getTabLabel()}</span>
                <p className="text-xl font-bold text-gray-800">{stats.totalDeposits.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#0D9488] text-white text-[10px] font-medium rounded">Total</span>
            </div>
            <StatsChart value={stats.totalDeposits} color="#0D9488" filterId="glowPurpleTx" gradientId="fadePurpleTx" clipId="clipPurpleTx" />
          </Card>

          {/* Approved - Green */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Approved</span>
                <p className="text-xl font-bold text-gray-800">{stats.totalApproved.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#52B788] text-white text-[10px] font-medium rounded">Approved</span>
            </div>
            <StatsChart value={stats.totalApproved} color="#52B788" filterId="glowGreenTx" gradientId="fadeGreenTx" clipId="clipGreenTx" />
          </Card>

          {/* Pending - Orange */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Pending</span>
                <p className="text-xl font-bold text-gray-800">{stats.totalPending.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded">Pending</span>
            </div>
            <StatsChart value={stats.totalPending} color="#F59E0B" filterId="glowOrangeTx" gradientId="fadeOrangeTx" clipId="clipOrangeTx" />
          </Card>

          {/* Rejected - Red */}
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Rejected</span>
                <p className="text-xl font-bold text-gray-800">{stats.totalRejected.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-medium rounded">Rejected</span>
            </div>
            <StatsChart value={stats.totalRejected} color="#EF4444" filterId="glowRedTx" gradientId="fadeRedTx" clipId="clipRedTx" />
          </Card>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100 flex-shrink-0">
            <div className="flex relative">
              <button
                ref={walletTabRef}
                onClick={() => { setActiveTab('wallet'); setCurrentPage(1); setPlatformFilter('all') }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'wallet' ? 'text-[#0D9488]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Wallet Deposits
              </button>
              <button
                ref={adAccountTabRef}
                onClick={() => { setActiveTab('adAccount'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'adAccount' ? 'text-[#0D9488]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Ad Account Recharge
              </button>
              <button
                ref={adOpeningTabRef}
                onClick={() => { setActiveTab('adOpening'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 flex items-center gap-2 ${
                  activeTab === 'adOpening' ? 'text-[#0D9488]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                Ad Account Opening
              </button>
              <div
                className="absolute bottom-0 h-0.5 bg-[#0D9488] transition-all duration-300 ease-out"
                style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
              />
            </div>
          </div>

          {/* Table - Scrollable area */}
          <div className="overflow-auto flex-1 min-h-0" key={activeTab}>
            <table className="w-full animate-tabFadeIn text-[11px] xl:text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Apply ID</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">User</th>
                  {activeTab === 'wallet' && (
                    <>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Amount</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Method</th>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Txn ID</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Proof</th>
                    </>
                  )}
                  {activeTab === 'adAccount' && (
                    <>
                      <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Account</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Platform</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Amount</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Comm.</th>
                    </>
                  )}
                  {activeTab === 'adOpening' && (
                    <>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Platform</th>
                      <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Qty</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Fee</th>
                      <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Total</th>
                    </>
                  )}
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Status</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin mb-1" />
                        <span className="text-[11px] text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">
                      {searchQuery ? 'No matching records found' : 'No records found'}
                    </td>
                  </tr>
                ) : activeTab === 'wallet' ? (
                  (paginatedData as Deposit[]).map((deposit, index) => (
                    <tr key={deposit.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-[#0D9488] bg-[#0D9488]/10 px-1.5 py-0.5 rounded font-semibold text-[11px]">{deposit.applyId || '---'}</code>
                          {deposit.applyId && (
                            <button onClick={() => copyToClipboard(deposit.applyId || '')} className="p-1 rounded text-gray-400 hover:text-[#0D9488] hover:bg-gray-100 transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 truncate max-w-[100px]" title={`${deposit.user?.username} - ${deposit.user?.email}`}>{deposit.user?.username || 'Unknown'}</p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#52B788] text-[13px]">{formatCurrency(deposit.amount)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">{deposit.paymentMethod || 'N/A'}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded text-[10px]">
                            {deposit.transactionId ? `${deposit.transactionId.slice(0, 10)}...` : '---'}
                          </code>
                          {deposit.transactionId && (
                            <button onClick={() => copyToClipboard(deposit.transactionId || '')} className="p-1 rounded text-gray-400 hover:text-[#0D9488] hover:bg-gray-100 transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex justify-center">
                          {deposit.paymentProof ? (
                            <button
                              onClick={() => setPreviewImage(deposit.paymentProof || null)}
                              className="w-7 h-7 rounded overflow-hidden border border-gray-200 hover:border-[#0D9488] transition-all"
                            >
                              <img src={deposit.paymentProof} alt="Proof" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400">No image</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(deposit.status)}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-center">{formatDate(deposit.createdAt)}</td>
                    </tr>
                  ))
                ) : activeTab === 'adAccount' ? (
                  (paginatedData as AccountDeposit[]).map((deposit, index) => (
                    <tr key={deposit.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-[#0D9488] bg-[#0D9488]/10 px-1.5 py-0.5 rounded font-semibold text-[11px]">{deposit.applyId || '---'}</code>
                          {deposit.applyId && (
                            <button onClick={() => copyToClipboard(deposit.applyId || '')} className="p-1 rounded text-gray-400 hover:text-[#0D9488] hover:bg-gray-100 transition-colors">
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 truncate max-w-[100px]" title={`${deposit.adAccount?.user?.username} - ${deposit.adAccount?.user?.email}`}>{deposit.adAccount?.user?.username || 'Unknown'}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 truncate max-w-[100px]" title={deposit.adAccount?.accountId}>{deposit.adAccount?.accountName || '---'}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center">{getPlatformBadge(deposit.adAccount?.platform || '')}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#52B788] text-[13px]">{formatCurrency(deposit.amount)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-bold text-orange-600 text-[13px]">{formatCurrency(deposit.commissionAmount)}</span>
                        <span className="text-[10px] text-gray-500 ml-1">({deposit.commissionRate || 0}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(deposit.status)}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-center">{formatDate(deposit.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  (paginatedData as Application[]).map((app, index) => (
                    <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate" style={{ animationDelay: `${index * 20}ms` }}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <code className="font-mono text-[#0D9488] bg-[#0D9488]/10 px-1.5 py-0.5 rounded font-semibold text-[11px]">{app.applyId}</code>
                          <button onClick={() => copyToClipboard(app.applyId)} className="p-1 rounded text-gray-400 hover:text-[#0D9488] hover:bg-gray-100 transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900 truncate max-w-[100px]" title={`${app.user?.username} - ${app.user?.email}`}>{app.user?.username || 'Unknown'}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center">{getPlatformBadge(app.platform)}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex justify-center">
                          <span className="w-6 h-6 rounded bg-gray-100 text-gray-700 font-semibold flex items-center justify-center">{app.adAccountQty}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#0D9488] text-[13px]">{formatCurrency(app.openingFee)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-orange-600 text-[13px]">{formatCurrency(app.totalCost)}</td>
                      <td className="py-2.5 px-3 text-center">{getStatusBadge(app.status)}</td>
                      <td className="py-2.5 px-3 text-gray-500 text-center">{formatDate(app.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Fixed at bottom */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-[12px]">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Show</span>
              <PaginationSelect
                value={itemsPerPage}
                onChange={(val) => {
                  setItemsPerPage(val === -1 ? currentData.length : val)
                  setCurrentPage(1)
                }}
              />
              <span className="text-gray-500">
                of {currentData.length} records
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
                          ? 'bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm'
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
                          ? 'bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className="w-4 text-center text-gray-400">...</span>}
                    {currentPage > 2 && currentPage < totalPages - 1 && (
                      <button
                        className="w-8 h-8 rounded-lg font-medium bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm"
                      >
                        {currentPage}
                      </button>
                    )}
                    {currentPage < totalPages - 2 && <span className="w-4 text-center text-gray-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                        currentPage === totalPages
                          ? 'bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {totalPages}
                    </button>
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

      {/* Image Preview Modal - Compact */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative max-w-sm w-full max-h-[60vh]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-8 right-0 p-1 rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="rounded-lg overflow-hidden bg-white">
              <img src={previewImage} alt="Payment Proof" className="w-full h-auto max-h-[50vh] object-contain" />
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
        <div className="bg-white rounded-xl p-5 max-w-md w-[calc(100vw-2rem)] relative shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowExportPopup(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-base font-bold text-gray-800 mb-0.5">Export Data</h3>
          <p className="text-[11px] text-gray-500 mb-4">Select filters to export specific data</p>

          <div className="space-y-3">
            {/* Platform Selection (only for non-wallet tabs) */}
            {activeTab !== 'wallet' && (
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Platform</label>
                <div className="grid grid-cols-3 gap-1.5">
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
                      className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                        exportPlatform === option.value ? 'bg-[#0D9488] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
              <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Status</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'REJECTED', label: 'Rejected' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setExportStatus(option.value)}
                    className={`px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                      exportStatus === option.value ? 'bg-[#0D9488] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Filter */}
            <div className="relative user-dropdown-container">
              <label className="block text-[10px] font-medium text-gray-500 mb-1.5">User (Optional)</label>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-[11px] text-left transition-all ${
                  showUserDropdown ? 'border-[#0D9488] ring-1 ring-[#0D9488]/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={exportSelectedUsers.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
                  {exportSelectedUsers.length > 0 ? `${exportSelectedUsers.length} user${exportSelectedUsers.length > 1 ? 's' : ''} selected` : 'Select Users'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 transition-all duration-200 overflow-hidden ${
                showUserDropdown ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2 pointer-events-none'
              }`}>
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={exportUserSearch}
                      onChange={(e) => setExportUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-[11px] focus:outline-none focus:border-[#0D9488]"
                    />
                  </div>
                </div>
                {exportSelectedUsers.length > 0 && (
                  <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap gap-1">
                      {exportSelectedUsers.map(userId => {
                        const user = getUserById(userId)
                        return (
                          <span key={userId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0D9488] text-white text-[10px] font-medium rounded">
                            {user?.username || userId}
                            <button onClick={() => removeSelectedUser(userId)} className="hover:bg-white/20 rounded"><X className="w-2.5 h-2.5" /></button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="max-h-36 overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`w-full px-3 py-2 text-left text-[11px] hover:bg-gray-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                          exportSelectedUsers.includes(user.id) ? 'bg-[#0D9488]/5' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-gray-700 font-medium">{user.username}</span>
                          <span className="text-gray-400 text-[10px]">{user.email}</span>
                        </div>
                        {exportSelectedUsers.includes(user.id) && (
                          <div className="w-4 h-4 bg-[#0D9488] rounded-full flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-[11px] text-gray-400">No users found</div>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="relative calendar-container">
              <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setShowFromCalendar(!showFromCalendar); setShowToCalendar(false); setCalendarMonth(exportDateFrom || new Date()) }}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-2 border rounded-md text-[11px] text-left transition-all ${
                    showFromCalendar ? 'border-[#0D9488] ring-1 ring-[#0D9488]/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className={exportDateFrom ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateFrom ? formatCalendarDate(exportDateFrom) : 'From date'}
                  </span>
                </button>
                <button
                  onClick={() => { setShowToCalendar(!showToCalendar); setShowFromCalendar(false); setCalendarMonth(exportDateTo || new Date()) }}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-2 border rounded-md text-[11px] text-left transition-all ${
                    showToCalendar ? 'border-[#0D9488] ring-1 ring-[#0D9488]/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className={exportDateTo ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateTo ? formatCalendarDate(exportDateTo) : 'To date'}
                  </span>
                </button>
              </div>

              {(showFromCalendar || showToCalendar) && (
                <div className="mt-1.5 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded">
                      <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="text-[11px] font-semibold text-gray-800">{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded">
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                  </div>
                  <div className="text-center mb-2">
                    <span className="text-[10px] text-[#0D9488] font-medium bg-[#0D9488]/10 px-2 py-0.5 rounded-full">
                      {showFromCalendar ? 'Select start date' : 'Select end date'}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-center text-[10px] font-medium text-gray-400 py-0.5">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {(() => {
                      const { daysInMonth, startingDay } = getDaysInMonth(calendarMonth)
                      const days = []
                      for (let i = 0; i < startingDay; i++) {
                        days.push(<div key={`empty-${i}`} className="py-1.5" />)
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
                            className={`py-1.5 text-[11px] rounded transition-colors ${
                              isSelectedFrom || isSelectedTo ? 'bg-[#0D9488] text-white font-medium' : isToday ? 'bg-gray-100 text-gray-800 font-medium' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      }
                      return days
                    })()}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => {
                        if (showFromCalendar) setExportDateFrom(null)
                        else setExportDateTo(null)
                        setShowFromCalendar(false)
                        setShowToCalendar(false)
                      }}
                      className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => setShowExportPopup(false)} className="flex-1 px-4 h-8 border border-gray-200 text-gray-600 rounded-md text-xs font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 px-4 h-8 bg-[#52B788] text-white rounded-md text-xs font-medium hover:bg-[#3d9970] flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exporting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Exporting...</> : <><Download className="w-3.5 h-3.5" />Export</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
