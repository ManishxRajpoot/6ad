'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useDomainStore } from '@/store/domain'
import { Shield, ArrowLeft, Loader2 } from 'lucide-react'

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

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  const handleSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault()
    setError('')
    setLoading(true)

    const code = codeOverride || totpCode

    try {
      if (isLogin) {
        const response = await authApi.login({
          email,
          password,
          ...(requires2FA && code ? { totpCode: code } : {})
        })

        // Check if 2FA is required
        if (response.requires2FA) {
          setRequires2FA(true)
          setLoading(false)
          return
        }

        const { token, user } = response
        if (user.role !== 'USER') {
          setError('Access denied. User account required.')
          setLoading(false)
          return
        }
        setAuth(user, token)
        router.push('/dashboard')
      } else {
        const { token, user } = await authApi.register({ email, password, username })
        setAuth(user, token)
        router.push('/dashboard')
      }
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

  const handleBack = () => {
    setRequires2FA(false)
    setTotpCode('')
    setError('')
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

          {/* 2FA Verification View */}
          {requires2FA ? (
            <>
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </button>

              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-[#52B788]" />
                </div>
              </div>

              <h1 className="text-xl font-semibold text-center mb-2">
                Two-Factor Authentication
              </h1>
              <p className="text-gray-500 text-center mb-6">
                Enter the 6-digit code from your authenticator app
              </p>

              <div className="space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <input
                        key={index}
                        type="text"
                        maxLength={1}
                        value={totpCode[index] || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '')
                          if (val) {
                            const newCode = totpCode.split('')
                            newCode[index] = val
                            const finalCode = newCode.join('').slice(0, 6)
                            setTotpCode(finalCode)
                            if (index < 5 && val) {
                              const next = e.target.nextElementSibling as HTMLInputElement
                              next?.focus()
                            }
                            // Auto-submit when 6 digits entered
                            if (finalCode.length === 6) {
                              setTimeout(() => handleSubmit(undefined, finalCode), 100)
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
                            const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                            prev?.focus()
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault()
                          const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                          setTotpCode(paste)
                          if (paste.length === 6) {
                            setTimeout(() => handleSubmit(undefined, paste), 100)
                          }
                        }}
                        className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#52B788] focus:bg-white transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-[#52B788]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Verifying...</span>
                  </div>
                )}
              </div>

              <p className="mt-6 text-center text-xs text-gray-400">
                Open your authenticator app to get the code
              </p>
            </>
          ) : (
            <>
              {/* Regular Login/Register View */}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
