'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { agentWithdrawalsApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { Search, ChevronDown, Upload, MoreVertical, ChevronLeft, ChevronRight, Loader2, Check, X, Edit2, DollarSign } from 'lucide-react'

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

export default function WithdrawalsPage() {
  const toast = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 10

  // Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [adminRemarks, setAdminRemarks] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const params: any = { page: currentPage, limit: itemsPerPage }
      if (statusFilter !== 'all') params.status = statusFilter
      if (searchQuery) params.search = searchQuery

      const { withdrawals: data, pagination } = await agentWithdrawalsApi.getAll(params)
      setWithdrawals(data || [])
      setTotalPages(pagination?.pages || 1)
      setTotalItems(pagination?.total || 0)
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
  }, [currentPage, statusFilter])

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (currentPage === 1) {
        fetchWithdrawals()
      } else {
        setCurrentPage(1)
      }
    }, 300)
    return () => clearTimeout(delaySearch)
  }, [searchQuery])

  const handleOpenApproveModal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setApprovedAmount(withdrawal.amount.toString())
    setAdminRemarks('')
    setIsApproveModalOpen(true)
    setActiveDropdown(null)
  }

  const handleOpenRejectModal = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setAdminRemarks('')
    setIsRejectModalOpen(true)
    setActiveDropdown(null)
  }

  const handleApprove = async () => {
    console.log('handleApprove called', { selectedWithdrawal, approvedAmount, adminRemarks })

    if (!selectedWithdrawal) {
      console.log('No selectedWithdrawal')
      return
    }

    const amount = parseFloat(approvedAmount)
    console.log('Parsed amount:', amount)

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
      console.log('Calling API with:', { id: selectedWithdrawal.id, approvedAmount: amount, adminRemarks })
      const result = await agentWithdrawalsApi.approve(selectedWithdrawal.id, {
        approvedAmount: amount,
        adminRemarks: adminRemarks || undefined
      })
      console.log('API result:', result)
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
        return <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#52B788] text-white">Approved</span>
      case 'PENDING':
        return <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F59E0B] text-white">Pending</span>
      case 'REJECTED':
        return <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EF4444] text-white">Rejected</span>
      default:
        return <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Filter withdrawals by agent
  const filteredWithdrawals = agentFilter === 'all'
    ? withdrawals
    : withdrawals.filter(w => w.agent.id === agentFilter)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1, 2, 3)
      if (currentPage > 4) pages.push('...')
      if (currentPage > 3 && currentPage < totalPages - 2) {
        pages.push(currentPage)
      }
      if (currentPage < totalPages - 3) pages.push('...')
      pages.push(totalPages - 1, totalPages)
    }
    return [...new Set(pages)]
  }

  return (
    <DashboardLayout title="Withdrawals">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Agents Withdrawal Management Requests</h1>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-[200px] rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all duration-200"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 hover:bg-white hover:border-gray-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 flex items-center gap-2 transition-all duration-200 min-w-[120px]"
                >
                  <span className="capitalize">{statusFilter === 'all' ? 'Status' : statusFilter}</span>
                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isStatusDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsStatusDropdownOpen(false)} />
                    <div className="absolute left-0 top-12 z-[70] w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {[
                        { value: 'all', label: 'All Status' },
                        { value: 'PENDING', label: 'Pending' },
                        { value: 'APPROVED', label: 'Approved' },
                        { value: 'REJECTED', label: 'Rejected' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setStatusFilter(option.value)
                            setIsStatusDropdownOpen(false)
                            setCurrentPage(1)
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            statusFilter === option.value
                              ? 'bg-teal-50 text-teal-600 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Agents Filter */}
              <div className="relative">
                <button
                  onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                  className="h-10 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 hover:bg-white hover:border-gray-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 flex items-center gap-2 transition-all duration-200 min-w-[140px]"
                >
                  <span>{agentFilter === 'all' ? 'Agents' : agents.find(a => a.id === agentFilter)?.username || 'Agents'}</span>
                  <ChevronDown className={`h-4 w-4 ml-auto transition-transform duration-200 ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAgentDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsAgentDropdownOpen(false)} />
                    <div className="absolute left-0 top-12 z-[70] w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-64 overflow-y-auto">
                      <button
                        onClick={() => {
                          setAgentFilter('all')
                          setIsAgentDropdownOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          agentFilter === 'all'
                            ? 'bg-teal-50 text-teal-600 font-medium'
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
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            agentFilter === agent.id
                              ? 'bg-teal-50 text-teal-600 font-medium'
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

            {/* Export Button */}
            <button className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#52B788] text-white text-sm font-medium hover:bg-[#40A070] transition-all duration-200">
              <Upload className="h-4 w-4" />
              Export Image
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_80px] gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div>Agent Username</div>
            <div>Requested</div>
            <div>Approved</div>
            <div>Description</div>
            <div>Status</div>
            <div className="text-center">Edit</div>
          </div>

          {/* Table Body */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Withdrawal Requests</h3>
              <p className="text-gray-500 text-sm">No withdrawal requests found matching your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1.5fr_1fr_80px] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
                >
                  {/* Agent Username */}
                  <div className="font-medium text-gray-900">
                    {withdrawal.agent.username}
                  </div>

                  {/* Requested Amount */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-700 font-semibold">${withdrawal.amount.toLocaleString()}</span>
                    {withdrawal.status === 'PENDING' && (
                      <button
                        onClick={() => handleOpenApproveModal(withdrawal)}
                        className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                        title="Edit & Approve"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Approved Amount */}
                  <div>
                    {withdrawal.status === 'APPROVED' ? (
                      <span className="text-[#166534] font-semibold">${(withdrawal.approvedAmount ?? withdrawal.amount).toLocaleString()}</span>
                    ) : withdrawal.status === 'PENDING' ? (
                      <button
                        onClick={() => handleOpenApproveModal(withdrawal)}
                        className="flex items-center gap-1.5 text-gray-400 hover:text-teal-600 transition-colors group"
                      >
                        <span className="text-sm">Pending</span>
                        <Edit2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <span className="text-red-400 text-sm">Rejected</span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="text-sm text-gray-600 truncate">
                    {withdrawal.description || '-'}
                  </div>

                  {/* Status */}
                  <div>
                    {getStatusBadge(withdrawal.status)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === withdrawal.id ? null : withdrawal.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>

                      {activeDropdown === withdrawal.id && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setActiveDropdown(null)} />
                          <div className="absolute right-0 top-10 z-[70] w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            {withdrawal.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleOpenApproveModal(withdrawal)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors"
                                >
                                  <Check className="h-4 w-4" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleOpenRejectModal(withdrawal)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                // View details logic
                                setActiveDropdown(null)
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                              View Details
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredWithdrawals.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2 px-4 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex items-center gap-2">
                {getPageNumbers().map((page, index) => (
                  typeof page === 'number' ? (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-200 ${
                        currentPage === page
                          ? 'bg-[#52B788] text-white shadow-lg'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={index} className="px-2 text-gray-400">...</span>
                  )
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2 px-4 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold">
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
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                <p className="text-xs text-teal-600 mb-1">Approved Amount</p>
                <div className="relative">
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl font-bold text-teal-600">$</span>
                  <input
                    type="number"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full pl-5 text-xl font-bold text-teal-600 bg-transparent border-none focus:outline-none"
                    max={selectedWithdrawal.amount}
                    min={0}
                  />
                </div>
              </div>
            </div>

            {parseFloat(approvedAmount) < selectedWithdrawal.amount && parseFloat(approvedAmount) >= 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  <strong>Note:</strong> The full requested amount (${selectedWithdrawal.amount.toLocaleString()}) will be permanently debited from the agent's balance. Only ${parseFloat(approvedAmount).toLocaleString()} will be paid out to the agent. The remaining ${(selectedWithdrawal.amount - parseFloat(approvedAmount)).toLocaleString()} will not be returned.
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
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
                className="bg-[#52B788] hover:bg-[#40A070]"
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
