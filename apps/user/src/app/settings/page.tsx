'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'
import { authApi, settingsApi } from '@/lib/api'
import {
  Upload,
  Loader2,
  Shield,
  Lock,
  Check,
  Copy,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Save,
  Key,
  ShieldCheck,
  UserCircle,
  ChevronRight,
  Pencil,
  X,
  User,
} from 'lucide-react'

type TabType = 'profile' | 'security'

function SettingsPageContent() {
  const { user, updateUser } = useAuthStore()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tab state - read from URL query param
  const tabFromUrl = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl === 'security' ? 'security' : 'profile')

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl === 'security') {
      setActiveTab('security')
    } else if (tabFromUrl === 'profile') {
      setActiveTab('profile')
    }
  }, [tabFromUrl])

  // Personal Information
  const [fullName, setFullName] = useState((user as any)?.realName || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Contact Details
  const [contact1, setContact1] = useState((user as any)?.phone || '')
  const [contact2, setContact2] = useState((user as any)?.phone2 || '')
  const [savingContact, setSavingContact] = useState(false)

  // Password Settings
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Avatar
  const [avatar, setAvatar] = useState((user as any)?.profileImage || '')
  const [savingAvatar, setSavingAvatar] = useState(false)

  // Email Verification
  const [emailVerified, setEmailVerified] = useState((user as any)?.emailVerified || false)
  const [sendingVerification, setSendingVerification] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)

  // Email Change
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeCode, setEmailChangeCode] = useState('')
  const [emailChangeCodeSent, setEmailChangeCodeSent] = useState(false)
  const [sendingEmailChangeCode, setSendingEmailChangeCode] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState((user as any)?.twoFactorEnabled || false)
  const [twoFactorSetupMode, setTwoFactorSetupMode] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [setting2FA, setSetting2FA] = useState(false)
  const [saving2FA, setSaving2FA] = useState(false)
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disabling2FA, setDisabling2FA] = useState(false)

  // Toast states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Update state when user changes
  useEffect(() => {
    if (user) {
      const userData = user as any
      setFullName(userData.realName || '')
      setContact1(userData.phone || '')
      setContact2(userData.phone2 || '')
      setAvatar(userData.profileImage || '')
      setTwoFactorEnabled(userData.twoFactorEnabled || false)
      setEmailVerified(userData.emailVerified || false)
    }
  }, [user])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2MB', 'error')
        return
      }
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        setAvatar(base64)
        setSavingAvatar(true)
        try {
          await settingsApi.profile.updateAvatar(base64)
          const { user: updatedUser } = await authApi.me()
          updateUser(updatedUser)
          showToast('Your profile picture has been updated', 'success')
        } catch (error: any) {
          showToast(error.message || 'Failed to save avatar', 'error')
        } finally {
          setSavingAvatar(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await settingsApi.profile.update({ realName: fullName })
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      showToast('Your profile has been updated successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveContact = async () => {
    setSavingContact(true)
    try {
      await settingsApi.profile.update({ phone: contact1, phone2: contact2 })
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      showToast('Your contact details have been updated', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to update contact details', 'error')
    } finally {
      setSavingContact(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword) {
      showToast('Please enter your current password', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword({ currentPassword: oldPassword, newPassword })
      showToast('Your password has been updated successfully', 'success')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      showToast(error.message || 'Failed to change password', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSendEmailCode = async () => {
    setSendingVerification(true)
    try {
      await authApi.email.sendCode()
      setEmailCodeSent(true)
      showToast('Verification code sent to your email', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send verification code', 'error')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      showToast('Please enter a valid 6-digit code', 'error')
      return
    }

    setVerifyingEmail(true)
    try {
      await authApi.email.verify(emailCode)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setEmailVerified(true)
      setEmailCodeSent(false)
      setEmailCode('')
      showToast('Your email has been verified successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Invalid verification code', 'error')
    } finally {
      setVerifyingEmail(false)
    }
  }

  // Email Change Functions
  const handleSendEmailChangeCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setSendingEmailChangeCode(true)
    try {
      await authApi.email.sendChangeCode(newEmail)
      setEmailChangeCodeSent(true)
      showToast('Verification code sent to your new email', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to send verification code', 'error')
    } finally {
      setSendingEmailChangeCode(false)
    }
  }

  const handleVerifyEmailChange = async () => {
    if (emailChangeCode.length !== 6) {
      showToast('Please enter a valid 6-digit code', 'error')
      return
    }

    setSavingEmail(true)
    try {
      await authApi.email.verifyChange(newEmail, emailChangeCode)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setShowEmailChange(false)
      setNewEmail('')
      setEmailChangeCode('')
      setEmailChangeCodeSent(false)
      showToast('Your email has been changed successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Invalid verification code', 'error')
    } finally {
      setSavingEmail(false)
    }
  }

  const handleCancelEmailChange = () => {
    setShowEmailChange(false)
    setNewEmail('')
    setEmailChangeCode('')
    setEmailChangeCodeSent(false)
  }

  const handleSetup2FA = async () => {
    setSetting2FA(true)
    try {
      const response = await authApi.twoFactor.setup()
      setSecretKey(response.secret)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(response.otpauthUrl)}`
      setQrCodeUrl(qrUrl)
      setTwoFactorSetupMode(true)
    } catch (error: any) {
      showToast(error.message || 'Failed to setup 2FA', 'error')
    } finally {
      setSetting2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (twoFactorCode.length !== 6) {
      showToast('Please enter a valid 6-digit code', 'error')
      return
    }

    setSaving2FA(true)
    try {
      await authApi.twoFactor.verify(twoFactorCode)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setTwoFactorEnabled(true)
      setTwoFactorSetupMode(false)
      setTwoFactorCode('')
      setQrCodeUrl('')
      setSecretKey('')
      showToast('Two-factor authentication is now active', 'success')
    } catch (error: any) {
      showToast(error.message || 'Invalid verification code', 'error')
    } finally {
      setSaving2FA(false)
    }
  }

  const handleCancelSetup = () => {
    setTwoFactorSetupMode(false)
    setQrCodeUrl('')
    setSecretKey('')
    setTwoFactorCode('')
  }

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      showToast('Please enter your password', 'error')
      return
    }

    setDisabling2FA(true)
    try {
      await authApi.twoFactor.disable({ password: disablePassword })
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setTwoFactorEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
      showToast('Two-factor authentication has been disabled', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to disable 2FA', 'error')
    } finally {
      setDisabling2FA(false)
    }
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secretKey)
    setCopiedSecret(true)
    showToast('Secret key copied to clipboard', 'success')
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const getInitials = () => {
    const userData = user as any
    if (userData?.realName) {
      return userData.realName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.username?.slice(0, 2).toUpperCase() || 'U'
  }

  const menuItems = [
    {
      id: 'profile' as TabType,
      label: 'Profile Settings',
      icon: UserCircle,
      description: 'Manage your personal information'
    },
    {
      id: 'security' as TabType,
      label: 'Security',
      icon: ShieldCheck,
      description: 'Password & two-factor authentication'
    }
  ]

  return (
    <DashboardLayout title="My Account" subtitle="Manage your account preferences">
      {/* Success Toast - Centered Floating */}
      {toast && toast.type === 'success' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-[#52B788] shadow-2xl animate-[toastPop_0.4s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-[#52B788] flex items-center justify-center animate-[checkBounce_0.5s_ease-out_0.2s_both]">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-[#52B788]">Success!</span>
            <span className="text-gray-600 text-sm text-center">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Error Toast - Centered Floating */}
      {toast && toast.type === 'error' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-white border-2 border-red-500 shadow-2xl animate-[toastPop_0.4s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-[checkBounce_0.5s_ease-out_0.2s_both]">
              <X className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <span className="text-lg font-semibold text-red-500">Error</span>
            <span className="text-gray-600 text-sm text-center max-w-xs">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Keyframes for animations */}
      <style jsx global>{`
        @keyframes toastPop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkBounce {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes tabFadeIn {
          0% { opacity: 0; transform: translateX(10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-tabFadeIn {
          animation: tabFadeIn 0.3s ease-out;
        }
        @keyframes mFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ===== MOBILE HEADER ===== */}
      <div className="lg:hidden space-y-4 mb-4" style={{ animation: 'mFadeUp 0.4s cubic-bezier(0.25,0.1,0.25,1) both' }}>
        {/* User Card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className="relative">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#52B788] to-[#3D9970] flex items-center justify-center text-white text-lg font-bold overflow-hidden cursor-pointer active:opacity-80 transition-opacity"
              >
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  getInitials()
                )}
              </div>
              {twoFactorEnabled && emailVerified && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#52B788] rounded-full flex items-center justify-center ring-2 ring-white">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#1E293B] truncate">{(user as any)?.realName || user?.username || 'User'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          {/* Security Status Mini */}
          <div className="flex border-t border-gray-100 divide-x divide-gray-100">
            <div className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[10px]">
              <Mail className="w-3 h-3" />
              <span className={emailVerified ? 'text-[#52B788] font-semibold' : 'text-amber-500 font-semibold'}>{emailVerified ? 'Verified' : 'Unverified'}</span>
            </div>
            <div className="flex-1 py-2 flex items-center justify-center gap-1.5 text-[10px]">
              <Shield className="w-3 h-3" />
              <span className={twoFactorEnabled ? 'text-[#52B788] font-semibold' : 'text-red-400 font-semibold'}>{twoFactorEnabled ? '2FA On' : '2FA Off'}</span>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
          <button onClick={() => setActiveTab('profile')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${activeTab === 'profile' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-gray-400'}`}>
            <UserCircle className="w-3.5 h-3.5" /> Profile
          </button>
          <button onClick={() => setActiveTab('security')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${activeTab === 'security' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-gray-400'}`}>
            <ShieldCheck className="w-3.5 h-3.5" /> Security
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-140px)] pb-24 lg:pb-0">
        {/* Left Sidebar Navigation - Desktop Only */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <Card className="p-4 h-full">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 p-3 mb-4 bg-gradient-to-r from-[#52B788]/10 to-emerald-50/50 rounded-xl">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center text-white text-lg font-bold overflow-hidden ring-2 ring-white shadow">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                {twoFactorEnabled && emailVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#52B788] rounded-full flex items-center justify-center ring-2 ring-white">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{(user as any)?.realName || user?.username || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                    activeTab === item.id
                      ? 'bg-[#52B788] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-[#52B788]/5'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === item.id
                      ? 'bg-white/20'
                      : 'bg-[#52B788]/10 group-hover:bg-[#52B788]/20'
                  }`}>
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-[#52B788]'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${activeTab === item.id ? 'text-white' : 'text-gray-900'}`}>
                      {item.label}
                    </p>
                    <p className={`text-xs ${activeTab === item.id ? 'text-white/70' : 'text-gray-400'}`}>
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${activeTab === item.id ? 'text-white/70' : 'text-gray-300'}`} />
                </button>
              ))}
            </nav>

            {/* Security Status */}
            <div className="mt-6 p-4 bg-[#52B788]/5 rounded-xl border border-[#52B788]/10">
              <p className="text-xs font-medium text-[#52B788] uppercase tracking-wider mb-3">Security Status</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Verified</span>
                  {emailVerified ? (
                    <span className="flex items-center gap-1 text-xs text-[#52B788] font-medium">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-xs text-amber-500 font-medium">Pending</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">2FA Enabled</span>
                  {twoFactorEnabled ? (
                    <span className="flex items-center gap-1 text-xs text-[#52B788] font-medium">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-xs text-red-500 font-medium">No</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="lg:bg-white lg:rounded-xl lg:border lg:border-gray-200 lg:shadow-sm p-0 lg:p-6 min-h-full">
            {activeTab === 'profile' ? (
              <div className="space-y-5 lg:space-y-8 max-w-2xl animate-tabFadeIn">
                {/* Section Header - Desktop Only */}
                <div className="hidden lg:block">
                  <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Update your personal information and contact details</p>
                </div>

                {/* Profile Picture - Desktop Only (mobile header has tappable avatar) */}
                <div className="hidden lg:block pb-6 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Profile Picture</h3>
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ring-4 ring-gray-100 shadow-lg"
                      >
                        {avatar ? (
                          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          getInitials()
                        )}
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={savingAvatar}
                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#52B788] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                      >
                        {savingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Upload new picture</p>
                      <p className="text-xs text-gray-500 mt-0.5">JPG, PNG. Max 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:bg-transparent lg:border-0 lg:p-0 lg:pb-6 lg:border-b lg:border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 lg:text-sm lg:font-medium lg:text-gray-900 lg:normal-case lg:tracking-normal lg:mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Username</label>
                      <input
                        type="text"
                        value={user?.username || ''}
                        disabled
                        className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1.5">Email Address</label>
                      {!showEmailChange ? (
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
                          />
                          {emailVerified && (
                            <button
                              onClick={() => setShowEmailChange(true)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-[#52B788]/10 hover:bg-[#52B788]/20 text-[#52B788] rounded-lg text-sm font-medium transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                              Change
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 p-4 bg-[#52B788]/5 border border-[#52B788]/20 rounded-xl">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">Change Email Address</p>
                            <button
                              onClick={handleCancelEmailChange}
                              className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {!emailChangeCodeSent ? (
                            <>
                              <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Enter new email address"
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] transition-all"
                              />
                              <button
                                onClick={handleSendEmailChangeCode}
                                disabled={sendingEmailChangeCode || !newEmail}
                                className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {sendingEmailChangeCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                {sendingEmailChangeCode ? 'Sending...' : 'Send Verification Code'}
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500">
                                Enter the 6-digit code sent to <span className="font-medium text-[#52B788]">{newEmail}</span>
                              </p>
                              <input
                                type="text"
                                value={emailChangeCode}
                                onChange={(e) => setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] transition-all"
                              />
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setEmailChangeCodeSent(false)}
                                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                                >
                                  Back
                                </button>
                                <button
                                  onClick={handleVerifyEmailChange}
                                  disabled={savingEmail || emailChangeCode.length !== 6}
                                  className="flex-1 flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  {savingEmail ? 'Verifying...' : 'Verify & Change'}
                                </button>
                              </div>
                              <button
                                onClick={handleSendEmailChangeCode}
                                disabled={sendingEmailChangeCode}
                                className="w-full text-sm text-gray-500 hover:text-[#52B788] transition-colors"
                              >
                                {sendingEmailChangeCode ? 'Sending...' : "Didn't receive code? Resend"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {!emailVerified && !showEmailChange && (
                        <p className="text-xs text-amber-600 mt-1.5">Verify your email first to change it</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="mt-4 w-full lg:w-auto flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl lg:rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                {/* Contact Details */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:bg-transparent lg:border-0 lg:p-0">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 lg:text-sm lg:font-medium lg:text-gray-900 lg:normal-case lg:tracking-normal lg:mb-4">Contact Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Primary Contact</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          value={contact1}
                          onChange={(e) => setContact1(e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Secondary Contact</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          value={contact2}
                          onChange={(e) => setContact2(e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="mt-4 w-full lg:w-auto flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl lg:rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingContact ? 'Saving...' : 'Save Contact'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 lg:space-y-8 max-w-2xl animate-tabFadeIn">
                {/* Section Header - Desktop Only */}
                <div className="hidden lg:block">
                  <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage your password and two-factor authentication</p>
                </div>

                {/* Change Password */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:bg-transparent lg:border-0 lg:p-0 lg:pb-6 lg:border-b lg:border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-[#52B788]" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">Change Password</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Current Password</label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? 'text' : 'password'}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1.5">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
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
                        <label className="block text-sm text-gray-600 mb-1.5">Confirm New Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
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
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                      className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {savingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>

                {/* Email Verification */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:bg-transparent lg:border-0 lg:p-0 lg:pb-6 lg:border-b lg:border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-[#52B788]" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900">Email Verification</h3>
                    </div>
                    {emailVerified && (
                      <span className="px-2.5 py-1 bg-[#52B788] text-white rounded-full text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  {emailVerified ? (
                    <div className="p-4 bg-[#52B788]/5 border border-[#52B788]/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                          <Check className="w-5 h-5 text-[#52B788]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email verified successfully</p>
                          <p className="text-xs text-gray-500">{user?.email}</p>
                        </div>
                      </div>
                    </div>
                  ) : emailCodeSent ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        Enter the 6-digit code sent to <span className="font-medium text-[#52B788]">{user?.email}</span>
                      </p>
                      <input
                        type="text"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full max-w-xs px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setEmailCodeSent(false); setEmailCode(''); }}
                          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleVerifyEmail}
                          disabled={verifyingEmail || emailCode.length !== 6}
                          className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                          {verifyingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                        </button>
                      </div>
                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingVerification}
                        className="text-sm text-gray-500 hover:text-[#52B788] transition-colors"
                      >
                        {sendingVerification ? 'Sending...' : "Didn't receive code? Resend"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">Verify your email address to secure your account and enable all features.</p>
                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingVerification}
                        className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {sendingVerification ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {sendingVerification ? 'Sending...' : 'Send Verification Code'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Two-Factor Authentication */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 lg:bg-transparent lg:border-0 lg:p-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-[#52B788]" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                    </div>
                    {twoFactorEnabled && (
                      <span className="px-2.5 py-1 bg-[#52B788] text-white rounded-full text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Enabled
                      </span>
                    )}
                  </div>

                  {/* 2FA Already Enabled */}
                  {twoFactorEnabled && !showDisableForm && (
                    <div className="space-y-4">
                      <div className="p-4 bg-[#52B788]/5 border border-[#52B788]/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#52B788]" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Two-factor authentication is active</p>
                            <p className="text-xs text-gray-500">Your account is protected with an authenticator app</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDisableForm(true)}
                        className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                      >
                        Disable two-factor authentication
                      </button>
                    </div>
                  )}

                  {/* Disable 2FA Form */}
                  {twoFactorEnabled && showDisableForm && (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-sm text-red-700">
                          <strong>Warning:</strong> Disabling 2FA will make your account less secure.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1.5">Enter your password to confirm</label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full max-w-sm px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => { setShowDisableForm(false); setDisablePassword(''); }}
                          className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDisable2FA}
                          disabled={disabling2FA || !disablePassword}
                          className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disabling2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable 2FA'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Setup Mode - Show QR code and verification */}
                  {!twoFactorEnabled && twoFactorSetupMode && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                      </p>

                      <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* QR Code */}
                        {qrCodeUrl && (
                          <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-36 h-36" />
                          </div>
                        )}

                        <div className="flex-1 space-y-4">
                          {/* Secret Key */}
                          {secretKey && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">Can't scan? Enter this code manually:</p>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-700 break-all">{secretKey}</code>
                                <button
                                  onClick={copySecretKey}
                                  className="p-2 text-gray-500 hover:text-[#52B788] hover:bg-[#52B788]/10 rounded-lg transition-colors flex-shrink-0"
                                >
                                  {copiedSecret ? <Check className="w-4 h-4 text-[#52B788]" /> : <Copy className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Verification Code */}
                          <div>
                            <label className="block text-sm text-gray-600 mb-1.5">Enter the 6-digit code from your app</label>
                            <input
                              type="text"
                              value={twoFactorCode}
                              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              maxLength={6}
                              className="w-full max-w-xs px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                            />
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={handleCancelSetup}
                              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleVerify2FA}
                              disabled={saving2FA || twoFactorCode.length !== 6}
                              className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {saving2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                              {saving2FA ? 'Verifying...' : 'Enable 2FA'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Not enabled - Show setup button */}
                  {!twoFactorEnabled && !twoFactorSetupMode && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        Add an extra layer of security to your account by enabling two-factor authentication using an authenticator app.
                      </p>
                      <button
                        onClick={handleSetup2FA}
                        disabled={setting2FA}
                        className="flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {setting2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        {setting2FA ? 'Setting up...' : 'Setup Two-Factor Authentication'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout title="My Account" subtitle="Manage your account preferences">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    }>
      <SettingsPageContent />
    </Suspense>
  )
}
