'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { agentWithdrawalsApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  X,
  Edit2,
  DollarSign,
  Loader2,
} from 'lucide-react'

type Withdrawal = {
  id: string
  amount: number
  approvedAmount?: number
  status: string
  description?: string
  adminRemarks?: string
  createdAt: string
  approvedAt?: string
  rejectedAt?: string
  clearedAt?: string
  agent: {
    id: string
    username: string
    email: string
    realName?: string
  }
}

type Agent = {
  id: string
  username: string
  email: string
}

type TabType = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED'

export default function WithdrawalsPage() {
  const toast = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false)

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const allTabRef = useRef<HTMLButtonElement>(null)
  const pendingTabRef = useRef<HTMLButtonElement>(null)
  const approvedTabRef = useRef<HTMLButtonElement>(null)
  const rejectedTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [adminRemarks, setAdminRemarks] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Sliding tab indicator
  useEffect(() => {
    const tabRefMap: Record<TabType, React.RefObject<HTMLButtonElement | null>> = {
      all: allTabRef,
      PENDING: pendingTabRef,
      APPROVED: approvedTabRef,
      REJECTED: rejectedTabRef,
    }
    const el = tabRefMap[activeTab]?.current
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth })
    }
  }, [activeTab])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const { withdrawals: data } = await agentWithdrawalsApi.getAll({ limit: 9999 })
      setWithdrawals(data || [])
    } catch (error) {
      console.error('Failed to fetch withdrawals:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const { agents: data } = await agentsApi.getAll()
      setAgents(data || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
    fetchAgents()
  }, [])

  // Client-side filtering
  const filteredWithdrawals = withdrawals.filter(w => {
    // Tab filter
    if (activeTab !== 'all' && w.status !== activeTab) return false
    // Agent filter
    if (agentFilter !== 'all' && w.agent.id !== agentFilter) return false
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        w.agent.username.toLowerCase().includes(q) ||
        w.agent.email.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        w.amount.toString().includes(q)
      )
    }
    return true
  })

  // Pagination
  const effectiveItemsPerPage = itemsPerPage === -1 ? filteredWithdrawals.length : itemsPerPage
  const totalPages = effectiveItemsPerPage > 0 ? Math.ceil(filteredWithdrawals.length / effectiveItemsPerPage) : 1
  const startIndex = (currentPage - 1) * effectiveItemsPerPage
  const paginatedData = filteredWithdrawals.slice(startIndex, startIndex + effectiveItemsPerPage)

  // Stats
  const totalWithdrawalsCount = withdrawals.length
  const totalRequestedAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0)
  const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length
  const totalApprovedAmount = withdrawals
    .filter(w => w.status === 'APPROVED')
    .reduce((sum, w) => sum + (w.approvedAmount ?? w.amount), 0)

  const handleOpenApproveModal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setApprovedAmount(withdrawal.amount.toString())
    setAdminRemarks('')
    setIsApproveModalOpen(true)
  }

  const handleOpenRejectModal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setAdminRemarks('')
    setIsRejectModalOpen(true)
  }

  const handleApprove = async () => {
    if (!selectedWithdrawal) return

    const amount = parseFloat(approvedAmount)

    if (isNaN(amount) || amount < 0) {
      toast.error('Invalid Amount', 'Please enter a valid approved amount')
      return
    }

    if (amount > selectedWithdrawal.amount) {
      toast.error('Invalid Amount', 'Approved amount cannot exceed requested amount')
      return
    }

    setActionLoading(true)
    try {
      await agentWithdrawalsApi.approve(selectedWithdrawal.id, {
        approvedAmount: amount,
        adminRemarks: adminRemarks || undefined
      })
      toast.success('Withdrawal Approved', `Approved $${amount.toLocaleString()} for ${selectedWithdrawal.agent.username}`)
      setIsApproveModalOpen(false)
      fetchWithdrawals()
    } catch (error: any) {
      console.error('Approve error:', error)
      toast.error('Failed to approve', error.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedWithdrawal) return

    setActionLoading(true)
    try {
      await agentWithdrawalsApi.reject(selectedWithdrawal.id, adminRemarks || undefined)
      toast.success('Withdrawal Rejected', `Rejected withdrawal for ${selectedWithdrawal.agent.username}`)
      setIsRejectModalOpen(false)
      fetchWithdrawals()
    } catch (error: any) {
      toast.error('Failed to reject', error.message || 'An error occurred')
    } finally {
      setActionLoading(false)
    }
  }

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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <DashboardLayout title="Withdrawals">
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

      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search agent, email, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-full lg:w-[260px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white transition-all"
            />
          </div>

          {/* Agent Filter */}
          <div className="relative">
            <button
              onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
              className="h-10 px-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 flex items-center gap-2 transition-all min-w-[140px]"
            >
              <span>{agentFilter === 'all' ? 'All Agents' : agents.find(a => a.id === agentFilter)?.username || 'Agents'}</span>
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform duration-200 ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isAgentDropdownOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setIsAgentDropdownOpen(false)} />
                <div className="absolute left-0 top-12 z-[70] w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setAgentFilter('all')
                      setIsAgentDropdownOpen(false)
                      setCurrentPage(1)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      agentFilter === 'all'
                        ? 'bg-violet-50 text-violet-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    All Agents
                  </button>
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setAgentFilter(agent.id)
                        setIsAgentDropdownOpen(false)
                        setCurrentPage(1)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        agentFilter === agent.id
                          ? 'bg-violet-50 text-violet-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {agent.username}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <button className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Upload className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Withdrawals</span>
              <p className="text-2xl font-bold text-gray-800">{totalWithdrawalsCount.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-violet-500 text-white text-sm font-medium rounded">All</span>
          </div>
          <StatsChart value={totalWithdrawalsCount} color="#8B5CF6" filterId="glowVioletWd" gradientId="fadeVioletWd" clipId="clipVioletWd" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Requested</span>
              <p className="text-2xl font-bold text-gray-800">${totalRequestedAmount.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-sm font-medium rounded">Amount</span>
          </div>
          <StatsChart value={totalRequestedAmount} color="#3B82F6" filterId="glowBlueWd" gradientId="fadeBlueWd" clipId="clipBlueWd" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Pending</span>
              <p className="text-2xl font-bold text-gray-800">{pendingCount.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-amber-500 text-white text-sm font-medium rounded">Pending</span>
          </div>
          <StatsChart value={pendingCount} color="#F59E0B" filterId="glowAmberWd" gradientId="fadeAmberWd" clipId="clipAmberWd" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Approved Amount</span>
              <p className="text-2xl font-bold text-gray-800">${totalApprovedAmount.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#0D9488] text-white text-sm font-medium rounded">Paid</span>
          </div>
          <StatsChart value={totalApprovedAmount} color="#0D9488" filterId="glowTealWd" gradientId="fadeTealWd" clipId="clipTealWd" />
        </Card>
      </div>

      {/* Main Card with Tabs & Table */}
      <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 340px)' }}>
        {/* Tabs with smooth sliding indicator */}
        <div className="border-b border-gray-100 flex-shrink-0">
          <div className="flex relative">
            <button
              ref={allTabRef}
              onClick={() => { setActiveTab('all'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'all' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All
              <span className="ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                {withdrawals.length}
              </span>
            </button>
            <button
              ref={pendingTabRef}
              onClick={() => { setActiveTab('PENDING'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'PENDING' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending
              {pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              ref={approvedTabRef}
              onClick={() => { setActiveTab('APPROVED'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'APPROVED' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Approved
            </button>
            <button
              ref={rejectedTabRef}
              onClick={() => { setActiveTab('REJECTED'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                activeTab === 'REJECTED' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Rejected
            </button>
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 min-h-0" key={activeTab}>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center">
                <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                <span className="text-gray-500">Loading...</span>
              </div>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Withdrawal Requests</h3>
              <p className="text-gray-500 text-sm">No withdrawal requests found matching your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm xl:text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">#</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Agent</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Requested</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Approved</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50 hidden 2xl:table-cell">Description</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50 hidden 2xl:table-cell">Remarks</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Date</th>
                  <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                  <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((withdrawal, index) => (
                  <tr
                    key={withdrawal.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    {/* # */}
                    <td className="py-2.5 px-2 xl:px-3 text-gray-500">{startIndex + index + 1}</td>

                    {/* Agent */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div>
                        <p className="font-medium text-gray-900">{withdrawal.agent.username}</p>
                        <p className="text-[11px] text-gray-400">{withdrawal.agent.email}</p>
                      </div>
                    </td>

                    {/* Requested Amount */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-800 font-semibold">${withdrawal.amount.toLocaleString()}</span>
                        {withdrawal.status === 'PENDING' && (
                          <button
                            onClick={() => handleOpenApproveModal(withdrawal)}
                            className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors"
                            title="Edit & Approve"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Approved Amount */}
                    <td className="py-2.5 px-2 xl:px-3">
                      {withdrawal.status === 'APPROVED' ? (
                        <span className="text-emerald-700 font-semibold">${(withdrawal.approvedAmount ?? withdrawal.amount).toLocaleString()}</span>
                      ) : withdrawal.status === 'PENDING' ? (
                        <span className="text-gray-400 text-sm">—</span>
                      ) : (
                        <span className="text-red-400 text-sm">—</span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-2.5 px-2 xl:px-3 hidden 2xl:table-cell">
                      <span className="text-gray-600 text-sm truncate block max-w-[200px]">
                        {withdrawal.description || '—'}
                      </span>
                    </td>

                    {/* Admin Remarks */}
                    <td className="py-2.5 px-2 xl:px-3 hidden 2xl:table-cell">
                      <span className="text-gray-600 text-sm truncate block max-w-[200px]">
                        {withdrawal.adminRemarks || '—'}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-2.5 px-2 xl:px-3 text-gray-500 text-sm whitespace-nowrap">
                      {formatDate(withdrawal.createdAt)}
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-2 xl:px-3">
                      {getStatusBadge(withdrawal.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 xl:px-3">
                      {withdrawal.status === 'PENDING' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenApproveModal(withdrawal)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(withdrawal)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-gray-300">—</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredWithdrawals.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {startIndex + 1}-{Math.min(startIndex + effectiveItemsPerPage, filteredWithdrawals.length)} of {filteredWithdrawals.length}
              </span>
              <PaginationSelect value={itemsPerPage} onChange={(val) => { setItemsPerPage(val); setCurrentPage(1) }} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
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
                    className={`w-8 h-8 rounded-md text-[13px] font-medium transition-all ${
                      currentPage === pageNum
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Approve Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => setIsApproveModalOpen(false)}
        title="Approve Withdrawal"
      >
        {selectedWithdrawal && (
          <div className="space-y-5">
            {/* Agent Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-lg font-semibold">
                {selectedWithdrawal.agent.username.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedWithdrawal.agent.username}</p>
                <p className="text-sm text-gray-500">{selectedWithdrawal.agent.email}</p>
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Requested Amount</p>
                <p className="text-xl font-bold text-gray-900">${selectedWithdrawal.amount.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-violet-50 rounded-xl border border-violet-200">
                <p className="text-xs text-violet-600 mb-1">Approved Amount</p>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl font-bold text-violet-600">$</span>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full pl-5 text-xl font-bold text-violet-600 bg-transparent border-none focus:outline-none"
                    max={selectedWithdrawal.amount}
                    min={0}
                  />
                </div>
              </div>
            </div>

            {parseFloat(approvedAmount) < selectedWithdrawal.amount && parseFloat(approvedAmount) >= 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  <strong>Note:</strong> The full requested amount (${selectedWithdrawal.amount.toLocaleString()}) will be permanently debited from the agent&apos;s balance. Only ${parseFloat(approvedAmount).toLocaleString()} will be paid out to the agent. The remaining ${(selectedWithdrawal.amount - parseFloat(approvedAmount)).toLocaleString()} will not be returned.
                </p>
              </div>
            )}

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin Remarks (Optional)</label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter any remarks..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsApproveModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {actionLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Approving...
                  </>
                ) : (
                  'Approve Withdrawal'
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Withdrawal"
      >
        {selectedWithdrawal && (
          <div className="space-y-5">
            {/* Agent Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-lg font-semibold">
                {selectedWithdrawal.agent.username.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedWithdrawal.agent.username}</p>
                <p className="text-sm text-gray-500">Requested: ${selectedWithdrawal.amount.toLocaleString()}</p>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Rejection *</label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Enter the reason for rejecting this withdrawal..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                loading={actionLoading}
                className="bg-red-500 hover:bg-red-600"
              >
                Reject Withdrawal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
