'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, Info, Sparkles } from 'lucide-react'

type PopupType = 'success' | 'error' | 'warning' | 'info'

// NEW MODERN POPUP COMPONENT - TEST VERSION
function ModernPopup({
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
    success: {
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      bgGlow: 'rgba(16, 185, 129, 0.15)',
      icon: Check,
      iconBg: 'rgba(255,255,255,0.2)',
    },
    error: {
      gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      bgGlow: 'rgba(239, 68, 68, 0.15)',
      icon: X,
      iconBg: 'rgba(255,255,255,0.2)',
    },
    warning: {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      bgGlow: 'rgba(245, 158, 11, 0.15)',
      icon: AlertTriangle,
      iconBg: 'rgba(255,255,255,0.2)',
    },
    info: {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      bgGlow: 'rgba(59, 130, 246, 0.15)',
      icon: Info,
      iconBg: 'rgba(255,255,255,0.2)',
    },
  }

  const { gradient, bgGlow, icon: Icon, iconBg } = config[type]

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
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: gradient,
          borderRadius: '24px',
          padding: '32px 40px',
          minWidth: '320px',
          maxWidth: '400px',
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 80px ${bgGlow}`,
          animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }} />

        {/* Icon */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}
        >
          <Icon style={{ width: '36px', height: '36px', color: 'white' }} strokeWidth={2.5} />
        </div>

        {/* Title */}
        <h2
          style={{
            color: 'white',
            fontSize: '22px',
            fontWeight: 700,
            margin: 0,
            textAlign: 'center',
            animation: 'slideUp 0.3s ease-out 0.15s both',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: '280px',
            animation: 'slideUp 0.3s ease-out 0.2s both',
          }}
        >
          {message}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: '8px',
            padding: '12px 32px',
            borderRadius: '12px',
            border: 'none',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            animation: 'slideUp 0.3s ease-out 0.25s both',
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          Got it
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes bounceIn {
          from {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.1);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// ALTERNATIVE DESIGN - Glass morphism style
function GlassPopup({
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
    success: { color: '#10b981', lightColor: '#d1fae5', icon: Check },
    error: { color: '#ef4444', lightColor: '#fee2e2', icon: X },
    warning: { color: '#f59e0b', lightColor: '#fef3c7', icon: AlertTriangle },
    info: { color: '#3b82f6', lightColor: '#dbeafe', icon: Info },
  }

  const { color, lightColor, icon: Icon } = config[type]

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
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '28px',
          padding: '36px 44px',
          minWidth: '340px',
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          animation: 'popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          position: 'relative',
        }}
      >
        {/* Colored top bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60px',
          height: '4px',
          borderRadius: '0 0 4px 4px',
          background: color,
        }} />

        {/* Icon with ring */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: lightColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
            border: `3px solid ${color}`,
          }}
        >
          <Icon style={{ width: '40px', height: '40px', color: color }} strokeWidth={2.5} />
        </div>

        {/* Title */}
        <h2
          style={{
            color: '#1f2937',
            fontSize: '24px',
            fontWeight: 700,
            margin: 0,
            textAlign: 'center',
            animation: 'slideUp 0.3s ease-out 0.15s both',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            color: '#6b7280',
            fontSize: '15px',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.7,
            maxWidth: '300px',
            animation: 'slideUp 0.3s ease-out 0.2s both',
          }}
        >
          {message}
        </p>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: '4px',
            padding: '14px 40px',
            borderRadius: '14px',
            border: 'none',
            background: color,
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            animation: 'slideUp 0.3s ease-out 0.25s both',
            boxShadow: `0 4px 14px ${color}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)'
            e.currentTarget.style.boxShadow = `0 6px 20px ${color}50`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = `0 4px 14px ${color}40`
          }}
        >
          Continue
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes bounceIn {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          60% {
            transform: scale(1.1);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

// MINIMAL DESIGN - Clean and simple
function MinimalPopup({
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
    success: { color: '#10b981', icon: Check },
    error: { color: '#ef4444', icon: X },
    warning: { color: '#f59e0b', icon: AlertTriangle },
    info: { color: '#3b82f6', icon: Info },
  }

  const { color, icon: Icon } = config[type]

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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          minWidth: '300px',
          maxWidth: '380px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon style={{ width: '32px', height: '32px', color: color }} strokeWidth={2} />
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#111827', fontSize: '20px', fontWeight: 600, margin: '0 0 8px 0' }}>
            {title}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            background: color,
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          OK
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}

export default function TestPopupPage() {
  const [activePopup, setActivePopup] = useState<{
    design: 'modern' | 'glass' | 'minimal'
    type: PopupType
  } | null>(null)

  const popupTypes: PopupType[] = ['success', 'error', 'warning', 'info']
  const designs = ['modern', 'glass', 'minimal'] as const

  const messages = {
    success: { title: 'Success!', message: 'Your changes have been saved successfully.' },
    error: { title: 'Error!', message: 'Something went wrong. Please try again.' },
    warning: { title: 'Warning!', message: 'Please review your changes before continuing.' },
    info: { title: 'Information', message: 'Here is some helpful information for you.' },
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)',
      padding: '40px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <Sparkles style={{ width: '32px', height: '32px', color: '#7C3AED' }} />
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
              Popup Design Test
            </h1>
          </div>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            Click any button to preview the popup design
          </p>
        </div>

        {designs.map((design) => (
          <div key={design} style={{ marginBottom: '48px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '20px',
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: design === 'modern' ? '#7C3AED' : design === 'glass' ? '#3b82f6' : '#10b981',
              }} />
              {design} Design
            </h2>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {popupTypes.map((type) => (
                <button
                  key={`${design}-${type}`}
                  onClick={() => setActivePopup({ design, type })}
                  style={{
                    padding: '16px 32px',
                    borderRadius: '12px',
                    border: 'none',
                    background: type === 'success' ? '#10b981' :
                               type === 'error' ? '#ef4444' :
                               type === 'warning' ? '#f59e0b' : '#3b82f6',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textTransform: 'capitalize',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Current Design for comparison */}
        <div style={{
          marginTop: '60px',
          padding: '24px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            💡 Which design do you prefer?
          </h3>
          <ul style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.8, margin: 0, paddingLeft: '20px' }}>
            <li><strong>Modern:</strong> Gradient background with decorative elements - Bold & Eye-catching</li>
            <li><strong>Glass:</strong> Glass morphism with colored accents - Clean & Professional</li>
            <li><strong>Minimal:</strong> Simple white card with colored icon - Fast & Lightweight</li>
          </ul>
        </div>
      </div>

      {/* Render popups */}
      {activePopup?.design === 'modern' && (
        <ModernPopup
          isOpen={true}
          type={activePopup.type}
          title={messages[activePopup.type].title}
          message={messages[activePopup.type].message}
          onClose={() => setActivePopup(null)}
        />
      )}
      {activePopup?.design === 'glass' && (
        <GlassPopup
          isOpen={true}
          type={activePopup.type}
          title={messages[activePopup.type].title}
          message={messages[activePopup.type].message}
          onClose={() => setActivePopup(null)}
        />
      )}
      {activePopup?.design === 'minimal' && (
        <MinimalPopup
          isOpen={true}
          type={activePopup.type}
          title={messages[activePopup.type].title}
          message={messages[activePopup.type].message}
          onClose={() => setActivePopup(null)}
        />
      )}
    </div>
  )
}
