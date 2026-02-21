'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Need a small delay so browser renders the initial state first
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
      document.body.style.overflow = 'hidden'
      return () => cancelAnimationFrame(raf)
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
      }, 400)
      document.body.style.overflow = 'unset'
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  if (!isVisible) return null

  return (
    <>
      <style jsx>{`
        .modal-backdrop {
          transition: opacity 0.3s ease;
        }
        .modal-sheet {
          transition: transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
        }
        @media (min-width: 1024px) {
          .modal-sheet {
            transition: transform 0.25s ease, opacity 0.25s ease, scale 0.25s ease;
          }
        }
      `}</style>
      <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center">
        {/* Backdrop */}
        <div
          className="modal-backdrop absolute inset-0 bg-black/50"
          style={{ opacity: isAnimating ? 1 : 0 }}
          onClick={onClose}
        />

        {/* Modal / Bottom Sheet */}
        <div
          className={cn(
            'modal-sheet relative bg-white shadow-2xl w-full',
            // Mobile
            'rounded-t-[28px] max-h-[88vh] overflow-hidden flex flex-col',
            // Desktop
            'lg:rounded-2xl lg:max-w-md lg:mx-4 lg:max-h-[90vh]',
            className
          )}
          style={{
            transform: isAnimating
              ? 'translateY(0) scale(1)'
              : (typeof window !== 'undefined' && window.innerWidth >= 1024
                  ? 'translateY(16px) scale(0.95)'
                  : 'translateY(100%)'),
            opacity: isAnimating ? 1 : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 0 : 1),
          }}
        >
          {/* Mobile drag handle */}
          <div className="lg:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-9 h-[5px] rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-2 pb-2 lg:p-5 lg:border-b lg:border-gray-100 lg:bg-gradient-to-r lg:from-white lg:to-gray-50/50 flex-shrink-0">
            <h2 className="text-[17px] font-bold text-[#1E293B] lg:text-lg lg:font-semibold lg:text-gray-800">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 lg:hover:rotate-90"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-10 lg:p-5" style={{ WebkitOverflowScrolling: 'touch' as any }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
