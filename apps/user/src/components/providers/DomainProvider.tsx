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

  useEffect(() => {
    const checkCustomDomain = async () => {
      // Skip if already checked in this session
      if (isChecked) {
        setIsInitializing(false)
        return
      }

      const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

      // Check if it's a default domain
      const isDefaultDomain = DEFAULT_DOMAINS.some(d => hostname.includes(d))

      if (isDefaultDomain) {
        setDomainInfo(false, null, null)
        setChecked(true)
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
        // If API fails for a custom domain, block access
        setInvalidHostname(hostname)
        setIsInvalidDomain(true)
        setDomainInfo(false, null, null)
      } finally {
        setLoading(false)
        setChecked(true)
        setIsInitializing(false)
      }
    }

    checkCustomDomain()
  }, [isChecked, setDomainInfo, setLoading, setChecked])

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
