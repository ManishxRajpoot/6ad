'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Plus, Search, MoreVertical, Eye, Edit, Ban, Trash2, DollarSign,
  Users as UsersIcon, ChevronDown, ChevronLeft, ChevronRight, Shield,
  Copy, Check, RefreshCw, EyeOff, Loader2, CheckCircle, XCircle, Ticket, Undo2,
  Wallet, Settings
} from 'lucide-react'

type Agent = {
  id: string
  username: string
  email: string
  plaintextPassword?: string | null
  phone: string | null
  phone2?: string | null
  status: string
  walletBalance: string
  uniqueId: string
  createdAt: string
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  fbFee?: number | string
  fbCommission?: number | string
  googleFee?: number | string
  googleCommission?: number | string
  tiktokFee?: number | string
  tiktokCommission?: number | string
  snapchatFee?: number | string
  snapchatCommission?: number | string
  bingFee?: number | string
  bingCommission?: number | string
  showBalanceToAgent?: boolean
  couponBalance?: number
}

export default function AgentsPage() {
  const toast = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false)
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [formLoading, setFormLoading] = useState(false)
  const [copied2FAKey, setCopied2FAKey] = useState(false)
  const [resetting2FA, setResetting2FA] = useState(false)

  // Coupon modal state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [couponAgent, setCouponAgent] = useState<Agent | null>(null)
  const [couponAmount, setCouponAmount] = useState(1)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponMode, setCouponMode] = useState<'give' | 'take'>('give')

  // Tab refs for sliding indicator
  const allTabRef = useRef<HTMLButtonElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const blockedTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    status: 'ACTIVE',
    showBalanceToAgent: false,
    platformFees: {
      facebook: { openingFee: '', depositFee: '' },
      google: { openingFee: '', depositFee: '' },
      tiktok: { openingFee: '', depositFee: '' },
      snapchat: { openingFee: '', depositFee: '' },
      bing: { openingFee: '', depositFee: '' },
    }
  })

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      let activeRef = allTabRef
      if (statusFilter === 'active') activeRef = activeTabRef
      else if (statusFilter === 'blocked') activeRef = blockedTabRef

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
  }, [statusFilter])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const copy2FAKey = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopied2FAKey(true)
    setTimeout(() => setCopied2FAKey(false), 2000)
  }

  const handleReset2FA = async (agent: Agent) => {
    if (!confirm(`Are you sure you want to reset 2FA for ${agent.username}? They will need to set up 2FA again on next login.`)) {
      return
    }

    setResetting2FA(true)
    try {
      const response = await agentsApi.reset2FA(agent.id)
      toast.success('2FA Reset', response.message)
      if (selectedAgent?.id === agent.id) {
        setSelectedAgent({ ...selectedAgent, twoFactorEnabled: false, twoFactorSecret: undefined })
      }
      fetchAgents()
    } catch (error: any) {
      toast.error('Failed to reset 2FA', error.message || 'An error occurred')
    } finally {
      setResetting2FA(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const { agents } = await agentsApi.getAll()
      setAgents(agents || [])
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  const handleViewProfile = (agent: Agent) => {
    setSelectedAgent(agent)
    setIsViewProfileOpen(true)
    setActiveDropdown(null)
  }

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent)
    setFormData({
      username: agent.username,
      email: agent.email,
      password: '',
      phone: agent.phone || '',
      status: agent.status,
      showBalanceToAgent: agent.showBalanceToAgent || false,
      platformFees: {
        facebook: { openingFee: String(Number(agent.fbFee) || 0), depositFee: String(Number(agent.fbCommission) || 0) },
        google: { openingFee: String(Number(agent.googleFee) || 0), depositFee: String(Number(agent.googleCommission) || 0) },
        tiktok: { openingFee: String(Number(agent.tiktokFee) || 0), depositFee: String(Number(agent.tiktokCommission) || 0) },
        snapchat: { openingFee: String(Number(agent.snapchatFee) || 0), depositFee: String(Number(agent.snapchatCommission) || 0) },
        bing: { openingFee: String(Number(agent.bingFee) || 0), depositFee: String(Number(agent.bingCommission) || 0) },
      }
    })
    setIsEditMode(true)
    setIsViewProfileOpen(false)
    setIsModalOpen(true)
  }

  const handleAddAgent = () => {
    setSelectedAgent(null)
    setFormData({
      username: '',
      email: '',
      password: '',
      phone: '',
      status: 'ACTIVE',
      showBalanceToAgent: false,
      platformFees: {
        facebook: { openingFee: '', depositFee: '' },
        google: { openingFee: '', depositFee: '' },
        tiktok: { openingFee: '', depositFee: '' },
        snapchat: { openingFee: '', depositFee: '' },
        bing: { openingFee: '', depositFee: '' },
      }
    })
    setIsEditMode(false)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const payload: any = {
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        showBalanceToAgent: formData.showBalanceToAgent,
        fbFee: Number(formData.platformFees.facebook.openingFee) || 0,
        fbCommission: Number(formData.platformFees.facebook.depositFee) || 0,
        googleFee: Number(formData.platformFees.google.openingFee) || 0,
        googleCommission: Number(formData.platformFees.google.depositFee) || 0,
        tiktokFee: Number(formData.platformFees.tiktok.openingFee) || 0,
        tiktokCommission: Number(formData.platformFees.tiktok.depositFee) || 0,
        snapchatFee: Number(formData.platformFees.snapchat.openingFee) || 0,
        snapchatCommission: Number(formData.platformFees.snapchat.depositFee) || 0,
        bingFee: Number(formData.platformFees.bing.openingFee) || 0,
        bingCommission: Number(formData.platformFees.bing.depositFee) || 0,
      }

      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      if (selectedAgent) {
        await agentsApi.update(selectedAgent.id, payload)
        toast.success('Agent Updated', `${formData.username} has been updated successfully`)
      } else {
        payload.password = formData.password
        await agentsApi.create(payload)
        toast.success('Agent Created', `${formData.username} has been added successfully`)
      }

      setIsModalOpen(false)
      fetchAgents()
    } catch (error: any) {
      toast.error('Failed to save agent', error.message || 'An error occurred while saving the agent')
    } finally {
      setFormLoading(false)
    }
  }

  const handleOpenBlockModal = (agent: Agent) => {
    setSelectedAgent(agent)
    setBlockReason('')
    setIsBlockModalOpen(true)
    setActiveDropdown(null)
  }

  const handleBlockAgent = async () => {
    if (!selectedAgent || !blockReason.trim()) {
      toast.warning('Missing Information', 'Please enter a reason for blocking/unblocking this agent')
      return
    }

    try {
      const isCurrentlyActive = selectedAgent.status === 'ACTIVE'
      const action = isCurrentlyActive ? 'blocked' : 'unblocked'
      const newStatus = isCurrentlyActive ? 'BLOCKED' : 'ACTIVE'

      if (isCurrentlyActive) {
        await agentsApi.block(selectedAgent.id, blockReason)
      } else {
        await agentsApi.unblock(selectedAgent.id)
      }

      setAgents(prevAgents =>
        prevAgents.map(agent =>
          agent.id === selectedAgent.id
            ? { ...agent, status: newStatus }
            : agent
        )
      )

      setIsBlockModalOpen(false)
      setBlockReason('')
      setSelectedAgent(null)

      toast.success(
        `Agent ${action}!`,
        `${selectedAgent.username} has been ${action} successfully`
      )
    } catch (error: any) {
      console.error('Block agent error:', error)
      toast.error(
        'Failed to update agent',
        error.message || 'An error occurred while updating the agent status'
      )
    }
  }

  const handleDeleteAgent = async (agent: Agent) => {
    if (confirm(`Are you sure you want to delete ${agent.username}? This action cannot be undone. Note: Their users will NOT be deleted.`)) {
      try {
        await agentsApi.delete(agent.id)
        toast.success('Agent Deleted', `${agent.username} has been removed from the system`)
        fetchAgents()
      } catch (error: any) {
        toast.error('Failed to delete agent', error.message || 'An error occurred while deleting the agent')
      }
    }
  }

  const handleViewBalance = (agent: Agent) => {
    setSelectedAgent(agent)
    setIsBalanceModalOpen(true)
    setActiveDropdown(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied', 'Copied to clipboard')
  }

  const handleGiveCoupon = (agent: Agent) => {
    setCouponAgent(agent)
    setCouponAmount(1)
    setCouponMode('give')
    setIsCouponModalOpen(true)
  }

  const handleTakeCoupon = (agent: Agent) => {
    setCouponAgent(agent)
    setCouponAmount(1)
    setCouponMode('take')
    setIsCouponModalOpen(true)
  }

  const confirmCouponAction = async () => {
    if (!couponAgent || couponAmount < 1) return
    setCouponLoading(true)
    try {
      let response
      if (couponMode === 'give') {
        response = await agentsApi.addCoupons(couponAgent.id, couponAmount)
        toast.success('Coupons Added', response.message)
      } else {
        response = await agentsApi.removeCoupons(couponAgent.id, couponAmount)
        toast.success('Coupons Removed', response.message)
      }
      setIsCouponModalOpen(false)
      setCouponAgent(null)
      fetchAgents()
    } catch (error: any) {
      toast.error('Error', error.message || `Failed to ${couponMode} coupons`)
    } finally {
      setCouponLoading(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Filter & sort
  const filteredAgents = agents.filter((agent) => {
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch = !query ||
      agent.username?.toLowerCase().includes(query) ||
      agent.email?.toLowerCase().includes(query) ||
      agent.uniqueId?.toLowerCase().includes(query)

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && agent.status === 'ACTIVE') ||
      (statusFilter === 'blocked' && agent.status === 'BLOCKED')

    return matchesSearch && matchesStatus
  }).sort((a, b) => {
    switch (sortBy) {
      case 'balance-high':
        return Number(b.walletBalance) - Number(a.walletBalance)
      case 'balance-low':
        return Number(a.walletBalance) - Number(b.walletBalance)
      case 'blocked':
        return a.status === 'BLOCKED' ? -1 : 1
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
  })

  // Pagination
  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage)
  const paginatedAgents = filteredAgents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortBy])

  // Stats
  const totalAgentsCount = agents.length
  const totalBalance = agents.reduce((sum, a) => sum + Number(a.walletBalance || 0), 0)
  const totalCoupons = agents.reduce((sum, a) => sum + (a.couponBalance || 0), 0)
  const activeAgents = agents.filter(a => a.status === 'ACTIVE').length
  const blockedAgents = agents.filter(a => a.status === 'BLOCKED').length

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    if (status === 'ACTIVE') {
      return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
        <CheckCircle className="w-3 h-3" /> Active
      </span>
    }
    return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
      <XCircle className="w-3 h-3" /> Blocked
    </span>
  }

  return (
    <DashboardLayout title="Agents Management">
      {/* Animation styles */}
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      <div className="space-y-3">
        {/* Top Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] lg:flex-none group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-teal-600" />
              <input
                type="text"
                placeholder="Search agents, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[220px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all"
              />
            </div>

            {/* Sort Filter */}
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:border-gray-300 transition-colors min-w-[130px] justify-between bg-white"
              >
                <span>
                  {sortBy === 'newest' ? 'Newest First' : sortBy === 'balance-high' ? 'High Balance' : sortBy === 'balance-low' ? 'Low Balance' : 'Blocked First'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} />
              </button>
              <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
                showSortDropdown
                  ? 'opacity-100 scale-y-100 translate-y-0 visible'
                  : 'opacity-0 scale-y-95 -translate-y-1 invisible'
              }`}>
                {[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'balance-high', label: 'Balance: High to Low' },
                  { value: 'balance-low', label: 'Balance: Low to High' },
                  { value: 'blocked', label: 'Blocked First' },
                ].map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setShowSortDropdown(false) }}
                    className={`w-full px-3 py-2 text-left text-[12px] hover:bg-gray-50 transition-all duration-150 ${sortBy === option.value ? 'text-teal-600 bg-teal-500/5 font-medium' : 'text-gray-600'}`}
                    style={{ transitionDelay: showSortDropdown ? `${index * 30}ms` : '0ms' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add Agent Button */}
          <button
            onClick={handleAddAgent}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-[12px] font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Agent
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Agents</span>
                <p className="text-xl font-bold text-gray-800">{totalAgentsCount.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#52B788] text-white text-[10px] font-medium rounded">+{activeAgents} active</span>
            </div>
            <StatsChart value={totalAgentsCount} color="#0D9488" filterId="glowTealAgents" gradientId="fadeTealAgents" clipId="clipTealAgents" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Balance</span>
                <p className="text-xl font-bold text-gray-800">${totalBalance.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#52B788] text-white text-[10px] font-medium rounded">All Agents</span>
            </div>
            <StatsChart value={totalBalance} color="#52B788" filterId="glowGreenAgents" gradientId="fadeGreenAgents" clipId="clipGreenAgents" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Agents Coupons</span>
                <p className="text-xl font-bold text-gray-800">{totalCoupons.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded">Total</span>
            </div>
            <StatsChart value={totalCoupons} color="#F59E0B" filterId="glowOrangeAgents" gradientId="fadeOrangeAgents" clipId="clipOrangeAgents" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Blocked Agents</span>
                <p className="text-xl font-bold text-gray-800">{blockedAgents.toLocaleString()}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-medium rounded">Blocked</span>
            </div>
            <StatsChart value={blockedAgents} color="#EF4444" filterId="glowRedAgents" gradientId="fadeRedAgents" clipId="clipRedAgents" />
          </Card>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100 flex-shrink-0">
            <div className="flex relative">
              <button
                ref={allTabRef}
                onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'all'
                    ? 'text-teal-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Agents
              </button>
              <button
                ref={activeTabRef}
                onClick={() => { setStatusFilter('active'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'active'
                    ? 'text-teal-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                ref={blockedTabRef}
                onClick={() => { setStatusFilter('blocked'); setCurrentPage(1) }}
                className={`px-5 py-3 text-[13px] font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'blocked'
                    ? 'text-teal-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Blocked
              </button>
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-teal-600 transition-all duration-300 ease-out"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1 min-h-0" key={statusFilter}>
            <table className="w-full text-[11px] xl:text-[12px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Agent</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[16%]">Credentials</th>
                  <th className="text-right py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[9%]">Balance</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Coupons</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[10%]">Join Date</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[9%]">Status</th>
                  <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[18%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-5 h-5 text-teal-600 animate-spin mb-1" />
                        <span className="text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedAgents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">
                      {searchQuery ? 'No matching agents found' : 'No agents found'}
                    </td>
                  </tr>
                ) : (
                  paginatedAgents.map((agent, index) => (
                    <tr
                      key={agent.id}
                      className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      {/* Agent Info */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-shrink-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm">
                              {agent.username.charAt(0).toUpperCase()}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white ${
                              agent.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate max-w-[120px] xl:max-w-[160px]">{agent.username}</p>
                            <p className="text-gray-500 text-[10px] truncate">#{agent.uniqueId?.slice(-5) || '00001'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Credentials */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-600 truncate max-w-[120px] xl:max-w-[160px]">{agent.email}</span>
                            <button onClick={() => copyToClipboard(agent.email)} className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0">
                              <Copy className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setShowPasswordId(showPasswordId === agent.id ? null : agent.id)}
                              className="flex items-center gap-1 group min-w-0"
                            >
                              <code
                                className={`font-medium px-1.5 py-0.5 rounded text-[11px] transition-all duration-300 ease-out ${
                                  showPasswordId === agent.id && agent.plaintextPassword
                                    ? 'text-gray-700 bg-gray-100'
                                    : showPasswordId === agent.id && !agent.plaintextPassword
                                    ? 'text-red-500 bg-red-50'
                                    : 'text-gray-400 bg-gray-100'
                                }`}
                              >
                                {showPasswordId === agent.id
                                  ? (agent.plaintextPassword || 'Reset needed')
                                  : '••••••'}
                              </code>
                              <span className="flex-shrink-0">
                                {showPasswordId === agent.id ? (
                                  <EyeOff className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <Eye className="w-3 h-3 text-gray-400" />
                                )}
                              </span>
                            </button>
                            {showPasswordId === agent.id && agent.plaintextPassword && (
                              <button onClick={() => copyToClipboard(agent.plaintextPassword!)} className="p-0.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0">
                                <Copy className="w-3 h-3 text-gray-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="py-2.5 px-3 text-right">
                        <p className="font-semibold text-[#52B788]">
                          ${Number(agent.walletBalance || 0).toLocaleString()}
                        </p>
                      </td>

                      {/* Coupons */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 text-teal-600 font-semibold">
                            <Ticket className="w-3 h-3" />
                            {agent.couponBalance || 0}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleGiveCoupon(agent)}
                              className="p-1 rounded bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 transition-colors"
                              title="Give Coupons"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleTakeCoupon(agent)}
                              disabled={(agent.couponBalance || 0) < 1}
                              className="p-1 rounded bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Take Back Coupons"
                            >
                              <Undo2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap text-center">
                        {formatDate(agent.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(agent.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewProfile(agent)}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                            title="View"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="flex items-center gap-1 px-2 py-1 bg-teal-500/10 text-teal-600 rounded font-medium hover:bg-teal-500/20 transition-colors whitespace-nowrap"
                            title="Edit"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          {agent.status === 'BLOCKED' ? (
                            <button
                              onClick={() => handleOpenBlockModal(agent)}
                              className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-600 rounded font-medium hover:bg-green-200 transition-colors whitespace-nowrap"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenBlockModal(agent)}
                              className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded font-medium hover:bg-red-200 transition-colors whitespace-nowrap"
                            >
                              <Ban className="w-3 h-3" />
                              Block
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === agent.id ? null : agent.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                              title="More"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                            {activeDropdown === agent.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-[60]"
                                  onClick={() => setActiveDropdown(null)}
                                />
                                <div className="absolute right-0 top-7 z-[70] w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1">
                                  <button
                                    onClick={() => handleViewBalance(agent)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                                    Balance Report
                                  </button>
                                  <div className="h-px bg-gray-100 my-0.5" />
                                  <button
                                    onClick={() => handleDeleteAgent(agent)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete Agent
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white text-[12px]">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Show</span>
              <PaginationSelect
                value={itemsPerPage}
                onChange={(val) => { setItemsPerPage(val === -1 ? filteredAgents.length : val); setCurrentPage(1) }}
              />
              <span className="text-gray-500">
                of {filteredAgents.length} agents
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
                          ? 'bg-[#6366F1] text-white shadow-sm'
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
                          ? 'bg-[#6366F1] text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      1
                    </button>
                    {currentPage > 3 && <span className="w-4 text-center text-gray-400">...</span>}
                    {currentPage > 2 && currentPage < totalPages - 1 && (
                      <button
                        className="w-8 h-8 rounded-lg font-medium bg-[#6366F1] text-white shadow-sm"
                      >
                        {currentPage}
                      </button>
                    )}
                    {currentPage < totalPages - 2 && <span className="w-4 text-center text-gray-400">...</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={`w-8 h-8 rounded-lg font-medium transition-colors ${
                        currentPage === totalPages
                          ? 'bg-[#6366F1] text-white shadow-sm'
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

      {/* Add/Edit Agent Modal with Platform Fees */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedAgent ? 'Edit Agent' : 'Add New Agent'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[75vh] overflow-y-auto">
          {/* Basic Information */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5 text-teal-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Agency Name *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                  placeholder="Enter agency name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  Password {!selectedAgent && '*'}
                </label>
                <input
                  type="password"
                  required={!selectedAgent}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                  placeholder={selectedAgent ? "Leave blank to keep" : "Enter password"}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                  placeholder="+1234567890"
                />
              </div>
            </div>
          </div>

          {/* Platform Fees - Compact Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[#52B788]" />
              Platform Fee (Minimum Limits)
            </h3>

            <div className="rounded-lg border border-gray-200 overflow-hidden text-[10px]">
              <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
                <div className="px-2 py-1.5 font-semibold text-gray-600">Platform</div>
                <div className="px-2 py-1.5 font-semibold text-gray-600 text-center">Opening ($)</div>
                <div className="px-2 py-1.5 font-semibold text-gray-600 text-center">Commission (%)</div>
              </div>

              {/* Facebook */}
              <div className="grid grid-cols-3 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">Facebook</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    value={formData.platformFees.facebook.openingFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, openingFee: e.target.value } } })}
                    placeholder="30"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.platformFees.facebook.depositFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, depositFee: e.target.value } } })}
                    placeholder="3"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* Google */}
              <div className="grid grid-cols-3 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">Google</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    value={formData.platformFees.google.openingFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, openingFee: e.target.value } } })}
                    placeholder="50"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.platformFees.google.depositFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, depositFee: e.target.value } } })}
                    placeholder="5"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* TikTok */}
              <div className="grid grid-cols-3 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-gray-900 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">TikTok</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    value={formData.platformFees.tiktok.openingFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, openingFee: e.target.value } } })}
                    placeholder="40"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.platformFees.tiktok.depositFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, depositFee: e.target.value } } })}
                    placeholder="4"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* Snapchat */}
              <div className="grid grid-cols-3 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-.809-.329-1.24-.719-1.24-1.138 0-.389.283-.72.735-.838.209-.06.479-.09.657-.09.135 0 .3.015.449.09.376.18.735.285 1.049.301.181 0 .313-.045.387-.09-.008-.12-.016-.242-.026-.37l-.003-.051c-.104-1.612-.238-3.654.283-4.847C7.879 1.069 11.216.793 12.206.793z"/>
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">Snapchat</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    value={formData.platformFees.snapchat.openingFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, openingFee: e.target.value } } })}
                    placeholder="35"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.platformFees.snapchat.depositFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, depositFee: e.target.value } } })}
                    placeholder="3.5"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* Bing */}
              <div className="grid grid-cols-3 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10.1 8.6L11.8 12.9L14.6 14.2L9 17.5V3.4L5 2V19.8L9 22L19 16.2V11.7L10.1 8.6Z"/>
                    </svg>
                  </div>
                  <span className="font-medium text-gray-700">Bing</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    value={formData.platformFees.bing.openingFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, openingFee: e.target.value } } })}
                    placeholder="45"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.platformFees.bing.depositFee}
                    onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, depositFee: e.target.value } } })}
                    placeholder="4.5"
                    className="w-full h-6 px-1.5 rounded border border-gray-200 text-[10px] text-center focus:border-teal-500 focus:outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Settings */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-gray-500" />
              Dashboard Settings
            </h3>
            <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-800">Show Ad Account Balance</p>
                <p className="text-[10px] text-gray-500">Allow this agent to view account balances</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, showBalanceToAgent: !formData.showBalanceToAgent })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${
                  formData.showBalanceToAgent ? 'bg-teal-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    formData.showBalanceToAgent ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 h-8 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 h-8 rounded-md bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? 'Saving...' : (selectedAgent ? 'Update Agent' : 'Create Agent')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Balance Report Modal */}
      <Modal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        title="Balance Report"
      >
        {selectedAgent && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/25">
                {selectedAgent.username.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedAgent.username}</h3>
                <p className="text-sm text-gray-500">{selectedAgent.email}</p>
                <p className="text-xs text-gray-400">Agent #{selectedAgent.uniqueId?.slice(-5) || '00001'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium opacity-90">Agent Balance</span>
                </div>
                <p className="text-3xl font-bold">${Number(selectedAgent.walletBalance || 0).toLocaleString()}</p>
                <p className="text-xs opacity-75 mt-2">Available in wallet</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <UsersIcon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium opacity-90">Users Balance</span>
                </div>
                <p className="text-3xl font-bold">${(Number(selectedAgent.walletBalance || 0) * 2.5).toLocaleString()}</p>
                <p className="text-xs opacity-75 mt-2">Combined balance</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">156</p>
                <p className="text-xs text-gray-500 mt-1">Total Users</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">87%</p>
                <p className="text-xs text-gray-500 mt-1">Active Rate</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">$1.2M</p>
                <p className="text-xs text-gray-500 mt-1">Lifetime Value</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <Button onClick={() => setIsBalanceModalOpen(false)} className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Profile Modal */}
      <Modal
        isOpen={isViewProfileOpen}
        onClose={() => setIsViewProfileOpen(false)}
        title="Agent Profile"
      >
        {selectedAgent && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-teal-500/25">
                  {selectedAgent.username.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedAgent.username}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedAgent.email}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className={`w-2 h-2 rounded-full ${selectedAgent.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-medium ${selectedAgent.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {selectedAgent.status === 'ACTIVE' ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleEditAgent(selectedAgent)}
                className="p-2 hover:bg-teal-50 rounded-xl transition-colors"
                title="Edit Agent"
              >
                <Edit className="h-5 w-5 text-teal-600" />
              </button>
            </div>

            <div className="space-y-0 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-medium ${selectedAgent.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {selectedAgent.status}
                </span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Agency ID</span>
                <span className="text-sm font-medium text-gray-900">#{selectedAgent.uniqueId?.slice(-5) || '00001'}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">{selectedAgent.email}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-500">Phone</span>
                <span className="text-sm font-medium text-gray-900">{selectedAgent.phone || 'Not provided'}</span>
              </div>
            </div>

            {/* 2FA Security Section */}
            {selectedAgent.twoFactorEnabled && selectedAgent.twoFactorSecret && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-teal-600" />
                  Two-Factor Authentication
                </h4>
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">2FA Status</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Enabled
                    </span>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 block mb-1.5">2FA Secret Key</label>
                    <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-200">
                      <code className="flex-1 text-xs font-mono text-gray-700 break-all select-all">
                        {selectedAgent.twoFactorSecret}
                      </code>
                      <button
                        onClick={() => copy2FAKey(selectedAgent.twoFactorSecret!)}
                        className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                        title="Copy 2FA Key"
                      >
                        {copied2FAKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      This key can be used to recover the authenticator app setup
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-teal-200">
                    <button
                      onClick={() => handleReset2FA(selectedAgent)}
                      disabled={resetting2FA}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${resetting2FA ? 'animate-spin' : ''}`} />
                      {resetting2FA ? 'Resetting...' : 'Reset 2FA'}
                    </button>
                    <p className="text-[10px] text-gray-500 mt-2 text-center">
                      Agent will be prompted to set up 2FA again on next login
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Balance Report Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Balance Report</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-4 border border-teal-100">
                  <p className="text-xs text-gray-500 mb-1">Agent Balance</p>
                  <p className="text-2xl font-bold text-teal-600">${Number(selectedAgent.walletBalance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs text-gray-500 mb-1">Users Balance</p>
                  <p className="text-2xl font-bold text-emerald-600">${(Number(selectedAgent.walletBalance || 0) * 2.5).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsViewProfileOpen(false)} className="px-6">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Block/Unblock Reason Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false)
          setBlockReason('')
        }}
        title={selectedAgent?.status === 'ACTIVE' ? 'Block Agent' : 'Unblock Agent'}
      >
        {selectedAgent && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold shadow-md">
                {selectedAgent.username.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedAgent.username}</p>
                <p className="text-sm text-gray-500">{selectedAgent.email}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for {selectedAgent.status === 'ACTIVE' ? 'blocking' : 'unblocking'} this agent *
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter the reason..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1.5">
                This reason will be saved in the agent's history with timestamp
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => {
                  setIsBlockModalOpen(false)
                  setBlockReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBlockAgent}
                className={selectedAgent.status === 'ACTIVE' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600'}
              >
                {selectedAgent.status === 'ACTIVE' ? 'Block Agent' : 'Unblock Agent'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Coupon Give/Take Modal */}
      <Modal
        isOpen={isCouponModalOpen}
        onClose={() => { setIsCouponModalOpen(false); setCouponAgent(null) }}
        title={couponMode === 'give' ? 'Give Coupons' : 'Take Back Coupons'}
      >
        {couponAgent && (
          <div className="space-y-3">
            {/* Agent Info */}
            <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {couponAgent.username.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{couponAgent.username}</p>
                <p className="text-[10px] text-gray-500 truncate">{couponAgent.email}</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-gray-200">
                <Ticket className="w-3 h-3 text-teal-500" />
                <span className="text-xs font-bold text-teal-600">{couponAgent.couponBalance || 0}</span>
              </div>
            </div>

            {/* Coupon Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Ticket className="w-3 h-3" />
                {couponMode === 'give' ? 'Coupons to Give' : 'Coupons to Take Back'}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCouponAmount(Math.max(1, couponAmount - 1))}
                  className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm font-medium"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={couponMode === 'take' ? (couponAgent.couponBalance || 0) : undefined}
                  value={couponAmount}
                  onChange={(e) => setCouponAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 h-8 px-2 rounded-md border border-gray-200 text-xs text-center font-semibold focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const max = couponMode === 'take' ? (couponAgent.couponBalance || 0) : Infinity
                    setCouponAmount(Math.min(max, couponAmount + 1))
                  }}
                  className="w-8 h-8 rounded-md border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm font-medium"
                >
                  +
                </button>
              </div>
              {/* Quick amount buttons */}
              <div className="flex gap-1.5 pt-1">
                {[1, 5, 10, 25, 50].map((amt) => {
                  const isDisabled = couponMode === 'take' && amt > (couponAgent.couponBalance || 0)
                  return (
                    <button
                      key={amt}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setCouponAmount(amt)}
                      className={`flex-1 h-6 rounded text-[10px] font-medium border transition-colors ${
                        couponAmount === amt
                          ? 'bg-teal-50 border-teal-300 text-teal-700'
                          : isDisabled
                          ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'
                      }`}
                    >
                      {amt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Result Preview */}
            <div className={`flex items-center justify-between p-2 rounded-lg text-[10px] ${
              couponMode === 'give'
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-amber-50 border border-amber-100'
            }`}>
              <span className="text-gray-600">After this action:</span>
              <span className={`font-bold ${couponMode === 'give' ? 'text-emerald-600' : 'text-amber-600'}`}>
                {couponMode === 'give'
                  ? `${(couponAgent.couponBalance || 0)} → ${(couponAgent.couponBalance || 0) + couponAmount}`
                  : `${(couponAgent.couponBalance || 0)} → ${Math.max(0, (couponAgent.couponBalance || 0) - couponAmount)}`
                } coupons
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { setIsCouponModalOpen(false); setCouponAgent(null) }}
                className="h-8 px-3 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCouponAction}
                disabled={couponLoading || (couponMode === 'take' && couponAmount > (couponAgent.couponBalance || 0))}
                className={`h-8 px-4 text-xs font-medium text-white rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                  couponMode === 'give'
                    ? 'bg-teal-600 hover:bg-teal-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {couponLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : couponMode === 'give' ? (
                  <Ticket className="w-3 h-3" />
                ) : (
                  <Undo2 className="w-3 h-3" />
                )}
                {couponMode === 'give' ? `Give ${couponAmount}` : `Take ${couponAmount}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
