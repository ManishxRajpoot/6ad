'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatsChart } from '@/components/ui/StatsChart'
import { domainsApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Globe, Check, X, AlertCircle, CheckCircle, Clock, Search,
  Mail, Image, Sparkles, Loader2, Eye, History, XCircle
} from 'lucide-react'

type AgentCard = {
  agent: {
    id: string
    username: string
    email: string
    brandName: string | null
  }
  domain: {
    id: string
    domain: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    dnsVerified: boolean
    brandLogo: string | null
    favicon: string | null
    logoStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
    faviconStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
    createdAt: string
    approvedAt?: string
    rejectedAt?: string
  } | null
  branding: {
    brandLogo: string | null
    favicon: string | null
    logoStatus: string | null
    faviconStatus: string | null
  } | null
  emailSenderName: {
    requested: string
    current: string | null
    status: string
  } | null
}

type TabType = 'pending' | 'history'

export default function WhitelabelPage() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [agents, setAgents] = useState<AgentCard[]>([])
  const [historyAgents, setHistoryAgents] = useState<AgentCard[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: string; id: string; agentId: string; label: string } | null>(null)
  const [rejectRemarks, setRejectRemarks] = useState('')

  const fetchPending = async () => {
    try {
      setLoading(true)
      const res = await domainsApi.getPendingWhitelabel()
      setAgents(res.agents || [])
    } catch (err) {
      console.error('Failed to fetch pending whitelabel:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true)
      const res = await domainsApi.getWhitelabelHistory()
      setHistoryAgents(res.agents || [])
    } catch (err) {
      console.error('Failed to fetch whitelabel history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchPending()
  }, [])

  // Fetch history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history' && historyAgents.length === 0 && !historyLoading) {
      fetchHistory()
    }
  }, [activeTab])

  // Count totals (includes both domain-level and user-level branding)
  const totalPending = agents.reduce((count, card) => {
    if (card.domain?.status === 'PENDING') count++
    if (card.domain?.logoStatus === 'PENDING') count++
    if (card.domain?.faviconStatus === 'PENDING') count++
    if (card.branding?.logoStatus === 'PENDING') count++
    if (card.branding?.faviconStatus === 'PENDING') count++
    if (card.emailSenderName?.status === 'PENDING') count++
    return count
  }, 0)
  const pendingDomains = agents.filter(c => c.domain?.status === 'PENDING').length
  const pendingLogos = agents.filter(c => c.domain?.logoStatus === 'PENDING' || c.branding?.logoStatus === 'PENDING').length
  const pendingFavicons = agents.filter(c => c.domain?.faviconStatus === 'PENDING' || c.branding?.faviconStatus === 'PENDING').length
  const pendingEmails = agents.filter(c => c.emailSenderName?.status === 'PENDING').length

  // Search filter for both tabs
  const filterCards = (cards: AgentCard[]) => {
    if (!searchQuery.trim()) return cards
    const q = searchQuery.toLowerCase()
    return cards.filter(card =>
      card.agent.username.toLowerCase().includes(q) ||
      card.agent.email.toLowerCase().includes(q) ||
      card.domain?.domain?.toLowerCase().includes(q) ||
      card.emailSenderName?.requested?.toLowerCase().includes(q)
    )
  }

  const filteredAgents = filterCards(agents)
  const filteredHistory = filterCards(historyAgents)

  // Remove an agent card if no more pending items
  const removeItemFromCard = (agentId: string, field: string) => {
    setAgents(prev => {
      return prev.map(card => {
        if (card.agent.id !== agentId) return card
        const updated = { ...card }
        if (field === 'domain' && updated.domain) updated.domain = { ...updated.domain, status: 'APPROVED' as const }
        if (field === 'logo' && updated.domain) updated.domain = { ...updated.domain, logoStatus: 'APPROVED' as const }
        if (field === 'favicon' && updated.domain) updated.domain = { ...updated.domain, faviconStatus: 'APPROVED' as const }
        if (field === 'userLogo' && updated.branding) updated.branding = { ...updated.branding, logoStatus: 'APPROVED' }
        if (field === 'userFavicon' && updated.branding) updated.branding = { ...updated.branding, faviconStatus: 'APPROVED' }
        if (field === 'emailSenderName') updated.emailSenderName = null
        if (field === 'rejectLogo' && updated.domain) updated.domain = { ...updated.domain, logoStatus: 'REJECTED' as const, brandLogo: null }
        if (field === 'rejectFavicon' && updated.domain) updated.domain = { ...updated.domain, faviconStatus: 'REJECTED' as const, favicon: null }
        if (field === 'rejectUserLogo' && updated.branding) updated.branding = { ...updated.branding, logoStatus: 'REJECTED', brandLogo: null }
        if (field === 'rejectUserFavicon' && updated.branding) updated.branding = { ...updated.branding, faviconStatus: 'REJECTED', favicon: null }
        if (field === 'rejectDomain' && updated.domain) updated.domain = { ...updated.domain, status: 'REJECTED' as const }
        if (field === 'rejectEmail') updated.emailSenderName = null
        return updated
      }).filter(card => {
        return card.domain?.status === 'PENDING' || card.domain?.logoStatus === 'PENDING' ||
          card.domain?.faviconStatus === 'PENDING' || card.branding?.logoStatus === 'PENDING' ||
          card.branding?.faviconStatus === 'PENDING' || card.emailSenderName?.status === 'PENDING'
      })
    })
    // Refresh history after an action so it shows up
    if (historyAgents.length > 0) {
      fetchHistory()
    }
  }

  // Approve handlers
  const handleApproveDomain = async (card: AgentCard) => {
    if (!card.domain) return
    setProcessing(`${card.domain.id}-domain`)
    try {
      await domainsApi.approve(card.domain.id)
      removeItemFromCard(card.agent.id, 'domain')
    } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve domain') }
    finally { setProcessing(null) }
  }

  const handleApproveLogo = async (card: AgentCard) => {
    if (card.domain?.logoStatus === 'PENDING') {
      setProcessing(`${card.domain.id}-logo`)
      try {
        await domainsApi.approveLogo(card.domain.id)
        removeItemFromCard(card.agent.id, 'logo')
      } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve logo') }
      finally { setProcessing(null) }
    } else if (card.branding?.logoStatus === 'PENDING') {
      setProcessing(`${card.agent.id}-userlogo`)
      try {
        await domainsApi.approveUserLogo(card.agent.id)
        removeItemFromCard(card.agent.id, 'userLogo')
      } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve logo') }
      finally { setProcessing(null) }
    }
  }

  const handleApproveFavicon = async (card: AgentCard) => {
    if (card.domain?.faviconStatus === 'PENDING') {
      setProcessing(`${card.domain.id}-favicon`)
      try {
        await domainsApi.approveFavicon(card.domain.id)
        removeItemFromCard(card.agent.id, 'favicon')
      } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve favicon') }
      finally { setProcessing(null) }
    } else if (card.branding?.faviconStatus === 'PENDING') {
      setProcessing(`${card.agent.id}-userfavicon`)
      try {
        await domainsApi.approveUserFavicon(card.agent.id)
        removeItemFromCard(card.agent.id, 'userFavicon')
      } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve favicon') }
      finally { setProcessing(null) }
    }
  }

  const handleApproveEmail = async (card: AgentCard) => {
    setProcessing(`${card.agent.id}-email`)
    try {
      await agentsApi.emailSettings.approve(card.agent.id)
      removeItemFromCard(card.agent.id, 'emailSenderName')
    } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve email sender name') }
    finally { setProcessing(null) }
  }

  const handleApproveAll = async (card: AgentCard) => {
    if (!card.domain) return
    setProcessing(`${card.domain.id}-all`)
    try {
      await domainsApi.approveAll(card.domain.id)
      setAgents(prev => prev.filter(c => c.agent.id !== card.agent.id))
      if (historyAgents.length > 0) fetchHistory()
    } catch (err: any) { toast.error('Approve Failed', err.message || 'Failed to approve all') }
    finally { setProcessing(null) }
  }

  // Reject handlers
  const openRejectModal = (type: string, id: string, agentId: string, label: string) => {
    setRejectTarget({ type, id, agentId, label })
    setRejectRemarks('')
    setShowRejectModal(true)
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setProcessing(`${rejectTarget.id}-${rejectTarget.type}`)
    try {
      switch (rejectTarget.type) {
        case 'domain':
          await domainsApi.reject(rejectTarget.id, rejectRemarks || undefined)
          removeItemFromCard(rejectTarget.agentId, 'rejectDomain')
          break
        case 'logo':
          await domainsApi.rejectLogo(rejectTarget.id)
          removeItemFromCard(rejectTarget.agentId, 'rejectLogo')
          break
        case 'favicon':
          await domainsApi.rejectFavicon(rejectTarget.id)
          removeItemFromCard(rejectTarget.agentId, 'rejectFavicon')
          break
        case 'userLogo':
          await domainsApi.rejectUserLogo(rejectTarget.id)
          removeItemFromCard(rejectTarget.agentId, 'rejectUserLogo')
          break
        case 'userFavicon':
          await domainsApi.rejectUserFavicon(rejectTarget.id)
          removeItemFromCard(rejectTarget.agentId, 'rejectUserFavicon')
          break
        case 'email':
          await agentsApi.emailSettings.reject(rejectTarget.id, rejectRemarks || undefined)
          removeItemFromCard(rejectTarget.agentId, 'rejectEmail')
          break
      }
      setShowRejectModal(false)
      setRejectTarget(null)
    } catch (err: any) { toast.error('Reject Failed', err.message || 'Failed to reject') }
    finally { setProcessing(null) }
  }

  const getPendingCount = (card: AgentCard) => {
    let count = 0
    if (card.domain?.status === 'PENDING') count++
    if (card.domain?.logoStatus === 'PENDING') count++
    if (card.domain?.faviconStatus === 'PENDING') count++
    if (card.branding?.logoStatus === 'PENDING') count++
    if (card.branding?.faviconStatus === 'PENDING') count++
    if (card.emailSenderName?.status === 'PENDING') count++
    return count
  }

  // Status badge helper
  const StatusBadge = ({ status }: { status: string | null | undefined }) => {
    if (!status) return <span className="text-gray-400 text-[10px]">—</span>
    if (status === 'APPROVED') return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded-full">
        <CheckCircle className="w-2.5 h-2.5" /> Approved
      </span>
    )
    if (status === 'REJECTED') return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded-full">
        <XCircle className="w-2.5 h-2.5" /> Rejected
      </span>
    )
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-medium rounded-full">
        <Clock className="w-2.5 h-2.5" /> Pending
      </span>
    )
  }

  return (
    <DashboardLayout title="Whitelabel">
      {/* Animation styles */}
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.3s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      <div className="space-y-3">
        {/* Top Actions Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[180px] lg:flex-none group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-colors group-focus-within:text-teal-600" />
            <input
              type="text"
              placeholder="Search agent, domain, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-[12px] w-full lg:w-[260px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white transition-all"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Total Pending</span>
                <p className="text-xl font-bold text-gray-800">{totalPending}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#0D9488] text-white text-[10px] font-medium rounded">{agents.length} agents</span>
            </div>
            <StatsChart value={totalPending} color="#0D9488" filterId="glowTealWl" gradientId="fadeTealWl" clipId="clipTealWl" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Domains</span>
                <p className="text-xl font-bold text-gray-800">{pendingDomains}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-[10px] font-medium rounded">Pending</span>
            </div>
            <StatsChart value={pendingDomains} color="#3B82F6" filterId="glowBlueWl" gradientId="fadeBlueWl" clipId="clipBlueWl" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Logos & Favicons</span>
                <p className="text-xl font-bold text-gray-800">{pendingLogos + pendingFavicons}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#8B5CF6] text-white text-[10px] font-medium rounded">Pending</span>
            </div>
            <StatsChart value={pendingLogos} color="#8B5CF6" filterId="glowPurpleWl" gradientId="fadePurpleWl" clipId="clipPurpleWl" />
          </Card>

          <Card className="p-3 relative overflow-hidden min-h-[80px]">
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] text-gray-500">Email Names</span>
                <p className="text-xl font-bold text-gray-800">{pendingEmails}</p>
              </div>
              <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-[10px] font-medium rounded">Pending</span>
            </div>
            <StatsChart value={pendingEmails} color="#F59E0B" filterId="glowOrangeWl" gradientId="fadeOrangeWl" clipId="clipOrangeWl" />
          </Card>
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
          {/* Tab Header */}
          <div className="border-b border-gray-100 flex-shrink-0 px-5 py-0 flex items-center gap-0">
            <button
              onClick={() => setActiveTab('pending')}
              className={`relative px-4 py-3 text-[13px] font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pending Requests
                {totalPending > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    activeTab === 'pending' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {totalPending}
                  </span>
                )}
              </div>
              {activeTab === 'pending' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-600 rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`relative px-4 py-3 text-[13px] font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                History
                {historyAgents.length > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${
                    activeTab === 'history' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {historyAgents.length}
                  </span>
                )}
              </div>
              {activeTab === 'history' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-600 rounded-t" />
              )}
            </button>
          </div>

          {/* PENDING TAB */}
          {activeTab === 'pending' && (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-[11px] xl:text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[18%]">Agent</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[18%]">Domain</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Logo</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[12%]">Favicon</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[18%]">Email Sender</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[22%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-5 h-5 text-teal-600 animate-spin mb-1" />
                          <span className="text-gray-500">Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredAgents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <CheckCircle className="w-8 h-8 mx-auto text-green-300 mb-2" />
                        <span className="text-gray-500">{searchQuery ? 'No matching requests found' : 'All caught up! No pending requests.'}</span>
                      </td>
                    </tr>
                  ) : (
                    filteredAgents.map((card, index) => (
                      <tr
                        key={card.agent.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        {/* Agent */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm">
                                {card.agent.username.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate max-w-[120px] xl:max-w-[160px]">{card.agent.username}</p>
                              <p className="text-gray-500 text-[10px] truncate">{card.agent.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Domain */}
                        <td className="py-2.5 px-3">
                          {card.domain?.status === 'PENDING' ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-[140px]">{card.domain.domain}</span>
                              </div>
                              <div className="mt-0.5">
                                {card.domain.dnsVerified ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
                                    <Check className="w-2.5 h-2.5" /> DNS Verified
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-yellow-600">
                                    <AlertCircle className="w-2.5 h-2.5" /> DNS Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Logo - domain-level or user-level */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const hasDomainLogo = card.domain?.logoStatus === 'PENDING' && card.domain?.brandLogo
                            const hasUserLogo = card.branding?.logoStatus === 'PENDING' && card.branding?.brandLogo
                            const logoSrc = hasDomainLogo ? card.domain!.brandLogo : hasUserLogo ? card.branding!.brandLogo : null
                            const isProcessing = hasDomainLogo
                              ? processing === `${card.domain!.id}-logo`
                              : processing === `${card.agent.id}-userlogo`
                            const rejectType = hasDomainLogo ? 'logo' : 'userLogo'
                            const rejectId = hasDomainLogo ? card.domain!.id : card.agent.id

                            if (!logoSrc) return <span className="text-gray-400 text-[10px]">—</span>

                            return (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  onClick={() => { setPreviewImage(logoSrc); setPreviewTitle(`${card.agent.username} - Logo`) }}
                                  className="relative group"
                                >
                                  <img
                                    src={logoSrc}
                                    alt="Logo"
                                    className="w-10 h-10 object-contain rounded-md border border-gray-200 bg-gray-50 p-0.5 group-hover:border-teal-400 transition-colors"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                </button>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleApproveLogo(card)}
                                    disabled={isProcessing}
                                    className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                                    title="Approve Logo"
                                  >
                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(rejectType, rejectId, card.agent.id, 'Logo')}
                                    className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                    title="Reject Logo"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                        </td>

                        {/* Favicon - domain-level or user-level */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const hasDomainFav = card.domain?.faviconStatus === 'PENDING' && card.domain?.favicon
                            const hasUserFav = card.branding?.faviconStatus === 'PENDING' && card.branding?.favicon
                            const favSrc = hasDomainFav ? card.domain!.favicon : hasUserFav ? card.branding!.favicon : null
                            const isProcessing = hasDomainFav
                              ? processing === `${card.domain!.id}-favicon`
                              : processing === `${card.agent.id}-userfavicon`
                            const rejectType = hasDomainFav ? 'favicon' : 'userFavicon'
                            const rejectId = hasDomainFav ? card.domain!.id : card.agent.id

                            if (!favSrc) return <span className="text-gray-400 text-[10px]">—</span>

                            return (
                              <div className="flex flex-col items-center gap-1.5">
                                <button
                                  onClick={() => { setPreviewImage(favSrc); setPreviewTitle(`${card.agent.username} - Favicon`) }}
                                  className="relative group"
                                >
                                  <img
                                    src={favSrc}
                                    alt="Favicon"
                                    className="w-8 h-8 object-contain rounded-md border border-gray-200 bg-gray-50 p-0.5 group-hover:border-teal-400 transition-colors"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="w-3 h-3 text-white" />
                                  </div>
                                </button>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleApproveFavicon(card)}
                                    disabled={isProcessing}
                                    className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                                    title="Approve Favicon"
                                  >
                                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  </button>
                                  <button
                                    onClick={() => openRejectModal(rejectType, rejectId, card.agent.id, 'Favicon')}
                                    className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                    title="Reject Favicon"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                        </td>

                        {/* Email Sender */}
                        <td className="py-2.5 px-3">
                          {card.emailSenderName?.status === 'PENDING' ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="font-medium text-gray-900 truncate max-w-[120px]">"{card.emailSenderName.requested}"</span>
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                Current: {card.emailSenderName.current ? `"${card.emailSenderName.current}"` : 'Six Media'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* Individual approve buttons */}
                            {card.domain?.status === 'PENDING' && (
                              <button
                                onClick={() => handleApproveDomain(card)}
                                disabled={!card.domain!.dnsVerified || processing === `${card.domain!.id}-domain`}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded font-medium hover:bg-blue-200 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!card.domain!.dnsVerified ? 'DNS must be verified first' : 'Approve Domain'}
                              >
                                {processing === `${card.domain!.id}-domain` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                                Domain
                              </button>
                            )}

                            {card.emailSenderName?.status === 'PENDING' && (
                              <button
                                onClick={() => handleApproveEmail(card)}
                                disabled={processing === `${card.agent.id}-email`}
                                className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium hover:bg-amber-200 transition-colors whitespace-nowrap disabled:opacity-50"
                                title="Approve Email Sender Name"
                              >
                                {processing === `${card.agent.id}-email` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                Email
                              </button>
                            )}

                            {/* Reject email */}
                            {card.emailSenderName?.status === 'PENDING' && (
                              <button
                                onClick={() => openRejectModal('email', card.agent.id, card.agent.id, `Email: "${card.emailSenderName!.requested}"`)}
                                className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Reject Email"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}

                            {/* Reject domain */}
                            {card.domain?.status === 'PENDING' && (
                              <button
                                onClick={() => openRejectModal('domain', card.domain!.id, card.agent.id, `Domain: ${card.domain!.domain}`)}
                                className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                title="Reject Domain"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}

                            {/* Approve All */}
                            {card.domain && getPendingCount(card) > 1 && (
                              <button
                                onClick={() => handleApproveAll(card)}
                                disabled={processing === `${card.domain!.id}-all`}
                                className="flex items-center gap-1 px-2 py-1 bg-teal-600 text-white rounded font-medium hover:bg-teal-700 transition-colors whitespace-nowrap disabled:opacity-50"
                              >
                                {processing === `${card.domain!.id}-all` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                All
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-[11px] xl:text-[12px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[20%]">Agent</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[20%]">Domain</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Logo</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Favicon</th>
                    <th className="text-left py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Email Sender</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap bg-gray-50 w-[15%]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center">
                        <div className="flex flex-col items-center">
                          <Loader2 className="w-5 h-5 text-teal-600 animate-spin mb-1" />
                          <span className="text-gray-500">Loading history...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <History className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <span className="text-gray-500">{searchQuery ? 'No matching history found' : 'No approval history yet.'}</span>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((card, index) => (
                      <tr
                        key={card.agent.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        {/* Agent */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-shrink-0">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm">
                                {card.agent.username.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate max-w-[120px] xl:max-w-[160px]">{card.agent.username}</p>
                              <p className="text-gray-500 text-[10px] truncate">{card.agent.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Domain */}
                        <td className="py-2.5 px-3">
                          {card.domain ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 truncate max-w-[140px]">{card.domain.domain}</span>
                              </div>
                              <div className="mt-0.5">
                                <StatusBadge status={card.domain.status} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Logo */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const domainLogo = card.domain?.brandLogo
                            const domainLogoStatus = card.domain?.logoStatus
                            const userLogo = card.branding?.brandLogo
                            const userLogoStatus = card.branding?.logoStatus
                            const logoSrc = domainLogo || userLogo
                            const logoStatus = domainLogoStatus || userLogoStatus

                            if (!logoSrc && !logoStatus) return <span className="text-gray-400 text-[10px]">—</span>

                            return (
                              <div className="flex flex-col items-center gap-1">
                                {logoSrc ? (
                                  <button
                                    onClick={() => { setPreviewImage(logoSrc); setPreviewTitle(`${card.agent.username} - Logo`) }}
                                    className="relative group"
                                  >
                                    <img
                                      src={logoSrc}
                                      alt="Logo"
                                      className="w-10 h-10 object-contain rounded-md border border-gray-200 bg-gray-50 p-0.5 group-hover:border-teal-400 transition-colors"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye className="w-3 h-3 text-white" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="w-10 h-10 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <XCircle className="w-3.5 h-3.5 text-gray-300" />
                                  </div>
                                )}
                                <StatusBadge status={logoStatus} />
                              </div>
                            )
                          })()}
                        </td>

                        {/* Favicon */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const domainFav = card.domain?.favicon
                            const domainFavStatus = card.domain?.faviconStatus
                            const userFav = card.branding?.favicon
                            const userFavStatus = card.branding?.faviconStatus
                            const favSrc = domainFav || userFav
                            const favStatus = domainFavStatus || userFavStatus

                            if (!favSrc && !favStatus) return <span className="text-gray-400 text-[10px]">—</span>

                            return (
                              <div className="flex flex-col items-center gap-1">
                                {favSrc ? (
                                  <button
                                    onClick={() => { setPreviewImage(favSrc); setPreviewTitle(`${card.agent.username} - Favicon`) }}
                                    className="relative group"
                                  >
                                    <img
                                      src={favSrc}
                                      alt="Favicon"
                                      className="w-8 h-8 object-contain rounded-md border border-gray-200 bg-gray-50 p-0.5 group-hover:border-teal-400 transition-colors"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Eye className="w-3 h-3 text-white" />
                                    </div>
                                  </button>
                                ) : (
                                  <div className="w-8 h-8 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                                    <XCircle className="w-3 h-3 text-gray-300" />
                                  </div>
                                )}
                                <StatusBadge status={favStatus} />
                              </div>
                            )
                          })()}
                        </td>

                        {/* Email Sender */}
                        <td className="py-2.5 px-3">
                          {card.emailSenderName ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                <span className="font-medium text-gray-700 truncate max-w-[120px]">"{card.emailSenderName.requested || card.emailSenderName.current}"</span>
                              </div>
                              <div className="mt-0.5">
                                <StatusBadge status={card.emailSenderName.status} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>

                        {/* Overall Status */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const statuses: string[] = []
                            if (card.domain?.status && card.domain.status !== 'PENDING') statuses.push(card.domain.status)
                            if (card.domain?.logoStatus && card.domain.logoStatus !== 'PENDING') statuses.push(card.domain.logoStatus)
                            if (card.domain?.faviconStatus && card.domain.faviconStatus !== 'PENDING') statuses.push(card.domain.faviconStatus)
                            if (card.branding?.logoStatus && card.branding.logoStatus !== 'PENDING') statuses.push(card.branding.logoStatus)
                            if (card.branding?.faviconStatus && card.branding.faviconStatus !== 'PENDING') statuses.push(card.branding.faviconStatus)
                            if (card.emailSenderName?.status && card.emailSenderName.status !== 'PENDING') statuses.push(card.emailSenderName.status)

                            const approvedCount = statuses.filter(s => s === 'APPROVED').length
                            const rejectedCount = statuses.filter(s => s === 'REJECTED').length

                            return (
                              <div className="flex flex-col items-center gap-0.5">
                                {approvedCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium">
                                    <CheckCircle className="w-3 h-3" /> {approvedCount} Approved
                                  </span>
                                )}
                                {rejectedCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-red-600 font-medium">
                                    <XCircle className="w-3 h-3" /> {rejectedCount} Rejected
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Image Preview Modal */}
      <Modal
        isOpen={!!previewImage}
        onClose={() => { setPreviewImage(null); setPreviewTitle('') }}
        title={previewTitle}
      >
        {previewImage && (
          <div className="flex justify-center p-4">
            <img
              src={previewImage}
              alt={previewTitle}
              className="max-w-full max-h-[400px] object-contain rounded-lg border border-gray-200 bg-gray-50 p-2"
            />
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => { setShowRejectModal(false); setRejectTarget(null); setRejectRemarks('') }}
        title={`Reject ${rejectTarget?.label || ''}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Note:</strong> This will reject the {rejectTarget?.type} request. The agent will be notified.
            </p>
          </div>

          {(rejectTarget?.type === 'domain' || rejectTarget?.type === 'email' || rejectTarget?.type === 'userLogo' || rejectTarget?.type === 'userFavicon') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
              <textarea
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowRejectModal(false); setRejectTarget(null); setRejectRemarks('') }}
            >
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleReject} loading={processing !== null}>
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
