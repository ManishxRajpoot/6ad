'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { agentsApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Edit, Trash2, Eye, MoreVertical } from 'lucide-react'

type Agent = {
  id: string
  username: string
  email: string
  phone: string | null
  status: string
  balance: number
  commissionRate: number
  createdAt: string
  _count?: {
    users: number
  }
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    commissionRate: '10',
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
        commissionRate: agent.commissionRate.toString(),
        status: agent.status,
      })
    } else {
      setEditingAgent(null)
      setFormData({
        username: '',
        email: '',
        password: '',
        phone: '',
        commissionRate: '10',
        status: 'ACTIVE',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const payload = {
        ...formData,
        commissionRate: parseFloat(formData.commissionRate),
      }

      if (editingAgent) {
        await agentsApi.update(editingAgent.id, payload)
      } else {
        await agentsApi.create(payload)
      }

      setIsModalOpen(false)
      fetchAgents()
    } catch (error: any) {
      alert(error.message || 'Failed to save agent')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return

    try {
      await agentsApi.delete(id)
      fetchAgents()
    } catch (error: any) {
      alert(error.message || 'Failed to delete agent')
    }
  }

  const filteredAgents = agents.filter(
    (agent) =>
      agent.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout title="Agents Management">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Agents ({agents.length})</CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4" />
              Add Agent
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell header>Agent</TableCell>
                  <TableCell header>Phone</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Commission</TableCell>
                  <TableCell header>Balance</TableCell>
                  <TableCell header>Users</TableCell>
                  <TableCell header>Joined</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.length > 0 ? (
                  filteredAgents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-600">
                            {agent.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{agent.username}</p>
                            <p className="text-xs text-gray-500">{agent.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{agent.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={agent.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {agent.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{agent.commissionRate}%</TableCell>
                      <TableCell className="font-medium">{formatCurrency(agent.balance)}</TableCell>
                      <TableCell>{agent._count?.users || 0}</TableCell>
                      <TableCell className="text-gray-500">{formatDate(agent.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(agent)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(agent.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      No agents found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgent ? 'Edit Agent' : 'Add Agent'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="username"
            label="Username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
          />
          <Input
            id="email"
            type="email"
            label="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          {!editingAgent && (
            <Input
              id="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
          )}
          <Input
            id="phone"
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            id="commissionRate"
            type="number"
            label="Commission Rate (%)"
            value={formData.commissionRate}
            onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
            min="0"
            max="100"
            required
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
              {editingAgent ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
