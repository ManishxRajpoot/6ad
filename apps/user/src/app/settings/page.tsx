'use client'

import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/auth'

export default function SettingsPage() {
  const { user } = useAuthStore()

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
            <div className="pt-4">
              <Button>Save Changes</Button>
            </div>
          </form>
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

        {/* Bank Details */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-6">Saved Bank Details</h2>
          <div className="border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">HDFC Bank ****7890</p>
                <p className="text-sm text-gray-500">John Doe</p>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Primary</span>
            </div>
          </div>
          <Button variant="outline">Add New Bank Account</Button>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-6">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-500">Transaction updates</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">SMS</p>
                <p className="text-sm text-gray-500">Important alerts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
              </label>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
