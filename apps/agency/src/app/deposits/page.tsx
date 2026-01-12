'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Plus, Search } from 'lucide-react'

const deposits = [
  { id: 'DEP001', user: 'John Doe', amount: 50000, method: 'UPI', status: 'COMPLETED', date: '2024-01-15' },
  { id: 'DEP002', user: 'Jane Smith', amount: 100000, method: 'Bank Transfer', status: 'PENDING', date: '2024-01-15' },
  { id: 'DEP003', user: 'Mike Johnson', amount: 25000, method: 'UPI', status: 'COMPLETED', date: '2024-01-14' },
  { id: 'DEP004', user: 'Sarah Wilson', amount: 75000, method: 'Bank Transfer', status: 'REJECTED', date: '2024-01-14' },
]

export default function DepositsPage() {
  const [showAddModal, setShowAddModal] = useState(false)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <DashboardLayout title="Deposits" subtitle="Manage user deposits">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search deposits..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Deposit
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Method</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4 font-mono text-sm text-gray-600">{deposit.id}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">{deposit.user}</td>
                  <td className="py-4 px-4 font-medium text-green-600">+₹{deposit.amount.toLocaleString()}</td>
                  <td className="py-4 px-4 text-gray-600">{deposit.method}</td>
                  <td className="py-4 px-4">{getStatusBadge(deposit.status)}</td>
                  <td className="py-4 px-4 text-gray-500">{deposit.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Deposit">
        <form className="space-y-4">
          <Input label="User Email" type="email" placeholder="Enter user email" />
          <Input label="Amount" type="number" placeholder="Enter amount" />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Deposit
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
