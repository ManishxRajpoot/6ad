'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { extensionAdminApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import {
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Shield,
  User,
  Server,
  AlertTriangle,
} from 'lucide-react'

interface FbSession {
  id: string
  name: string
  isActive: boolean
  fbUserName?: string
  fbUserId?: string
  fbAccessToken?: string | null
  totalRecharges: number
  failedRecharges: number
  createdAt: string
  lastSeenAt?: string
  lastError?: string
}

interface LoginProgress {
  sessionId: string
  status: 'launching' | 'logging_in' | 'needs_2fa' | 'submitting_2fa' | 'capturing_token' | 'success' | 'failed'
  error?: string
  fbName?: string
  screenshot?: string
}

export default function FbLoginsPage() {
  const toast = useToast()
  const [sessions, setSessions] = useState<FbSession[]>([])
  const [workerStatus, setWorkerStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [isStartingLogin, setIsStartingLogin] = useState(false)

  // Active login progress
  const [loginProgress, setLoginProgress] = useState<LoginProgress | null>(null)
  const [twoFACode, setTwoFACode] = useState('')
  const [isSubmitting2FA, setIsSubmitting2FA] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const data = await extensionAdminApi.getSessions()
      setSessions(data.sessions)
    } catch {}
  }, [])

  const fetchWorkerStatus = useCallback(async () => {
    try {
      const data = await extensionAdminApi.getWorkerStatus()
      setWorkerStatus(data)
    } catch {}
  }, [])

  useEffect(() => {
    Promise.all([fetchSessions(), fetchWorkerStatus()]).finally(() => setLoading(false))
    const interval = setInterval(() => {
      fetchSessions()
      fetchWorkerStatus()
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchSessions, fetchWorkerStatus])

  // Poll login status when a login is in progress
  useEffect(() => {
    if (!loginProgress || loginProgress.status === 'success' || loginProgress.status === 'failed') {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }

    pollRef.current = setInterval(async () => {
      try {
        const status = await extensionAdminApi.getLoginStatus(loginProgress.sessionId)
        setLoginProgress({
          sessionId: loginProgress.sessionId,
          status: status.status as LoginProgress['status'],
          error: status.error,
          fbName: status.fbName,
          screenshot: status.screenshot || undefined,
        })

        if (status.status === 'success') {
          toast.success(`FB Login successful: ${status.fbName}`)
          fetchSessions()
          fetchWorkerStatus()
        } else if (status.status === 'failed') {
          toast.error(status.error || 'Login failed')
        }
      } catch {}
    }, 2000)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [loginProgress, fetchSessions, fetchWorkerStatus])

  // Start browser login
  const handleStartLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Email and password are required')
      return
    }

    setIsStartingLogin(true)
    try {
      const result = await extensionAdminApi.startBrowserLogin(loginEmail.trim(), loginPassword.trim())
      setLoginProgress({
        sessionId: result.sessionId,
        status: 'launching',
      })
      setShowLoginModal(false)
      setLoginEmail('')
      setLoginPassword('')
      toast.success('Login started, please wait...')
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to start login')
    } finally {
      setIsStartingLogin(false)
    }
  }

  // Submit 2FA code
  const handleSubmit2FA = async () => {
    if (!loginProgress || !twoFACode.trim()) return

    setIsSubmitting2FA(true)
    try {
      await extensionAdminApi.submit2FA(loginProgress.sessionId, twoFACode.trim())
      setTwoFACode('')
      setLoginProgress(prev => prev ? { ...prev, status: 'submitting_2fa' } : null)
      toast.success('2FA code submitted, please wait...')
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to submit 2FA')
    } finally {
      setIsSubmitting2FA(false)
    }
  }

  // Cancel login
  const handleCancelLogin = async () => {
    if (!loginProgress) return
    try {
      await extensionAdminApi.cancelBrowserLogin(loginProgress.sessionId)
    } catch {}
    setLoginProgress(null)
    setTwoFACode('')
  }

  // Delete/deactivate session
  const handleDeleteSession = async (id: string) => {
    if (!confirm('Deactivate this FB login?')) return
    try {
      await extensionAdminApi.deleteSession(id)
      toast.success('Session deactivated')
      fetchSessions()
      fetchWorkerStatus()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to deactivate')
    }
  }

  const activeFbSessions = sessions.filter(s => s.isActive && s.fbAccessToken)
  const totalSessions = sessions.filter(s => s.isActive)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'launching':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Launching Browser</span>
      case 'logging_in':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Logging In</span>
      case 'needs_2fa':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Shield className="w-3 h-3" /> 2FA Required</span>
      case 'submitting_2fa':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Submitting 2FA</span>
      case 'capturing_token':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Capturing Token</span>
      case 'success':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Success</span>
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Failed</span>
      default:
        return <span className="text-xs text-gray-500">{status}</span>
    }
  }

  return (
    <DashboardLayout title="FB Logins" subtitle="Manage Facebook login sessions for auto recharge & BM share">

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeFbSessions.length}</p>
              <p className="text-xs text-gray-500">Active FB Tokens</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Server className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {workerStatus?.worker?.isRunning ? 'Running' : 'Stopped'}
              </p>
              <p className="text-xs text-gray-500">Worker Status</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {(workerStatus?.pendingTasks?.recharges || 0) + (workerStatus?.pendingTasks?.bmShares || 0)}
              </p>
              <p className="text-xs text-gray-500">Pending Tasks</p>
            </div>
          </div>
        </div>
      </div>

      {/* Login Progress Card */}
      {loginProgress && loginProgress.status !== 'success' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Login In Progress</h3>
            {getStatusBadge(loginProgress.status)}
          </div>

          {loginProgress.error && (
            <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{loginProgress.error}</p>
            </div>
          )}

          {/* Screenshot preview */}
          {loginProgress.screenshot && (
            <div className="mb-4 border rounded-lg overflow-hidden">
              <img
                src={`data:image/png;base64,${loginProgress.screenshot}`}
                alt="Browser screenshot"
                className="w-full max-h-[300px] object-contain bg-gray-50"
              />
            </div>
          )}

          {/* 2FA Input */}
          {loginProgress.status === 'needs_2fa' && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter 2FA Code
                </label>
                <input
                  type="text"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit2FA()}
                  autoFocus
                />
              </div>
              <button
                onClick={handleSubmit2FA}
                disabled={isSubmitting2FA || !twoFACode.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting2FA ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Submit'
                )}
              </button>
              <button
                onClick={handleCancelLogin}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Loading states */}
          {['launching', 'logging_in', 'submitting_2fa', 'capturing_token'].includes(loginProgress.status) && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {loginProgress.status === 'launching' && 'Launching browser...'}
                {loginProgress.status === 'logging_in' && 'Entering credentials and logging in...'}
                {loginProgress.status === 'submitting_2fa' && 'Submitting 2FA code...'}
                {loginProgress.status === 'capturing_token' && 'Capturing access token...'}
              </span>
            </div>
          )}

          {/* Failed — show retry option */}
          {loginProgress.status === 'failed' && (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setLoginProgress(null)
                  setShowLoginModal(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={() => setLoginProgress(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* FB Login Sessions Table */}
      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            FB Login Sessions ({totalSessions.length})
          </h3>
          <button
            onClick={() => setShowLoginModal(true)}
            disabled={!!loginProgress && !['success', 'failed'].includes(loginProgress.status)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add FB Login
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No FB logins yet</p>
            <p className="text-gray-400 text-xs mt-1">Click "Add FB Login" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">FB User</th>
                  <th className="px-6 py-3">Token</th>
                  <th className="px-6 py-3">Recharges</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Added</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map(session => (
                  <tr key={session.id} className={`hover:bg-gray-50 ${!session.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">{session.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {session.fbUserName || '-'}
                      </span>
                      {session.fbUserId && (
                        <span className="block text-xs text-gray-400">ID: {session.fbUserId}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {session.fbAccessToken ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          No Token
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{session.totalRecharges || 0}</span>
                      {session.failedRecharges > 0 && (
                        <span className="text-xs text-red-500 ml-1">({session.failedRecharges} failed)</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {session.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Inactive</span>
                      )}
                      {session.lastError && (
                        <span className="block text-xs text-red-500 mt-0.5">{session.lastError}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {session.isActive && (
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 bg-blue-50 rounded-2xl border border-blue-100 p-6">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works</h4>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>Click "Add FB Login" and enter your Facebook email & password</li>
          <li>If 2FA is enabled, you'll be asked to enter the code</li>
          <li>System logs in, captures the access token automatically</li>
          <li>The background worker uses the token for BM shares & recharges</li>
          <li>Token lasts ~60 days, then you'll need to login again</li>
        </ol>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Facebook Login</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Facebook Email / Phone
                </label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter Facebook email or phone"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter Facebook password"
                  className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleStartLogin()}
                />
              </div>

              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  Your credentials are only used to login once via a secure browser session on the server.
                  They are NOT stored anywhere. Only the access token is saved.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLoginModal(false)
                  setLoginEmail('')
                  setLoginPassword('')
                }}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleStartLogin}
                disabled={isStartingLogin || !loginEmail.trim() || !loginPassword.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {isStartingLogin ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting...
                  </span>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
