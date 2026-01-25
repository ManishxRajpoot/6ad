'use client'

import { useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth'
import { brandingApi, authApi } from '@/lib/api'
import { Upload, X, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [brandName, setBrandName] = useState(user?.brandName || '')
  const [brandLogo, setBrandLogo] = useState(user?.brandLogo || '')
  const [isSavingBrand, setIsSavingBrand] = useState(false)
  const [brandMessage, setBrandMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setBrandMessage({ type: 'error', text: 'Logo must be less than 2MB' })
        return
      }

      // Convert to base64
      const reader = new FileReader()
      reader.onloadend = () => {
        setBrandLogo(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveBranding = async () => {
    setIsSavingBrand(true)
    setBrandMessage(null)

    try {
      await brandingApi.update({
        brandLogo: brandLogo || undefined,
        brandName: brandName || undefined,
      })

      // Refresh user data
      const { user: updatedUser } = await authApi.me()
      setUser(updatedUser)

      setBrandMessage({ type: 'success', text: 'Branding updated successfully!' })
    } catch (error: any) {
      setBrandMessage({ type: 'error', text: error.message || 'Failed to update branding' })
    } finally {
      setIsSavingBrand(false)
    }
  }

  const removeLogo = () => {
    setBrandLogo('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <DashboardLayout title="Settings" subtitle="Manage your account settings">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Profile Information</h2>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Username" defaultValue={user?.username || ''} />
              <Input label="Email" type="email" defaultValue={user?.email || ''} disabled />
            </div>
            <Input label="Phone Number" placeholder="+91 98765 43210" />
            <Input label="Business Name" placeholder="Your Agency Name" />
            <div className="pt-4">
              <Button>Save Changes</Button>
            </div>
          </form>
        </Card>

        {/* Whitelabel Branding */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Whitelabel Branding</h2>
          <p className="text-sm text-gray-500 mb-6">Customize your brand for your users</p>

          <div className="space-y-4">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brand Logo</label>
              {brandLogo ? (
                <div className="relative w-full h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <img
                    src={brandLogo}
                    alt="Brand Logo"
                    className="max-h-20 max-w-full object-contain"
                  />
                  <button
                    onClick={removeLogo}
                    className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Upload Logo</span>
                  <span className="text-xs text-gray-400">Max 2MB</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            {/* Brand Name */}
            <Input
              label="Brand Name"
              placeholder="Your Brand Name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />

            {/* Message */}
            {brandMessage && (
              <div className={`p-3 rounded-lg text-sm ${brandMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {brandMessage.text}
              </div>
            )}

            {/* Save Button */}
            <Button onClick={handleSaveBranding} disabled={isSavingBrand} className="w-full">
              {isSavingBrand ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Branding'
              )}
            </Button>
          </div>
        </Card>

        {/* Security */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-6">Security</h2>
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Two-Factor Authentication
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Active Sessions
            </Button>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-500">Receive email updates about your account</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Transaction Alerts</p>
                <p className="text-sm text-gray-500">Get notified about deposits and withdrawals</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">User Activity</p>
                <p className="text-sm text-gray-500">Updates about user registrations and activity</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 border-red-200">
          <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="danger">Delete Account</Button>
        </Card>
      </div>
    </DashboardLayout>
  )
}
