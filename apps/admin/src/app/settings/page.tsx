'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/Table'
import { settingsApi, cheetahApi, cryptoApi } from '@/lib/api'
import { Plus, Edit, Trash2, CreditCard, Copy, Check, Globe, Eye, EyeOff, Ban, Link, Save, Mail, Palette, Send, Server, Zap, RefreshCw, DollarSign, Wallet, Coins, Database } from 'lucide-react'
import { FacebookPlatformIcon, GooglePlatformIcon, TikTokPlatformIcon, SnapchatPlatformIcon, BingPlatformIcon } from '@/components/icons/PlatformIcons'

type PayLink = {
  id: string
  title: string
  description: string | null
  upiId: string | null
  bankName: string | null
  accountNumber: string | null
  ifscCode: string | null
  isActive: boolean
}

type PlatformStatus = 'active' | 'stop' | 'hidden'

type PlatformSettings = {
  facebook: PlatformStatus
  google: PlatformStatus
  tiktok: PlatformStatus
  snapchat: PlatformStatus
  bing: PlatformStatus
}

export default function SettingsPage() {
  const [paylinks, setPaylinks] = useState<PayLink[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPaylink, setEditingPaylink] = useState<PayLink | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    upiId: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    isActive: true,
  })
  const [formLoading, setFormLoading] = useState(false)

  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    facebook: 'active',
    google: 'active',
    tiktok: 'active',
    snapchat: 'active',
    bing: 'active',
  })
  const [platformLoading, setPlatformLoading] = useState(true)
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)

  // Profile share links state
  const [profileShareLinks, setProfileShareLinks] = useState({
    facebook: 'https://www.facebook.com/profile/6adplatform',
    tiktok: 'https://business.tiktok.com/share/6adplatform',
  })
  const [profileLinksLoading, setProfileLinksLoading] = useState(true)
  const [savingProfileLinks, setSavingProfileLinks] = useState(false)

  // Referral domain state
  const [referralDomain, setReferralDomain] = useState('https://ads.sixad.io')
  const [referralDomainLoading, setReferralDomainLoading] = useState(true)
  const [savingReferralDomain, setSavingReferralDomain] = useState(false)

  // Email branding state
  const [emailBranding, setEmailBranding] = useState({
    brandName: 'COINEST',
    brandLogo: '6',
    primaryColor: '#52B788',
    secondaryColor: '#8B5CF6',
    senderEmail: 'noreply@coinest.com',
    senderName: 'COINEST',
    helpCenterUrl: 'https://help.coinest.com',
    contactSupportUrl: 'https://coinest.com/support',
  })
  const [emailBrandingLoading, setEmailBrandingLoading] = useState(true)
  const [savingEmailBranding, setSavingEmailBranding] = useState(false)

  // SMTP settings state
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    isConfigured: false,
  })
  const [smtpLoading, setSmtpLoading] = useState(true)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)

  // Ad Account API state
  const [cheetahEnvironment, setCheetahEnvironment] = useState<'test' | 'production'>('test')
  const [cheetahConfigLoading, setCheetahConfigLoading] = useState(true)
  const [savingCheetahConfig, setSavingCheetahConfig] = useState(false)
  const [cheetahConfigured, setCheetahConfigured] = useState(false)
  const [cheetahQuota, setCheetahQuota] = useState<string | null>(null)
  const [loadingQuota, setLoadingQuota] = useState(false)

  // Crypto Wallet state
  const [cryptoWallets, setCryptoWallets] = useState<{
    TRON_TRC20: { walletAddress: string; isEnabled: boolean };
    BSC_BEP20: { walletAddress: string; isEnabled: boolean };
  }>({
    TRON_TRC20: { walletAddress: '', isEnabled: false },
    BSC_BEP20: { walletAddress: '', isEnabled: false }
  })
  const [cryptoWalletsLoading, setCryptoWalletsLoading] = useState(true)
  const [savingCryptoWallet, setSavingCryptoWallet] = useState<string | null>(null)


  const fetchPlatformSettings = async () => {
    try {
      const { platforms } = await settingsApi.platforms.get()
      setPlatformSettings(platforms as PlatformSettings)
    } catch {
      // Silently fail - use default settings if API is unavailable
    } finally {
      setPlatformLoading(false)
    }
  }

  const updatePlatformStatus = async (platform: keyof PlatformSettings, status: PlatformStatus) => {
    setSavingPlatform(platform)
    try {
      await settingsApi.platforms.update({ [platform]: status })
      setPlatformSettings(prev => ({ ...prev, [platform]: status }))
    } catch (error) {
      console.error('Failed to update platform status:', error)
    } finally {
      setSavingPlatform(null)
    }
  }

  const fetchProfileShareLinks = async () => {
    try {
      const { profileShareLinks: links } = await settingsApi.profileShareLinks.get()
      setProfileShareLinks(links)
    } catch {
      // Silently fail - use default settings if API is unavailable
    } finally {
      setProfileLinksLoading(false)
    }
  }

  const saveProfileShareLinks = async () => {
    setSavingProfileLinks(true)
    try {
      await settingsApi.profileShareLinks.update(profileShareLinks)
      alert('Profile share links saved successfully!')
    } catch (error) {
      console.error('Failed to save profile share links:', error)
      alert('Failed to save profile share links')
    } finally {
      setSavingProfileLinks(false)
    }
  }

  const fetchReferralDomain = async () => {
    try {
      const { referralDomain: domain } = await settingsApi.referralDomain.get()
      setReferralDomain(domain || 'https://ads.sixad.io')
    } catch {
      // Silently fail - use default
    } finally {
      setReferralDomainLoading(false)
    }
  }

  const saveReferralDomain = async () => {
    setSavingReferralDomain(true)
    try {
      await settingsApi.referralDomain.update(referralDomain)
      alert('Referral domain saved successfully!')
    } catch (error) {
      console.error('Failed to save referral domain:', error)
      alert('Failed to save referral domain')
    } finally {
      setSavingReferralDomain(false)
    }
  }

  const fetchEmailBranding = async () => {
    try {
      const { branding } = await settingsApi.emailBranding.get()
      if (branding) {
        setEmailBranding(branding)
      }
    } catch {
      // Silently fail - use default settings
    } finally {
      setEmailBrandingLoading(false)
    }
  }

  const saveEmailBranding = async () => {
    setSavingEmailBranding(true)
    try {
      await settingsApi.emailBranding.update(emailBranding)
      alert('Email branding saved successfully!')
    } catch (error) {
      console.error('Failed to save email branding:', error)
      alert('Failed to save email branding')
    } finally {
      setSavingEmailBranding(false)
    }
  }

  const fetchSmtpSettings = async () => {
    try {
      const { smtp } = await settingsApi.smtp.get()
      if (smtp) {
        setSmtpSettings({ ...smtp, password: '' })
      }
    } catch {
      // Silently fail - use default settings
    } finally {
      setSmtpLoading(false)
    }
  }

  const saveSmtpSettings = async () => {
    setSavingSmtp(true)
    try {
      await settingsApi.smtp.update({
        host: smtpSettings.host,
        port: smtpSettings.port,
        secure: smtpSettings.secure,
        user: smtpSettings.user,
        ...(smtpSettings.password ? { password: smtpSettings.password } : {}),
      })
      alert('SMTP settings saved successfully!')
      setSmtpSettings(prev => ({ ...prev, password: '', isConfigured: true }))
    } catch (error) {
      console.error('Failed to save SMTP settings:', error)
      alert('Failed to save SMTP settings')
    } finally {
      setSavingSmtp(false)
    }
  }

  const testSmtpConnection = async () => {
    if (!testEmail) {
      alert('Please enter a test email address')
      return
    }
    setTestingSmtp(true)
    try {
      const result = await settingsApi.smtp.test(testEmail)
      if (result.success) {
        alert('Test email sent successfully! Please check your inbox.')
      } else {
        alert(`Test failed: ${result.message}`)
      }
    } catch (error: any) {
      console.error('SMTP test failed:', error)
      alert(`Test failed: ${error.message || 'Unknown error'}`)
    } finally {
      setTestingSmtp(false)
    }
  }

  const fetchPaylinks = async () => {
    try {
      const { paylinks } = await settingsApi.paylinks.getAll()
      setPaylinks(paylinks || [])
    } catch {
      // Silently fail - show empty state if API is unavailable
    } finally {
      setLoading(false)
    }
  }

  const fetchCryptoWallets = async () => {
    try {
      const { configs } = await cryptoApi.config.getAll()
      const walletsMap: any = {
        TRON_TRC20: { walletAddress: '', isEnabled: false },
        BSC_BEP20: { walletAddress: '', isEnabled: false }
      }
      configs?.forEach((config: any) => {
        if (config.network === 'TRON_TRC20' || config.network === 'BSC_BEP20') {
          walletsMap[config.network] = {
            walletAddress: config.walletAddress || '',
            isEnabled: config.isEnabled || false
          }
        }
      })
      setCryptoWallets(walletsMap)
    } catch {
      // Silently fail
    } finally {
      setCryptoWalletsLoading(false)
    }
  }

  const saveCryptoWallet = async (network: 'TRON_TRC20' | 'BSC_BEP20') => {
    const wallet = cryptoWallets[network]
    if (!wallet.walletAddress) {
      alert('Wallet address is required')
      return
    }
    setSavingCryptoWallet(network)
    try {
      await cryptoApi.config.save({
        network,
        walletAddress: wallet.walletAddress,
        isEnabled: wallet.isEnabled
      })
      alert(`${network === 'TRON_TRC20' ? 'TRC20' : 'BEP20'} wallet saved successfully!`)
    } catch (error: any) {
      alert(`Failed to save: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingCryptoWallet(null)
    }
  }

  const toggleCryptoWallet = async (network: 'TRON_TRC20' | 'BSC_BEP20') => {
    const wallet = cryptoWallets[network]
    if (!wallet.walletAddress && !wallet.isEnabled) {
      alert('Please configure wallet address first')
      return
    }
    setSavingCryptoWallet(network)
    try {
      await cryptoApi.config.update(network, { isEnabled: !wallet.isEnabled })
      setCryptoWallets(prev => ({
        ...prev,
        [network]: { ...prev[network], isEnabled: !wallet.isEnabled }
      }))
    } catch (error: any) {
      alert(`Failed to toggle: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingCryptoWallet(null)
    }
  }

  const fetchCheetahConfig = async () => {
    try {
      const status = await cheetahApi.config.getStatus()
      setCheetahConfigured(status.isConfigured)
      if (status.environment) {
        setCheetahEnvironment(status.environment as 'test' | 'production')
      }
      if (status.isConfigured) {
        fetchCheetahQuota()
      }
    } catch {
      // Silently fail
    } finally {
      setCheetahConfigLoading(false)
    }
  }

  const saveCheetahConfig = async () => {
    setSavingCheetahConfig(true)
    try {
      await cheetahApi.config.update({ environment: cheetahEnvironment })
      alert(`API configured successfully! (${cheetahEnvironment} environment)`)
      setCheetahConfigured(true)
      fetchCheetahQuota()
    } catch (error: any) {
      console.error('Failed to save config:', error)
      alert(`Failed to configure: ${error.message || 'Unknown error'}`)
    } finally {
      setSavingCheetahConfig(false)
    }
  }

  const fetchCheetahQuota = async () => {
    setLoadingQuota(true)
    try {
      const result = await cheetahApi.finance.getQuota()
      setCheetahQuota(result.available_quota)
    } catch {
      setCheetahQuota(null)
    } finally {
      setLoadingQuota(false)
    }
  }

  useEffect(() => {
    fetchPaylinks()
    fetchPlatformSettings()
    fetchProfileShareLinks()
    fetchReferralDomain()
    fetchEmailBranding()
    fetchSmtpSettings()
    fetchCheetahConfig()
    fetchCryptoWallets()
  }, [])

  const handleOpenModal = (paylink?: PayLink) => {
    if (paylink) {
      setEditingPaylink(paylink)
      setFormData({
        title: paylink.title,
        description: paylink.description || '',
        upiId: paylink.upiId || '',
        bankName: paylink.bankName || '',
        accountNumber: paylink.accountNumber || '',
        ifscCode: paylink.ifscCode || '',
        isActive: paylink.isActive,
      })
    } else {
      setEditingPaylink(null)
      setFormData({
        title: '',
        description: '',
        upiId: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        isActive: true,
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (editingPaylink) {
        await settingsApi.paylinks.update(editingPaylink.id, formData)
      } else {
        await settingsApi.paylinks.create(formData)
      }

      setIsModalOpen(false)
      fetchPaylinks()
    } catch (error: any) {
      alert(error.message || 'Failed to save payment method')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      await settingsApi.paylinks.delete(id)
      fetchPaylinks()
    } catch (error: any) {
      alert(error.message || 'Failed to delete payment method')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const platformList = [
    { key: 'facebook' as const, name: 'Facebook', icon: <FacebookPlatformIcon className="w-5 h-5" />, color: 'bg-blue-500' },
    { key: 'google' as const, name: 'Google', icon: <GooglePlatformIcon className="w-5 h-5" />, color: 'bg-red-500' },
    { key: 'tiktok' as const, name: 'TikTok', icon: <TikTokPlatformIcon className="w-5 h-5" />, color: 'bg-black' },
    { key: 'snapchat' as const, name: 'Snapchat', icon: <SnapchatPlatformIcon className="w-5 h-5" />, color: 'bg-yellow-400' },
    { key: 'bing' as const, name: 'Bing', icon: <BingPlatformIcon className="w-5 h-5" />, color: 'bg-teal-500' },
  ]

  const getStatusBadge = (status: PlatformStatus) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><Eye className="h-3 w-3" /> Active</span>
      case 'stop':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Ban className="h-3 w-3" /> Stop Opening</span>
      case 'hidden':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><EyeOff className="h-3 w-3" /> Hidden</span>
    }
  }

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        {/* Platform Visibility Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Globe className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Platform Visibility</CardTitle>
                <p className="text-sm text-gray-500">Control which platforms are visible to users</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {platformLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                {platformList.map((platform) => (
                  <div key={platform.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${platform.color} text-white text-xl`}>
                        {platform.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{platform.name}</p>
                        <p className="text-xs text-gray-500">
                          {platformSettings[platform.key] === 'active' && 'Users can see and apply for new accounts'}
                          {platformSettings[platform.key] === 'stop' && 'Users can see but cannot apply for new accounts'}
                          {platformSettings[platform.key] === 'hidden' && 'Platform is completely hidden from users'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(platformSettings[platform.key])}
                      <select
                        value={platformSettings[platform.key]}
                        onChange={(e) => updatePlatformStatus(platform.key, e.target.value as PlatformStatus)}
                        disabled={savingPlatform === platform.key}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                      >
                        <option value="active">✓ Active</option>
                        <option value="stop">⏸ Stop Opening</option>
                        <option value="hidden">👁 Super Hide</option>
                      </select>
                      {savingPlatform === platform.key && (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                      )}
                    </div>
                  </div>
                ))}
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium mb-2">Status Descriptions:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li><strong>Active:</strong> Platform tab visible, users can apply for new ad accounts</li>
                    <li><strong>Stop Opening:</strong> Platform tab visible, users can only manage existing accounts (cannot apply for new)</li>
                    <li><strong>Super Hide:</strong> Platform tab completely hidden from user sidebar</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Share Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Link className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Profile Share Links</CardTitle>
                <p className="text-sm text-gray-500">Configure profile share links displayed to users for page sharing</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {profileLinksLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Facebook Profile Share Link */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                      <FacebookPlatformIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Facebook Profile Share Link</p>
                      <p className="text-xs text-gray-500">Link shown to users when sharing their Facebook page</p>
                    </div>
                  </div>
                  <Input
                    id="facebookProfileShareLink"
                    value={profileShareLinks.facebook}
                    onChange={(e) => setProfileShareLinks(prev => ({ ...prev, facebook: e.target.value }))}
                    placeholder="https://www.facebook.com/profile/yourpage"
                  />
                </div>

                {/* TikTok Profile Share Link */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black text-white">
                      <TikTokPlatformIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">TikTok Profile Share Link</p>
                      <p className="text-xs text-gray-500">Link shown to users when sharing their TikTok business page</p>
                    </div>
                  </div>
                  <Input
                    id="tiktokProfileShareLink"
                    value={profileShareLinks.tiktok}
                    onChange={(e) => setProfileShareLinks(prev => ({ ...prev, tiktok: e.target.value }))}
                    placeholder="https://business.tiktok.com/share/yourpage"
                  />
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={saveProfileShareLinks} disabled={savingProfileLinks}>
                    {savingProfileLinks ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Profile Links
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium mb-2">About Profile Share Links:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>These links are displayed to users when they need to share their page with your platform</li>
                    <li>Users will see a checkbox confirming they've shared their page with this profile</li>
                    <li>The link is copyable so users can easily share it</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral Domain Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Globe className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Referral Domain</CardTitle>
                <p className="text-sm text-gray-500">Configure the domain used for referral links</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {referralDomainLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 text-white">
                      <Link className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Referral Link Domain</p>
                      <p className="text-xs text-gray-500">Base URL for user referral links (e.g., https://ads.sixad.io)</p>
                    </div>
                  </div>
                  <Input
                    id="referralDomain"
                    value={referralDomain}
                    onChange={(e) => setReferralDomain(e.target.value)}
                    placeholder="https://ads.sixad.io"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Example referral link: <span className="font-mono text-purple-600">{referralDomain}/register?ref=ABC123</span>
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={saveReferralDomain} disabled={savingReferralDomain}>
                    {savingReferralDomain ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Referral Domain
                  </Button>
                </div>

                <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-sm text-purple-800 font-medium mb-2">About Referral Domain:</p>
                  <ul className="text-xs text-purple-700 space-y-1">
                    <li>This domain is used to generate referral links for users</li>
                    <li>When users share their referral link, it will use this domain</li>
                    <li>Make sure the domain points to your registration page</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Branding Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-400 to-purple-500">
                <Palette className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Email Branding (White-label)</CardTitle>
                <p className="text-sm text-gray-500">Customize email appearance for your brand</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {emailBrandingLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Brand Preview */}
                <div className="p-4 rounded-xl border border-gray-200 overflow-hidden">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Preview</p>
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <div className="p-4 relative" style={{ background: `linear-gradient(135deg, ${emailBranding.primaryColor}, ${emailBranding.secondaryColor})` }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center border border-white/30">
                          <span className="text-white font-bold text-xl">{emailBranding.brandLogo}</span>
                        </div>
                        <div>
                          <span className="text-white font-bold text-lg">{emailBranding.brandName}</span>
                          <p className="text-white/70 text-xs">{emailBranding.senderEmail}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-3 text-center">
                      <div className="flex justify-center gap-4 text-xs">
                        <a href="#" style={{ color: emailBranding.secondaryColor }} className="font-medium">Help Center</a>
                        <span className="text-gray-300">•</span>
                        <a href="#" style={{ color: emailBranding.primaryColor }} className="font-medium">Contact Support</a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brand Identity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brand Name</label>
                    <Input
                      value={emailBranding.brandName}
                      onChange={(e) => setEmailBranding({ ...emailBranding, brandName: e.target.value })}
                      placeholder="COINEST"
                    />
                    <p className="text-xs text-gray-500 mt-1">Appears in email header and footer</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brand Logo Letter</label>
                    <Input
                      value={emailBranding.brandLogo}
                      onChange={(e) => setEmailBranding({ ...emailBranding, brandLogo: e.target.value.slice(0, 2) })}
                      placeholder="6"
                      maxLength={2}
                    />
                    <p className="text-xs text-gray-500 mt-1">1-2 characters for logo icon</p>
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={emailBranding.primaryColor}
                        onChange={(e) => setEmailBranding({ ...emailBranding, primaryColor: e.target.value })}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <Input
                        value={emailBranding.primaryColor}
                        onChange={(e) => setEmailBranding({ ...emailBranding, primaryColor: e.target.value })}
                        placeholder="#52B788"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={emailBranding.secondaryColor}
                        onChange={(e) => setEmailBranding({ ...emailBranding, secondaryColor: e.target.value })}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <Input
                        value={emailBranding.secondaryColor}
                        onChange={(e) => setEmailBranding({ ...emailBranding, secondaryColor: e.target.value })}
                        placeholder="#8B5CF6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Email Sender */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sender Name</label>
                    <Input
                      value={emailBranding.senderName}
                      onChange={(e) => setEmailBranding({ ...emailBranding, senderName: e.target.value })}
                      placeholder="COINEST"
                    />
                    <p className="text-xs text-gray-500 mt-1">Display name in email "From" field</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sender Email</label>
                    <Input
                      type="email"
                      value={emailBranding.senderEmail}
                      onChange={(e) => setEmailBranding({ ...emailBranding, senderEmail: e.target.value })}
                      placeholder="noreply@coinest.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must match SMTP authentication</p>
                  </div>
                </div>

                {/* Support Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Help Center URL</label>
                    <Input
                      value={emailBranding.helpCenterUrl}
                      onChange={(e) => setEmailBranding({ ...emailBranding, helpCenterUrl: e.target.value })}
                      placeholder="https://help.example.com"
                    />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Contact Support URL</label>
                    <Input
                      value={emailBranding.contactSupportUrl}
                      onChange={(e) => setEmailBranding({ ...emailBranding, contactSupportUrl: e.target.value })}
                      placeholder="https://example.com/support"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={saveEmailBranding} disabled={savingEmailBranding}>
                    {savingEmailBranding ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Email Branding
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SMTP Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <Server className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle>SMTP Settings</CardTitle>
                <p className="text-sm text-gray-500">Configure email server for sending notifications</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {smtpLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  smtpSettings.isConfigured
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${smtpSettings.isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  {smtpSettings.isConfigured ? 'SMTP Configured' : 'SMTP Not Configured'}
                </div>

                {/* SMTP Host & Port */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                    <Input
                      value={smtpSettings.host}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
                    <Input
                      type="number"
                      value={smtpSettings.port}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, port: parseInt(e.target.value) || 465 })}
                      placeholder="465"
                    />
                  </div>
                </div>

                {/* Authentication */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username / Email</label>
                    <Input
                      value={smtpSettings.user}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                      placeholder="noreply@example.com"
                    />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showSmtpPassword ? 'text' : 'password'}
                        value={smtpSettings.password}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
                        placeholder={smtpSettings.isConfigured ? '••••••••' : 'Enter password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing password</p>
                  </div>
                </div>

                {/* SSL/TLS Option */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="smtpSecure"
                      checked={smtpSettings.secure}
                      onChange={(e) => setSmtpSettings({ ...smtpSettings, secure: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="smtpSecure" className="text-sm text-gray-700">
                      Use SSL/TLS (Recommended for port 465)
                    </label>
                  </div>
                </div>

                {/* Test Email */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-3">Test SMTP Connection</p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Enter email to receive test"
                      className="flex-1 bg-white"
                    />
                    <Button
                      variant="outline"
                      onClick={testSmtpConnection}
                      disabled={testingSmtp || !testEmail}
                    >
                      {testingSmtp ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Test
                    </Button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={saveSmtpSettings} disabled={savingSmtp}>
                    {savingSmtp ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save SMTP Settings
                  </Button>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-sm text-orange-800 font-medium mb-2">Common SMTP Settings:</p>
                  <ul className="text-xs text-orange-700 space-y-1">
                    <li><strong>Gmail:</strong> smtp.gmail.com, Port 465 (SSL) or 587 (TLS)</li>
                    <li><strong>Hostinger:</strong> smtp.hostinger.com, Port 465 (SSL)</li>
                    <li><strong>Outlook:</strong> smtp-mail.outlook.com, Port 587 (TLS)</li>
                    <li><strong>SendGrid:</strong> smtp.sendgrid.net, Port 465 (SSL)</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ad Account Management API */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Ad Account Management API</CardTitle>
                <p className="text-sm text-gray-500">Connect to Facebook/Meta ad account management API</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cheetahConfigLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status & Quota */}
                <div className="flex items-center justify-between">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    cheetahConfigured
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${cheetahConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    {cheetahConfigured ? 'API Connected' : 'API Not Configured'}
                  </div>

                  {cheetahConfigured && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Available Quota</p>
                        <p className="text-lg font-bold text-green-600">
                          {loadingQuota ? '...' : cheetahQuota ? `$${parseFloat(cheetahQuota).toLocaleString()}` : '—'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchCheetahQuota} disabled={loadingQuota}>
                        <RefreshCw className={`h-4 w-4 ${loadingQuota ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Environment Selection */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-2">API Environment</label>
                  <select
                    value={cheetahEnvironment}
                    onChange={(e) => setCheetahEnvironment(e.target.value as 'test' | 'production')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="test">🧪 Test Environment (test-open-api.neverbugs.com)</option>
                    <option value="production">🚀 Production Environment</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {cheetahEnvironment === 'test'
                      ? 'Use test environment for development and testing'
                      : 'Production environment for live ad accounts'}
                  </p>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={saveCheetahConfig} disabled={savingCheetahConfig}>
                    {savingCheetahConfig ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save API Configuration
                  </Button>
                </div>

                {/* Features Info */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium mb-2">Enabled Features:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-700">
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Account List</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>BM Share</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Recharge/Reset</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Pixel Binding</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>OE Opening</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Spend Tracking</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Insights</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-lg">
                      <Check className="w-3 h-3 text-blue-500" />
                      <span>Finance/Quota</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crypto Wallets for Auto Deposits */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-teal-500">
                <Coins className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle>Crypto Wallets (USDT Auto-Deposit)</CardTitle>
                <p className="text-sm text-gray-500">Configure wallet addresses for automated USDT deposits</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cryptoWalletsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* TRC20 Wallet */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white font-bold">
                        T
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">USDT (TRC20) - TRON Network</p>
                        <p className="text-xs text-gray-500">Low fees, fast confirmations (~19 blocks)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCryptoWallet('TRON_TRC20')}
                      disabled={savingCryptoWallet === 'TRON_TRC20'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        cryptoWallets.TRON_TRC20.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cryptoWallets.TRON_TRC20.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      value={cryptoWallets.TRON_TRC20.walletAddress}
                      onChange={(e) => setCryptoWallets(prev => ({
                        ...prev,
                        TRON_TRC20: { ...prev.TRON_TRC20, walletAddress: e.target.value }
                      }))}
                      placeholder="Enter TRC20 wallet address (e.g., TYour...)"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => saveCryptoWallet('TRON_TRC20')}
                      disabled={savingCryptoWallet === 'TRON_TRC20'}
                    >
                      {savingCryptoWallet === 'TRON_TRC20' ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>

                {/* BEP20 Wallet */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-white font-bold">
                        B
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">USDT (BEP20) - BSC Network</p>
                        <p className="text-xs text-gray-500">Low fees, ~15 block confirmations</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCryptoWallet('BSC_BEP20')}
                      disabled={savingCryptoWallet === 'BSC_BEP20'}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        cryptoWallets.BSC_BEP20.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cryptoWallets.BSC_BEP20.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <Input
                      value={cryptoWallets.BSC_BEP20.walletAddress}
                      onChange={(e) => setCryptoWallets(prev => ({
                        ...prev,
                        BSC_BEP20: { ...prev.BSC_BEP20, walletAddress: e.target.value }
                      }))}
                      placeholder="Enter BEP20 wallet address (e.g., 0x...)"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => saveCryptoWallet('BSC_BEP20')}
                      disabled={savingCryptoWallet === 'BSC_BEP20'}
                    >
                      {savingCryptoWallet === 'BSC_BEP20' ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-sm text-green-800 font-medium mb-2">How Auto-Deposit Works:</p>
                  <ul className="text-xs text-green-700 space-y-1">
                    <li>1. User selects USDT network and enters the amount they want to deposit</li>
                    <li>2. User sends USDT to your wallet address shown above</li>
                    <li>3. User submits the transaction hash (TX ID) in the deposit form</li>
                    <li>4. System verifies the transaction on blockchain automatically</li>
                    <li>5. If valid, the deposit is auto-approved and wallet balance is credited instantly</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MongoDB Database Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Database className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle>Database Configuration</CardTitle>
                <p className="text-sm text-gray-500">MongoDB connection details for system administration</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Database Name */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Database Name</p>
                    <p className="text-xs text-gray-500 mt-0.5">MongoDB database name</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-mono text-emerald-700">6ad</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('6ad')
                        setCopiedId('db-name')
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      {copiedId === 'db-name' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Database User */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Database User</p>
                    <p className="text-xs text-gray-500 mt-0.5">MongoDB authentication username</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-mono text-blue-700">6ad_admin</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('6ad_admin')
                        setCopiedId('db-user')
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      {copiedId === 'db-user' ? <Check className="w-4 h-4 text-blue-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Database Password */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Database Password</p>
                    <p className="text-xs text-gray-500 mt-0.5">MongoDB authentication password</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-mono text-amber-700">
                      BigSixmediaIndia@555
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('BigSixmediaIndia@555')
                        setCopiedId('db-pass')
                        setTimeout(() => setCopiedId(null), 2000)
                      }}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      {copiedId === 'db-pass' ? <Check className="w-4 h-4 text-amber-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Connection String */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Connection String</p>
                    <p className="text-xs text-gray-500 mt-0.5">Full MongoDB connection URI</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('mongodb://6ad_admin:BigSixmediaIndia%40555@localhost:27017/6ad?authSource=admin')
                      setCopiedId('db-uri')
                      setTimeout(() => setCopiedId(null), 2000)
                    }}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    {copiedId === 'db-uri' ? <Check className="w-4 h-4 text-purple-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <code className="block w-full px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-mono text-purple-700 break-all">
                  mongodb://6ad_admin:BigSixmediaIndia%40555@localhost:27017/6ad?authSource=admin
                </code>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-sm text-red-800 font-medium mb-2">Security Warning:</p>
                <ul className="text-xs text-red-700 space-y-1">
                  <li>• Keep these credentials secure and never share them publicly</li>
                  <li>• Only use these credentials for database administration</li>
                  <li>• Consider rotating passwords periodically for security</li>
                  <li>• Use SSH tunnel or VPN when connecting remotely</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <CreditCard className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <CardTitle>Payment Methods</CardTitle>
                <p className="text-sm text-gray-500">Configure payment options for deposits</p>
              </div>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4" />
              Add Payment Method
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell header>Title</TableCell>
                    <TableCell header>UPI ID</TableCell>
                    <TableCell header>Bank Details</TableCell>
                    <TableCell header>Status</TableCell>
                    <TableCell header>Actions</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paylinks.length > 0 ? (
                    paylinks.map((paylink) => (
                      <TableRow key={paylink.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{paylink.title}</p>
                            {paylink.description && (
                              <p className="text-xs text-gray-500">{paylink.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {paylink.upiId ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{paylink.upiId}</span>
                              <button
                                onClick={() => copyToClipboard(paylink.upiId!, paylink.id + '-upi')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {copiedId === paylink.id + '-upi' ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {paylink.bankName ? (
                            <div className="text-sm">
                              <p>{paylink.bankName}</p>
                              <p className="text-gray-500">
                                A/C: {paylink.accountNumber} | IFSC: {paylink.ifscCode}
                              </p>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              paylink.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {paylink.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenModal(paylink)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(paylink.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        No payment methods configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPaylink ? 'Edit Payment Method' : 'Add Payment Method'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Bank Transfer, UPI"
            required
          />
          <Input
            id="description"
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-gray-700">UPI Details</p>
            <Input
              id="upiId"
              label="UPI ID"
              value={formData.upiId}
              onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
              placeholder="e.g., business@upi"
            />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Bank Details</p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="bankName"
                label="Bank Name"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
              <Input
                id="ifscCode"
                label="IFSC Code"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <Input
                id="accountNumber"
                label="Account Number"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t pt-4">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active (visible to users)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingPaylink ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
