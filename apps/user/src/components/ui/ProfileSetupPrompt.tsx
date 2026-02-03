'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { settingsApi, authApi } from '@/lib/api'
import { Camera, X, Loader2, Check, Upload, UserCircle } from 'lucide-react'

export function ProfileSetupPrompt() {
  const { user, updateUser } = useAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Check if we should show the prompt
  useEffect(() => {
    if (!user) return

    const userData = user as any
    const hasEmailVerified = userData.emailVerified === true
    const has2FAEnabled = userData.twoFactorEnabled === true
    const hasProfileImage = !!userData.profileImage

    // Check if user has already dismissed this prompt in this session
    const sessionDismissed = sessionStorage.getItem('profileSetupDismissed')

    // Show prompt only if email verified AND 2FA enabled AND no profile image AND not dismissed
    if (hasEmailVerified && has2FAEnabled && !hasProfileImage && !sessionDismissed) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [user])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPreviewImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!previewImage) return

    setUploading(true)
    try {
      await settingsApi.profile.updateAvatar(previewImage)
      const { user: updatedUser } = await authApi.me()
      updateUser(updatedUser)
      setShowPrompt(false)
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleSkip = () => {
    sessionStorage.setItem('profileSetupDismissed', 'true')
    setDismissed(true)
    setShowPrompt(false)
  }

  const handleClose = () => {
    sessionStorage.setItem('profileSetupDismissed', 'true')
    setShowPrompt(false)
  }

  if (!showPrompt || dismissed) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden border border-gray-100">
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Title */}
          <div className="text-center mb-5">
            <h2 className="text-lg font-semibold text-gray-900">Add Profile Picture</h2>
            <p className="text-sm text-gray-500 mt-1">Personalize your account with a photo</p>
          </div>

          {/* Avatar Preview/Upload Area */}
          <div className="flex justify-center mb-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-28 h-28 rounded-full bg-gradient-to-br from-[#52B788] to-emerald-600 flex items-center justify-center cursor-pointer hover:opacity-90 transition-all overflow-hidden group shadow-lg ring-4 ring-[#52B788]/10"
            >
              {previewImage ? (
                <>
                  <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <span className="text-white text-3xl font-bold">
                    {(user as any)?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </>
              )}
              {/* Camera badge */}
              <div className="absolute -bottom-1 -right-1 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-gray-100">
                <Camera className="w-4 h-4 text-[#52B788]" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {previewImage ? (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Photo
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-[#52B788] hover:bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                <Upload className="w-4 h-4" />
                Choose Photo
              </button>
            )}
            <button
              onClick={handleSkip}
              className="w-full py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              Skip for now
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">JPG or PNG, max 2MB</p>
        </div>
      </div>
    </div>
  )
}
