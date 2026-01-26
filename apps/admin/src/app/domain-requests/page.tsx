'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { domainsApi } from '@/lib/api'
import { Globe, Check, X, AlertCircle, CheckCircle, Clock, ExternalLink, User } from 'lucide-react'

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
  agent: {
    id: string
    username: string
    email: string
    brandName: string | null
    brandLogo: string | null
  }
}

export default function DomainRequestsPage() {
  const [domains, setDomains] = useState<CustomDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [showActionModal, setShowActionModal] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<CustomDomain | null>(null)
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [adminRemarks, setAdminRemarks] = useState('')
  const [processing, setProcessing] = useState(false)

  const fetchDomains = async () => {
    try {
      setLoading(true)
      const res = await domainsApi.getAll(filterStatus || undefined)
      setDomains(res.domains || [])
    } catch (err) {
      console.error('Failed to fetch domains:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDomains()
  }, [filterStatus])

  const handleAction = async () => {
    if (!selectedDomain) return

    setProcessing(true)
    try {
      if (actionType === 'approve') {
        await domainsApi.approve(selectedDomain.id, adminRemarks || undefined)
      } else {
        await domainsApi.reject(selectedDomain.id, adminRemarks || undefined)
      }

      // Update local state
      setDomains(domains.map(d => {
        if (d.id === selectedDomain.id) {
          return {
            ...d,
            status: actionType === 'approve' ? 'APPROVED' : 'REJECTED',
            adminRemarks: adminRemarks || null,
            approvedAt: actionType === 'approve' ? new Date().toISOString() : null,
            rejectedAt: actionType === 'reject' ? new Date().toISOString() : null,
          }
        }
        return d
      }))

      setShowActionModal(false)
      setSelectedDomain(null)
      setAdminRemarks('')
    } catch (err: any) {
      alert(err.message || `Failed to ${actionType} domain`)
    } finally {
      setProcessing(false)
    }
  }

  const openActionModal = (domain: CustomDomain, action: 'approve' | 'reject') => {
    setSelectedDomain(domain)
    setActionType(action)
    setAdminRemarks('')
    setShowActionModal(true)
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

  const pendingCount = domains.filter(d => d.status === 'PENDING').length
  const approvedCount = domains.filter(d => d.status === 'APPROVED').length
  const rejectedCount = domains.filter(d => d.status === 'REJECTED').length

  return (
    <DashboardLayout title="Domain Requests" subtitle="Manage agent custom domain whitelabeling requests">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-xl font-bold">{domains.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-bold text-blue-600">{pendingCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-xl font-bold text-green-600">{approvedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rejected</p>
                <p className="text-xl font-bold text-red-600">{rejectedCount}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Domains Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading domain requests...</div>
          ) : domains.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No domain requests</h3>
              <p className="text-gray-500">No agents have submitted custom domain requests yet.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Domain</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Agent</th>
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
                        <div>
                          <span className="font-medium text-gray-900">{domain.domain}</span>
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-gray-400 hover:text-gray-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5 inline" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {domain.agent.brandLogo ? (
                          <img
                            src={domain.agent.brandLogo}
                            alt={domain.agent.brandName || domain.agent.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{domain.agent.username}</p>
                          <p className="text-xs text-gray-500">{domain.agent.email}</p>
                        </div>
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
                      {domain.status === 'PENDING' ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => openActionModal(domain, 'approve')}
                            disabled={!domain.dnsVerified}
                            title={!domain.dnsVerified ? 'DNS must be verified first' : 'Approve this domain'}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => openActionModal(domain, 'reject')}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {domain.status === 'APPROVED' ? (
                            <>Approved on {domain.approvedAt ? new Date(domain.approvedAt).toLocaleDateString() : '-'}</>
                          ) : (
                            <>Rejected on {domain.rejectedAt ? new Date(domain.rejectedAt).toLocaleDateString() : '-'}</>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Action Modal */}
      <Modal
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false)
          setSelectedDomain(null)
          setAdminRemarks('')
        }}
        title={actionType === 'approve' ? 'Approve Domain' : 'Reject Domain'}
      >
        {selectedDomain && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">Domain</p>
              <p className="font-medium text-gray-900">{selectedDomain.domain}</p>
              <p className="text-sm text-gray-500 mt-2 mb-1">Agent</p>
              <p className="font-medium text-gray-900">{selectedDomain.agent.username} ({selectedDomain.agent.email})</p>
            </div>

            {actionType === 'approve' ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> Once approved, users of this agent will be able to access the platform via <strong>{selectedDomain.domain}</strong> with the agent's branding.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>Note:</strong> The agent will be notified that their domain request has been rejected.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Remarks (Optional)
              </label>
              <textarea
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder={actionType === 'reject' ? 'Reason for rejection...' : 'Any notes...'}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowActionModal(false)
                  setSelectedDomain(null)
                  setAdminRemarks('')
                }}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                onClick={handleAction}
                disabled={processing}
              >
                {processing ? 'Processing...' : actionType === 'approve' ? 'Approve Domain' : 'Reject Domain'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
