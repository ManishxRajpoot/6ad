'use client'

import { useState, useEffect } from 'react'
import { bmConfigApi, BMConfig } from '@/lib/api'
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Building2,
  Key,
  TestTube,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  Server,
  Link2,
} from 'lucide-react'

export default function BMConfigPage() {
  const [configs, setConfigs] = useState<BMConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    bmId: '',
    bmName: '',
    accessToken: '',
  })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Test results
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; accountCount?: number }>>({})

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const response = await bmConfigApi.getAll()
      setConfigs(response.configs || [])
    } catch (error: any) {
      console.error('Failed to fetch BM configs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  const handleAddConfig = async () => {
    if (!formData.bmId || !formData.accessToken) {
      setFormError('BM ID and Access Token are required')
      return
    }

    setFormLoading(true)
    setFormError('')

    try {
      await bmConfigApi.create({
        bmId: formData.bmId,
        bmName: formData.bmName || `BM ${formData.bmId}`,
        accessToken: formData.accessToken,
        apiType: 'facebook',
      })

      setShowAddModal(false)
      setFormData({ bmId: '', bmName: '', accessToken: '' })
      fetchConfigs()
    } catch (error: any) {
      setFormError(error.message || 'Failed to add BM configuration')
    } finally {
      setFormLoading(false)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const result = await bmConfigApi.test(id)
      setTestResults(prev => ({
        ...prev,
        [id]: {
          success: result.success,
          message: result.message || result.error || '',
          accountCount: result.accountCount,
        }
      }))

      if (result.success) {
        fetchConfigs() // Refresh to get updated account count
      }
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        [id]: { success: false, message: error.message || 'Test failed' }
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      const result = await bmConfigApi.syncAccounts(id)
      if (result.success) {
        fetchConfigs()
        alert(`Synced ${result.total} accounts from this BM`)
      } else {
        alert(`Sync failed: ${result.error}`)
      }
    } catch (error: any) {
      alert(`Sync failed: ${error.message}`)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this BM configuration?')) return

    setDeletingId(id)
    try {
      await bmConfigApi.delete(id)
      fetchConfigs()
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleActive = async (config: BMConfig) => {
    try {
      await bmConfigApi.update(config.id, { isActive: !config.isActive })
      fetchConfigs()
    } catch (error: any) {
      alert(`Update failed: ${error.message}`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Business Manager Configuration
          </h1>
          <p className="text-gray-500 mt-1">
            Manage Facebook Business Manager tokens for automatic BM sharing
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add BM
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">How to get System User Access Token:</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700">
              <li>Go to <span className="font-medium">Business Settings</span> → <span className="font-medium">Users</span> → <span className="font-medium">System Users</span></li>
              <li>Create a System User with <span className="font-medium">Admin</span> role</li>
              <li>Click <span className="font-medium">Generate Token</span></li>
              <li>Select your App and add permissions: <code className="bg-blue-100 px-1 rounded">ads_management</code>, <code className="bg-blue-100 px-1 rounded">business_management</code></li>
              <li>Copy the generated token</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{configs.length}</p>
              <p className="text-sm text-gray-500">Total BMs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{configs.filter(c => c.isActive).length}</p>
              <p className="text-sm text-gray-500">Active BMs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Server className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{configs.reduce((sum, c) => sum + c.totalAccounts, 0)}</p>
              <p className="text-sm text-gray-500">Total Accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* BM List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : configs.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No BM Configurations</h3>
          <p className="text-gray-500 mb-4">Add your first Business Manager to enable automatic BM sharing</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add First BM
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`bg-white rounded-xl border p-5 transition-all ${
                config.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${config.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Building2 className={`w-6 h-6 ${config.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{config.bmName}</h3>
                      {config.isActive ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Key className="w-4 h-4" />
                        BM ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{config.bmId}</code>
                        <button onClick={() => copyToClipboard(config.bmId)} className="hover:text-blue-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </span>
                      <span>•</span>
                      <span>{config.totalAccounts} accounts</span>
                      {config.lastSyncAt && (
                        <>
                          <span>•</span>
                          <span>Last sync: {new Date(config.lastSyncAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    {/* Test Result */}
                    {testResults[config.id] && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${
                        testResults[config.id].success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          {testResults[config.id].success ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {testResults[config.id].message}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(config.id)}
                    disabled={testingId === config.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testingId === config.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    Test
                  </button>
                  <button
                    onClick={() => handleSync(config.id)}
                    disabled={syncingId === config.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {syncingId === config.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Sync
                  </button>
                  <button
                    onClick={() => handleToggleActive(config)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg ${
                      config.isActive ? 'hover:bg-yellow-50 text-yellow-600' : 'hover:bg-green-50 text-green-600'
                    }`}
                  >
                    {config.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    disabled={deletingId === config.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === config.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add BM Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Add Business Manager</h2>
              <p className="text-sm text-gray-500 mt-1">Add a Facebook Business Manager for automatic BM sharing</p>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Manager ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.bmId}
                  onChange={(e) => setFormData({ ...formData, bmId: e.target.value.replace(/\D/g, '') })}
                  placeholder="e.g., 123456789012345"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Find this in Business Settings → Business Info</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.bmName}
                  onChange={(e) => setFormData({ ...formData, bmName: e.target.value })}
                  placeholder="e.g., Client ABC BM"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">A friendly name to identify this BM (auto-filled from Facebook if left empty)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System User Access Token <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={formData.accessToken}
                    onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                    placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">The token will be validated before saving</p>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setFormData({ bmId: '', bmName: '', accessToken: '' })
                  setFormError('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddConfig}
                disabled={formLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Add BM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
