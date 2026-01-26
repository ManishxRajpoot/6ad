'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { transactionsApi, paymentMethodsApi, usersApi, agentsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Check,
  X,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  CreditCard,
  Image as ImageIcon,
  Upload,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  Pencil,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  ExternalLink,
  Globe,
  Building2,
  User as UserIcon,
  Copy
} from 'lucide-react'
import { useDateFilterStore } from '@/store/dateFilter'

type TabType = 'deposits' | 'refunds' | 'paylinks'

type Transaction = {
  id: string
  applyId?: string
  amount: number
  status: string
  paymentMethod?: string
  accountDetails?: string
  paymentProof?: string
  proofUrl?: string
  reason?: string
  createdAt: string
  transactionId?: string
  user?: {
    id: string
    username: string
    email: string
  }
}

type PayLinkRequest = {
  id: string
  applyId?: string
  type: 'INDIVIDUAL' | 'COMPANY'
  fullName: string
  email: string
  country: string
  amount: number
  companyName?: string
  website?: string
  payLink?: string
  status: 'PENDING' | 'LINK_CREATED' | 'COMPLETED' | 'REJECTED'
  adminRemarks?: string
  createdAt: string
  user?: {
    id: string
    username: string
    email: string
    uniqueId: string
  }
}

type PaymentMethodType = {
  id: string
  name: string
  description: string
  icon: string
  isDefault?: boolean
  isEnabled: boolean
}

