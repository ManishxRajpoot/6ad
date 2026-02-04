'use client'

import { useState, useEffect, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { domainsApi, brandingApi } from '@/lib/api'
import { Globe, Plus, Check, X, Copy, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock, Upload, Loader2, Mail, Save } from 'lucide-react'

type CustomDomain = {
  id: string
  domain: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  dnsVerified: boolean
  verificationToken: string | null
  brandLogo: string | null
  adminRemarks: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
}

export default function WhitelabelPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDnsModal, setShowDnsModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [newLogo, setNewLogo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [updatingLogo, setUpdatingLogo] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [dnsInstructions, setDnsInstructions] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [vpsIp, setVpsIp] = useState('72.61.249.140')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updateFileInputRef = useRef<HTMLInputElement>(null)

  // Email settings state
  const [useCustomEmail, setUseCustomEmail] = useState(false)
  const [emailSenderName, setEmailSenderName] = useState('')
  const [emailSenderNameApproved, setEmailSenderNameApproved] = useState<string | null>(null)
  const [emailSenderNameStatus, setEmailSenderNameStatus] = useState<string | null>(null)
  const [savingEmail, setSavingEmail] = useState(false)
  const [loadingBranding, setLoadingBranding] = useState(true)

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
          // If approved name exists but no pending, show approved name
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
    setError('')
    try {
      await brandingApi.update({
        emailSenderName: useCustomEmail ? emailSenderName.trim() : undefined
      })
      // Refresh branding to get updated status
      await fetchBranding()
      setSuccessMessage('Email settings submitted! Awaiting admin approval.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save email settings')
    } finally {
      setSavingEmail(false)
    }
  }

  useEffect(() => {
    fetchDomains()
    fetchBranding()
  }, [])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isUpdate = false) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo must be less than 2MB')
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
      setError('Please enter a domain')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await domainsApi.submit({
        domain: newDomain.trim(),
        brandLogo: newLogo || undefined
      })
      setDomains([res.domain, ...domains])
      setDnsInstructions(res.dnsInstructions)
      setSelectedDomain(res.domain)
      setShowAddModal(false)
      setShowDnsModal(true)
      setNewDomain('')
      setNewLogo('')
    } catch (err: any) {
      setError(err.message || 'Failed to submit domain')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateLogo = async (logo: string) => {
    if (!selectedDomain) return

    setUpdatingLogo(true)
    setError('')

    try {
      const res = await domainsApi.update(selectedDomain.id, { brandLogo: logo })
      setDomains(domains.map(d => d.id === selectedDomain.id ? res.domain : d))
      setSelectedDomain(res.domain)
      setSuccessMessage('Logo updated successfully. Awaiting admin approval.')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update logo')
    } finally {
      setUpdatingLogo(false)
    }
  }

  const handleVerifyDns = async (domain: CustomDomain) => {
    setVerifying(true)
    setError('')
    try {
      const res = await domainsApi.verify(domain.id)
      if (res.dnsVerified) {
        setDomains(domains.map(d => d.id === domain.id ? { ...d, dnsVerified: true } : d))
        setShowDnsModal(false)
        setSuccessMessage('DNS verified! Your domain is now awaiting admin approval.')
        setTimeout(() => setSuccessMessage(''), 3000)
      }
    } catch (err: any) {
      setError(err.message || 'DNS verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain request?')) return

    try {
      await domainsApi.delete(id)
      setDomains(domains.filter(d => d.id !== id))
      setSuccessMessage('Domain deleted successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err: any) {
      alert(err.message || 'Failed to delete domain')
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getStatusBadge = (status: string, dnsVerified: boolean) => {
    if (status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="w-3.5 h-3.5" />
          Active
        </span>
      )
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <X className="w-3.5 h-3.5" />
          Rejected
        </span>
      )
    }
    if (!dnsVerified) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-3.5 h-3.5" />
          DNS Pending
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <Clock className="w-3.5 h-3.5" />
        Awaiting Approval
      </span>
    )
  }

  // Get the active/pending domain (agent can only have one)
  const activeDomain = domains.find(d => d.status === 'APPROVED' || d.status === 'PENDING')

  return (
    <DashboardLayout title="Whitelabel" subtitle="Customize your brand for your users">
      <div className="space-y-6">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {successMessage}
          </div>
        )}

        {/* Info Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">How Whitelabel Works</h3>
              <ol className="mt-2 text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Submit your domain and brand logo</li>
                <li>Configure DNS records as instructed</li>
                <li>Verify DNS configuration</li>
                <li>Wait for admin approval</li>
                <li>Once approved, your users will see your custom branding</li>
              </ol>
              <p className="mt-2 text-sm text-blue-700 font-medium">
                Note: Until admin approves, default branding will appear to your users.
              </p>
            </div>
          </div>
        </Card>

        {/* Two Column Layout for Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Domain Configuration Column */}
          <div className="space-y-6">
            {loading ? (
              <Card className="p-8 text-center text-gray-500">Loading...</Card>
            ) : activeDomain ? (
              /* Show active/pending domain card */
              <Card className="p-6 h-full">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Domain Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage your custom domain and branding</p>
                  </div>
                  {getStatusBadge(activeDomain.status, activeDomain.dnsVerified)}
                </div>

                <div className="space-y-6">
                  {/* Domain Section */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">Domain</h3>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{activeDomain.domain}</span>
                    </div>

                    {/* DNS Status */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">DNS Status</span>
                        {activeDomain.dnsVerified ? (
                          <span className="text-green-600 flex items-center gap-1 text-sm">
                            <Check className="w-4 h-4" /> Verified
                          </span>
                        ) : (
                          <span className="text-yellow-600 flex items-center gap-1 text-sm">
                            <AlertCircle className="w-4 h-4" /> Not Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {activeDomain.status === 'PENDING' && !activeDomain.dnsVerified && (
                      <Button
                        variant="outline"
                        className="w-full"
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
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Configure DNS
                      </Button>
                    )}

                    {activeDomain.status === 'REJECTED' && activeDomain.adminRemarks && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">
                          <strong>Rejection Reason:</strong> {activeDomain.adminRemarks}
                        </p>
                      </div>
                    )}

                    {(activeDomain.status === 'PENDING' || activeDomain.status === 'REJECTED') && (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteDomain(activeDomain.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Domain
                      </Button>
                    )}
                  </div>

                  {/* Logo Section */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold text-gray-700">Brand Logo</h3>

                    {activeDomain.brandLogo ? (
                      <div className="relative p-4 bg-gray-50 rounded-lg">
                        <img
                          src={activeDomain.brandLogo}
                          alt="Brand Logo"
                          className="max-h-24 max-w-full object-contain mx-auto"
                        />
                        {activeDomain.status !== 'APPROVED' && (
                          <p className="text-xs text-center text-yellow-600 mt-2">
                            Awaiting admin approval
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 bg-gray-50 rounded-lg text-center">
                        <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
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
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelectedDomain(activeDomain)
                          updateFileInputRef.current?.click()
                        }}
                        disabled={updatingLogo}
                      >
                        {updatingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            {activeDomain.brandLogo ? 'Update Logo' : 'Upload Logo'}
                          </>
                        )}
                      </Button>
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs font-medium text-blue-800 mb-1">Logo Requirements:</p>
                        <ul className="text-xs text-blue-700 space-y-0.5">
                          <li>• <strong>Recommended:</strong> 280×56px (5:1 ratio)</li>
                          <li>• <strong>Format:</strong> PNG with transparent background</li>
                          <li>• <strong>Max size:</strong> 2MB</li>
                        </ul>
                        <p className="text-xs text-blue-600 mt-1">
                          Updating logo requires admin re-approval.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ) : (
              /* No domain - show empty state */
              <Card className="p-12 text-center h-full flex flex-col items-center justify-center">
                <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No domain configured</h3>
                <p className="text-gray-500 mb-6">Set up your custom domain and branding for your users.</p>
                <Button onClick={() => setShowAddModal(true)} className="bg-primary-600 hover:bg-primary-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Configure Domain
                </Button>
              </Card>
            )}
          </div>

          {/* Email Settings Column */}
          <Card className="p-6 h-fit">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Mail className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Email Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Customize how your users receive emails</p>
                </div>
              </div>
              {/* Status Badge */}
              {emailSenderNameStatus && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  emailSenderNameStatus === 'APPROVED'
                    ? 'bg-green-100 text-green-700'
                    : emailSenderNameStatus === 'PENDING'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {emailSenderNameStatus === 'APPROVED' && <CheckCircle className="w-3.5 h-3.5" />}
                  {emailSenderNameStatus === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                  {emailSenderNameStatus === 'REJECTED' && <X className="w-3.5 h-3.5" />}
                  {emailSenderNameStatus === 'APPROVED' ? 'Active' : emailSenderNameStatus === 'PENDING' ? 'Pending Approval' : 'Rejected'}
                </span>
              )}
            </div>

            {loadingBranding ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Current Active Email Sender */}
                {emailSenderNameApproved && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-1">Currently Active</p>
                    <p className="text-sm text-green-700">
                      Emails are sent as: <strong>"{emailSenderNameApproved}"</strong>
                    </p>
                  </div>
                )}

                {/* Pending Status Info */}
                {emailSenderNameStatus === 'PENDING' && emailSenderName && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800 mb-1">Pending Approval</p>
                    <p className="text-sm text-yellow-700">
                      Awaiting admin approval for: <strong>"{emailSenderName}"</strong>
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {emailSenderNameApproved
                        ? `Currently using: "${emailSenderNameApproved}" until approval.`
                        : 'Currently using: "Six Media" until approval.'}
                    </p>
                  </div>
                )}

                {/* Email Sender Option */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Email Sender Name</label>
                  <p className="text-sm text-gray-500">Choose how your users see emails from the platform</p>

                  {/* Radio Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="emailOption"
                        checked={!useCustomEmail}
                        onChange={() => setUseCustomEmail(false)}
                        className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">Use default (Six Media)</span>
                        <p className="text-sm text-gray-500">Emails will appear from "Six Media"</p>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="emailOption"
                        checked={useCustomEmail}
                        onChange={() => setUseCustomEmail(true)}
                        className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">Use custom name</span>
                        <p className="text-sm text-gray-500">Emails will appear from your agency name (requires approval)</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Custom Name Input */}
                {useCustomEmail && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Your Agency Name</label>
                    <input
                      type="text"
                      value={emailSenderName}
                      onChange={(e) => setEmailSenderName(e.target.value)}
                      placeholder="Enter your agency name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      maxLength={50}
                    />
                    <p className="text-xs text-gray-500">
                      This name will appear as the sender in all emails to your users after admin approval
                    </p>
                  </div>
                )}

                {/* Preview */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview (after approval)</p>
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-gray-500">From:</span>
                    <span className="font-medium text-gray-900">
                      "{useCustomEmail && emailSenderName.trim() ? emailSenderName.trim() : 'Six Media'}" &lt;info@6ad.in&gt;
                    </span>
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  onClick={handleSaveEmailSettings}
                  disabled={savingEmail || (useCustomEmail && !emailSenderName.trim())}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {savingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {emailSenderNameStatus === 'PENDING' ? 'Update Request' : 'Submit for Approval'}
                    </>
                  )}
                </Button>

                {/* Info about approval */}
                <p className="text-xs text-gray-500 text-center">
                  Custom email sender names require admin approval before they become active.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add Domain Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setNewDomain('')
          setNewLogo('')
          setError('')
        }}
        title="Configure Whitelabel"
      >
        <div className="space-y-6">
          {/* Domain Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="ads.youragency.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter your subdomain without http:// or https://
            </p>
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand Logo</label>
            {newLogo ? (
              <div className="relative w-full h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                <img
                  src={newLogo}
                  alt="Brand Logo"
                  className="max-h-20 max-w-full object-contain"
                />
                <button
                  onClick={() => {
                    setNewLogo('')
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
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
              onChange={(e) => handleLogoUpload(e)}
              className="hidden"
            />
            {/* Logo size recommendations */}
            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-1">Recommended Logo Specifications:</p>
              <ul className="text-xs text-gray-500 space-y-0.5">
                <li>• <strong>Size:</strong> 280×56 pixels (or similar aspect ratio)</li>
                <li>• <strong>Format:</strong> PNG with transparent background</li>
                <li>• <strong>Max file size:</strong> 2MB</li>
                <li>• <strong>Best for:</strong> Horizontal/wide logos work best</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAddModal(false)
                setNewDomain('')
                setNewLogo('')
                setError('')
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary-600 hover:bg-primary-700"
              onClick={handleSubmitDomain}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* DNS Configuration Modal */}
      <Modal
        isOpen={showDnsModal}
        onClose={() => {
          setShowDnsModal(false)
          setSelectedDomain(null)
          setDnsInstructions(null)
          setError('')
        }}
        title="DNS Configuration Required"
        className="max-w-2xl"
      >
        {dnsInstructions && selectedDomain && (
          <div className="space-y-6">
            <p className="text-gray-600">
              To verify ownership of <strong>{selectedDomain.domain}</strong>, please add the following DNS records:
            </p>

            {/* A Record */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">1. A Record</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-500 block">Type</span>
                    <span className="font-mono text-sm">A</span>
                  </div>
                  <div className="flex-1 mx-4">
                    <span className="text-xs text-gray-500 block">Name/Host</span>
                    <span className="font-mono text-sm">{dnsInstructions.name}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-gray-500 block">Points to (IP Address)</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{dnsInstructions.value}</span>
                      <button
                        onClick={() => copyToClipboard(dnsInstructions.value, 'arecord')}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {copiedField === 'arecord' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TXT Record */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">2. TXT Record (Verification)</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <span className="text-xs text-gray-500 block">Name/Host</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm break-all">{dnsInstructions.txtRecord.name}</span>
                    <button
                      onClick={() => copyToClipboard(dnsInstructions.txtRecord.name, 'txtName')}
                      className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                    >
                      {copiedField === 'txtName' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Value</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm break-all">{dnsInstructions.txtRecord.value}</span>
                    <button
                      onClick={() => copyToClipboard(dnsInstructions.txtRecord.value, 'txtValue')}
                      className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                    >
                      {copiedField === 'txtValue' ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> DNS changes can take up to 48 hours to propagate. Once you've added the records, click "Verify DNS" to check the configuration.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDnsModal(false)
                  setSelectedDomain(null)
                  setDnsInstructions(null)
                  setError('')
                }}
              >
                I'll do it later
              </Button>
              <Button
                className="flex-1 bg-primary-600 hover:bg-primary-700"
                onClick={() => handleVerifyDns(selectedDomain)}
                disabled={verifying}
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Verify DNS
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
