'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { extensionAdminApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Zap,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  ClipboardCheck,
  Server,
  Share2,
  Key,
  Facebook,
  Edit3,
  LogIn,
  CalendarClock,
} from 'lucide-react'

// Types
interface ExtensionSession {
  id: string
  name: string
  apiKeyPrefix: string
  fbUserId: string | null
  fbUserName: string | null
  fbAccessToken: string | null
  tokenExpiresAt: string | null
  adAccountIds: string[]
  isActive: boolean
  lastSeenAt: string
  lastError: string | null
  totalRecharges: number
  failedRecharges: number
  createdAt: string
}

interface ExpireSession {
  id: string
  name: string
  fbUserName: string
  daysRemaining: number
}

interface RechargeItem {
  id: string
  amount: string
  rechargeStatus: string
  rechargeMethod: string
  rechargeError: string | null
  rechargeAttempts: number
  rechargedAt: string | null
  rechargedBy: string | null
  createdAt: string
  approvedAt: string | null
  waitingMinutes?: number
  adAccount?: {
    id: string
    accountId: string
    name: string
    platform: string
  }
  user?: {
    id: string
    username: string
    email: string
    uniqueId: string
  }
}

type Tab = 'sessions' | 'recharges'

// Helper: time ago
function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Helper: is online (seen in last 30 seconds)
function isOnline(lastSeenAt: string): boolean {
  const now = new Date()
  const lastSeen = new Date(lastSeenAt)
  return (now.getTime() - lastSeen.getTime()) < 30000
}

