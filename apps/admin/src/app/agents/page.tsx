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
import { Plus, Search, MoreVertical, Filter, Download, Grid, List, Eye, Edit, Ban, Trash2, DollarSign, Users as UsersIcon, ChevronDown } from 'lucide-react'

type Agent = {
  id: string
  username: string
  email: string
  phone: string | null
  status: string
  walletBalance: string
  uniqueId: string
  createdAt: string
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
    platformFees: {
      facebook: { openingFee: '', depositFee: '' },
      google: { openingFee: '', depositFee: '' },
      tiktok: { openingFee: '', depositFee: '' },
      snapchat: { openingFee: '', depositFee: '' },
      bing: { openingFee: '', depositFee: '' },
    }
  })
  const [formLoading, setFormLoading] = useState(false)

  const fetchAgents = async () => {
    try {
      const { agents } = await agentsApi.getAll()
      setAgents(agents || [])
    } catch (error) {
      console.error('Failed to fetch agents:', error)
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
      platformFees: {
        facebook: { openingFee: '30', depositFee: '3' },
        google: { openingFee: '50', depositFee: '5' },
        tiktok: { openingFee: '40', depositFee: '4' },
        snapchat: { openingFee: '35', depositFee: '3.5' },
        bing: { openingFee: '45', depositFee: '4.5' },
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
      if (selectedAgent) {
        await agentsApi.update(selectedAgent.id, formData)
        toast.success('Agent Updated', `${formData.username} has been updated successfully`)
      } else {
        await agentsApi.create(formData)
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

  // Sample agents for display
  const displayAgents = filteredAgents.length > 0 ? filteredAgents : [
    { id: '1', username: 'Vicky Sampath', email: 'vicky@agent.com', phone: '+1234567890', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT001', createdAt: new Date().toISOString() },
    { id: '2', username: 'Vicky Sampath', email: 'vicky2@agent.com', phone: '+1234567891', status: 'ACTIVE', walletBalance: '18530250', uniqueId: 'AGT002', createdAt: new Date().toISOString() },
    { id: '3', username: 'Vicky Sampath', email: 'vicky3@agent.com', phone: '+1234567892', status: 'BLOCKED', walletBalance: '15820340', uniqueId: 'AGT003', createdAt: new Date().toISOString() },
    { id: '4', username: 'Vicky Sampath', email: 'vicky4@agent.com', phone: '+1234567893', status: 'ACTIVE', walletBalance: '20115780', uniqueId: 'AGT004', createdAt: new Date().toISOString() },
    { id: '5', username: 'Vicky Sampath', email: 'vicky5@agent.com', phone: '+1234567894', status: 'ACTIVE', walletBalance: '19234560', uniqueId: 'AGT005', createdAt: new Date().toISOString() },
    { id: '6', username: 'Vicky Sampath', email: 'vicky6@agent.com', phone: '+1234567895', status: 'ACTIVE', walletBalance: '17845920', uniqueId: 'AGT006', createdAt: new Date().toISOString() },
  ]

  return (
    <DashboardLayout title="Agents Management">
      {/* Header Actions */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-[200px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all duration-200 focus:w-[240px]"
              />
            </div>

            {/* Custom Status Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 flex items-center gap-2 transition-all duration-200"
              >
                <span className="capitalize">
                  {statusFilter === 'all' ? 'Status' : statusFilter}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStatusDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsStatusDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-11 z-[70] w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          statusFilter === option.value
                            ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-medium'
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
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[#52B788] text-white text-sm hover:bg-[#2D5F5D] hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md">
              <Download className="h-4 w-4" />
              Export Image
            </button>

            {/* Add Coupon - keeping from design */}
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-[#8B5CF6] text-white text-sm hover:bg-[#7C3AED] hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md">
              <Plus className="h-4 w-4" />
              Add Coupon
            </button>

            {/* Add Agent */}
            <button
              onClick={handleAddAgent}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#8B5CF6] text-white text-sm hover:bg-[#7C3AED] hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
            >
              <Plus className="h-4 w-4" />
              Add Agent
            </button>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {displayAgents.map((agent, index) => (
            <div
              key={agent.id}
              className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-lg hover:scale-[1.02] hover:border-[#8B5CF6]/20 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-lg font-semibold shadow-md">
                      {agent.username.charAt(0)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      agent.status === 'ACTIVE' ? 'bg-[#52B788]' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-base">{agent.username}</h3>
                    <p className="text-xs text-gray-500">Agent #{agent.uniqueId?.slice(-5) || '00001'}</p>
                  </div>
                </div>

                {/* Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === agent.id ? null : agent.id)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {activeDropdown === agent.id && (
                    <>
                      <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setActiveDropdown(null)}
                      />
                      <div className="absolute right-0 top-8 z-[70] w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => handleViewProfile(agent)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="h-4 w-4 text-gray-500" />
                          View Profile
                        </button>
                        <button
                          onClick={() => {
                            handleEditAgent(agent)
                            setActiveDropdown(null)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit className="h-4 w-4 text-gray-500" />
                          Edit Info
                        </button>
                        <button
                          onClick={() => handleViewBalance(agent)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          Balance Report
                        </button>
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                          onClick={() => handleOpenBlockModal(agent)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-yellow-600 hover:bg-yellow-50 transition-colors"
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

              {/* Agent Details */}
              <div className="space-y-2.5 mb-4">
                <div className="flex items-center justify-between py-2 px-3 bg-gradient-to-r from-[#8B5CF6]/10 to-[#6366F1]/10 rounded-lg border border-[#8B5CF6]/20 hover:from-[#8B5CF6]/15 hover:to-[#6366F1]/15 hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                  <span className="text-xs font-medium text-gray-700">Agent Balance</span>
                  <span className="text-sm font-bold text-[#8B5CF6]">${Number(agent.walletBalance || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 bg-gradient-to-r from-[#52B788]/10 to-[#2D5F5D]/10 rounded-lg border border-[#52B788]/20 hover:from-[#52B788]/15 hover:to-[#2D5F5D]/15 hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                  <span className="text-xs font-medium text-gray-700">Users Balance</span>
                  <span className="text-sm font-bold text-[#52B788]">${(Number(agent.walletBalance || 0) * 2.5).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">Email</span>
                  <span className="text-xs text-gray-700 truncate max-w-[180px]">{agent.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Phone</span>
                  <span className="text-xs text-gray-700">{agent.phone || 'Not provided'}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="pt-3 border-t border-gray-100">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                  agent.status === 'ACTIVE'
                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                    : agent.status === 'BLOCKED'
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    agent.status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : agent.status === 'BLOCKED' ? 'bg-red-500' : 'bg-gray-500'
                  }`} />
                  {agent.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-center mt-8 gap-1">
        <button className="w-9 h-9 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium shadow-lg shadow-purple-500/30 hover:bg-[#7C3AED] hover:scale-105 active:scale-95 transition-all duration-200">1</button>
        <button className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200">2</button>
        <button className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200">3</button>
        <button className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200">8</button>
        <button className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200">9</button>
        <button className="w-9 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200">10</button>
        <button className="px-4 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200 font-medium">Next →</button>
      </div>

      {/* Add/Edit Agent Modal with Platform Fees */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedAgent ? 'Edit Agent Information' : 'Add Agent Information'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Profile Picture */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-1.5">
              {formData.username.charAt(0) || 'A'}
            </div>
            <button type="button" className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] font-medium">
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

            {!selectedAgent && (
              <Input
                id="password"
                type="password"
                label="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            )}
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
                />
              </div>
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
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Contact #2</label>
                <input
                  type="text"
                  placeholder="Enter contact"
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/20"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t sticky bottom-0 bg-white">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading} className="bg-[#8B5CF6] hover:bg-[#7C3AED]">
              Submit
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
            <div className="flex items-center gap-4 pb-4 border-b">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
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
              <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium opacity-90">Agent Wallet Balance</span>
                </div>
                <p className="text-3xl font-bold">${Number(selectedAgent.walletBalance || 0).toLocaleString()}</p>
                <p className="text-xs opacity-75 mt-2">Available balance in agent's wallet</p>
              </div>

              <div className="bg-gradient-to-br from-[#52B788] to-[#2D5F5D] rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <UsersIcon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium opacity-90">Overall Users Balance</span>
                </div>
                <p className="text-3xl font-bold">${(Number(selectedAgent.walletBalance || 0) * 2.5).toLocaleString()}</p>
                <p className="text-xs opacity-75 mt-2">Combined balance of all users</p>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">156</p>
                <p className="text-xs text-gray-500 mt-1">Total Users</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">87%</p>
                <p className="text-xs text-gray-500 mt-1">Active Rate</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">$1.2M</p>
                <p className="text-xs text-gray-500 mt-1">Lifetime Value</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsBalanceModalOpen(false)} className="bg-[#8B5CF6] hover:bg-[#7C3AED]">
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
        title="Agents profile Details"
      >
        {selectedAgent && (
          <div className="space-y-6">
            {/* Profile Header with Edit Button */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {selectedAgent.username.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedAgent.username}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Street no 14 sanksy chicago</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className={`w-2 h-2 rounded-full ${selectedAgent.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-semibold ${selectedAgent.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedAgent.status === 'ACTIVE' ? 'Active' : 'Blocked'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleEditAgent(selectedAgent)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit Agent"
              >
                <Edit className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Account Info - Clean List */}
            <div className="space-y-0 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`text-sm font-semibold ${selectedAgent.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedAgent.status}
                </span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Agency ID</span>
                <span className="text-sm font-medium text-gray-900">A-12345</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Email</span>
                <span className="text-sm font-medium text-gray-900">{selectedAgent.email}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Website</span>
                <span className="text-sm font-medium text-blue-600">http://example.com</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Contact #1</span>
                <span className="text-sm font-medium text-gray-900">088-031-083</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Contact #2</span>
                <span className="text-sm font-medium text-gray-900">088-031-083</span>
              </div>
            </div>

            {/* Balance Report Section */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Balance Report</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#6366F1]/5 rounded-xl p-5 border border-[#8B5CF6]/10">
                  <p className="text-xs text-gray-500 mb-2">Agent Balance</p>
                  <p className="text-3xl font-bold text-[#8B5CF6]">${Number(selectedAgent.walletBalance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-[#52B788]/5 to-[#2D5F5D]/5 rounded-xl p-5 border border-[#52B788]/10">
                  <p className="text-xs text-gray-500 mb-2">Users Balance</p>
                  <p className="text-3xl font-bold text-[#52B788]">${(Number(selectedAgent.walletBalance || 0) * 2.5).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
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
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-lg font-semibold">
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
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 resize-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                This reason will be saved in the agent's history with timestamp
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
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
                className={selectedAgent.status === 'ACTIVE' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-[#52B788] hover:bg-[#2D5F5D]'}
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
