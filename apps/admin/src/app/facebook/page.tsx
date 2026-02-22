'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
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
  ShieldCheck,
  CheckCircle2
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
  applyId?: string
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

  // Card wallet top-up tracking
  const [cardWalletPending, setCardWalletPending] = useState(0)
  const [walletMarkingAdded, setWalletMarkingAdded] = useState(false)

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
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [bulkSelectedProfileId, setBulkSelectedProfileId] = useState<string>('')

  // Client-side pagination for BM Share, Deposits, Refunds
  const [bmSharePage, setBmSharePage] = useState(1)
  const [bmSharePerPage, setBmSharePerPage] = useState(25)
  const [depositsPage, setDepositsPage] = useState(1)
  const [depositsPerPage, setDepositsPerPage] = useState(25)
  const [refundsPage, setRefundsPage] = useState(1)
  const [refundsPerPage, setRefundsPerPage] = useState(25)

  // Tab refs for dynamic indicator positioning
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const tabs = [
    { id: 'account-list', label: 'Account List' },
    { id: 'bm-share', label: 'BM Share' },
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

  // Fetch Card Wallet Pending Amount
  const fetchCardWalletPending = async () => {
    try {
      const data = await accountDepositsApi.getCardWalletPending()
      setCardWalletPending(data.pendingAmount || 0)
    } catch {
      // Silently fail
    }
  }

  // Mark card wallet as added (reset to 0)
  const handleMarkWalletAdded = async () => {
    if (!confirm('Confirm that you have added the money to the Facebook wallet? This will reset the pending amount to $0.')) return
    setWalletMarkingAdded(true)
    try {
      await accountDepositsApi.markCardWalletAdded()
      setCardWalletPending(0)
      toast.success('Wallet Updated', 'Pending amount reset to $0')
    } catch (error: any) {
      toast.error('Failed', error.message || 'Failed to mark wallet as added')
    } finally {
      setWalletMarkingAdded(false)
    }
  }

  // Fetch Account Deposits
  const fetchAccountDeposits = async () => {
    setDepositsLoading(true)
    try {
      const data = await accountDepositsApi.getAll('FACEBOOK', statusFilter !== 'all' ? statusFilter : undefined)
      const deposits = data.deposits || []
      setAccountDeposits(deposits)

      // Fetch card wallet pending amount
      fetchCardWalletPending()

      // Check Cheetah status for pending Facebook deposits
      const pendingFbAccountIds = deposits
        .filter((d: AccountDeposit) => d.status === 'PENDING' && d.adAccount.platform === 'FACEBOOK')
        .map((d: AccountDeposit) => d.adAccount.accountId)
        .filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index)

      if (pendingFbAccountIds.length > 0) {
        try {
          const result = await accountDepositsApi.checkCheetah(pendingFbAccountIds)
          setCheetahStatus(result.cheetahStatus || {})
        } catch {
          // Silently fail
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
          <span key={i} className="text-emerald-600 text-xs font-mono">{a.accountId}</span>
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
    setSelectedProfileId('')
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
      setBulkSelectedProfileId('')
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

  // Filter applications by search (Account List tab — server-side pagination)
  const filteredApplications = applications.filter(app => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      app.applyId.toLowerCase().includes(query) ||
      app.user.username.toLowerCase().includes(query) ||
      app.licenseNo?.toLowerCase().includes(query)
    )
  })

  // BM Share — client-side filter + pagination
  const filteredBmShareRequests = bmShareRequests.filter(req => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      req.applyId.toLowerCase().includes(q) ||
      req.user.username.toLowerCase().includes(q) ||
      req.adAccountName.toLowerCase().includes(q) ||
      req.adAccountId.toLowerCase().includes(q) ||
      req.bmId.toLowerCase().includes(q)
    )
  })
  const effectiveBmSharePerPage = bmSharePerPage === -1 ? filteredBmShareRequests.length : bmSharePerPage
  const totalBmSharePages = effectiveBmSharePerPage > 0 ? Math.ceil(filteredBmShareRequests.length / effectiveBmSharePerPage) : 1
  const bmShareStartIndex = (bmSharePage - 1) * effectiveBmSharePerPage
  const paginatedBmShare = filteredBmShareRequests.slice(bmShareStartIndex, bmShareStartIndex + effectiveBmSharePerPage)

  // Deposits — client-side filter + pagination
  const filteredDeposits = accountDeposits.filter(dep => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      dep.adAccount.user.username.toLowerCase().includes(q) ||
      dep.adAccount.accountName.toLowerCase().includes(q) ||
      dep.adAccount.accountId.toLowerCase().includes(q)
    )
  })
  const effectiveDepositsPerPage = depositsPerPage === -1 ? filteredDeposits.length : depositsPerPage
  const totalDepositsPages = effectiveDepositsPerPage > 0 ? Math.ceil(filteredDeposits.length / effectiveDepositsPerPage) : 1
  const depositsStartIndex = (depositsPage - 1) * effectiveDepositsPerPage
  const paginatedDeposits = filteredDeposits.slice(depositsStartIndex, depositsStartIndex + effectiveDepositsPerPage)

  // Refunds — client-side filter + pagination
  const filteredRefunds = accountRefunds.filter(ref => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      ref.adAccount.user.username.toLowerCase().includes(q) ||
      ref.adAccount.accountName.toLowerCase().includes(q) ||
      ref.adAccount.accountId.toLowerCase().includes(q)
    )
  })
  const effectiveRefundsPerPage = refundsPerPage === -1 ? filteredRefunds.length : refundsPerPage
  const totalRefundsPages = effectiveRefundsPerPage > 0 ? Math.ceil(filteredRefunds.length / effectiveRefundsPerPage) : 1
  const refundsStartIndex = (refundsPage - 1) * effectiveRefundsPerPage
  const paginatedRefunds = filteredRefunds.slice(refundsStartIndex, refundsStartIndex + effectiveRefundsPerPage)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        )
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-50 text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {status}
          </span>
        )
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Pagination renderer helper
  const renderPageButtons = (current: number, total: number, setCurrent: (p: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => setCurrent(Math.max(1, current - 1))}
          disabled={current === 1}
          className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(total, 5) }, (_, i) => {
          let pageNum: number
          if (total <= 5) {
            pageNum = i + 1
          } else if (current <= 3) {
            pageNum = i + 1
          } else if (current >= total - 2) {
            pageNum = total - 4 + i
          } else {
            pageNum = current - 2 + i
          }
          return (
            <button
              key={pageNum}
              onClick={() => setCurrent(pageNum)}
              className={`w-8 h-8 rounded-md text-[13px] font-medium transition-all ${
                current === pageNum
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {pageNum}
            </button>
          )
        })}
        <button
          onClick={() => setCurrent(Math.min(total, current + 1))}
          disabled={current >= total}
          className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <DashboardLayout title="Facebook">
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.25s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      {/* Top Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users, ID, accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
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
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${statusFilter === option.value ? 'text-violet-600 bg-violet-50 font-medium' : 'text-gray-600'}`}
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
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Account
          </button>
          <button
            onClick={() => setShowCouponModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Gift className="w-4 h-4" />
            Add Coupon
          </button>
          <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Balance</span>
              <p className="text-2xl font-bold text-gray-800">${stats.totalBalance.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-medium rounded">Total</span>
          </div>
          <StatsChart value={stats.totalBalance} color="#3B82F6" filterId="fb-bal-f" gradientId="fb-bal-g" clipId="fb-bal-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Approved Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalApproved.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-sm font-medium rounded">Approved</span>
          </div>
          <StatsChart value={stats.totalApproved} color="#10B981" filterId="fb-app-f" gradientId="fb-app-g" clipId="fb-app-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Pending Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalPending.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Pending</span>
          </div>
          <StatsChart value={stats.totalPending} color="#F59E0B" filterId="fb-pen-f" gradientId="fb-pen-g" clipId="fb-pen-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Rejected Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalRejected.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-red-500 text-white text-sm font-medium rounded">Rejected</span>
          </div>
          <StatsChart value={stats.totalRejected} color="#EF4444" filterId="fb-rej-f" gradientId="fb-rej-g" clipId="fb-rej-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Card Wallet</span>
              <p className={`text-2xl font-bold ${cardWalletPending > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                ${cardWalletPending.toFixed(2)}
              </p>
            </div>
            {cardWalletPending > 0 ? (
              <button
                onClick={handleMarkWalletAdded}
                disabled={walletMarkingAdded}
                className="h-7 px-2.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {walletMarkingAdded ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Added
              </button>
            ) : (
              <span className="px-2 py-0.5 bg-green-500 text-white text-sm font-medium rounded">$0</span>
            )}
          </div>
          <StatsChart value={cardWalletPending} color={cardWalletPending > 0 ? '#F97316' : '#22C55E'} filterId="fb-wal-f" gradientId="fb-wal-g" clipId="fb-wal-c" />
        </Card>
      </div>

      {/* Main Card with Tabs & Table */}
      <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 340px)' }}>
        {/* Tabs with smooth sliding indicator */}
        <div className="border-b border-gray-100 flex-shrink-0">
          <div className="flex relative">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el }}
                onClick={() => { setActiveTab(tab.id as Tab); setCurrentPage(1); setBmSharePage(1); setDepositsPage(1); setRefundsPage(1) }}
                className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  activeTab === tab.id
                    ? 'text-violet-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
          </div>

          {/* Select Multiple & Bulk Actions — Account List tab only */}
          {activeTab === 'account-list' && (
            <div className="flex items-center justify-end gap-3 px-4 pb-3">
              {selectMultiple && selectedItems.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) handleBulkAction(e.target.value as any)
                    e.target.value = ''
                  }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Select Multiple
              </label>
            </div>
          )}
        </div>

        {/* Table — Scrollable area */}
        <div className="overflow-auto flex-1 min-h-0" key={activeTab}>

          {/* ═══════════════════════════════════════════════════
              ACCOUNT LIST TAB
             ═══════════════════════════════════════════════════ */}
          {activeTab === 'account-list' && (
            loading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Applications</h3>
                <p className="text-gray-500 text-sm">No applications found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    {selectMultiple && (
                      <th className="py-2.5 px-2 xl:px-3 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === applications.length && applications.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </th>
                    )}
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Apply ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">License</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Ads ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Qty</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Total Cost</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app, index) => (
                    <tr
                      key={app.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      {selectMultiple && (
                        <td className="py-2.5 px-2 xl:px-3">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(app.id)}
                            onChange={() => toggleSelection(app.id)}
                            className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          />
                        </td>
                      )}
                      <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{app.user.username}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600 font-mono">{app.applyId}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        <div className="flex flex-col">
                          <span className={`text-xs px-2 py-0.5 rounded inline-block w-fit ${
                            app.licenseType === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {app.licenseType}
                          </span>
                          <span className="text-sm text-gray-600 mt-0.5">{app.licenseNo || '---'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 xl:px-3">{getAdsIdDisplay(app)}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600">{String(app.adAccountQty).padStart(2, '0')}</td>
                      <td className="py-2.5 px-2 xl:px-3 font-semibold text-emerald-600 whitespace-nowrap">${parseFloat(app.totalCost).toFixed(2)}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(app.createdAt)}</td>
                      <td className="py-2.5 px-2 xl:px-3">{getStatusBadge(app.status)}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewRequest(app)}
                            className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {app.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleOpenApprove(app)}
                                className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(app, true)}
                                className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* ═══════════════════════════════════════════════════
              BM SHARE TAB
             ═══════════════════════════════════════════════════ */}
          {activeTab === 'bm-share' && (
            bmShareLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredBmShareRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No BM Share Requests</h3>
                <p className="text-gray-500 text-sm">No BM Share requests found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Apply ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">BM ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Message</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBmShare.map((req, index) => (
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-2 xl:px-3 text-gray-400 text-center">{bmShareStartIndex + index + 1}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600 font-mono">{req.applyId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{req.user.username}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600">{req.adAccountName}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-emerald-600 font-mono">{req.adAccountId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-violet-600 font-mono">{req.bmId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 max-w-[150px] truncate">{req.message || '---'}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(req.createdAt)}</td>
                      <td className="py-2.5 px-2 xl:px-3">{getStatusBadge(req.status)}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleBmShareApprove(req.id)}
                              className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBmShareReject(req.id)}
                              className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 flex justify-center">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* ═══════════════════════════════════════════════════
              DEPOSIT LIST TAB
             ═══════════════════════════════════════════════════ */}
          {activeTab === 'deposit-list' && (
            depositsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Deposits</h3>
                <p className="text-gray-500 text-sm">No deposit requests found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Apply ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Total</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Remarks</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Recharge</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeposits.map((dep, index) => {
                    const depositAmount = parseFloat(dep.amount) || 0
                    const commissionAmount = parseFloat(dep.commissionAmount || '0') || 0
                    const totalCost = depositAmount + commissionAmount
                    const isNotCheetah = dep.adAccount.platform === 'FACEBOOK' && cheetahStatus[dep.adAccount.accountId] === false
                    return (
                      <tr
                        key={dep.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td className="py-2.5 px-2 xl:px-3 text-gray-400 text-center">{depositsStartIndex + index + 1}</td>
                        <td className="py-2.5 px-2 xl:px-3 text-gray-600 font-mono">{dep.applyId || '---'}</td>
                        <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{dep.adAccount.user.username}</td>
                        <td className="py-2.5 px-2 xl:px-3 text-gray-600">{dep.adAccount.accountName}</td>
                        <td className="py-2.5 px-2 xl:px-3 font-mono whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600">{dep.adAccount.accountId}</span>
                            {isNotCheetah && dep.status === 'PENDING' && (
                              <span title="Not a Cheetah account — manual recharge required" className="inline-flex items-center">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 xl:px-3 font-semibold text-emerald-600">${depositAmount.toFixed(2)}</td>
                        <td className="py-2.5 px-2 xl:px-3 font-semibold text-orange-600">
                          ${totalCost.toFixed(2)}
                          {commissionAmount > 0 && (
                            <span className="text-xs font-normal text-gray-400 ml-1">
                              (+${commissionAmount.toFixed(2)})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 xl:px-3 text-gray-500 max-w-[150px] truncate">{dep.remarks || '---'}</td>
                        <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(dep.createdAt)}</td>
                        <td className="py-2.5 px-2 xl:px-3">
                          {dep.status === 'APPROVED' && dep.rechargeStatus === 'FAILED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Failed
                            </span>
                          ) : (
                            getStatusBadge(dep.status)
                          )}
                        </td>
                        <td className="py-2.5 px-2 xl:px-3 whitespace-nowrap">
                          {dep.status === 'APPROVED' && dep.rechargeMethod === 'EXTENSION' && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              dep.rechargeStatus === 'PENDING' ? 'bg-yellow-50 text-yellow-700' :
                              dep.rechargeStatus === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 animate-pulse' :
                              dep.rechargeStatus === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                              dep.rechargeStatus === 'FAILED' ? 'bg-red-50 text-red-700' :
                              'bg-gray-50 text-gray-500'
                            }`}>
                              {dep.rechargeStatus === 'PENDING' && 'Queued'}
                              {dep.rechargeStatus === 'IN_PROGRESS' && 'Working...'}
                              {dep.rechargeStatus === 'COMPLETED' && 'Done'}
                              {dep.rechargeStatus === 'FAILED' && 'Failed'}
                            </span>
                          )}
                          {dep.status === 'APPROVED' && dep.rechargeMethod === 'CHEETAH' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              Auto
                            </span>
                          )}
                          {dep.status === 'APPROVED' && dep.rechargeMethod === 'MANUAL' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              Done
                            </span>
                          )}
                          {dep.status === 'APPROVED' && (!dep.rechargeMethod || dep.rechargeMethod === 'NONE') && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                          {dep.status !== 'APPROVED' && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 xl:px-3">
                          {dep.status === 'PENDING' && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDepositApprove(dep.id)}
                                disabled={approvingDepositId === dep.id}
                                className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
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
                                className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          {dep.status === 'APPROVED' && dep.rechargeStatus === 'FAILED' && (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleRetryRecharge(dep.id)}
                                className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                title="Retry Recharge"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleForceApprove(dep.id)}
                                className="p-1.5 rounded bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                                title="Force Approve (skip recharge)"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ═══════════════════════════════════════════════════
              REFUND LIST TAB
             ═══════════════════════════════════════════════════ */}
          {activeTab === 'refund-list' && (
            refundsLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredRefunds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Refunds</h3>
                <p className="text-gray-500 text-sm">No refund requests found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Balance</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Reason</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRefunds.map((ref, index) => (
                    <tr
                      key={ref.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-2 xl:px-3 text-gray-400 text-center">{refundsStartIndex + index + 1}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{ref.adAccount.user.username}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600">{ref.adAccount.accountName}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-emerald-600 font-mono">{ref.adAccount.accountId}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {editingRefundId === ref.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-red-500 font-bold">$</span>
                            <input
                              type="number"
                              value={editingRefundAmount}
                              onChange={(e) => setEditingRefundAmount(e.target.value)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
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
                            <span className="font-semibold text-red-500">${parseFloat(ref.amount).toFixed(2)}</span>
                            {ref.status === 'PENDING' && (
                              <button
                                onClick={() => handleRefundAmountEdit(ref)}
                                className="p-1 text-gray-400 hover:text-violet-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit amount"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600">${parseFloat(ref.adAccount.balance).toFixed(2)}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 max-w-[150px] truncate">{ref.reason || '---'}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(ref.createdAt)}</td>
                      <td className="py-2.5 px-2 xl:px-3">{getStatusBadge(ref.status)}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {ref.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleRefundApprove(ref.id)}
                              className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRefundReject(ref.id)}
                              className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 flex justify-center">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            PAGINATION FOOTERS
           ═══════════════════════════════════════════════════ */}

        {/* Account List Pagination — Server-side */}
        {activeTab === 'account-list' && !loading && filteredApplications.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <span className="text-[13px] text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            {renderPageButtons(currentPage, totalPages, setCurrentPage)}
          </div>
        )}

        {/* BM Share Pagination — Client-side */}
        {activeTab === 'bm-share' && !bmShareLoading && filteredBmShareRequests.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {bmShareStartIndex + 1}-{Math.min(bmShareStartIndex + effectiveBmSharePerPage, filteredBmShareRequests.length)} of {filteredBmShareRequests.length}
              </span>
              <PaginationSelect value={bmSharePerPage} onChange={(val) => { setBmSharePerPage(val); setBmSharePage(1) }} />
            </div>
            {renderPageButtons(bmSharePage, totalBmSharePages, setBmSharePage)}
          </div>
        )}

        {/* Deposits Pagination — Client-side */}
        {activeTab === 'deposit-list' && !depositsLoading && filteredDeposits.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {depositsStartIndex + 1}-{Math.min(depositsStartIndex + effectiveDepositsPerPage, filteredDeposits.length)} of {filteredDeposits.length}
              </span>
              <PaginationSelect value={depositsPerPage} onChange={(val) => { setDepositsPerPage(val); setDepositsPage(1) }} />
            </div>
            {renderPageButtons(depositsPage, totalDepositsPages, setDepositsPage)}
          </div>
        )}

        {/* Refunds Pagination — Client-side */}
        {activeTab === 'refund-list' && !refundsLoading && filteredRefunds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {refundsStartIndex + 1}-{Math.min(refundsStartIndex + effectiveRefundsPerPage, filteredRefunds.length)} of {filteredRefunds.length}
              </span>
              <PaginationSelect value={refundsPerPage} onChange={(val) => { setRefundsPerPage(val); setRefundsPage(1) }} />
            </div>
            {renderPageButtons(refundsPage, totalRefundsPages, setRefundsPage)}
          </div>
        )}
      </Card>

      {/* ═══════════════════════════════════════════════════
          MODALS
         ═══════════════════════════════════════════════════ */}

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Account"
      >
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account Name</label>
                <input
                  type="text"
                  value={acc.name}
                  onChange={(e) => {
                    const newAccounts = [...createForm.accounts]
                    newAccounts[index].name = e.target.value
                    setCreateForm({ ...createForm, accounts: newAccounts })
                  }}
                  placeholder="Enter Account Name"
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account ID</label>
                <input
                  type="text"
                  value={acc.accountId}
                  onChange={(e) => {
                    const newAccounts = [...createForm.accounts]
                    newAccounts[index].accountId = e.target.value
                    setCreateForm({ ...createForm, accounts: newAccounts })
                  }}
                  placeholder="Enter ID"
                  className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
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

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateAccount}
              className="h-8 px-4 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors"
            >
              Submit
            </button>
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
            <div className={`p-3 rounded-xl ${
              selectedApplication.status === 'APPROVED' ? 'bg-emerald-50 border border-emerald-200' :
              selectedApplication.status === 'PENDING' ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedApplication.status)}</div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">User</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{selectedApplication.user?.username || 'Unknown'}</p>
                <p className="text-xs text-gray-500">{selectedApplication.user?.email}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Apply ID</span>
                <p className="text-sm font-mono font-semibold text-gray-800 mt-1">{selectedApplication.applyId}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">License No.</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{selectedApplication.licenseNo || '---'}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Deposit</span>
                <p className="text-sm font-bold text-emerald-600 mt-1">${parseFloat(selectedApplication.depositAmount).toFixed(2)}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</span>
                <p className="text-sm font-bold text-orange-500 mt-1">${parseFloat(selectedApplication.totalCost).toFixed(2)}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Apply Time</span>
                <p className="text-sm font-semibold text-gray-800 mt-1">{new Date(selectedApplication.createdAt).toLocaleString()}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl col-span-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Ad Accounts ({selectedApplication.adAccountQty} requested)</span>
                <div className="mt-3 space-y-2">
                  {parseAccountDetails(selectedApplication.accountDetails).length > 0 ? (
                    parseAccountDetails(selectedApplication.accountDetails).map((acc, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-2 flex-1">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-sm font-medium rounded">
                            {acc.name}
                          </span>
                          <span className="text-gray-300 text-lg">&rarr;</span>
                          {acc.accountId ? (
                            <span className="px-2 py-0.5 bg-violet-500/10 text-violet-600 text-sm font-mono font-medium rounded">
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

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">User Name</label>
                  <input
                    type="text"
                    value={selectedApplication.user.username}
                    disabled
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account Name</label>
                  <input
                    type="text"
                    value={acc.name}
                    disabled
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account ID</label>
                  <input
                    type="text"
                    value={acc.accountId}
                    onChange={(e) => {
                      const newForm = [...approveForm]
                      newForm[index].accountId = e.target.value
                      setApproveForm(newForm)
                    }}
                    placeholder="Add ID"
                    className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
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

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="h-8 px-4 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 transition-colors"
              >
                Submit
              </button>
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

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {selectedItems.map((appId) => {
            const app = applications.find(a => a.id === appId)
            if (!app) return null

            return (
              <div key={appId} className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
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
                          className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
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
                          className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
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

        <div className="flex justify-end gap-2 pt-3 mt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowBulkApproveModal(false)}
            className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBulkApproveSubmit}
            disabled={bulkApproveLoading}
            className="h-8 px-4 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {bulkApproveLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {bulkApproveLoading ? 'Approving...' : `Approve ${selectedItems.length} Application(s)`}
          </button>
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
          <Select
            label="Select User"
            options={users.map(user => ({ value: user.id, label: `${user.username} (${user.email})` }))}
            value={couponForm.userId}
            onChange={(value) => setCouponForm({ ...couponForm, userId: value })}
            placeholder="Select User"
            searchable
            searchPlaceholder="Search user..."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Coupons</label>
            <input
              type="number"
              min="1"
              max="100"
              value={couponForm.amount}
              onChange={(e) => setCouponForm({ ...couponForm, amount: parseInt(e.target.value) || 1 })}
              placeholder="Enter number of coupons"
              className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowCouponModal(false)}
              className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddCoupons}
              disabled={couponLoading}
              className="h-8 px-4 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {couponLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {couponLoading ? 'Adding...' : 'Add Coupons'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
