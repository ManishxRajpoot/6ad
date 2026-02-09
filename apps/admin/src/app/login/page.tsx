'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { token, user } = await authApi.login({ ...formData, rememberMe })

      if (user.role !== 'ADMIN') {
        setError('Access denied. Admin only.')
        setLoading(false)
        return
      }

      setAuth(user, token)
      router.push('/dashboard')
    } catch (err: any) {
      // Check if this is a blocked account error
      if (err.response?.data?.blocked) {
        setError(err.response.data.message || 'Your account has been blocked by the administrator. Please contact the main headquarters for assistance.')
      } else {
        setError(err.message || 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
          {/* Logo */}
          <div className="mb-6 sm:mb-8 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2 sm:gap-3">
              {/* Six Media - Twisted Ribbon Infinity (Meta-style) */}
              <svg viewBox="0 0 48 28" className="w-12 sm:w-16 h-7 sm:h-9" fill="none">
                <defs>
                  <linearGradient id="adminLoginRibbon1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366F1"/>
                    <stop offset="100%" stopColor="#8B5CF6"/>
                  </linearGradient>
                  <linearGradient id="adminLoginRibbon2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8B5CF6"/>
                    <stop offset="100%" stopColor="#EC4899"/>
                  </linearGradient>
                </defs>
                {/* Left ribbon - continuous twisted band */}
                <path
                  d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14"
                  fill="url(#adminLoginRibbon1)"
                />
                {/* Right ribbon - continuous twisted band */}
                <path
                  d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14"
                  fill="url(#adminLoginRibbon2)"
                />
                {/* Center twist overlay for depth */}
                <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
              </svg>
              {/* Text - Modern Typography */}
              <div className="flex flex-col leading-none text-left">
                <span className="text-[18px] sm:text-[24px] font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight">
                  SIXMEDIA
                </span>
                <span className="text-[8px] sm:text-[10px] font-semibold tracking-[0.25em] text-gray-400 mt-0.5">
                  ADMIN PANEL
                </span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4 sm:mt-6">Welcome Back</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500">Sign in to your admin account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs sm:text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            {/* Remember this device */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-[15px] h-[15px] rounded border-[1.5px] border-gray-300 peer-checked:border-purple-600 peer-checked:bg-purple-600 transition-all duration-200 flex items-center justify-center group-hover:border-purple-400">
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500">Remember this device for 72 hours</span>
            </label>

            <Button type="submit" loading={loading} className="w-full py-3 sm:py-3.5">
              Sign In
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-[10px] sm:text-xs text-gray-400 mt-4 sm:mt-6">
            Admin access only. Contact support for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
