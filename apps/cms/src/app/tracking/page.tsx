'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Save, Check, Loader2 } from 'lucide-react'

export default function TrackingPixelsPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [config, setConfig] = useState({
    enabled: true,
    gtmId: '',
    ga4Id: '',
    metaPixelId: '',
    metaCapiToken: '',
  })

  useEffect(() => {
    if (!token) return
    api('/cms/sections/tracking-pixels', { token, cache: false })
      .then(res => {
        if (res?.data) setConfig({ enabled: true, gtmId: '', ga4Id: '', metaPixelId: '', ...res.data })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api('/cms/admin/sections/tracking-pixels', {
        token,
        method: 'PUT',
        body: JSON.stringify({ data: config }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 focus:bg-white outline-none transition-all font-mono'
  const labelClass = 'block text-[13px] font-medium text-gray-700 mb-1.5'
  const hintClass = 'text-[11px] text-gray-400 mt-1'

  if (loading) {
    return (
      <DashboardLayout title="Tracking Pixels">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Tracking Pixels">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tracking & Analytics</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage tracking pixels for ads360.ai</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        {/* Master Toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Enable Tracking</p>
              <p className="text-[12px] text-gray-400 mt-0.5">Toggle all tracking scripts on/off</p>
            </div>
            <button
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-violet-600' : 'bg-gray-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Google Tag Manager */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4285F4" />
                <path d="M2 17l10 5 10-5" stroke="#34A853" strokeWidth="2" />
                <path d="M2 12l10 5 10-5" stroke="#FBBC05" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Google Tag Manager</p>
              <p className="text-[11px] text-gray-400">Container for managing all tags in one place</p>
            </div>
          </div>
          <div>
            <label className={labelClass}>GTM Container ID</label>
            <input
              type="text"
              value={config.gtmId}
              onChange={e => setConfig(c => ({ ...c, gtmId: e.target.value.trim() }))}
              placeholder="GTM-XXXXXXX"
              className={inputClass}
            />
            <p className={hintClass}>Find it at tagmanager.google.com → Admin → Container ID</p>
          </div>
        </div>

        {/* Google Analytics 4 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" fill="#F9AB00" />
                <path d="M12 2v10l8.66 5" stroke="#E37400" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Google Analytics 4</p>
              <p className="text-[11px] text-gray-400">Track visitors, conversions, and traffic sources</p>
            </div>
          </div>
          <div>
            <label className={labelClass}>GA4 Measurement ID</label>
            <input
              type="text"
              value={config.ga4Id}
              onChange={e => setConfig(c => ({ ...c, ga4Id: e.target.value.trim() }))}
              placeholder="G-XXXXXXXXXX"
              className={inputClass}
            />
            <p className={hintClass}>Find it at analytics.google.com → Admin → Data Streams → Measurement ID</p>
          </div>
        </div>

        {/* Meta (Facebook) Pixel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-gray-900">Meta (Facebook) Pixel</p>
              <p className="text-[11px] text-gray-400">Track visitors for Facebook/Instagram ad retargeting</p>
            </div>
          </div>
          <div>
            <label className={labelClass}>Pixel ID</label>
            <input
              type="text"
              value={config.metaPixelId}
              onChange={e => setConfig(c => ({ ...c, metaPixelId: e.target.value.trim() }))}
              placeholder="1234567890"
              className={inputClass}
            />
            <p className={hintClass}>Find it at business.facebook.com → Events Manager → Pixel ID</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className={labelClass}>Conversions API (CAPI) Access Token</label>
            <input
              type="password"
              value={config.metaCapiToken}
              onChange={e => setConfig(c => ({ ...c, metaCapiToken: e.target.value.trim() }))}
              placeholder="EAAxxxxxxx..."
              className={inputClass}
            />
            <p className={hintClass}>Required for server-side event tracking. Generate at business.facebook.com → Events Manager → Settings → Conversions API → Generate Access Token</p>
          </div>
          <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-[12px] text-green-700"><strong>CAPI + Pixel = Best Results.</strong> Browser pixel fires client-side, CAPI fires server-side. Both use the same event ID for deduplication — Meta won't double-count. CAPI works even with ad blockers and iOS privacy restrictions.</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
          <p className="text-[13px] text-violet-700 font-medium">How it works</p>
          <p className="text-[12px] text-violet-600 mt-1">
            Enter your tracking IDs above and click Save. The scripts will be automatically injected into ads360.ai.
            Changes take effect within 1 minute (cached for performance). Toggle "Enable Tracking" off to disable all tracking at once.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
