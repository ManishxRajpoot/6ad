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
              {/* ADS360 Logo - Radiant Pyramid */}
              <svg viewBox="0 0 40 40" className="w-10 sm:w-14 h-10 sm:h-14" fill="none">
                <defs>
                  <linearGradient id="loginLogoGrad" x1="0" y1="40" x2="40" y2="0">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#loginLogoGrad)" />
                <line x1="20" y1="2" x2="20" y2="9" stroke="white" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
                <line x1="12" y1="5" x2="15" y2="11" stroke="white" strokeWidth="0.8" strokeOpacity="0.2" strokeLinecap="round" />
                <line x1="28" y1="5" x2="25" y2="11" stroke="white" strokeWidth="0.8" strokeOpacity="0.2" strokeLinecap="round" />
                <path d="M20 10 L33 35 L20 28Z" fill="white" fillOpacity="0.9" strokeLinejoin="round" />
                <path d="M20 10 L7 35 L20 28Z" fill="white" fillOpacity="0.5" strokeLinejoin="round" />
                <path d="M20 28 L7 35 L33 35Z" fill="white" fillOpacity="0.2" strokeLinejoin="round" />
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
