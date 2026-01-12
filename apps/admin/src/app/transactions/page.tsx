'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { transactionsApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Check, X, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'

type TabType = 'deposits' | 'withdrawals' | 'refunds'

type Transaction = {
  id: string
  amount: number
  status: string
  paymentMethod?: string
  accountDetails?: string
  proofUrl?: string
  reason?: string
  createdAt: string
  user?: {
    username: string
    email: string
  }
}

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('deposits')
  const [deposits, setDeposits] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([])
  const [refunds, setRefunds] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<{ id: string; type: TabType } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = async () => {
    try {
      const [depositsData, withdrawalsData, refundsData] = await Promise.all([
        transactionsApi.deposits.getAll(),
        transactionsApi.withdrawals.getAll(),
        transactionsApi.refunds.getAll(),
      ])
      setDeposits(depositsData.deposits || [])
      setWithdrawals(withdrawalsData.withdrawals || [])
      setRefunds(refundsData.refunds || [])
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleApprove = async (id: string, type: TabType) => {
    setActionLoading(true)
    try {
      if (type === 'deposits') {
        await transactionsApi.deposits.approve(id)
      } else if (type === 'withdrawals') {
        await transactionsApi.withdrawals.approve(id)
      } else {
        await transactionsApi.refunds.approve(id)
      }
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to approve')
    } finally {
      setActionLoading(false)
    }
  }

  const openRejectModal = (id: string, type: TabType) => {
    setSelectedTransaction({ id, type })
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!selectedTransaction || !rejectReason) return

    setActionLoading(true)
    try {
      const { id, type } = selectedTransaction
      if (type === 'deposits') {
        await transactionsApi.deposits.reject(id, rejectReason)
      } else if (type === 'withdrawals') {
        await transactionsApi.withdrawals.reject(id, rejectReason)
      } else {
        await transactionsApi.refunds.reject(id, rejectReason)
      }
      setRejectModalOpen(false)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to reject')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>
      default:
        return <Badge variant="warning">Pending</Badge>
    }
  }

  const currentData = activeTab === 'deposits' ? deposits : activeTab === 'withdrawals' ? withdrawals : refunds

  const tabs = [
    { id: 'deposits' as const, label: 'Deposits', icon: ArrowUpRight, count: deposits.length },
    { id: 'withdrawals' as const, label: 'Withdrawals', icon: ArrowDownRight, count: withdrawals.length },
    { id: 'refunds' as const, label: 'Refunds', icon: RefreshCw, count: refunds.length },
  ]

  return (
    <DashboardLayout title="Transactions Management">
      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span
              className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-xs',
                activeTab === tab.id ? 'bg-white/20' : 'bg-gray-100'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'deposits' && 'Deposit Requests'}
            {activeTab === 'withdrawals' && 'Withdrawal Requests'}
            {activeTab === 'refunds' && 'Refund Requests'}
          </CardTitle>
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
                  <TableCell header>User</TableCell>
                  <TableCell header>Amount</TableCell>
                  {activeTab === 'deposits' && <TableCell header>Payment Method</TableCell>}
                  {activeTab === 'withdrawals' && <TableCell header>Account Details</TableCell>}
                  {activeTab === 'refunds' && <TableCell header>Reason</TableCell>}
                  <TableCell header>Status</TableCell>
                  <TableCell header>Date</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length > 0 ? (
                  currentData.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                            {transaction.user?.username?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.user?.username || 'User'}</p>
                            <p className="text-xs text-gray-500">{transaction.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'font-medium',
                            activeTab === 'deposits' ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {activeTab === 'deposits' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </TableCell>
                      {activeTab === 'deposits' && (
                        <TableCell>{transaction.paymentMethod || '-'}</TableCell>
                      )}
                      {activeTab === 'withdrawals' && (
                        <TableCell className="max-w-[200px] truncate">
                          {transaction.accountDetails || '-'}
                        </TableCell>
                      )}
                      {activeTab === 'refunds' && (
                        <TableCell className="max-w-[200px] truncate">
                          {transaction.reason || '-'}
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell className="text-gray-500">
                        {formatDateTime(transaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        {transaction.status === 'PENDING' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(transaction.id, activeTab)}
                              disabled={actionLoading}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 transition-colors hover:bg-green-200"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openRejectModal(transaction.id, activeTab)}
                              disabled={actionLoading}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-200"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      No {activeTab} found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Transaction"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this transaction.
          </p>
          <Input
            id="reason"
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason..."
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              loading={actionLoading}
              disabled={!rejectReason}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
