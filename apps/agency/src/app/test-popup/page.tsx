'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, Info, Sparkles, CheckCircle, XCircle, AlertCircle, InfoIcon } from 'lucide-react'

type PopupType = 'success' | 'error' | 'warning' | 'info'

// DESIGN 1: Floating Card (Original)
function FloatingCard({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: Check },
    error: { color: '#ef4444', bg: '#fef2f2', icon: X },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle },
    info: { color: '#3b82f6', bg: '#eff6ff', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        onClick={onClose}
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '16px',
          padding: '16px 20px',
          minWidth: '200px',
          maxWidth: '280px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
          animation: 'floatIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          cursor: 'pointer',
          border: `1px solid ${color}30`,
        }}
      >
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon style={{ width: '20px', height: '20px', color: color }} strokeWidth={2.5} />
        </div>

        <div>
          <h2 style={{ color: '#1f2937', fontSize: '14px', fontWeight: 600, margin: '0 0 2px 0' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes floatIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  )
}

// DESIGN 2: Compact Glass (Original)
function CompactGlass({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: Check },
    error: { color: '#ef4444', bg: '#fef2f2', icon: X },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle },
    info: { color: '#3b82f6', bg: '#eff6ff', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          minWidth: '260px',
          maxWidth: '320px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: bg,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ width: '26px', height: '26px', color: color }} strokeWidth={2.5} />
        </div>

        <h2 style={{ color: '#1f2937', fontSize: '17px', fontWeight: 600, margin: 0 }}>{title}</h2>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// DESIGN 3: Floating Card Purple (Purple themed)
function FloatingCardPurple({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
    error: { color: '#ef4444', bg: '#fef2f2', icon: XCircle },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertCircle },
    info: { color: '#7C3AED', bg: '#f5f3ff', icon: InfoIcon },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        onClick={onClose}
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '14px',
          padding: '14px 18px',
          minWidth: '220px',
          maxWidth: '300px',
          boxShadow: '0 16px 40px rgba(124, 58, 237, 0.15)',
          animation: 'floatIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          border: '1px solid rgba(124, 58, 237, 0.15)',
        }}
      >
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon style={{ width: '20px', height: '20px', color: color }} strokeWidth={2} />
        </div>

        <div>
          <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 2px 0' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.4 }}>{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes floatIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  )
}

// DESIGN 4: Glass Minimal (Smaller Glass version)
function GlassMinimal({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: Check },
    error: { color: '#ef4444', bg: '#fef2f2', icon: X },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertTriangle },
    info: { color: '#7C3AED', bg: '#f5f3ff', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '14px',
          padding: '20px',
          minWidth: '200px',
          maxWidth: '260px',
          boxShadow: '0 16px 32px rgba(0, 0, 0, 0.12)',
          animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: bg,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ width: '22px', height: '22px', color: color }} strokeWidth={2.5} />
        </div>

        <h2 style={{ color: '#1f2937', fontSize: '15px', fontWeight: 600, margin: 0 }}>{title}</h2>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>{message}</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// DESIGN 5: Floating Rounded (Rounded corners variant)
