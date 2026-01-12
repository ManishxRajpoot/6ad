import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type User = {
  id: string
  email: string
  username: string
  role: 'ADMIN' | 'AGENT' | 'USER'
  status: string
}

type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrated: boolean
  setAuth: (user: User, token: string) => void
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
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
