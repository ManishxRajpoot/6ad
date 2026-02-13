'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  return (
    <Suspense fallback={<DashboardLayout title="Settings"><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div></DashboardLayout>}>
      <SettingsContent />
    </Suspense>
  )
}

function SettingsContent() {
  const { user, setUser } = useAuthStore()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Tab state
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const tab = searchParams.get('tab')
    return tab === 'security' ? 'security' : 'profile'
  })

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
          toast.success('Profile picture updated')
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
      toast.success('Profile updated')
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
      toast.success('Contact details updated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update contact')
    } finally {
      setSavingContact(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword) {
      toast.error('Enter current password')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword({ currentPassword: oldPassword, newPassword })
      toast.success('Password updated')
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
      toast.success('Code sent to email')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send code')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (emailCode.length !== 6) {
      toast.error('Enter valid 6-digit code')
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
      toast.success('Email verified')
    } catch (error: any) {
      toast.error(error.message || 'Invalid code')
    } finally {
      setVerifyingEmail(false)
    }
  }

  const handleSendEmailChangeCode = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Enter valid email')
      return
    }

    setSendingEmailChangeCode(true)
    try {
      await authApi.email.sendChangeCode(newEmail)
      setEmailChangeCodeSent(true)
      toast.success('Code sent to new email')
    } catch (error: any) {
      toast.error(error.message || 'Failed to send code')
    } finally {
      setSendingEmailChangeCode(false)
    }
  }

  const handleVerifyEmailChange = async () => {
    if (emailChangeCode.length !== 6) {
      toast.error('Enter valid 6-digit code')
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
      toast.success('Email changed')
    } catch (error: any) {
      toast.error(error.message || 'Invalid code')
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
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(response.otpauthUrl)}`
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
      toast.error('Enter valid 6-digit code')
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
      toast.success('2FA enabled')
    } catch (error: any) {
      toast.error(error.message || 'Invalid code')
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
      toast.error('Enter your password')
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
      toast.success('2FA disabled')
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable 2FA')
    } finally {
      setDisabling2FA(false)
    }
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secretKey)
    setCopiedSecret(true)
    toast.success('Copied')
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const getInitials = () => {
    if (user?.realName) {
      return user.realName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.username?.slice(0, 2).toUpperCase() || 'U'
  }

  const menuItems = [
    { id: 'profile' as TabType, label: 'Profile Settings', icon: UserCircle, description: 'Personal info' },
    { id: 'security' as TabType, label: 'Security', icon: ShieldCheck, description: 'Password & 2FA' }
  ]

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* Left Sidebar Navigation */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <Card className="p-3">
            {/* User Profile Card */}
            <div className="flex items-center gap-2.5 p-2.5 mb-3 bg-gradient-to-r from-teal-600/10 to-teal-500/5 rounded-lg">
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center text-white text-sm font-bold overflow-hidden ring-2 ring-white shadow-sm">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    getInitials()
                  )}
                </div>
                {twoFactorEnabled && emailVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-teal-600 rounded-full flex items-center justify-center ring-2 ring-white">
                    <Check className="w-2 h-2 text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{user?.realName || user?.username || 'Agent'}</p>
                <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-200 group ${
                    activeTab === item.id
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-teal-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    activeTab === item.id ? 'bg-white/20' : 'bg-teal-100 group-hover:bg-teal-200'
                  }`}>
                    <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-teal-600'}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-[13px] font-medium ${activeTab === item.id ? 'text-white' : 'text-gray-900'}`}>
                      {item.label}
                    </p>
                    <p className={`text-[10px] ${activeTab === item.id ? 'text-white/70' : 'text-gray-400'}`}>
                      {item.description}
                    </p>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${activeTab === item.id ? 'text-white/70' : 'text-gray-300'}`} />
                </button>
              ))}
            </nav>

            {/* Security Status */}
            <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-100">
              <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider mb-2">Security Status</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-600">Email Verified</span>
                  {emailVerified ? (
                    <span className="flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-medium">Pending</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-600">2FA Enabled</span>
                  {twoFactorEnabled ? (
                    <span className="flex items-center gap-1 text-[10px] text-teal-600 font-medium">
                      <Check className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-500 font-medium">No</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          <Card className="p-4">
            {activeTab === 'profile' ? (
              <div className="space-y-5 max-w-xl">
                {/* Section Header */}
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">Profile Settings</h2>
                  <p className="text-[12px] text-gray-500">Update your personal information</p>
                </div>

                {/* Profile Picture */}
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-[12px] font-medium text-gray-700 mb-3">Profile Picture</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center text-white text-lg font-bold cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ring-2 ring-gray-100 shadow"
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
                        className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center text-white shadow hover:bg-teal-700 transition-colors disabled:opacity-50"
                      >
                        {savingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-gray-900">Upload new picture</p>
                      <p className="text-[10px] text-gray-500">JPG, PNG. Max 2MB</p>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="pb-4 border-b border-gray-100">
                  <h3 className="text-[12px] font-medium text-gray-700 mb-3">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Username</label>
                      <input
                        type="text"
                        value={user?.username || ''}
                        disabled
                        className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-[13px] text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-gray-600 mb-1">Email Address</label>
                      {!showEmailChange ? (
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-[13px] text-gray-500 cursor-not-allowed"
                          />
                          {emailVerified && (
                            <button
                              onClick={() => setShowEmailChange(true)}
                              className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-lg text-[12px] font-medium transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Change
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2.5 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-medium text-gray-900">Change Email</p>
                            <button onClick={handleCancelEmailChange} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {!emailChangeCodeSent ? (
                            <>
                              <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="New email address"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                              />
                              <button
                                onClick={handleSendEmailChangeCode}
                                disabled={sendingEmailChangeCode || !newEmail}
                                className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                              >
                                {sendingEmailChangeCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                                {sendingEmailChangeCode ? 'Sending...' : 'Send Code'}
                              </button>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] text-gray-500">Code sent to <span className="font-medium text-teal-600">{newEmail}</span></p>
                              <input
                                type="text"
                                value={emailChangeCode}
                                onChange={(e) => setEmailChangeCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[14px] text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                              />
                              <div className="flex gap-2">
                                <button onClick={() => setEmailChangeCodeSent(false)} className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium transition-all">Back</button>
                                <button
                                  onClick={handleVerifyEmailChange}
                                  disabled={savingEmail || emailChangeCode.length !== 6}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                                >
                                  {savingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Verify
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="mt-3 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>

                {/* Contact Details */}
                <div>
                  <h3 className="text-[12px] font-medium text-gray-700 mb-3">Contact Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Primary Contact</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="tel"
                          value={contact1}
                          onChange={(e) => setContact1(e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Secondary Contact</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="tel"
                          value={contact2}
                          onChange={(e) => setContact2(e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="mt-3 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                  >
                    {savingContact ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Contact
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-w-xl">
                {/* Section Header */}
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">Security Settings</h2>
                  <p className="text-[12px] text-gray-500">Manage password and 2FA</p>
                </div>

                {/* Change Password */}
                <div className="pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Key className="w-3.5 h-3.5 text-teal-600" />
                    </div>
                    <h3 className="text-[12px] font-medium text-gray-700">Change Password</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-gray-600 mb-1">Current Password</label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? 'text' : 'password'}
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Current password"
                          className="w-full px-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                        />
                        <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showOldPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">New Password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password"
                            className="w-full px-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                          />
                          <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Confirm Password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                            className="w-full px-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                          />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={savingPassword || !oldPassword || !newPassword || !confirmPassword}
                      className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                    >
                      {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      Change Password
                    </button>
                  </div>
                </div>

                {/* Email Verification */}
                <div className="pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                        <Mail className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <h3 className="text-[12px] font-medium text-gray-700">Email Verification</h3>
                    </div>
                    {emailVerified && (
                      <span className="px-2 py-0.5 bg-teal-600 text-white rounded-full text-[10px] font-medium flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Verified
                      </span>
                    )}
                  </div>

                  {emailVerified ? (
                    <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                        <Check className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium text-gray-900">Email verified</p>
                        <p className="text-[10px] text-gray-500">{user?.email}</p>
                      </div>
                    </div>
                  ) : emailCodeSent ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-gray-500">Code sent to <span className="font-medium text-teal-600">{user?.email}</span></p>
                      <input
                        type="text"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        maxLength={6}
                        className="w-full max-w-[180px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[14px] text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setEmailCodeSent(false); setEmailCode(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium transition-all">Cancel</button>
                        <button
                          onClick={handleVerifyEmail}
                          disabled={verifyingEmail || emailCode.length !== 6}
                          className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                        >
                          {verifyingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-gray-500">Verify your email to secure your account.</p>
                      <button
                        onClick={handleSendEmailCode}
                        disabled={sendingVerification}
                        className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                      >
                        {sendingVerification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Send Code
                      </button>
                    </div>
                  )}
                </div>

                {/* Two-Factor Authentication */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <h3 className="text-[12px] font-medium text-gray-700">Two-Factor Authentication</h3>
                    </div>
                    {twoFactorEnabled && (
                      <span className="px-2 py-0.5 bg-teal-600 text-white rounded-full text-[10px] font-medium flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Enabled
                      </span>
                    )}
                  </div>

                  {twoFactorEnabled && !showDisableForm && (
                    <div className="space-y-3">
                      <div className="p-3 bg-teal-50 border border-teal-100 rounded-lg flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-gray-900">2FA is active</p>
                          <p className="text-[10px] text-gray-500">Protected with authenticator app</p>
                        </div>
                      </div>
                      <button onClick={() => setShowDisableForm(true)} className="text-[11px] text-gray-500 hover:text-red-500 transition-colors">
                        Disable 2FA
                      </button>
                    </div>
                  )}

                  {twoFactorEnabled && showDisableForm && (
                    <div className="space-y-3">
                      <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-[11px] text-red-600"><strong>Warning:</strong> This will make your account less secure.</p>
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-600 mb-1">Enter password to confirm</label>
                        <input
                          type="password"
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          placeholder="Password"
                          className="w-full max-w-[200px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setShowDisableForm(false); setDisablePassword(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium transition-all">Cancel</button>
                        <button
                          onClick={handleDisable2FA}
                          disabled={disabling2FA || !disablePassword}
                          className="flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                        >
                          {disabling2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disable'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!twoFactorEnabled && twoFactorSetupMode && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-gray-500">Scan QR code with your authenticator app</p>
                      <div className="flex flex-col md:flex-row items-start gap-4">
                        {qrCodeUrl && (
                          <div className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <img src={qrCodeUrl} alt="2FA QR" className="w-28 h-28" />
                          </div>
                        )}
                        <div className="flex-1 space-y-3">
                          {secretKey && (
                            <div>
                              <p className="text-[10px] text-gray-500 mb-1">Manual code:</p>
                              <div className="flex items-center gap-1.5">
                                <code className="flex-1 px-2 py-1.5 bg-gray-100 rounded text-[11px] font-mono text-gray-700 break-all">{secretKey}</code>
                                <button onClick={copySecretKey} className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors flex-shrink-0">
                                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="block text-[11px] text-gray-600 mb-1">Enter 6-digit code</label>
                            <input
                              type="text"
                              value={twoFactorCode}
                              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="000000"
                              maxLength={6}
                              className="w-full max-w-[150px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[13px] text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition-all"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleCancelSetup} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[12px] font-medium transition-all">Cancel</button>
                            <button
                              onClick={handleVerify2FA}
                              disabled={saving2FA || twoFactorCode.length !== 6}
                              className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                            >
                              {saving2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                              Enable
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!twoFactorEnabled && !twoFactorSetupMode && (
                    <div className="space-y-3">
                      <p className="text-[11px] text-gray-500">Add extra security with an authenticator app.</p>
                      <button
                        onClick={handleSetup2FA}
                        disabled={setting2FA}
                        className="flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                      >
                        {setting2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                        Setup 2FA
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