function FloatingRounded({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#10b981', icon: Check },
    error: { color: '#ef4444', bg: '#ef4444', icon: X },
    warning: { color: '#f59e0b', bg: '#f59e0b', icon: AlertTriangle },
    info: { color: '#7C3AED', bg: '#7C3AED', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        onClick={onClose}
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '20px',
          padding: '16px 20px',
          minWidth: '200px',
          maxWidth: '280px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18)',
          animation: 'floatIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon style={{ width: '20px', height: '20px', color: 'white' }} strokeWidth={2.5} />
        </div>

        <div>
          <h2 style={{ color: '#1f2937', fontSize: '14px', fontWeight: 600, margin: '0 0 2px 0' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes floatIn { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  )
}

// DESIGN 6: Glass with Icon Ring
function GlassIconRing({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', lightBg: '#ecfdf5', icon: CheckCircle },
    error: { color: '#ef4444', lightBg: '#fef2f2', icon: XCircle },
    warning: { color: '#f59e0b', lightBg: '#fffbeb', icon: AlertCircle },
    info: { color: '#7C3AED', lightBg: '#f5f3ff', icon: InfoIcon },
  }

  const { color, lightBg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '22px',
          minWidth: '220px',
          maxWidth: '280px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
          animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: lightBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 4px white, 0 0 0 6px ${color}30`,
        }}>
          <Icon style={{ width: '28px', height: '28px', color: color }} strokeWidth={2} />
        </div>

        <h2 style={{ color: '#1f2937', fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h2>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// DESIGN 7: Floating Purple + Close (MIXED - Your Choice!)
function FloatingPurpleClose({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#ecfdf5', icon: CheckCircle },
    error: { color: '#ef4444', bg: '#fef2f2', icon: XCircle },
    warning: { color: '#f59e0b', bg: '#fffbeb', icon: AlertCircle },
    info: { color: '#7C3AED', bg: '#f5f3ff', icon: InfoIcon },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '14px',
          padding: '14px 18px',
          minWidth: '240px',
          maxWidth: '320px',
          boxShadow: '0 16px 40px rgba(124, 58, 237, 0.15)',
          animation: 'floatIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: '1px solid rgba(124, 58, 237, 0.12)',
        }}
      >
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon style={{ width: '20px', height: '20px', color: color }} strokeWidth={2} />
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 2px 0' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.4 }}>{message}</p>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: '#f3f4f6',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
        >
          <X style={{ width: '14px', height: '14px', color: '#6b7280' }} />
        </button>
      </div>

      <style>{`
        @keyframes floatIn { from { opacity: 0; transform: scale(0.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  )
}

// DESIGN 8: Glass with Gradient Border
function GlassGradient({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)', icon: Check },
    error: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: X },
    warning: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: AlertTriangle },
    info: { color: '#7C3AED', gradient: 'linear-gradient(135deg, #7C3AED, #6D28D9)', icon: Info },
  }

  const { color, gradient, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: gradient,
          borderRadius: '16px',
          padding: '2px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          animation: 'popIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div style={{
          background: 'white',
          borderRadius: '14px',
          padding: '20px',
          minWidth: '200px',
          maxWidth: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon style={{ width: '24px', height: '24px', color: 'white' }} strokeWidth={2.5} />
          </div>

          <h2 style={{ color: '#1f2937', fontSize: '15px', fontWeight: 600, margin: 0 }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// DESIGN 9: Floating Slim
function FloatingSlim({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', icon: CheckCircle },
    error: { color: '#ef4444', icon: XCircle },
    warning: { color: '#f59e0b', icon: AlertCircle },
    info: { color: '#7C3AED', icon: InfoIcon },
  }

  const { color, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        onClick={onClose}
        style={{
          pointerEvents: 'auto',
          background: 'white',
          borderRadius: '12px',
          padding: '12px 18px',
          minWidth: '180px',
          maxWidth: '280px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.15)',
          animation: 'floatIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          borderLeft: `3px solid ${color}`,
        }}
      >
        <Icon style={{ width: '20px', height: '20px', color: color, flexShrink: 0 }} strokeWidth={2} />

        <div>
          <h2 style={{ color: '#1f2937', fontSize: '13px', fontWeight: 600, margin: '0 0 1px 0' }}>{title}</h2>
          <p style={{ color: '#6b7280', fontSize: '11px', margin: 0, lineHeight: 1.3 }}>{message}</p>
        </div>
      </div>

      <style>{`
        @keyframes floatIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  )
}

// DESIGN 10: Glass Soft
function GlassSoft({
  isOpen,
  type,
  title,
  message,
  onClose,
}: {
  isOpen: boolean
  type: PopupType
  title: string
  message: string
  onClose: () => void
}) {
  const config = {
    success: { color: '#10b981', bg: '#10b981', icon: Check },
    error: { color: '#ef4444', bg: '#ef4444', icon: X },
    warning: { color: '#f59e0b', bg: '#f59e0b', icon: AlertTriangle },
    info: { color: '#7C3AED', bg: '#7C3AED', icon: Info },
  }

  const { color, bg, icon: Icon } = config[type]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '28px',
          minWidth: '200px',
          maxWidth: '260px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.12)',
          animation: 'popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ width: '28px', height: '28px', color: 'white' }} strokeWidth={2.5} />
        </div>

        <h2 style={{ color: '#1f2937', fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h2>
        <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>{message}</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

export default function TestPopupPage() {
  const [activePopup, setActivePopup] = useState<{
    design: 'floating' | 'glass' | 'floatingPurple' | 'glassMinimal' | 'floatingRounded' | 'glassRing' | 'floatingPurpleClose' | 'glassGradient' | 'floatingSlim' | 'glassSoft'
    type: PopupType
  } | null>(null)

  const popupTypes: PopupType[] = ['success', 'error', 'warning', 'info']

  const floatingDesigns = [
    { id: 'floatingPurpleClose', name: '⭐ Floating Purple + Close (RECOMMENDED)', desc: 'Purple shadow + Circle icons + Close button', highlight: true },
    { id: 'floating', name: 'Floating Card (Original)', desc: 'No overlay, horizontal', highlight: false },
    { id: 'floatingPurple', name: 'Floating Purple', desc: 'Purple shadow, circle icons', highlight: false },
    { id: 'floatingRounded', name: 'Floating Rounded', desc: 'Solid icon circle', highlight: false },
    { id: 'floatingSlim', name: 'Floating Slim', desc: 'Left border accent', highlight: false },
  ] as const

  const glassDesigns = [
    { id: 'glass', name: 'Compact Glass (Original)', desc: 'Centered, with overlay' },
    { id: 'glassMinimal', name: 'Glass Minimal', desc: 'Smaller & cleaner' },
    { id: 'glassRing', name: 'Glass Icon Ring', desc: 'Icon with ring shadow' },
    { id: 'glassGradient', name: 'Glass Gradient', desc: 'Gradient border' },
    { id: 'glassSoft', name: 'Glass Soft', desc: 'Rounded icon, soft blur' },
  ] as const

  const messages = {
    success: { title: 'Success!', message: 'Changes saved successfully.' },
    error: { title: 'Error!', message: 'Something went wrong.' },
    warning: { title: 'Warning!', message: 'Please review changes.' },
    info: { title: 'Info', message: 'Here is some info.' },
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '32px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Sparkles style={{ width: '24px', height: '24px', color: '#7C3AED' }} />
            Popup Designs
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Floating Card & Compact Glass variations</p>
        </div>

        {/* Floating Card Variations */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#7C3AED', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e9d5ff' }}>
            🎈 Floating Card Style (No Overlay)
          </h3>

          {floatingDesigns.map((design) => (
            <div key={design.id} style={{ marginBottom: '16px', padding: '14px', background: design.highlight ? 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)' : 'white', borderRadius: '12px', border: design.highlight ? '2px solid #7C3AED' : '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: design.highlight ? '#7C3AED' : '#374151', margin: 0 }}>{design.name}</h4>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>{design.desc}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {popupTypes.map((type) => (
                  <button
                    key={`${design.id}-${type}`}
                    onClick={() => setActivePopup({ design: design.id, type })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#7C3AED',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Glass Variations */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#7C3AED', marginBottom: '16px', paddingBottom: '8px', borderBottom: '2px solid #e9d5ff' }}>
            🪟 Compact Glass Style (With Overlay)
          </h3>

          {glassDesigns.map((design) => (
            <div key={design.id} style={{ marginBottom: '16px', padding: '14px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: 0 }}>{design.name}</h4>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>{design.desc}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {popupTypes.map((type) => (
                  <button
                    key={`${design.id}-${type}`}
                    onClick={() => setActivePopup({ design: design.id, type })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#7C3AED',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Popup Renderers */}
      {activePopup?.design === 'floating' && (
        <FloatingCard isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'glass' && (
        <CompactGlass isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'floatingPurple' && (
        <FloatingCardPurple isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'glassMinimal' && (
        <GlassMinimal isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'floatingRounded' && (
        <FloatingRounded isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'glassRing' && (
        <GlassIconRing isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'floatingPurpleClose' && (
        <FloatingPurpleClose isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'glassGradient' && (
        <GlassGradient isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'floatingSlim' && (
        <FloatingSlim isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
      {activePopup?.design === 'glassSoft' && (
        <GlassSoft isOpen={true} type={activePopup.type} title={messages[activePopup.type].title} message={messages[activePopup.type].message} onClose={() => setActivePopup(null)} />
      )}
    </div>
  )
}
