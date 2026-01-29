'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'
import { authApi, settingsApi } from '@/lib/api'
import {
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  Camera,
  Eye,
  EyeOff,
  Check,
  Copy,
  Loader2,
  Save,
} from 'lucide-react'

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    realName: '',
    username: '',
    email: '',
    phone: '',
    phone2: '',
  })

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorSetupMode, setTwoFactorSetupMode] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [showDisableForm, setShowDisableForm] = useState(false)

  // Loading states
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [saving2FA, setSaving2FA] = useState(false)
  const [setting2FA, setSetting2FA] = useState(false)
  const [disabling2FA, setDisabling2FA] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Toast states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      const userData = user as any
      setProfileForm({
        realName: userData.realName || '',
        username: user.username || '',
        email: user.email || '',
        phone: userData.phone || '',
        phone2: userData.phone2 || '',
      })
      setTwoFactorEnabled(userData.twoFactorEnabled || false)
    }
  }, [user])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size must be less than 5MB', 'error')
      return
    }

    setUploadingAvatar(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        try {
          const response = await settingsApi.profile.updateAvatar(base64)
          // Refresh user data
          const { user: updatedUser } = await authApi.me()
          updateUser(updatedUser)
          showToast('Avatar updated successfully', 'success')
        } catch (error) {
          showToast('Failed to upload avatar', 'error')
        }
        setUploadingAvatar(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      showToast('Failed to upload avatar', 'error')
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await settingsApi.profile.update({
        username: profileForm.username,
        realName: profileForm.realName,
        phone: profileForm.phone,
        phone2: profileForm.phone2,
      })
      // Refresh user data
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      showToast('Profile updated successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Passwords do not match', 'error')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error')
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      showToast('Password changed successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to change password', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSetup2FA = async () => {
    setSetting2FA(true)
    try {
      const response = await authApi.twoFactor.setup()
      setSecretKey(response.secret)
      // Generate QR code URL using a public QR code API
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
      // Refresh user data
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setTwoFactorEnabled(true)
      setTwoFactorSetupMode(false)
      setTwoFactorCode('')
      setQrCodeUrl('')
      setSecretKey('')
      showToast('Two-factor authentication enabled successfully', 'success')
    } catch (error: any) {
      showToast(error.message || 'Invalid verification code', 'error')
    } finally {
      setSaving2FA(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      showToast('Please enter your password', 'error')
      return
    }

    setDisabling2FA(true)
    try {
      await authApi.twoFactor.disable({ password: disablePassword })
      // Refresh user data
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setTwoFactorEnabled(false)
      setShowDisableForm(false)
      setDisablePassword('')
      showToast('Two-factor authentication disabled', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to disable 2FA', 'error')
    } finally {
      setDisabling2FA(false)
    }
  }

  const handleCancelSetup = () => {
    setTwoFactorSetupMode(false)
    setQrCodeUrl('')
    setSecretKey('')
    setTwoFactorCode('')
  }

  const copySecretKey = () => {
    navigator.clipboard.writeText(secretKey)
    setCopiedSecret(true)
    setTimeout(() => setCopiedSecret(false), 2000)
  }

  const getInitials = () => {
    const userData = user as any
    if (userData?.realName) {
      return userData.realName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.username?.slice(0, 2).toUpperCase() || 'U'
  }

  return (
    <DashboardLayout title="Profile Settings" subtitle="Update profile and password for secure access.">
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
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
      `}</style>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Avatar & Basic Info Card */}
            <Card className="p-6">
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    onClick={handleAvatarClick}
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center text-white text-3xl font-bold cursor-pointer hover:opacity-90 transition-opacity overflow-hidden ring-4 ring-white shadow-lg"
                  >
                    {(user as any)?.profileImage ? (
                      <img src={(user as any).profileImage} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      getInitials()
                    )}
                  </div>
                  <button
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#8B5CF6] rounded-full flex items-center justify-center text-white shadow-lg hover:bg-[#7C3AED] transition-colors disabled:opacity-50"
                  >
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">
                    {(user as any)?.realName || user?.username || 'User'}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[#52B788]/10 text-[#52B788] rounded-full text-xs font-medium">
                      {user?.role || 'User'}
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                      {(user as any)?.status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Personal Information */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Personal Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Real Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={profileForm.realName}
                      onChange={(e) => setProfileForm({ ...profileForm, realName: e.target.value })}
                      placeholder="Enter your real name"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      placeholder="Enter username"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Contact Details */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-[#52B788]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Contact Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact # 1</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact # 2</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={profileForm.phone2}
                      onChange={(e) => setProfileForm({ ...profileForm, phone2: e.target.value })}
                      placeholder="+1 234 567 8900"
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Save Profile Button */}
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Profile
                    </>
                  )}
                </button>
              </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Password Settings */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Password Settings</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="w-full pl-10 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-12 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white py-2.5 rounded-xl font-medium shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </Card>

            {/* Two-Factor Authentication */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[#52B788]" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h3>
                </div>
                {twoFactorEnabled && (
                  <span className="px-2.5 py-1 bg-[#52B788]/10 text-[#52B788] rounded-full text-xs font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Enabled
                  </span>
                )}
              </div>

              {/* 2FA Already Enabled - Show disable option */}
              {twoFactorEnabled && !showDisableForm && (
                <div className="space-y-4">
                  <div className="p-4 bg-[#52B788]/5 border border-[#52B788]/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#52B788]/10 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-[#52B788]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Two-factor authentication is active</p>
                        <p className="text-xs text-gray-500">Your account is protected with 2FA</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDisableForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition-all"
                  >
                    Disable 2FA
                  </button>
                </div>
              )}

              {/* Disable 2FA Form */}
              {twoFactorEnabled && showDisableForm && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Enter your password to disable two-factor authentication.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 focus:border-[#8B5CF6] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowDisableForm(false); setDisablePassword(''); }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDisable2FA}
                      disabled={disabling2FA || !disablePassword}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-2.5 rounded-xl font-medium shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {disabling2FA ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        'Disable 2FA'
                      )}
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

                  {/* QR Code */}
                  {qrCodeUrl && (
                    <div className="flex justify-center">
                      <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                        <img src={qrCodeUrl} alt="2FA QR Code" className="w-36 h-36" />
                      </div>
                    </div>
                  )}

                  {/* Secret Key */}
                  {secretKey && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Can't scan? Enter this code manually:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-700 break-all">{secretKey}</code>
                        <button
                          onClick={copySecretKey}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                        >
                          {copiedSecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verification Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification Code</label>
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-[#52B788]/20 focus:border-[#52B788] focus:bg-white transition-all"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelSetup}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleVerify2FA}
                      disabled={saving2FA || twoFactorCode.length !== 6}
                      className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#52B788] to-[#40A578] hover:from-[#40A578] hover:to-[#369968] text-white py-2.5 rounded-xl font-medium shadow-lg shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving2FA ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" />
                          Enable 2FA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Not enabled - Show setup button */}
              {!twoFactorEnabled && !twoFactorSetupMode && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                  <button
                    onClick={handleSetup2FA}
                    disabled={setting2FA}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#52B788] to-[#40A578] hover:from-[#40A578] hover:to-[#369968] text-white py-2.5 rounded-xl font-medium shadow-lg shadow-green-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {setting2FA ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Setup Two-Factor Authentication
                      </>
                    )}
                  </button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
