'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Smartphone, Wallet, CreditCard, Bell, Shield } from 'lucide-react'
import { notificationsApi } from '@/lib/api'

const STORAGE_KEY = '6ad_mobile_launch_seen'

export function MobileLaunchPopup() {
  const [show, setShow] = useState(false)
  const notifSent = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) {
      // Small delay so page loads first
      const timer = setTimeout(() => {
        setShow(true)
        // Create notification so it shows in bell icon
        if (!notifSent.current) {
          notifSent.current = true
          notificationsApi.createSelf({
            key: 'mobile_launch_v1',
            title: 'Mobile View is Here!',
            message: 'You can now manage deposits, recharge ad accounts, get real-time alerts, and request BM access right from your phone.',
            link: '/dashboard'
          }).catch(() => {})
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
  }

  if (!show) return null

  const features = [
    { icon: Wallet, label: 'Add Money', desc: 'Deposit to wallet instantly' },
    { icon: CreditCard, label: 'Recharge', desc: 'Fund ad accounts on the go' },
    { icon: Bell, label: 'Real-time Alerts', desc: 'Get notified on approvals' },
    { icon: Shield, label: 'BM Share', desc: 'Request access from mobile' },
  ]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center lg:items-center items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" style={{ animation: 'mlFadeIn 0.3s ease both' }} onClick={handleClose} />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl lg:rounded-2xl overflow-hidden mx-4 lg:mx-auto" style={{ animation: 'mlSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
        {/* Drag Handle - mobile only */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 p-1.5 bg-gray-100 rounded-full z-10">
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Hero */}
        <div className="px-6 pt-3 pb-5 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#52B788] to-[#3D9970] flex items-center justify-center" style={{ animation: 'mlPop 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#1E293B]">Mobile View is Here!</h2>
          <p className="text-sm text-gray-400 mt-1">Manage everything right from your phone</p>
        </div>

        {/* Features Grid */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-2.5">
          {features.map((f, i) => (
            <div
              key={f.label}
              className="bg-gray-50 rounded-xl p-3 flex items-center gap-2.5"
              style={{ animation: `mlFadeIn 0.4s ease ${0.3 + i * 0.08}s both` }}
            >
              <div className="w-9 h-9 rounded-lg bg-[#52B788]/10 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-4 h-4 text-[#52B788]" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-[#1E293B] leading-tight">{f.label}</p>
                <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-6">
          <button
            onClick={handleClose}
            className="w-full py-3 bg-gradient-to-r from-[#52B788] to-[#3D9970] text-white font-semibold text-sm rounded-xl active:scale-[0.98] transition-transform"
          >
            Let's Go!
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes mlSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes mlFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes mlPop {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
