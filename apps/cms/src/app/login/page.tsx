'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [formData, setFormData] = useState({ email: '', password: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...formData, rememberMe: true }),
      })

      const { token, user } = response
      if (!user || !token) {
        setError('Invalid login response.')
        setLoading(false)
        return
      }

      setAuth(user, token)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
          {/* Logo */}
          <div className="mb-6 sm:mb-8 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center gap-2 sm:gap-3">
              {/* ADS360 Logo - Blue triangle */}
              <svg viewBox="0 0 40 40" className="w-10 sm:w-14 h-10 sm:h-14" fill="none">
                <defs>
                  <linearGradient id="loginLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>
                </defs>
                <path d="M20 4L36 34H4L20 4Z" fill="url(#loginLogoGrad)" />
                <path d="M20 12L28 28H12L20 12Z" fill="white" opacity="0.2" />
              </svg>
              <div className="flex flex-col leading-none text-left">
                <span className="text-[18px] sm:text-[24px] font-bold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent tracking-tight">
                  ADS360
                </span>
                <span className="text-[8px] sm:text-[10px] font-semibold tracking-[0.25em] text-gray-400 mt-0.5">
                  CMS PANEL
                </span>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-4 sm:mt-6">Welcome Back</h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500">Sign in to your CMS account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs sm:text-sm text-red-600 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white outline-none transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white outline-none transition-all"
              />
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="w-[15px] h-[15px] rounded border-[1.5px] border-gray-300 peer-checked:border-blue-600 peer-checked:bg-blue-600 transition-all duration-200 flex items-center justify-center group-hover:border-blue-400">
                  {rememberMe && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500">Remember this device</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-sm hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
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
