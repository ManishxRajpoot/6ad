'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Search, Check, X } from 'lucide-react'

const withdrawals = [
  { id: 'WTH001', user: 'John Doe', amount: 25000, method: 'Bank Transfer', status: 'PENDING', date: '2024-01-15' },
  { id: 'WTH002', user: 'Jane Smith', amount: 50000, method: 'UPI', status: 'COMPLETED', date: '2024-01-14' },
  { id: 'WTH003', user: 'Mike Johnson', amount: 30000, method: 'Bank Transfer', status: 'REJECTED', date: '2024-01-14' },
  { id: 'WTH004', user: 'Sarah Wilson', amount: 75000, method: 'UPI', status: 'PENDING', date: '2024-01-13' },
]

export default function WithdrawalsPage() {
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
    <DashboardLayout title="Withdrawals" subtitle="Manage withdrawal requests">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search withdrawals..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
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
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4 font-mono text-sm text-gray-600">{withdrawal.id}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">{withdrawal.user}</td>
                  <td className="py-4 px-4 font-medium text-red-600">-₹{withdrawal.amount.toLocaleString()}</td>
                  <td className="py-4 px-4 text-gray-600">{withdrawal.method}</td>
                  <td className="py-4 px-4">{getStatusBadge(withdrawal.status)}</td>
                  <td className="py-4 px-4 text-gray-500">{withdrawal.date}</td>
                  <td className="py-4 px-4">
                    {withdrawal.status === 'PENDING' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="!px-2">
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="outline" className="!px-2">
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  )
}
