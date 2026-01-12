'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { agentsApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, MoreVertical, Filter, Download, Grid, List } from 'lucide-react'

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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    status: 'ACTIVE',
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

  const handleOpenModal = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent)
      setFormData({
        username: agent.username,
        email: agent.email,
        password: '',
        phone: agent.phone || '',
        status: agent.status,
      })
    } else {
      setEditingAgent(null)
      setFormData({
        username: '',
        email: '',
        password: '',
        phone: '',
        status: 'ACTIVE',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (editingAgent) {
        await agentsApi.update(editingAgent.id, formData)
      } else {
        await agentsApi.create(formData)
      }

      setIsModalOpen(false)
      fetchAgents()
    } catch (error: any) {
      alert(error.message || 'Failed to save agent')
    } finally {
      setFormLoading(false)
    }
  }

  const filteredAgents = agents.filter(
    (agent) =>
      agent.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sample agents for display when no real data
  const displayAgents = filteredAgents.length > 0 ? filteredAgents : [
    { id: '1', username: 'Vicky Sampath', email: 'vicky@agent.com', phone: '+1234567890', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT001' },
    { id: '2', username: 'Vicky Sampath', email: 'vicky2@agent.com', phone: '+1234567891', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT002' },
    { id: '3', username: 'Vicky Sampath', email: 'vicky3@agent.com', phone: '+1234567892', status: 'INACTIVE', walletBalance: '22444610', uniqueId: 'AGT003' },
    { id: '4', username: 'Vicky Sampath', email: 'vicky4@agent.com', phone: '+1234567893', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT004' },
    { id: '5', username: 'Vicky Sampath', email: 'vicky5@agent.com', phone: '+1234567894', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT005' },
    { id: '6', username: 'Vicky Sampath', email: 'vicky6@agent.com', phone: '+1234567895', status: 'ACTIVE', walletBalance: '22444610', uniqueId: 'AGT006' },
  ]

  return (
    <DashboardLayout title="Agents Management">
      {/* Header Actions */}
      <div className="bg-white rounded-xl p-4 shadow-card mb-6">
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
                className="h-9 w-[200px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none"
              />
            </div>

            {/* Filter Buttons */}
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Best Agents
            </button>
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Block
            </button>
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Danger
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Export */}
            <button className="flex items-center gap-2 h-9 px-3 rounded-lg bg-green-500 text-white text-sm hover:bg-green-600">
              <Download className="h-4 w-4" />
              Export
            </button>

            {/* Add Agent */}
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-500 text-white text-sm hover:bg-primary-600"
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {displayAgents.map((agent) => (
            <div key={agent.id} className="bg-white rounded-xl p-4 shadow-card hover:shadow-card-hover transition-shadow">
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-lg font-semibold">
                    {agent.username.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{agent.username}</h3>
                    <p className="text-xs text-gray-500">Agent #{agent.uniqueId?.slice(-4) || '0001'}</p>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>

              {/* Agent Details */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Balance</span>
                  <span className="text-sm font-semibold text-gray-900">${Number(agent.walletBalance || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Email</span>
                  <span className="text-xs text-gray-700 truncate max-w-[120px]">{agent.email}</span>
                </div>
              </div>

              {/* Status & Action */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  agent.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-600'
                    : agent.status === 'INACTIVE'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-yellow-100 text-yellow-600'
                }`}>
                  {agent.status}
                </span>
                <button
                  onClick={() => handleOpenModal(agent as any)}
                  className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-500">Showing 1-{displayAgents.length} of {displayAgents.length} agents</p>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">1</button>
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">2</button>
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">3</button>
          <span className="px-2 text-gray-400">...</span>
          <button className="w-8 h-8 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">10</button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgent ? 'Edit Agent' : 'Add Agent Information'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Picture */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
              {formData.username.charAt(0) || 'A'}
            </div>
          </div>

          <Input
            id="username"
            label="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Enter username"
            required
          />
          <Input
            id="email"
            type="email"
            label="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter email"
            required
          />
          {!editingAgent && (
            <Input
              id="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
              required
            />
          )}
          <Input
            id="phone"
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Enter phone number"
          />
          <Select
            id="status"
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingAgent ? 'Update' : 'Submit'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
