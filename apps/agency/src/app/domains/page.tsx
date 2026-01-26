'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { domainsApi } from '@/lib/api'
import { Globe, Plus, Check, X, Copy, RefreshCw, Trash2, AlertCircle, CheckCircle, Clock } from 'lucide-react'

type CustomDomain = {
  id: string
  domain: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  dnsVerified: boolean
  verificationToken: string | null
  adminRemarks: string | null
  approvedAt: string | null
  rejectedAt: string | null
  createdAt: string
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDnsModal, setShowDnsModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [dnsInstructions, setDnsInstructions] = useState<any>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const fetchDomains = async () => {
    try {
      setLoading(true)
      const res = await domainsApi.getAll()
      setDomains(res.domains || [])
    } catch (err) {
      console.error('Failed to fetch domains:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDomains()
  }, [])

  const handleSubmitDomain = async () => {
    if (!newDomain.trim()) {
      setError('Please enter a domain')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await domainsApi.submit({ domain: newDomain.trim() })
      setDomains([res.domain, ...domains])
      setDnsInstructions(res.dnsInstructions)
      setSelectedDomain(res.domain)
      setShowAddModal(false)
      setShowDnsModal(true)
      setNewDomain('')
    } catch (err: any) {
      setError(err.message || 'Failed to submit domain')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyDns = async (domain: CustomDomain) => {
    setVerifying(true)
    try {
      const res = await domainsApi.verify(domain.id)
      if (res.dnsVerified) {
        setDomains(domains.map(d => d.id === domain.id ? { ...d, dnsVerified: true } : d))
        setShowDnsModal(false)
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
          Approved
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

  return (
    <DashboardLayout title="Custom Domains" subtitle="Whitelabel your user panel with your own domain">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">
              Set up a custom domain so your users can access the panel via your own branded URL.
            </p>
          </div>
          {/* Only show Add Domain button if no domains exist */}
          {domains.length === 0 && (
            <Button onClick={() => setShowAddModal(true)} className="bg-primary-600 hover:bg-primary-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          )}
        </div>

        {/* Info Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900">How Custom Domains Work</h3>
              <ol className="mt-2 text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Submit your domain (e.g., <code className="bg-blue-100 px-1 rounded">ads.youragency.com</code>)</li>
                <li>Configure DNS records as instructed</li>
                <li>Verify DNS configuration</li>
                <li>Wait for admin approval</li>
                <li>Once approved, your users can access the panel via your domain</li>
              </ol>
            </div>
          </div>
        </Card>

        {/* Domains List */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading domains...</div>
          ) : domains.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No custom domains yet</h3>
              <p className="text-gray-500 mb-4">Add your first custom domain to start whitelabeling.</p>
              <Button onClick={() => setShowAddModal(true)} className="bg-primary-600 hover:bg-primary-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Domain</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">DNS Verified</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Submitted</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {domains.map((domain) => (
                  <tr key={domain.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{domain.domain}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(domain.status, domain.dnsVerified)}
                    </td>
                    <td className="py-4 px-4">
                      {domain.dnsVerified ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-4 h-4" /> Verified
                        </span>
                      ) : (
                        <span className="text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" /> Not Verified
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-500">
                      {new Date(domain.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {domain.status === 'PENDING' && !domain.dnsVerified && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDomain(domain)
                              setDnsInstructions({
                                type: 'A',
                                name: domain.domain,
                                value: '72.61.172.38',
                                txtRecord: {
                                  name: `_6ad-verify.${domain.domain}`,
                                  value: domain.verificationToken,
                                },
                              })
                              setShowDnsModal(true)
                            }}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />
                            Configure DNS
                          </Button>
                        )}
                        {domain.status === 'PENDING' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteDomain(domain.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {domain.status === 'REJECTED' && domain.adminRemarks && (
                          <span className="text-xs text-red-600" title={domain.adminRemarks}>
                            Reason: {domain.adminRemarks}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Add Domain Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setNewDomain('')
          setError('')
        }}
        title="Add Custom Domain"
      >
        <div className="space-y-4">
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
              {submitting ? 'Submitting...' : 'Submit Domain'}
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
