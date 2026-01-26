'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useDomainStore } from '@/store/domain'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { isCustomDomain, branding } = useDomainStore()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { token, user } = await authApi.login({ email, password })
        if (user.role !== 'USER') {
          setError('Access denied. User account required.')
          setLoading(false)
          return
        }
        setAuth(user, token)
      } else {
        const { token, user } = await authApi.register({ email, password, username })
        setAuth(user, token)
      }
      router.push('/dashboard')
    } catch (err: any) {
      // Check if this is a blocked account error
      if (err.response?.data?.blocked) {
        setError(err.response.data.message || 'Your account has been blocked by the administrator. Please contact the main headquarters for assistance.')
      } else {
        setError(err.message || (isLogin ? 'Login failed' : 'Registration failed'))
      }
    } finally {
      setLoading(false)
    }
  }

  // Use custom domain branding if available
  const displayBrandName = isCustomDomain && branding?.brandName
    ? branding.brandName
    : 'COINEST'
  const displayBrandLogo = isCustomDomain && branding?.brandLogo
    ? branding.brandLogo
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-8">
          {/* Logo - Show custom domain branding if available */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {displayBrandLogo ? (
              <img
                src={displayBrandLogo}
                alt={displayBrandName}
                className="h-10 max-w-[200px] object-contain"
              />
            ) : (
              <>
                <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">6</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{displayBrandName}</span>
              </>
            )}
          </div>

          <h1 className="text-xl font-semibold text-center mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-gray-500 text-center mb-6">
            {isLogin ? 'Sign in to your account' : 'Get started with your ad accounts'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!isLogin && (
              <Input
                label="Username"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
              />
            )}

            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" isLoading={loading}>
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary-500 hover:text-primary-600 font-medium"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
