'use client'

import { useState, useEffect } from 'react'
import { Shield, Mail, Check, Loader2, Copy, Smartphone, KeyRound } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type Step = 'email' | '2fa-setup' | '2fa-verify'

export function Mandatory2FASetup() {
  const { user, updateUser } = useAuthStore()
  const [step, setStep] = useState<Step>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Email verification state
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)

  // 2FA state
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)

  // Determine if modal should be shown
  const shouldShow = user && (!user.emailVerified || !user.twoFactorEnabled)

  // Determine initial step
  useEffect(() => {
    if (user) {
      if (!user.emailVerified) {
        setStep('email')
      } else if (!user.twoFactorEnabled) {
        setStep('2fa-setup')
      }
    }
  }, [user])

  if (!shouldShow) {
    return null
  }

  const handleSendEmailCode = async () => {
    setSendingCode(true)
    setError('')
    try {
      const response = await authApi.email.sendCode()
      setEmailCodeSent(true)
      if (response.code) {
        console.log('Email verification code:', response.code)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authApi.email.verify(emailCode)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setStep('2fa-setup')
      setEmailCode('')
    } catch (err: any) {
      setError(err.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup2FA = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await authApi.twoFactor.setup()
      setSecretKey(response.secret)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(response.otpauthUrl)}`
      setQrCodeUrl(qrUrl)
      setStep('2fa-verify')
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (twoFactorCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authApi.twoFactor.verify(twoFactorCode)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Popup Modal - 70% of screen */}
      <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Security Setup Required</h1>
              <p className="text-white/80 text-sm">Complete these steps to secure your account</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-center gap-4">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                user?.emailVerified
                  ? 'bg-green-500 text-white'
                  : step === 'email'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {user?.emailVerified ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <span className={`text-sm font-medium ${step === 'email' || user?.emailVerified ? 'text-gray-900' : 'text-gray-400'}`}>
                Email Verification
              </span>
            </div>

            <div className={`w-12 h-0.5 ${user?.emailVerified ? 'bg-green-500' : 'bg-gray-200'}`} />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                user?.twoFactorEnabled
                  ? 'bg-green-500 text-white'
                  : step === '2fa-setup' || step === '2fa-verify'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              }`}>
                {user?.twoFactorEnabled ? <Check className="w-4 h-4" /> : '2'}
              </div>
              <span className={`text-sm font-medium ${step === '2fa-setup' || step === '2fa-verify' || user?.twoFactorEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                Two-Factor Auth
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Email Verification */}
          {step === 'email' && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verify Your Email</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  We'll send a verification code to <span className="font-medium text-gray-700">{user?.email}</span>
                </p>
              </div>

              {!emailCodeSent ? (
                <button
                  onClick={handleSendEmailCode}
                  disabled={sendingCode}
                  className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter 6-digit code
                    </label>
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
                              if (index < 5 && val) {
                                const next = e.target.nextElementSibling as HTMLInputElement
                                next?.focus()
                              }
                              // Auto-submit when 6 digits entered
                              if (finalCode.length === 6) {
                                setTimeout(() => {
                                  const submitBtn = document.getElementById('email-verify-btn')
                                  submitBtn?.click()
                                }, 100)
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !emailCode[index] && index > 0) {
                              const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                              prev?.focus()
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault()
                            const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                            setEmailCode(paste)
                            // Auto-submit when pasting full code
                            if (paste.length === 6) {
                              setTimeout(() => {
                                const submitBtn = document.getElementById('email-verify-btn')
                                submitBtn?.click()
                              }, 100)
                            }
                          }}
                          className="w-12 h-12 text-center text-lg font-semibold bg-gray-50 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:bg-white transition-all"
                        />
                      ))}
                    </div>
                  </div>

                  {loading && (
                    <div className="flex items-center justify-center gap-2 text-primary-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Verifying...</span>
                    </div>
                  )}

                  <button
                    id="email-verify-btn"
                    onClick={handleVerifyEmail}
                    disabled={loading || emailCode.length !== 6}
                    className="hidden"
                  >
                    Verify
                  </button>

                  <button
                    onClick={handleSendEmailCode}
                    disabled={sendingCode}
                    className="w-full text-sm text-gray-500 hover:text-primary-500 transition-colors"
                  >
                    {sendingCode ? 'Sending...' : "Didn't receive code? Resend"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: 2FA Setup */}
          {step === '2fa-setup' && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-8 h-8 text-primary-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Setup Two-Factor Authentication</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Add an extra layer of security using an authenticator app
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-5">
                <p className="text-amber-800 text-sm">
                  <strong>Required:</strong> Download Google Authenticator, Authy, or Microsoft Authenticator on your phone
                </p>
              </div>

              <button
                onClick={handleSetup2FA}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50"
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

          {/* Step 3: 2FA Verify */}
          {step === '2fa-verify' && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-5">
                <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  Scan with your authenticator app and enter the code
                </p>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                  </div>
                </div>
              )}

              {/* Secret Key */}
              {secretKey && (
                <div className="mb-5">
                  <p className="text-xs text-gray-500 mb-1 text-center">Can't scan? Enter manually:</p>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <code className="flex-1 text-xs font-mono text-gray-600 break-all text-center">
                      {secretKey}
                    </code>
                    <button
                      onClick={copySecretKey}
                      className="p-1.5 text-gray-500 hover:text-primary-500 rounded transition-all"
                    >
                      {copiedSecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit code from app
                </label>
                <div className="flex gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      value={twoFactorCode[index] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '')
                        if (val) {
                          const newCode = twoFactorCode.split('')
                          newCode[index] = val
                          const finalCode = newCode.join('').slice(0, 6)
                          setTwoFactorCode(finalCode)
                          if (index < 5 && val) {
                            const next = e.target.nextElementSibling as HTMLInputElement
                            next?.focus()
                          }
                          // Auto-submit when 6 digits entered
                          if (finalCode.length === 6) {
                            setTimeout(() => {
                              const submitBtn = document.getElementById('2fa-verify-btn')
                              submitBtn?.click()
                            }, 100)
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
                          const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                          prev?.focus()
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault()
                        const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                        setTwoFactorCode(paste)
                        // Auto-submit when pasting full code
                        if (paste.length === 6) {
                          setTimeout(() => {
                            const submitBtn = document.getElementById('2fa-verify-btn')
                            submitBtn?.click()
                          }, 100)
                        }
                      }}
                      className="w-12 h-12 text-center text-lg font-semibold bg-gray-50 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-primary-500 focus:bg-white transition-all"
                    />
                  ))}
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-primary-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">Completing setup...</span>
                </div>
              )}

              <button
                id="2fa-verify-btn"
                onClick={handleVerify2FA}
                disabled={loading || twoFactorCode.length !== 6}
                className="hidden"
              >
                Verify
              </button>
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