// Helper: days until token expires
function getDaysRemaining(tokenExpiresAt: string | null): number | null {
  if (!tokenExpiresAt) return null
  const expires = new Date(tokenExpiresAt)
  const now = new Date()
  return Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

export default function ExtensionsPageWrapper() {
  return (
    <Suspense>
      <ExtensionsPage />
    </Suspense>
  )
}

function ExtensionsPage() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('sessions')

  // Sessions state
  const [sessions, setSessions] = useState<ExtensionSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [apiKeyCopied, setApiKeyCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Recharges state
  const [recharges, setRecharges] = useState<RechargeItem[]>([])
  const [rechargesLoading, setRechargesLoading] = useState(true)
  const [rechargeFilter, setRechargeFilter] = useState<string>('all')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Worker status state
  const [workerStatus, setWorkerStatus] = useState<any>(null)

  // FB Login modal state (manual token paste — fallback)
  const [fbLoginModalOpen, setFbLoginModalOpen] = useState(false)
  const [fbLoginName, setFbLoginName] = useState('')
  const [fbLoginToken, setFbLoginToken] = useState('')
  const [isAddingFbLogin, setIsAddingFbLogin] = useState(false)

  // OAuth redirect loading
  const [isOAuthRedirecting, setIsOAuthRedirecting] = useState(false)

  // Expiring sessions
  const [expiringSessions, setExpiringSessions] = useState<ExpireSession[]>([])

  // Token update modal state
  const [tokenModalOpen, setTokenModalOpen] = useState(false)
  const [tokenSessionId, setTokenSessionId] = useState<string | null>(null)
  const [tokenSessionName, setTokenSessionName] = useState('')
  const [newToken, setNewToken] = useState('')
  const [isUpdatingToken, setIsUpdatingToken] = useState(false)

  // Handle OAuth redirect result from URL params
  useEffect(() => {
    const fbLogin = searchParams.get('fb_login')
    const name = searchParams.get('name')
    const message = searchParams.get('message')

    if (fbLogin === 'success') {
      toast.success('FB Login Added', `Connected as ${name || 'Unknown'}`)
      router.replace('/extensions')
    } else if (fbLogin === 'refreshed') {
      toast.success('Token Refreshed', `Token renewed for ${name || 'Unknown'}`)
      router.replace('/extensions')
    } else if (fbLogin === 'error') {
      toast.error('FB Login Failed', message || 'Something went wrong')
      router.replace('/extensions')
    }
  }, [searchParams])

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await extensionAdminApi.getSessions()
      setSessions(res.sessions || [])
    } catch {
      // silent
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  // Fetch recharges
  const fetchRecharges = useCallback(async () => {
    try {
      const res = await extensionAdminApi.getRecharges(rechargeFilter)
      setRecharges(res.recharges || [])
    } catch {
      // silent
    } finally {
      setRechargesLoading(false)
    }
  }, [rechargeFilter])

  // Fetch worker status
  const fetchWorkerStatus = useCallback(async () => {
    try {
      const res = await extensionAdminApi.getWorkerStatus()
      setWorkerStatus(res)
    } catch {
      // silent
    }
  }, [])

  // Fetch expiring sessions
  const fetchExpiringSessions = useCallback(async () => {
    try {
      const res = await extensionAdminApi.getExpiringSessions()
      setExpiringSessions(res.sessions || [])
    } catch {
      // silent
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchSessions()
    fetchRecharges()
    fetchWorkerStatus()
    fetchExpiringSessions()
  }, [fetchSessions, fetchRecharges, fetchWorkerStatus, fetchExpiringSessions])

  // Auto-refresh recharges every 10 seconds when on recharges tab
  useEffect(() => {
    if (activeTab !== 'recharges') return
    const interval = setInterval(() => {
      fetchRecharges()
    }, 10000)
    return () => clearInterval(interval)
  }, [activeTab, fetchRecharges])

  // Auto-refresh sessions every 15 seconds when on sessions tab
  useEffect(() => {
    if (activeTab !== 'sessions') return
    const interval = setInterval(() => {
      fetchSessions()
    }, 15000)
    return () => clearInterval(interval)
  }, [activeTab, fetchSessions])

  // Auto-refresh worker status every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchWorkerStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchWorkerStatus])

  // Create session
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return
    setIsCreating(true)
    try {
      const res = await extensionAdminApi.createSession(newSessionName.trim())
      setNewApiKey(res.apiKey)
      toast.success('Extension Session Created', 'Copy the API key now — it won\'t be shown again!')
      fetchSessions()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to create session')
    } finally {
      setIsCreating(false)
    }
  }

  // Delete session
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this extension session?')) return
    setDeletingId(id)
    try {
      await extensionAdminApi.deleteSession(id)
      toast.success('Session Deactivated')
      fetchSessions()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to deactivate session')
    } finally {
      setDeletingId(null)
    }
  }

  // Copy API key
  const handleCopyApiKey = async () => {
    if (!newApiKey) return
    try {
      await navigator.clipboard.writeText(newApiKey)
      setApiKeyCopied(true)
      setTimeout(() => setApiKeyCopied(false), 2000)
    } catch {
      // Fallback
      const el = document.createElement('textarea')
      el.value = newApiKey
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setApiKeyCopied(true)
      setTimeout(() => setApiKeyCopied(false), 2000)
    }
  }

  // Close create modal
  const handleCloseCreateModal = () => {
    setCreateModalOpen(false)
    setNewSessionName('')
    setNewApiKey(null)
    setApiKeyCopied(false)
  }

  // Mark as manual
  const handleMarkManual = async (depositId: string) => {
    setActionLoadingId(depositId)
    try {
      await extensionAdminApi.markManual(depositId)
      toast.success('Marked as Manual', 'Recharge marked as completed manually')
      fetchRecharges()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to mark as manual')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Retry recharge
  const handleRetry = async (depositId: string) => {
    setActionLoadingId(depositId)
    try {
      await extensionAdminApi.retryRecharge(depositId)
      toast.success('Retry Queued', 'Recharge reset to pending for retry')
      fetchRecharges()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to retry recharge')
    } finally {
      setActionLoadingId(null)
    }
  }

  // FB OAuth Login — redirect to Facebook
  const handleFbOAuth = async (sessionId?: string) => {
    setIsOAuthRedirecting(true)
    try {
      const res = await extensionAdminApi.getFbOAuthUrl(sessionId)
      window.location.href = res.url
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to get Facebook login URL')
      setIsOAuthRedirecting(false)
    }
  }

  // Add FB Login (manual token paste — fallback)
  const handleAddFbLogin = async () => {
    if (!fbLoginName.trim() || !fbLoginToken.trim()) return
    setIsAddingFbLogin(true)
    try {
      const res = await extensionAdminApi.addFbLogin(fbLoginName.trim(), fbLoginToken.trim())
      toast.success('FB Login Added', `Connected as ${res.session.fbUserName}`)
      setFbLoginModalOpen(false)
      setFbLoginName('')
      setFbLoginToken('')
      fetchSessions()
      fetchWorkerStatus()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to add FB login')
    } finally {
      setIsAddingFbLogin(false)
    }
  }

  // Update token on session
  const handleUpdateToken = async () => {
    if (!tokenSessionId || !newToken.trim()) return
    setIsUpdatingToken(true)
    try {
      const res = await extensionAdminApi.setToken(tokenSessionId, newToken.trim())
      toast.success('Token Updated', `Connected as ${res.fbUserName}`)
      setTokenModalOpen(false)
      setTokenSessionId(null)
      setNewToken('')
      fetchSessions()
      fetchWorkerStatus()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to update token')
    } finally {
      setIsUpdatingToken(false)
    }
  }

  // Open token update modal
  const openTokenModal = (sessionId: string, sessionName: string) => {
    setTokenSessionId(sessionId)
    setTokenSessionName(sessionName)
    setNewToken('')
    setTokenModalOpen(true)
  }

  // Status badge for recharges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" /> Queued
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Working...
          </span>
        )
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Done
          </span>
        )
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {status}
          </span>
        )
    }
  }

  // Stats
  const onlineSessions = sessions.filter(s => s.isActive && isOnline(s.lastSeenAt)).length
  const totalAccounts = sessions.reduce((sum, s) => sum + (s.adAccountIds?.length || 0), 0)
  const pendingRecharges = recharges.filter(r => r.rechargeStatus === 'PENDING').length
  const failedRecharges = recharges.filter(r => r.rechargeStatus === 'FAILED').length

  return (
    <DashboardLayout title="Extensions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Extension Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Manage Chrome extension sessions and auto-recharge queue</p>
          </div>
        </div>

        {/* Server Worker Status */}
        {workerStatus && (
          <Card className="!p-4 border-l-4 border-l-green-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <Server className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">Server Worker</h3>
                    {workerStatus.worker?.isRunning ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Running 24/7
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        Stopped
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Auto-processes recharges & BM shares using captured FB tokens — no browser needed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">{workerStatus.worker?.totalRechargesProcessed || 0}</p>
                  <p className="text-xs text-gray-500">Recharges</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-blue-600">{workerStatus.worker?.totalBmSharesProcessed || 0}</p>
                  <p className="text-xs text-gray-500">BM Shares</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-yellow-600">{workerStatus.pendingTasks?.recharges || 0}</p>
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-purple-600">{workerStatus.activeSessions?.length || 0}</p>
                  <p className="text-xs text-gray-500">FB Tokens</p>
                </div>
              </div>
            </div>
            {workerStatus.worker?.lastError && (
              <div className="mt-2 p-2 bg-red-50 rounded-lg">
                <p className="text-xs text-red-600">Last error: {workerStatus.worker.lastError}</p>
              </div>
            )}
          </Card>
        )}

        {/* Token Expiry Warnings */}
        {expiringSessions.length > 0 && (
          <Card className="!p-4 border-l-4 border-l-yellow-500">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Token Expiring Soon</h3>
                <div className="mt-2 space-y-2">
                  {expiringSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{s.fbUserName || s.name}</span>
                        <span className="text-xs text-yellow-700 ml-2">
                          {s.daysRemaining === 0 ? 'Expired!' : `${s.daysRemaining} day${s.daysRemaining === 1 ? '' : 's'} left`}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleFbOAuth(s.id)}
                        loading={isOAuthRedirecting}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh Token
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <Wifi className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{onlineSessions}</p>
                <p className="text-xs text-gray-500">Online Extensions</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
                <p className="text-xs text-gray-500">Ad Accounts</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingRecharges}</p>
                <p className="text-xs text-gray-500">Pending Recharges</p>
              </div>
            </div>
          </Card>
          <Card className="!p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{failedRecharges}</p>
                <p className="text-xs text-gray-500">Failed Recharges</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sessions'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Extension Sessions
          </button>
          <button
            onClick={() => setActiveTab('recharges')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'recharges'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Recharge Queue
            {pendingRecharges > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-full">
                {pendingRecharges}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'sessions' && (
          <Card>
            {/* Sessions Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">FB Logins & Extension Sessions</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSessionsLoading(true); fetchSessions() }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFbOAuth()}
                  loading={isOAuthRedirecting}
                >
                  <LogIn className="w-4 h-4" />
                  Add FB Login
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFbLoginModalOpen(true)}
                  title="Paste token manually"
                >
                  <Key className="w-4 h-4" />
                  Manual Token
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Extension
                </Button>
              </div>
            </div>

            {/* Sessions Table */}
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No extension sessions yet</p>
                <p className="text-gray-400 text-xs mt-1">Click "Add Extension" to create one</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">FB Profile</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">FB Token</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Expires</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Recharges</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => {
                      const online = session.isActive && isOnline(session.lastSeenAt)
                      const hasToken = !!session.fbAccessToken
                      return (
                        <tr key={session.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-3 px-3">
                            {session.isActive ? (
                              hasToken ? (
                                <span className="inline-flex items-center gap-1.5 text-green-600">
                                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-xs font-medium">Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-yellow-600">
                                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                  <span className="text-xs font-medium">No Token</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-gray-400" />
                                <span className="text-xs font-medium">Disabled</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-medium text-gray-900">{session.name}</span>
                          </td>
                          <td className="py-3 px-3">
                            {session.fbUserName ? (
                              <div>
                                <p className="text-gray-900 text-sm">{session.fbUserName}</p>
                                <p className="text-gray-400 text-xs">{session.fbUserId}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">Not connected</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {hasToken ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <Key className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                No token
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {(() => {
                              const days = getDaysRemaining(session.tokenExpiresAt)
                              if (days === null) return <span className="text-gray-400 text-xs">—</span>
                              if (days === 0) return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>
                              )
                              if (days <= 7) return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{days}d</span>
                              )
                              if (days <= 30) return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">{days}d</span>
                              )
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{days}d</span>
                              )
                            })()}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-green-600 font-medium">{session.totalRecharges}</span>
                              {session.failedRecharges > 0 && (
                                <span className="text-xs text-red-500">({session.failedRecharges} failed)</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {hasToken && (
                                <button
                                  onClick={() => handleFbOAuth(session.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors"
                                  title="Refresh token via Facebook OAuth"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => openTokenModal(session.id, session.name)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                title={hasToken ? 'Paste token manually' : 'Add FB token'}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSession(session.id)}
                                disabled={deletingId === session.id}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                title="Deactivate session"
                              >
                                {deletingId === session.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'recharges' && (
          <Card>
            {/* Recharges Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recharge Queue</h2>
              <div className="flex items-center gap-2">
                {/* Filter */}
                <select
                  value={rechargeFilter}
                  onChange={(e) => { setRechargeFilter(e.target.value); setRechargesLoading(true) }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRechargesLoading(true); fetchRecharges() }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Auto-refresh indicator */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-400">Auto-refreshing every 10s</span>
            </div>

            {/* Recharges Table */}
            {rechargesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : recharges.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No recharges in queue</p>
                <p className="text-gray-400 text-xs mt-1">Recharges will appear here when deposits are approved for non-Cheetah accounts</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Account ID</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Attempts</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Wait Time</th>
                      <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Error</th>
                      <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recharges.map((recharge) => (
                      <tr key={recharge.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 px-3">
                          {recharge.user ? (
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{recharge.user.username}</p>
                              <p className="text-gray-400 text-xs">{recharge.user.uniqueId}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {recharge.adAccount ? (
                            <div>
                              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                {recharge.adAccount.accountId}
                              </code>
                              {recharge.adAccount.name && (
                                <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[160px]">{recharge.adAccount.name}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-gray-900">${parseFloat(recharge.amount).toFixed(2)}</span>
                        </td>
                        <td className="py-3 px-3">
                          {getStatusBadge(recharge.rechargeStatus)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-sm ${recharge.rechargeAttempts >= 3 ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                            {recharge.rechargeAttempts}/3
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {recharge.waitingMinutes !== undefined && recharge.waitingMinutes !== null ? (
                            <span className={`text-xs ${recharge.waitingMinutes > 30 ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                              {recharge.waitingMinutes}m
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {recharge.rechargeError ? (
                            <span className="text-xs text-red-500 truncate block max-w-[200px]" title={recharge.rechargeError}>
                              {recharge.rechargeError}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {/* Mark as Manual (for pending/failed) */}
                            {(recharge.rechargeStatus === 'PENDING' || recharge.rechargeStatus === 'FAILED') && (
                              <button
                                onClick={() => handleMarkManual(recharge.id)}
                                disabled={actionLoadingId === recharge.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-green-50 hover:text-green-600 transition-colors disabled:opacity-50"
                                title="Mark as done manually"
                              >
                                {actionLoadingId === recharge.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ClipboardCheck className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {/* Retry (for failed only) */}
                            {recharge.rechargeStatus === 'FAILED' && (
                              <button
                                onClick={() => handleRetry(recharge.id)}
                                disabled={actionLoadingId === recharge.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                                title="Retry recharge"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Manual Token Paste Modal (Fallback) */}
      <Modal
        isOpen={fbLoginModalOpen}
        onClose={() => { setFbLoginModalOpen(false); setFbLoginName(''); setFbLoginToken('') }}
        title="Manual Token Paste"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs text-blue-700">
              Paste a Facebook EAA access token manually. For easier login, use the "Add FB Login" button which redirects you to Facebook directly.
            </p>
          </div>

          <Input
            label="Name"
            placeholder="e.g., John's FB Profile"
            value={fbLoginName}
            onChange={(e) => setFbLoginName(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">FB Access Token</label>
            <textarea
              placeholder="Paste EAA... token here"
              value={fbLoginToken}
              onChange={(e) => setFbLoginToken(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setFbLoginModalOpen(false); setFbLoginName(''); setFbLoginToken('') }} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleAddFbLogin}
              loading={isAddingFbLogin}
              disabled={!fbLoginName.trim() || !fbLoginToken.trim()}
              className="flex-1"
            >
              Add Login
            </Button>
          </div>
        </div>
      </Modal>

      {/* Update Token Modal */}
      <Modal
        isOpen={tokenModalOpen}
        onClose={() => { setTokenModalOpen(false); setNewToken('') }}
        title={`Update Token — ${tokenSessionName}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New FB Access Token</label>
            <textarea
              placeholder="Paste EAA... token here"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setTokenModalOpen(false); setNewToken('') }} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleUpdateToken}
              loading={isUpdatingToken}
              disabled={!newToken.trim()}
              className="flex-1"
            >
              Update Token
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Extension Session Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={handleCloseCreateModal}
        title={newApiKey ? 'API Key Generated' : 'Add Extension Session'}
      >
        {newApiKey ? (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Copy this key now!</p>
                  <p className="text-xs text-yellow-700 mt-0.5">This API key will only be shown once. Store it safely.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gray-900 rounded-xl p-4">
                <code className="text-green-400 text-sm break-all select-all">{newApiKey}</code>
              </div>
              <button
                onClick={handleCopyApiKey}
                className="absolute top-2 right-2 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                title="Copy to clipboard"
              >
                {apiKeyCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-300" />
                )}
              </button>
            </div>

            <Button onClick={handleCloseCreateModal} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Session Name"
              placeholder="e.g., Chrome Profile 1 - John's BM"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
            />
            <p className="text-xs text-gray-500">
              For Chrome extension usage. If you just want to add an FB token, use "Add FB Login" instead.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCloseCreateModal} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreateSession}
                loading={isCreating}
                disabled={!newSessionName.trim()}
                className="flex-1"
              >
                Generate API Key
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
