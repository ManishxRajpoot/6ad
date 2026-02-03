'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, Trash2, ExternalLink } from 'lucide-react'
import { notificationsApi } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await notificationsApi.getUnreadCount()
        setUnreadCount(res.unreadCount)
      } catch (error) {
        // Silently fail
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const fetchNotifications = async () => {
        setIsLoading(true)
        try {
          const res = await notificationsApi.getAll({ limit: 10 })
          setNotifications(res.notifications)
          setUnreadCount(res.unreadCount)
        } catch (error) {
          // Silently fail
        } finally {
          setIsLoading(false)
        }
      }
      fetchNotifications()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      await notificationsApi.delete(id)
      const notification = notifications.find(n => n.id === id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
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

  const handleBellClick = () => {
    setIsAnimating(true)
    setIsOpen(!isOpen)
    // Reset animation after it completes
    setTimeout(() => setIsAnimating(false), 500)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Animation Styles */}
      <style jsx>{`
        @keyframes bellRing {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-14deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-6deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-2deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-ring {
          animation: bellRing 0.5s ease-in-out;
          transform-origin: top center;
        }
        @keyframes dropdownOpen {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .dropdown-animate {
          animation: dropdownOpen 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top right;
        }
      `}</style>

      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2.5 text-gray-600 hover:text-[#8B5CF6] bg-gray-50 hover:bg-[#8B5CF6]/10 rounded-xl transition-all duration-300 border border-gray-200 hover:border-[#8B5CF6]/30"
      >
        <svg
          className={`w-5 h-5 ${isAnimating ? 'bell-ring' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="dropdown-animate absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[99999]" style={{ isolation: 'isolate' }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-[#8B5CF6] border-t-transparent rounded-full mx-auto mb-2" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    !notification.isRead ? 'bg-[#8B5CF6]/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'} text-gray-900`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                        {notification.link && (
                          <a
                            href={notification.link}
                            className="text-xs text-[#8B5CF6] hover:underline flex items-center gap-0.5"
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {!notification.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <a
                href="/notifications"
                className="text-sm text-[#8B5CF6] hover:text-[#7C3AED] font-medium block text-center"
              >
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
