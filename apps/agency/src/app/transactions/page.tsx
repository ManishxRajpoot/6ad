'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Search, Filter, Download } from 'lucide-react'

const transactions = [
  { id: 'TXN001', user: 'John Doe', type: 'DEPOSIT', amount: 50000, status: 'COMPLETED', date: '2024-01-15 10:30' },
  { id: 'TXN002', user: 'Jane Smith', type: 'WITHDRAWAL', amount: 25000, status: 'PENDING', date: '2024-01-15 09:45' },
  { id: 'TXN003', user: 'Mike Johnson', type: 'DEPOSIT', amount: 100000, status: 'COMPLETED', date: '2024-01-14 16:20' },
  { id: 'TXN004', user: 'Sarah Wilson', type: 'REFUND', amount: 15000, status: 'COMPLETED', date: '2024-01-14 14:10' },
  { id: 'TXN005', user: 'David Brown', type: 'WITHDRAWAL', amount: 30000, status: 'REJECTED', date: '2024-01-14 11:30' },
  { id: 'TXN006', user: 'Emily Davis', type: 'DEPOSIT', amount: 75000, status: 'PENDING', date: '2024-01-13 18:45' },
]

export default function TransactionsPage() {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTransactions = transactions.filter(txn => {
    const matchesFilter = filter === 'all' || txn.type === filter
    const matchesSearch = txn.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          txn.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <Badge variant="success">Deposit</Badge>
      case 'WITHDRAWAL':
        return <Badge variant="warning">Withdrawal</Badge>
      case 'REFUND':
        return <Badge variant="info">Refund</Badge>
      default:
        return <Badge variant="default">{type}</Badge>
    }
  }

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
    <DashboardLayout title="Transactions" subtitle="View all transactions">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="REFUND">Refunds</option>
            </select>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Transaction ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((txn) => (
                <tr key={txn.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4 font-mono text-sm text-gray-600">{txn.id}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-600 font-medium text-sm">{txn.user.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-gray-900">{txn.user}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">{getTypeBadge(txn.type)}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">${txn.amount.toLocaleString()}</td>
                  <td className="py-4 px-4">{getStatusBadge(txn.status)}</td>
                  <td className="py-4 px-4 text-gray-500">{txn.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">Showing {filteredTransactions.length} transactions</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Previous</button>
            <button className="px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm">1</button>
            <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Next</button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  )
}
