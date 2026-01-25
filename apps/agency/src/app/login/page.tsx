'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { token, user } = await authApi.login({ email, password })

      if (user.role !== 'AGENT') {
        setError('Access denied. Agent account required.')
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-card p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-xl">6</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">COINEST</span>
          </div>

          <h1 className="text-xl font-semibold text-center mb-2">Agent Login</h1>
          <p className="text-gray-500 text-center mb-6">Sign in to your agency account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              type="email"
              label="Email"
              placeholder="agent@example.com"
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
              Sign In
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Contact admin for account access
          </p>
        </div>
      </div>
    </div>
  )
}
