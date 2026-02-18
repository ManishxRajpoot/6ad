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
  status: 'launching' | 'logging_in' | 'waiting_manual_login' | 'needs_2fa' | 'submitting_2fa' | 'capturing_token' | 'success' | 'failed'
  error?: string
  fbName?: string
  screenshot?: string
  tokenCount?: number
}

export default function FbLoginsPage() {
  const toast = useToast()
  const [sessions, setSessions] = useState<FbSession[]>([])
  const [workerStatus, setWorkerStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [modalTab, setModalTab] = useState<'paste' | 'browser'>('paste')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginTwoFASecret, setLoginTwoFASecret] = useState('')
  const [isStartingLogin, setIsStartingLogin] = useState(false)

  // Paste token state
  const [pasteTokenName, setPasteTokenName] = useState('')
  const [pasteTokenValue, setPasteTokenValue] = useState('')
  const [isPastingToken, setIsPastingToken] = useState(false)

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
          tokenCount: (status as any).tokenCount || 0,
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

  // Paste token manually
  const handlePasteToken = async () => {
    if (!pasteTokenValue.trim()) return
    setIsPastingToken(true)
    try {
      const name = pasteTokenName.trim() || 'FB Login'
      const result = await extensionAdminApi.addFbLogin(name, pasteTokenValue.trim())
      toast.success(result.message || 'Token added successfully!')
      setShowLoginModal(false)
      setPasteTokenName('')
      setPasteTokenValue('')
      fetchSessions()
      fetchWorkerStatus()
    } catch (err: any) {
      toast.handleApiError(err, 'Failed to add token')
    } finally {
      setIsPastingToken(false)
    }
  }

  // Start browser login
  const handleStartLogin = async () => {
    setIsStartingLogin(true)
    try {
      const result = await extensionAdminApi.startBrowserLogin(loginEmail.trim() || '', loginPassword.trim() || '', loginTwoFASecret.trim() || undefined)
      setLoginProgress({
        sessionId: result.sessionId,
        status: 'launching',
      })
      setShowLoginModal(false)
      setLoginEmail('')
      setLoginPassword('')
      setLoginTwoFASecret('')
      toast.success('Opening Chrome — login manually in the browser window')
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

  // Finish browsing & capture token
  const [isFinishing, setIsFinishing] = useState(false)
  const handleFinishCapture = async () => {
    if (!loginProgress) return
    setIsFinishing(true)
    try {
      const result = await extensionAdminApi.finishBrowserLogin(loginProgress.sessionId)
      toast.success(result.message || 'Token captured!')
      setLoginProgress(prev => prev ? { ...prev, status: 'success', fbName: result.fbName } : null)
      fetchSessions()
      fetchWorkerStatus()
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to capture token'
      toast.error(errorMsg)
      // Don't close — user can browse more and try again
    } finally {
      setIsFinishing(false)
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
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Opening Login</span>
      case 'waiting_manual_login':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><User className="w-3 h-3" /> Waiting for Login</span>
      case 'needs_2fa':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Shield className="w-3 h-3" /> 2FA Required</span>
      case 'submitting_2fa':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" /> Submitting 2FA</span>
      case 'capturing_token':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><User className="w-3 h-3" /> Browse &amp; Capture</span>
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

          {/* Waiting for manual login */}
          {loginProgress.status === 'waiting_manual_login' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-amber-50 rounded-lg p-4">
                <User className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Login manually in the Chrome window</p>
                  <p className="text-xs text-amber-700 mt-1">
                    A Chrome browser has opened. Please login to Facebook there (solve CAPTCHA, enter 2FA, etc.).
                    Once you are logged in, the system will automatically detect it and capture the token.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    After logging in, browse to Ads Manager or Business Settings to trigger token capture.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelLogin}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Manual browsing mode — user browses FB, then clicks Finish */}
          {loginProgress.status === 'capturing_token' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-green-50 rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-900">Logged in! Now browse Facebook pages</p>
                  <p className="text-xs text-green-700 mt-1">
                    The system is listening for tokens in the background. Please browse these pages in the Chrome window:
                  </p>
                  <ul className="list-disc list-inside text-xs text-green-700 mt-2 space-y-0.5">
                    <li><strong>Ads Manager</strong> — adsmanager.facebook.com</li>
                    <li><strong>Business Settings</strong> — business.facebook.com/settings</li>
                    <li><strong>Ad Accounts</strong> — Business Settings → Ad Accounts</li>
                    <li>Click around, open pages, scroll — this triggers API calls</li>
                  </ul>
                  {loginProgress.tokenCount !== undefined && loginProgress.tokenCount > 0 && (
                    <p className="text-xs text-green-800 mt-2 bg-green-100 rounded px-2 py-1 inline-block">
                      {loginProgress.tokenCount} token(s) captured so far
                    </p>
                  )}
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    When done browsing, click "Finish &amp; Capture Token" below.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleFinishCapture}
                  disabled={isFinishing}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {isFinishing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Validating tokens...
                    </span>
                  ) : (
                    'Finish & Capture Token'
                  )}
                </button>
                <button
                  onClick={handleCancelLogin}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Loading states */}
          {['launching', 'logging_in', 'submitting_2fa'].includes(loginProgress.status) && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {loginProgress.status === 'launching' && 'Launching browser...'}
                {loginProgress.status === 'logging_in' && 'Opening Facebook login page...'}
                {loginProgress.status === 'submitting_2fa' && 'Submitting 2FA code...'}
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
          <li>Click "Add FB Login" — a Chrome browser opens with Facebook login</li>
          <li>Login manually in Chrome (solve CAPTCHA, enter 2FA, etc.)</li>
          <li>Browse Ads Manager, Business Settings, Ad Accounts pages — click around</li>
          <li>Click "Finish &amp; Capture Token" — system validates captured tokens</li>
          <li>The background worker uses the token for BM shares &amp; recharges</li>
        </ol>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Facebook Login</h3>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setModalTab('paste')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'paste' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Paste Token
              </button>
              <button
                onClick={() => setModalTab('browser')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'browser' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Open Browser
              </button>
            </div>

            {/* Paste Token Tab */}
            {modalTab === 'paste' && (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    Get the token from the 6AD Chrome extension popup or from Facebook Graph API Explorer.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={pasteTokenName}
                    onChange={(e) => setPasteTokenName(e.target.value)}
                    placeholder="e.g. Main FB Account"
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                  <textarea
                    value={pasteTokenValue}
                    onChange={(e) => setPasteTokenValue(e.target.value)}
                    placeholder="Paste EAA... token here"
                    rows={3}
                    className="w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => { setShowLoginModal(false); setPasteTokenName(''); setPasteTokenValue('') }}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasteToken}
                    disabled={isPastingToken || !pasteTokenValue.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPastingToken ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Validating...
                      </span>
                    ) : (
                      'Add Token'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Browser Tab */}
            {modalTab === 'browser' && (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">How it works:</p>
                  <ol className="list-decimal list-inside text-xs text-blue-700 space-y-1">
                    <li>A Chrome browser will open with Facebook login page</li>
                    <li>Login manually (solve CAPTCHA, 2FA, etc.)</li>
                    <li>Browse Ads Manager, BM Settings — click around pages</li>
                    <li>Click "Finish &amp; Capture Token" when done browsing</li>
                  </ol>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartLogin}
                    disabled={isStartingLogin}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isStartingLogin ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Opening...
                      </span>
                    ) : (
                      'Open Chrome'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
