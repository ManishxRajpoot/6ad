'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'

const withdrawals = [
  { id: 'WTH001', amount: 2500, method: 'USDT (TRC20)', status: 'COMPLETED', date: '2024-01-15' },
  { id: 'WTH002', amount: 2000, method: 'Bitcoin', status: 'PENDING', date: '2024-01-12' },
  { id: 'WTH003', amount: 1500, method: 'USDT (TRC20)', status: 'REJECTED', date: '2024-01-08' },
]

const cryptoOptions = [
  { id: 'usdt-trc20', name: 'USDT (TRC20)', network: 'Tron Network', icon: '💵' },
  { id: 'usdt-erc20', name: 'USDT (ERC20)', network: 'Ethereum Network', icon: '💵' },
  { id: 'btc', name: 'Bitcoin', network: 'Bitcoin Network', icon: '₿' },
  { id: 'eth', name: 'Ethereum', network: 'Ethereum Network', icon: 'Ξ' },
]

export default function WithdrawalsPage() {
  const [amount, setAmount] = useState('')
  const [selectedCrypto, setSelectedCrypto] = useState(cryptoOptions[0])
  const balance = 4300 // Mock balance in USD

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

  return (
    <DashboardLayout title="Withdrawals" subtitle="Withdraw funds to your crypto wallet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Withdrawal Form */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Request Withdrawal</h2>

          {/* Balance Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Available Balance</p>
                <p className="text-2xl font-bold text-gray-900">${balance.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Minimum Withdrawal</p>
                <p className="text-lg font-semibold text-gray-900">$50</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {[100, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt.toString())}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  ${amt.toLocaleString()}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Cryptocurrency</label>
            <div className="grid grid-cols-2 gap-3">
              {cryptoOptions.map((crypto) => (
                <button
                  key={crypto.id}
                  onClick={() => setSelectedCrypto(crypto)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedCrypto.id === crypto.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{crypto.icon}</span>
                    <div>
                      <p className="font-medium text-gray-900">{crypto.name}</p>
                      <p className="text-xs text-gray-500">{crypto.network}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your {selectedCrypto.name} Wallet Address
            </label>
            <Input placeholder={`Enter your ${selectedCrypto.name} wallet address`} />
            <p className="text-sm text-gray-500 mt-1">Make sure you enter the correct address on the {selectedCrypto.network}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Important</p>
                <p className="text-sm text-yellow-700">Double-check your wallet address. Crypto transactions cannot be reversed.</p>
              </div>
            </div>
          </div>

          <Button className="w-full" disabled={!amount || parseInt(amount) < 50 || parseInt(amount) > balance}>
            Request Withdrawal
          </Button>
        </Card>

        {/* Info Card */}
        <Card className="p-6 h-fit">
          <h3 className="text-lg font-semibold mb-4">Withdrawal Info</h3>
          <div className="space-y-4">
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Processing Time</span>
              <span className="font-medium">1-24 hours</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Minimum Amount</span>
              <span className="font-medium">$50</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-100">
              <span className="text-gray-500">Maximum Amount</span>
              <span className="font-medium">$50,000</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-500">Network Fee</span>
              <span className="font-medium text-gray-600">Varies by network</span>
            </div>
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700"><strong>Tip:</strong> USDT (TRC20) has the lowest network fees.</p>
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
                  <td className="py-4 px-4 font-medium text-gray-900">${withdrawal.amount.toLocaleString()}</td>
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
