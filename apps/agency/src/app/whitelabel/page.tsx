'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { domainsApi, brandingApi, smtpApi, DnsHealthResult } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Globe,
  Plus,
  Check,
  X,
  Copy,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Clock,
  Upload,
  Loader2,
  Mail,
  Save,
  Server,
  Eye,
  EyeOff,
  Zap,
  ChevronRight,
  ChevronDown,
  Palette
} from 'lucide-react'

type TabType = 'domain' | 'email' | 'smtp'

type CustomDomain = {
  id: string
  domain: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  dnsVerified: boolean
  verificationToken: string | null
  brandLogo: string | null
  favicon: string | null
  adminRemarks: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
}

export default function WhitelabelPage() {
  const toast = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('domain')

  // Domain state
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [showDnsModal, setShowDnsModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [newLogo, setNewLogo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [updatingLogo, setUpdatingLogo] = useState(false)
  const [dnsInstructions, setDnsInstructions] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [vpsIp, setVpsIp] = useState('72.61.249.140')
  const [showAddDomainForm, setShowAddDomainForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updateFileInputRef = useRef<HTMLInputElement>(null)
  const [newFavicon, setNewFavicon] = useState('')
  const faviconFileInputRef = useRef<HTMLInputElement>(null)
  const updateFaviconFileInputRef = useRef<HTMLInputElement>(null)
  const [updatingFavicon, setUpdatingFavicon] = useState(false)

  // Email settings state
  const [useCustomEmail, setUseCustomEmail] = useState(false)
  const [emailSenderName, setEmailSenderName] = useState('')
  const [emailSenderNameApproved, setEmailSenderNameApproved] = useState<string | null>(null)
  const [emailSenderNameStatus, setEmailSenderNameStatus] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [loadingBranding, setLoadingBranding] = useState(true)

  // SMTP settings state
  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpEncryption, setSmtpEncryption] = useState('TLS')
  const [smtpFromEmail, setSmtpFromEmail] = useState('')
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [savingSmtp, setSavingSmtp] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [loadingSmtp, setLoadingSmtp] = useState(true)
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [encryptionDropdownOpen, setEncryptionDropdownOpen] = useState(false)
  const [dnsHealth, setDnsHealth] = useState<DnsHealthResult | null>(null)
  const [checkingDns, setCheckingDns] = useState(false)

  const fetchDomains = async () => {
    try {
      setLoading(true)
      const [domainsRes, dnsConfigRes] = await Promise.all([
        domainsApi.getAll(),
        domainsApi.getDnsConfig().catch(() => ({ vpsIp: '72.61.249.140' }))
      ])
      setDomains(domainsRes.domains || [])
      setVpsIp(dnsConfigRes.vpsIp)
    } catch (err) {
      console.error('Failed to fetch domains:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchBranding = async () => {
    try {
      setLoadingBranding(true)
      const res = await brandingApi.get()
      if (res.branding) {
        setEmailSenderNameApproved(res.branding.emailSenderNameApproved)
        setEmailSenderNameStatus(res.branding.emailSenderNameStatus)

        if (res.branding.emailSenderName) {
          setEmailSenderName(res.branding.emailSenderName)
          setUseCustomEmail(true)
        } else if (res.branding.emailSenderNameApproved) {
          setEmailSenderName(res.branding.emailSenderNameApproved)
          setUseCustomEmail(true)
        }
      }
    } catch (err) {
      console.error('Failed to fetch branding:', err)
    } finally {
      setLoadingBranding(false)
    }
  }

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true)
    try {
      await brandingApi.update({
        emailSenderName: useCustomEmail ? emailSenderName.trim() : undefined
      })
      await fetchBranding()
      toast.success('Email settings submitted! Awaiting admin approval.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save email settings')
    } finally {
      setSavingEmail(false)
    }
  }

  const fetchSmtp = async () => {
    try {
      setLoadingSmtp(true)
      const res = await smtpApi.get()
      if (res.smtp) {
        setSmtpEnabled(res.smtp.smtpEnabled || false)
        setSmtpHost(res.smtp.smtpHost || '')
        setSmtpPort(res.smtp.smtpPort?.toString() || '587')
        setSmtpUsername(res.smtp.smtpUsername || '')
        setSmtpPassword(res.smtp.smtpPassword || '')
        setSmtpEncryption(res.smtp.smtpEncryption || 'TLS')
        setSmtpFromEmail(res.smtp.smtpFromEmail || '')
      }
    } catch (err) {
      console.error('Failed to fetch SMTP settings:', err)
    } finally {
      setLoadingSmtp(false)
    }
  }

  const handleSaveSmtp = async () => {
    setSavingSmtp(true)
    setSmtpTestResult(null)
    try {
      await smtpApi.update({
        smtpEnabled,
        smtpHost: smtpEnabled ? smtpHost : undefined,
        smtpPort: smtpEnabled ? parseInt(smtpPort) : undefined,
        smtpUsername: smtpEnabled ? smtpUsername : undefined,
        smtpPassword: smtpEnabled && smtpPassword && !smtpPassword.includes('•') ? smtpPassword : undefined,
        smtpEncryption: smtpEnabled ? smtpEncryption : undefined,
        smtpFromEmail: smtpEnabled ? smtpFromEmail : undefined,
      })
      toast.success('SMTP settings saved successfully!')
      await fetchSmtp()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save SMTP settings')
    } finally {
      setSavingSmtp(false)
    }
  }

  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    setSmtpTestResult(null)
    setDnsHealth(null)
    try {
      const res = await smtpApi.test({
        smtpHost,
        smtpPort: parseInt(smtpPort),
        smtpUsername,
        smtpPassword,
        smtpEncryption,
        smtpFromEmail,
        testEmail: smtpFromEmail,
      })
      if (res.success) {
        setSmtpTestResult({ success: true, message: res.message || 'Connection successful! Test email sent.' })
      } else {
        setSmtpTestResult({ success: false, message: res.error || 'Connection failed' })
      }
      // Capture DNS health from response
      if (res.dnsHealth) {
        setDnsHealth(res.dnsHealth)
      }
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message || 'Test failed' })
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleCheckDns = async () => {
    if (!smtpFromEmail) return
    setCheckingDns(true)
    setDnsHealth(null)
    try {
      const res = await smtpApi.dnsCheck(smtpFromEmail)
      setDnsHealth(res)
    } catch (err: any) {
      toast.error(err.message || 'DNS check failed')
    } finally {
      setCheckingDns(false)
    }
  }

  useEffect(() => {
    fetchDomains()
    fetchBranding()
    fetchSmtp()
  }, [])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isUpdate = false) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be less than 2MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (isUpdate && selectedDomain) {
          handleUpdateLogo(reader.result as string)
        } else {
          setNewLogo(reader.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitDomain = async () => {
    if (!newDomain.trim()) {
      toast.error('Please enter a domain')
      return
    }

    setSubmitting(true)

    try {
      const res = await domainsApi.submit({
        domain: newDomain.trim(),
        brandLogo: newLogo || undefined,
        favicon: newFavicon || undefined
      })
      setDomains([res.domain, ...domains])
      setDnsInstructions(res.dnsInstructions)
      setSelectedDomain(res.domain)
      setShowAddDomainForm(false)
      setShowDnsModal(true)
      setNewDomain('')
      setNewLogo('')
      setNewFavicon('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit domain')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateLogo = async (logo: string) => {
    if (!selectedDomain) return

    setUpdatingLogo(true)

    try {
      const res = await domainsApi.update(selectedDomain.id, { brandLogo: logo })
      setDomains(domains.map(d => d.id === selectedDomain.id ? res.domain : d))
      setSelectedDomain(res.domain)
      toast.success('Logo updated successfully. Awaiting admin approval.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update logo')
    } finally {
      setUpdatingLogo(false)
    }
  }

  const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>, isUpdate = false) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 500 * 1024) {
        toast.error('Favicon must be less than 500KB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        if (isUpdate && selectedDomain) {
          handleUpdateFavicon(reader.result as string)
        } else {
          setNewFavicon(reader.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpdateFavicon = async (faviconData: string) => {
    if (!selectedDomain) return

    setUpdatingFavicon(true)

    try {
      const res = await domainsApi.update(selectedDomain.id, { favicon: faviconData })
      setDomains(domains.map(d => d.id === selectedDomain.id ? res.domain : d))
      setSelectedDomain(res.domain)
      toast.success('Favicon updated successfully. Awaiting admin approval.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update favicon')
    } finally {
      setUpdatingFavicon(false)
    }
  }

  const handleVerifyDns = async (domain: CustomDomain) => {
    setVerifying(true)
    try {
      const res = await domainsApi.verify(domain.id)
      if (res.dnsVerified) {
        setDomains(domains.map(d => d.id === domain.id ? { ...d, dnsVerified: true } : d))
        setShowDnsModal(false)
        toast.success('DNS verified! Your domain is now awaiting admin approval.')
      }
    } catch (err: any) {
      toast.error(err.message || 'DNS verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain request?')) return

    try {
      await domainsApi.delete(id)
      setDomains(domains.filter(d => d.id !== id))
      toast.success('Domain deleted successfully')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete domain')
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Get the active/pending domain
  const activeDomain = domains.find(d => d.status === 'APPROVED' || d.status === 'PENDING')

  // Sidebar menu items
  const menuItems = [
    { id: 'domain' as TabType, label: 'Domain & Branding', icon: Globe, description: 'Custom domain & logo' },
    { id: 'email' as TabType, label: 'Email Sender', icon: Mail, description: 'Sender name' },
    { id: 'smtp' as TabType, label: 'SMTP Server', icon: Server, description: 'Custom SMTP' }
  ]

  // Get status for sidebar
  const getDomainStatus = () => {
    if (activeDomain?.status === 'APPROVED') return { color: 'text-green-600', label: 'Active' }
    if (activeDomain?.status === 'PENDING') return { color: 'text-yellow-600', label: 'Pending' }
    return null
  }

  const getEmailStatus = () => {
    if (emailSenderNameStatus === 'APPROVED') return { color: 'text-green-600', label: 'Active' }
    if (emailSenderNameStatus === 'PENDING') return { color: 'text-yellow-600', label: 'Pending' }
    return null
  }

  const getSmtpStatus = () => {
    if (smtpEnabled) return { color: 'text-green-600', label: 'Active' }
    return null
  }

  return (
    <DashboardLayout title="Whitelabel" subtitle="Customize your brand">
      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* Left Sidebar Navigation */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <Card className="p-3">
            {/* Header Card */}
            <div className="flex items-center gap-2.5 p-2.5 mb-3 bg-gradient-to-r from-teal-600/10 to-teal-500/5 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
                <Palette className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-900">Brand Settings</p>
                <p className="text-[11px] text-gray-500">Customize identity</p>
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

            {/* Status Overview */}
            <div className="mt-3 p-3 bg-teal-50 rounded-lg border border-teal-100">
              <p className="text-[10px] font-semibold text-teal-700 uppercase tracking-wider mb-2">Status Overview</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-600">Domain</span>
                  {getDomainStatus() ? (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${getDomainStatus()?.color}`}>
                      <Check className="w-3 h-3" /> {getDomainStatus()?.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">Not set</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-600">Email</span>
                  {getEmailStatus() ? (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${getEmailStatus()?.color}`}>
                      <Check className="w-3 h-3" /> {getEmailStatus()?.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">Default</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-600">SMTP</span>
                  {getSmtpStatus() ? (
                    <span className={`flex items-center gap-1 text-[10px] font-medium ${getSmtpStatus()?.color}`}>
                      <Check className="w-3 h-3" /> {getSmtpStatus()?.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-medium">Default</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          <Card className="p-4">
            {/* Domain & Branding Tab */}
            {activeTab === 'domain' && (
              <div className="space-y-5 max-w-xl">
                {/* Section Header */}
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">Domain & Branding</h2>
                  <p className="text-[12px] text-gray-500">Configure custom domain and logo</p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : activeDomain ? (
                  <>
                    {/* Domain Section */}
                    <div className="pb-4 border-b border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                            <Globe className="w-3.5 h-3.5 text-[#0D9488]" />
                          </div>
                          <h3 className="text-sm font-medium text-gray-900">Domain Configuration</h3>
                        </div>
                        {activeDomain.status === 'APPROVED' && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                        {activeDomain.status === 'PENDING' && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-lg">
                          <Globe className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm text-gray-900">{activeDomain.domain}</span>
                        </div>

                        {/* DNS Status */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">DNS Status</span>
                            {activeDomain.dnsVerified ? (
                              <span className="text-green-600 flex items-center gap-1 text-xs font-medium">
                                <Check className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="text-yellow-600 flex items-center gap-1 text-xs font-medium">
                                <AlertCircle className="w-3.5 h-3.5" /> Not Verified
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {activeDomain.status === 'PENDING' && !activeDomain.dnsVerified && (
                          <button
                            onClick={() => {
                              setSelectedDomain(activeDomain)
                              setDnsInstructions({
                                type: 'A',
                                name: activeDomain.domain,
                                value: vpsIp,
                                txtRecord: {
                                  name: `_6ad-verify.${activeDomain.domain}`,
                                  value: activeDomain.verificationToken,
                                },
                              })
                              setShowDnsModal(true)
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-sm font-medium transition-all"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Configure DNS
                          </button>
                        )}

                        {activeDomain.status === 'REJECTED' && activeDomain.adminRemarks && (
                          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-600">
                              <strong>Rejection Reason:</strong> {activeDomain.adminRemarks}
                            </p>
                          </div>
                        )}

                        {(activeDomain.status === 'PENDING' || activeDomain.status === 'REJECTED') && (
                          <button
                            onClick={() => handleDeleteDomain(activeDomain.id)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg text-sm font-medium transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Domain
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Logo Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                          <Upload className="w-3.5 h-3.5 text-[#0D9488]" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">Brand Logo</h3>
                      </div>

                      <div className="space-y-3">
                        {activeDomain.brandLogo ? (
                          <div className="relative p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <img
                              src={activeDomain.brandLogo}
                              alt="Brand Logo"
                              className="max-h-16 max-w-full object-contain mx-auto"
                            />
                            {activeDomain.status !== 'APPROVED' && (
                              <p className="text-xs text-center text-yellow-600 mt-2">
                                Awaiting admin approval
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center">
                            <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                            <p className="text-sm text-gray-500">No logo uploaded</p>
                          </div>
                        )}

                        {/* Upload/Update Logo Button */}
                        <div>
                          <input
                            ref={updateFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              setSelectedDomain(activeDomain)
                              handleLogoUpload(e, true)
                            }}
                            className="hidden"
                          />
                          <button
                            onClick={() => {
                              setSelectedDomain(activeDomain)
                              updateFileInputRef.current?.click()
                            }}
                            disabled={updatingLogo}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingLogo ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                {activeDomain.brandLogo ? 'Update Logo' : 'Upload Logo'}
                              </>
                            )}
                          </button>
                        </div>

                        {/* Logo Requirements */}
                        <div className="p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                          <p className="text-xs font-medium text-[#0D9488] mb-1.5">Logo Requirements</p>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            <li>• <strong>Recommended:</strong> 280×56px (5:1 ratio)</li>
                            <li>• <strong>Format:</strong> PNG with transparent background</li>
                            <li>• <strong>Max size:</strong> 2MB</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Favicon Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                          <Palette className="w-3.5 h-3.5 text-[#0D9488]" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">Favicon</h3>
                      </div>

                      <div className="space-y-3">
                        {activeDomain.favicon ? (
                          <div className="relative p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3">
                            <img
                              src={activeDomain.favicon}
                              alt="Favicon"
                              className="w-8 h-8 object-contain"
                            />
                            <span className="text-sm text-gray-600">Current favicon</span>
                            {activeDomain.status !== 'APPROVED' && (
                              <span className="text-xs text-yellow-600 ml-auto">Awaiting approval</span>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center">
                            <Palette className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                            <p className="text-sm text-gray-500">No favicon uploaded</p>
                          </div>
                        )}

                        {/* Upload/Update Favicon Button */}
                        <div>
                          <input
                            ref={updateFaviconFileInputRef}
                            type="file"
                            accept="image/png,image/svg+xml,image/x-icon,image/ico,.ico"
                            onChange={(e) => {
                              setSelectedDomain(activeDomain)
                              handleFaviconUpload(e, true)
                            }}
                            className="hidden"
                          />
                          <button
                            onClick={() => {
                              setSelectedDomain(activeDomain)
                              updateFaviconFileInputRef.current?.click()
                            }}
                            disabled={updatingFavicon}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {updatingFavicon ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                {activeDomain.favicon ? 'Update Favicon' : 'Upload Favicon'}
                              </>
                            )}
                          </button>
                        </div>

                        {/* Favicon Requirements */}
                        <div className="p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                          <p className="text-xs font-medium text-[#0D9488] mb-1.5">Favicon Requirements</p>
                          <ul className="text-xs text-gray-600 space-y-0.5">
                            <li>• <strong>Size:</strong> 32×32 or 64×64 pixels</li>
                            <li>• <strong>Format:</strong> PNG, SVG, or ICO</li>
                            <li>• <strong>Max size:</strong> 500KB</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : showAddDomainForm ? (
                  /* Add Domain Form */
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Domain</h3>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Enter your subdomain</label>
                        <input
                          type="text"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          placeholder="ads.youragency.com"
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter without http:// or https://</p>
                      </div>
                    </div>

                    <div className="pb-4 border-b border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Brand Logo</h3>
                      {newLogo ? (
                        <div className="relative p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                          <img
                            src={newLogo}
                            alt="Brand Logo"
                            className="max-h-16 max-w-full object-contain mx-auto"
                          />
                          <button
                            onClick={() => {
                              setNewLogo('')
                              if (fileInputRef.current) fileInputRef.current.value = ''
                            }}
                            className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center cursor-pointer hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-colors"
                        >
                          <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                          <p className="text-sm text-gray-500">Click to upload logo</p>
                          <p className="text-xs text-gray-400">Max 2MB</p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleLogoUpload(e)}
                        className="hidden"
                      />

                      {/* Logo Requirements */}
                      <div className="mt-3 p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                        <p className="text-xs font-medium text-[#0D9488] mb-1.5">Recommended Specifications</p>
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          <li>• <strong>Size:</strong> 280×56 pixels (or similar aspect ratio)</li>
                          <li>• <strong>Format:</strong> PNG with transparent background</li>
                          <li>• <strong>Best for:</strong> Horizontal/wide logos work best</li>
                        </ul>
                      </div>
                    </div>

                    {/* Favicon Upload (Add Domain Form) */}
                    <div className="pb-4 border-b border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Favicon</h3>
                      {newFavicon ? (
                        <div className="relative p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center gap-3">
                          <img
                            src={newFavicon}
                            alt="Favicon"
                            className="w-8 h-8 object-contain"
                          />
                          <span className="text-sm text-gray-600">Favicon selected</span>
                          <button
                            onClick={() => {
                              setNewFavicon('')
                              if (faviconFileInputRef.current) faviconFileInputRef.current.value = ''
                            }}
                            className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => faviconFileInputRef.current?.click()}
                          className="p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-center cursor-pointer hover:border-[#0D9488] hover:bg-[#0D9488]/5 transition-colors"
                        >
                          <Palette className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                          <p className="text-sm text-gray-500">Click to upload favicon</p>
                          <p className="text-xs text-gray-400">Max 500KB</p>
                        </div>
                      )}
                      <input
                        ref={faviconFileInputRef}
                        type="file"
                        accept="image/png,image/svg+xml,image/x-icon,image/ico,.ico"
                        onChange={(e) => handleFaviconUpload(e)}
                        className="hidden"
                      />

                      <div className="mt-3 p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                        <p className="text-xs font-medium text-[#0D9488] mb-1.5">Favicon Specifications</p>
                        <ul className="text-xs text-gray-600 space-y-0.5">
                          <li>• <strong>Size:</strong> 32×32 or 64×64 pixels</li>
                          <li>• <strong>Format:</strong> PNG, SVG, or ICO</li>
                          <li>• <strong>Max size:</strong> 500KB</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddDomainForm(false)
                          setNewDomain('')
                          setNewLogo('')
                          setNewFavicon('')
                        }}
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitDomain}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#0D9488] hover:bg-[#0F766E] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {submitting ? 'Submitting...' : 'Submit Domain'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty State */
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-full bg-[#0D9488]/10 flex items-center justify-center mx-auto mb-3">
                      <Globe className="w-7 h-7 text-[#0D9488]" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-1.5">No domain configured</h3>
                    <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
                      Set up your custom domain and branding for your users.
                    </p>
                    <button
                      onClick={() => setShowAddDomainForm(true)}
                      className="inline-flex items-center gap-2 bg-[#0D9488] hover:bg-[#0F766E] text-white px-5 py-2 rounded-lg text-sm font-medium transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Configure Domain
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Email Sender Tab */}
            {activeTab === 'email' && (
              <div className="space-y-5 max-w-xl">
                {/* Section Header */}
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">Email Sender Settings</h2>
                  <p className="text-[12px] text-gray-500">Customize email sender name</p>
                </div>

                {loadingBranding ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* Current Status */}
                    <div className="pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                          <Mail className="w-3.5 h-3.5 text-[#0D9488]" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">Current Status</h3>
                      </div>

                      {emailSenderNameApproved && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <Check className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-800">Currently Active</p>
                              <p className="text-xs text-green-700">
                                Emails sent as: <strong>"{emailSenderNameApproved}"</strong>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {emailSenderNameStatus === 'PENDING' && emailSenderName && (
                        <div className={`p-3 bg-yellow-50 border border-yellow-200 rounded-lg ${emailSenderNameApproved ? 'mt-2' : ''}`}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                              <Clock className="w-4 h-4 text-yellow-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-yellow-800">Pending Approval</p>
                              <p className="text-xs text-yellow-700">
                                Requested: <strong>"{emailSenderName}"</strong>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {!emailSenderNameApproved && emailSenderNameStatus !== 'PENDING' && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                              <Mail className="w-4 h-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-700">Using Default</p>
                              <p className="text-xs text-gray-500">Emails sent as: "Six Media"</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email Sender Option */}
                    <div className="pb-4 border-b border-gray-100">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Email Sender Name</h3>

                      <div className="space-y-2">
                        <label className={`flex items-center gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${!useCustomEmail ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="emailOption"
                            checked={!useCustomEmail}
                            onChange={() => setUseCustomEmail(false)}
                            className="w-4 h-4 text-[#0D9488] border-gray-300 focus:ring-[#0D9488]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">Use default (Six Media)</span>
                            <p className="text-xs text-gray-500">Emails will appear from "Six Media"</p>
                          </div>
                        </label>

                        <label className={`flex items-center gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${useCustomEmail ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="emailOption"
                            checked={useCustomEmail}
                            onChange={() => setUseCustomEmail(true)}
                            className="w-4 h-4 text-[#0D9488] border-gray-300 focus:ring-[#0D9488]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">Use custom name</span>
                            <p className="text-xs text-gray-500">Emails will appear from your agency name</p>
                          </div>
                        </label>
                      </div>

                      {/* Custom Name Input */}
                      {useCustomEmail && (
                        <div className="mt-3">
                          <label className="block text-sm text-gray-600 mb-1">Your Agency Name</label>
                          <input
                            type="text"
                            value={emailSenderName}
                            onChange={(e) => setEmailSenderName(e.target.value)}
                            placeholder="Enter your agency name"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                            maxLength={50}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            This name will appear as the sender in all emails to your users
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                      <p className="text-xs font-medium text-[#0D9488] mb-1.5">Preview (after approval)</p>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-gray-500">From:</span>
                        <span className="font-medium text-gray-900">
                          "{useCustomEmail && emailSenderName.trim() ? emailSenderName.trim() : 'Six Media'}" &lt;info@6ad.in&gt;
                        </span>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveEmailSettings}
                      disabled={savingEmail || (useCustomEmail && !emailSenderName.trim())}
                      className="w-full flex items-center justify-center gap-2 bg-[#0D9488] hover:bg-[#0F766E] text-white px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {savingEmail ? 'Saving...' : emailSenderNameStatus === 'PENDING' ? 'Update Request' : 'Submit for Approval'}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Custom email sender names require admin approval before they become active.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* SMTP Server Tab */}
            {activeTab === 'smtp' && (
              <div className="space-y-5 max-w-xl">
                {/* Section Header */}
                <div>
                  <h2 className="text-[15px] font-semibold text-gray-900">SMTP Server Configuration</h2>
                  <p className="text-[12px] text-gray-500">Configure custom SMTP server</p>
                </div>

                {loadingSmtp ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <>
                    {/* SMTP Option */}
                    <div className="pb-4 border-b border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
                          <Server className="w-3.5 h-3.5 text-[#0D9488]" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900">SMTP Server</h3>
                      </div>

                      <div className="space-y-2">
                        <label className={`flex items-center gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${!smtpEnabled ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="smtpOption"
                            checked={!smtpEnabled}
                            onChange={() => setSmtpEnabled(false)}
                            className="w-4 h-4 text-[#0D9488] border-gray-300 focus:ring-[#0D9488]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">Use default SMTP</span>
                            <p className="text-xs text-gray-500">Emails sent via info@6ad.in</p>
                          </div>
                        </label>

                        <label className={`flex items-center gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${smtpEnabled ? 'border-[#0D9488] bg-[#0D9488]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="smtpOption"
                            checked={smtpEnabled}
                            onChange={() => setSmtpEnabled(true)}
                            className="w-4 h-4 text-[#0D9488] border-gray-300 focus:ring-[#0D9488]"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">Use custom SMTP server</span>
                            <p className="text-xs text-gray-500">Send emails from your own domain</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* SMTP Configuration Fields */}
                    {smtpEnabled && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-900">SMTP Settings</h3>

                        {/* SMTP Host */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">SMTP Host</label>
                          <input
                            type="text"
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            placeholder="smtp.yourdomain.com"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                          />
                        </div>

                        {/* Port and Encryption Row */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-gray-600 mb-1">Port</label>
                            <input
                              type="number"
                              value={smtpPort}
                              onChange={(e) => setSmtpPort(e.target.value)}
                              placeholder="587"
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                            />
                          </div>
                          <div className="relative">
                            <label className="block text-sm text-gray-600 mb-1">Encryption</label>
                            <button
                              type="button"
                              onClick={() => setEncryptionDropdownOpen(!encryptionDropdownOpen)}
                              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all flex items-center justify-between text-left"
                            >
                              <span className="text-gray-900">
                                {smtpEncryption === 'TLS' ? 'TLS (Port 587)' : smtpEncryption === 'SSL' ? 'SSL (Port 465)' : 'None'}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${encryptionDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {encryptionDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setEncryptionDropdownOpen(false)}
                                />
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                                  {[
                                    { value: 'TLS', label: 'TLS (Port 587)' },
                                    { value: 'SSL', label: 'SSL (Port 465)' },
                                    { value: 'NONE', label: 'None' }
                                  ].map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        setSmtpEncryption(option.value)
                                        setEncryptionDropdownOpen(false)
                                      }}
                                      className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                                        smtpEncryption === option.value
                                          ? 'bg-teal-50 text-teal-700'
                                          : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                    >
                                      <span>{option.label}</span>
                                      {smtpEncryption === option.value && (
                                        <Check className="w-4 h-4 text-teal-600" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Username */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Username</label>
                          <input
                            type="text"
                            value={smtpUsername}
                            onChange={(e) => setSmtpUsername(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                          />
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Password</label>
                          <div className="relative">
                            <input
                              type={showSmtpPassword ? 'text' : 'password'}
                              value={smtpPassword}
                              onChange={(e) => setSmtpPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full px-3 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showSmtpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* From Email */}
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">From Email</label>
                          <input
                            type="email"
                            value={smtpFromEmail}
                            onChange={(e) => setSmtpFromEmail(e.target.value)}
                            placeholder="noreply@yourdomain.com"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] focus:bg-white transition-all"
                          />
                          <p className="text-xs text-gray-500 mt-1">This will be the sender email address for all emails</p>
                        </div>

                        {/* Test Result */}
                        {smtpTestResult && (
                          <div className={`p-2.5 rounded-lg ${smtpTestResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center gap-2">
                              {smtpTestResult.success ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                              <p className={`text-xs ${smtpTestResult.success ? 'text-green-700' : 'text-red-700'}`}>
                                {smtpTestResult.message}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Test & Check DNS Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleTestSmtp}
                            disabled={testingSmtp || !smtpHost || !smtpPort || !smtpUsername || !smtpPassword || !smtpFromEmail}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-[#0D9488]/10 text-gray-700 hover:text-[#0D9488] rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testingSmtp ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
                            ) : (
                              <><Zap className="w-4 h-4" /> Test Connection</>
                            )}
                          </button>
                          <button
                            onClick={handleCheckDns}
                            disabled={checkingDns || !smtpFromEmail}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-purple-50 text-gray-700 hover:text-purple-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {checkingDns ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                            ) : (
                              <><Globe className="w-4 h-4" /> Check Domain</>
                            )}
                          </button>
                        </div>

                        {/* DNS Health Report */}
                        {dnsHealth && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Score Header */}
                            <div className={`px-3 py-2.5 flex items-center justify-between ${
                              dnsHealth.score >= 80 ? 'bg-green-50' : dnsHealth.score >= 50 ? 'bg-amber-50' : 'bg-red-50'
                            }`}>
                              <div className="flex items-center gap-2">
                                {dnsHealth.score >= 80 ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : dnsHealth.score >= 50 ? (
                                  <AlertCircle className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="text-sm font-medium text-gray-900">
                                  Domain Health: {dnsHealth.domain}
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${
                                dnsHealth.score >= 80 ? 'text-green-700' : dnsHealth.score >= 50 ? 'text-amber-700' : 'text-red-700'
                              }`}>
                                {dnsHealth.score}/100
                              </span>
                            </div>

                            <div className="p-3 space-y-2">
                              {/* SPF */}
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dnsHealth.spf.found ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-gray-700 w-14">SPF</span>
                                <span className={`text-xs ${dnsHealth.spf.found ? 'text-green-700' : 'text-red-600'}`}>
                                  {dnsHealth.spf.found ? (dnsHealth.spf.issue || 'Configured') : 'Not found'}
                                </span>
                              </div>

                              {/* DKIM */}
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dnsHealth.dkim.found ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-gray-700 w-14">DKIM</span>
                                <span className={`text-xs ${dnsHealth.dkim.found ? 'text-green-700' : 'text-red-600'}`}>
                                  {dnsHealth.dkim.found ? 'Configured' : 'Not found — emails will go to spam'}
                                </span>
                              </div>

                              {/* DMARC */}
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dnsHealth.dmarc.found ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-xs font-medium text-gray-700 w-14">DMARC</span>
                                <span className={`text-xs ${dnsHealth.dmarc.found ? 'text-green-700' : 'text-red-600'}`}>
                                  {dnsHealth.dmarc.found ? (dnsHealth.dmarc.issue || 'Configured') : 'Not found'}
                                </span>
                              </div>

                              {/* Issues & Recommendations */}
                              {dnsHealth.issues.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <p className="text-xs font-medium text-gray-700 mb-1.5">How to fix:</p>
                                  <div className="space-y-2">
                                    {!dnsHealth.spf.found && (
                                      <div className="bg-gray-50 rounded-md p-2">
                                        <p className="text-xs font-medium text-gray-700 mb-1">Add SPF record:</p>
                                        <p className="text-xs text-gray-500 mb-1">Go to your domain DNS settings and add a TXT record:</p>
                                        <div className="bg-white border border-gray-200 rounded p-1.5 text-xs font-mono text-gray-800 break-all">
                                          Name: @ &nbsp; Type: TXT &nbsp; Value: v=spf1 include:_spf.{smtpHost.replace('smtp.', '')} -all
                                        </div>
                                      </div>
                                    )}
                                    {!dnsHealth.dkim.found && (
                                      <div className="bg-red-50 rounded-md p-2">
                                        <p className="text-xs font-medium text-red-700 mb-1">Enable DKIM (most important):</p>
                                        <p className="text-xs text-red-600">DKIM is required by Gmail and Yahoo since Feb 2024. Without it, your emails will go to spam.</p>
                                        <p className="text-xs text-gray-600 mt-1">Go to your email provider dashboard → Email Authentication → Enable DKIM, then add the DKIM TXT record to your domain DNS.</p>
                                      </div>
                                    )}
                                    {!dnsHealth.dmarc.found && (
                                      <div className="bg-gray-50 rounded-md p-2">
                                        <p className="text-xs font-medium text-gray-700 mb-1">Add DMARC record:</p>
                                        <div className="bg-white border border-gray-200 rounded p-1.5 text-xs font-mono text-gray-800 break-all">
                                          Name: _dmarc &nbsp; Type: TXT &nbsp; Value: v=DMARC1; p=quarantine; rua=mailto:{smtpFromEmail}
                                        </div>
                                      </div>
                                    )}
                                    {dnsHealth.spf.found && dnsHealth.spf.issue && dnsHealth.spf.issue.includes('~all') && (
                                      <div className="bg-gray-50 rounded-md p-2">
                                        <p className="text-xs font-medium text-gray-700 mb-1">Strengthen SPF:</p>
                                        <p className="text-xs text-gray-600">Change <code className="bg-red-100 px-1 rounded">~all</code> to <code className="bg-green-100 px-1 rounded">-all</code> in your SPF record for better protection.</p>
                                      </div>
                                    )}
                                    {dnsHealth.dmarc.found && dnsHealth.dmarc.issue && dnsHealth.dmarc.issue.includes('p=none') && (
                                      <div className="bg-gray-50 rounded-md p-2">
                                        <p className="text-xs font-medium text-gray-700 mb-1">Strengthen DMARC:</p>
                                        <p className="text-xs text-gray-600">Change <code className="bg-red-100 px-1 rounded">p=none</code> to <code className="bg-green-100 px-1 rounded">p=quarantine</code> for better spam protection.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {dnsHealth.score >= 80 && dnsHealth.issues.length === 0 && (
                                <p className="text-xs text-green-700 mt-1 pt-1 border-t border-gray-100">
                                  Your domain is properly configured. Emails should land in inbox.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Preview */}
                    {smtpEnabled && smtpFromEmail && (
                      <div className="p-3 bg-[#0D9488]/5 border border-[#0D9488]/10 rounded-lg">
                        <p className="text-xs font-medium text-[#0D9488] mb-1.5">Email Preview</p>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="text-gray-500">From:</span>
                          <span className="font-medium text-gray-900">
                            "{emailSenderNameApproved || emailSenderName || 'Your Agency'}" &lt;{smtpFromEmail}&gt;
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={handleSaveSmtp}
                      disabled={savingSmtp || (smtpEnabled && (!smtpHost || !smtpPort || !smtpUsername || !smtpFromEmail))}
                      className="w-full flex items-center justify-center gap-2 bg-[#0D9488] hover:bg-[#0F766E] text-white px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {savingSmtp ? 'Saving...' : 'Save SMTP Settings'}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Custom SMTP allows emails to be sent from your own domain for better branding.
                    </p>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* DNS Configuration Modal */}
      {showDnsModal && dnsInstructions && selectedDomain && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">DNS Configuration Required</h2>
                <button
                  onClick={() => {
                    setShowDnsModal(false)
                    setSelectedDomain(null)
                    setDnsInstructions(null)
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                To verify ownership of <strong className="text-gray-900">{selectedDomain.domain}</strong>, please add the following DNS records:
              </p>

              {/* A Record */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-gray-900">1. A Record</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-gray-500 block">Type</span>
                      <span className="font-mono text-xs">A</span>
                    </div>
                    <div className="flex-1 mx-3">
                      <span className="text-xs text-gray-500 block">Name/Host</span>
                      <span className="font-mono text-xs">{dnsInstructions.name}</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs text-gray-500 block">Points to (IP)</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs">{dnsInstructions.value}</span>
                        <button
                          onClick={() => copyToClipboard(dnsInstructions.value, 'arecord')}
                          className="p-0.5 hover:bg-gray-200 rounded"
                        >
                          {copiedField === 'arecord' ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TXT Record */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-medium text-gray-900">2. TXT Record (Verification)</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div>
                    <span className="text-xs text-gray-500 block">Name/Host</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs break-all">{dnsInstructions.txtRecord.name}</span>
                      <button
                        onClick={() => copyToClipboard(dnsInstructions.txtRecord.name, 'txtName')}
                        className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                      >
                        {copiedField === 'txtName' ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Value</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs break-all">{dnsInstructions.txtRecord.value}</span>
                      <button
                        onClick={() => copyToClipboard(dnsInstructions.txtRecord.value, 'txtValue')}
                        className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                      >
                        {copiedField === 'txtValue' ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> DNS changes can take up to 48 hours to propagate. Once you've added the records, click "Verify DNS" to check the configuration.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDnsModal(false)
                    setSelectedDomain(null)
                    setDnsInstructions(null)
                  }}
                  className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all"
                >
                  I'll do it later
                </button>
                <button
                  onClick={() => handleVerifyDns(selectedDomain)}
                  disabled={verifying}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#0D9488] hover:bg-[#0F766E] text-white px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Verify DNS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
