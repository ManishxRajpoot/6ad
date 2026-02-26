import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type User = {
  id: string
  email: string
  username: string
  role: 'ADMIN' | 'AGENT' | 'USER'
  status: string
  realName?: string
  phone?: string
  phone2?: string
  profileImage?: string
  emailVerified?: boolean
  twoFactorEnabled?: boolean
}

type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  setAuth: (user: User, token: string) => void
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
      updateUser: (userData) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } as User : null
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
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // token is stored separately in localStorage['token'] — not duplicated here
      }),
      onRehydrateStorage: () => (state) => {
        // Restore token from the single source of truth
        if (state && typeof window !== 'undefined') {
          const token = localStorage.getItem('token')
          if (token) {
            state.token = token
          } else {
            // No token → clear auth state
            state.user = null
            state.isAuthenticated = false
            state.token = null
          }
        }
        state?.setHydrated(true)
      },
    }
  )
)
