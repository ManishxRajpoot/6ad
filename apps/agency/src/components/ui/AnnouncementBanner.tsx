'use client'

import { useState, useEffect } from 'react'
import { X, Megaphone, AlertTriangle, CheckCircle, Info, ChevronLeft, ChevronRight, Sparkles, Bell } from 'lucide-react'
import { announcementsApi } from '@/lib/api'

interface Announcement {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  isPinned: boolean
  showOnce: boolean
}

// Storage key for seen announcements
const SEEN_ANNOUNCEMENTS_KEY = '6ad_seen_announcements'

// Get seen announcements from localStorage
const getSeenAnnouncements = (): string[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SEEN_ANNOUNCEMENTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Mark announcement as seen in localStorage
const markAnnouncementAsSeen = (id: string) => {
  if (typeof window === 'undefined') return
  try {
    const seen = getSeenAnnouncements()
    if (!seen.includes(id)) {
      seen.push(id)
      localStorage.setItem(SEEN_ANNOUNCEMENTS_KEY, JSON.stringify(seen))
    }
  } catch {
    // Silently fail
  }
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const [seenOnce, setSeenOnce] = useState<string[]>([])

  useEffect(() => {
    // Load seen announcements from localStorage
    setSeenOnce(getSeenAnnouncements())
  }, [])

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await announcementsApi.getAll()
        setAnnouncements(res.announcements || [])
      } catch (error) {
        // Silently fail
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnnouncements()
    // Refresh every 5 minutes
    const interval = setInterval(fetchAnnouncements, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Filter out dismissed announcements and "show once" announcements that have been seen
  const visibleAnnouncements = announcements.filter(a => {
    // Skip if dismissed in current session
    if (dismissed.includes(a.id)) return false
    // Skip if "show once" and already seen
    if (a.showOnce && seenOnce.includes(a.id)) return false
    return true
  })

  // Auto-rotate announcements every 6 seconds
  useEffect(() => {
    if (visibleAnnouncements.length <= 1) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [visibleAnnouncements.length])

  if (isLoading || visibleAnnouncements.length === 0 || !isVisible) return null

  const current = visibleAnnouncements[currentIndex]
  if (!current) return null

  const typeConfig = {
    info: {
      gradient: 'from-[#8B5CF6] to-[#6D28D9]',
      icon: Info,
      iconBg: 'bg-[#8B5CF6]/10',
      iconColor: 'text-[#8B5CF6]',
      badge: 'bg-blue-100 text-blue-700'
    },
    warning: {
      gradient: 'from-amber-500 to-orange-500',
      icon: AlertTriangle,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      badge: 'bg-amber-100 text-amber-700'
    },
    success: {
      gradient: 'from-[#52B788] to-[#40A578]',
      icon: CheckCircle,
      iconBg: 'bg-[#52B788]/10',
      iconColor: 'text-[#52B788]',
      badge: 'bg-green-100 text-green-700'
    },
    error: {
      gradient: 'from-red-500 to-rose-500',
      icon: AlertTriangle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      badge: 'bg-red-100 text-red-700'
    }
  }

  const config = typeConfig[current.type] || typeConfig.info
  const Icon = config.icon

  const handleDismiss = () => {
    // Mark as seen if showOnce
    if (current.showOnce) {
      markAnnouncementAsSeen(current.id)
      setSeenOnce(prev => [...prev, current.id])
    }
    setDismissed(prev => [...prev, current.id])
    // Move to next announcement if available
    if (visibleAnnouncements.length > 1) {
      setCurrentIndex(prev => prev % (visibleAnnouncements.length - 1))
    }
  }

  const handleDismissAll = () => {
    // Mark all showOnce announcements as seen
    visibleAnnouncements.forEach(a => {
      if (a.showOnce) {
        markAnnouncementAsSeen(a.id)
      }
    })
    setIsVisible(false)
  }

  const handlePrev = () => {
    setCurrentIndex(prev =>
      prev === 0 ? visibleAnnouncements.length - 1 : prev - 1
    )
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % visibleAnnouncements.length)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Popup Modal */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header with gradient */}
        <div className={`bg-gradient-to-r ${config.gradient} px-6 py-5 relative`}>
          {/* Close button */}
          <button
            onClick={handleDismissAll}
            className="absolute top-4 right-4 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Announcement</h1>
              <p className="text-white/80 text-sm">Important message from admin</p>
            </div>
          </div>
        </div>

        {/* Navigation indicator for multiple announcements */}
        {visibleAnnouncements.length > 1 && (
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handlePrev}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex items-center gap-2">
                {visibleAnnouncements.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`transition-all duration-300 rounded-full ${
                      idx === currentIndex
                        ? 'w-8 h-2 bg-[#8B5CF6]'
                        : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>

              <span className="text-sm text-gray-500 ml-2">
                {currentIndex + 1} of {visibleAnnouncements.length}
              </span>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6">
          {/* Icon and badges */}
          <div className="text-center mb-6">
            <div className={`w-16 h-16 rounded-full ${config.iconBg} flex items-center justify-center mx-auto mb-4`}>
              <Icon className={`w-8 h-8 ${config.iconColor}`} />
            </div>

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {current.isPinned && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <Sparkles className="w-3 h-3" />
                  Pinned
                </span>
              )}
              <span className={`inline-flex items-center px-3 py-1 ${config.badge} rounded-full text-xs font-medium uppercase`}>
                {current.type}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {current.title}
            </h2>
          </div>

          {/* Message */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-gray-600 text-center leading-relaxed max-h-48 overflow-y-auto">
              {current.message}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-3">
            {!current.isPinned && visibleAnnouncements.length > 1 && (
              <button
                onClick={handleDismiss}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Skip This
              </button>
            )}
            <button
              onClick={handleDismissAll}
              className={`px-6 py-2.5 bg-gradient-to-r ${config.gradient} text-white font-medium rounded-lg hover:opacity-90 transition-opacity`}
            >
              Got It
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            {current.isPinned
              ? 'This is a pinned announcement and cannot be dismissed'
              : 'Click "Got It" to close this announcement'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
