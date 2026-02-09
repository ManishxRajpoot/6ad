'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useDomainStore } from '@/store/domain'
import { Shield, ArrowRight, Loader2, Mail, Lock, Eye, EyeOff, Award, TrendingUp, Users, Zap, CheckCircle2, Check, Copy, Smartphone, KeyRound, Ban } from 'lucide-react'

type SecurityStep = 'login' | 'email' | '2fa-setup' | '2fa-verify' | '2fa-login' | 'password-change' | 'blocked'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth, updateUser } = useAuthStore()
  const { isCustomDomain, branding } = useDomainStore()
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

  // Password change state (for users created by admin/agent)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Animation state
  const [animationClass, setAnimationClass] = useState('')
  const [displayStep, setDisplayStep] = useState<SecurityStep>('login')
  const prevStepRef = useRef<SecurityStep>('login')

  // Handle step change animations
  useEffect(() => {
    if (prevStepRef.current !== securityStep) {
      // Start exit animation — slide out left + fade
      setAnimationClass('animate-slide-out')

      const timer = setTimeout(() => {
        setDisplayStep(securityStep)
        prevStepRef.current = securityStep
        // Start enter animation — slide in from right + fade
        setAnimationClass('animate-slide-in')

        // Clear animation class after it completes
        setTimeout(() => {
          setAnimationClass('')
        }, 400)
      }, 250)

      return () => clearTimeout(timer)
    }
  }, [securityStep])

  const handleSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    e?.preventDefault()
    setError('')
    setLoading(true)

    const code = codeOverride || totpCode

    try {
      const response = await authApi.login({
        email,
        password,
        ...(securityStep === '2fa-login' && code ? { totpCode: code } : {})
      })

      // If 2FA is required for existing user login
      if (response.requires2FA) {
        setSecurityStep('2fa-login')
        setLoading(false)
        return
      }

      const { token, user } = response
      if (user.role !== 'USER') {
        setError('Access denied. User account required.')
        setLoading(false)
        return
      }

      // Check if user needs security setup or password change
      if (!user.emailVerified || !user.twoFactorEnabled || user.requirePasswordChange) {
        // Store temp credentials and start security wizard
        setTempUser(user)
        setTempToken(token)
        setAuth(user, token) // Set auth for API calls

        if (!user.emailVerified) {
          setSecurityStep('email')
        } else if (!user.twoFactorEnabled) {
          setSecurityStep('2fa-setup')
        } else if (user.requirePasswordChange) {
          setSecurityStep('password-change')
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
        setError(err.message || 'Login failed')
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
      } else if (updatedUser.requirePasswordChange) {
        setSecurityStep('password-change')
      } else {
        // All done, go to dashboard
        router.push('/dashboard')
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
      updateUser(updatedUser)
      setTempUser(updatedUser)
      // Check if user needs to change password (created by admin/agent)
      if (updatedUser.requirePasswordChange) {
        setSecurityStep('password-change')
      } else {
        // All setup complete, go to dashboard
        router.push('/dashboard')
      }
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

  // Password change handler (for users created by admin/agent)
  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authApi.setPassword({ newPassword })
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      // All done, go to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  // Show agency logo if custom domain is configured, otherwise show default Six Media logo
  const isUsingCustomBranding = isCustomDomain && branding?.brandLogo

  // Six Media Logo Component
  const SixMediaLogo = ({ size = 'normal' }: { size?: 'normal' | 'small' | 'large' }) => {
    const iconW = size === 'small' ? 'w-11' : size === 'large' ? 'w-20' : 'w-14'
    const iconH = size === 'small' ? 'h-6' : size === 'large' ? 'h-12' : 'h-8'
    const textSize = size === 'small' ? 'text-[17px]' : size === 'large' ? 'text-[32px]' : 'text-[22px]'
    const tagSize = size === 'small' ? 'text-[8px]' : size === 'large' ? 'text-[12px]' : 'text-[9px]'
    const id1 = size === 'small' ? 'userLoginRibbonSm1' : size === 'large' ? 'userLoginRibbonLg2x1' : 'userLoginRibbonLg1'
    const id2 = size === 'small' ? 'userLoginRibbonSm2' : size === 'large' ? 'userLoginRibbonLg2x2' : 'userLoginRibbonLg2'

    return (
      <div className={`flex items-center ${size === 'small' ? 'gap-2' : 'gap-3'}`}>
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
          <span className={`${tagSize} font-semibold tracking-[0.2em] text-gray-400 mt-0.5`}>
            ADVERTISING
          </span>
        </div>
      </div>
    )
  }

  // White logo for mobile hero (Variation C)
  const SixMediaLogoWhite = () => (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 28" className="w-11 h-6" fill="none">
        <path d="M4 14 C4 6, 10 2, 18 8 C22 11, 24 14, 24 14 C24 14, 22 17, 18 20 C10 26, 4 22, 4 14" fill="white" opacity="0.9"/>
        <path d="M44 14 C44 6, 38 2, 30 8 C26 11, 24 14, 24 14 C24 14, 26 17, 30 20 C38 26, 44 22, 44 14" fill="white" opacity="0.7"/>
        <ellipse cx="24" cy="14" rx="4" ry="5" fill="white" opacity="0.15"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-bold text-white tracking-tight">SIXMEDIA</span>
        <span className="text-[8px] font-semibold tracking-[0.2em] text-white/60 mt-0.5">ADVERTISING</span>
      </div>
    </div>
  )

  const platforms = [
    {
      name: 'Facebook',
      icon: (
        <svg className="w-5 h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    },
    {
      name: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1z"/>
          <path fill="#34A853" d="M1.26 9.76A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4-3.1a7.15 7.15 0 0 1 0-4.44l-4-3.1z"/>
          <path fill="#4285F4" d="M12 18.06c-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14z"/>
          <path fill="#FBBC05" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/>
        </svg>
      )
    },
    {
      name: 'TikTok',
      icon: (
        <svg className="w-5 h-5 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      )
    },
    {
      name: 'Snapchat',
      icon: (
        <svg className="w-5 h-5 text-[#FFFC00]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .272-.063c.12 0 .24.03.345.09.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345 4.2 4.2 0 0 1-.84.12c-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465-.015.135.015.27.075.405.06.135.135.27.225.405.18.27.285.585.255.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.15-.015-.3-.015-.45 0-.195.015-.39.045-.585.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-.375 0-.75-.045-1.11-.135a7.316 7.316 0 0 1-.84-.255l-.075-.03a8.06 8.06 0 0 0-.765-.225 3.975 3.975 0 0 0-.585-.09c-.15-.015-.3-.015-.45 0-.225.015-.45.06-.675.12-.195.045-.39.075-.585.075-.225 0-.45-.03-.66-.09-.39-.12-.69-.435-.735-.84-.03-.3.075-.615.255-.885.09-.135.165-.27.225-.405.06-.135.09-.27.075-.405 0-.135-.105-.3-.315-.465a1.11 1.11 0 0 0-.405-.21 4.62 4.62 0 0 0-.675-.105 4.2 4.2 0 0 1-.84-.12 1.665 1.665 0 0 1-.765-.345c-.21-.18-.315-.405-.285-.615.015-.21.165-.435.435-.6.105-.075.225-.15.375-.225.27-.135.54-.3.81-.495.465-.36.885-.81 1.245-1.35.285-.42.54-.885.66-1.125.105-.195.195-.39.285-.585.045-.135.045-.255 0-.36-.045-.09-.15-.165-.3-.225a1.665 1.665 0 0 0-.225-.075 6.6 6.6 0 0 1-.51-.135c-.06-.015-.12-.03-.18-.045-.405-.12-.645-.255-.795-.39a.585.585 0 0 1-.21-.515c0-.24.126-.45.39-.585a.69.69 0 0 1 .345-.09c.09 0 .18.015.27.063.375.18.735.285 1.035.3.198 0 .326-.044.4-.089a4.95 4.95 0 0 1-.032-.51l-.004-.06c-.103-1.628-.229-3.654.3-4.847C7.86 1.069 11.215.793 12.206.793z"/>
        </svg>
      )
    },
    {
      name: 'Bing',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/>
          <path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/>
          <path fill="#00C8B4" d="M9.5 10l8 3.5v4l-8 4.5v-12z"/>
        </svg>
      )
    }
  ]

  // Render the right side content based on display step (for smooth animation)
  const renderRightContent = () => {
    // Security Setup Wizard Steps
    if (displayStep === 'email' || displayStep === '2fa-setup' || displayStep === '2fa-verify' || displayStep === 'password-change') {
      return (
        <div className="w-full max-w-[480px]">
          {/* Wizard Card */}
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-5">
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
              <div className="flex items-center justify-center gap-3">
                {/* Step 1 - Email */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    tempUser?.emailVerified
                      ? 'bg-emerald-500 text-white'
                      : securityStep === 'email'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tempUser?.emailVerified ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${securityStep === 'email' || tempUser?.emailVerified ? 'text-gray-900' : 'text-gray-400'}`}>
                    Email
                  </span>
                </div>

                <div className={`w-8 h-0.5 ${tempUser?.emailVerified ? 'bg-emerald-500' : 'bg-gray-200'}`} />

                {/* Step 2 - 2FA */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    tempUser?.twoFactorEnabled
                      ? 'bg-emerald-500 text-white'
                      : securityStep === '2fa-setup' || securityStep === '2fa-verify'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {tempUser?.twoFactorEnabled ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${securityStep === '2fa-setup' || securityStep === '2fa-verify' || tempUser?.twoFactorEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                    2FA
                  </span>
                </div>

                {/* Step 3 - Password (only shown if requirePasswordChange) */}
                {tempUser?.requirePasswordChange && (
                  <>
                    <div className={`w-8 h-0.5 ${tempUser?.twoFactorEnabled && !tempUser?.requirePasswordChange ? 'bg-emerald-500' : securityStep === 'password-change' ? 'bg-purple-300' : 'bg-gray-200'}`} />
                    <div className="flex items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        securityStep === 'password-change'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        3
                      </div>
                      <span className={`text-xs font-medium hidden sm:inline ${securityStep === 'password-change' ? 'text-gray-900' : 'text-gray-400'}`}>
                        Password
                      </span>
                    </div>
                  </>
                )}
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
              {securityStep === 'email' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    We'll send a verification code to <span className="font-medium text-gray-700">{tempUser?.email}</span>
                  </p>

                  {!emailCodeSent ? (
                    <button
                      onClick={handleSendEmailCode}
                      disabled={sendingCode}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
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
                            className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>

                      {loading && (
                        <div className="flex items-center justify-center gap-2 text-purple-600">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-medium">Verifying...</span>
                        </div>
                      )}

                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingCode}
                        className="text-sm text-gray-500 hover:text-purple-600 transition-colors"
                      >
                        {sendingCode ? 'Sending...' : "Didn't receive code? Resend"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2FA Setup Step */}
              {securityStep === '2fa-setup' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-purple-600" />
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
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
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
                </div>
              )}

              {/* 2FA Verify Step */}
              {securityStep === '2fa-verify' && (
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
                          className="p-1.5 text-gray-500 hover:text-purple-600 rounded transition-all"
                        >
                          {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
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
                        className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 text-purple-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Completing setup...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Password Change Step */}
              {securityStep === 'password-change' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Set Your Password</h2>
                  <p className="text-gray-500 text-sm mb-6">
                    Create a strong password to secure your account
                  </p>

                  <div className="space-y-4 text-left">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Password requirements */}
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Password requirements:</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${newPassword.length >= 8 ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                            {newPassword.length >= 8 && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className={`text-xs ${newPassword.length >= 8 ? 'text-emerald-600' : 'text-gray-400'}`}>At least 8 characters</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center ${newPassword && confirmPassword && newPassword === confirmPassword ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                            {newPassword && confirmPassword && newPassword === confirmPassword && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className={`text-xs ${newPassword && confirmPassword && newPassword === confirmPassword ? 'text-emerald-600' : 'text-gray-400'}`}>Passwords match</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handlePasswordChange}
                      disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-500/25"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Setting password...
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-5 h-5" />
                          Set Password & Continue
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                This security setup is mandatory and cannot be skipped
              </p>
            </div>
          </div>
        </div>
      )
    }

    // Blocked Account Screen
    if (displayStep === 'blocked') {
      return (
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            <div className="p-8 text-center">
              {/* Blocked Icon */}
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <Ban className="w-10 h-10 text-red-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">Account Blocked</h2>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Your account has been blocked. Please contact your account provider for assistance.
              </p>

              {/* Info Box */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-red-700 text-sm">
                  <strong>Why was my account blocked?</strong>
                </p>
                <ul className="text-red-600 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Violation of terms of service</li>
                  <li>Suspicious activity detected</li>
                  <li>Payment issues</li>
                </ul>
              </div>

              {/* Back to Login Button */}
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
            Need help? Contact your account provider for support.
          </p>
        </div>
      )
    }

    // 2FA Login (for existing users with 2FA enabled)
    if (displayStep === '2fa-login') {
      return (
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-gray-200 rounded-3xl shadow-xl shadow-gray-200/50 overflow-hidden">
            {/* Back button */}
            <div className="px-6 pt-5">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back to login
              </button>
            </div>

            {/* Content */}
            <div className="p-6 pt-4">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-purple-600" />
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
                      className="w-12 h-14 text-center text-xl font-semibold bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-purple-600 mb-4">
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
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      )
    }

    // Default Login Form
    return (
      <div className="w-full max-w-[440px] px-2 sm:px-0">
        <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 xl:p-10 shadow-xl shadow-gray-200/50">
          <h1 className="text-xl sm:text-2xl xl:text-3xl font-bold text-gray-900 mb-2 text-center xl:text-left">
            Welcome back!
          </h1>
          <p className="text-gray-500 mb-6 sm:mb-8 text-sm sm:text-base text-center xl:text-left">
            Sign in to access your account
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
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
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
              className="w-full py-4 px-4 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 group"
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
              <span className="px-4 bg-white xl:bg-white text-gray-400">Secure login</span>
            </div>
          </div>

          {/* Security badges */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
              <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span className="text-[10px] sm:text-xs">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500">
              <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <span className="text-[10px] sm:text-xs">2FA Protected</span>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-xs text-gray-400 mt-4 sm:mt-6 px-4">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-purple-50 relative overflow-x-hidden xl:overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="hidden xl:block absolute inset-0">
        {/* Soft gradient orbs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-200/20 rounded-full blur-[130px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-violet-100/40 rounded-full blur-[100px]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(#8b5cf6 1px, transparent 1px), linear-gradient(90deg, #8b5cf6 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 min-h-screen flex flex-col xl:flex-row">
        {/* Left Section - Branding & Features (hidden on mobile and tablet) */}
        <div className="hidden xl:flex w-full xl:w-[55%] p-6 xl:p-10 2xl:p-16 flex-col justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3 py-2 mb-6 pl-1">
            {isUsingCustomBranding && branding.brandLogo ? (
              <img src={branding.brandLogo} alt="Logo" className="h-16 max-w-[320px] object-contain" />
            ) : (
              <SixMediaLogo size="large" />
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-purple-100 border border-purple-200 rounded-full px-3 py-1.5 xl:px-4 xl:py-2 mb-4 xl:mb-6">
                <Award className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-purple-600" />
                <span className="text-purple-700 text-xs xl:text-sm font-medium">Premium Ad Account Platform</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl xl:text-5xl 2xl:text-6xl font-bold text-gray-900 mb-4 xl:mb-6 leading-tight">
                Scale Your
                <br />
                <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-emerald-500 bg-clip-text text-transparent">
                  Advertising
                </span>
                <br />
                Without Limits
              </h1>

              <p className="text-gray-600 text-base xl:text-lg mb-6 xl:mb-10 leading-relaxed max-w-lg">
                Access premium ad accounts for Facebook, Google, TikTok & more. Trusted by thousands of media buyers worldwide.
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 xl:gap-4 mb-6 xl:mb-10">
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-purple-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-purple-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <TrendingUp className="w-4 h-4 xl:w-5 xl:h-5 text-purple-600" />
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">$2.5M+</p>
                  <p className="text-gray-500 text-xs xl:text-sm">Ad Spend</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-emerald-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-emerald-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-600" />
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">10K+</p>
                  <p className="text-gray-500 text-xs xl:text-sm">Advertisers</p>
                </div>

                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl xl:rounded-2xl p-3 xl:p-5 hover:shadow-lg hover:border-blue-200 transition-all group">
                  <div className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-blue-100 flex items-center justify-center mb-2 xl:mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 xl:w-5 xl:h-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <p className="text-lg xl:text-2xl font-bold text-gray-900">500+</p>
                  <p className="text-gray-500 text-xs xl:text-sm">FB Accounts</p>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-3 xl:gap-4">
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-500" />
                  <span className="text-xs xl:text-sm">Instant Access</span>
                </div>
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-500" />
                  <span className="text-xs xl:text-sm">Secure Platform</span>
                </div>
                <div className="flex items-center gap-1.5 xl:gap-2 text-gray-600">
                  <CheckCircle2 className="w-4 h-4 xl:w-5 xl:h-5 text-emerald-500" />
                  <span className="text-xs xl:text-sm">24/7 Support</span>
                </div>
              </div>
            </div>
          </div>

          {/* Platform logos with loop animation */}
          <div className="hidden xl:flex items-center gap-4 xl:gap-6">
            <span className="text-gray-400 text-xs xl:text-sm">Supported platforms:</span>
            <div className="flex items-center gap-3 xl:gap-4 platform-container overflow-hidden">
              <div className="flex items-center gap-3 xl:gap-4 animate-slide">
                {[...platforms, ...platforms].map((platform, index) => (
                  <div
                    key={index}
                    className="w-8 h-8 xl:w-10 xl:h-10 rounded-lg xl:rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow flex-shrink-0"
                    title={platform.name}
                  >
                    {platform.icon}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Hero Section - Variation C (Wave Split) - visible below xl only */}
        <div className="xl:hidden w-full flex flex-col">
          {/* Gradient Hero with wave bottom — smooth height transition */}
          <div
            className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 overflow-hidden px-6 hero-transition"
            style={{
              paddingTop: displayStep === 'login' ? '2rem' : '2rem',
              paddingBottom: displayStep === 'login' ? '5rem' : '2.5rem',
            }}
          >
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 wave-c-gradient-shift" />

            {/* Animated circles / orbit rings + particles — always rendered, fade with transition */}
            <div
              className="absolute inset-0 overflow-hidden hero-decorations-transition"
              style={{ opacity: displayStep === 'login' ? 1 : 0 }}
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full border-2 border-white/10 orbit-ring" />
              <div className="absolute bottom-5 -left-10 w-32 h-32 rounded-full border border-white/10 orbit-ring-reverse" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full border border-white/[0.08] mobile-pulse-ring" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160px] h-[160px] rounded-full border border-white/[0.06] wave-c-pulse-ring-2" />
              {/* 8 floating particles */}
              <div className="mobile-particle mobile-particle-1" />
              <div className="mobile-particle mobile-particle-2" />
              <div className="mobile-particle mobile-particle-3" />
              <div className="mobile-particle mobile-particle-4" />
              <div className="mobile-particle mobile-particle-5" />
              <div className="mobile-particle mobile-particle-6" />
              <div className="wave-c-p7" />
              <div className="wave-c-p8" />
            </div>

            {/* Orbiting dots — always rendered, fade with transition */}
            <div
              className="hero-decorations-transition"
              style={{ opacity: displayStep === 'login' ? 1 : 0 }}
            >
              <div className="absolute -top-10 -right-10 w-40 h-40 orbit-ring" style={{ animationDuration: '12s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-pink-300 shadow-lg shadow-pink-400/50" />
              </div>
              <div className="absolute bottom-5 -left-10 w-32 h-32 orbit-ring-reverse" style={{ animationDuration: '16s' }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-300 shadow-lg shadow-cyan-400/50" />
              </div>
            </div>

            {/* Hero Content */}
            <div className="relative z-10 text-center">
              {/* Logo with glow */}
              <div className="flex justify-center mb-4">
                <div className="wave-c-logo-glow">
                  {isUsingCustomBranding && branding?.brandLogo ? (
                    <img src={branding.brandLogo} alt="Logo" className="h-8 sm:h-10 max-w-[180px] object-contain brightness-0 invert" />
                  ) : (
                    <SixMediaLogoWhite />
                  )}
                </div>
              </div>

              <p className="text-white/70 text-xs uppercase tracking-[0.2em] wave-c-text-shimmer hero-text-transition"
                style={{ marginBottom: displayStep === 'login' ? '1.25rem' : '0' }}
              >
                Premium Ad Account Platform
              </p>

              {/* Extended content — slide/fade collapse instead of conditional render */}
              <div
                className="hero-expand-content overflow-hidden"
                style={{
                  maxHeight: displayStep === 'login' ? '300px' : '0',
                  opacity: displayStep === 'login' ? 1 : 0,
                }}
              >
                {/* Stat Badges with pulse */}
                <div className="flex justify-center gap-2 sm:gap-3 mb-8">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 border border-white/20 wave-c-badge-pulse" style={{ animationDelay: '0s' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
                      <span className="text-white font-bold text-sm sm:text-base">$2.5M+</span>
                    </div>
                    <p className="text-purple-200 text-[10px] sm:text-xs">Ad Spend</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 border border-white/20 wave-c-badge-pulse" style={{ animationDelay: '0.5s' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Users className="w-3.5 h-3.5 text-blue-300" />
                      <span className="text-white font-bold text-sm sm:text-base">1000+</span>
                    </div>
                    <p className="text-purple-200 text-[10px] sm:text-xs">Advertisers</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 border border-white/20 wave-c-badge-pulse" style={{ animationDelay: '1s' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Award className="w-3.5 h-3.5 text-yellow-300" />
                      <span className="text-white font-bold text-sm sm:text-base">500+</span>
                    </div>
                    <p className="text-purple-200 text-[10px] sm:text-xs">FB Accounts</p>
                  </div>
                </div>

                {/* Platform Icons Carousel */}
                <div className="flex justify-center">
                  <div className="overflow-hidden" style={{ maxWidth: '260px' }}>
                    <div className="flex items-center gap-2.5 animate-slide-mobile" style={{ animationDuration: '10s' }}>
                      {[...platforms, ...platforms].map((platform, index) => (
                        <div
                          key={index}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0"
                        >
                          <div className="brightness-0 invert opacity-90 scale-90">
                            {platform.icon}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Static Wave SVG */}
            <div className="absolute -bottom-[2px] left-0 right-0 z-20">
              <svg viewBox="0 0 375 40" className="w-full block" preserveAspectRatio="none" style={{ height: '42px' }}>
                <path d="M0 20 Q93 0 187 20 Q281 40 375 20 L375 40 L0 40 Z" fill="#F9FAFB" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Section - Dynamic Content */}
        <div className="w-full xl:w-[45%] xl:min-h-screen flex items-center justify-center p-4 sm:p-6 xl:p-12 overflow-hidden -mt-1 xl:mt-0 relative z-10 bg-gray-50 xl:bg-transparent">
          <div className={`w-full max-w-[440px] flex items-center justify-center ${animationClass}`}>
            {renderRightContent()}
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-slide {
          animation: slide 15s linear infinite;
        }
        .animate-slide:hover {
          animation-play-state: paused;
        }
        /* Hero smooth collapse/expand transitions */
        .hero-transition {
          transition: padding 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hero-decorations-transition {
          transition: opacity 0.4s ease-in-out;
        }
        .hero-text-transition {
          transition: margin-bottom 0.4s ease-in-out;
        }
        .hero-expand-content {
          transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease-in-out;
        }

        /* Step transition — slide + fade */
        @keyframes slideOut {
          0% { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(-30px) scale(0.97); }
        }
        @keyframes slideIn {
          0% { opacity: 0; transform: translateX(30px) scale(0.97); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        .animate-slide-out {
          animation: slideOut 0.25s ease-in forwards;
        }
        .animate-slide-in {
          animation: slideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* Mobile floating particles */
        .mobile-particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          animation: float-particle linear infinite;
        }
        .mobile-particle-1 { width: 6px; height: 6px; top: 15%; left: 8%; animation-duration: 6s; animation-delay: 0s; }
        .mobile-particle-2 { width: 4px; height: 4px; top: 55%; left: 88%; animation-duration: 8s; animation-delay: 1s; }
        .mobile-particle-3 { width: 8px; height: 8px; top: 35%; left: 45%; animation-duration: 7s; animation-delay: 2s; }
        .mobile-particle-4 { width: 5px; height: 5px; top: 70%; left: 20%; animation-duration: 9s; animation-delay: 0.5s; }
        .mobile-particle-5 { width: 3px; height: 3px; top: 10%; left: 65%; animation-duration: 5s; animation-delay: 3s; }
        .mobile-particle-6 { width: 7px; height: 7px; top: 50%; left: 30%; animation-duration: 10s; animation-delay: 1.5s; }

        @keyframes float-particle {
          0% { transform: translateY(0px) translateX(0px) scale(0); opacity: 0; }
          15% { opacity: 1; transform: translateY(-5px) translateX(3px) scale(1); }
          85% { opacity: 1; }
          100% { transform: translateY(-50px) translateX(25px) scale(0.5); opacity: 0; }
        }

        /* Mobile platform carousel */
        .animate-slide-mobile {
          animation: slide 10s linear infinite;
        }

        /* ========== VARIATION C ANIMATIONS ========== */

        /* Orbit ring spin */
        .orbit-ring {
          animation: orbit-spin 15s linear infinite;
        }
        @keyframes orbit-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .orbit-ring-reverse {
          animation: orbit-spin 20s linear infinite reverse;
        }

        /* Pulse ring */
        .mobile-pulse-ring {
          animation: pulse-ring-anim 3s ease-in-out infinite;
        }
        @keyframes pulse-ring-anim {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
        }

        /* Second pulse ring */
        .wave-c-pulse-ring-2 {
          animation: pulse-ring-anim 4s ease-in-out infinite;
          animation-delay: 1.5s;
        }

        /* Stat badge pulse */
        .wave-c-badge-pulse {
          animation: wave-c-badge-anim 3s ease-in-out infinite;
        }
        @keyframes wave-c-badge-anim {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255,255,255,0.15); }
        }

        /* Extra particles for Variation C */
        .wave-c-p7, .wave-c-p8 {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          animation: float-particle linear infinite;
        }
        .wave-c-p7 { width: 5px; height: 5px; top: 20%; left: 75%; animation-duration: 7s; animation-delay: 1.5s; }
        .wave-c-p8 { width: 4px; height: 4px; top: 60%; left: 40%; animation-duration: 6s; animation-delay: 3.5s; }

        /* Gradient shift overlay */
        .wave-c-gradient-shift {
          background: linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.1) 50%, rgba(236,72,153,0.3) 100%);
          animation: wave-c-gradient-move 8s ease-in-out infinite;
        }
        @keyframes wave-c-gradient-move {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }

        /* Logo glow */
        .wave-c-logo-glow {
          animation: wave-c-glow 3s ease-in-out infinite;
        }
        @keyframes wave-c-glow {
          0%, 100% { filter: drop-shadow(0 0 0px rgba(255,255,255,0)); }
          50% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)); }
        }

        /* Text shimmer */
        .wave-c-text-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.5) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: wave-c-shimmer 3s linear infinite;
        }
        @keyframes wave-c-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
