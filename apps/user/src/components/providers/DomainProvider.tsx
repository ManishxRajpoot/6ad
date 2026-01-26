'use client'

import { useEffect, useState } from 'react'
import { useDomainStore } from '@/store/domain'
import { domainsApi } from '@/lib/api'

const DEFAULT_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'ads.6ad.in',
  '6ad.in',
]

export function DomainProvider({ children }: { children: React.ReactNode }) {
  const { setDomainInfo, setLoading, setChecked, isChecked } = useDomainStore()
  const [isInvalidDomain, setIsInvalidDomain] = useState(false)
  const [invalidHostname, setInvalidHostname] = useState('')

  useEffect(() => {
    const checkCustomDomain = async () => {
      // Skip if already checked in this session
      if (isChecked) return

      const hostname = typeof window !== 'undefined' ? window.location.hostname : ''

      // Check if it's a default domain
      const isDefaultDomain = DEFAULT_DOMAINS.some(d => hostname.includes(d))

      if (isDefaultDomain) {
        setDomainInfo(false, null, null)
        setChecked(true)
        return
      }

      // It's potentially a custom domain, check with API
      setLoading(true)
      try {
        const result = await domainsApi.checkDomain(hostname)

        if (result.valid && result.branding && result.agentId) {
          setDomainInfo(true, hostname, {
            brandName: result.branding.brandName,
            brandLogo: result.branding.brandLogo,
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
      }
    }

    checkCustomDomain()
  }, [isChecked, setDomainInfo, setLoading, setChecked])

  // Show error page for unapproved custom domains
  if (isInvalidDomain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Domain Not Configured</h1>
          <p className="text-gray-600 mb-4">
            The domain <strong>{invalidHostname}</strong> is not configured or not yet approved.
          </p>
          <p className="text-sm text-gray-500">
            If you are the domain owner, please contact your administrator to complete the domain verification and approval process.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
