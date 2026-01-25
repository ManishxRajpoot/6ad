'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { DatePicker } from '@/components/ui/DatePicker'
import { paymentMethodsApi, transactionsApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Upload,
  User,
  Building2,
  Check,
  Image as ImageIcon,
  X,
  ZoomIn,
  Link as LinkIcon,
  ExternalLink,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  RefreshCw
} from 'lucide-react'

type Tab = 'add-money' | 'pay-link' | 'wallet-flow'
type PayLinkType = 'individual' | 'company'

interface Deposit {
  id: string
  applyId?: string | null
  transactionId: string | null
  amount: number
  paymentMethod: string | null
  paymentProof?: string | null
  remarks?: string | null
  status: string
  createdAt: string
}

export default function DepositsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('add-money')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Modal states
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showPayLinkModal, setShowPayLinkModal] = useState(false)
  const [payLinkType, setPayLinkType] = useState<PayLinkType>('individual')

  // Image lightbox state
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Form states
  const [depositForm, setDepositForm] = useState({
    payway: '',
    transactionId: '',
    chargeAmount: '',
    remarks: ''
  })

  const [payLinkForm, setPayLinkForm] = useState({
    fullName: '',
    email: '',
    country: '',
    amount: '',
    companyName: '',
    website: ''
  })

  // Pay Link Requests from API
  const [payLinkRequests, setPayLinkRequests] = useState<any[]>([])
  const [loadingPayLinks, setLoadingPayLinks] = useState(false)
  const [submittingPayLink, setSubmittingPayLink] = useState(false)
  const [payLinkEnabled, setPayLinkEnabled] = useState(true)

  // Wallet Flow from API
  const [walletFlows, setWalletFlows] = useState<any[]>([])
  const [loadingWalletFlow, setLoadingWalletFlow] = useState(false)
  const [walletFlowPage, setWalletFlowPage] = useState(1)
  const [walletFlowPerPage, setWalletFlowPerPage] = useState(10)

  // Payment methods from API
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string; description: string; icon: string }[]>([])
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false)

  // Deposits from API
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loadingDeposits, setLoadingDeposits] = useState(true)
  const [submittingDeposit, setSubmittingDeposit] = useState(false)

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 1500)
  }

  const { updateUser, isAuthenticated, isHydrated } = useAuthStore()

  // Fetch deposits from API and refresh user balance
  useEffect(() => {
    // Wait for auth to be ready before fetching
    if (!isHydrated || !isAuthenticated) return

    const fetchDeposits = async () => {
      setLoadingDeposits(true)
      try {
        const data = await transactionsApi.deposits.getAll()
        setDeposits(data.deposits || [])

        // Also refresh user data to get updated balance
        const userData = await authApi.me()
        if (userData.user) {
          updateUser(userData.user)
        }
      } catch (error) {
        console.error('Failed to fetch deposits:', error)
      } finally {
        setLoadingDeposits(false)
      }
    }
    fetchDeposits()
  }, [isHydrated, isAuthenticated])

  // Fetch payment methods from API when modal opens
  useEffect(() => {
    if (showDepositModal && paymentMethods.length === 0) {
      const fetchPaymentMethods = async () => {
        setLoadingPaymentMethods(true)
        try {
          const data = await paymentMethodsApi.getAll()
          setPaymentMethods(data.paymentMethods || [])
        } catch (error) {
          console.error('Failed to fetch payment methods:', error)
        } finally {
          setLoadingPaymentMethods(false)
        }
      }
      fetchPaymentMethods()
    }
  }, [showDepositModal])

  // Fetch pay link requests and settings when tab changes
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return

    if (activeTab === 'pay-link') {
      const fetchPayLinkData = async () => {
        setLoadingPayLinks(true)
        try {
          const [requestsData, settingsData] = await Promise.all([
            transactionsApi.payLinkRequests.getAll(),
            transactionsApi.settings.getPayLinkEnabled()
          ])
          setPayLinkRequests(requestsData.payLinkRequests || [])
          setPayLinkEnabled(settingsData.payLinkEnabled)
        } catch (error) {
          console.error('Failed to fetch pay link data:', error)
        } finally {
          setLoadingPayLinks(false)
        }
      }
      fetchPayLinkData()
    }
  }, [activeTab, isHydrated, isAuthenticated])

  // Fetch wallet flow when tab changes
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return

    if (activeTab === 'wallet-flow') {
      const fetchWalletFlow = async () => {
        setLoadingWalletFlow(true)
        try {
          const data = await transactionsApi.walletFlow.getAll()
          setWalletFlows(data.flows || [])
        } catch (error) {
          console.error('Failed to fetch wallet flow:', error)
        } finally {
          setLoadingWalletFlow(false)
        }
      }
      fetchWalletFlow()
    }
  }, [activeTab, isHydrated, isAuthenticated])

  // Compress image for faster upload
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Scale down if larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          // Convert to compressed JPEG
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality)
          resolve(compressedBase64)
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
      if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid image file (JPG, PNG, GIF, SVG, or WebP)', 'error')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error')
        return
      }

      setUploadedFile(file)

      // Compress and create preview
      try {
        const compressed = await compressImage(file)
        setFilePreview(compressed)
      } catch {
        // Fallback to original if compression fails
        const reader = new FileReader()
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  // Handle drag and drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files?.[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
      if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid image file (JPG, PNG, GIF, SVG, or WebP)', 'error')
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast('File size must be less than 5MB', 'error')
        return
      }

      setUploadedFile(file)

      // Compress and create preview
      try {
        const compressed = await compressImage(file)
        setFilePreview(compressed)
      } catch {
        const reader = new FileReader()
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // Remove uploaded file
  const removeFile = () => {
    setUploadedFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Submit deposit handler
  const handleSubmitDeposit = async () => {
    if (!depositForm.payway || !depositForm.transactionId || !depositForm.chargeAmount) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    // Check if image is uploaded (mandatory)
    if (!filePreview) {
      showToast('Please upload a screenshot of your payment', 'error')
      return
    }

    // Check for duplicate transaction ID
    const existingTransaction = deposits.find(
      d => d.transactionId?.toLowerCase() === depositForm.transactionId.toLowerCase()
    )
    if (existingTransaction) {
      showToast('This Transaction ID has already been used. Please enter a unique Transaction ID.', 'error')
      return
    }

    // Get the selected payment method name
    const selectedPaymentMethod = paymentMethods.find(pm => pm.id === depositForm.payway)

    setSubmittingDeposit(true)
    try {
      await transactionsApi.deposits.create({
        paymentMethod: selectedPaymentMethod?.name || depositForm.payway,
        transactionId: depositForm.transactionId,
        amount: parseFloat(depositForm.chargeAmount),
        remarks: depositForm.remarks || null,
        paymentProof: filePreview || null
      })

      // Refresh deposits list
      const depositsData = await transactionsApi.deposits.getAll()
      setDeposits(depositsData.deposits || [])

      // Reset form and close modal
      setDepositForm({ payway: '', transactionId: '', chargeAmount: '', remarks: '' })
      setUploadedFile(null)
      setFilePreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setShowDepositModal(false)
      showToast('Deposit submitted successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to submit deposit:', error)
      showToast(error.message || 'Failed to submit deposit', 'error')
    } finally {
      setSubmittingDeposit(false)
    }
  }

  // Submit pay link request handler
  const handleSubmitPayLink = async () => {
    if (!payLinkForm.fullName || !payLinkForm.email || !payLinkForm.country || !payLinkForm.amount) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    // For company type, require company name
    if (payLinkType === 'company' && !payLinkForm.companyName) {
      showToast('Company name is required for company type', 'error')
      return
    }

    setSubmittingPayLink(true)
    try {
      await transactionsApi.payLinkRequests.create({
        type: payLinkType.toUpperCase(),
        fullName: payLinkForm.fullName,
        email: payLinkForm.email,
        country: payLinkForm.country,
        amount: parseFloat(payLinkForm.amount),
        companyName: payLinkType === 'company' ? payLinkForm.companyName : null,
        website: payLinkType === 'company' ? payLinkForm.website : null,
      })

      // Refresh pay link requests
      const data = await transactionsApi.payLinkRequests.getAll()
      setPayLinkRequests(data.payLinkRequests || [])

      // Reset form and close modal
      setPayLinkForm({ fullName: '', email: '', country: '', amount: '', companyName: '', website: '' })
      setShowPayLinkModal(false)
      showToast('Pay link request submitted successfully!', 'success')
    } catch (error: any) {
      console.error('Failed to submit pay link request:', error)
      showToast(error.message || 'Failed to submit pay link request', 'error')
    } finally {
      setSubmittingPayLink(false)
    }
  }

  const pendingCount = deposits.filter(d => d.status === 'PENDING').length
  const pendingPayLinkCount = payLinkRequests.filter(r => r.status === 'PENDING').length

  // Filter deposits based on action filter and date range
  const filteredDeposits = deposits.filter(deposit => {
    // Action filter
    if (actionFilter !== 'all') {
      const statusMap: Record<string, string> = {
        'approve': 'APPROVED',
        'pending': 'PENDING',
        'reject': 'REJECTED'
      }
      if (deposit.status !== statusMap[actionFilter]) return false
    }

    // Date filter
    const depositDate = new Date(deposit.createdAt)
    depositDate.setHours(0, 0, 0, 0)

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      if (depositDate < start) return false
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (depositDate > end) return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesApplyId = deposit.applyId?.toLowerCase().includes(query)
      const matchesTransactionId = deposit.transactionId?.toLowerCase().includes(query)
      const matchesAmount = deposit.amount.toString().includes(query)
      if (!matchesApplyId && !matchesTransactionId && !matchesAmount) return false
    }

    return true
  })

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate('')
    setEndDate('')
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 transition-all duration-300"
    switch (status) {
      case 'APPROVED':
        return (
          <span className={`${baseClasses} bg-[#52B788] text-white shadow-sm shadow-green-200`}>
            <Check className="w-3 h-3" />
            Approved
          </span>
        )
      case 'PENDING':
        return (
          <span className={`${baseClasses} bg-[#F59E0B] text-white shadow-sm shadow-amber-200`}>
            Pending
          </span>
        )
      case 'REJECTED':
        return (
          <span className={`${baseClasses} bg-[#EF4444] text-white shadow-sm shadow-red-200`}>
            Rejected
          </span>
        )
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-600`}>{status}</span>
    }
  }

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const tabs = [
    { id: 'add-money' as Tab, label: 'Add Money' },
    { id: 'pay-link' as Tab, label: 'Pay Link' },
    { id: 'wallet-flow' as Tab, label: 'Wallet Flow' },
  ]

  return (
    <DashboardLayout title="Wallet Management" subtitle="">
      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        @keyframes toastPop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
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

        .animate-toastPop {
          animation: toastPop 0.4s ease-out forwards;
        }

        .animate-checkBounce {
          animation: checkBounce 0.5s ease-out 0.1s forwards;
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out forwards;
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out forwards;
        }

        .table-row-animate {
          animation: fadeInUp 0.3s ease-out forwards;
        }

        .table-row-animate:nth-child(1) { animation-delay: 0.05s; }
        .table-row-animate:nth-child(2) { animation-delay: 0.1s; }
        .table-row-animate:nth-child(3) { animation-delay: 0.15s; }
        .table-row-animate:nth-child(4) { animation-delay: 0.2s; }
        .table-row-animate:nth-child(5) { animation-delay: 0.25s; }
        .table-row-animate:nth-child(6) { animation-delay: 0.3s; }
        .table-row-animate:nth-child(7) { animation-delay: 0.35s; }
        .table-row-animate:nth-child(8) { animation-delay: 0.4s; }

        .hover-lift {
          transition: all 0.2s ease;
        }

        .hover-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
      `}</style>

      <Card className="p-0 rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-scaleIn">
        {/* Header with Search and Actions */}
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/50">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-xs group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-[#52B788]" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] hover:border-gray-300"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select
                options={[
                  { value: 'all', label: 'Action' },
                  { value: 'approve', label: 'Approved' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'reject', label: 'Rejected' },
                ]}
                value={actionFilter}
                onChange={setActionFilter}
                placeholder="Action"
                className="w-36"
              />

              {/* Date Range Picker */}
              <DatePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClear={clearDateFilters}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Image
              </Button>

              {activeTab === 'pay-link' ? (
                payLinkEnabled && (
                  <Button
                    className="bg-[#52B788] hover:bg-[#16A34A] text-white rounded-xl shadow-lg shadow-green-200/50 hover:shadow-green-300/50 transition-all duration-300 hover:scale-[1.02]"
                    onClick={() => setShowPayLinkModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Paylink
                  </Button>
                )
              ) : (
                <Button
                  className="bg-[#52B788] hover:bg-[#16A34A] text-white rounded-xl shadow-lg shadow-green-200/50 hover:shadow-green-300/50 transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => setShowDepositModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Deposit
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium rounded-t-xl transition-all duration-300 relative overflow-hidden ${
                  activeTab === tab.id
                    ? 'bg-[#52B788] text-white shadow-lg shadow-green-200/40'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {activeTab === tab.id && (
                  <span className="absolute inset-0 bg-gradient-to-r from-[#52B788] to-[#16A34A]" />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            ))}

            {/* Pending Applications Badge / Wallet Flow Count */}
            <div className="ml-auto flex items-center gap-2 text-sm animate-slideIn">
              <span className="text-gray-500">
                {activeTab === 'wallet-flow' ? 'Total Transactions' : activeTab === 'pay-link' ? 'Pending Requests' : 'Pending Applications'}
              </span>
              <span className="px-3 py-1.5 bg-[#52B788] text-white rounded-full font-semibold shadow-md shadow-green-200/50 animate-pulse">
                {activeTab === 'wallet-flow' ? walletFlows.length : activeTab === 'pay-link' ? pendingPayLinkCount : pendingCount}
              </span>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto" key={activeTab}>
          {activeTab === 'add-money' && (
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[#52B788] uppercase tracking-wider">Charge Amount</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-[#3B82F6] uppercase tracking-wider">Image</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Payway</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Date</th>
                  <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingDeposits ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-3"></div>
                        <span>Loading deposits...</span>
                      </div>
                    </td>
                  </tr>
                ) : deposits.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16">
                      <div className="flex flex-col items-center justify-center">
                        {/* Empty State SVG */}
                        <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="100" cy="100" r="80" fill="#F0FDF4" stroke="#52B788" strokeWidth="2" strokeDasharray="8 4"/>
                          <rect x="60" y="70" width="80" height="60" rx="8" fill="white" stroke="#52B788" strokeWidth="2"/>
                          <path d="M60 85 L100 105 L140 85" stroke="#52B788" strokeWidth="2" fill="none"/>
                          <circle cx="100" cy="55" r="15" fill="#52B788" fillOpacity="0.2" stroke="#52B788" strokeWidth="2"/>
                          <path d="M95 55 L100 60 L108 50" stroke="#52B788" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M75 145 L85 135 M125 145 L115 135" stroke="#52B788" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                          <circle cx="100" cy="150" r="3" fill="#52B788" opacity="0.5"/>
                        </svg>
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">No Deposits Yet</h3>
                        <p className="text-sm text-gray-500 mb-4">Click "+ Add Deposit" to create your first deposit request</p>
                        <button
                          onClick={() => setShowDepositModal(true)}
                          className="px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#40916C] transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Deposit
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-1">No Results Found</h3>
                        <p className="text-sm text-gray-500 mb-4">No deposits match your current filters</p>
                        <button
                          onClick={() => {
                            setActionFilter('all')
                            setStartDate('')
                            setEndDate('')
                            setSearchQuery('')
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDeposits.map((item, index) => (
                    <tr
                      key={item.id}
                      className="table-row-animate hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-transparent transition-all duration-300 group"
                      style={{ opacity: 0 }}
                    >
                      <td className="py-3 px-4">
                        <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 group-hover:bg-[#52B788]/10 group-hover:text-[#52B788] transition-all duration-300">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">{item.applyId || `WD${item.id.slice(-8).toUpperCase()}`}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-bold text-[#52B788] whitespace-nowrap">${item.amount.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-600 font-mono truncate max-w-[150px] block" title={item.transactionId || ''}>{item.transactionId || '---'}</span>
                      </td>
                      <td className="py-3 px-4">
                        {item.paymentProof ? (
                          <button
                            onClick={() => setSelectedImage(item.paymentProof!)}
                            className="relative group/img flex items-center gap-1 transition-all duration-300"
                          >
                            <div className="relative w-8 h-8 rounded-md overflow-hidden border border-gray-200 group-hover/img:border-[#52B788] transition-all duration-300 shadow-sm">
                              <img
                                src={item.paymentProof}
                                alt="Payment proof"
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all duration-300 flex items-center justify-center">
                                <ZoomIn className="w-3 h-3 text-white opacity-0 group-hover/img:opacity-100 transition-all duration-300" />
                              </div>
                            </div>
                            <span className="text-[10px] text-[#3B82F6] font-medium group-hover/img:text-[#52B788] transition-colors">View</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">---</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {item.paymentMethod || '---'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-400 truncate max-w-[80px]" title={item.remarks || ''}>{item.remarks || '---'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'pay-link' && (
            loadingPayLinks ? (
              <div className="py-16">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-gray-500">Loading pay link requests...</span>
                </div>
              </div>
            ) : payLinkRequests.length === 0 ? (
              <div className="py-16">
                <div className="flex flex-col items-center justify-center">
                  {/* Empty State SVG for Pay Link */}
                  <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="80" fill="#F0FDF4" stroke="#52B788" strokeWidth="2" strokeDasharray="8 4"/>
                    <rect x="50" y="80" width="100" height="40" rx="8" fill="white" stroke="#52B788" strokeWidth="2"/>
                    <circle cx="70" cy="100" r="10" fill="#52B788" fillOpacity="0.3"/>
                    <path d="M85 95 H130 M85 105 H120" stroke="#52B788" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M100 60 L100 70 M100 130 L100 140" stroke="#52B788" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No Pay Links Yet</h3>
                  <p className="text-sm text-gray-500 mb-4">Apply for a Pay Link to receive payments</p>
                  {payLinkEnabled ? (
                    <button
                      onClick={() => setShowPayLinkModal(true)}
                      className="px-4 py-2 bg-[#52B788] text-white text-sm font-medium rounded-lg hover:bg-[#40916C] transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Apply Pay Link
                    </button>
                  ) : (
                    <p className="text-sm text-gray-400">Pay Link feature is currently disabled</p>
                  )}
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Country</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[#52B788] uppercase tracking-wider">Amount</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-[#3B82F6] uppercase tracking-wider">Pay Link</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Date</th>
                    <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payLinkRequests.map((request, index) => (
                    <tr
                      key={request.id}
                      className="table-row-animate hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-transparent transition-all duration-300 group"
                      style={{ opacity: 0 }}
                    >
                      <td className="py-3 px-4">
                        <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 group-hover:bg-[#52B788]/10 group-hover:text-[#52B788] transition-all duration-300">
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                          {request.applyId || `PL${request.id.slice(-8).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          request.type === 'INDIVIDUAL' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {request.type === 'INDIVIDUAL' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                          {request.type === 'INDIVIDUAL' ? 'Individual' : 'Company'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{request.fullName}</p>
                          {request.companyName && (
                            <p className="text-xs text-gray-500">{request.companyName}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          <Globe className="w-3.5 h-3.5" />
                          {request.country}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-bold text-[#52B788] whitespace-nowrap">
                          ${parseFloat(request.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {request.payLink ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={request.payLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#3B82F6] hover:underline truncate max-w-[120px] block"
                              title={request.payLink}
                            >
                              {request.payLink.length > 25 ? `${request.payLink.slice(0, 25)}...` : request.payLink}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(request.payLink)
                                showToast('Link copied to clipboard!', 'success')
                              }}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                              title="Copy link"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <a
                              href={request.payLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                              title="Open link"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">---</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {request.status === 'PENDING' && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-[#F59E0B] text-white shadow-sm shadow-amber-200">
                            Pending
                          </span>
                        )}
                        {request.status === 'LINK_CREATED' && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-[#3B82F6] text-white shadow-sm shadow-blue-200">
                            <LinkIcon className="w-3 h-3" />
                            Link Ready
                          </span>
                        )}
                        {request.status === 'COMPLETED' && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-[#52B788] text-white shadow-sm shadow-green-200">
                            <Check className="w-3 h-3" />
                            Completed
                          </span>
                        )}
                        {request.status === 'REJECTED' && (
                          <span className="px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-[#EF4444] text-white shadow-sm shadow-red-200">
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeTab === 'wallet-flow' && (
            loadingWalletFlow ? (
              <div className="py-16">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <span className="text-gray-500">Loading wallet flow...</span>
                </div>
              </div>
            ) : walletFlows.length === 0 ? (
              <div className="py-16">
                <div className="flex flex-col items-center justify-center">
                  {/* Empty State SVG for Wallet Flow */}
                  <svg className="w-32 h-32 mb-4" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="100" cy="100" r="80" fill="#F0FDF4" stroke="#52B788" strokeWidth="2" strokeDasharray="8 4"/>
                    <rect x="55" y="70" width="90" height="60" rx="8" fill="white" stroke="#52B788" strokeWidth="2"/>
                    <path d="M55 90 H145" stroke="#52B788" strokeWidth="2"/>
                    <circle cx="75" cy="110" r="8" fill="#52B788" fillOpacity="0.3" stroke="#52B788" strokeWidth="1"/>
                    <path d="M90 105 H130 M90 115 H120" stroke="#52B788" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                    <path d="M100 50 L100 60 M80 55 L90 60 M120 55 L110 60" stroke="#52B788" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">No Transactions Yet</h3>
                  <p className="text-sm text-gray-500">Your wallet transaction history will appear here</p>
                </div>
              </div>
            ) : (() => {
              const walletFlowTotalPages = Math.ceil(walletFlows.length / walletFlowPerPage)
              const paginatedWalletFlows = walletFlows.slice(
                (walletFlowPage - 1) * walletFlowPerPage,
                walletFlowPage * walletFlowPerPage
              )
              const startIndex = (walletFlowPage - 1) * walletFlowPerPage

              return (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-[#52B788] uppercase tracking-wider">Amount</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance Before</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance After</th>
                      <th className="text-left py-4 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedWalletFlows.map((flow, index) => (
                      <tr
                        key={flow.id}
                        className="table-row-animate hover:bg-gradient-to-r hover:from-gray-50/50 hover:to-transparent transition-all duration-300 group"
                        style={{ opacity: 0 }}
                      >
                        <td className="py-3 px-4">
                          <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 group-hover:bg-[#52B788]/10 group-hover:text-[#52B788] transition-all duration-300">
                            {startIndex + index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {/* Credit types: DEPOSIT, CREDIT, REFUND (money coming into wallet) */}
                            {/* Debit types: WITHDRAWAL, TRANSFER (money going out of wallet) */}
                            {['DEPOSIT', 'CREDIT', 'REFUND'].includes(flow.type) ? (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                Credit
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Debit
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              flow.referenceType === 'deposit' ? 'bg-green-100 text-green-600' :
                              flow.referenceType === 'withdrawal' ? 'bg-orange-100 text-orange-600' :
                              flow.referenceType === 'refund' ? 'bg-blue-100 text-blue-600' :
                              flow.referenceType === 'ad_account_recharge' ? 'bg-purple-100 text-purple-600' :
                              flow.referenceType === 'ad_account_apply' ? 'bg-indigo-100 text-indigo-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {flow.referenceType === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> :
                               flow.referenceType === 'withdrawal' ? <ArrowUpRight className="w-4 h-4" /> :
                               flow.referenceType === 'refund' ? <RefreshCw className="w-4 h-4" /> :
                               <Wallet className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {flow.description || (
                                  flow.referenceType === 'deposit' ? 'Deposit Added' :
                                  flow.referenceType === 'withdrawal' ? 'Withdrawal' :
                                  flow.referenceType === 'refund' ? 'Refund Approved' :
                                  flow.referenceType === 'ad_account_recharge' ? 'Ad Account Recharge' :
                                  flow.referenceType === 'ad_account_apply' ? 'Ad Account Apply' :
                                  'Wallet Transaction'
                                )}
                              </p>
                              {flow.referenceType && (
                                <p className="text-xs text-gray-500 capitalize">{flow.referenceType.replace(/_/g, ' ')}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-bold ${['DEPOSIT', 'CREDIT', 'REFUND'].includes(flow.type) ? 'text-green-600' : 'text-red-600'}`}>
                            {['DEPOSIT', 'CREDIT', 'REFUND'].includes(flow.type) ? '+' : '-'}${parseFloat(flow.amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-500">${parseFloat(flow.balanceBefore).toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-gray-700">${parseFloat(flow.balanceAfter).toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(flow.createdAt).toLocaleDateString()} {new Date(flow.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()
          )}
        </div>

        {/* Pagination for Deposits - Only show when there are deposits and on add-money tab */}
        {activeTab === 'add-money' && deposits.length > 0 && (() => {
          const itemsPerPage = 10
          const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage)

          if (totalPages <= 1) return null

          return (
            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
              <button
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl transition-all duration-200 ${
                  currentPage === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-300 ${
                      currentPage === page
                        ? 'bg-[#52B788] text-white shadow-lg shadow-green-200/50 scale-110'
                        : 'text-gray-600 hover:bg-gray-100 hover:scale-105'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl transition-all duration-200 ${
                  currentPage === totalPages
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
                onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )
        })()}

        {/* Pagination for Wallet Flow - Only show when there are wallet flows and on wallet-flow tab */}
        {activeTab === 'wallet-flow' && walletFlows.length > 0 && (() => {
          const totalPages = Math.ceil(walletFlows.length / walletFlowPerPage)

          return (
            <div className="p-5 border-t border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white">
              {/* Left side - Rows per page selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Rows per page:</span>
                <select
                  value={walletFlowPerPage}
                  onChange={(e) => {
                    setWalletFlowPerPage(Number(e.target.value))
                    setWalletFlowPage(1) // Reset to first page when changing per page
                  }}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] transition-all duration-200 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-500">
                  Showing {((walletFlowPage - 1) * walletFlowPerPage) + 1} - {Math.min(walletFlowPage * walletFlowPerPage, walletFlows.length)} of {walletFlows.length}
                </span>
              </div>

              {/* Right side - Page navigation */}
              <div className="flex items-center gap-2">
                <button
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl transition-all duration-200 ${
                    walletFlowPage === 1
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => walletFlowPage > 1 && setWalletFlowPage(p => p - 1)}
                  disabled={walletFlowPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Show page numbers with ellipsis for many pages */}
                  {(() => {
                    const pages: (number | string)[] = []
                    if (totalPages <= 5) {
                      for (let i = 1; i <= totalPages; i++) pages.push(i)
                    } else {
                      pages.push(1)
                      if (walletFlowPage > 3) pages.push('...')
                      for (let i = Math.max(2, walletFlowPage - 1); i <= Math.min(totalPages - 1, walletFlowPage + 1); i++) {
                        pages.push(i)
                      }
                      if (walletFlowPage < totalPages - 2) pages.push('...')
                      pages.push(totalPages)
                    }
                    return pages.map((page, idx) => (
                      typeof page === 'number' ? (
                        <button
                          key={idx}
                          onClick={() => setWalletFlowPage(page)}
                          className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-300 ${
                            walletFlowPage === page
                              ? 'bg-[#52B788] text-white shadow-lg shadow-green-200/50 scale-110'
                              : 'text-gray-600 hover:bg-gray-100 hover:scale-105'
                          }`}
                        >
                          {page}
                        </button>
                      ) : (
                        <span key={idx} className="w-8 text-center text-gray-400">...</span>
                      )
                    ))
                  })()}
                </div>

                <button
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl transition-all duration-200 ${
                    walletFlowPage === totalPages
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                  onClick={() => walletFlowPage < totalPages && setWalletFlowPage(p => p + 1)}
                  disabled={walletFlowPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })()}
      </Card>

      {/* Add Deposit Money Modal */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Add Deposit Money"
        className="max-w-lg"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          Create a deposit process which you want to enter in your wallet.
        </p>

        <div className="space-y-4">
          {/* Row 1: Payway and Transaction ID side by side */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Payway"
              options={paymentMethods.map(pm => ({
                value: pm.id,
                label: `${pm.icon} ${pm.name}`
              }))}
              value={depositForm.payway}
              onChange={(value) => setDepositForm({...depositForm, payway: value})}
              placeholder={loadingPaymentMethods ? "Loading..." : "Select Pay method"}
              disabled={loadingPaymentMethods}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Transaction ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Enter unique Transaction ID"
                value={depositForm.transactionId}
                onChange={(e) => setDepositForm({...depositForm, transactionId: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
              />
            </div>
          </div>

          {/* Payment Details Info Box - shows when payment method is selected */}
          {depositForm.payway && (() => {
            const selectedMethod = paymentMethods.find(pm => pm.id === depositForm.payway)
            if (!selectedMethod?.description) return null
            return (
              <div className="bg-[#52B788]/10 border border-[#52B788]/30 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs text-[#52B788] font-medium mb-1">Payment Address / Details</p>
                    <p className="text-sm text-gray-800 font-mono break-all">{selectedMethod.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMethod.description || '')
                      setCopiedId(-1)
                      setTimeout(() => setCopiedId(null), 2000)
                    }}
                    className="flex-shrink-0 p-2 rounded-lg bg-[#52B788] text-white hover:bg-[#40916C] transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedId === -1 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Row 2: Charge Amount */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Charge Amount</label>
            <input
              type="text"
              placeholder="Enter amount"
              value={depositForm.chargeAmount}
              onChange={(e) => setDepositForm({...depositForm, chargeAmount: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
            />
          </div>

          {/* Row 3: Remarks */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">remarks</label>
            <input
              type="text"
              placeholder="remarks (optional)"
              value={depositForm.remarks}
              onChange={(e) => setDepositForm({...depositForm, remarks: e.target.value})}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
            />
          </div>

          {/* Row 4: Attach Screenshot Image - Purple dashed border (Required) */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Attach Screenshot Image <span className="text-red-500">*</span>
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {filePreview ? (
              // Show preview when file is uploaded
              <div className="relative border-2 border-[#52B788] rounded-xl p-4 bg-green-50/30">
                <div className="flex items-start gap-4">
                  {/* Image preview */}
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-[#52B788]/30 shadow-sm">
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* File info */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">
                      {uploadedFile?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {uploadedFile && (uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#52B788]/20 text-[#52B788] text-xs font-medium rounded-full">
                        <Check className="w-3 h-3" />
                        Uploaded
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 rounded-lg bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Change file button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 w-full py-2 text-sm text-[#8B5CF6] font-medium border border-[#8B5CF6]/30 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Change Image
                </button>
              </div>
            ) : (
              // Upload area when no file is selected
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-[#8B5CF6] rounded-xl p-8 text-center bg-purple-50/30 hover:bg-purple-50/50 transition-all duration-300 cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="text-sm">
                    <span className="text-[#8B5CF6] font-medium">Click to upload</span>
                    <span className="text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-400">SVG, PNG, JPG, GIF or WebP</p>
                  <p className="text-xs text-gray-400">(max. 5MB)</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-200 rounded-xl py-3"
              onClick={() => setShowDepositModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#52B788] hover:bg-[#16A34A] rounded-xl py-3"
              onClick={handleSubmitDeposit}
              disabled={submittingDeposit}
            >
              {submittingDeposit ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Apply Pay Link Modal */}
      <Modal
        isOpen={showPayLinkModal}
        onClose={() => setShowPayLinkModal(false)}
        title="Apply Pay Link"
        className="max-w-lg"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          Create a deposit process which you want to enter in your wallet.
        </p>

        <div className="space-y-4">
          {/* Individual / Company Toggle */}
          <div className="grid grid-cols-2 gap-0 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setPayLinkType('individual')}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                payLinkType === 'individual'
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4" />
              Individual User
            </button>
            <button
              onClick={() => setPayLinkType('company')}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                payLinkType === 'company'
                  ? 'bg-[#52B788] text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Company
            </button>
          </div>

          <div className="space-y-4 animate-fadeInUp" key={payLinkType}>
            {payLinkType === 'individual' ? (
              <>
                {/* Row 1: Full Name and Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      placeholder="Enter your Full Name"
                      value={payLinkForm.fullName}
                      onChange={(e) => setPayLinkForm({...payLinkForm, fullName: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      placeholder="Enter Email ID"
                      value={payLinkForm.email}
                      onChange={(e) => setPayLinkForm({...payLinkForm, email: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 2: Country and Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Country *</label>
                    <input
                      type="text"
                      placeholder="Enter your Country"
                      value={payLinkForm.country}
                      onChange={(e) => setPayLinkForm({...payLinkForm, country: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Amount *</label>
                    <input
                      type="number"
                      placeholder="Enter Amount"
                      value={payLinkForm.amount}
                      onChange={(e) => setPayLinkForm({...payLinkForm, amount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-sm text-amber-700">
                    <span className="font-semibold">Note:</span> After submission, our team will review your request and create a payment link for you.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Row 1: Full Name and Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                    <input
                      type="text"
                      placeholder="Enter your Full Name"
                      value={payLinkForm.fullName}
                      onChange={(e) => setPayLinkForm({...payLinkForm, fullName: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Email *</label>
                    <input
                      type="email"
                      placeholder="Enter Email ID"
                      value={payLinkForm.email}
                      onChange={(e) => setPayLinkForm({...payLinkForm, email: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 2: Company Name and Website Address */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Company Name *</label>
                    <input
                      type="text"
                      placeholder="Enter your Company Name"
                      value={payLinkForm.companyName}
                      onChange={(e) => setPayLinkForm({...payLinkForm, companyName: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Website Address</label>
                    <input
                      type="url"
                      placeholder="Enter Website Address"
                      value={payLinkForm.website}
                      onChange={(e) => setPayLinkForm({...payLinkForm, website: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Row 3: Country and Amount */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Country *</label>
                    <input
                      type="text"
                      placeholder="Enter your Country Name"
                      value={payLinkForm.country}
                      onChange={(e) => setPayLinkForm({...payLinkForm, country: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Amount *</label>
                    <input
                      type="number"
                      placeholder="Enter Amount"
                      value={payLinkForm.amount}
                      onChange={(e) => setPayLinkForm({...payLinkForm, amount: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-sm text-amber-700">
                    <span className="font-semibold">Note:</span> After submission, our team will review your request and create a payment link for you.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-200 rounded-xl py-3"
              onClick={() => setShowPayLinkModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#52B788] hover:bg-[#16A34A] rounded-xl py-3"
              onClick={handleSubmitPayLink}
              disabled={submittingPayLink}
            >
              {submittingPayLink ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center animate-fadeInUp"
          onClick={() => setSelectedImage(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all duration-300 z-10 group"
          >
            <X className="w-6 h-6 text-white group-hover:rotate-90 transition-transform duration-300" />
          </button>

          {/* Image Container */}
          <div
            className="relative max-w-4xl max-h-[85vh] mx-4 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Receipt Card Frame */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#52B788] to-[#16A34A] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Payment Proof</h3>
                    <p className="text-white/70 text-sm">Transaction Screenshot</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium">
                    Verified
                  </span>
                </div>
              </div>

              {/* Image */}
              <div className="p-4 bg-gray-50">
                <img
                  src={selectedImage}
                  alt="Payment proof"
                  className="w-full max-h-[60vh] object-contain rounded-xl shadow-inner"
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">Click outside or press ESC to close</p>
                <Button
                  onClick={() => setSelectedImage(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all duration-200"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification - Centered with smooth animation */}
      {toast && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div
            className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl transform transition-all duration-300 ease-out animate-toastPop ${
              toast.type === 'success'
                ? 'bg-white border-2 border-[#52B788]'
                : 'bg-white border-2 border-red-500'
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-checkBounce ${
              toast.type === 'success' ? 'bg-[#52B788]' : 'bg-red-500'
            }`}>
              {toast.type === 'success' ? (
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              ) : (
                <X className="w-8 h-8 text-white" strokeWidth={3} />
              )}
            </div>
            <span className={`text-lg font-semibold ${
              toast.type === 'success' ? 'text-[#52B788]' : 'text-red-500'
            }`}>
              {toast.type === 'success' ? 'Success!' : 'Error!'}
            </span>
            <span className="text-gray-600 text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
