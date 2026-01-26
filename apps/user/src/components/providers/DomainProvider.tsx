'use client'

import { useEffect } from 'react'
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
          setDomainInfo(false, null, null)
        }
      } catch (error) {
        console.error('Failed to check custom domain:', error)
        setDomainInfo(false, null, null)
      } finally {
        setLoading(false)
        setChecked(true)
      }
    }

    checkCustomDomain()
  }, [isChecked, setDomainInfo, setLoading, setChecked])

  return <>{children}</>
}
