'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { Loader2, Search, ChevronLeft, ChevronRight, Download, X, Eye, ChevronDown, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react'
import { bmAdRequestApi, usersApi } from '@/lib/api'
import * as XLSX from 'xlsx'

// Platform icons - Black & White (compact size matching users page)
const FacebookIcon = () => (
  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-700" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  </div>
)

const GoogleIcon = () => (
  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-700" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  </div>
)

const TikTokIcon = () => (
  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-700" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
    </svg>
  </div>
)

const SnapchatIcon = () => (
  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-700" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509-.045.359-.225.689-.555.93-.703.51-1.838.795-3.453.855-.045.015-.089.06-.104.105-.105.3-.195.6-.314.899-.091.221-.315.39-.575.39h-.016c-.155 0-.329-.044-.5-.103-.503-.165-1.169-.36-1.793-.36-.224 0-.435.015-.614.045-.406.063-.72.19-1.018.32a6.418 6.418 0 01-1.154.405c-.196.06-.375.09-.555.09-.181 0-.359-.03-.555-.09a6.418 6.418 0 01-1.154-.405c-.299-.13-.612-.257-1.018-.32a2.896 2.896 0 00-.614-.045c-.624 0-1.29.195-1.793.36-.171.059-.345.103-.5.103h-.016c-.26 0-.484-.169-.575-.39-.119-.299-.21-.599-.314-.899-.015-.045-.06-.09-.104-.105-1.615-.06-2.75-.345-3.453-.855-.329-.241-.51-.571-.555-.93-.015-.239.165-.465.42-.509 3.265-.539 4.731-3.878 4.791-4.014l.015-.015c.181-.344.21-.644.12-.868-.194-.45-.884-.675-1.333-.81-.135-.044-.255-.09-.344-.119-.823-.329-1.228-.719-1.213-1.168 0-.359.284-.689.734-.838.15-.061.327-.09.509-.09.12 0 .299.016.464.104.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.859 1.069 11.216.793 12.206.793z"/>
    </svg>
  </div>
)

const BingIcon = () => (
  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
    <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-700" fill="currentColor">
      <path d="M5 3v16.5l4.5 2.5 7-4v-4l-4.5 2.5V9l5.5-2.5L5 3z"/>
    </svg>
  </div>
)

interface AccountDetail {
  name: string
  accountId?: string
}

interface Application {
  id: string
  applyId: string // The actual Apply ID from database
  platform: string
  accountName?: string
  accountDetails?: string // JSON array of {name, accountId}
  adAccountQty?: number
  bmId?: string
  timezone?: string
  status: string
  createdAt: string
  openingFee?: number
  depositAmount?: number
  totalCost?: number
  pageLink?: string
  pageUrls?: string
  pageName?: string
  businessName?: string
  websiteLink?: string
  targetRegion?: string
  dailyBudget?: number
  currency?: string
  adminRemarks?: string
  approvedAt?: string
  rejectedAt?: string
  licenseType?: string
  user?: {
    id: string
    username: string
    email: string
    realName?: string
  }
}

interface BMShare {
  id: string
  applyId: string
  platform: string
  bmId: string
  adAccountId?: string
  status: string
  createdAt: string
  completedAt?: string
  user?: {
    id: string
    username: string
    email: string
  }
}

