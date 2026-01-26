'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { domainsApi } from '@/lib/api'
import { Globe, ExternalLink, CheckCircle, AlertCircle, User } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

type CustomDomain = {
  id: string
  domain: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  dnsVerified: boolean
  createdAt: string
  approvedAt: string | null
}

type Agent = {
  id: string
  username: string
  brandName: string | null
  brandLogo: string | null
}

export default function DomainsPage() {
  const { user } = useAuthStore()
  const [domain, setDomain] = useState<CustomDomain | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDomain = async () => {
      try {
        setLoading(true)
        const res = await domainsApi.getAgentDomain()
        setDomain(res.domain)
        setAgent(res.agent)
      } catch (err) {
        console.error('Failed to fetch domain:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDomain()
  }, [])

  if (loading) {
    return (
      <DashboardLayout title="Custom Domain" subtitle="Access the platform via your agent's custom domain">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  // Check if user has an agent
  if (!user?.agentId || !agent) {
    return (
      <DashboardLayout title="Custom Domain" subtitle="Access the platform via your agent's custom domain">
        <Card className="p-12 text-center">
          <Globe className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Agent Assigned</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            You are not assigned to any agent. Custom domain access is only available for users managed by an agent.
          </p>
        </Card>
      </DashboardLayout>
    )
  }

  // No domain configured by agent
  if (!domain) {
    return (
      <DashboardLayout title="Custom Domain" subtitle="Access the platform via your agent's custom domain">
        <Card className="p-12 text-center">
          <Globe className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Custom Domain Available</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Your agent <strong>{agent.brandName || agent.username}</strong> has not configured a custom domain yet.
            Please continue using the current platform URL.
          </p>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Custom Domain" subtitle="Access the platform via your agent's custom domain">
      <div className="max-w-2xl space-y-6">
        {/* Agent Info Card */}
        <Card className="p-6">
          <div className="flex items-center gap-4">
            {agent.brandLogo ? (
              <img
                src={agent.brandLogo}
                alt={agent.brandName || agent.username}
                className="w-16 h-16 rounded-xl object-cover border border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Your Agent</p>
              <h3 className="text-xl font-semibold text-gray-900">
                {agent.brandName || agent.username}
              </h3>
            </div>
          </div>
        </Card>

        {/* Domain Info Card */}
        <Card className="overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-[#52B788]/10 to-green-50 border-b border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#52B788] flex items-center justify-center">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Custom Domain</p>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-gray-900">{domain.domain}</h3>
                  <a
                    href={`https://${domain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#52B788] hover:text-[#40916C]"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600">Status</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-4 h-4" />
                Active
              </span>
            </div>

            {/* Approved Date */}
            {domain.approvedAt && (
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-600">Active Since</span>
                <span className="text-gray-900 font-medium">
                  {new Date(domain.approvedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* Access URL */}
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600">Access URL</span>
              <a
                href={`https://${domain.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#52B788] hover:text-[#40916C] font-medium flex items-center gap-1"
              >
                https://{domain.domain}
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </Card>

        {/* Info Box */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">About Custom Domains</h4>
              <p className="mt-1 text-sm text-blue-800">
                You can access this platform using your agent's custom domain <strong>{domain.domain}</strong>.
                The domain provides a branded experience with your agent's logo and name.
                All features remain the same regardless of which URL you use.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
