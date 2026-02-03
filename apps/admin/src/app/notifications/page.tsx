'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import {
  Bell,
  Plus,
  Send,
  User,
  Users,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Megaphone,
} from 'lucide-react'
import { notificationsApi, usersApi } from '@/lib/api'

interface NotificationLog {
  id: string
  userId: string
  user: {
    username: string
    email: string
  }
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

const notificationTypes = [
  { value: 'ACCOUNT_APPROVED', label: 'Account Approved', icon: CheckCircle, color: 'text-green-500' },
  { value: 'ACCOUNT_REJECTED', label: 'Account Rejected', icon: AlertCircle, color: 'text-red-500' },
  { value: 'DEPOSIT_APPROVED', label: 'Deposit Approved', icon: DollarSign, color: 'text-green-500' },
  { value: 'DEPOSIT_REJECTED', label: 'Deposit Rejected', icon: AlertCircle, color: 'text-red-500' },
  { value: 'LOW_BALANCE', label: 'Low Balance', icon: AlertCircle, color: 'text-yellow-500' },
  { value: 'REFUND_PROCESSED', label: 'Refund Processed', icon: RefreshCw, color: 'text-blue-500' },
  { value: 'SYSTEM', label: 'System', icon: Bell, color: 'text-purple-500' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', icon: Megaphone, color: 'text-indigo-500' },
]

export default function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [users, setUsers] = useState<{ id: string; username: string; email: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    userId: '',
    type: 'SYSTEM',
    title: '',
    message: '',
    sendToAll: false,
  })

  const fetchData = async () => {
    try {
      const [logsRes, usersRes] = await Promise.all([
        notificationsApi.getAdminLogs(),
        usersApi.getAll()
      ])
      setLogs(logsRes.notifications || [])
      setUsers(usersRes.users || [])
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenModal = () => {
    setFormData({
      userId: '',
      type: 'SYSTEM',
      title: '',
      message: '',
      sendToAll: false,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (formData.sendToAll) {
        await notificationsApi.sendToAll({
          type: formData.type,
          title: formData.title,
          message: formData.message,
        })
      } else {
        await notificationsApi.send({
          userId: formData.userId,
          type: formData.type,
          title: formData.title,
          message: formData.message,
        })
      }

      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      alert('Failed to send notification')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTypeConfig = (type: string) => {
    return notificationTypes.find(t => t.value === type) || notificationTypes[notificationTypes.length - 1]
  }

  const filteredLogs = logs.filter(log =>
    log.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: logs.length,
    read: logs.filter(l => l.isRead).length,
    unread: logs.filter(l => !l.isRead).length,
  }

  return (
    <DashboardLayout title="Notifications" subtitle="Send and manage user notifications">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Total Sent</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.read}</p>
                <p className="text-sm text-gray-500">Read</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
                <p className="text-sm text-gray-500">Unread</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <Button onClick={handleOpenModal}>
              <Plus className="w-4 h-4 mr-2" />
              Send Notification
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No notifications sent yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const typeConfig = getTypeConfig(log.type)
                const TypeIcon = typeConfig.icon

                return (
                  <div
                    key={log.id}
                    className={`border rounded-xl p-4 ${log.isRead ? 'border-gray-100 bg-gray-50' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center ${typeConfig.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium text-gray-900">{log.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              log.isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {log.isRead ? 'Read' : 'Unread'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.user.username}
                          </span>
                          <span>{log.user.email}</span>
                          <span>{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Send Notification Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Send Notification"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="sendToAll"
              checked={formData.sendToAll}
              onChange={(e) => setFormData({ ...formData, sendToAll: e.target.checked })}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="sendToAll" className="text-sm text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Send to all users
            </label>
          </div>

          {!formData.sendToAll && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required={!formData.sendToAll}
              >
                <option value="">Choose a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {notificationTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Notification title"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Notification message"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
