'use client'

import { useEffect, useState } from 'react'
import { useDomainStore } from '@/store/domain'
import { domainsApi } from '@/lib/api'
import { TutorialOverlay } from '@/components/TutorialOverlay'

const DEFAULT_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'ads.6ad.in',
  '6ad.in',
  'ngrok-free.dev',
  'ngrok.io',
]

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const { setDomainInfo, setLoading, setChecked, isChecked, isLoading } = useDomainStore()
  const [isInvalidDomain, setIsInvalidDomain] = useState(false)
  const [invalidHostname, setInvalidHostname] = useState('')
  const [isInitializing, setIsInitializing] = useState(true)
  const [networkError, setNetworkError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const checkCustomDomain = async () => {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

      // Check if it's a default domain
      const isDefaultDomain = DEFAULT_DOMAINS.some(d => hostname.includes(d))

      if (isDefaultDomain) {
        setDomainInfo(false, null, null)
        setChecked(true)
        setIsInitializing(false)
        return
      }

      // Skip API call if already checked in this session for same domain
      // But always re-check if the domain changed
      if (isChecked && useDomainStore.getState().domain === hostname) {
        setIsInitializing(false)
        return
      }

      // It's potentially a custom domain, check with API
      setLoading(true)
      try {
        const result = await domainsApi.checkDomain(hostname)

        if (result.valid && result.agentId) {
          // Only set branding if logo exists (approved domain with logo)
          setDomainInfo(true, hostname, {
            brandLogo: result.branding?.brandLogo || null,
            brandName: result.branding?.brandName || null,
            agentId: result.agentId,
          })
        } else {
          // Custom domain is not approved - block access
          setInvalidHostname(hostname)
          setIsInvalidDomain(true)
          setDomainInfo(false, null, null)
        }
      } catch (error) {
        console.error('Failed to check custom domain:', error)
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
          setNetworkError(true)
          setErrorMessage('Unable to connect to server. Please check your internet connection.')
        } else {
          // If API fails for a custom domain, block access
          setInvalidHostname(hostname)
          setIsInvalidDomain(true)
        }
        setDomainInfo(false, null, null)
      } finally {
        setLoading(false)
        setChecked(true)
        setIsInitializing(false)
      }
    }

    checkCustomDomain()
  }, [setDomainInfo, setLoading, setChecked])

  // Show loading screen while checking domain branding (prevents logo flash)
  if (isInitializing && !isChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          {/* Loading spinner */}
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #f3f4f6',
            borderTopColor: '#8b5cf6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
  }

  // Show network error page
  if (networkError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '32px',
          maxWidth: '500px',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: '#fef2f2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '12px',
          }}>Connection Error</h2>
          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            {errorMessage || 'Unable to connect to the server. Please check your internet connection and try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show 404 page for unapproved custom domains (using inline styles to avoid CSS dependency)
  if (isInvalidDomain) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '32px',
          maxWidth: '500px',
        }}>
          <h1 style={{
            fontSize: '120px',
            fontWeight: '800',
            color: '#e5e7eb',
            lineHeight: '1',
            marginBottom: '16px',
          }}>404</h1>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '12px',
          }}>Page Not Found</h2>
          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            lineHeight: '1.6',
          }}>
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      <TutorialOverlay />
    </>
  )
}
