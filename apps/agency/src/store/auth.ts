import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type User = {
  id: string
  email: string
  username: string
  role: 'ADMIN' | 'AGENT' | 'USER'
  status: string
  brandLogo?: string | null
  brandName?: string | null
  realName?: string | null
  phone?: string | null
  phone2?: string | null
  profileImage?: string | null
  emailVerified?: boolean
  twoFactorEnabled?: boolean
  couponBalance?: number
  walletBalance?: number | string
  // Platform fees
  fbFee?: number | string
  fbCommission?: number | string
  fbUnlimitedDomainFee?: number | string
  googleFee?: number | string
  googleCommission?: number | string
  tiktokFee?: number | string
  tiktokCommission?: number | string
  snapchatFee?: number | string
  snapchatCommission?: number | string
  bingFee?: number | string
  bingCommission?: number | string
}

type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  setAuth: (user: User, token: string) => void
  setUser: (user: User) => void
  updateUser: (user: Partial<User>) => void
  logout: () => void
  setHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        set({ user, token, isAuthenticated: true })
      },
      setUser: (user) => {
        set({ user })
      },
      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null
        }))
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null, isAuthenticated: false })
      },
      setHydrated: (state) => {
        set({ isHydrated: state })
      },
    }),
    {
      name: 'agency-auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
