'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { applicationsApi, usersApi, bmShareApi, accountDepositsApi, accountRefundsApi, balanceTransfersApi, extensionApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Search,
  Plus,
  Download,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Gift,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck
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
  commissionAmount?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  remarks: string | null
  adminRemarks: string | null
  approvedAt: string | null
  createdAt: string
  rechargeStatus?: string
  rechargeMethod?: string
  rechargeError?: string | null
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

type Tab = 'account-list' | 'bm-share' | 'deposit-list' | 'refund-list'

// Stats Chart Component
const StatsChart = ({ value, color }: { value: number; color: string }) => {
  const height = Math.min(40, Math.max(10, value / 10))
  return (
    <div className="absolute bottom-0 right-0 w-24 h-12 opacity-30">
      <svg viewBox="0 0 100 50" className="w-full h-full">
        <path
          d={`M0,50 L0,${50 - height} Q25,${50 - height - 10} 50,${50 - height + 5} T100,${50 - height - 5} L100,50 Z`}
          fill={color}
          opacity="0.3"
        />
        <path
          d={`M0,${50 - height} Q25,${50 - height - 10} 50,${50 - height + 5} T100,${50 - height - 5}`}
          stroke={color}
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  )
}

export default function FacebookPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('account-list')
  const [applications, setApplications] = useState<Application[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)

  // BM Share state
  const [bmShareRequests, setBmShareRequests] = useState<BmShareRequest[]>([])
  const [bmShareLoading, setBmShareLoading] = useState(false)

  // Account Deposits state
  const [accountDeposits, setAccountDeposits] = useState<AccountDeposit[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)
  const [cheetahStatus, setCheetahStatus] = useState<Record<string, boolean>>({})
  const [approvingDepositId, setApprovingDepositId] = useState<string | null>(null)

  // Account Refunds state
  const [accountRefunds, setAccountRefunds] = useState<AccountRefund[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)

  // Edit amount state
  const [editingRefundId, setEditingRefundId] = useState<string | null>(null)
  const [editingRefundAmount, setEditingRefundAmount] = useState<string>('')

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

  // Approve Form
  const [approveForm, setApproveForm] = useState<{ name: string; accountId: string }[]>([])

  // Bulk Approve Modal
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false)
  const [bulkApproveData, setBulkApproveData] = useState<{
    [applicationId: string]: { name: string; accountId: string }[]
  }>({})
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false)

  // Extension profiles for AdsPower profile selection
  const [extensionProfiles, setExtensionProfiles] = useState<any[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('') // For approve/create modals
  const [bulkSelectedProfileId, setBulkSelectedProfileId] = useState<string>('') // For bulk approve modal

  // Tab refs for dynamic indicator positioning
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const tabs = [
    { id: 'account-list', label: 'Account List' },
    { id: 'bm-share', label: 'BM Share List' },
    { id: 'deposit-list', label: 'Deposit List' },
    { id: 'refund-list', label: 'Refund List' },
  ]

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      const activeRef = tabRefs.current[activeTab]
      if (activeRef) {
        setIndicatorStyle({
          left: activeRef.offsetLeft,
          width: activeRef.offsetWidth,
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
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch extension profiles for AdsPower dropdown
  const fetchExtensionProfiles = async () => {
    try {
      const data = await extensionApi.profiles.getAll()
      setExtensionProfiles(data.profiles || [])
    } catch (error) {
      console.error('Failed to fetch extension profiles:', error)
    }
  }

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

  // Fetch extension profiles once on mount
  useEffect(() => {
    fetchExtensionProfiles()
  }, [])

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
      const deposits = data.deposits || []
      setAccountDeposits(deposits)

      // Check Cheetah status for pending Facebook deposits
      const pendingFbAccountIds = deposits
        .filter((d: AccountDeposit) => d.status === 'PENDING' && d.adAccount.platform === 'FACEBOOK')
        .map((d: AccountDeposit) => d.adAccount.accountId)
        .filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index) // unique

      if (pendingFbAccountIds.length > 0) {
        try {
          const result = await accountDepositsApi.checkCheetah(pendingFbAccountIds)
          setCheetahStatus(result.cheetahStatus || {})
        } catch {
          // Silently fail - Cheetah status is optional UI enhancement
        }
      }
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

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'bm-share') {
      fetchBmShareRequests()
    } else if (activeTab === 'deposit-list') {
      fetchAccountDeposits()
    } else if (activeTab === 'refund-list') {
      fetchAccountRefunds()
    }
  }, [activeTab, statusFilter])

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
    setApprovingDepositId(id)
    try {
      const result = await accountDepositsApi.approve(id)

      // Show appropriate toast based on recharge result
      if (result.cheetahRecharge === 'success') {
        toast.success('Deposit Approved', 'Deposit approved and ad account recharged automatically')
      } else if (result.rechargeStatus === 'PENDING' && result.rechargeMethod === 'EXTENSION') {
        toast.success('Deposit Approved', 'Deposit approved. Extension will auto-recharge the spending limit shortly.')
      } else if (result.cheetahRecharge === 'not-cheetah') {
        toast.success('Deposit Approved', 'Deposit approved. Extension will handle the recharge.')
      } else {
        toast.success('Deposit Approved', 'Deposit approved successfully')
      }

      fetchAccountDeposits()
    } catch (error: any) {
      // Cheetah errors return 400 - deposit stays PENDING
      toast.error('Recharge Failed', error.message || 'Cheetah recharge failed. Deposit kept pending.')
      fetchAccountDeposits()
    } finally {
      setApprovingDepositId(null)
    }
  }

  const handleDepositReject = async (id: string) => {
    if (!confirm('Are you sure you want to reject this deposit request?')) return
    try {
      await accountDepositsApi.reject(id)
      toast.success('Deposit Rejected', 'Deposit rejected and amount refunded to user wallet')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Failed to Reject', error.message || 'Failed to reject deposit')
    }
  }

  const handleRetryRecharge = async (id: string) => {
    try {
      await accountDepositsApi.retryRecharge(id)
      toast.success('Retry Queued', 'Recharge will be retried by the extension shortly')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Retry Failed', error.message || 'Failed to queue retry')
    }
  }

  const handleForceApprove = async (id: string) => {
    if (!confirm('Force approve will mark recharge as completed WITHOUT updating the Facebook spending limit. Are you sure?')) return
    try {
      await accountDepositsApi.forceApprove(id)
      toast.success('Force Approved', 'Deposit marked as completed. Update spending limit manually if needed.')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Force Approve Failed', error.message || 'Failed to force approve')
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
          <span key={i} className="text-[#52B788] text-xs font-mono">{a.accountId}</span>
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
  }

  // Handle approve
  const handleOpenApprove = (app: Application) => {
    setSelectedApplication(app)
    const accounts = parseAccountDetails(app.accountDetails)
    setApproveForm(accounts.map(a => ({ name: a.name, accountId: a.accountId || '' })))
    setSelectedProfileId('') // Reset profile selection (None by default)
    setShowApproveModal(true)
  }

  // Submit approve
  const handleApprove = async () => {
    if (!selectedApplication) return

    const validAccounts = approveForm.filter(acc => acc.accountId && acc.accountId.trim() !== '')
    if (validAccounts.length === 0) {
      alert('Please enter at least one Account ID')
      return
    }

    try {
      await applicationsApi.approve(selectedApplication.id, validAccounts, selectedProfileId || undefined)
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
      await applicationsApi.createDirect(createForm.userId, 'FACEBOOK', validAccounts, selectedProfileId || undefined)
      setShowCreateModal(false)
      setCreateForm({ userId: '', adAccountQty: 1, accounts: [{ name: '', accountId: '' }] })
      setSelectedProfileId('')
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
      const selectedApps = applications.filter(app => selectedItems.includes(app.id))
      const initialData: { [applicationId: string]: { name: string; accountId: string }[] } = {}

      selectedApps.forEach(app => {
        let accounts: { name: string; accountId: string }[] = []
        if (app.accountDetails) {
          try {
            const parsed = JSON.parse(app.accountDetails)
            accounts = parsed.map((acc: any) => ({
              name: acc.name || `Account ${accounts.length + 1}`,
              accountId: ''
            }))
          } catch {
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
      setBulkSelectedProfileId('') // Reset profile selection
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
      const filteredData: { [applicationId: string]: { name: string; accountId: string }[] } = {}
      for (const appId of selectedItems) {
        filteredData[appId] = (bulkApproveData[appId] || []).filter(acc => acc.accountId && acc.accountId.trim() !== '')
      }

      await applicationsApi.bulkApprove(selectedItems, filteredData, bulkSelectedProfileId || undefined)
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
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#52B788] text-white">Approved</span>
      case 'PENDING':
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#F59E0B] text-white">Pending</span>
      case 'REJECTED':
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#EF4444] text-white">Rejected</span>
      default:
        return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <DashboardLayout title="Facebook Account Management" subtitle="">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Fixed Top Section */}
        <div className="flex-shrink-0 pb-4">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, ID, accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] bg-white"
                />
              </div>

              {/* Status Filter - Custom Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white"
                >
                  <span>{statusFilter === 'all' ? 'All Status' : statusFilter === 'APPROVED' ? 'Approved' : statusFilter === 'PENDING' ? 'Pending' : 'Rejected'}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
                </button>
                <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                  showStatusDropdown
                    ? 'opacity-100 scale-y-100 translate-y-0 visible'
                    : 'opacity-0 scale-y-95 -translate-y-1 invisible'
                }`}>
                  {[
                    { value: 'all', label: 'All Status' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'REJECTED', label: 'Rejected' },
                  ].map((option, index) => (
                    <button
                      key={option.value}
                      onClick={() => { setStatusFilter(option.value); setShowStatusDropdown(false); setCurrentPage(1) }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${statusFilter === option.value ? 'text-[#52B788] bg-[#52B788]/5 font-medium' : 'text-gray-600'}`}
                      style={{ transitionDelay: showStatusDropdown ? `${index * 30}ms` : '0ms' }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedProfileId(''); setShowCreateModal(true) }}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#52B788] text-[#52B788] rounded-lg text-sm font-medium hover:bg-[#52B788]/5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Account
              </button>
              <button
                onClick={() => setShowCouponModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#8B5CF6] text-[#8B5CF6] rounded-lg text-sm font-medium hover:bg-[#8B5CF6]/5 transition-colors"
              >
                <Gift className="w-4 h-4" />
                Add Coupon
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export Image
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Balance - Blue */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Balance</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">${stats.totalBalance.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-medium rounded">Total</span>
              </div>
              <StatsChart value={stats.totalBalance} color="#3B82F6" />
            </Card>

            {/* Total Approved - Green */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Approved Requests</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalApproved.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#52B788] text-white text-xs font-medium rounded">Approved</span>
              </div>
              <StatsChart value={stats.totalApproved} color="#52B788" />
            </Card>

            {/* Total Pending - Orange */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Pending Requests</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalPending.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-xs font-medium rounded">Pending</span>
              </div>
              <StatsChart value={stats.totalPending} color="#F59E0B" />
            </Card>

            {/* Total Rejected - Red */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Rejected Requests</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalRejected.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#EF4444] text-white text-xs font-medium rounded">Rejected</span>
              </div>
              <StatsChart value={stats.totalRejected} color="#EF4444" />
            </Card>
          </div>
        </div>

        {/* Tabs & Table - Flex grow to fill remaining space */}
        <Card className="p-0 overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100">
            <div className="flex relative px-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el }}
                  onClick={() => { setActiveTab(tab.id as Tab); setCurrentPage(1) }}
                  className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 ${
                    activeTab === tab.id
                      ? 'text-[#52B788]'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-[#52B788] transition-all duration-300 ease-out"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            </div>

            {/* Select Multiple & Action */}
            <div className="flex items-center justify-end gap-3 px-4 pb-3">
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

          {/* Table - Scrollable area */}
          <div className="overflow-auto flex-1 min-h-0" key={activeTab}>
            <table className="w-full">
              <thead>
                {activeTab === 'account-list' && (
                  <tr className="bg-gray-50/50">
                    {selectMultiple && (
                      <th className="py-3 px-4 text-left">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === applications.length && applications.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-[#52B788] focus:ring-[#52B788]"
                        />
                      </th>
                    )}
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">USER NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">APPLY ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">LICENSE NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ADS ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">AD QTY</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#52B788] whitespace-nowrap">TOTAL COST</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">CREATE DATE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">STATUS</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">EDIT</th>
                  </tr>
                )}
                {activeTab === 'bm-share' && (
                  <tr className="bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">APPLY ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">USER NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">BM ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">MESSAGE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">DATE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">STATUS</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACTION</th>
                  </tr>
                )}
                {activeTab === 'deposit-list' && (
                  <tr className="bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">USER NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#52B788] whitespace-nowrap">AMOUNT</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-orange-500 whitespace-nowrap">TOTAL COST</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">REMARKS</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">DATE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">STATUS</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">RECHARGE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACTION</th>
                  </tr>
                )}
                {activeTab === 'refund-list' && (
                  <tr className="bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">USER NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT NAME</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#EF4444] whitespace-nowrap">REFUND AMOUNT</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACCOUNT BALANCE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">REASON</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">DATE</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">STATUS</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">ACTION</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {/* Account List Tab */}
                {activeTab === 'account-list' && (
                  loading ? (
                    <tr>
                      <td colSpan={selectMultiple ? 10 : 9} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#52B788] animate-spin mb-2" />
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredApplications.length === 0 ? (
                    <tr>
                      <td colSpan={selectMultiple ? 10 : 9} className="py-12 text-center text-gray-500">
                        No applications found
                      </td>
                    </tr>
                  ) : (
                    filteredApplications.map((app, index) => (
                      <tr
                        key={app.id}
                        className="border-b border-gray-50 hover:bg-gray-50/50 align-middle"
                      >
                        {selectMultiple && (
                          <td className="py-4 px-4">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(app.id)}
                              onChange={() => toggleSelection(app.id)}
                              className="w-4 h-4 rounded border-gray-300 text-[#52B788] focus:ring-[#52B788]"
                            />
                          </td>
                        )}
                        <td className="py-4 px-4 text-sm text-gray-700 whitespace-nowrap">{app.user.username}</td>
                        <td className="py-4 px-4 text-sm text-gray-600 font-mono">{app.applyId}</td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className={`text-xs px-2 py-0.5 rounded inline-block w-fit ${
                              app.licenseType === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {app.licenseType}
                            </span>
                            <span className="text-sm text-gray-600 mt-0.5">{app.licenseNo || '---'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">{getAdsIdDisplay(app)}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{String(app.adAccountQty).padStart(2, '0')}</td>
                        <td className="py-4 px-4 text-sm font-semibold text-[#52B788] whitespace-nowrap">${parseFloat(app.totalCost).toFixed(2)}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(app.createdAt)}</td>
                        <td className="py-4 px-4">{getStatusBadge(app.status)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewRequest(app)}
                              className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-all duration-200"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {app.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleOpenApprove(app)}
                                  className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition-all duration-200"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(app, true)}
                                  className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all duration-200"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                )}

                {/* BM Share Tab */}
                {activeTab === 'bm-share' && (
                  bmShareLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#52B788] animate-spin mb-2" />
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : bmShareRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        No BM Share requests found
                      </td>
                    </tr>
                  ) : (
                    bmShareRequests.map((req) => (
                      <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50 align-middle">
                        <td className="py-4 px-4 text-sm text-gray-600 font-mono">{req.applyId}</td>
                        <td className="py-4 px-4 text-sm text-gray-700 whitespace-nowrap">{req.user.username}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{req.adAccountName}</td>
                        <td className="py-4 px-4 text-sm text-[#52B788] font-mono">{req.adAccountId}</td>
                        <td className="py-4 px-4 text-sm text-[#8B5CF6] font-mono">{req.bmId}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 max-w-[150px] truncate">{req.message || '---'}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(req.createdAt)}</td>
                        <td className="py-4 px-4">{getStatusBadge(req.status)}</td>
                        <td className="py-4 px-4">
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
                  )
                )}

                {/* Deposit List Tab */}
                {activeTab === 'deposit-list' && (
                  depositsLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#52B788] animate-spin mb-2" />
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : accountDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-gray-500">
                        No deposit requests found
                      </td>
                    </tr>
                  ) : (
                    accountDeposits.map((dep) => {
                      const depositAmount = parseFloat(dep.amount) || 0
                      const commissionAmount = parseFloat(dep.commissionAmount || '0') || 0
                      const totalCost = depositAmount + commissionAmount
                      const isNotCheetah = dep.adAccount.platform === 'FACEBOOK' && cheetahStatus[dep.adAccount.accountId] === false
                      return (
                        <tr key={dep.id} className="border-b border-gray-50 hover:bg-gray-50/50 align-middle">
                          <td className="py-4 px-4 text-sm text-gray-700 whitespace-nowrap">{dep.adAccount.user.username}</td>
                          <td className="py-4 px-4 text-sm text-gray-600">{dep.adAccount.accountName}</td>
                          <td className="py-4 px-4 text-sm font-mono whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#52B788]">{dep.adAccount.accountId}</span>
                              {isNotCheetah && dep.status === 'PENDING' && (
                                <span title="Not a Cheetah account — manual recharge required" className="inline-flex items-center">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-sm font-semibold text-[#52B788]">${depositAmount.toFixed(2)}</td>
                          <td className="py-4 px-4 text-sm font-semibold text-orange-600">
                            ${totalCost.toFixed(2)}
                            {commissionAmount > 0 && (
                              <span className="text-xs font-normal text-gray-400 ml-1">
                                (+${commissionAmount.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-500 max-w-[150px] truncate">{dep.remarks || '---'}</td>
                          <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(dep.createdAt)}</td>
                          <td className="py-4 px-4">
                            {/* Show Failed badge when recharge failed, Approved otherwise */}
                            {dep.status === 'APPROVED' && dep.rechargeStatus === 'FAILED' ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                ❌ Failed
                              </span>
                            ) : (
                              getStatusBadge(dep.status)
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {dep.status === 'APPROVED' && dep.rechargeMethod === 'EXTENSION' && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                dep.rechargeStatus === 'PENDING' ? 'bg-yellow-50 text-yellow-700' :
                                dep.rechargeStatus === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 animate-pulse' :
                                dep.rechargeStatus === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                                dep.rechargeStatus === 'FAILED' ? 'bg-red-50 text-red-700' :
                                'bg-gray-50 text-gray-500'
                              }`}>
                                {dep.rechargeStatus === 'PENDING' && '⏳ Queued'}
                                {dep.rechargeStatus === 'IN_PROGRESS' && '⚡ Working...'}
                                {dep.rechargeStatus === 'COMPLETED' && '✅ Done'}
                                {dep.rechargeStatus === 'FAILED' && '❌ Failed'}
                              </span>
                            )}
                            {dep.status === 'APPROVED' && dep.rechargeMethod === 'CHEETAH' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                ✅ Auto
                              </span>
                            )}
                            {dep.status === 'APPROVED' && dep.rechargeMethod === 'MANUAL' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                ✅ Done
                              </span>
                            )}
                            {dep.status === 'APPROVED' && (!dep.rechargeMethod || dep.rechargeMethod === 'NONE') && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                            {dep.status !== 'APPROVED' && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {dep.status === 'PENDING' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDepositApprove(dep.id)}
                                  disabled={approvingDepositId === dep.id}
                                  className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  {approvingDepositId === dep.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDepositReject(dep.id)}
                                  disabled={approvingDepositId === dep.id}
                                  className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {dep.status === 'APPROVED' && dep.rechargeStatus === 'FAILED' && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRetryRecharge(dep.id)}
                                  className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="Retry Recharge"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleForceApprove(dep.id)}
                                  className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                  title="Force Approve (skip recharge)"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )
                )}

                {/* Refund List Tab */}
                {activeTab === 'refund-list' && (
                  refundsLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#52B788] animate-spin mb-2" />
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : accountRefunds.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-gray-500">
                        No refund requests found
                      </td>
                    </tr>
                  ) : (
                    accountRefunds.map((ref) => (
                      <tr key={ref.id} className="border-b border-gray-50 hover:bg-gray-50/50 align-middle">
                        <td className="py-4 px-4 text-sm text-gray-700 whitespace-nowrap">{ref.adAccount.user.username}</td>
                        <td className="py-4 px-4 text-sm text-gray-600">{ref.adAccount.accountName}</td>
                        <td className="py-4 px-4 text-sm text-[#52B788] font-mono">{ref.adAccount.accountId}</td>
                        <td className="py-4 px-4">
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
                                onClick={() => { setEditingRefundId(null); setEditingRefundAmount('') }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-[#EF4444]">${parseFloat(ref.amount).toFixed(2)}</span>
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
                        <td className="py-4 px-4 text-sm text-gray-600">${parseFloat(ref.adAccount.balance).toFixed(2)}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 max-w-[150px] truncate">{ref.reason || '---'}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">{formatDate(ref.createdAt)}</td>
                        <td className="py-4 px-4">{getStatusBadge(ref.status)}</td>
                        <td className="py-4 px-4">
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
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Fixed at bottom */}
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
                      currentPage === page
                        ? 'bg-[#52B788] text-white'
                        : 'text-gray-600 hover:bg-gray-100'
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
                        currentPage === page
                          ? 'bg-[#52B788] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
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
                        currentPage === page
                          ? 'bg-[#52B788] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
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

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Account"
      >
        <p className="text-sm text-gray-500 mb-4">Create an account for the user directly add data</p>

        <div className="space-y-4">
          <Select
            label="User Name"
            options={users.map(user => ({ value: user.id, label: user.username }))}
            value={createForm.userId}
            onChange={(value) => setCreateForm({ ...createForm, userId: value })}
            placeholder="Select User"
            searchable
            searchPlaceholder="Search user..."
          />

          <Select
            label="Ad Account Numbers"
            options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `Select No of Accounts (for example ${n})` }))}
            value={String(createForm.adAccountQty)}
            onChange={(value) => updateAccountQty(parseInt(value))}
            placeholder="Select No of Accounts"
          />

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

          {/* AdsPower Profile Selection */}
          <Select
            label="AdsPower Profile"
            options={[
              { value: '', label: 'None (Card Account)' },
              ...extensionProfiles.filter(p => p.isEnabled).map((p) => ({
                value: p.id,
                label: `${p.adsPowerSerialNumber ? `#${p.adsPowerSerialNumber}` : ''} ${p.label}`.trim()
              }))
            ]}
            value={selectedProfileId}
            onChange={(value) => setSelectedProfileId(value)}
            placeholder="Select AdsPower Profile"
            searchable
            searchPlaceholder="Search profile..."
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount} className="bg-[#52B788] hover:bg-[#40916C]">
              Submit
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Request Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Application Details"
      >
        {selectedApplication && (
          <div className="space-y-4">
            {/* Status Banner */}
            <div className={`p-4 rounded-lg ${
              selectedApplication.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
              selectedApplication.status === 'PENDING' ? 'bg-orange-50 border border-orange-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-600">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedApplication.status)}</div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">User</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{selectedApplication.user?.username || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{selectedApplication.user?.email}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Apply ID</span>
                <p className="text-sm font-mono font-semibold text-gray-800 mt-1">{selectedApplication.applyId}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">License No.</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{selectedApplication.licenseNo || '---'}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Deposit</span>
                <p className="text-sm font-bold text-[#52B788] mt-1">${parseFloat(selectedApplication.depositAmount).toFixed(2)}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</span>
                <p className="text-sm font-bold text-orange-500 mt-1">${parseFloat(selectedApplication.totalCost).toFixed(2)}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Apply Time</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{new Date(selectedApplication.createdAt).toLocaleString()}</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Ad Accounts ({selectedApplication.adAccountQty} requested)</span>
                <div className="mt-3 space-y-2">
                  {parseAccountDetails(selectedApplication.accountDetails).length > 0 ? (
                    parseAccountDetails(selectedApplication.accountDetails).map((acc, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2 py-0.5 bg-[#52B788]/10 text-[#52B788] text-sm font-medium rounded">
                            {acc.name}
                          </span>
                          <span className="text-gray-300 text-lg">→</span>
                          {acc.accountId ? (
                            <span className="px-2 py-0.5 bg-[#8B5CF6]/10 text-[#8B5CF6] text-sm font-mono font-medium rounded">
                              {acc.accountId}
                            </span>
                          ) : (
                            <span className="text-sm text-orange-500 italic">Not assigned</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">---</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
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

            {/* AdsPower Profile Selection */}
            <Select
              label="AdsPower Profile"
              options={[
                { value: '', label: 'None (Card Account)' },
                ...extensionProfiles.filter(p => p.isEnabled).map((p) => ({
                  value: p.id,
                  label: `${p.adsPowerSerialNumber ? `#${p.adsPowerSerialNumber}` : ''} ${p.label}`.trim()
                }))
              ]}
              value={selectedProfileId}
              onChange={(value) => setSelectedProfileId(value)}
              placeholder="Select AdsPower Profile"
              searchable
              searchPlaceholder="Search profile..."
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove} className="bg-[#52B788] hover:bg-[#40916C]">
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

        {/* AdsPower Profile Selection */}
        <div className="mt-4">
          <Select
            label="AdsPower Profile"
            options={[
              { value: '', label: 'None (Card Account)' },
              ...extensionProfiles.filter(p => p.isEnabled).map((p) => ({
                value: p.id,
                label: `${p.adsPowerSerialNumber ? `#${p.adsPowerSerialNumber}` : ''} ${p.label}`.trim()
              }))
            ]}
            value={bulkSelectedProfileId}
            onChange={(value) => setBulkSelectedProfileId(value)}
            placeholder="Select AdsPower Profile"
            searchable
            searchPlaceholder="Search profile..."
          />
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
