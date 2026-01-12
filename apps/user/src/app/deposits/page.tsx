'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Plus, Copy, Check } from 'lucide-react'

const deposits = [
  { id: 'DEP001', amount: 50000, method: 'UPI', status: 'COMPLETED', date: '2024-01-15' },
  { id: 'DEP002', amount: 30000, method: 'Bank Transfer', status: 'PENDING', date: '2024-01-14' },
  { id: 'DEP003', amount: 25000, method: 'UPI', status: 'COMPLETED', date: '2024-01-10' },
  { id: 'DEP004', amount: 100000, method: 'Bank Transfer', status: 'COMPLETED', date: '2024-01-05' },
]

const paymentMethods = [
  { id: 'upi', name: 'UPI', details: 'pay@6ad.in' },
  { id: 'bank', name: 'Bank Transfer', details: 'HDFC Bank - 1234567890' },
]

export default function DepositsPage() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    <DashboardLayout title="Deposits" subtitle="Add funds to your wallet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposit Form */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Add Funds</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                placeholder="Enter amount"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {[5000, 10000, 25000, 50000].map((amount) => (
                <button
                  key={amount}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  ₹{amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-500 cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">{method.name}</p>
                    <p className="text-sm text-gray-500">{method.details}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(method.details)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Reference</label>
            <Input placeholder="Enter UTR/Reference number" />
            <p className="text-sm text-gray-500 mt-1">Enter the reference number after making the payment</p>
          </div>

          <Button className="w-full">Submit Deposit Request</Button>
        </Card>

        {/* Instructions */}
        <Card className="p-6 h-fit">
          <h3 className="text-lg font-semibold mb-4">How to Deposit</h3>
          <ol className="space-y-4 text-sm text-gray-600">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-medium">1</span>
              <span>Enter the amount you want to deposit</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-medium">2</span>
              <span>Choose your preferred payment method (UPI/Bank)</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-medium">3</span>
              <span>Make the payment to the provided details</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0 font-medium">4</span>
              <span>Enter the transaction reference and submit</span>
            </li>
          </ol>
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-700">Deposits are usually credited within 30 minutes during business hours.</p>
          </div>
        </Card>
      </div>

      {/* Recent Deposits */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Recent Deposits</h2>
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
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-4 px-4 font-mono text-sm text-gray-600">{deposit.id}</td>
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
    </DashboardLayout>
  )
}