export default function BMAdRequestPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'account' | 'bm'>('account')
  const [applications, setApplications] = useState<Application[]>([])
  const [bmShares, setBmShares] = useState<BMShare[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

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

  // Details popup state
  const [showDetailsPopup, setShowDetailsPopup] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // All users for export filter
  const [allUsers, setAllUsers] = useState<{ id: string; username: string; email: string }[]>([])

  // Stats
  const [stats, setStats] = useState({
    totalApplications: 0,
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0
  })

  // Tab refs for dynamic indicator positioning
  const accountTabRef = useRef<HTMLButtonElement>(null)
  const bmTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const activeRef = activeTab === 'account' ? accountTabRef : bmTabRef
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
    if (showExportPopup || showDetailsPopup) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showExportPopup, showDetailsPopup])

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

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch stats
      const statsRes = await bmAdRequestApi.getStats()
      setStats({
        totalApplications: statsRes.totalAdAccounts,
        totalApproved: statsRes.totalApprovedRecharges,
        totalPending: statsRes.totalPendingRequests,
        totalRejected: statsRes.totalRejectedRequests
      })

      // Fetch applications or BM shares based on active tab
      if (activeTab === 'account') {
        // If searching, fetch all data to search across all pages
        const params: any = searchQuery.trim()
          ? { page: 1, limit: 1000 } // Fetch all when searching
          : { page: currentPage, limit: 20 }
        if (statusFilter) params.status = statusFilter
        if (platformFilter !== 'all') params.platform = platformFilter
        if (searchQuery.trim()) params.search = searchQuery.trim()

        const res = await bmAdRequestApi.getApplications(params)
        setApplications(res.applications)
        // When searching, calculate pages based on filtered results
        if (!searchQuery.trim()) {
          setTotalPages(res.pagination.pages)
        }
      } else {
        // If searching, fetch all data to search across all pages
        const params: any = searchQuery.trim()
          ? { page: 1, limit: 1000 } // Fetch all when searching
          : { page: currentPage, limit: 20 }
        if (statusFilter) params.status = statusFilter
        if (platformFilter !== 'all') params.platform = platformFilter
        if (searchQuery.trim()) params.search = searchQuery.trim()

        const res = await bmAdRequestApi.getBmShares(params)
        setBmShares(res.bmShares)
        // When searching, calculate pages based on filtered results
        if (!searchQuery.trim()) {
          setTotalPages(res.pagination.pages)
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, searchQuery ? 300 : 0) // Debounce only when searching
    return () => clearTimeout(timer)
  }, [activeTab, currentPage, platformFilter, statusFilter, searchQuery])

  // Reset page to 1 when search query changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentPage(1)
    }
  }, [searchQuery])

  // Fetch all users for export filter
  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const res = await usersApi.getAll()
        setAllUsers(res.users || [])
      } catch (err) {
        console.error('Failed to fetch users:', err)
      }
    }
    fetchAllUsers()
  }, [])

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

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toUpperCase()) {
      case 'FACEBOOK':
        return <FacebookIcon />
      case 'GOOGLE':
        return <GoogleIcon />
      case 'TIKTOK':
        return <TikTokIcon />
      case 'SNAPCHAT':
        return <SnapchatIcon />
      case 'BING':
        return <BingIcon />
      default:
        return <FacebookIcon />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleViewDetails = async (app: Application) => {
    setLoadingDetails(true)
    setShowDetailsPopup(true)
    try {
      const res = await bmAdRequestApi.getApplicationDetails(app.id)
      setSelectedApplication(res.application)
    } catch (err) {
      console.error('Failed to fetch application details:', err)
      setSelectedApplication(app)
    } finally {
      setLoadingDetails(false)
    }
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount && amount !== 0) return '---'
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  // Filter users based on search from all users list
  const filteredUsers = allUsers.filter(user =>
    user.username?.toLowerCase().includes(exportUserSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(exportUserSearch.toLowerCase())
  )

  // Toggle user selection (by user id)
  const toggleUserSelection = (userId: string) => {
    setExportSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(u => u !== userId)
        : [...prev, userId]
    )
  }

  // Remove selected user
  const removeSelectedUser = (userId: string) => {
    setExportSelectedUsers(prev => prev.filter(u => u !== userId))
  }

  // Get user by id
  const getUserById = (userId: string) => {
    return allUsers.find(u => u.id === userId)
  }

  // Calendar helpers
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

  // Export to Excel function
  const handleExport = async () => {
    try {
      setExporting(true)

      // Build query params for export
      const params: any = { limit: 10000 } // Get all records for export
      if (exportPlatform !== 'all') params.platform = exportPlatform
      if (exportStatus !== 'all') params.status = exportStatus

      // Fetch all applications based on filters
      let dataToExport: any[]
      if (activeTab === 'account') {
        const res = await bmAdRequestApi.getApplications(params)
        dataToExport = res.applications
      } else {
        const res = await bmAdRequestApi.getBmShares(params)
        dataToExport = res.bmShares
      }

      // Filter by selected users if any
      if (exportSelectedUsers.length > 0) {
        dataToExport = dataToExport.filter((item: any) =>
          exportSelectedUsers.includes(item.user?.id)
        )
      }

      // Filter by date range
      if (exportDateFrom) {
        dataToExport = dataToExport.filter((item: any) =>
          new Date(item.createdAt) >= exportDateFrom
        )
      }
      if (exportDateTo) {
        const endDate = new Date(exportDateTo)
        endDate.setHours(23, 59, 59, 999)
        dataToExport = dataToExport.filter((item: any) =>
          new Date(item.createdAt) <= endDate
        )
      }

      // Prepare data for Excel
      const excelData = dataToExport.map((item: any) => {
        if (activeTab === 'account') {
          // Parse account details
          let accountNames = ''
          let accountIds = ''
          if (item.accountDetails) {
            try {
              const details = JSON.parse(item.accountDetails)
              accountNames = details.map((d: any) => d.name).filter(Boolean).join(', ')
              accountIds = details.map((d: any) => d.accountId).filter(Boolean).join(', ')
            } catch {
              accountNames = item.accountName || ''
            }
          } else {
            accountNames = item.accountName || ''
          }

          return {
            'Apply ID': item.applyId || '',
            'User Name': item.user?.username || '',
            'User Email': item.user?.email || '',
            'Platform': item.platform || '',
            'Account Names': accountNames,
            'Ad Account IDs': accountIds,
            'BM ID': item.bmId || '',
            'Timezone': item.timezone || '',
            'Opening Fee': item.openingFee || 0,
            'Deposit Amount': item.depositAmount || 0,
            'Total Cost': item.totalCost || 0,
            'Status': item.status || '',
            'Request Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
            'Business Name': item.businessName || '',
            'Target Region': item.targetRegion || '',
            'Daily Budget': item.dailyBudget || '',
            'Currency': item.currency || '',
            'Admin Remarks': item.adminRemarks || '',
          }
        } else {
          return {
            'Apply ID': item.applyId || '',
            'User Name': item.user?.username || '',
            'User Email': item.user?.email || '',
            'Platform': item.platform || '',
            'BM ID': item.bmId || '',
            'Status': item.status || '',
            'Request Date': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
          }
        }
      })

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // Auto-size columns
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }))
      ws['!cols'] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, activeTab === 'account' ? 'Ad Account Requests' : 'BM Share Requests')

      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `${activeTab === 'account' ? 'ad_account_requests' : 'bm_share_requests'}_${dateStr}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)

      setShowExportPopup(false)
      // Reset export filters
      setExportPlatform('all')
      setExportStatus('all')
      setExportSelectedUsers([])
      setExportDateFrom(null)
      setExportDateTo(null)
      setExportUserSearch('')
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Parse account details JSON and get account details with name and ID pairs
  const getAccountDetails = (app: Application): AccountDetail[] => {
    if (app.accountDetails) {
      try {
        const details: AccountDetail[] = JSON.parse(app.accountDetails)
        return details.filter(d => d.name)
      } catch {
        return []
      }
    }
    return app.accountName ? [{ name: app.accountName }] : []
  }

  // Filter applications based on search query
  const filteredApplications = applications.filter((app) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()

    // Search in username
    if (app.user?.username?.toLowerCase().includes(query)) return true
    if (app.user?.email?.toLowerCase().includes(query)) return true

    // Search in apply ID
    if (app.applyId?.toLowerCase().includes(query)) return true

    // Search in platform
    if (app.platform?.toLowerCase().includes(query)) return true

    // Search in status
    if (app.status?.toLowerCase().includes(query)) return true

    // Search in opening fee
    if (app.openingFee?.toString().includes(query)) return true

    // Search in date
    if (formatDate(app.createdAt).toLowerCase().includes(query)) return true

    // Search in account details (name and accountId)
    const accountDetails = getAccountDetails(app)
    for (const detail of accountDetails) {
      if (detail.name?.toLowerCase().includes(query)) return true
      if (detail.accountId?.toLowerCase().includes(query)) return true
    }

    // Search in BM ID if present
    if (app.bmId?.toLowerCase().includes(query)) return true

    return false
  })

  // Filter BM shares based on search query
  const filteredBmShares = bmShares.filter((share) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()

    // Search in username
    if (share.user?.username?.toLowerCase().includes(query)) return true
    if (share.user?.email?.toLowerCase().includes(query)) return true

    // Search in apply ID
    if (share.applyId?.toLowerCase().includes(query)) return true

    // Search in BM ID
    if (share.bmId?.toLowerCase().includes(query)) return true

    // Search in Ad Account ID
    if (share.adAccountId?.toLowerCase().includes(query)) return true

    // Search in platform
    if (share.platform?.toLowerCase().includes(query)) return true

    // Search in status
    if (share.status?.toLowerCase().includes(query)) return true

    // Search in dates
    if (formatDate(share.createdAt).toLowerCase().includes(query)) return true
    if (share.completedAt && formatDate(share.completedAt).toLowerCase().includes(query)) return true

    return false
  })

  // Paginate filtered results when searching
  const itemsPerPage = 20
  const paginatedApplications = searchQuery.trim()
    ? filteredApplications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredApplications
  const paginatedBmShares = searchQuery.trim()
    ? filteredBmShares.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : filteredBmShares

  // Calculate total pages for search results
  const searchTotalPages = activeTab === 'account'
    ? Math.ceil(filteredApplications.length / itemsPerPage)
    : Math.ceil(filteredBmShares.length / itemsPerPage)

  const effectiveTotalPages = searchQuery.trim() ? searchTotalPages : totalPages

  return (
    <DashboardLayout title="BM & AD Applications Management" subtitle="">
      <div className="space-y-3">
      {/* Fixed Top Section */}
      <div className="flex-shrink-0 bg-[#F6F6F6]">
        {/* Top Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] lg:flex-none group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-[#0D9488]" />
            <input
              type="text"
              placeholder="Search users, ID, accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[220px] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] bg-white transition-all"
            />
          </div>

          {/* Date Filter - Custom Dropdown */}
          <div className="relative dropdown-container">
            <button
              onClick={() => { setShowDateDropdown(!showDateDropdown); setShowStatusDropdown(false); setShowPlatformDropdown(false) }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[120px] justify-between bg-white"
            >
              <span>{dateFilter === 'all' ? 'All Time' : dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
              showDateDropdown
                ? 'opacity-100 scale-y-100 translate-y-0 visible'
                : 'opacity-0 scale-y-95 -translate-y-1 invisible'
            }`}>
              {[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
              ].map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => { setDateFilter(option.value); setShowDateDropdown(false); setCurrentPage(1) }}
                  className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${dateFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
                  style={{ transitionDelay: showDateDropdown ? `${index * 30}ms` : '0ms' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter - Custom Dropdown */}
          <div className="relative dropdown-container">
            <button
              onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowDateDropdown(false); setShowPlatformDropdown(false) }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[110px] justify-between bg-white"
            >
              <span>{statusFilter === '' ? 'All Status' : statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'PENDING' ? 'Pending' : 'Rejected'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
              showStatusDropdown
                ? 'opacity-100 scale-y-100 translate-y-0 visible'
                : 'opacity-0 scale-y-95 -translate-y-1 invisible'
            }`}>
              {[
                { value: '', label: 'All Status' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'REJECTED', label: 'Rejected' },
              ].map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => { setStatusFilter(option.value); setShowStatusDropdown(false); setCurrentPage(1) }}
                  className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${statusFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
                  style={{ transitionDelay: showStatusDropdown ? `${index * 30}ms` : '0ms' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Filter - Custom Dropdown */}
          <div className="relative dropdown-container">
            <button
              onClick={() => { setShowPlatformDropdown(!showPlatformDropdown); setShowDateDropdown(false); setShowStatusDropdown(false) }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[120px] justify-between bg-white"
            >
              <span>{platformFilter === 'all' ? 'All Platforms' : platformFilter}</span>
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
              ].map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => { setPlatformFilter(option.value); setShowPlatformDropdown(false); setCurrentPage(1) }}
                  className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${platformFilter === option.value ? 'text-[#0D9488] bg-[#0D9488]/5 font-medium' : 'text-gray-600'}`}
                  style={{ transitionDelay: showPlatformDropdown ? `${index * 30}ms` : '0ms' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Total Applications - Purple */}
        <Card className="p-3 relative overflow-hidden min-h-[80px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[11px] text-gray-500">Total Applications</span>
              <p className="text-xl font-bold text-gray-800">{stats.totalApplications.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#0D9488] text-white text-[10px] font-medium rounded">Total</span>
          </div>
          <StatsChart value={stats.totalApplications} color="#0D9488" filterId="glowPurpleBm" gradientId="fadePurpleBm" clipId="clipPurpleBm" />
        </Card>

        {/* Total Approved - Green */}
        <Card className="p-3 relative overflow-hidden min-h-[80px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[11px] text-gray-500">Total Approved</span>
              <p className="text-xl font-bold text-gray-800">{stats.totalApproved.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#52B788] text-white text-[10px] font-medium rounded">Approved</span>
          </div>
          <StatsChart value={stats.totalApproved} color="#52B788" filterId="glowGreenBm" gradientId="fadeGreenBm" clipId="clipGreenBm" />
        </Card>

        {/* Total Pending - Orange */}
        <Card className="p-3 relative overflow-hidden min-h-[80px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[11px] text-gray-500">Total Pending</span>
              <p className="text-xl font-bold text-gray-800">{stats.totalPending.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded">Pending</span>
          </div>
          <StatsChart value={stats.totalPending} color="#F59E0B" filterId="glowOrangeBm" gradientId="fadeOrangeBm" clipId="clipOrangeBm" />
        </Card>

        {/* Total Rejected - Red */}
        <Card className="p-3 relative overflow-hidden min-h-[80px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[11px] text-gray-500">Total Rejected</span>
              <p className="text-xl font-bold text-gray-800">{stats.totalRejected.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-medium rounded">Rejected</span>
          </div>
          <StatsChart value={stats.totalRejected} color="#EF4444" filterId="glowRedBm" gradientId="fadeRedBm" clipId="clipRedBm" />
        </Card>
      </div>
      </div>

      {/* Tabs & Table - Flex grow to fill remaining space */}
      <Card className="p-0 overflow-hidden flex flex-col flex-1 min-h-0" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Tabs with smooth sliding indicator */}
        <div className="border-b border-gray-100 flex-shrink-0">
          <div className="flex relative">
            <button
              ref={accountTabRef}
              onClick={() => { setActiveTab('account'); setCurrentPage(1) }}
              className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'account'
                  ? 'text-[#0D9488]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Account List
            </button>
            <button
              ref={bmTabRef}
              onClick={() => { setActiveTab('bm'); setCurrentPage(1) }}
              className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'bm'
                  ? 'text-[#0D9488]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              BM Share List
            </button>
            {/* Sliding indicator - dynamically positioned based on active tab */}
            <div
              className="absolute bottom-0 h-0.5 bg-[#0D9488] transition-all duration-300 ease-out"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
          </div>
        </div>

        {/* Table with fade animation - Scrollable area */}
        <div className="overflow-auto flex-1 min-h-0" key={activeTab}>
          <table className="w-full animate-tabFadeIn text-[11px] xl:text-[12px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">User Name</th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Platform</th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Apply ID</th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">
                  {activeTab === 'account' ? 'Account → Ad ID' : 'BM ID'}
                </th>
                {activeTab === 'account' ? (
                  <>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Opening</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Action</th>
                  </>
                ) : (
                  <>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Ad Account ID</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Request</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Completed</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center">
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin mb-1" />
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : activeTab === 'account' ? (
                paginatedApplications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">
                      {searchQuery ? 'No matching applications found' : 'No applications found'}
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app, index) => {
                    const accountDetails = getAccountDetails(app)
                    return (
                      <tr
                        key={`account-${app.id}`}
                        className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{app.user?.username || 'Unknown'}</td>
                        <td className="py-2.5 px-3">{getPlatformIcon(app.platform)}</td>
                        <td className="py-2.5 px-3 text-gray-600 font-mono">{app.applyId || '---'}</td>
                        <td className="py-2.5 px-3">
                          {accountDetails.length > 0 ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              {accountDetails.map((detail, idx) => (
                                <div key={idx} className="flex items-center justify-center gap-1">
                                  <span className="px-1.5 py-0.5 bg-[#52B788]/10 text-[#52B788] text-[10px] font-medium rounded whitespace-nowrap">
                                    {detail.name}
                                  </span>
                                  <span className="text-gray-400 text-[10px]">→</span>
                                  {detail.accountId ? (
                                    <span className="px-1.5 py-0.5 bg-[#0D9488]/10 text-[#0D9488] text-[10px] font-mono font-medium rounded whitespace-nowrap">
                                      {detail.accountId}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic whitespace-nowrap">N/A</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center">
                              <span className="text-gray-400">---</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#0D9488] whitespace-nowrap">{formatCurrency(app.openingFee)}</td>
                        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(app.createdAt)}</td>
                        <td className="py-2.5 px-3">{getStatusBadge(app.status)}</td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleViewDetails(app)}
                            className="flex items-center gap-1 px-2 py-1 bg-[#0D9488]/10 text-[#0D9488] rounded font-medium hover:bg-[#0D9488]/20 transition-colors whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )
              ) : (
                paginatedBmShares.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">
                      {searchQuery ? 'No matching BM share requests found' : 'No BM share requests found'}
                    </td>
                  </tr>
                ) : (
                  paginatedBmShares.map((share, index) => (
                    <tr
                      key={`bm-${share.id}`}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{share.user?.username || 'Unknown'}</td>
                      <td className="py-2.5 px-3">{getPlatformIcon(share.platform)}</td>
                      <td className="py-2.5 px-3 text-gray-600 font-mono">{share.applyId || '---'}</td>
                      <td className="py-2.5 px-3 text-center text-[#0D9488] font-mono whitespace-nowrap">{share.bmId || '---'}</td>
                      <td className="py-2.5 px-3 text-[#52B788] font-mono whitespace-nowrap">{share.adAccountId || '---'}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(share.createdAt)}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{share.completedAt ? formatDate(share.completedAt) : '---'}</td>
                      <td className="py-2.5 px-3">{getStatusBadge(share.status)}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Fixed at bottom */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-[12px]">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          <div className="flex items-center gap-1">
            {effectiveTotalPages <= 5 ? (
              Array.from({ length: effectiveTotalPages }, (_, i) => i + 1).map((page) => (
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
                {currentPage > 2 && currentPage < effectiveTotalPages - 1 && (
                  <button
                    className="w-8 h-8 rounded-lg font-medium bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm"
                  >
                    {currentPage}
                  </button>
                )}
                {currentPage < effectiveTotalPages - 2 && <span className="w-4 text-center text-gray-400">...</span>}
                <button
                  onClick={() => setCurrentPage(effectiveTotalPages)}
                  className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                    currentPage === effectiveTotalPages
                      ? 'bg-gradient-to-r from-[#0D9488] to-[#9333EA] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {effectiveTotalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(effectiveTotalPages, p + 1))}
            disabled={currentPage === effectiveTotalPages || effectiveTotalPages === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
      </div>

      {/* View Details Popup Modal - Compact */}
      <div
        className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 transition-all duration-300 ease-out ${
          showDetailsPopup ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={() => setShowDetailsPopup(false)}
      >
        <div
          className={`bg-white rounded-xl p-4 max-w-xl w-full mx-4 relative transition-all duration-300 ease-out max-h-[85vh] overflow-y-auto ${
            showDetailsPopup ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowDetailsPopup(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="text-[15px] font-bold text-gray-800 mb-0.5">Application Details</h3>
          <p className="text-[11px] text-gray-500 mb-3">View the details submitted by the user</p>

          {loadingDetails ? (
            <div className="flex flex-col items-center py-6">
              <Loader2 className="w-5 h-5 text-[#0D9488] animate-spin mb-1" />
              <span className="text-[11px] text-gray-500">Loading details...</span>
            </div>
          ) : selectedApplication ? (
            <div className="space-y-3">
              {/* Status Banner */}
              <div className={`p-2.5 rounded-lg ${
                selectedApplication.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
                selectedApplication.status === 'PENDING' ? 'bg-orange-50 border border-orange-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-medium text-gray-600">Status</span>
                    <div className="mt-0.5">{getStatusBadge(selectedApplication.status)}</div>
                  </div>
                  {selectedApplication.adminRemarks && (
                    <div className="text-right max-w-[50%]">
                      <span className="text-[10px] font-medium text-gray-600">Remarks</span>
                      <p className="text-[11px] text-gray-700 mt-0.5 truncate">{selectedApplication.adminRemarks}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Details Grid - Compact */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">User</span>
                  <p className="text-[11px] font-semibold text-gray-800 truncate">{selectedApplication.user?.username || 'Unknown'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Platform</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getPlatformIcon(selectedApplication.platform)}
                    <span className="text-[11px] font-semibold text-gray-800">{selectedApplication.platform}</span>
                  </div>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Apply ID</span>
                  <p className="text-[11px] font-mono font-semibold text-gray-800 truncate">
                    {selectedApplication.applyId || '---'}
                  </p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Opening Fee</span>
                  <p className="text-[11px] font-bold text-[#0D9488]">
                    {formatCurrency(selectedApplication.openingFee)}
                  </p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Deposit</span>
                  <p className="text-[11px] font-bold text-[#52B788]">
                    {formatCurrency(selectedApplication.depositAmount)}
                  </p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Total Cost</span>
                  <p className="text-[11px] font-bold text-orange-500">
                    {formatCurrency(selectedApplication.totalCost)}
                  </p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">BM ID</span>
                  <p className="text-[11px] font-mono font-semibold text-[#0D9488] truncate">{selectedApplication.bmId || '---'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Timezone</span>
                  <p className="text-[11px] font-semibold text-gray-800 truncate">{selectedApplication.timezone || '---'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Currency</span>
                  <p className="text-[11px] font-semibold text-gray-800">{selectedApplication.currency || '---'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">License</span>
                  <p className="text-[11px] font-semibold text-gray-800">{selectedApplication.licenseType || 'NEW'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Daily Budget</span>
                  <p className="text-[11px] font-semibold text-gray-800">
                    {selectedApplication.dailyBudget ? formatCurrency(selectedApplication.dailyBudget) : '---'}
                  </p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Region</span>
                  <p className="text-[11px] font-semibold text-gray-800 truncate">{selectedApplication.targetRegion || '---'}</p>
                </div>

                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Request Date</span>
                  <p className="text-[11px] font-semibold text-gray-800">{formatDate(selectedApplication.createdAt)}</p>
                </div>

                {selectedApplication.approvedAt && (
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide">Approved</span>
                    <p className="text-[11px] font-semibold text-green-600">{formatDate(selectedApplication.approvedAt)}</p>
                  </div>
                )}

                {selectedApplication.rejectedAt && (
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <span className="text-[9px] text-gray-500 uppercase tracking-wide">Rejected</span>
                    <p className="text-[11px] font-semibold text-red-600">{formatDate(selectedApplication.rejectedAt)}</p>
                  </div>
                )}

                <div className="p-2 bg-gray-50 rounded-lg col-span-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Business Name</span>
                  <p className="text-[11px] font-semibold text-gray-800">{selectedApplication.businessName || '---'}</p>
                </div>
              </div>

              {/* Ad Accounts - Compact */}
              <div className="p-2 bg-gray-50 rounded-lg">
                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Ad Accounts ({selectedApplication.adAccountQty || 1})</span>
                <div className="mt-1.5 space-y-1">
                  {getAccountDetails(selectedApplication).length > 0 ? (
                    getAccountDetails(selectedApplication).map((detail, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-1.5 bg-white rounded border border-gray-100">
                        <span className="w-4 h-4 flex items-center justify-center bg-gray-200 text-gray-600 text-[9px] font-bold rounded-full flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#52B788]/10 text-[#52B788] text-[10px] font-medium rounded truncate max-w-[120px]">
                          {detail.name}
                        </span>
                        <span className="text-gray-400 text-[10px]">→</span>
                        {detail.accountId ? (
                          <span className="px-1.5 py-0.5 bg-[#0D9488]/10 text-[#0D9488] text-[10px] font-mono font-medium rounded truncate">
                            {detail.accountId}
                          </span>
                        ) : (
                          <span className="text-[10px] text-orange-500 italic">N/A</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-gray-400">---</span>
                  )}
                </div>
              </div>

              {/* URLs - Compact */}
              {(selectedApplication.pageLink || selectedApplication.pageUrls || selectedApplication.websiteLink) && (
                <div className="p-2 bg-gray-50 rounded-lg">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">Links</span>
                  <div className="mt-1 space-y-0.5">
                    {selectedApplication.pageUrls ? (
                      selectedApplication.pageUrls.split(',').slice(0, 2).map((url, idx) => (
                        <a
                          key={idx}
                          href={url.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 hover:underline block truncate"
                        >
                          {url.trim()}
                        </a>
                      ))
                    ) : selectedApplication.pageLink ? (
                      <a
                        href={selectedApplication.pageLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline block truncate"
                      >
                        {selectedApplication.pageLink}
                      </a>
                    ) : null}
                    {selectedApplication.websiteLink && (
                      <a
                        href={selectedApplication.websiteLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline block truncate"
                      >
                        {selectedApplication.websiteLink}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowDetailsPopup(false)}
                  className="px-4 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-[12px] font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-[11px] text-gray-500">
              No details available
            </div>
          )}
        </div>
      </div>

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
        <div
          className="bg-white rounded-2xl p-6 max-w-md w-[calc(100vw-2rem)] relative shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setShowExportPopup(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-bold text-gray-800 mb-1">Export Data</h3>
          <p className="text-sm text-gray-500 mb-6">Select filters to export specific data</p>

          <div className="space-y-4">
            {/* Platform Selection */}
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
                      exportPlatform === option.value
                        ? 'bg-[#0D9488] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

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
                      exportStatus === option.value
                        ? 'bg-[#0D9488] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Filter with Search & Multi-select */}
            <div className="relative user-dropdown-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">User (Optional)</label>

              {/* Dropdown Trigger Button */}
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`w-full flex items-center justify-between px-4 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                  showUserDropdown
                    ? 'border-[#0D9488] ring-2 ring-[#0D9488]/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={exportSelectedUsers.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
                  {exportSelectedUsers.length > 0
                    ? `${exportSelectedUsers.length} user${exportSelectedUsers.length > 1 ? 's' : ''} selected`
                    : 'Select Users'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown */}
              <div className={`absolute top-full left-0 right-0 mt-2 bg-white border-2 border-[#0D9488]/20 rounded-xl shadow-xl z-50 transition-all duration-200 overflow-hidden ${
                showUserDropdown
                  ? 'opacity-100 visible translate-y-0'
                  : 'opacity-0 invisible -translate-y-2 pointer-events-none'
              }`}>
                {/* Search Input Inside Dropdown */}
                <div className="p-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Type to search (e.g., manish)"
                      value={exportUserSearch}
                      onChange={(e) => setExportUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-[#0D9488]/30 rounded-xl text-sm focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 transition-all"
                    />
                  </div>
                </div>

                {/* Selected Users Tags */}
                {exportSelectedUsers.length > 0 && (
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                    <div className="flex flex-wrap gap-1.5">
                      {exportSelectedUsers.map(userId => {
                        const user = getUserById(userId)
                        return (
                          <span key={userId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0D9488] text-white text-xs font-medium rounded-lg">
                            {user?.username || userId}
                            <button onClick={() => removeSelectedUser(userId)} className="hover:bg-white/20 rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* User List */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors border-b border-gray-50 last:border-0 ${
                          exportSelectedUsers.includes(user.id) ? 'bg-[#0D9488]/5' : ''
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-gray-700 font-medium">{user.username}</span>
                          <span className="text-gray-400 text-xs">{user.email}</span>
                        </div>
                        {exportSelectedUsers.includes(user.id) && (
                          <div className="w-5 h-5 bg-[#0D9488] rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      {exportUserSearch ? 'No users found' : 'No users available'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Date Range with Custom Calendar */}
            <div className="relative calendar-container">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="grid grid-cols-2 gap-3">
                {/* From Date */}
                <button
                  onClick={() => { setShowFromCalendar(!showFromCalendar); setShowToCalendar(false); setCalendarMonth(exportDateFrom || new Date()) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                    showFromCalendar
                      ? 'border-[#0D9488] ring-2 ring-[#0D9488]/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className={exportDateFrom ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateFrom ? formatCalendarDate(exportDateFrom) : 'From date'}
                  </span>
                </button>

                {/* To Date */}
                <button
                  onClick={() => { setShowToCalendar(!showToCalendar); setShowFromCalendar(false); setCalendarMonth(exportDateTo || new Date()) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl text-sm text-left transition-all ${
                    showToCalendar
                      ? 'border-[#0D9488] ring-2 ring-[#0D9488]/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className={exportDateTo ? 'text-gray-700' : 'text-gray-400'}>
                    {exportDateTo ? formatCalendarDate(exportDateTo) : 'To date'}
                  </span>
                </button>
              </div>

              {/* Shared Calendar Popup - Opens below both buttons */}
              {(showFromCalendar || showToCalendar) && (
              <div className="mt-2 bg-white border-2 border-[#0D9488]/20 rounded-xl shadow-xl p-4">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-semibold text-gray-800">
                    {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </span>
                  <button
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Selecting indicator */}
                <div className="text-center mb-3">
                  <span className="text-xs text-[#0D9488] font-medium bg-[#0D9488]/10 px-3 py-1 rounded-full">
                    {showFromCalendar ? 'Select start date' : 'Select end date'}
                  </span>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">{day}</div>
                  ))}
                </div>

                {/* Calendar Days */}
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
                      const isInRange = exportDateFrom && exportDateTo && date > exportDateFrom && date < exportDateTo
                      const isToday = date.toDateString() === new Date().toDateString()
                      days.push(
                        <button
                          key={day}
                          onClick={() => {
                            if (showFromCalendar) {
                              setExportDateFrom(date)
                              setShowFromCalendar(false)
                            } else {
                              setExportDateTo(date)
                              setShowToCalendar(false)
                            }
                          }}
                          className={`py-2 text-sm rounded-lg transition-colors ${
                            isSelectedFrom || isSelectedTo
                              ? 'bg-[#0D9488] text-white font-medium'
                              : isInRange
                              ? 'bg-[#0D9488]/10 text-[#0D9488]'
                              : isToday
                              ? 'bg-gray-100 text-gray-800 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      )
                    }
                    return days
                  })()}
                </div>

                {/* Clear Button */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-400">
                    {exportDateFrom && `From: ${formatCalendarDate(exportDateFrom)}`}
                    {exportDateFrom && exportDateTo && ' - '}
                    {exportDateTo && `To: ${formatCalendarDate(exportDateTo)}`}
                  </span>
                  <button
                    onClick={() => {
                      if (showFromCalendar) {
                        setExportDateFrom(null)
                      } else {
                        setExportDateTo(null)
                      }
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
              <button
                onClick={() => setShowExportPopup(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex-1 px-4 py-2.5 bg-[#52B788] text-white rounded-lg text-sm font-medium hover:bg-[#3d9970] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
