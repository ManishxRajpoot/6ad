'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle } from 'lucide-react'

const withdrawals = [
  { id: 'WTH001', amount: 25000, method: 'Bank Transfer', status: 'COMPLETED', date: '2024-01-15' },
  { id: 'WTH002', amount: 20000, method: 'UPI', status: 'PENDING', date: '2024-01-12' },
  { id: 'WTH003', amount: 15000, method: 'Bank Transfer', status: 'REJECTED', date: '2024-01-08' },
]

export default function WithdrawalsPage() {
  const [amount, setAmount] = useState('')
  const balance = 43000 // Mock balance

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
    <DashboardLayout title="Withdrawals" subtitle="Withdraw funds from your wallet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Form */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Request Withdrawal</h2>

          {/* Balance Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Available Balance</p>
                <p className="text-2xl font-bold text-gray-900">₹{balance.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Minimum Withdrawal</p>
                <p className="text-lg font-semibold text-gray-900">₹5,000</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {[5000, 10000, 25000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  ₹{amt.toLocaleString()}
                </button>
              ))}
              <button
                onClick={() => setAmount(balance.toString())}
                className="px-4 py-2 border border-primary-500 text-primary-500 rounded-lg text-sm hover:bg-primary-50"
              >
                Max
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Bank Details</label>
            <div className="space-y-4">
              <Input label="Account Holder Name" placeholder="Enter name as per bank" />
              <Input label="Account Number" placeholder="Enter account number" />
              <Input label="IFSC Code" placeholder="Enter IFSC code" />
              <Input label="Bank Name" placeholder="Enter bank name" />
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Important</p>
                <p className="text-sm text-yellow-700">Withdrawals are processed within 24-48 hours. Ensure bank details are correct.</p>
              </div>
            </div>
          </div>

          <Button className="w-full" disabled={!amount || parseInt(amount) < 5000 || parseInt(amount) > balance}>
            Request Withdrawal
          </Button>
        </Card>

        {/* Info Card */}
        <Card className="p-6 h-fit">
          <h3 className="text-lg font-semibold mb-4">Withdrawal Info</h3>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Processing Time</span>
              <span className="font-medium">24-48 hours</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Minimum Amount</span>
              <span className="font-medium">₹5,000</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Maximum Amount</span>
              <span className="font-medium">₹5,00,000</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-500">Processing Fee</span>
              <span className="font-medium text-green-600">Free</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Withdrawals */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Recent Withdrawals</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Method</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4 font-mono text-sm text-gray-600">{withdrawal.id}</td>
                  <td className="py-4 px-4 font-medium text-gray-900">₹{withdrawal.amount.toLocaleString()}</td>
                  <td className="py-4 px-4 text-gray-600">{withdrawal.method}</td>
                  <td className="py-4 px-4">{getStatusBadge(withdrawal.status)}</td>
                  <td className="py-4 px-4 text-gray-500">{withdrawal.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardLayout>
  )
}
