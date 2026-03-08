'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { applicationsApi, usersApi, bmShareApi, accountDepositsApi, accountRefundsApi, balanceTransfersApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useConfirm } from '@/contexts/ConfirmContext'
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
  MoreVertical,
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

type Tab = 'account-list' | 'access-share' | 'deposit-list' | 'transfer-list' | 'refund-list'

export default function GooglePage() {
  const toast = useToast()
  const confirm = useConfirm()
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

  // Access Share state
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [accessLoading, setAccessLoading] = useState(false)

  // Account Deposits state
  const [accountDeposits, setAccountDeposits] = useState<AccountDeposit[]>([])
  const [depositsLoading, setDepositsLoading] = useState(false)
  const [depositActionDropdown, setDepositActionDropdown] = useState<string | null>(null)
  const [depositDropdownPos, setDepositDropdownPos] = useState<{ top: number; left: number } | null>(null)

  // Account Refunds state
  const [accountRefunds, setAccountRefunds] = useState<AccountRefund[]>([])
  const [refundsLoading, setRefundsLoading] = useState(false)

  // Balance Transfers state
  const [balanceTransfers, setBalanceTransfers] = useState<any[]>([])
  const [transfersLoading, setTransfersLoading] = useState(false)
  const [editingTransferId, setEditingTransferId] = useState<string | null>(null)
  const [editingTransferAmount, setEditingTransferAmount] = useState<string>('')

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

  // Selected items for bulk action (Account List)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [selectMultiple, setSelectMultiple] = useState(false)

  // Selected deposits for bulk action (Deposit List)
  const [selectedDeposits, setSelectedDeposits] = useState<string[]>([])
  const [selectMultipleDeposits, setSelectMultipleDeposits] = useState(false)
  const [showBulkDepositDropdown, setShowBulkDepositDropdown] = useState(false)
  const bulkDepositDropdownRef = useRef<HTMLDivElement>(null)

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

  // Client-side pagination for Access Share, Deposits, Refunds
  const [accessPage, setAccessPage] = useState(1)
  const [accessPerPage, setAccessPerPage] = useState(25)
  const [depositsPage, setDepositsPage] = useState(1)
  const [depositsPerPage, setDepositsPerPage] = useState(25)
  const [refundsPage, setRefundsPage] = useState(1)
  const [refundsPerPage, setRefundsPerPage] = useState(25)
  const [transfersPage, setTransfersPage] = useState(1)
  const [transfersPerPage, setTransfersPerPage] = useState(25)

  // Tab refs for dynamic indicator positioning
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const tabs = [
    { id: 'account-list', label: 'Account List' },
    { id: 'access-share', label: 'Access Share' },
    { id: 'deposit-list', label: 'Deposit List' },
    { id: 'transfer-list', label: 'Transfer List' },
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
      if (!target.closest('.deposit-action-dropdown')) {
        setDepositActionDropdown(null)
      }
      if (bulkDepositDropdownRef.current && !bulkDepositDropdownRef.current.contains(target)) {
        setShowBulkDepositDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [appsData, usersData, statsData] = await Promise.all([
        applicationsApi.getAll('GOOGLE', statusFilter !== 'all' ? statusFilter : undefined, currentPage),
        usersApi.getAll(),
        applicationsApi.getStats('GOOGLE')
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

  // Fetch Access Share requests
  const fetchAccessRequests = async () => {
    setAccessLoading(true)
    try {
      const data = await bmShareApi.getAll('GOOGLE', statusFilter !== 'all' ? statusFilter : undefined)
      setAccessRequests(data.bmShareRequests || [])
    } catch (error) {
      console.error('Failed to fetch access requests:', error)
    } finally {
      setAccessLoading(false)
    }
  }

  // Fetch Account Deposits
  const fetchAccountDeposits = async () => {
    setDepositsLoading(true)
    try {
      const data = await accountDepositsApi.getAll('GOOGLE', statusFilter !== 'all' ? statusFilter : undefined)
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
      const data = await accountRefundsApi.getAll('GOOGLE', statusFilter !== 'all' ? statusFilter : undefined)
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
      const data = await balanceTransfersApi.getAll('GOOGLE', statusFilter !== 'all' ? statusFilter : undefined)
      setBalanceTransfers(data.transfers || [])
    } catch (error) {
      console.error('Failed to fetch balance transfers:', error)
    } finally {
      setTransfersLoading(false)
    }
  }

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'access-share') {
      fetchAccessRequests()
    } else if (activeTab === 'deposit-list') {
      fetchAccountDeposits()
    } else if (activeTab === 'transfer-list') {
      fetchBalanceTransfers()
    } else if (activeTab === 'refund-list') {
      fetchAccountRefunds()
    }
  }, [activeTab, statusFilter])

  // Handle Account Deposit approve/reject
  const handleDepositApprove = async (id: string) => {
    try {
      await accountDepositsApi.approve(id)
      toast.success('Deposit Approved', 'Deposit approved successfully')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Approve Failed', error.message || 'Failed to approve deposit')
      fetchAccountDeposits()
    }
  }

  const handleDepositReject = async (id: string) => {
    const remarks = prompt('Reason for rejection (no refund):')
    if (remarks === null) return
    try {
      await accountDepositsApi.reject(id, remarks || undefined)
      toast.success('Deposit Rejected', 'Deposit rejected — no refund issued')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Failed to Reject', error.message || 'Failed to reject deposit')
    }
  }

  const handleDepositRejectRefund = async (id: string) => {
    const remarks = prompt('Reason for rejection (with refund):')
    if (remarks === null) return
    try {
      await accountDepositsApi.rejectRefund(id, remarks || undefined)
      toast.success('Deposit Rejected', 'Deposit rejected — amount refunded to user wallet')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Failed to Reject', error.message || 'Failed to reject deposit')
    }
  }

  const handleForceApprove = async (id: string) => {
    const confirmed = await confirm({ title: 'Force Approve', message: 'Force approve will mark deposit as APPROVED and increment balance. Are you sure?', variant: 'danger' })
    if (!confirmed) return
    try {
      await accountDepositsApi.forceApprove(id)
      toast.success('Force Approved', 'Deposit approved + balance incremented.')
      fetchAccountDeposits()
    } catch (error: any) {
      toast.error('Force Approve Failed', error.message || 'Failed to force approve')
    }
  }

  // Deposit selection helpers
  const toggleDepositSelection = (id: string) => {
    setSelectedDeposits(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAllDeposits = () => {
    const pendingDeposits = filteredDeposits.filter(d => d.status === 'PENDING')
    if (selectedDeposits.length === pendingDeposits.length) {
      setSelectedDeposits([])
    } else {
      setSelectedDeposits(pendingDeposits.map(d => d.id))
    }
  }

  // Bulk deposit actions
  const handleBulkDepositAction = async (action: 'approve' | 'reject' | 'reject-refund' | 'retry-recharge') => {
    if (selectedDeposits.length === 0) {
      toast.error('No Selection', 'No deposits selected')
      return
    }

    if (action === 'retry-recharge') {
      const confirmed = await confirm({ title: 'Retry Recharge', message: `Retry recharge for ${selectedDeposits.length} deposit(s)?` })
      if (!confirmed) return
      try {
        let successCount = 0
        for (const id of selectedDeposits) {
          try {
            await accountDepositsApi.retryRecharge(id)
            successCount++
          } catch (e: any) {
            console.error(`Failed to retry recharge for ${id}:`, e.message)
          }
        }
        toast.success('Retry Queued', `${successCount}/${selectedDeposits.length} deposit(s) queued for retry`)
        setSelectedDeposits([])
        setSelectMultipleDeposits(false)
        fetchAccountDeposits()
      } catch (error: any) {
        toast.error('Retry Failed', error.message || 'Failed to retry some deposits')
        fetchAccountDeposits()
      }
      return
    }

    if (action === 'approve') {
      const confirmed = await confirm({ title: 'Bulk Approve', message: `Approve ${selectedDeposits.length} deposit(s)?` })
      if (!confirmed) return
      try {
        for (const id of selectedDeposits) {
          await accountDepositsApi.approve(id)
        }
        toast.success('Bulk Approved', `${selectedDeposits.length} deposit(s) approved`)
        setSelectedDeposits([])
        setSelectMultipleDeposits(false)
        fetchAccountDeposits()
      } catch (error: any) {
        toast.error('Bulk Approve Failed', error.message || 'Failed to approve some deposits')
        fetchAccountDeposits()
      }
    } else if (action === 'reject-refund') {
      const confirmed = await confirm({ title: 'Bulk Reject (with Refund)', message: `Reject ${selectedDeposits.length} deposit(s) with refund?`, variant: 'danger' })
      if (!confirmed) return
      try {
        for (const id of selectedDeposits) {
          await accountDepositsApi.rejectRefund(id, 'Bulk rejected with refund')
        }
        toast.success('Bulk Rejected', `${selectedDeposits.length} deposit(s) rejected — amounts refunded`)
        setSelectedDeposits([])
        setSelectMultipleDeposits(false)
        fetchAccountDeposits()
      } catch (error: any) {
        toast.error('Bulk Reject Failed', error.message || 'Failed to reject some deposits')
        fetchAccountDeposits()
      }
    } else {
      const confirmed = await confirm({ title: 'Bulk Reject (No Refund)', message: `Reject ${selectedDeposits.length} deposit(s) without refund?`, variant: 'danger' })
      if (!confirmed) return
      try {
        for (const id of selectedDeposits) {
          await accountDepositsApi.reject(id, 'Bulk rejected')
        }
        toast.success('Bulk Rejected', `${selectedDeposits.length} deposit(s) rejected — no refund`)
        setSelectedDeposits([])
        setSelectMultipleDeposits(false)
        fetchAccountDeposits()
      } catch (error: any) {
        toast.error('Bulk Reject Failed', error.message || 'Failed to reject some deposits')
        fetchAccountDeposits()
      }
    }
  }

  const openDepositDropdown = (depId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (depositActionDropdown === depId) {
      setDepositActionDropdown(null)
      setDepositDropdownPos(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setDepositDropdownPos({ top: rect.bottom + 4, left: rect.right - 176 })
    setDepositActionDropdown(depId)
  }

  // Handle Account Refund approve/reject
  const handleRefundApprove = async (id: string) => {
    try {
      await accountRefundsApi.approve(id)
      fetchAccountRefunds()
    } catch (error: any) {
      toast.error('Approve Failed', error.message || 'Failed to approve')
    }
  }

  const handleRefundReject = async (id: string) => {
    const confirmed = await confirm({ title: 'Reject Refund', message: 'Are you sure you want to reject this refund request?', variant: 'danger' })
    if (!confirmed) return
    try {
      await accountRefundsApi.reject(id)
      fetchAccountRefunds()
    } catch (error: any) {
      toast.error('Reject Failed', error.message || 'Failed to reject')
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
      toast.error('Invalid Amount', 'Please enter a valid amount')
      return
    }
    try {
      await accountRefundsApi.updateAmount(id, amount)
      setEditingRefundId(null)
      setEditingRefundAmount('')
      fetchAccountRefunds()
    } catch (error: any) {
      toast.error('Update Failed', error.message || 'Failed to update amount')
    }
  }

  // Handle Balance Transfer approve/reject
  const handleTransferApprove = async (id: string) => {
    try {
      await balanceTransfersApi.approve(id)
      toast.success('Transfer Approved', 'Balance transfer approved successfully')
      fetchBalanceTransfers()
    } catch (error: any) {
      toast.error('Approve Failed', error.message || 'Failed to approve transfer')
    }
  }

  const handleTransferReject = async (id: string) => {
    const remarks = prompt('Reason for rejection:')
    if (remarks === null) return
    try {
      await balanceTransfersApi.reject(id, remarks || undefined)
      toast.success('Transfer Rejected', 'Balance transfer rejected')
      fetchBalanceTransfers()
    } catch (error: any) {
      toast.error('Reject Failed', error.message || 'Failed to reject transfer')
    }
  }

  // Handle transfer amount edit
  const handleTransferAmountEdit = (t: any) => {
    setEditingTransferId(t.id)
    setEditingTransferAmount(parseFloat(t.amount || '0').toFixed(2))
  }

  const handleTransferAmountSave = async (id: string) => {
    const amount = parseFloat(editingTransferAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid Amount', 'Please enter a valid amount')
      return
    }
    try {
      await balanceTransfersApi.updateAmount(id, amount)
      setEditingTransferId(null)
      setEditingTransferAmount('')
      fetchBalanceTransfers()
    } catch (error: any) {
      toast.error('Update Failed', error.message || 'Failed to update amount')
    }
  }

  // Handle Access Share approve/reject
  const handleAccessApprove = async (id: string) => {
    try {
      await bmShareApi.approve(id)
      fetchAccessRequests()
      toast.success('Approved', 'Access request approved')
    } catch (error: any) {
      toast.error('Approve Failed', error.message || 'Failed to approve')
    }
  }

  const handleAccessReject = async (id: string) => {
    const confirmed = await confirm({ title: 'Reject Access Request', message: 'Are you sure you want to reject this access request?', variant: 'danger' })
    if (!confirmed) return
    try {
      await bmShareApi.reject(id)
      fetchAccessRequests()
      toast.success('Rejected', 'Access request rejected')
    } catch (error: any) {
      toast.error('Reject Failed', error.message || 'Failed to reject')
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
    setShowApproveModal(true)
  }

  // Submit approve
  const handleApprove = async () => {
    if (!selectedApplication) return

    const validAccounts = approveForm.filter(acc => acc.accountId && acc.accountId.trim() !== '')
    if (validAccounts.length === 0) {
      toast.error('Validation Error', 'Please enter at least one Account ID')
      return
    }

    try {
      await applicationsApi.approve(selectedApplication.id, validAccounts)
      setShowApproveModal(false)
      setSelectedApplication(null)
      fetchData()
    } catch (error: any) {
      toast.error('Approve Failed', error.message || 'Failed to approve')
    }
  }

  // Handle reject
  const handleReject = async (app: Application, refund: boolean = false) => {
    const confirmed = await confirm({ title: 'Reject Application', message: `Are you sure you want to reject this application${refund ? ' and refund' : ''}?`, variant: 'danger' })
    if (!confirmed) return

    try {
      await applicationsApi.reject(app.id, refund)
      fetchData()
    } catch (error: any) {
      toast.error('Reject Failed', error.message || 'Failed to reject')
    }
  }

  // Handle create account directly
  const handleCreateAccount = async () => {
    if (!createForm.userId) {
      toast.error('Validation Error', 'Please select a user')
      return
    }

    const validAccounts = createForm.accounts.filter(a => a.name && a.accountId)
    if (validAccounts.length === 0) {
      toast.error('Validation Error', 'Please enter at least one account with name and ID')
      return
    }

    try {
      await applicationsApi.createDirect(createForm.userId, 'GOOGLE', validAccounts)
      setShowCreateModal(false)
      setCreateForm({ userId: '', adAccountQty: 1, accounts: [{ name: '', accountId: '' }] })
      fetchData()
    } catch (error: any) {
      toast.error('Create Failed', error.message || 'Failed to create accounts')
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
      toast.error('No Selection', 'No items selected')
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
      setShowBulkApproveModal(true)
    } else {
      const refund = await confirm({ title: 'Refund', message: 'Do you want to refund the users?' })
      try {
        await applicationsApi.bulkReject(selectedItems, refund)
        setSelectedItems([])
        setSelectMultiple(false)
        fetchData()
      } catch (error: any) {
        toast.error('Bulk Reject Failed', error.message || 'Failed to bulk reject')
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
        toast.error('Validation Error', `Please enter at least one Account ID for ${app?.user?.username || 'application'}`)
        return
      }
    }

    setBulkApproveLoading(true)
    try {
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
      toast.error('Bulk Approve Failed', error.message || 'Failed to bulk approve')
    } finally {
      setBulkApproveLoading(false)
    }
  }

  // Handle add coupons
  const handleAddCoupons = async () => {
    if (!couponForm.userId) {
      toast.error('Validation Error', 'Please select a user')
      return
    }
    if (couponForm.amount < 1) {
      toast.error('Validation Error', 'Please enter a valid number of coupons')
      return
    }

    setCouponLoading(true)
    try {
      await usersApi.addCoupons(couponForm.userId, couponForm.amount)
      toast.success('Coupons Added', `Successfully added ${couponForm.amount} coupon(s) to user`)
      setShowCouponModal(false)
      setCouponForm({ userId: '', amount: 1 })
    } catch (error: any) {
      toast.error('Coupon Failed', error.message || 'Failed to add coupons')
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

  // Access Share — client-side filter + pagination
  const filteredAccessRequests = accessRequests.filter(req => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (req.applyId || '').toLowerCase().includes(q) ||
      (req.user?.username || '').toLowerCase().includes(q) ||
      (req.adAccountName || '').toLowerCase().includes(q) ||
      (req.adAccountId || '').toLowerCase().includes(q) ||
      (req.bmId || '').toLowerCase().includes(q)
    )
  })
  const effectiveAccessPerPage = accessPerPage === -1 ? filteredAccessRequests.length : accessPerPage
  const totalAccessPages = effectiveAccessPerPage > 0 ? Math.ceil(filteredAccessRequests.length / effectiveAccessPerPage) : 1
  const accessStartIndex = (accessPage - 1) * effectiveAccessPerPage
  const paginatedAccess = filteredAccessRequests.slice(accessStartIndex, accessStartIndex + effectiveAccessPerPage)

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

  // Transfers — client-side filter + pagination
  const filteredTransfers = balanceTransfers.filter((t: any) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (t.user?.username || '').toLowerCase().includes(q) ||
      (t.fromAccount?.accountName || '').toLowerCase().includes(q) ||
      (t.fromAccount?.accountId || '').toLowerCase().includes(q) ||
      (t.toAccount?.accountName || '').toLowerCase().includes(q) ||
      (t.toAccount?.accountId || '').toLowerCase().includes(q)
    )
  })
  const effectiveTransfersPerPage = transfersPerPage === -1 ? filteredTransfers.length : transfersPerPage
  const totalTransfersPages = effectiveTransfersPerPage > 0 ? Math.ceil(filteredTransfers.length / effectiveTransfersPerPage) : 1
  const transfersStartIndex = (transfersPage - 1) * effectiveTransfersPerPage
  const paginatedTransfers = filteredTransfers.slice(transfersStartIndex, transfersStartIndex + effectiveTransfersPerPage)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
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
    <DashboardLayout title="Google">
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
            onClick={() => setShowCreateModal(true)}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Balance</span>
              <p className="text-2xl font-bold text-gray-800">${stats.totalBalance.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-medium rounded">Total</span>
          </div>
          <StatsChart value={stats.totalBalance} color="#3B82F6" filterId="gg-bal-f" gradientId="gg-bal-g" clipId="gg-bal-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Approved Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalApproved.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-sm font-medium rounded">Approved</span>
          </div>
          <StatsChart value={stats.totalApproved} color="#10B981" filterId="gg-app-f" gradientId="gg-app-g" clipId="gg-app-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Pending Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalPending.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Pending</span>
          </div>
          <StatsChart value={stats.totalPending} color="#F59E0B" filterId="gg-pen-f" gradientId="gg-pen-g" clipId="gg-pen-c" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Rejected Requests</span>
              <p className="text-2xl font-bold text-gray-800">{stats.totalRejected.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-red-500 text-white text-sm font-medium rounded">Rejected</span>
          </div>
          <StatsChart value={stats.totalRejected} color="#EF4444" filterId="gg-rej-f" gradientId="gg-rej-g" clipId="gg-rej-c" />
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
                onClick={() => { setActiveTab(tab.id as Tab); setCurrentPage(1); setDepositsPage(1); setRefundsPage(1) }}
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

          {/* Select Multiple & Bulk Actions — Deposit List tab */}
          {activeTab === 'deposit-list' && (
            <div className="flex items-center justify-end gap-3 px-4 pb-3">
              {selectMultipleDeposits && selectedDeposits.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">
                    {selectedDeposits.length} selected
                  </span>
                  {/* Custom Bulk Action Dropdown */}
                  <div className="relative" ref={bulkDepositDropdownRef}>
                    <button
                      onClick={() => setShowBulkDepositDropdown(!showBulkDepositDropdown)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
                    >
                      <span>Bulk Action</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showBulkDepositDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showBulkDepositDropdown && (
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        <button
                          onClick={() => { setShowBulkDepositDropdown(false); handleBulkDepositAction('retry-recharge') }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2.5"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry Recharge
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setShowBulkDepositDropdown(false); handleBulkDepositAction('approve') }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2.5"
                        >
                          <Check className="w-4 h-4" />
                          Approve Selected
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { setShowBulkDepositDropdown(false); handleBulkDepositAction('reject-refund') }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-2.5"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reject with Refund
                        </button>
                        <button
                          onClick={() => { setShowBulkDepositDropdown(false); handleBulkDepositAction('reject') }}
                          className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2.5"
                        >
                          <X className="w-4 h-4" />
                          Reject (No Refund)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectMultipleDeposits}
                  onChange={(e) => {
                    setSelectMultipleDeposits(e.target.checked)
                    if (!e.target.checked) { setSelectedDeposits([]); setShowBulkDepositDropdown(false) }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                Select Multiple
              </label>
            </div>
          )}
        </div>

        {/* Table — Scrollable area */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0" key={activeTab}>

          {/* ACCOUNT LIST TAB */}
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

          {/* ACCESS SHARE TAB */}
          {activeTab === 'access-share' && (
            accessLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredAccessRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Access Requests</h3>
                <p className="text-gray-500 text-sm">No access share requests found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Request ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Account ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-blue-600 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Gmail ID</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAccess.map((req: any, index: number) => (
                    <tr
                      key={req.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-2 xl:px-3 text-gray-400 text-center">{accessStartIndex + index + 1}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600 font-mono">{req.applyId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{req.user?.username || '-'}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-600">{req.adAccountName}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-emerald-600 font-mono">{req.adAccountId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-blue-600 font-medium">{req.bmId}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(req.createdAt)}</td>
                      <td className="py-2.5 px-2 xl:px-3">{getStatusBadge(req.status)}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleAccessApprove(req.id)}
                              className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAccessReject(req.id)}
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

          {/* DEPOSIT LIST TAB */}
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
                    {selectMultipleDeposits && (
                      <th className="py-2 px-1.5 bg-gray-50 w-8">
                        <input
                          type="checkbox"
                          checked={selectedDeposits.length === filteredDeposits.filter(d => d.status === 'PENDING').length && filteredDeposits.filter(d => d.status === 'PENDING').length > 0}
                          onChange={toggleSelectAllDeposits}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                      </th>
                    )}
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Apply ID</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Account</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Total</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-left py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Remark</th>
                    <th className="text-center py-2 px-1.5 font-semibold text-gray-500 uppercase tracking-wide text-[11px] whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeposits.map((dep, index) => {
                    const depositAmount = parseFloat(dep.amount) || 0
                    const commissionAmount = parseFloat(dep.commissionAmount || '0') || 0
                    const totalCost = depositAmount + commissionAmount
                    return (
                      <tr
                        key={dep.id}
                        className={`border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate ${selectedDeposits.includes(dep.id) ? 'bg-violet-50/50' : ''}`}
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        {selectMultipleDeposits && (
                          <td className="py-1.5 px-1.5 text-center">
                            {dep.status === 'PENDING' ? (
                              <input
                                type="checkbox"
                                checked={selectedDeposits.includes(dep.id)}
                                onChange={() => toggleDepositSelection(dep.id)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                            ) : (
                              <span className="w-3.5 h-3.5 block" />
                            )}
                          </td>
                        )}
                        <td className="py-1.5 px-1.5 text-gray-400 text-center text-xs">{depositsStartIndex + index + 1}</td>
                        <td className="py-1.5 px-1.5 text-gray-600 font-mono text-[11px]">{dep.applyId || '---'}</td>
                        <td className="py-1.5 px-1.5 text-gray-700 text-xs whitespace-nowrap">{dep.adAccount.user.username}</td>
                        <td className="py-1.5 px-1.5">
                          <div className="text-gray-600 text-xs leading-tight">{dep.adAccount.accountName}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-emerald-600 font-mono text-[10px]">{dep.adAccount.accountId}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1.5 font-semibold text-emerald-600 text-xs whitespace-nowrap">${depositAmount.toFixed(2)}</td>
                        <td className="py-1.5 px-1.5 font-semibold text-orange-600 text-xs whitespace-nowrap" title={dep.remarks || ''}>
                          ${totalCost.toFixed(2)}
                          {commissionAmount > 0 && (
                            <span className="text-[10px] font-normal text-gray-400 ml-0.5">(+${commissionAmount.toFixed(2)})</span>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5 text-gray-500 text-[11px] whitespace-nowrap">{formatDate(dep.createdAt)}</td>
                        <td className="py-1.5 px-1.5">
                          {dep.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                              <span className="w-1 h-1 rounded-full bg-emerald-500" />Approved
                            </span>
                          ) : dep.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700">
                              <span className="w-1 h-1 rounded-full bg-red-500" />Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                              <span className="w-1 h-1 rounded-full bg-amber-500" />Pending
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5 whitespace-nowrap max-w-[120px]">
                          {dep.status === 'APPROVED' && (
                            <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-medium bg-green-50 text-green-700">Approved</span>
                          )}
                          {dep.status === 'REJECTED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 truncate max-w-full" title={dep.adminRemarks || 'Rejected'}>
                              {dep.adminRemarks || 'Rejected'}
                            </span>
                          )}
                          {dep.status === 'PENDING' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">Awaiting approval</span>
                          )}
                        </td>
                        <td className="py-1.5 px-1.5">
                          {dep.status === 'PENDING' ? (
                            <div className="flex items-center justify-center gap-1">
                              {/* Quick Approve Button */}
                              <button
                                onClick={() => handleDepositApprove(dep.id)}
                                className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              {/* More Actions Dropdown */}
                              <div className="deposit-action-dropdown">
                                <button
                                  onClick={(e) => openDepositDropdown(dep.id, e)}
                                  className="p-1.5 rounded bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors"
                                  title="More actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 flex justify-center">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* Fixed-position deposit action dropdown portal */}
          {depositActionDropdown && depositDropdownPos && (() => {
            const dep = filteredDeposits.find(d => d.id === depositActionDropdown)
            if (!dep) return null
            return (
              <div
                className="fixed w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 deposit-action-dropdown"
                style={{ top: depositDropdownPos.top, left: depositDropdownPos.left, zIndex: 9999 }}
              >
                <button onClick={() => { setDepositActionDropdown(null); handleDepositApprove(dep.id) }} className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors">Approve</button>
                <button onClick={() => { setDepositActionDropdown(null); handleForceApprove(dep.id) }} className="w-full text-left px-3 py-2 text-sm text-violet-600 hover:bg-violet-50 transition-colors">Force Approve</button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setDepositActionDropdown(null); handleDepositRejectRefund(dep.id) }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Reject with Refund</button>
                <button onClick={() => { setDepositActionDropdown(null); handleDepositReject(dep.id) }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Reject (No Refund)</button>
              </div>
            )
          })()}

          {/* TRANSFER LIST TAB */}
          {activeTab === 'transfer-list' && (
            transfersLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center">
                  <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                  <span className="text-gray-500 text-sm">Loading...</span>
                </div>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transfers</h3>
                <p className="text-gray-500 text-sm">No balance transfer requests found matching your filters</p>
              </div>
            ) : (
              <table className="w-full text-sm xl:text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">From Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">To Account</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Amount</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                    <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                    <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransfers.map((t: any, index: number) => (
                    <tr
                      key={t.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="py-2.5 px-2 xl:px-3 text-gray-400 text-center">{transfersStartIndex + index + 1}</td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-700 whitespace-nowrap">{t.user?.username || '---'}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        <div className="flex flex-col">
                          <span className="text-gray-700 text-xs">{t.fromAccount?.accountName || '---'}</span>
                          <span className="text-emerald-600 font-mono text-xs">{t.fromAccount?.accountId || '---'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 xl:px-3">
                        <div className="flex flex-col">
                          <span className="text-gray-700 text-xs">{t.toAccount?.accountName || '---'}</span>
                          <span className="text-emerald-600 font-mono text-xs">{t.toAccount?.accountId || '---'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {editingTransferId === t.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-bold">$</span>
                            <input
                              type="number"
                              value={editingTransferAmount}
                              onChange={(e) => setEditingTransferAmount(e.target.value)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                              min="0"
                              step="0.01"
                            />
                            <button
                              onClick={() => handleTransferAmountSave(t.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setEditingTransferId(null); setEditingTransferAmount('') }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-blue-600">${parseFloat(t.amount || '0').toFixed(2)}</span>
                            {t.status === 'PENDING' && (
                              <button
                                onClick={() => handleTransferAmountEdit(t)}
                                className="p-1 text-gray-400 hover:text-violet-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit amount"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 xl:px-3 text-gray-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                      <td className="py-2.5 px-2 xl:px-3">{getStatusBadge(t.status)}</td>
                      <td className="py-2.5 px-2 xl:px-3">
                        {t.status === 'PENDING' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleTransferApprove(t.id)}
                              className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTransferReject(t.id)}
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

          {/* REFUND LIST TAB */}
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

        {/* PAGINATION FOOTERS */}

        {/* Account List Pagination — Server-side */}
        {activeTab === 'account-list' && !loading && filteredApplications.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <span className="text-[13px] text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            {renderPageButtons(currentPage, totalPages, setCurrentPage)}
          </div>
        )}

        {/* Access Share Pagination — Client-side */}
        {activeTab === 'access-share' && !accessLoading && filteredAccessRequests.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {accessStartIndex + 1}-{Math.min(accessStartIndex + effectiveAccessPerPage, filteredAccessRequests.length)} of {filteredAccessRequests.length}
              </span>
              <PaginationSelect value={accessPerPage} onChange={(val) => { setAccessPerPage(val); setAccessPage(1) }} />
            </div>
            {renderPageButtons(accessPage, totalAccessPages, setAccessPage)}
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

        {/* Transfers Pagination — Client-side */}
        {activeTab === 'transfer-list' && !transfersLoading && filteredTransfers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {transfersStartIndex + 1}-{Math.min(transfersStartIndex + effectiveTransfersPerPage, filteredTransfers.length)} of {filteredTransfers.length}
              </span>
              <PaginationSelect value={transfersPerPage} onChange={(val) => { setTransfersPerPage(val); setTransfersPage(1) }} />
            </div>
            {renderPageButtons(transfersPage, totalTransfersPages, setTransfersPage)}
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

      {/* MODALS */}

      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Google Ads Account"
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
            <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account ID</label>
                  <input
                    type="text"
                    value={acc.accountId}
                    onChange={(e) => {
                      const newAccounts = [...createForm.accounts]
                      newAccounts[index].accountId = e.target.value.replace(/\s/g, '')
                      setCreateForm({ ...createForm, accounts: newAccounts })
                    }}
                    placeholder="Enter ID"
                    className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}

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
              <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">User Name</label>
                    <input
                      type="text"
                      value={selectedApplication.user.username}
                      disabled
                      className="w-full h-9 px-3 bg-white border border-gray-200 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account Name</label>
                    <input
                      type="text"
                      value={acc.name}
                      disabled
                      className="w-full h-9 px-3 bg-white border border-gray-200 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Account ID</label>
                    <input
                      type="text"
                      value={acc.accountId}
                      onChange={(e) => {
                        const newForm = [...approveForm]
                        newForm[index].accountId = e.target.value.replace(/\s/g, '')
                        setApproveForm(newForm)
                      }}
                      placeholder="Add ID"
                      className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}

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
                            newData[appId][index].accountId = e.target.value.replace(/\s/g, '')
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
