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
  RefreshCw,
  ChevronRight,
  Megaphone,
  CircleCheck,
  CircleX,
  CircleAlert,
  Gift,
  Undo2,
  WalletMinimal
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

  const getMobileIcon = (type: string) => {
    switch (type) {
      case 'ACCOUNT_APPROVED':
      case 'DEPOSIT_APPROVED':
        return { icon: <CircleCheck className="w-4 h-4" />, bg: 'bg-emerald-50', color: 'text-emerald-500' }
      case 'ACCOUNT_REJECTED':
      case 'DEPOSIT_REJECTED':
        return { icon: <CircleX className="w-4 h-4" />, bg: 'bg-red-50', color: 'text-red-500' }
      case 'LOW_BALANCE':
        return { icon: <CircleAlert className="w-4 h-4" />, bg: 'bg-amber-50', color: 'text-amber-500' }
      case 'REFUND_PROCESSED':
        return { icon: <Undo2 className="w-4 h-4" />, bg: 'bg-blue-50', color: 'text-blue-500' }
      case 'REFERRAL_REWARD':
        return { icon: <Gift className="w-4 h-4" />, bg: 'bg-purple-50', color: 'text-purple-500' }
      case 'ANNOUNCEMENT':
        return { icon: <Megaphone className="w-4 h-4" />, bg: 'bg-blue-50', color: 'text-blue-500' }
      default:
        return { icon: <Bell className="w-4 h-4" />, bg: 'bg-gray-50', color: 'text-gray-500' }
    }
  }

  return (
    <DashboardLayout title="Notifications" subtitle="View all your notifications">
      <style jsx global>{`
        @keyframes mFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ===== MOBILE VIEW ===== */}
      <div className="lg:hidden pb-24" style={{ animation: 'mFadeUp 0.4s cubic-bezier(0.25,0.1,0.25,1) both' }}>
        {/* Mobile Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
          <div className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#52B788] to-[#3D9970] flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#1E293B]">Alerts</p>
              <p className="text-[10px] text-gray-400">{total} total · {unreadCount} unread</p>
            </div>
            <button onClick={fetchNotifications} className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center active:bg-gray-100 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex border-t border-gray-100">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-2.5 text-[11px] font-semibold transition-all border-r border-gray-100 ${filter === 'all' ? 'text-[#52B788] bg-[#52B788]/5' : 'text-gray-400'}`}
            >
              All ({total})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`flex-1 py-2.5 text-[11px] font-semibold transition-all ${filter === 'unread' ? 'text-[#52B788] bg-[#52B788]/5' : 'text-gray-400'}`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        {/* Mark All Read */}
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="w-full mb-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#52B788]/10 text-[#52B788] text-[11px] font-semibold active:bg-[#52B788]/20 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all as read
          </button>
        )}

        {/* Notifications List */}
        {isLoading ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-7 h-7 border-2 border-[#52B788] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-[11px] text-gray-400">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No Notifications</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {filter === 'unread' ? 'All caught up!' : 'Nothing here yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const mi = getMobileIcon(n.type)
              return (
                <div
                  key={n.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${!n.isRead ? 'border-[#52B788]/30' : 'border-gray-100'}`}
                  style={{ animation: `mFadeUp 0.3s ease ${i * 0.05}s both` }}
                >
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${mi.bg} ${mi.color}`}>
                        {mi.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`text-xs leading-tight ${!n.isRead ? 'font-bold text-[#1E293B]' : 'font-semibold text-gray-700'}`}>
                            {n.title}
                          </h4>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#52B788] shrink-0 mt-1" />}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="flex border-t border-gray-100 text-[10px] divide-x divide-gray-100">
                    {n.link && (
                      <a href={n.link} className="flex-1 flex items-center justify-center gap-1 py-2 text-[#52B788] font-semibold">
                        <ExternalLink className="w-2.5 h-2.5" /> View
                      </a>
                    )}
                    {!n.isRead && (
                      <button onClick={() => handleMarkAsRead(n.id)} className="flex-1 flex items-center justify-center gap-1 py-2 text-gray-400 font-semibold active:bg-gray-50">
                        <Check className="w-2.5 h-2.5" /> Read
                      </button>
                    )}
                    <button onClick={() => handleDelete(n.id)} className="flex-1 flex items-center justify-center gap-1 py-2 text-red-400 font-semibold active:bg-red-50">
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden lg:block space-y-6">
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
