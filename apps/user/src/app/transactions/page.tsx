'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Search, Download, ArrowDownCircle, ArrowUpCircle, TrendingUp, CheckCircle, Clock, XCircle } from 'lucide-react'

// Transaction type filter options
const transactionTypeOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'DEPOSIT', label: 'Deposits' },
  { value: 'WITHDRAWAL', label: 'Withdrawals' },
  { value: 'SPEND', label: 'Spend' },
  { value: 'REFUND', label: 'Refunds' },
]

const transactions = [
  { id: 'TXN001', type: 'DEPOSIT', amount: 50000, status: 'COMPLETED', date: '2024-01-15 10:30', description: 'Wallet Top-up' },
  { id: 'TXN002', type: 'SPEND', amount: -12000, status: 'COMPLETED', date: '2024-01-14 16:45', description: 'Facebook Ads' },
  { id: 'TXN003', type: 'WITHDRAWAL', amount: -20000, status: 'PENDING', date: '2024-01-13 09:15', description: 'Bank Transfer' },
  { id: 'TXN004', type: 'DEPOSIT', amount: 30000, status: 'COMPLETED', date: '2024-01-12 14:20', description: 'Wallet Top-up' },
  { id: 'TXN005', type: 'SPEND', amount: -8500, status: 'COMPLETED', date: '2024-01-11 11:00', description: 'Google Ads' },
  { id: 'TXN006', type: 'REFUND', amount: 5000, status: 'COMPLETED', date: '2024-01-10 08:30', description: 'Account Credit' },
]

export default function TransactionsPage() {
  const [filter, setFilter] = useState('all')

  const filteredTransactions = filter === 'all'
    ? transactions
    : transactions.filter(t => t.type === filter)

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <Badge variant="success">Deposit</Badge>
      case 'WITHDRAWAL':
        return <Badge variant="warning">Withdrawal</Badge>
      case 'SPEND':
        return <Badge variant="info">Spend</Badge>
      case 'REFUND':
        return <Badge variant="default">Refund</Badge>
      default:
        return <Badge variant="default">{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (status) {
      case 'COMPLETED':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
          <CheckCircle className="w-3 h-3" /> Completed
        </span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}>
          <Clock className="w-3 h-3" /> Pending
        </span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}>
          <XCircle className="w-3 h-3" /> Rejected
        </span>
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <ArrowDownCircle className="w-5 h-5 text-green-600" />
      case 'WITHDRAWAL':
        return <ArrowUpCircle className="w-5 h-5 text-orange-600" />
      case 'SPEND':
        return <TrendingUp className="w-5 h-5 text-purple-600" />
      default:
        return <ArrowDownCircle className="w-5 h-5 text-gray-600" />
    }
  }

  return (
    <DashboardLayout title="Transactions" subtitle="View your transaction history">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="w-36">
              <Select
                options={transactionTypeOptions}
                value={filter}
                onChange={setFilter}
                placeholder="All Types"
                size="sm"
                
              />
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        <div className="space-y-3">
          {filteredTransactions.map((txn) => (
            <div key={txn.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  txn.type === 'DEPOSIT' ? 'bg-green-100' :
                  txn.type === 'SPEND' ? 'bg-purple-100' :
                  txn.type === 'WITHDRAWAL' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  {getTypeIcon(txn.type)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{txn.description}</p>
                  <p className="text-sm text-gray-500">{txn.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  {getTypeBadge(txn.type)}
                  <p className="text-sm text-gray-500 mt-1">{txn.id}</p>
                </div>
                <div className="text-right min-w-[120px]">
                  <p className={`text-lg font-semibold ${txn.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toLocaleString()}
                  </p>
                  {getStatusBadge(txn.status)}
                </div>
              </div>
            </div>
          ))}
        </div>

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
