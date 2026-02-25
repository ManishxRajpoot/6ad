'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { transactionsApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/contexts/ToastContext'
import { AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'

interface Withdrawal {
  id: string
  amount: number
  bankName?: string
  accountNumber?: string
  accountHolderName?: string
  ifscCode?: string
  remarks?: string
  status: string
  createdAt: string
}

export default function WithdrawalsPage() {
  const { user, isHydrated, isAuthenticated } = useAuthStore()
  const { showToast } = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [remarks, setRemarks] = useState('')

  const balance = user?.walletBalance ? Number(user.walletBalance) : 0

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return
    fetchWithdrawals()
  }, [isHydrated, isAuthenticated])

  const fetchWithdrawals = async () => {
    try {
      const data = await transactionsApi.withdrawals.getAll()
      setWithdrawals(data.withdrawals || [])
    } catch {
      // Show empty state
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum < 50) {
      showToast('error', 'Minimum withdrawal amount is $50')
      return
    }
    if (amountNum > balance) {
      showToast('error', 'Insufficient balance')
      return
    }
    if (!bankName || !accountNumber || !accountHolderName || !ifscCode) {
      showToast('error', 'Please fill all bank details')
      return
    }

    setSubmitting(true)
    try {
      await transactionsApi.withdrawals.create({
        amount: amountNum,
        bankName,
        accountNumber,
        accountHolderName,
        ifscCode,
        remarks,
      })
      showToast('success', 'Withdrawal request submitted')
      setAmount('')
      setBankName('')
      setAccountNumber('')
      setAccountHolderName('')
      setIfscCode('')
      setRemarks('')
      fetchWithdrawals()
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit withdrawal')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}>
          <CheckCircle className="w-3 h-3" /> Approved
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
    <DashboardLayout title="Withdrawals" subtitle="Withdraw funds to your bank account">
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

          <div className="mb-4">
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
                onClick={() => setAmount(Math.floor(balance).toString())}
                className="px-4 py-2 border border-primary-500 text-primary-500 rounded-lg text-sm hover:bg-primary-50"
              >
                Max
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
              <Input placeholder="Enter bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name</label>
              <Input placeholder="Enter account holder name" value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
              <Input placeholder="Enter account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code</label>
              <Input placeholder="Enter IFSC code" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks (Optional)</label>
            <Input placeholder="Any additional notes" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Important</p>
                <p className="text-sm text-yellow-700">Double-check your bank details. Withdrawals are processed within 1-24 hours.</p>
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={submitting || !amount || Number(amount) < 50 || Number(amount) > balance || !bankName || !accountNumber || !accountHolderName || !ifscCode}
            onClick={handleSubmit}
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting...</> : 'Request Withdrawal'}
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
            <div className="flex justify-between py-3">
              <span className="text-gray-500">Method</span>
              <span className="font-medium">Bank Transfer</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Withdrawals */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Recent Withdrawals</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No withdrawals yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Bank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Account</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">${Number(w.amount).toLocaleString()}</td>
                    <td className="py-4 px-4 text-gray-600">{w.bankName || '-'}</td>
                    <td className="py-4 px-4 text-gray-600 font-mono text-sm">{w.accountNumber || '-'}</td>
                    <td className="py-4 px-4">{getStatusBadge(w.status)}</td>
                    <td className="py-4 px-4 text-gray-500">{new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </DashboardLayout>
  )
}