type UserType = {
  id: string
  username: string
  email: string
  role: string
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('deposits')
  const [deposits, setDeposits] = useState<Transaction[]>([])
  const [refunds, setRefunds] = useState<Transaction[]>([])
  const [payLinkRequests, setPayLinkRequests] = useState<PayLinkRequest[]>([])
  const [payLinkEnabled, setPayLinkEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<{ id: string; type: TabType } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // New state for Figma design
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [creditModalOpen, setCreditModalOpen] = useState(false)
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Credit Action Modal state
  const [creditMode, setCreditMode] = useState<'deposit' | 'remove'>('deposit')
  const [creditRole, setCreditRole] = useState('user')
  const [creditRoleDropdownOpen, setCreditRoleDropdownOpen] = useState(false)
  const [creditMember, setCreditMember] = useState<UserType | null>(null)
  const [creditMemberSearch, setCreditMemberSearch] = useState('')
  const [creditMemberDropdownOpen, setCreditMemberDropdownOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<UserType[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [creditTransactionId, setCreditTransactionId] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [creditPayway, setCreditPayway] = useState('')
  const [creditImage, setCreditImage] = useState<File | null>(null)
  const [creditRemarks, setCreditRemarks] = useState('')

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodType[]>([])
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false)

  // Add Payment Method Modal state
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false)
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodType | null>(null)
  const [newPaymentName, setNewPaymentName] = useState('')
  const [newPaymentDescription, setNewPaymentDescription] = useState('')
  const [newPaymentIcon, setNewPaymentIcon] = useState('💳')

  // Bulk Action Modal state
  const [bulkActionModalOpen, setBulkActionModalOpen] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<'approve' | 'reject'>('approve')
  const [bulkRejectReason, setBulkRejectReason] = useState('')

  // Edit Transaction Modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')

  // Create Pay Link Modal state
  const [createPayLinkModalOpen, setCreatePayLinkModalOpen] = useState(false)
  const [selectedPayLinkRequest, setSelectedPayLinkRequest] = useState<PayLinkRequest | null>(null)
  const [newPayLink, setNewPayLink] = useState('')
  const [payLinkAdminRemarks, setPayLinkAdminRemarks] = useState('')

  // Toast notification state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { startDate, endDate } = useDateFilterStore()
  const itemsPerPage = 10

  // Track which tabs have been loaded
  const [loadedTabs, setLoadedTabs] = useState<Set<TabType>>(new Set())

  // Tooltip state for transaction ID
  const [tooltipId, setTooltipId] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)

  // Refs for custom dropdowns
  const userSearchRef = useRef<HTMLDivElement>(null)
  const roleDropdownRef = useRef<HTMLDivElement>(null)

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2000)
  }

  // Fetch data for a specific tab only
  const fetchTabData = async (tab: TabType) => {
    if (loadedTabs.has(tab) && !loading) return // Already loaded

    setLoading(true)
    try {
      if (tab === 'deposits') {
        const data = await transactionsApi.deposits.getAll()
        setDeposits(data.deposits || [])
      } else if (tab === 'refunds') {
        const data = await transactionsApi.refunds.getAll()
        setRefunds(data.refunds || [])
      } else if (tab === 'paylinks') {
        const [requestsData, settingsData] = await Promise.all([
          transactionsApi.payLinkRequests.getAll(),
          transactionsApi.settings.getPayLinkEnabled()
        ])
        setPayLinkRequests(requestsData.payLinkRequests || [])
        setPayLinkEnabled(settingsData.payLinkEnabled)
      }
      setLoadedTabs(prev => new Set(prev).add(tab))
    } catch (error) {
      console.error(`Failed to fetch ${tab}:`, error)
    } finally {
      setLoading(false)
    }
  }

  // Refresh all loaded data
  const refreshData = async () => {
    setLoading(true)
    try {
      const promises: Promise<void>[] = []

      if (loadedTabs.has('deposits') || activeTab === 'deposits') {
        promises.push(
          transactionsApi.deposits.getAll().then(data => setDeposits(data.deposits || []))
        )
      }
      if (loadedTabs.has('refunds') || activeTab === 'refunds') {
        promises.push(
          transactionsApi.refunds.getAll().then(data => setRefunds(data.refunds || []))
        )
      }
      if (loadedTabs.has('paylinks') || activeTab === 'paylinks') {
        promises.push(
          transactionsApi.payLinkRequests.getAll().then(data => setPayLinkRequests(data.payLinkRequests || []))
        )
      }

      await Promise.all(promises)
      setLoadedTabs(prev => new Set(prev).add(activeTab))
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch users and agents for credit action modal
  const fetchUsers = async (forceRefresh = false) => {
    if (allUsers.length > 0 && !forceRefresh) return // Already loaded
    setUsersLoading(true)
    try {
      // Fetch both users and agents
      const [usersData, agentsData] = await Promise.all([
        usersApi.getAll(),
        agentsApi.getAll()
      ])

      // Combine users (with role USER) and agents (with role AGENT)
      const users = (usersData.users || []).map((u: any) => ({ ...u, role: 'USER' }))
      const agents = (agentsData.agents || []).map((a: any) => ({ ...a, role: 'AGENT' }))

      console.log('Fetched users:', users.length, 'agents:', agents.length)
      setAllUsers([...users, ...agents])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    setPaymentMethodsLoading(true)
    try {
      const data = await paymentMethodsApi.getAll(true) // Get all including disabled
      setPaymentMethods(data.paymentMethods || [])
    } catch (error) {
      console.error('Failed to fetch payment methods:', error)
    } finally {
      setPaymentMethodsLoading(false)
    }
  }

  // Load data for active tab on mount and tab change
  useEffect(() => {
    fetchTabData(activeTab)
  }, [activeTab])

  // Lazy load payment methods only when modal opens
  useEffect(() => {
    if ((paymentMethodModalOpen || creditModalOpen) && paymentMethods.length === 0) {
      fetchPaymentMethods()
    }
    // Fetch users and agents when credit modal opens
    if (creditModalOpen) {
      fetchUsers(true) // Always refresh to get latest data
    }
  }, [paymentMethodModalOpen, creditModalOpen])

  // Close all custom dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setCreditMemberDropdownOpen(false)
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
        setCreditRoleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleApprove = async (id: string, type: TabType) => {
    setActionLoading(true)
    try {
      if (type === 'deposits') {
        await transactionsApi.deposits.approve(id)
      } else {
        await transactionsApi.refunds.approve(id)
      }
      showToast('success', 'Transaction approved successfully')
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  const openRejectModal = (id: string, type: TabType) => {
    setSelectedTransaction({ id, type })
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!selectedTransaction || !rejectReason) return

    setActionLoading(true)
    try {
      const { id, type } = selectedTransaction
      if (type === 'deposits') {
        await transactionsApi.deposits.reject(id, rejectReason)
      } else {
        await transactionsApi.refunds.reject(id, rejectReason)
      }
      setRejectModalOpen(false)
      showToast('success', 'Transaction rejected')
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            Approved
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
            Pending
          </span>
        )
    }
  }

  // Get current data based on tab
  const getRawData = () => {
    switch (activeTab) {
      case 'deposits':
        return deposits
      case 'refunds':
        return refunds
      default:
        return []
    }
  }

  // Filter users for search autocomplete - show all users filtered by role, then by search term
  const filteredUsers = allUsers.filter(u =>
    (creditRole === 'all' || (u.role && u.role.toLowerCase() === creditRole.toLowerCase())) &&
    (creditMemberSearch.length === 0 ||
     (u.username && u.username.toLowerCase().includes(creditMemberSearch.toLowerCase())) ||
     (u.email && u.email.toLowerCase().includes(creditMemberSearch.toLowerCase())))
  ).slice(0, 20)

  // Filter data
  const getFilteredData = () => {
    let data = getRawData()

    // Apply search filter
    if (searchQuery) {
      data = data.filter(t =>
        t.user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.transactionId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply action/status filter
    if (actionFilter !== 'all') {
      data = data.filter(t => t.status === actionFilter.toUpperCase())
    }

    // Apply date filter from global state
    if (startDate && endDate) {
      data = data.filter(t => {
        const createdAt = new Date(t.createdAt)
        return createdAt >= startDate && createdAt <= endDate
      })
    }

    return data
  }

  const filteredData = getFilteredData()
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Count pending transactions
  const pendingCount = getRawData().filter(t => t.status === 'PENDING').length

  const handleSelectAll = () => {
    if (selectedRows.length === paginatedData.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(paginatedData.map(t => t.id))
    }
  }

  const handleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(r => r !== id))
    } else {
      setSelectedRows([...selectedRows, id])
    }
  }

  const handleExportImage = () => {
    // Export selected transaction images
    const selected = paginatedData.filter(t => selectedRows.includes(t.id) && t.proofUrl)
    if (selected.length === 0) {
      alert('No images to export. Please select transactions with images.')
      return
    }
    // Download logic would go here
    alert(`Exporting ${selected.length} images...`)
  }

  const openImageModal = (url: string) => {
    setSelectedImage(url)
    setImageModalOpen(true)
  }

  // Open edit modal for transaction
  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setEditAmount(transaction.amount.toString())
    // Format date for datetime-local input
    const date = new Date(transaction.createdAt)
    const formattedDate = date.toISOString().slice(0, 16)
    setEditDate(formattedDate)
    setEditModalOpen(true)
  }

  // Handle edit transaction submit
  const handleEditSubmit = async () => {
    if (!editingTransaction) return

    setActionLoading(true)
    try {
      await transactionsApi.deposits.update(editingTransaction.id, {
        amount: parseFloat(editAmount),
        createdAt: new Date(editDate).toISOString()
      })
      setEditModalOpen(false)
      showToast('success', 'Transaction updated successfully')
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to update transaction')
    } finally {
      setActionLoading(false)
    }
  }

  // Open bulk action modal
  const openBulkActionModal = (type: 'approve' | 'reject') => {
    if (selectedRows.length === 0) {
      showToast('error', 'Please select transactions first')
      return
    }
    setBulkActionType(type)
    setBulkRejectReason('')
    setBulkActionModalOpen(true)
  }

  // Handle bulk action submit
  const handleBulkAction = async () => {
    if (selectedRows.length === 0) return

    setActionLoading(true)
    try {
      if (bulkActionType === 'approve') {
        await transactionsApi.deposits.bulkApprove(selectedRows)
        showToast('success', `${selectedRows.length} transactions approved`)
      } else {
        await transactionsApi.deposits.bulkReject(selectedRows, bulkRejectReason)
        showToast('success', `${selectedRows.length} transactions rejected`)
      }
      setBulkActionModalOpen(false)
      setSelectedRows([])
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || `Failed to ${bulkActionType} transactions`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreditSubmit = async () => {
    // Validate
    if (!creditMember) {
      showToast('error', 'Please select a member')
      return
    }
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      showToast('error', 'Please enter a valid amount')
      return
    }

    setActionLoading(true)
    try {
      // Convert image to base64 if provided
      let paymentProofBase64: string | undefined
      if (creditImage) {
        const reader = new FileReader()
        paymentProofBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(creditImage)
        })
      }

      const result = await transactionsApi.creditAction({
        userId: creditMember.id,
        amount: parseFloat(creditAmount),
        mode: creditMode as 'deposit' | 'remove',
        transactionId: creditTransactionId || undefined,
        payway: creditPayway || undefined,
        description: `${creditMode === 'deposit' ? 'Deposit' : 'Removal'} by admin - ${creditPayway || 'Manual'}`,
        paymentProof: paymentProofBase64,
        remarks: creditRemarks || undefined
      })

      showToast('success', result.message)
      setCreditModalOpen(false)

      // Reset form
      setCreditMode('deposit')
      setCreditRole('user')
      setCreditRoleDropdownOpen(false)
      setCreditMember(null)
      setCreditMemberSearch('')
      setCreditMemberDropdownOpen(false)
      setCreditTransactionId('')
      setCreditAmount('')
      setCreditPayway('')
      setCreditImage(null)
      setCreditRemarks('')

      // Refresh data
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to process credit action')
    } finally {
      setActionLoading(false)
    }
  }

  const setDefaultPaymentMethod = async (id: string) => {
    try {
      await paymentMethodsApi.update(id, { isDefault: true })
      fetchPaymentMethods()
    } catch (error: any) {
      alert(error.message || 'Failed to set default payment method')
    }
  }

  const togglePaymentMethod = async (id: string) => {
    const pm = paymentMethods.find(p => p.id === id)
    if (!pm) return

    try {
      await paymentMethodsApi.update(id, { isEnabled: !pm.isEnabled })
      fetchPaymentMethods()
    } catch (error: any) {
      alert(error.message || 'Failed to toggle payment method')
    }
  }

  const deletePaymentMethod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      await paymentMethodsApi.delete(id)
      fetchPaymentMethods()
    } catch (error: any) {
      alert(error.message || 'Failed to delete payment method')
    }
  }

  const openAddPaymentModal = () => {
    setEditingPaymentMethod(null)
    setNewPaymentName('')
    setNewPaymentDescription('')
    setNewPaymentIcon('💳')
    setAddPaymentModalOpen(true)
  }

  const openEditPaymentModal = (pm: PaymentMethodType) => {
    setEditingPaymentMethod(pm)
    setNewPaymentName(pm.name)
    setNewPaymentDescription(pm.description || '')
    setNewPaymentIcon(pm.icon)
    setAddPaymentModalOpen(true)
  }

  const handleSavePaymentMethod = async () => {
    if (!newPaymentName.trim()) {
      alert('Please enter a payment method name')
      return
    }

    try {
      if (editingPaymentMethod) {
        // Edit existing
        await paymentMethodsApi.update(editingPaymentMethod.id, {
          name: newPaymentName,
          description: newPaymentDescription,
          icon: newPaymentIcon
        })
      } else {
        // Add new
        await paymentMethodsApi.create({
          name: newPaymentName,
          description: newPaymentDescription,
          icon: newPaymentIcon,
          isEnabled: true
        })
      }

      fetchPaymentMethods()
      setAddPaymentModalOpen(false)
      setNewPaymentName('')
      setNewPaymentDescription('')
      setNewPaymentIcon('💳')
      setEditingPaymentMethod(null)
    } catch (error: any) {
      alert(error.message || 'Failed to save payment method')
    }
  }

  const tabs = [
    { id: 'deposits' as const, label: 'Deposits Management', count: deposits.length },
    { id: 'refunds' as const, label: 'Refunds Management', count: refunds.length },
    { id: 'paylinks' as const, label: 'Pay Link Management', count: payLinkRequests.length },
  ]

  // Toggle Pay Link feature
  const handleTogglePayLink = async () => {
    try {
      const result = await transactionsApi.settings.setPayLinkEnabled(!payLinkEnabled)
      setPayLinkEnabled(result.payLinkEnabled)
      showToast('success', `Pay Link ${result.payLinkEnabled ? 'enabled' : 'disabled'} for users`)
    } catch (error: any) {
      showToast('error', error.message || 'Failed to toggle Pay Link setting')
    }
  }

  // Open create pay link modal
  const openCreatePayLinkModal = (request: PayLinkRequest) => {
    setSelectedPayLinkRequest(request)
    setNewPayLink('')
    setPayLinkAdminRemarks('')
    setCreatePayLinkModalOpen(true)
  }

  // Handle create pay link
  const handleCreatePayLink = async () => {
    if (!selectedPayLinkRequest || !newPayLink.trim()) {
      showToast('error', 'Please enter a pay link URL')
      return
    }

    setActionLoading(true)
    try {
      await transactionsApi.payLinkRequests.createLink(
        selectedPayLinkRequest.id,
        newPayLink.trim(),
        payLinkAdminRemarks
      )
      setCreatePayLinkModalOpen(false)
      showToast('success', 'Pay link created successfully')
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to create pay link')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle reject pay link request
  const handleRejectPayLinkRequest = async (id: string) => {
    setActionLoading(true)
    try {
      await transactionsApi.payLinkRequests.reject(id)
      showToast('success', 'Pay link request rejected')
      refreshData()
    } catch (error: any) {
      showToast('error', error.message || 'Failed to reject request')
    } finally {
      setActionLoading(false)
    }
  }

  // Get status badge for pay link requests
  const getPayLinkStatusBadge = (status: string) => {
    switch (status) {
      case 'LINK_CREATED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
            Link Created
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
            Completed
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
            Pending
          </span>
        )
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('success', 'Copied to clipboard')
  }

  return (
    <DashboardLayout title="Transactions Management">
      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setCurrentPage(1)
              setSelectedRows([])
            }}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Buttons Row - Only for deposits/refunds tabs */}
      {activeTab !== 'paylinks' && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportImage}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Image
            </button>
            <button
              onClick={() => setCreditModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#8B5CF6] px-4 py-2 text-sm font-medium text-white hover:bg-[#7C4CEF] transition-colors"
            >
              <Plus className="h-4 w-4" />
              Credit Action
            </button>
            <button
              onClick={() => setPaymentMethodModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CreditCard className="h-4 w-4" />
              Payment Method
            </button>
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
              <span className="text-sm font-medium text-yellow-800">{pendingCount} Pending Applications</span>
            </div>
          )}
        </div>
      )}

      {/* Pay Link Toggle - Only for paylinks tab */}
      {activeTab === 'paylinks' && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Enable Pay Link for Users</span>
            <button
              onClick={handleTogglePayLink}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                payLinkEnabled ? 'bg-[#8B5CF6]' : 'bg-gray-300'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  payLinkEnabled ? 'left-7' : 'left-1'
                )}
              />
            </button>
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              payLinkEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            )}>
              {payLinkEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {payLinkRequests.filter(r => r.status === 'PENDING').length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
              <span className="text-sm font-medium text-yellow-800">
                {payLinkRequests.filter(r => r.status === 'PENDING').length} Pending Requests
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters Row - Only for deposits/refunds tabs */}
      {activeTab !== 'paylinks' && (
        <div className="mb-4 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, email, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="h-10 appearance-none rounded-lg border border-gray-200 bg-white pl-4 pr-10 text-sm text-gray-700 focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Select Multiple Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRows.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
            />
            <span className="text-sm text-gray-600">Select Multiple</span>
          </label>
        </div>
      )}

      {/* Bulk Action Bar - Appears when rows are selected */}
      {selectedRows.length > 0 && activeTab === 'deposits' && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 px-4 py-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-white text-sm font-semibold">
              {selectedRows.length}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {selectedRows.length === 1 ? 'transaction selected' : 'transactions selected'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openBulkActionModal('approve')}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Check className="h-4 w-4" />
              Approve All
            </button>
            <button
              onClick={() => openBulkActionModal('reject')}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
              Reject All
            </button>
            <button
              onClick={() => setSelectedRows([])}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Pay Links Table - Only for paylinks tab */}
      {activeTab === 'paylinks' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pay Link</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payLinkRequests.length > 0 ? (
                    payLinkRequests.map((request, index) => (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                            {request.applyId || `PL${request.id.slice(-8).toUpperCase()}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            request.type === 'INDIVIDUAL' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          )}>
                            {request.type === 'INDIVIDUAL' ? <UserIcon className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                            {request.type === 'INDIVIDUAL' ? 'Individual' : 'Company'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{request.fullName}</p>
                            {request.companyName && (
                              <p className="text-xs text-gray-500">{request.companyName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{request.email}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                            <Globe className="h-3.5 w-3.5" />
                            {request.country}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(request.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {request.payLink ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={request.payLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#8B5CF6] hover:underline truncate max-w-[150px] block"
                                title={request.payLink}
                              >
                                {request.payLink.length > 30 ? `${request.payLink.slice(0, 30)}...` : request.payLink}
                              </a>
                              <button
                                onClick={() => copyToClipboard(request.payLink!)}
                                className="p-1 rounded hover:bg-gray-100 transition-colors"
                                title="Copy link"
                              >
                                <Copy className="h-3.5 w-3.5 text-gray-400" />
                              </button>
                              <a
                                href={request.payLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-gray-100 transition-colors"
                                title="Open link"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {getPayLinkStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTime(request.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {request.status === 'PENDING' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openCreatePayLinkModal(request)}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6] text-white text-xs font-medium hover:bg-[#7C4CEF] transition-colors disabled:opacity-50"
                              >
                                <LinkIcon className="h-3.5 w-3.5" />
                                Create Link
                              </button>
                              <button
                                onClick={() => handleRejectPayLinkRequest(request.id)}
                                disabled={actionLoading}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                          {request.status === 'LINK_CREATED' && (
                            <span className="text-sm text-blue-600 font-medium">Link Sent</span>
                          )}
                          {request.status === 'COMPLETED' && (
                            <span className="text-sm text-green-600 font-medium">Done</span>
                          )}
                          {request.status === 'REJECTED' && (
                            <span className="text-sm text-red-500">Rejected</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <LinkIcon className="h-12 w-12 text-gray-300" />
                          <p className="text-sm">No pay link requests found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Deposits/Refunds Table */}
      {activeTab !== 'paylinks' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">UserName</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {activeTab === 'deposits' ? 'Deposit Amount' : 'Refund Amount'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Image</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedData.length > 0 ? (
                    paginatedData.map((transaction, index) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.includes(transaction.id)}
                            onChange={() => handleSelectRow(transaction.id)}
                            className="h-4 w-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-sm font-medium text-white">
                              {transaction.user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{transaction.user?.username || 'User'}</p>
                              <p className="text-xs text-gray-500">{transaction.user?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                            {transaction.applyId || `WD${transaction.id.slice(-8).toUpperCase()}`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {transaction.transactionId ? (
                            <div className="relative inline-block">
                              <span
                                className="text-xs text-gray-600 font-mono bg-gray-50 px-2 py-0.5 rounded truncate max-w-[120px] block cursor-pointer hover:bg-gray-100 transition-colors"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setTooltipId(transaction.id)
                                  setTooltipPosition({ x: rect.left, y: rect.bottom + 4 })
                                }}
                                onMouseLeave={() => {
                                  setTooltipId(null)
                                  setTooltipPosition(null)
                                }}
                              >
                                {transaction.transactionId.length > 16
                                  ? `${transaction.transactionId.slice(0, 8)}...${transaction.transactionId.slice(-4)}`
                                  : transaction.transactionId}
                              </span>
                              {/* Custom Tooltip */}
                              {tooltipId === transaction.id && tooltipPosition && (
                                <div
                                  className="fixed z-[200] px-3 py-2 text-xs font-mono bg-gray-900 text-white rounded-lg shadow-lg animate-tooltipFade whitespace-nowrap"
                                  style={{
                                    left: tooltipPosition.x,
                                    top: tooltipPosition.y,
                                  }}
                                >
                                  <div className="absolute -top-1.5 left-4 w-3 h-3 bg-gray-900 rotate-45"></div>
                                  <span className="relative">{transaction.transactionId}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-sm font-semibold',
                              activeTab === 'deposits'
                                ? (transaction.amount < 0 ? 'text-red-600' : 'text-green-600')
                                : 'text-red-600'
                            )}>
                              {activeTab === 'deposits'
                                ? (transaction.amount < 0
                                    ? `-${formatCurrency(Math.abs(transaction.amount))}`
                                    : `+${formatCurrency(transaction.amount)}`)
                                : `-${formatCurrency(transaction.amount)}`}
                            </span>
                            {transaction.status === 'PENDING' && activeTab === 'deposits' && (
                              <button
                                onClick={() => openEditModal(transaction)}
                                className="p-1 rounded hover:bg-gray-100 transition-colors"
                                title="Edit Amount"
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-[#8B5CF6]" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {(transaction.paymentProof || transaction.proofUrl) ? (
                            <button
                              onClick={() => openImageModal(transaction.paymentProof || transaction.proofUrl!)}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden"
                            >
                              <img
                                src={transaction.paymentProof || transaction.proofUrl!}
                                alt="Proof"
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                              <ImageIcon className="h-4 w-4 text-gray-500 hidden" />
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 whitespace-nowrap">
                              {formatDateTime(transaction.createdAt)}
                            </span>
                            {transaction.status === 'PENDING' && activeTab === 'deposits' && (
                              <button
                                onClick={() => openEditModal(transaction)}
                                className="p-1 rounded hover:bg-gray-100 transition-colors"
                                title="Edit Date"
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-[#8B5CF6]" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="px-4 py-3">
                          {transaction.status === 'PENDING' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(transaction.id, activeTab)}
                                disabled={actionLoading}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 transition-colors hover:bg-green-200 disabled:opacity-50"
                                title="Approve"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openRejectModal(transaction.id, activeTab)}
                                disabled={actionLoading}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                                title="Reject"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="h-12 w-12 text-gray-300" />
                          <p className="text-sm">No {activeTab} found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                        currentPage === page
                          ? 'bg-[#8B5CF6] text-white'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Create Pay Link Modal */}
      <Modal
        isOpen={createPayLinkModalOpen}
        onClose={() => setCreatePayLinkModalOpen(false)}
        title="Create Pay Link"
      >
        <div className="space-y-5">
          {selectedPayLinkRequest && (
            <>
              {/* Request Details */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    selectedPayLinkRequest.type === 'INDIVIDUAL' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {selectedPayLinkRequest.type === 'INDIVIDUAL' ? <UserIcon className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    {selectedPayLinkRequest.type === 'INDIVIDUAL' ? 'Individual' : 'Company'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Full Name</p>
                    <p className="font-medium text-gray-900">{selectedPayLinkRequest.fullName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{selectedPayLinkRequest.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Country</p>
                    <p className="font-medium text-gray-900">{selectedPayLinkRequest.country}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-semibold text-green-600">{formatCurrency(selectedPayLinkRequest.amount)}</p>
                  </div>
                  {selectedPayLinkRequest.companyName && (
                    <div>
                      <p className="text-gray-500">Company Name</p>
                      <p className="font-medium text-gray-900">{selectedPayLinkRequest.companyName}</p>
                    </div>
                  )}
                  {selectedPayLinkRequest.website && (
                    <div>
                      <p className="text-gray-500">Website</p>
                      <a href={selectedPayLinkRequest.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[#8B5CF6] hover:underline">
                        {selectedPayLinkRequest.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Pay Link Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pay Link URL *</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={newPayLink}
                    onChange={(e) => setNewPayLink(e.target.value)}
                    placeholder="https://payment.example.com/pay/..."
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 bg-white text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Paste the payment link generated from your payment gateway</p>
              </div>

              {/* Admin Remarks */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Admin Remarks (optional)</label>
                <textarea
                  value={payLinkAdminRemarks}
                  onChange={(e) => setPayLinkAdminRemarks(e.target.value)}
                  placeholder="Any notes for this request..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreatePayLinkModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePayLink}
              disabled={!newPayLink.trim() || actionLoading}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm font-medium text-white hover:bg-[#7C4CEF] disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create Pay Link'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Transaction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this transaction.
          </p>
          <Input
            id="reason"
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason..."
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectReason || actionLoading}
              className="px-4 py-2 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Credit Action Modal */}
      <Modal
        isOpen={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title="Credit Action"
      >
        <div className="space-y-5">
          {/* Deposit/Remove Toggle */}
          <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              onClick={() => setCreditMode('deposit')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                creditMode === 'deposit'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Deposit
            </button>
            <button
              onClick={() => setCreditMode('remove')}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-all',
                creditMode === 'remove'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              Remove
            </button>
          </div>

          {/* Select Role - Custom Dropdown */}
          <div ref={roleDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Role</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCreditRoleDropdownOpen(!creditRoleDropdownOpen)}
                className={cn(
                  "w-full h-10 flex items-center justify-between px-4 rounded-lg border bg-white text-sm transition-colors",
                  creditRoleDropdownOpen
                    ? "border-[#8B5CF6] ring-1 ring-[#8B5CF6]"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <span className="text-gray-900 capitalize">{creditRole}</span>
                <ChevronDown className={cn(
                  "h-4 w-4 text-gray-400 transition-transform",
                  creditRoleDropdownOpen && "rotate-180"
                )} />
              </button>

              {/* Dropdown */}
              {creditRoleDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {[
                    { value: 'user', label: 'User', icon: '👤' },
                    { value: 'agent', label: 'Agent', icon: '🏢' }
                  ].map((role) => (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => {
                        setCreditRole(role.value)
                        setCreditRoleDropdownOpen(false)
                        // Clear selected member when role changes
                        setCreditMember(null)
                        setCreditMemberSearch('')
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        creditRole === role.value
                          ? "bg-purple-50 text-[#8B5CF6]"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <span className="text-lg">{role.icon}</span>
                      <span className="text-sm font-medium">{role.label}</span>
                      {creditRole === role.value && (
                        <Check className="h-4 w-4 ml-auto text-[#8B5CF6]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Select Member - Custom Searchable Autocomplete */}
          <div ref={userSearchRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Member</label>
            <div className="relative">
              {creditMember ? (
                // Selected user display
                <div className="flex items-center justify-between h-10 px-4 rounded-lg border border-[#8B5CF6] bg-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-xs font-medium text-white">
                      {creditMember.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{creditMember.username}</span>
                      <span className="text-xs text-gray-500 ml-2">{creditMember.email}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreditMember(null)
                      setCreditMemberSearch('')
                    }}
                    className="p-1 rounded hover:bg-purple-100 transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                // Search input
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={creditMemberSearch}
                      onChange={(e) => {
                        setCreditMemberSearch(e.target.value)
                        setCreditMemberDropdownOpen(true)
                      }}
                      onFocus={() => setCreditMemberDropdownOpen(true)}
                      placeholder="Click to select or type to search..."
                      className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 bg-white text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                    />
                    {usersLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#8B5CF6] border-t-transparent" />
                      </div>
                    )}
                  </div>

                  {/* Dropdown */}
                  {creditMemberDropdownOpen && filteredUsers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setCreditMember(user)
                            setCreditMemberSearch('')
                            setCreditMemberDropdownOpen(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-xs font-medium text-white">
                            {(user.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.username || 'Unknown'}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email || ''}</p>
                          </div>
                          <span className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full',
                            user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                            user.role === 'AGENT' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {user.role || 'USER'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results message */}
                  {creditMemberDropdownOpen && filteredUsers.length === 0 && !usersLoading && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
                      <p className="text-sm text-gray-500">
                        {creditMemberSearch ? `No users found matching "${creditMemberSearch}"` : 'No users available'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Transaction ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID</label>
            <input
              type="text"
              value={creditTransactionId}
              onChange={(e) => setCreditTransactionId(e.target.value)}
              placeholder="Enter transaction ID"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
            <input
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Payway */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payway</label>
            <input
              type="text"
              value={creditPayway}
              onChange={(e) => setCreditPayway(e.target.value)}
              placeholder="Enter payment method"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Upload Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Image</label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-[#8B5CF6] transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCreditImage(e.target.files?.[0] || null)}
                className="hidden"
                id="credit-image-upload"
              />
              <label htmlFor="credit-image-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {creditImage ? creditImage.name : 'Click to upload or drag and drop'}
                </p>
              </label>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks {creditMode === 'remove' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={creditRemarks}
              onChange={(e) => setCreditRemarks(e.target.value)}
              placeholder={creditMode === 'remove' ? "Enter reason for deduction (visible to user)" : "Enter remarks (optional)"}
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCreditModalOpen(false)}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreditSubmit}
              disabled={actionLoading || !creditMember || !creditAmount}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm font-medium text-white hover:bg-[#7C4CEF] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {actionLoading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {creditMode === 'deposit' ? 'Add Deposit' : 'Remove Amount'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        isOpen={paymentMethodModalOpen}
        onClose={() => setPaymentMethodModalOpen(false)}
        title="Payment Methods"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Manage payment methods visible to users</p>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {paymentMethods.map((pm) => (
              <div
                key={pm.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  !pm.isEnabled ? 'opacity-50 bg-gray-50' : '',
                  pm.isDefault ? 'border-[#8B5CF6] bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-xl flex-shrink-0">{pm.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{pm.name}</span>
                      {pm.isDefault && (
                        <span className="text-xs font-medium text-[#8B5CF6] bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">Default</span>
                      )}
                    </div>
                    {pm.description && (
                      <p className="text-xs text-gray-500 truncate">{pm.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle Switch */}
                  <button
                    onClick={() => togglePaymentMethod(pm.id)}
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      pm.isEnabled ? 'bg-[#8B5CF6]' : 'bg-gray-300'
                    )}
                    title={pm.isEnabled ? 'Disable' : 'Enable'}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                        pm.isEnabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>

                  {!pm.isDefault && (
                    <button
                      onClick={() => setDefaultPaymentMethod(pm.id)}
                      className="text-xs text-gray-500 hover:text-[#8B5CF6] whitespace-nowrap"
                    >
                      Set default
                    </button>
                  )}

                  <button
                    onClick={() => openEditPaymentModal(pm)}
                    className="p-1.5 rounded hover:bg-gray-100"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4 text-gray-400" />
                  </button>

                  <button
                    onClick={() => deletePaymentMethod(pm.id)}
                    className="p-1.5 rounded hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={openAddPaymentModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-[#8B5CF6] hover:text-[#8B5CF6] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setPaymentMethodModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm font-medium text-white hover:bg-[#7C4CEF]"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Payment Method Modal */}
      <Modal
        isOpen={addPaymentModalOpen}
        onClose={() => setAddPaymentModalOpen(false)}
        title={editingPaymentMethod ? 'Edit Payment Method' : 'Add Payment Method'}
      >
        <div className="space-y-4">
          {/* Icon Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {['💳', '💰', '🏦', '💵', '💴', '💶', '💷', '🔵', '💬', '📱', '💎', '🪙'].map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewPaymentIcon(icon)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center text-xl rounded-lg border-2 transition-colors',
                    newPaymentIcon === icon
                      ? 'border-[#8B5CF6] bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Title *</label>
            <input
              type="text"
              value={newPaymentName}
              onChange={(e) => setNewPaymentName(e.target.value)}
              placeholder="e.g., WeChat Pay, Bank Transfer"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Payment Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={newPaymentDescription}
              onChange={(e) => setNewPaymentDescription(e.target.value)}
              placeholder="Brief description for users..."
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddPaymentModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePaymentMethod}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm font-medium text-white hover:bg-[#7C4CEF]"
            >
              {editingPaymentMethod ? 'Save Changes' : 'Add Method'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        title="Transaction Proof"
      >
        <div className="flex justify-center">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Transaction proof"
              className="max-w-full max-h-[70vh] rounded-lg object-contain"
            />
          )}
        </div>
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Transaction"
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Edit the deposit amount or request date for this transaction.
          </p>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-400" />
                Deposit Amount
              </div>
            </label>
            <input
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Enter amount"
              step="0.01"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                Request Date
              </div>
            </label>
            <input
              type="datetime-local"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm font-medium text-white hover:bg-[#7C4CEF] disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Action Modal */}
      <Modal
        isOpen={bulkActionModalOpen}
        onClose={() => setBulkActionModalOpen(false)}
        title={bulkActionType === 'approve' ? 'Approve Transactions' : 'Reject Transactions'}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6] text-white text-lg font-semibold">
              {selectedRows.length}
            </span>
            <div>
              <p className="font-medium text-gray-900">
                {selectedRows.length} {selectedRows.length === 1 ? 'transaction' : 'transactions'} selected
              </p>
              <p className="text-sm text-gray-500">
                {bulkActionType === 'approve'
                  ? 'Balance will be added to user wallets'
                  : 'Transactions will be rejected'}
              </p>
            </div>
          </div>

          {bulkActionType === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rejection Reason (optional)</label>
              <textarea
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setBulkActionModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkAction}
              disabled={actionLoading}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50',
                bulkActionType === 'approve'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
              )}
            >
              {actionLoading
                ? (bulkActionType === 'approve' ? 'Approving...' : 'Rejecting...')
                : (bulkActionType === 'approve' ? 'Approve All' : 'Reject All')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl transform transition-all duration-300 ease-out animate-toastPop ${
            toast.type === 'success' ? 'bg-white border-2 border-green-500' : 'bg-white border-2 border-red-500'
          }`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-checkBounce ${
              toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {toast.type === 'success' ? <Check className="w-8 h-8 text-white" strokeWidth={3} /> : <X className="w-8 h-8 text-white" strokeWidth={3} />}
            </div>
            <span className={`text-lg font-semibold ${toast.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {toast.type === 'success' ? 'Success!' : 'Error!'}
            </span>
            <span className="text-gray-600 text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Animation Styles */}
      <style jsx global>{`
        @keyframes toastPop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes checkBounce {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-toastPop {
          animation: toastPop 0.4s ease-out forwards;
        }
        .animate-checkBounce {
          animation: checkBounce 0.5s ease-out 0.2s forwards;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes tooltipFade {
          0% {
            opacity: 0;
            transform: translateY(-4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-tooltipFade {
          animation: tooltipFade 0.15s ease-out forwards;
        }
      `}</style>
    </DashboardLayout>
  )
}
