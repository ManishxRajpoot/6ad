'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { settingsApi } from '@/lib/api'
import { Plus, Edit, Trash2, CreditCard, Copy, Check } from 'lucide-react'

type PayLink = {
  id: string
  title: string
  description: string | null
  upiId: string | null
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  isActive: boolean
}

export default function SettingsPage() {
  const [paylinks, setPaylinks] = useState<PayLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPaylink, setEditingPaylink] = useState<PayLink | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    upiId: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    isActive: true,
  })
  const [formLoading, setFormLoading] = useState(false)

  const fetchPaylinks = async () => {
    try {
      const { paylinks } = await settingsApi.paylinks.getAll()
      setPaylinks(paylinks || [])
    } catch (error) {
      console.error('Failed to fetch paylinks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaylinks()
  }, [])

  const handleOpenModal = (paylink?: PayLink) => {
    if (paylink) {
      setEditingPaylink(paylink)
      setFormData({
        title: paylink.title,
        description: paylink.description || '',
        upiId: paylink.upiId || '',
        bankName: paylink.bankName || '',
        accountNumber: paylink.accountNumber || '',
        ifscCode: paylink.ifscCode || '',
        isActive: paylink.isActive,
      })
    } else {
      setEditingPaylink(null)
      setFormData({
        title: '',
        description: '',
        upiId: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        isActive: true,
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (editingPaylink) {
        await settingsApi.paylinks.update(editingPaylink.id, formData)
      } else {
        await settingsApi.paylinks.create(formData)
      }

      setIsModalOpen(false)
      fetchPaylinks()
    } catch (error: any) {
      alert(error.message || 'Failed to save payment method')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      await settingsApi.paylinks.delete(id)
      fetchPaylinks()
    } catch (error: any) {
      alert(error.message || 'Failed to delete payment method')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        {/* Payment Methods */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <CreditCard className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <p className="text-sm text-gray-500">Configure payment options for deposits</p>
              </div>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4" />
              Add Payment Method
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Title</TableCell>
                    <TableCell header>UPI ID</TableCell>
                    <TableCell header>Bank Details</TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paylinks.length > 0 ? (
                    paylinks.map((paylink) => (
                      <TableRow key={paylink.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{paylink.title}</p>
                            {paylink.description && (
                              <p className="text-xs text-gray-500">{paylink.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {paylink.upiId ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{paylink.upiId}</span>
                              <button
                                onClick={() => copyToClipboard(paylink.upiId!, paylink.id + '-upi')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {copiedId === paylink.id + '-upi' ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {paylink.bankName ? (
                            <div className="text-sm">
                              <p>{paylink.bankName}</p>
                              <p className="text-gray-500">
                                A/C: {paylink.accountNumber} | IFSC: {paylink.ifscCode}
                              </p>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              paylink.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {paylink.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenModal(paylink)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(paylink.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No payment methods configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPaylink ? 'Edit Payment Method' : 'Add Payment Method'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Bank Transfer, UPI"
            required
          />
          <Input
            id="description"
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-gray-700">UPI Details</p>
            <Input
              id="upiId"
              label="UPI ID"
              value={formData.upiId}
              onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
              placeholder="e.g., business@upi"
            />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Bank Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="bankName"
                label="Bank Name"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              <Input
                id="ifscCode"
                label="IFSC Code"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <Input
                id="accountNumber"
                label="Account Number"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-4">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active (visible to users)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingPaylink ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
