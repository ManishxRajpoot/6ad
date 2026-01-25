'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { accountsApi, usersApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'

type Account = {
  id: string
  accountId: string
  accountName: string
  platform: string
  status: string
  spendLimit: number
  currentSpend: number
  timezone: string | null
  currency: string
  createdAt: string
  user?: {
    id: string
    username: string
  }
}

type User = {
  id: string
  username: string
}

type PlatformPageProps = {
  platform: 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'SNAPCHAT' | 'BING'
  title: string
}

export function PlatformPage({ platform, title }: PlatformPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [formData, setFormData] = useState({
    accountId: '',
    accountName: '',
    userId: '',
    spendLimit: '500',
    currency: 'USD',
    timezone: 'America/New_York',
    status: 'ACTIVE',
  })
  const [formLoading, setFormLoading] = useState(false)

  const fetchData = async () => {
    try {
      const [accountsData, usersData] = await Promise.all([
        accountsApi.getAll(platform),
        usersApi.getAll(),
      ])
      setAccounts(accountsData.accounts || [])
      setUsers(usersData.users || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [platform])

  const handleOpenModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        accountId: account.accountId,
        accountName: account.accountName,
        userId: account.user?.id || '',
        spendLimit: account.spendLimit.toString(),
        currency: account.currency,
        timezone: account.timezone || 'America/New_York',
        status: account.status,
      })
    } else {
      setEditingAccount(null)
      setFormData({
        accountId: '',
        accountName: '',
        userId: '',
        spendLimit: '500',
        currency: 'USD',
        timezone: 'America/New_York',
        status: 'ACTIVE',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const payload = {
        ...formData,
        platform,
        spendLimit: parseFloat(formData.spendLimit),
      }

      if (editingAccount) {
        await accountsApi.update(editingAccount.id, payload)
      } else {
        await accountsApi.create(payload)
      }

      setIsModalOpen(false)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to save account')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      await accountsApi.delete(id)
      fetchData()
    } catch (error: any) {
      alert(error.message || 'Failed to delete account')
    }
  }

  const filteredAccounts = accounts.filter(
    (account) =>
      account.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.accountId.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout title={title}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{platform} Accounts ({accounts.length})</CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-64 rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </div>
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
                  <TableCell header>Account</TableCell>
                  <TableCell header>Account ID</TableCell>
                  <TableCell header>User</TableCell>
                  <TableCell header>Status</TableCell>
                  <TableCell header>Spend Limit</TableCell>
                  <TableCell header>Current Spend</TableCell>
                  <TableCell header>Created</TableCell>
                  <TableCell header>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length > 0 ? (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <p className="font-medium">{account.accountName}</p>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{account.accountId}</TableCell>
                      <TableCell>
                        {account.user ? (
                          <span className="text-primary-600">{account.user.username}</span>
                        ) : (
                          <span className="text-gray-400">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            account.status === 'ACTIVE'
                              ? 'success'
                              : account.status === 'DISABLED'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(account.spendLimit)}</TableCell>
                      <TableCell>{formatCurrency(account.currentSpend)}</TableCell>
                      <TableCell className="text-gray-500">{formatDate(account.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(account)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(account.id)}
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
                    <TableCell colSpan={8} className="text-center text-gray-500">
                      No accounts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="accountId"
            label="Account ID"
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            placeholder="e.g., act_123456789"
            required
          />
          <Input
            id="accountName"
            label="Account Name"
            value={formData.accountName}
            onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
            required
          />
          <Select
            label="Assign to User"
            value={formData.userId}
            onChange={(value) => setFormData({ ...formData, userId: value })}
            options={users.map((user) => ({
              value: user.id,
              label: user.username,
            }))}
          />
          <Input
            id="spendLimit"
            type="number"
            label="Spend Limit ($)"
            value={formData.spendLimit}
            onChange={(e) => setFormData({ ...formData, spendLimit: e.target.value })}
            min="0"
            required
          />
          <Select
            label="Currency"
            value={formData.currency}
            onChange={(value) => setFormData({ ...formData, currency: value })}
            options={[
              { value: 'USD', label: 'USD - US Dollar' },
              { value: 'EUR', label: 'EUR - Euro' },
              { value: 'GBP', label: 'GBP - British Pound' },
            ]}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'DISABLED', label: 'Disabled' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingAccount ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
