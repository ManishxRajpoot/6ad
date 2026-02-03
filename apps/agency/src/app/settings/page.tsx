'use client'

import { useState, useRef, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'
import { authApi, settingsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
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
  X
} from 'lucide-react'

type TabType = 'profile' | 'security'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('profile')

  // Personal Information
  const [fullName, setFullName] = useState(user?.realName || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Contact Details
  const [contact1, setContact1] = useState(user?.phone || '')
  const [contact2, setContact2] = useState(user?.phone2 || '')
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
  const [avatar, setAvatar] = useState(user?.profileImage || '')
  const [savingAvatar, setSavingAvatar] = useState(false)

  // Email Verification
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified || false)
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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false)
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

  // Update state when user changes
  useEffect(() => {
    if (user) {
      setFullName(user.realName || '')
      setContact1(user.phone || '')
      setContact2(user.phone2 || '')
      setAvatar(user.profileImage || '')
      setTwoFactorEnabled(user.twoFactorEnabled || false)
      setEmailVerified(user.emailVerified || false)
    }
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB')
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
          setUser(updatedUser)
          toast.success('Your profile picture has been updated')
        } catch (error: any) {
          toast.error(error.message || 'Failed to save avatar')
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
      setUser(updatedUser)
      toast.success('Your profile has been updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveContact = async () => {
    setSavingContact(true)
    try {
      await settingsApi.profile.update({ phone: contact1, phone2: contact2 })
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)
      toast.success('Your contact details have been updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update contact details')
    } finally {
      setSavingContact(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword({ currentPassword: oldPassword, newPassword })
      toast.success('Your password has been updated successfully')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSendEmailCode = async () => {
    setSendingVerification(true)
    try {
      await authApi.email.sendCode()
      setEmailCodeSent(true)
      toast.success('Verification code sent to your email')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    setVerifyingEmail(true)
    try {
      await authApi.email.verify(emailCode)
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)
      setEmailVerified(true)
      setEmailCodeSent(false)
      setEmailCode('')
      toast.success('Your email has been verified successfully')
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code')
    } finally {
      setVerifyingEmail(false)
    }
  }

  // Email Change Functions
  const handleSendEmailChangeCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setSendingEmailChangeCode(true)
    try {
      await authApi.email.sendChangeCode(newEmail)
      setEmailChangeCodeSent(true)
      toast.success('Verification code sent to your new email')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code')
    } finally {
      setSendingEmailChangeCode(false)
    }
  }

  const handleVerifyEmailChange = async () => {
    if (emailChangeCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    setSavingEmail(true)
    try {
      await authApi.email.verifyChange(newEmail, emailChangeCode)
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)
      setShowEmailChange(false)
      setNewEmail('')
      setEmailChangeCode('')
      setEmailChangeCodeSent(false)
      toast.success('Your email has been changed successfully')
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code')
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
      toast.error(error.message || 'Failed to setup 2FA')
    } finally {
      setSetting2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (twoFactorCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    setSaving2FA(true)
    try {
      await authApi.twoFactor.verify(twoFactorCode)
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)
      setTwoFactorEnabled(true)
      setTwoFactorSetupMode(false)
      setTwoFactorCode('')
      setQrCodeUrl('')
      setSecretKey('')
      toast.success('Two-factor authentication is now active')
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code')
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
      toast.error('Please enter your password')
      return
    }

    setDisabling2FA(true)
    try {
      await authApi.twoFactor.disable({ password: disablePassword })
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)
      setTwoFactorEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
      toast.success('Two-factor authentication has been disabled')
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable 2FA')
    } finally {
      setDisabling2FA(false)
    }
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secretKey)
    setCopiedSecret(true)
    toast.success('Secret key copied to clipboard')
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const getInitials = () => {
    if (user?.realName) {
      return user.realName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
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
    <DashboardLayout title="Settings" subtitle="Manage your account preferences">
      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* Left Sidebar Navigation */}
        <div className="w-72 flex-shrink-0">
          <Card className="p-4 h-full">
            {/* User Profile Card */}
            <div className="flex items-center gap-3 p-3 mb-4 bg-gradient-to-r from-[#7C3AED]/10 to-[#9333EA]/5 rounded-xl">
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#9333EA] flex items-center justify-center text-white text-lg font-bold overflow-hidden ring-2 ring-white shadow">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                {twoFactorEnabled && emailVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#7C3AED] rounded-full flex items-center justify-center ring-2 ring-white">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.realName || user?.username || 'Agent'}</p>
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
                      ? 'bg-[#7C3AED] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-[#7C3AED]/5'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === item.id
                      ? 'bg-white/20'
                      : 'bg-[#7C3AED]/10 group-hover:bg-[#7C3AED]/20'
                  }`}>
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-[#7C3AED]'}`} />
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
            <div className="mt-6 p-4 bg-[#7C3AED]/5 rounded-xl border border-[#7C3AED]/10">
              <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-wider mb-3">Security Status</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Email Verified</span>
                  {emailVerified ? (
                    <span className="flex items-center gap-1 text-xs text-[#7C3AED] font-medium">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-xs text-amber-500 font-medium">Pending</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">2FA Enabled</span>
                  {twoFactorEnabled ? (
                    <span className="flex items-center gap-1 text-xs text-[#7C3AED] font-medium">
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
          <Card className="p-6 min-h-full">
            {activeTab === 'profile' ? (
              <div className="space-y-8 max-w-2xl animate-tabFadeIn">
                {/* Section Header */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Update your personal information and contact details</p>
                </div>

                {/* Profile Picture */}
                <div className="pb-6 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Profile Picture</h3>
                  <div className="flex items-center gap-5">
                    <div className="relative flex-shrink-0">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#9333EA] flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ring-4 ring-gray-100 shadow-lg"
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
                        className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#7C3AED] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
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
                <div className="pb-6 border-b border-gray-100">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                              className="flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED]/10 hover:bg-[#7C3AED]/20 text-[#7C3AED] rounded-lg text-sm font-medium transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                              Change
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 p-4 bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-xl">
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
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-all"
                              />
                              <button
                                onClick={handleSendEmailChangeCode}
                                disabled={sendingEmailChangeCode || !newEmail}
                                className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {sendingEmailChangeCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                {sendingEmailChangeCode ? 'Sending...' : 'Send Verification Code'}
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500">
                                Enter the 6-digit code sent to <span className="font-medium text-[#7C3AED]">{newEmail}</span>
                              </p>
                              <input
                                type="text"
                                value={emailChangeCode}
                                onChange={(e) => setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] transition-all"
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
                                  className="flex-1 flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  {savingEmail ? 'Verifying...' : 'Verify & Change'}
                                </button>
                              </div>
                              <button
                                onClick={handleSendEmailChangeCode}
                                disabled={sendingEmailChangeCode}
                                className="w-full text-sm text-gray-500 hover:text-[#7C3AED] transition-colors"
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
                    className="mt-4 flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

                {/* Contact Details */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Contact Details</h3>
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
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="mt-4 flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingContact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingContact ? 'Saving...' : 'Save Contact'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8 max-w-2xl animate-tabFadeIn">
                {/* Section Header */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage your password and two-factor authentication</p>
                </div>

                {/* Change Password */}
                <div className="pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-[#7C3AED]" />
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
                          className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                            className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                            className="w-full px-4 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                      className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {savingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>

                {/* Email Verification */}
                <div className="pb-6 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                        <Mail className="w-4 h-4 text-[#7C3AED]" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900">Email Verification</h3>
                    </div>
                    {emailVerified && (
                      <span className="px-2.5 py-1 bg-[#7C3AED] text-white rounded-full text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  {emailVerified ? (
                    <div className="p-4 bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
                          <Check className="w-5 h-5 text-[#7C3AED]" />
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
                        Enter the 6-digit code sent to <span className="font-medium text-[#7C3AED]">{user?.email}</span>
                      </p>
                      <input
                        type="text"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full max-w-xs px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-lg text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                          className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                        >
                          {verifyingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
                        </button>
                      </div>
                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingVerification}
                        className="text-sm text-gray-500 hover:text-[#7C3AED] transition-colors"
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
                        className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        {sendingVerification ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {sendingVerification ? 'Sending...' : 'Send Verification Code'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Two-Factor Authentication */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-[#7C3AED]" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                    </div>
                    {twoFactorEnabled && (
                      <span className="px-2.5 py-1 bg-[#7C3AED] text-white rounded-full text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Enabled
                      </span>
                    )}
                  </div>

                  {/* 2FA Already Enabled */}
                  {twoFactorEnabled && !showDisableForm && (
                    <div className="space-y-4">
                      <div className="p-4 bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#7C3AED]" />
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
                                  className="p-2 text-gray-500 hover:text-[#7C3AED] hover:bg-[#7C3AED]/10 rounded-lg transition-colors flex-shrink-0"
                                >
                                  {copiedSecret ? <Check className="w-4 h-4 text-[#7C3AED]" /> : <Copy className="w-4 h-4" />}
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
                              className="w-full max-w-xs px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all"
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
                              className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="flex items-center justify-center gap-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {setting2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        {setting2FA ? 'Setting up...' : 'Setup Two-Factor Authentication'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
