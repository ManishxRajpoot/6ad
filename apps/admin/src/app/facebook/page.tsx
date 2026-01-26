'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { applicationsApi, usersApi, bmShareApi, accountDepositsApi, accountRefundsApi, balanceTransfersApi } from '@/lib/api'
import {
  Search,
  Plus,
  Download,
  MoreVertical,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  TrendingUp,
  TrendingDown,
  Gift
} from 'lucide-react'

type Application = {
  id: string
  applyId: string
  platform: string
  licenseType: 'NEW' | 'OLD'
  licenseNo: string | null
  pageUrls: string | null
  isApp: string | null
  shopifyShop: boolean
  accountDetails: string | null
  adAccountQty: number
  depositAmount: string
  openingFee: string
  platformFee: string
  totalCost: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks: string | null
  adminRemarks: string | null
  approvedAt: string | null
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    uniqueId: string
  }
  adAccounts: any[]
}

type User = {
  id: string
  username: string
  email: string
}

type BmShareRequest = {
  id: string
  applyId: string
  platform: string
  adAccountId: string
  adAccountName: string
  bmId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  message: string | null
  adminRemarks: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
  user: {
    id: string
    username: string
    email: string
    uniqueId: string
  }
}

type AccountDeposit = {
  id: string
  amount: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks: string | null
  adminRemarks: string | null
  approvedAt: string | null
  createdAt: string
  adAccount: {
    id: string
    accountId: string
    accountName: string
    platform: string
    user: {
      id: string
      username: string
      email: string
      uniqueId: string
    }
  }
}

type AccountRefund = {
  id: string
  amount: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason: string | null
  adminRemarks: string | null
  approvedAt: string | null
  createdAt: string
  adAccount: {
    id: string
    accountId: string
    accountName: string
    platform: string
    balance: string
    user: {
      id: string
      username: string
      email: string
      uniqueId: string
    }
  }
}

type BalanceTransfer = {
  id: string
  amount: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks: string | null
  adminRemarks: string | null
  approvedAt: string | null
  createdAt: string
  fromAccount: {
    id: string
    accountId: string
    accountName: string
    platform: string
    balance: string
  }
  toAccount: {
    id: string
    accountId: string
    accountName: string
    platform: string
    balance: string
  }
  user: {
    id: string
    username: string
    email: string
    uniqueId: string
  }
}

type Tab = 'account-list' | 'bm-share' | 'deposit-list' | 'refund-list'
type RefundSubTab = 'refunds' | 'transfers'

