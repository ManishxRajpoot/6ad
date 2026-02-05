'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Shield, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, Building2, TrendingUp, Users, BarChart3, CheckCircle2, Ban, Briefcase, Zap, Check, Copy, Smartphone, KeyRound, Camera, User } from 'lucide-react'

type SecurityStep = 'login' | 'email' | '2fa-setup' | '2fa-verify' | '2fa-login' | 'profile-picture' | 'blocked'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth, updateUser } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Security setup wizard state
  const [securityStep, setSecurityStep] = useState<SecurityStep>('login')
  const [tempUser, setTempUser] = useState<any>(null)
  const [tempToken, setTempToken] = useState<string>('')

  // Email verification state
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)

  // 2FA state
  const [totpCode, setTotpCode] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Profile picture state
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Animation state
  const [animationClass, setAnimationClass] = useState('')
  const [displayStep, setDisplayStep] = useState<SecurityStep>('login')
  const prevStepRef = useRef<SecurityStep>('login')

  // Handle step change animations
  useEffect(() => {
    if (prevStepRef.current !== securityStep) {
      setAnimationClass('animate-flip-out')

      const timer = setTimeout(() => {
        setDisplayStep(securityStep)
        prevStepRef.current = securityStep
        setAnimationClass('animate-flip-in')

        setTimeout(() => {
          setAnimationClass('')
        }, 500)
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [securityStep])

  const handleSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault()
    setError('')
    setLoading(true)

    const code = codeOverride || totpCode

    try {
      const response = await api.post<any>('/auth/login', {
        email,
        password,
        ...(securityStep === '2fa-login' && code ? { totpCode: code } : {})
      })

      // Check if 2FA is required for existing user login
      if (response?.requires2FA) {
        setSecurityStep('2fa-login')
        setLoading(false)
        return
      }

      const { token, user } = response || {}

      if (!user || !token) {
        setError('Invalid email/username or password')
        setLoading(false)
        return
      }

      if (user.role !== 'AGENT') {
        setError('Access denied. Agent account required.')
        setLoading(false)
        return
      }

      // Check if user needs security setup
      if (!user.emailVerified || !user.twoFactorEnabled) {
        // Store temp credentials and start security wizard
        setTempUser(user)
        setTempToken(token)
        setAuth(user, token) // Set auth for API calls

        if (!user.emailVerified) {
          setSecurityStep('email')
        } else if (!user.twoFactorEnabled) {
          setSecurityStep('2fa-setup')
        }
        setLoading(false)
        return
      }

      // All security setup complete, proceed to dashboard
      setAuth(user, token)
      router.push('/dashboard')
    } catch (err: any) {
      if (err.response?.data?.blocked) {
        setSecurityStep('blocked')
      } else {
        // Get error message from API response or fall back to err.message
        const errorMessage = err.response?.data?.error || err.message || 'Login failed'
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (securityStep === '2fa-login') {
      setSecurityStep('login')
      setTotpCode('')
      setError('')
    }
  }

  // Email verification handlers
  const handleSendEmailCode = async () => {
    setSendingCode(true)
    setError('')
    try {
      await authApi.email.sendCode()
      setEmailCodeSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyEmail = async (code?: string) => {
    const verifyCode = code || emailCode
    if (verifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authApi.email.verify(verifyCode)
      const { user: updatedUser } = await authApi.me()
      setTempUser(updatedUser)
      updateUser(updatedUser)

      // Move to 2FA setup if not enabled
      if (!updatedUser.twoFactorEnabled) {
        setSecurityStep('2fa-setup')
      } else {
        // Move to profile picture setup
        setSecurityStep('profile-picture')
      }
      setEmailCode('')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  // 2FA setup handlers
  const handleSetup2FA = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await authApi.twoFactor.setup()
      setSecretKey(response.secret)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(response.otpauthUrl)}`
      setQrCodeUrl(qrUrl)
      setSecurityStep('2fa-verify')
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FASetup = async (code?: string) => {
    const verifyCode = code || totpCode
    if (verifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authApi.twoFactor.verify(verifyCode)
      const { user: updatedUser } = await authApi.me()
      setTempUser(updatedUser)
      updateUser(updatedUser)
      // Move to profile picture setup
      setSecurityStep('profile-picture')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secretKey)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  // Profile picture handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setProfileImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUploadImage = async () => {
    if (!profileImage) return

    setUploadingImage(true)
    setError('')
    try {
      await api.patch('/settings/profile/avatar', { profileImage })
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      // All done, go to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to upload profile picture')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSkipProfilePicture = () => {
    router.push('/dashboard')
  }

  // Six Media Modern Logo Component
  const SixMediaLogo = ({ size = 'normal' }: { size?: 'normal' | 'small' }) => {
    const iconW = size === 'small' ? 'w-12' : 'w-16'
    const iconH = size === 'small' ? 'h-7' : 'h-9'
    const textSize = size === 'small' ? 'text-[18px]' : 'text-[24px]'
    const tagSize = size === 'small' ? 'text-[8px]' : 'text-[10px]'
    const id1 = size === 'small' ? 'loginRibbonSm1' : 'loginRibbonLg1'
    const id2 = size === 'small' ? 'loginRibbonSm2' : 'loginRibbonLg2'

    return (
      <div className={`flex items-center ${size === 'small' ? 'gap-2.5' : 'gap-3'}`}>
        {/* Six Media - Twisted Ribbon Infinity (Meta-style) */}
        <svg viewBox="0 0 48 28" className={`${iconW} ${iconH}`} fill="none">
          <defs>
            <linearGradient id={id1} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366F1"/>
              <stop offset="100%" stopColor="#8B5CF6"/>
            </linearGradient>
            <linearGradient id={id2} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6"/>
              <stop offset="100%" stopColor="#EC4899"/>
            </linearGradient>
          </defs>
          {/* Left ribbon - continuous twisted band */}
          <path
            d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14"
            fill={`url(#${id1})`}
          />
          {/* Right ribbon - continuous twisted band */}
          <path
            d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14"
            fill={`url(#${id2})`}
          />
          {/* Center twist overlay for depth */}
          <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
        </svg>
        {/* Text - Modern Typography */}
        <div className="flex flex-col leading-none">
          <span className={`${textSize} font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent tracking-tight`}>
            SIXMEDIA
          </span>
          <span className={`${tagSize} font-semibold tracking-[0.25em] text-gray-400 mt-0.5`}>
            ADVERTISING
          </span>
        </div>
      </div>
    )
  }

  // Render right side content based on step
  const renderRightContent = () => {
    // Blocked Account Screen
    if (displayStep === 'blocked') {
      return (
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <Ban className="w-10 h-10 text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Blocked</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Your agency account has been blocked. Please contact the administrator for assistance.
              </p>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-red-700 text-sm">
                  <strong>Why was my account blocked?</strong>
                </p>
                <ul className="text-red-600 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Violation of terms of service</li>
                  <li>Suspicious activity detected</li>
                  <li>Payment or compliance issues</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setSecurityStep('login')
                  setEmail('')
                  setPassword('')
                  setError('')
                }}
                className="w-full py-3.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to Login
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Need help? Contact administrator for support.
          </p>
        </div>
      )
    }

    // Security Setup Wizard Steps
    if (displayStep === 'email' || displayStep === '2fa-setup' || displayStep === '2fa-verify' || displayStep === 'profile-picture') {
      return (
        <div className="w-full max-w-[480px]">
          {/* Wizard Card */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Security Setup Required</h1>
                  <p className="text-white/80 text-sm">Complete these steps to secure your account</p>
                </div>
              </div>
            </div>

            {/* Progress Steps */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-center gap-2">
                {/* Step 1 - Email */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    tempUser?.emailVerified
                      ? 'bg-emerald-500 text-white'
                      : displayStep === 'email'
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tempUser?.emailVerified ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${displayStep === 'email' || tempUser?.emailVerified ? 'text-gray-900' : 'text-gray-400'}`}>
                    Email
                  </span>
                </div>

                <div className={`w-8 h-0.5 ${tempUser?.emailVerified ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                {/* Step 2 - 2FA */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    tempUser?.twoFactorEnabled
                      ? 'bg-emerald-500 text-white'
                      : displayStep === '2fa-setup' || displayStep === '2fa-verify'
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tempUser?.twoFactorEnabled ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${displayStep === '2fa-setup' || displayStep === '2fa-verify' || tempUser?.twoFactorEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                    2FA
                  </span>
                </div>

                <div className={`w-8 h-0.5 ${tempUser?.twoFactorEnabled ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                {/* Step 3 - Display Picture */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    displayStep === 'profile-picture'
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${displayStep === 'profile-picture' ? 'text-gray-900' : 'text-gray-400'}`}>
                    DP
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {error && (
                <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                  {error}
                </div>
              )}

              {/* Email Verification Step */}
              {displayStep === 'email' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-teal-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    We'll send a verification code to <span className="font-medium text-gray-700">{tempUser?.email}</span>
                  </p>

                  {!emailCodeSent ? (
                    <button
                      onClick={handleSendEmailCode}
                      disabled={sendingCode}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-teal-500/25"
                    >
                      {sendingCode ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-5 h-5" />
                          Send Verification Code
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex gap-2 justify-center">
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <input
                            key={index}
                            type="text"
                            maxLength={1}
                            value={emailCode[index] || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '')
                              if (val) {
                                const newCode = emailCode.split('')
                                newCode[index] = val
                                const finalCode = newCode.join('').slice(0, 6)
                                setEmailCode(finalCode)
                                if (index < 5) {
                                  const next = e.target.nextElementSibling as HTMLInputElement
                                  next?.focus()
                                }
                                if (finalCode.length === 6) {
                                  setTimeout(() => handleVerifyEmail(finalCode), 100)
                                }
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' || e.key === 'Delete') {
                                e.preventDefault()
                                const newCode = emailCode.split('')
                                if (emailCode[index]) {
                                  newCode[index] = ''
                                  setEmailCode(newCode.join(''))
                                } else if (index > 0) {
                                  newCode[index - 1] = ''
                                  setEmailCode(newCode.join(''))
                                  const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                                  prev?.focus()
                                }
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault()
                              const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                              setEmailCode(paste)
                              if (paste.length === 6) {
                                setTimeout(() => handleVerifyEmail(paste), 100)
                              }
                            }}
                            className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>

                      {loading && (
                        <div className="flex items-center justify-center gap-2 text-teal-600">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-medium">Verifying...</span>
                        </div>
                      )}

                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingCode}
                        className="text-sm text-gray-500 hover:text-teal-600 transition-colors"
                      >
                        {sendingCode ? 'Sending...' : "Didn't receive code? Resend"}
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-6">
                    This security setup is mandatory and cannot be skipped
                  </p>
                </div>
              )}

              {/* 2FA Setup Step */}
              {displayStep === '2fa-setup' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-teal-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Setup Two-Factor Authentication</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Add an extra layer of security using an authenticator app
                  </p>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5 text-left">
                    <p className="text-amber-800 text-sm">
                      <strong>Required:</strong> Download Google Authenticator, Authy, or Microsoft Authenticator on your phone
                    </p>
                  </div>

                  <button
                    onClick={handleSetup2FA}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-teal-500/25"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-5 h-5" />
                        Generate QR Code
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-400 mt-6">
                    This security setup is mandatory and cannot be skipped
                  </p>
                </div>
              )}

              {/* 2FA Verify Step */}
              {displayStep === '2fa-verify' && (
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Scan QR Code</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    Scan with your authenticator app and enter the code
                  </p>

                  {qrCodeUrl && (
                    <div className="flex justify-center mb-4">
                      <div className="p-3 bg-white border border-gray-200 rounded-xl">
                        <img src={qrCodeUrl} alt="2FA QR Code" className="w-36 h-36" />
                      </div>
                    </div>
                  )}

                  {secretKey && (
                    <div className="mb-5">
                      <p className="text-xs text-gray-500 mb-1">Can't scan? Enter manually:</p>
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <code className="flex-1 text-xs font-mono text-gray-600 break-all">
                          {secretKey}
                        </code>
                        <button
                          onClick={copySecretKey}
                          className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          {copiedSecret ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 justify-center mb-4">
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
                            if (index < 5) {
                              const next = e.target.nextElementSibling as HTMLInputElement
                              next?.focus()
                            }
                            if (finalCode.length === 6) {
                              setTimeout(() => handleVerify2FASetup(finalCode), 100)
                            }
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' || e.key === 'Delete') {
                            e.preventDefault()
                            const newCode = totpCode.split('')
                            if (totpCode[index]) {
                              newCode[index] = ''
                              setTotpCode(newCode.join(''))
                            } else if (index > 0) {
                              newCode[index - 1] = ''
                              setTotpCode(newCode.join(''))
                              const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                              prev?.focus()
                            }
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault()
                          const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                          setTotpCode(paste)
                          if (paste.length === 6) {
                            setTimeout(() => handleVerify2FASetup(paste), 100)
                          }
                        }}
                        className="w-11 h-12 text-center text-lg font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 text-teal-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Verifying...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Display Picture Step */}
              {displayStep === 'profile-picture' && (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4 overflow-hidden border-4 border-teal-200">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-teal-600" />
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Set Display Picture</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Add a display picture (DP) for your agency account
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />

                  <div className="space-y-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors"
                    >
                      <Camera className="w-5 h-5" />
                      {profileImage ? 'Change DP' : 'Upload DP'}
                    </button>

                    {profileImage && (
                      <button
                        onClick={handleUploadImage}
                        disabled={uploadingImage}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-teal-500/25"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5" />
                            Save & Continue
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleSkipProfilePicture}
                      className="w-full py-3 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                    >
                      Skip for now
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mt-4">
                    You can always update this later in settings
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Protected by Two-Factor Authentication
          </p>
        </div>
      )
    }

    // 2FA Login (for returning users with 2FA enabled)
    if (displayStep === '2fa-login') {
      return (
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="px-6 pt-5">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to login
              </button>
            </div>

            <div className="p-6 pt-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-teal-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Enter the 6-digit code from your authenticator app
                </p>

                {error && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 justify-center mb-4">
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
                          if (index < 5) {
                            const next = e.target.nextElementSibling as HTMLInputElement
                            next?.focus()
                          }
                          if (finalCode.length === 6) {
                            setTimeout(() => handleSubmit(undefined, finalCode), 100)
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' || e.key === 'Delete') {
                          e.preventDefault()
                          const newCode = totpCode.split('')
                          if (totpCode[index]) {
                            newCode[index] = ''
                            setTotpCode(newCode.join(''))
                          } else if (index > 0) {
                            newCode[index - 1] = ''
                            setTotpCode(newCode.join(''))
                            const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                            prev?.focus()
                          }
                        }
                        if (e.key === 'ArrowLeft' && index > 0) {
                          const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                          prev?.focus()
                        }
                        if (e.key === 'ArrowRight' && index < 5) {
                          const next = (e.target as HTMLInputElement).nextElementSibling as HTMLInputElement
                          next?.focus()
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
                      className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-teal-600 mb-4">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Verifying...</span>
                  </div>
                )}

                <p className="text-sm text-gray-400">
                  Open your authenticator app to get the code
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Protected by Two-Factor Authentication
          </p>
        </div>
      )
    }

    // Default Login Form
    return (
      <div className="w-full max-w-[440px] px-2 sm:px-0">
        <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 xl:p-10 shadow-xl shadow-gray-200/50">
          {/* Mobile/Tablet Logo */}
          <div className="xl:hidden flex items-center justify-center mb-6 sm:mb-8">
            <SixMediaLogo size="small" />
          </div>

          <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold text-gray-900 mb-2 text-center xl:text-left">
            Agency Portal
          </h1>
          <p className="text-gray-500 mb-6 sm:mb-8 text-sm sm:text-base text-center xl:text-left">
            Sign in to manage your agency dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Enter your email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 group"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-400">Secure access</span>
            </div>
          </div>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
              <Shield className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-teal-500" />
              <span className="text-[10px] sm:text-xs">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
              <Zap className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-cyan-500" />
              <span className="text-[10px] sm:text-xs">2FA Protected</span>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-xs text-gray-400 mt-4 sm:mt-6 px-4">
          Contact administrator for account access or support
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-teal-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-teal-200/30 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-200/20 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-teal-100/40 rounded-full blur-[100px]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(#14b8a6 1px, transparent 1px), linear-gradient(90deg, #14b8a6 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col xl:flex-row">
        {/* Left Section - Branding & Features (hidden on mobile and tablet) */}
        <div className="hidden xl:flex w-full xl:w-[55%] p-6 xl:p-10 2xl:p-12 flex-col justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3 xl:gap-4">
            <SixMediaLogo />
            <div className="h-8 xl:h-10 w-px bg-gray-300" />
            <span className="text-base xl:text-lg font-semibold text-gray-700">Agency Portal</span>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center py-8 xl:py-0">
            <div className="max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 xl:gap-2 bg-teal-100 border border-teal-200 rounded-full px-2.5 xl:px-4 py-1 xl:py-2 mb-4 xl:mb-6">
                <Briefcase className="w-3 xl:w-4 h-3 xl:h-4 text-teal-600" />
                <span className="text-teal-700 text-[11px] xl:text-sm font-medium">Agency Management Portal</span>
              </div>

              {/* Headline */}
              <h1 className="text-2xl xl:text-4xl 2xl:text-5xl font-bold text-gray-900 mb-4 xl:mb-6 leading-tight">
                Manage Your
                <br />
                <span className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
                  Ad Agency
                </span>
                <br />
                With Ease
              </h1>

              <p className="text-gray-600 text-sm xl:text-base 2xl:text-lg mb-6 xl:mb-10 leading-relaxed max-w-lg">
                Access your agency dashboard to manage users, track performance, and grow your advertising business.
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 xl:gap-4 mb-6 xl:mb-10">
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-teal-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-teal-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4 xl:w-5 xl:h-5 text-teal-600" />
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">500+</p>
                  <p className="text-gray-500 text-[10px] xl:text-sm">Active Users</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-cyan-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-cyan-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-4 h-4 xl:w-5 xl:h-5 text-cyan-600" />
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">$1.2M+</p>
                  <p className="text-gray-500 text-[10px] xl:text-sm">Monthly Vol</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-emerald-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-emerald-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <BarChart3 className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-600" />
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">99.9%</p>
                  <p className="text-gray-500 text-[10px] xl:text-sm">Uptime</p>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 xl:gap-4">
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-teal-500" />
                  <span className="text-[11px] xl:text-sm">User Management</span>
                </div>
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-teal-500" />
                  <span className="text-[11px] xl:text-sm">Real-time Analytics</span>
                </div>
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-teal-500" />
                  <span className="text-[11px] xl:text-sm">Secure Platform</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="hidden xl:flex items-center gap-3 xl:gap-4">
            <span className="text-gray-400 text-[11px] xl:text-sm">Supported platforms:</span>
            <div className="flex items-center gap-2 xl:gap-3">
              {/* Facebook */}
              <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 xl:w-5 xl:h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              {/* Google */}
              <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 xl:w-5 xl:h-5" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1z"/>
                  <path fill="#34A853" d="M1.26 9.76A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4-3.1a7.15 7.15 0 0 1 0-4.44l-4-3.1z"/>
                  <path fill="#4285F4" d="M12 18.06c-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14z"/>
                  <path fill="#FBBC05" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/>
                </svg>
              </div>
              {/* TikTok */}
              <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 xl:w-5 xl:h-5 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </div>
              {/* Snapchat */}
              <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 xl:w-5 xl:h-5 text-[#FFFC00]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .272-.063c.12 0 .24.03.345.09.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345 4.2 4.2 0 0 1-.84.12c-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465-.015.135.015.27.075.405.06.135.135.27.225.405.18.27.285.585.255.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.15-.015-.3-.015-.45 0-.195.015-.39.045-.585.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-.375 0-.75-.045-1.11-.135a7.316 7.316 0 0 1-.84-.255l-.075-.03a8.06 8.06 0 0 0-.765-.225 3.975 3.975 0 0 0-.585-.09c-.15-.015-.3-.015-.45 0-.225.015-.45.06-.675.12-.195.045-.39.075-.585.075-.225 0-.45-.03-.66-.09-.39-.12-.69-.435-.735-.84-.03-.3.075-.615.255-.885.09-.135.165-.27.225-.405.06-.135.09-.27.075-.405 0-.135-.105-.3-.315-.465a1.11 1.11 0 0 0-.405-.21 4.62 4.62 0 0 0-.675-.105 4.2 4.2 0 0 1-.84-.12 1.665 1.665 0 0 1-.765-.345c-.21-.18-.315-.405-.285-.615.015-.21.165-.435.435-.6.105-.075.225-.15.375-.225.27-.135.54-.3.81-.495.465-.36.885-.81 1.245-1.35.285-.42.54-.885.66-1.125.105-.195.195-.39.285-.585.045-.135.045-.255 0-.36-.045-.09-.15-.165-.3-.225a1.665 1.665 0 0 0-.225-.075 6.6 6.6 0 0 1-.51-.135c-.06-.015-.12-.03-.18-.045-.405-.12-.645-.255-.795-.39a.585.585 0 0 1-.21-.515c0-.24.126-.45.39-.585a.69.69 0 0 1 .345-.09c.09 0 .18.015.27.063.375.18.735.285 1.035.3.198 0 .326-.044.4-.089a4.95 4.95 0 0 1-.032-.51l-.004-.06c-.103-1.628-.229-3.654.3-4.847C7.86 1.069 11.215.793 12.206.793z"/>
                </svg>
              </div>
              {/* Bing */}
              <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                <svg className="w-4 h-4 xl:w-5 xl:h-5" viewBox="0 0 24 24">
                  <path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/>
                  <path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/>
                  <path fill="#00C8B4" d="M9.5 10l8 3.5v4l-8 4.5v-12z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Dynamic Content */}
        <div className="w-full xl:w-[45%] min-h-screen flex items-center justify-center p-4 sm:p-6 xl:p-12 overflow-hidden perspective-1000">
          <div className={`w-full max-w-[440px] flex items-center justify-center transform-style-3d ${animationClass}`}>
            {renderRightContent()}
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        .perspective-1000 {
          perspective: 1200px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        @keyframes flipOut {
          0% {
            opacity: 1;
            transform: rotateY(0deg) scale(1);
          }
          100% {
            opacity: 0;
            transform: rotateY(-90deg) scale(0.9);
          }
        }
        @keyframes flipIn {
          0% {
            opacity: 0;
            transform: rotateY(90deg) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: rotateY(0deg) scale(1);
          }
        }
        .animate-flip-out {
          animation: flipOut 0.3s cubic-bezier(0.55, 0.055, 0.675, 0.19) forwards;
        }
        .animate-flip-in {
          animation: flipIn 0.5s cubic-bezier(0.215, 0.61, 0.355, 1) forwards;
        }
      `}</style>
    </div>
  )
}
