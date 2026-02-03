'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { notificationsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Filter,
  RefreshCw
} from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const res = await notificationsApi.getAll({
        limit: 50,
        unreadOnly: filter === 'unread'
      })
      setNotifications(res.notifications)
      setTotal(res.total)
      setUnreadCount(res.unreadCount)
    } catch (error) {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      // Silently fail
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      // Silently fail
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const notification = notifications.find(n => n.id === id)
      await notificationsApi.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      setTotal(prev => prev - 1)
    } catch (error) {
      // Silently fail
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'ACCOUNT_APPROVED':
        return '🎉'
      case 'ACCOUNT_REJECTED':
        return '❌'
      case 'DEPOSIT_APPROVED':
        return '💰'
      case 'DEPOSIT_REJECTED':
        return '⚠️'
      case 'LOW_BALANCE':
        return '💸'
      case 'REFUND_PROCESSED':
        return '↩️'
      case 'REFERRAL_REWARD':
        return '🎁'
      case 'ANNOUNCEMENT':
        return '📢'
      default:
        return '🔔'
    }
  }

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'ACCOUNT_APPROVED':
      case 'DEPOSIT_APPROVED':
      case 'REFERRAL_REWARD':
        return 'bg-green-100 text-green-800'
      case 'ACCOUNT_REJECTED':
      case 'DEPOSIT_REJECTED':
        return 'bg-red-100 text-red-800'
      case 'LOW_BALANCE':
        return 'bg-yellow-100 text-yellow-800'
      case 'ANNOUNCEMENT':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <DashboardLayout title="Notifications" subtitle="View all your notifications">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({total})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchNotifications}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 bg-[#8B5CF6] hover:bg-[#7C3AED]"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#8B5CF6] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
              <p className="text-gray-500">
                {filter === 'unread' ? 'You have no unread notifications' : 'You have no notifications yet'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-[#8B5CF6]/5' : ''
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                              {notification.title}
                            </h4>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getNotificationTypeColor(notification.type)}`}>
                              {notification.type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{notification.message}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </span>
                            {notification.link && (
                              <a
                                href={notification.link}
                                className="text-xs text-[#8B5CF6] hover:underline flex items-center gap-1"
                              >
                                View Details <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
