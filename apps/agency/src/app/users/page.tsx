'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Plus, Search, MoreVertical, Edit, Trash2, Eye } from 'lucide-react'

const users = [
  { id: '1', name: 'John Doe', email: 'john@example.com', phone: '+91 98765 43210', status: 'ACTIVE', balance: 45000, createdAt: '2024-01-15' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+91 98765 43211', status: 'ACTIVE', balance: 32000, createdAt: '2024-01-14' },
  { id: '3', name: 'Mike Johnson', email: 'mike@example.com', phone: '+91 98765 43212', status: 'PENDING', balance: 18500, createdAt: '2024-01-13' },
  { id: '4', name: 'Sarah Wilson', email: 'sarah@example.com', phone: '+91 98765 43213', status: 'ACTIVE', balance: 67200, createdAt: '2024-01-12' },
  { id: '5', name: 'David Brown', email: 'david@example.com', phone: '+91 98765 43214', status: 'SUSPENDED', balance: 0, createdAt: '2024-01-11' },
  { id: '6', name: 'Emily Davis', email: 'emily@example.com', phone: '+91 98765 43215', status: 'ACTIVE', balance: 89000, createdAt: '2024-01-10' },
]

export default function UsersPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      case 'SUSPENDED':
        return <Badge variant="danger">Suspended</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <DashboardLayout title="Users" subtitle="Manage your users">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Phone</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Balance</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-600 font-medium">{user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-600">{user.phone}</td>
                  <td className="py-4 px-4">{getStatusBadge(user.status)}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">₹{user.balance.toLocaleString()}</td>
                  <td className="py-4 px-4 text-gray-500">{user.createdAt}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">Showing {filteredUsers.length} of {users.length} users</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Previous</button>
            <button className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm">1</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">2</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Next</button>
          </div>
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New User">
        <form className="space-y-4">
          <Input label="Full Name" placeholder="Enter full name" />
          <Input label="Email" type="email" placeholder="Enter email" />
          <Input label="Phone" placeholder="Enter phone number" />
          <Input label="Password" type="password" placeholder="Create password" />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add User
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