export default function FacebookPage() {
  const [activeTab, setActiveTab] = useState<Tab>('account-list')
  const [applications, setApplications] = useState<Application[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // BM Share state
  const [bmShareRequests, setBmShareRequests] = useState<BmShareRequest[]>([])
  const [bmShareLoading, setBmShareLoading] = useState(false)

  // Account Deposits state
  const [accountDeposits, setAccountDeposits] = useState<AccountDeposit[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)

  // Account Refunds state
  const [accountRefunds, setAccountRefunds] = useState<AccountRefund[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)

  // Balance Transfers state
  const [balanceTransfers, setBalanceTransfers] = useState<BalanceTransfer[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)

  // Refund sub-tab state
  const [refundSubTab, setRefundSubTab] = useState<RefundSubTab>('refunds')

  // Edit amount state
  const [editingRefundId, setEditingRefundId] = useState<string | null>(null)
  const [editingRefundAmount, setEditingRefundAmount] = useState<string>('')
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [editingTransferAmount, setEditingTransferAmount] = useState<string>('')

  // Stats
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalApproved: 0,
    totalPending: 0,
    totalRejected: 0
  })

  // Selected items for bulk action
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectMultiple, setSelectMultiple] = useState(false)

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showCouponModal, setShowCouponModal] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    userId: '',
    amount: 1
  })
  const [couponLoading, setCouponLoading] = useState(false)

  // Create Account Form
  const [createForm, setCreateForm] = useState({
    userId: '',
    adAccountQty: 1,
    accounts: [{ name: '', accountId: '' }]
  })

  // Approve Form - account IDs to assign
  const [approveForm, setApproveForm] = useState<{ name: string; accountId: string }[]>([])

  // Bulk Approve Modal
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false)
  const [bulkApproveData, setBulkApproveData] = useState<{
    [applicationId: string]: { name: string; accountId: string }[]
  }>({})
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false)

  // Active menu for row actions
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: boolean }>({ top: false })
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})

  // Status filter dropdown
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)

  const tabs = [
    { id: 'account-list', label: 'Account List' },
    { id: 'bm-share', label: 'BM Share List' },
    { id: 'deposit-list', label: 'Deposit List' },
    { id: 'refund-list', label: 'Refund List' },
  ]

  const fetchData = async () => {
    setLoading(true)
    try {
      const [appsData, usersData, statsData] = await Promise.all([
        applicationsApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined, currentPage),
        usersApi.getAll(),
        applicationsApi.getStats('FACEBOOK')
      ])

      setApplications(appsData.applications || [])
      setTotalPages(appsData.totalPages || 1)
      setUsers(usersData.users || [])
      setStats({
        totalBalance: parseFloat(String(statsData.totalBalance || 0)),
        totalApproved: statsData.approved || 0,
        totalPending: statsData.pending || 0,
        totalRejected: statsData.rejected || 0
      })
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [statusFilter, currentPage])

  // Fetch BM Share requests
  const fetchBmShareRequests = async () => {
    setBmShareLoading(true)
    try {
      const data = await bmShareApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined)
      setBmShareRequests(data.bmShareRequests || [])
    } catch (error) {
      console.error('Failed to fetch BM Share requests:', error)
    } finally {
      setBmShareLoading(false)
    }
  }

  // Fetch Account Deposits
  const fetchAccountDeposits = async () => {
    setDepositsLoading(true)
    try {
      const data = await accountDepositsApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined)
      setAccountDeposits(data.deposits || [])
    } catch (error) {
      console.error('Failed to fetch account deposits:', error)
    } finally {
      setDepositsLoading(false)
    }
  }

  // Fetch Account Refunds
  const fetchAccountRefunds = async () => {
    setRefundsLoading(true)
    try {
      const data = await accountRefundsApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined)
      setAccountRefunds(data.refunds || [])
    } catch (error) {
      console.error('Failed to fetch account refunds:', error)
    } finally {
      setRefundsLoading(false)
    }
  }

  // Fetch Balance Transfers
  const fetchBalanceTransfers = async () => {
    setTransfersLoading(true)
    try {
      const data = await balanceTransfersApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined)
      setBalanceTransfers(data.transfers || [])
    } catch (error) {
      console.error('Failed to fetch balance transfers:', error)
    } finally {
      setTransfersLoading(false)
    }
  }

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'bm-share') {
      fetchBmShareRequests()
    } else if (activeTab === 'deposit-list') {
      fetchAccountDeposits()
    } else if (activeTab === 'refund-list') {
      if (refundSubTab === 'refunds') {
        fetchAccountRefunds()
      } else {
        fetchBalanceTransfers()
      }
    }
  }, [activeTab, statusFilter, refundSubTab])

  // Handle BM Share approve/reject
  const handleBmShareApprove = async (id: string) => {
    try {
      await bmShareApi.approve(id)
      fetchBmShareRequests()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    }
  }

  const handleBmShareReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this BM Share request?')) return
    try {
      await bmShareApi.reject(id)
      fetchBmShareRequests()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    }
  }

  // Handle Account Deposit approve/reject
  const handleDepositApprove = async (id: string) => {
    try {
      await accountDepositsApi.approve(id)
      fetchAccountDeposits()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    }
  }

  const handleDepositReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this deposit request?')) return
    try {
      await accountDepositsApi.reject(id)
      fetchAccountDeposits()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    }
  }

  // Handle Account Refund approve/reject
  const handleRefundApprove = async (id: string) => {
    try {
      await accountRefundsApi.approve(id)
      fetchAccountRefunds()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    }
  }

  const handleRefundReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this refund request?')) return
    try {
      await accountRefundsApi.reject(id)
      fetchAccountRefunds()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    }
  }

  // Handle Balance Transfer approve/reject
  const handleTransferApprove = async (id: string) => {
    try {
      await balanceTransfersApi.approve(id)
      fetchBalanceTransfers()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    }
  }

  const handleTransferReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this transfer request?')) return
    try {
      await balanceTransfersApi.reject(id)
      fetchBalanceTransfers()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    }
  }

  // Handle refund amount edit
  const handleRefundAmountEdit = (refund: AccountRefund) => {
    setEditingRefundId(refund.id)
    setEditingRefundAmount(parseFloat(refund.amount).toFixed(2))
  }

  const handleRefundAmountSave = async (id: string) => {
    const amount = parseFloat(editingRefundAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }
    try {
      await accountRefundsApi.updateAmount(id, amount)
      setEditingRefundId(null)
      setEditingRefundAmount('')
      fetchAccountRefunds()
    } catch (error: any) {
      alert(error.message || 'Failed to update amount')
    }
  }

  const handleRefundAmountCancel = () => {
    setEditingRefundId(null)
    setEditingRefundAmount('')
  }

  // Handle transfer amount edit
  const handleTransferAmountEdit = (transfer: BalanceTransfer) => {
    setEditingTransferId(transfer.id)
    setEditingTransferAmount(parseFloat(transfer.amount).toFixed(2))
  }

  const handleTransferAmountSave = async (id: string) => {
    const amount = parseFloat(editingTransferAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }
    try {
      await balanceTransfersApi.updateAmount(id, amount)
      setEditingTransferId(null)
      setEditingTransferAmount('')
      fetchBalanceTransfers()
    } catch (error: any) {
      alert(error.message || 'Failed to update amount')
    }
  }

  const handleTransferAmountCancel = () => {
    setEditingTransferId(null)
    setEditingTransferAmount('')
  }

  // Parse account details JSON
  const parseAccountDetails = (details: string | null): { name: string; accountId: string }[] => {
    if (!details) return []
    try {
      return JSON.parse(details)
    } catch {
      return []
    }
  }

  // Get ads ID display
  const getAdsIdDisplay = (app: Application) => {
    const accounts = parseAccountDetails(app.accountDetails)
    if (app.status !== 'APPROVED' || accounts.length === 0) {
      return <span className="text-gray-400">---</span>
    }
    const idsWithValues = accounts.filter(a => a.accountId)
    if (idsWithValues.length === 0) {
      return <span className="text-red-500">Nill</span>
    }
    return (
      <div className="flex flex-col">
        {idsWithValues.slice(0, 2).map((a, i) => (
          <span key={i} className="text-blue-600 text-xs">{a.accountId}</span>
        ))}
        {idsWithValues.length > 2 && <span className="text-gray-400 text-xs">+{idsWithValues.length - 2} more</span>}
      </div>
    )
  }

  // Toggle selection
  const toggleSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Select all
  const toggleSelectAll = () => {
    if (selectedItems.length === applications.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(applications.map(a => a.id))
    }
  }

  // Handle view request
  const handleViewRequest = (app: Application) => {
    setSelectedApplication(app)
    setShowViewModal(true)
    setActiveMenu(null)
  }

  // Handle edit request
  const handleEditRequest = (app: Application) => {
    setSelectedApplication(app)
    setShowEditModal(true)
    setActiveMenu(null)
  }

  // Handle approve
  const handleOpenApprove = (app: Application) => {
    setSelectedApplication(app)
    const accounts = parseAccountDetails(app.accountDetails)
    setApproveForm(accounts.map(a => ({ name: a.name, accountId: a.accountId || '' })))
    setShowApproveModal(true)
    setActiveMenu(null)
  }

  // Submit approve
  const handleApprove = async () => {
    if (!selectedApplication) return

    // Validate that at least one account has an ID
    const validAccounts = approveForm.filter(acc => acc.accountId && acc.accountId.trim() !== '')
    if (validAccounts.length === 0) {
      alert('Please enter at least one Account ID')
      return
    }

    try {
      await applicationsApi.approve(selectedApplication.id, validAccounts)
      setShowApproveModal(false)
      setSelectedApplication(null)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    }
  }

  // Handle reject
  const handleReject = async (app: Application, refund: boolean = false) => {
    if (!confirm(`Are you sure you want to reject this application${refund ? ' and refund' : ''}?`)) return

    try {
      await applicationsApi.reject(app.id, refund)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    }
  }

  // Handle create account directly
  const handleCreateAccount = async () => {
    if (!createForm.userId) {
      alert('Please select a user')
      return
    }

    const validAccounts = createForm.accounts.filter(a => a.name && a.accountId)
    if (validAccounts.length === 0) {
      alert('Please enter at least one account with name and ID')
      return
    }

    try {
      await applicationsApi.createDirect(createForm.userId, 'FACEBOOK', validAccounts)
      setShowCreateModal(false)
      setCreateForm({ userId: '', adAccountQty: 1, accounts: [{ name: '', accountId: '' }] })
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to create accounts')
    }
  }

  // Update account quantity in create form
  const updateAccountQty = (qty: number) => {
    const newQty = Math.min(Math.max(1, qty), 5)
    const accounts = [...createForm.accounts]

    while (accounts.length < newQty) {
      accounts.push({ name: '', accountId: '' })
    }
    while (accounts.length > newQty) {
      accounts.pop()
    }

    setCreateForm({ ...createForm, adAccountQty: newQty, accounts })
  }

  // Bulk action
  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedItems.length === 0) {
      alert('No items selected')
      return
    }

    if (action === 'approve') {
      // Get selected applications and prepare bulk approve data
      const selectedApps = applications.filter(app => selectedItems.includes(app.id))
      const initialData: { [applicationId: string]: { name: string; accountId: string }[] } = {}

      selectedApps.forEach(app => {
        // Parse accountDetails if it exists, otherwise use adAccountQty to create empty slots
        let accounts: { name: string; accountId: string }[] = []
        if (app.accountDetails) {
          try {
            const parsed = JSON.parse(app.accountDetails)
            accounts = parsed.map((acc: any) => ({
              name: acc.name || `Account ${accounts.length + 1}`,
              accountId: ''
            }))
          } catch {
            // If parsing fails, create based on quantity
            for (let i = 0; i < (app.adAccountQty || 1); i++) {
              accounts.push({ name: `Account ${i + 1}`, accountId: '' })
            }
          }
        } else {
          for (let i = 0; i < (app.adAccountQty || 1); i++) {
            accounts.push({ name: `Account ${i + 1}`, accountId: '' })
          }
        }
        initialData[app.id] = accounts
      })

      setBulkApproveData(initialData)
      setShowBulkApproveModal(true)
    } else {
      const refund = confirm('Do you want to refund the users?')
      try {
        await applicationsApi.bulkReject(selectedItems, refund)
        setSelectedItems([])
        setSelectMultiple(false)
        fetchData()
      } catch (error: any) {
        alert(error.message || 'Failed to bulk reject')
      }
    }
  }

  // Submit bulk approve
  const handleBulkApproveSubmit = async () => {
    // Validate that each application has at least one account ID
    for (const appId of selectedItems) {
      const accounts = bulkApproveData[appId] || []
      const hasValidAccount = accounts.some(acc => acc.accountId && acc.accountId.trim() !== '')
      if (!hasValidAccount) {
        const app = applications.find(a => a.id === appId)
        alert(`Please enter at least one Account ID for ${app?.user?.username || 'application'}`)
        return
      }
    }

    setBulkApproveLoading(true)
    try {
      // Filter out empty account IDs
      const filteredData: { [applicationId: string]: { name: string; accountId: string }[] } = {}
      for (const appId of selectedItems) {
        filteredData[appId] = (bulkApproveData[appId] || []).filter(acc => acc.accountId && acc.accountId.trim() !== '')
      }

      await applicationsApi.bulkApprove(selectedItems, filteredData)
      setShowBulkApproveModal(false)
      setBulkApproveData({})
      setSelectedItems([])
      setSelectMultiple(false)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to bulk approve')
    } finally {
      setBulkApproveLoading(false)
    }
  }

  // Handle add coupons
  const handleAddCoupons = async () => {
    if (!couponForm.userId) {
      alert('Please select a user')
      return
    }
    if (couponForm.amount < 1) {
      alert('Please enter a valid number of coupons')
      return
    }

    setCouponLoading(true)
    try {
      await usersApi.addCoupons(couponForm.userId, couponForm.amount)
      alert(`Successfully added ${couponForm.amount} coupon(s) to user`)
      setShowCouponModal(false)
      setCouponForm({ userId: '', amount: 1 })
    } catch (error: any) {
      alert(error.message || 'Failed to add coupons')
    } finally {
      setCouponLoading(false)
    }
  }

  // Handle menu toggle with position detection
  const handleMenuToggle = (appId: string) => {
    if (activeMenu === appId) {
      setActiveMenu(null)
      return
    }

    // Check if button is near bottom of viewport
    const button = menuButtonRefs.current[appId]
    if (button) {
      const rect = button.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      // If less than 250px space below, open menu upward
      setMenuPosition({ top: spaceBelow < 250 })
    }
    setActiveMenu(appId)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenu && !(e.target as Element).closest('.action-menu-container')) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenu])

  // Filter applications by search
  const filteredApplications = applications.filter(app => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      app.applyId.toLowerCase().includes(query) ||
      app.user.username.toLowerCase().includes(query) ||
      app.licenseNo?.toLowerCase().includes(query)
    )
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white">
            <Check className="w-3 h-3" />
            Approved
          </span>
        )
      case 'PENDING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white">
            Pending
          </span>
        )
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white">
            Rejected
          </span>
        )
      default:
        return null
    }
  }

  return (
    <DashboardLayout title="Facebook Account Management">
      <div className="space-y-6">
        {/* Header with Search and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-64 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
            />
          </div>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="h-10 px-4 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 focus:border-[#52B788] focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 flex items-center gap-2 transition-all duration-200 min-w-[130px]"
            >
              <span className="capitalize">
                {statusFilter === 'all' ? 'Action' : statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'PENDING' ? 'Pending' : 'Rejected'}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={() => setIsStatusDropdownOpen(false)}
                />
                <div className="absolute left-0 top-12 z-[70] w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  {[
                    { value: 'all', label: 'Action' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value)
                        setIsStatusDropdownOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                        statusFilter === option.value
                          ? 'bg-[#52B788]/10 text-[#52B788] font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {statusFilter === option.value && <Check className="w-4 h-4" />}
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-[#52B788] text-[#52B788] hover:bg-[#52B788]/10"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Account
            </Button>
            <Button
              variant="outline"
              className="border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
              onClick={() => setShowCouponModal(true)}
            >
              <Gift className="w-4 h-4 mr-2" />
              Add Coupon
            </Button>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Image
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">f</span>
              </span>
              Total Balance
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">${stats.totalBalance.toLocaleString()}</span>
              <span className="flex items-center text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                Growth 10%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-gray-600 text-sm mb-1">Total Approved Requests</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.totalApproved}</span>
              <span className="flex items-center text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                Growth 10%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-gray-600 text-sm mb-1">Total Pending Requests</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.totalPending}</span>
              <span className="flex items-center text-xs text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                Growth 10%
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="text-gray-600 text-sm mb-1">Total Rejected Requests</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{stats.totalRejected}</span>
              <span className="flex items-center text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                <TrendingDown className="w-3 h-3 mr-0.5" />
                Decrease 10%
              </span>
            </div>
          </div>
        </div>

        {/* Tabs and Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm" style={{ overflow: 'visible' }}>
          {/* Tabs Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#52B788] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Select Multiple & Action */}
            <div className="flex items-center gap-3">
              {selectMultiple && selectedItems.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBulkAction(e.target.value as any)
                    e.target.value = ''
                  }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Action</option>
                  <option value="approve">Approve Selected</option>
                  <option value="reject">Reject Selected</option>
                </select>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectMultiple}
                  onChange={(e) => {
                    setSelectMultiple(e.target.checked)
                    if (!e.target.checked) setSelectedItems([])
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-[#52B788] focus:ring-[#52B788]"
                />
                Select Multiple
              </label>
            </div>
          </div>

          {/* Table */}
          {activeTab === 'account-list' && (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full" style={{ position: 'relative' }}>
                <thead>
                  <tr className="bg-gray-50 text-left">
                    {selectMultiple && (
                      <th className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === applications.length && applications.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-[#52B788] focus:ring-[#52B788]"
                        />
                      </th>
                    )}
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Apply ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">License Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Ads ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Ad Qty</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[#52B788] uppercase">Total Cost</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Create Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={selectMultiple ? 10 : 9} className="py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={selectMultiple ? 10 : 9} className="py-16 text-center text-gray-500">
                        No applications found
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                        {selectMultiple && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(app.id)}
                              onChange={() => toggleSelection(app.id)}
                              className="w-4 h-4 rounded border-gray-300 text-[#52B788] focus:ring-[#52B788]"
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 text-sm font-medium text-gray-800">{app.user.username}</td>
                        <td className="py-3 px-4 text-sm font-mono text-gray-600">{app.applyId}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className={`text-xs px-2 py-0.5 rounded inline-block w-fit ${
                              app.licenseType === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {app.licenseType}
                            </span>
                            <span className="text-sm text-gray-600 mt-0.5">{app.licenseNo || '---'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getAdsIdDisplay(app)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{String(app.adAccountQty).padStart(2, '0')}</td>
                        <td className="py-3 px-4 text-sm font-bold text-[#52B788]">${parseFloat(app.totalCost).toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(app.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(app.status)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            {/* View Icon */}
                            <button
                              onClick={() => handleViewRequest(app)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all duration-200"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Approve Icon - only for pending */}
                            {app.status === 'PENDING' && (
                              <button
                                onClick={() => handleOpenApprove(app)}
                                className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all duration-200"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            {/* Reject Icon - only for pending */}
                            {app.status === 'PENDING' && (
                              <button
                                onClick={() => handleReject(app, true)}
                                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all duration-200"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* BM Share Tab */}
          {activeTab === 'bm-share' && (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Apply ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">BM ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Message</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bmShareLoading ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : bmShareRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-gray-500">
                        No BM Share requests found
                      </td>
                    </tr>
                  ) : (
                    bmShareRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-mono text-gray-600">{req.applyId}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-800">{req.user.username}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{req.adAccountName}</td>
                        <td className="py-3 px-4 text-sm text-blue-600">{req.adAccountId}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{req.bmId}</td>
                        <td className="py-3 px-4 text-sm text-gray-500 max-w-[150px] truncate">{req.message || '---'}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(req.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(req.status)}</td>
                        <td className="py-3 px-4">
                          {req.status === 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleBmShareApprove(req.id)}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleBmShareReject(req.id)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Deposit List Tab */}
          {activeTab === 'deposit-list' && (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account ID</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[#52B788] uppercase">Amount</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {depositsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : accountDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-gray-500">
                        No deposit requests found
                      </td>
                    </tr>
                  ) : (
                    accountDeposits.map((dep) => (
                      <tr key={dep.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-medium text-gray-800">{dep.adAccount.user.username}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{dep.adAccount.accountName}</td>
                        <td className="py-3 px-4 text-sm text-blue-600">{dep.adAccount.accountId}</td>
                        <td className="py-3 px-4 text-sm font-bold text-[#52B788]">${parseFloat(dep.amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm text-gray-500 max-w-[150px] truncate">{dep.remarks || '---'}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(dep.createdAt).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(dep.status)}</td>
                        <td className="py-3 px-4">
                          {dep.status === 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDepositApprove(dep.id)}
                                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDepositReject(dep.id)}
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Refund List Tab */}
          {activeTab === 'refund-list' && (
            <div>
              {/* Sub-tabs for Refunds and Transfers */}
              <div className="px-4 pt-3 pb-0 border-b border-gray-100">
                <div className="flex gap-4">
                  <button
                    onClick={() => setRefundSubTab('refunds')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      refundSubTab === 'refunds'
                        ? 'border-[#52B788] text-[#52B788]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Refund Requests
                  </button>
                  <button
                    onClick={() => setRefundSubTab('transfers')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      refundSubTab === 'transfers'
                        ? 'border-[#52B788] text-[#52B788]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Balance Transfers
                  </button>
                </div>
              </div>

              {/* Refunds Table */}
              {refundSubTab === 'refunds' && (
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User Name</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account ID</th>
                        <th className="py-3 px-4 text-xs font-semibold text-[#EF4444] uppercase">Refund Amount</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Account Balance</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {refundsLoading ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2"></div>
                              <span className="text-gray-500">Loading...</span>
                            </div>
                          </td>
                        </tr>
                      ) : accountRefunds.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center text-gray-500">
                            No refund requests found
                          </td>
                        </tr>
                      ) : (
                        accountRefunds.map((ref) => (
                          <tr key={ref.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm font-medium text-gray-800">{ref.adAccount.user.username}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{ref.adAccount.accountName}</td>
                            <td className="py-3 px-4 text-sm text-blue-600">{ref.adAccount.accountId}</td>
                            <td className="py-3 px-4">
                              {editingRefundId === ref.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[#EF4444] font-bold">$</span>
                                  <input
                                    type="number"
                                    value={editingRefundAmount}
                                    onChange={(e) => setEditingRefundAmount(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#52B788]"
                                    min="0"
                                    step="0.01"
                                  />
                                  <button
                                    onClick={() => handleRefundAmountSave(ref.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Save"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleRefundAmountCancel}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-[#EF4444]">${parseFloat(ref.amount).toFixed(2)}</span>
                                  {ref.status === 'PENDING' && (
                                    <button
                                      onClick={() => handleRefundAmountEdit(ref)}
                                      className="p-1 text-gray-400 hover:text-[#52B788] hover:bg-gray-100 rounded transition-colors"
                                      title="Edit amount"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">${parseFloat(ref.adAccount.balance).toFixed(2)}</td>
                            <td className="py-3 px-4 text-sm text-gray-500 max-w-[150px] truncate">{ref.reason || '---'}</td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(ref.createdAt).toLocaleDateString('en-GB')}
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(ref.status)}</td>
                            <td className="py-3 px-4">
                              {ref.status === 'PENDING' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleRefundApprove(ref.id)}
                                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRefundReject(ref.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Balance Transfers Table */}
              {refundSubTab === 'transfers' && (
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">User Name</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">From Account</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">To Account</th>
                        <th className="py-3 px-4 text-xs font-semibold text-[#8B5CF6] uppercase">Amount</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transfersLoading ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2"></div>
                              <span className="text-gray-500">Loading...</span>
                            </div>
                          </td>
                        </tr>
                      ) : balanceTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-16 text-center text-gray-500">
                            No transfer requests found
                          </td>
                        </tr>
                      ) : (
                        balanceTransfers.map((tr) => (
                          <tr key={tr.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm font-medium text-gray-800">{tr.user.username}</td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-600">{tr.fromAccount.accountName}</div>
                              <div className="text-xs text-blue-600">{tr.fromAccount.accountId}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="text-sm text-gray-600">{tr.toAccount.accountName}</div>
                              <div className="text-xs text-blue-600">{tr.toAccount.accountId}</div>
                            </td>
                            <td className="py-3 px-4">
                              {editingTransferId === tr.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[#8B5CF6] font-bold">$</span>
                                  <input
                                    type="number"
                                    value={editingTransferAmount}
                                    onChange={(e) => setEditingTransferAmount(e.target.value)}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#52B788]"
                                    min="0"
                                    step="0.01"
                                  />
                                  <button
                                    onClick={() => handleTransferAmountSave(tr.id)}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    title="Save"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleTransferAmountCancel}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-bold text-[#8B5CF6]">${parseFloat(tr.amount).toFixed(2)}</span>
                                  {tr.status === 'PENDING' && (
                                    <button
                                      onClick={() => handleTransferAmountEdit(tr)}
                                      className="p-1 text-gray-400 hover:text-[#52B788] hover:bg-gray-100 rounded transition-colors"
                                      title="Edit amount"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 max-w-[150px] truncate">{tr.remarks || '---'}</td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {new Date(tr.createdAt).toLocaleDateString('en-GB')}
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(tr.status)}</td>
                            <td className="py-3 px-4">
                              {tr.status === 'PENDING' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleTransferApprove(tr.id)}
                                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleTransferReject(tr.id)}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#52B788] text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-2 text-gray-400">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-8 h-8 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Account"
      >
        <p className="text-sm text-gray-500 mb-4">Create an account for the user directly add data</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
            <select
              value={createForm.userId}
              onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
            >
              <option value="">Select User</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account Numbers</label>
            <select
              value={createForm.adAccountQty}
              onChange={(e) => updateAccountQty(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>Select No of Accounts (for example {n})</option>
              ))}
            </select>
          </div>

          {createForm.accounts.map((acc, index) => (
            <div key={index} className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account Name</label>
                <input
                  type="text"
                  value={acc.name}
                  onChange={(e) => {
                    const newAccounts = [...createForm.accounts]
                    newAccounts[index].name = e.target.value
                    setCreateForm({ ...createForm, accounts: newAccounts })
                  }}
                  placeholder="Enter Account Name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account ID</label>
                <input
                  type="text"
                  value={acc.accountId}
                  onChange={(e) => {
                    const newAccounts = [...createForm.accounts]
                    newAccounts[index].accountId = e.target.value
                    setCreateForm({ ...createForm, accounts: newAccounts })
                  }}
                  placeholder="Enter ID"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount}>
              Submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Request Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Add Application Details"
      >
        {selectedApplication && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Apply ID:</span>
                <span className="ml-2 font-medium">{selectedApplication.applyId}</span>
              </div>
              <div>
                <span className="text-gray-500">License No.:</span>
                <span className="ml-2 font-medium">{selectedApplication.licenseNo || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Page URL's:</span>
                <span className="ml-2 font-medium">{selectedApplication.pageUrls || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Is App:</span>
                <span className="ml-2 font-medium">{selectedApplication.isApp || '---'}</span>
              </div>
              <div>
                <span className="text-gray-500">Shopify Shop:</span>
                <span className="ml-2 font-medium">{selectedApplication.shopifyShop ? 'Yes' : 'No'}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Deposit:</span>
                <span className="ml-2 font-medium">${parseFloat(selectedApplication.depositAmount).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Cost:</span>
                <span className="ml-2 font-medium">${parseFloat(selectedApplication.totalCost).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Apply Time:</span>
                <span className="ml-2 font-medium">{new Date(selectedApplication.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-sm">Ads Account:</span>
              <div className="mt-1 space-y-1">
                {parseAccountDetails(selectedApplication.accountDetails).map((acc, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{acc.name}</span>
                    {acc.accountId && <span className="text-blue-600 ml-2">ID: {acc.accountId}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-gray-500 text-sm">Remarks:</span>
              <p className="text-sm mt-1">{selectedApplication.remarks || 'No remarks'}</p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              {selectedApplication.status === 'PENDING' && (
                <Button onClick={() => {
                  setShowViewModal(false)
                  handleEditRequest(selectedApplication)
                }}>
                  Edit Information
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal - Add Account ID */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Add Account ID for Approval"
      >
        {selectedApplication && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Give an ID for the Approval process to user</p>

            {approveForm.map((acc, index) => (
              <div key={index} className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
                  <input
                    type="text"
                    value={selectedApplication.user.username}
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account Name</label>
                  <input
                    type="text"
                    value={acc.name}
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account ID</label>
                  <input
                    type="text"
                    value={acc.accountId}
                    onChange={(e) => {
                      const newForm = [...approveForm]
                      newForm[index].accountId = e.target.value
                      setApproveForm(newForm)
                    }}
                    placeholder="Add ID"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove}>
                Submit
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Approve Modal */}
      <Modal
        isOpen={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        title={`Approve ${selectedItems.length} Application(s)`}
      >
        <p className="text-sm text-gray-500 mb-4">Enter Account IDs for each application. At least one Account ID is required per application.</p>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {selectedItems.map((appId) => {
            const app = applications.find(a => a.id === appId)
            if (!app) return null

            return (
              <div key={appId} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#52B788]/10 flex items-center justify-center text-[#52B788] font-medium text-sm">
                    {app.user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{app.user?.username || 'Unknown User'}</p>
                    <p className="text-xs text-gray-500">{app.applyId}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(bulkApproveData[appId] || []).map((acc, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Account Name</label>
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => {
                            const newData = { ...bulkApproveData }
                            newData[appId][index].name = e.target.value
                            setBulkApproveData(newData)
                          }}
                          placeholder="Account Name"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Account ID <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={acc.accountId}
                          onChange={(e) => {
                            const newData = { ...bulkApproveData }
                            newData[appId][index].accountId = e.target.value
                            setBulkApproveData(newData)
                          }}
                          placeholder="Enter Account ID"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
          <Button variant="outline" onClick={() => setShowBulkApproveModal(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkApproveSubmit}
            disabled={bulkApproveLoading}
            className="bg-[#52B788] hover:bg-[#40916C]"
          >
            {bulkApproveLoading ? 'Approving...' : `Approve ${selectedItems.length} Application(s)`}
          </Button>
        </div>
      </Modal>

      {/* Add Coupon Modal */}
      <Modal
        isOpen={showCouponModal}
        onClose={() => setShowCouponModal(false)}
        title="Add Coupon"
      >
        <p className="text-sm text-gray-500 mb-4">Add free ad account coupons to a user. Each coupon allows the user to apply for 1 free ad account.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            <select
              value={couponForm.userId}
              onChange={(e) => setCouponForm({ ...couponForm, userId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
            >
              <option value="">Select User</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.username} ({user.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Coupons</label>
            <input
              type="number"
              min="1"
              max="100"
              value={couponForm.amount}
              onChange={(e) => setCouponForm({ ...couponForm, amount: parseInt(e.target.value) || 1 })}
              placeholder="Enter number of coupons"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCouponModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCoupons}
              disabled={couponLoading}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
            >
              {couponLoading ? 'Adding...' : 'Add Coupons'}
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
