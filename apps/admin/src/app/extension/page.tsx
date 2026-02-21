'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { extensionApi } from '@/lib/api'
import { Copy, Check, RefreshCw, Plus, Trash2, Plug, Wifi, WifiOff, ToggleLeft, ToggleRight } from 'lucide-react'

type ExtensionProfile = {
  id: string
  label: string
  fbUserId: string | null
  fbUserName: string | null
  extensionApiKey: string | null
  lastHeartbeatAt: string | null
  fbAccessToken: string | null // 'captured' or null
  fbTokenCapturedAt: string | null
  status: string
  isEnabled: boolean
  isOnline: boolean
  remarks: string | null
  adsPowerSerialNumber: string | null
  managedAdAccountIds: string[]
  createdAt: string
}

export default function ExtensionPage() {
  const [profiles, setProfiles] = useState<ExtensionProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createLabel, setCreateLabel] = useState('')
  const [createRemarks, setCreateRemarks] = useState('')
  const [createSerial, setCreateSerial] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchProfiles = async () => {
    try {
      const { profiles: p } = await extensionApi.profiles.getAll()
      setProfiles(p)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
    const interval = setInterval(fetchProfiles, 10_000)
    return () => clearInterval(interval)
  }, [])

  const handleCreate = async () => {
    if (!createLabel.trim()) return
    setCreating(true)
    try {
      await extensionApi.profiles.create({
        label: createLabel.trim(),
        remarks: createRemarks.trim() || undefined,
        adsPowerSerialNumber: createSerial.trim() || undefined,
      })
      setCreateLabel('')
      setCreateRemarks('')
      setCreateSerial('')
      setShowCreate(false)
      await fetchProfiles()
    } catch (error) {
      console.error('Create failed:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleCopyKey = (profile: ExtensionProfile) => {
    if (profile.extensionApiKey) {
      navigator.clipboard.writeText(profile.extensionApiKey)
      setCopiedId(profile.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleRegenerateKey = async (id: string) => {
    setRegeneratingId(id)
    try {
      await extensionApi.profiles.regenerateKey(id)
      await fetchProfiles()
    } catch (error) {
      console.error('Regenerate failed:', error)
    } finally {
      setRegeneratingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this extension profile? The extension will stop working.')) return
    setDeletingId(id)
    try {
      await extensionApi.profiles.delete(id)
      setProfiles(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      console.error('Delete failed:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggle = async (profile: ExtensionProfile) => {
    setTogglingId(profile.id)
    try {
      await extensionApi.profiles.update(profile.id, { isEnabled: !profile.isEnabled })
      await fetchProfiles()
    } catch (error) {
      console.error('Toggle failed:', error)
    } finally {
      setTogglingId(null)
    }
  }

  const onlineCount = profiles.filter(p => p.isOnline).length
  const totalCount = profiles.length

  return (
    <DashboardLayout title="Extension API">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {totalCount === 0 ? 'No extension profiles yet' : (
                <>
                  <span className="font-medium text-green-600">{onlineCount} online</span>
                  {' / '}
                  <span>{totalCount} total</span>
                </>
              )}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Profile
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!loading && profiles.length === 0 && (
          <Card>
            <CardContent>
              <div className="text-center py-12">
                <Plug className="h-16 w-16 mx-auto text-gray-200 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Extension Profiles</h3>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  Create a profile for each AdsPower browser that has Facebook BM accounts logged in.
                </p>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create First Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Cards */}
        <div className="grid gap-4">
          {profiles.map(profile => (
            <Card key={profile.id} className={!profile.isEnabled ? 'opacity-60' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Status + Info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Status dot */}
                    <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                      profile.isOnline ? 'bg-green-500 animate-pulse' :
                      profile.fbAccessToken ? 'bg-yellow-400' : 'bg-gray-300'
                    }`} />

                    <div className="min-w-0 flex-1">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{profile.label}</h3>
                        {profile.isOnline && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <Wifi className="h-3 w-3" /> Online
                          </span>
                        )}
                        {!profile.isOnline && profile.fbAccessToken && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <WifiOff className="h-3 w-3" /> Offline
                          </span>
                        )}
                        {!profile.isOnline && !profile.fbAccessToken && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Not Connected
                          </span>
                        )}
                        {!profile.isEnabled && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Disabled
                          </span>
                        )}
                      </div>

                      {/* FB Profile info */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        {profile.adsPowerSerialNumber && (
                          <span>AdsPower: <span className="text-blue-600 font-medium">#{profile.adsPowerSerialNumber}</span></span>
                        )}
                        {profile.fbUserName && (
                          <span>FB: <span className="text-gray-700 font-medium">{profile.fbUserName}</span></span>
                        )}
                        {profile.fbUserId && (
                          <span className="font-mono text-xs">{profile.fbUserId}</span>
                        )}
                        {profile.managedAdAccountIds?.length > 0 && (
                          <span>Accounts: <span className="text-gray-700 font-medium">{profile.managedAdAccountIds.length}</span></span>
                        )}
                        {profile.lastHeartbeatAt && (
                          <span>Last seen: {formatTimeAgo(profile.lastHeartbeatAt)}</span>
                        )}
                        {profile.remarks && (
                          <span className="text-gray-400">{profile.remarks}</span>
                        )}
                      </div>

                      {/* API Key */}
                      {profile.extensionApiKey && (
                        <div className="mt-3 flex items-center gap-2">
                          <code className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs font-mono text-gray-600 truncate max-w-xs">
                            {profile.extensionApiKey}
                          </code>
                          <button
                            onClick={() => handleCopyKey(profile)}
                            className="shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Copy API Key"
                          >
                            {copiedId === profile.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRegenerateKey(profile.id)}
                            disabled={regeneratingId === profile.id}
                            className="shrink-0 p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Regenerate Key"
                          >
                            <RefreshCw className={`h-4 w-4 text-gray-400 ${regeneratingId === profile.id ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(profile)}
                      disabled={togglingId === profile.id}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      title={profile.isEnabled ? 'Disable' : 'Enable'}
                    >
                      {profile.isEnabled ? (
                        <ToggleRight className="h-5 w-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(profile.id)}
                      disabled={deletingId === profile.id}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Setup Guide */}
        {profiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>Load the <code className="bg-gray-100 px-1 rounded text-xs">extensions/6ad-recharge</code> folder in AdsPower/Chrome</li>
                <li>Open the extension popup, paste the <strong>API URL</strong> and <strong>API Key</strong> from above</li>
                <li>Open Facebook in the same browser — token is captured automatically</li>
                <li>BM shares & recharges are processed by the extension while the browser is open</li>
              </ol>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Extension Profile">
        <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="space-y-4">
          <Input
            id="label"
            label="Profile Name"
            value={createLabel}
            onChange={(e) => setCreateLabel(e.target.value)}
            placeholder="e.g., AdsPower - BM Group 1"
            autoFocus
          />
          <Input
            id="serial"
            label="AdsPower Serial Number"
            value={createSerial}
            onChange={(e) => setCreateSerial(e.target.value)}
            placeholder="e.g., 89"
          />
          <Input
            id="remarks"
            label="Notes (optional)"
            value={createRemarks}
            onChange={(e) => setCreateRemarks(e.target.value)}
            placeholder="e.g., Contains 10 BMs for client XYZ"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating} disabled={!createLabel.trim()}>
              Create Profile
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
