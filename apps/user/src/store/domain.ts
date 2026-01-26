import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type DomainBranding = {
  brandName: string | null
  brandLogo: string | null
  agentId: string
}

type DomainState = {
  isCustomDomain: boolean
  domain: string | null
  branding: DomainBranding | null
  isLoading: boolean
  isChecked: boolean
  setDomainInfo: (isCustom: boolean, domain: string | null, branding: DomainBranding | null) => void
  setLoading: (loading: boolean) => void
  setChecked: (checked: boolean) => void
  reset: () => void
}

export const useDomainStore = create<DomainState>()(
  persist(
    (set) => ({
      isCustomDomain: false,
      domain: null,
      branding: null,
      isLoading: false,
      isChecked: false,
      setDomainInfo: (isCustomDomain, domain, branding) =>
        set({ isCustomDomain, domain, branding }),
      setLoading: (isLoading) => set({ isLoading }),
      setChecked: (isChecked) => set({ isChecked }),
      reset: () =>
        set({
          isCustomDomain: false,
          domain: null,
          branding: null,
          isLoading: false,
          isChecked: false,
        }),
    }),
    {
      name: 'domain-storage',
      partialize: (state) => ({
        isCustomDomain: state.isCustomDomain,
        domain: state.domain,
        branding: state.branding,
        isChecked: state.isChecked,
      }),
    }
  )
)
