'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { agentsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { Plus, Search, MoreVertical, Filter, Download, Grid, List, Eye, Edit, Ban, Trash2, DollarSign, Users as UsersIcon, ChevronDown, Shield, Copy, Check, RefreshCw } from 'lucide-react'

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
  // 2FA
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  // Platform fees
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
  // Agent settings
  showBalanceToAgent?: boolean
}

type PlatformFees = {
  facebook: { openingFee: string; depositFee: string }
  google: { openingFee: string; depositFee: string }
  tiktok: { openingFee: string; depositFee: string }
  snapchat: { openingFee: string; depositFee: string }
  bing: { openingFee: string; depositFee: string }
}

export default function AgentsPage() {
  const toast = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false)
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
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
  const [formLoading, setFormLoading] = useState(false)
  const [copied2FAKey, setCopied2FAKey] = useState(false)
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null)

  const copy2FAKey = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopied2FAKey(true)
    setTimeout(() => setCopied2FAKey(false), 2000)
  }

  const [resetting2FA, setResetting2FA] = useState(false)

  const handleReset2FA = async (agent: Agent) => {
    if (!confirm(`Are you sure you want to reset 2FA for ${agent.username}? They will need to set up 2FA again on next login.`)) {
      return
    }

    setResetting2FA(true)
    try {
      const response = await agentsApi.reset2FA(agent.id)
      toast.success('2FA Reset', response.message)
      // Update the local agent state to reflect 2FA is now disabled
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
      // Silently fail - show empty state if API is unavailable
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
      // Convert platformFees to flat fields expected by API
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

      // Only include password if provided
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      if (selectedAgent) {
        await agentsApi.update(selectedAgent.id, payload)
        toast.success('Agent Updated', `${formData.username} has been updated successfully`)
      } else {
        payload.password = formData.password // Required for new agents
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

      // Call backend API
      if (isCurrentlyActive) {
        await agentsApi.block(selectedAgent.id, blockReason)
      } else {
        await agentsApi.unblock(selectedAgent.id)
      }

      // Update local state
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

  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && agent.status === 'ACTIVE') ||
      (statusFilter === 'blocked' && agent.status === 'BLOCKED') ||
      (statusFilter === 'inactive' && agent.status === 'INACTIVE')

    return matchesSearch && matchesStatus
  })

  // Use filtered agents directly (no mock data)
  const displayAgents = filteredAgents

  return (
    <DashboardLayout title="Agents Management">
      {/* Header Actions */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-[240px] rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:bg-white transition-all duration-200"
              />
            </div>

            {/* Custom Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600 hover:bg-white hover:border-gray-300 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 flex items-center gap-2 transition-all duration-200"
              >
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="capitalize">
                  {statusFilter === 'all' ? 'All Status' : statusFilter}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStatusDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsStatusDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-12 z-[70] w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active' },
                      { value: 'blocked', label: 'Blocked' },
                      { value: 'inactive', label: 'Inactive' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value)
                          setIsStatusDropdownOpen(false)
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
          </div>

          <div className="flex items-center gap-3">
            {/* Export */}
            <button className="flex items-center gap-2 h-10 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200">
              <Download className="h-4 w-4" />
              Export
            </button>

            {/* Add Agent */}
            <button
              onClick={handleAddAgent}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:from-teal-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40"
            >
              <Plus className="h-4 w-4" />
              Add Agent
            </button>
          </div>
        </div>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        </div>
      ) : displayAgents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center mb-4">
              <UsersIcon className="h-10 w-10 text-teal-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Agents Yet</h3>
            <p className="text-gray-500 text-sm text-center mb-6 max-w-sm">
              Get started by creating your first agent. Agents can manage users and handle transactions.
            </p>
            <button
              onClick={handleAddAgent}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium hover:from-teal-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-teal-500/25"
            >
              <Plus className="h-4 w-4" />
              Add First Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_100px] gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div>Agent</div>
            <div>Email</div>
            <div>Password</div>
            <div>Agent Balance</div>
            <div>Users Balance</div>
            <div>Status</div>
            <div className="text-center">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-100">
            {displayAgents.map((agent) => (
              <div
                key={agent.id}
                className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_1fr_100px] gap-4 px-6 py-4 items-center hover:bg-gray-50 transition-colors"
              >
                {/* Agent Info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                      {agent.username.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                      agent.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{agent.username}</p>
                    <p className="text-xs text-gray-500">#{agent.uniqueId?.slice(-5) || '00001'}</p>
                  </div>
                </div>

                {/* Email */}
                <div className="text-sm text-gray-600 truncate">{agent.email}</div>

                {/* Password */}
                <div>
                  <button
                    onClick={() => setShowPasswordId(showPasswordId === agent.id ? null : agent.id)}
                    onMouseEnter={() => setShowPasswordId(agent.id)}
                    onMouseLeave={() => setShowPasswordId(null)}
                    className={`text-sm cursor-pointer font-mono transition-colors ${
                      showPasswordId === agent.id && !agent.plaintextPassword
                        ? 'text-red-500'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title={agent.plaintextPassword ? "Click to show password" : "Password not stored - edit agent to set new password"}
                  >
                    {showPasswordId === agent.id
                      ? (agent.plaintextPassword || 'Reset needed')
                      : '••••••••'}
                  </button>
                </div>

                {/* Agent Balance */}
                <div className="text-sm font-semibold text-teal-600">
                  ${Number(agent.walletBalance || 0).toLocaleString()}
                </div>

                {/* Users Balance */}
                <div className="text-sm font-semibold text-emerald-600">
                  ${(Number(agent.walletBalance || 0) * 2.5).toLocaleString()}
                </div>

                {/* Status */}
                <div>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    agent.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : agent.status === 'BLOCKED'
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      agent.status === 'ACTIVE' ? 'bg-emerald-500' : agent.status === 'BLOCKED' ? 'bg-red-500' : 'bg-gray-500'
                    }`} />
                    {agent.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => handleViewProfile(agent)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="View Profile"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEditAgent(agent)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === agent.id ? null : agent.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {activeDropdown === agent.id && (
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          onClick={() => setActiveDropdown(null)}
                        />
                        <div className="absolute right-0 top-10 z-[70] w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          <button
                            onClick={() => handleViewBalance(agent)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            Balance Report
                          </button>
                          <div className="h-px bg-gray-100 my-1" />
                          <button
                            onClick={() => handleOpenBlockModal(agent)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <Ban className="h-4 w-4" />
                            {agent.status === 'ACTIVE' ? 'Block Agent' : 'Unblock Agent'}
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Agent
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center mt-8 gap-2">
        <button className="w-10 h-10 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium shadow-lg shadow-teal-500/25">1</button>
        <button className="w-10 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all duration-200">2</button>
        <button className="w-10 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all duration-200">3</button>
        <span className="px-2 text-gray-400">...</span>
        <button className="w-10 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all duration-200">10</button>
        <button className="px-5 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-600 transition-all duration-200 font-medium ml-2">Next →</button>
      </div>

      {/* Add/Edit Agent Modal with Platform Fees */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedAgent ? 'Edit Agent Information' : 'Add New Agent'}
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto px-1">
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-teal-500/25 mb-2">
              {formData.username.charAt(0) || 'A'}
            </div>
            <button type="button" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
              Change Profile Picture
            </button>
          </div>

          {/* Personal Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-900 border-b pb-1.5">Personal Information</h3>

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="username"
                label="Agency Name"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Vicky Sampath"
                required
              />
              <Input
                id="email"
                type="email"
                label="Agent Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="hello@example.com"
                required
              />
            </div>

            <Input
              id="password"
              type="password"
              label={selectedAgent ? "New Password (leave empty to keep current)" : "Password"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={selectedAgent ? "Enter new password to change" : "••••••••"}
              required={!selectedAgent}
            />
          </div>

          {/* Platform Fees - Compact Layout */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-900 border-b pb-1.5">Platform Fee (Minimum Limits)</h3>
            <p className="text-[10px] text-gray-500">Set minimum rates agents must follow.</p>

            {/* Facebook */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Facebook Opening</label>
                <input
                  type="text"
                  value={formData.platformFees.facebook.openingFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      facebook: { ...formData.platformFees.facebook, openingFee: e.target.value }
                    }
                  })}
                  placeholder="30"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Facebook Commission %</label>
                <input
                  type="text"
                  value={formData.platformFees.facebook.depositFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      facebook: { ...formData.platformFees.facebook, depositFee: e.target.value }
                    }
                  })}
                  placeholder="3"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Google */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Google Opening</label>
                <input
                  type="text"
                  value={formData.platformFees.google.openingFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      google: { ...formData.platformFees.google, openingFee: e.target.value }
                    }
                  })}
                  placeholder="50"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Google Commission %</label>
                <input
                  type="text"
                  value={formData.platformFees.google.depositFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      google: { ...formData.platformFees.google, depositFee: e.target.value }
                    }
                  })}
                  placeholder="5"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* TikTok */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Tiktok Opening</label>
                <input
                  type="text"
                  value={formData.platformFees.tiktok.openingFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      tiktok: { ...formData.platformFees.tiktok, openingFee: e.target.value }
                    }
                  })}
                  placeholder="40"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Tiktok Commission %</label>
                <input
                  type="text"
                  value={formData.platformFees.tiktok.depositFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      tiktok: { ...formData.platformFees.tiktok, depositFee: e.target.value }
                    }
                  })}
                  placeholder="4"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Snapchat */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Snapchat Opening</label>
                <input
                  type="text"
                  value={formData.platformFees.snapchat.openingFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      snapchat: { ...formData.platformFees.snapchat, openingFee: e.target.value }
                    }
                  })}
                  placeholder="35"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Snapchat Commission %</label>
                <input
                  type="text"
                  value={formData.platformFees.snapchat.depositFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      snapchat: { ...formData.platformFees.snapchat, depositFee: e.target.value }
                    }
                  })}
                  placeholder="3.5"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            {/* Bing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Bing Opening</label>
                <input
                  type="text"
                  value={formData.platformFees.bing.openingFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      bing: { ...formData.platformFees.bing, openingFee: e.target.value }
                    }
                  })}
                  placeholder="45"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Bing Commission %</label>
                <input
                  type="text"
                  value={formData.platformFees.bing.depositFee}
                  onChange={(e) => setFormData({
                    ...formData,
                    platformFees: {
                      ...formData.platformFees,
                      bing: { ...formData.platformFees.bing, depositFee: e.target.value }
                    }
                  })}
                  placeholder="4.5"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
          </div>

          {/* Agent Dashboard Settings */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-900 border-b pb-1.5">Dashboard Settings</h3>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-800">Show Ad Account Balance</p>
                  <p className="text-[10px] text-gray-500">Allow this agent to view account balances</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, showBalanceToAgent: !formData.showBalanceToAgent })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
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

          {/* Contact Details */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-gray-900 border-b pb-1.5">Contact Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Contact #1</label>
                <input
                  type="text"
                  placeholder="Enter contact"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Contact #2</label>
                <input
                  type="text"
                  placeholder="Enter contact"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700">
              {selectedAgent ? 'Update Agent' : 'Create Agent'}
            </Button>
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
            {/* Agent Info */}
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

            {/* Balance Cards */}
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

            {/* Summary Stats */}
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
            {/* Profile Header with Edit Button */}
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

            {/* Account Info - Clean List */}
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
                  {/* Reset 2FA Button */}
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
    </DashboardLayout>
  )
}
