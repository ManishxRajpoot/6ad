'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/auth'
import { Save, Globe, Image as ImageIcon, Tag, FileText, Check } from 'lucide-react'

export default function SEOPage() {
  const { token } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formData, setFormData] = useState({
    metaTitle: 'ADS360 - Digital Advertising Solutions',
    metaDescription: 'ADS360 provides premium advertising account services for Facebook, Google, TikTok, Snapchat, and Bing. Scale your campaigns with verified ad accounts.',
    keywords: 'digital advertising, ad accounts, facebook ads, google ads, tiktok ads, snapchat ads, bing ads, media buying',
    ogImageUrl: 'https://ads360.ai/og-image.jpg',
    faviconUrl: 'https://ads360.ai/favicon.svg',
    canonicalUrl: 'https://ads360.ai',
    robotsTxt: 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: https://ads360.ai/sitemap.xml',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      // In production, call API to save SEO settings
      await new Promise(resolve => setTimeout(resolve, 800))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save SEO settings:', err)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white outline-none transition-all'
  const textareaClass = 'w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white outline-none transition-all resize-none'

  return (
    <DashboardLayout title="SEO Settings">
      <div className="max-w-3xl space-y-5">
        {/* Meta Tags */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Globe className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Meta Tags</h3>
              <p className="text-[11px] text-gray-400">Control how your site appears in search results</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Meta Title
              </label>
              <input
                type="text"
                value={formData.metaTitle}
                onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                placeholder="Your website title"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-400">{formData.metaTitle.length}/60 characters recommended</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Meta Description
              </label>
              <textarea
                value={formData.metaDescription}
                onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                placeholder="Brief description of your website"
                rows={3}
                className={textareaClass}
              />
              <p className="mt-1 text-[10px] text-gray-400">{formData.metaDescription.length}/160 characters recommended</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Canonical URL
              </label>
              <input
                type="url"
                value={formData.canonicalUrl}
                onChange={(e) => setFormData({ ...formData, canonicalUrl: e.target.value })}
                placeholder="https://yoursite.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <Tag className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Keywords</h3>
              <p className="text-[11px] text-gray-400">Comma-separated list of target keywords</p>
            </div>
          </div>

          <textarea
            value={formData.keywords}
            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
            placeholder="keyword1, keyword2, keyword3..."
            rows={3}
            className={textareaClass}
          />
          <p className="mt-1 text-[10px] text-gray-400">
            {formData.keywords.split(',').filter(k => k.trim()).length} keywords
          </p>
        </div>

        {/* Images */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Images</h3>
              <p className="text-[11px] text-gray-400">Social sharing and browser icons</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                OG Image URL
              </label>
              <input
                type="url"
                value={formData.ogImageUrl}
                onChange={(e) => setFormData({ ...formData, ogImageUrl: e.target.value })}
                placeholder="https://yoursite.com/og-image.jpg"
                className={inputClass}
              />
              <p className="mt-1 text-[10px] text-gray-400">Recommended: 1200x630px</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Favicon URL
              </label>
              <input
                type="url"
                value={formData.faviconUrl}
                onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                placeholder="https://yoursite.com/favicon.ico"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Robots.txt */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Robots.txt</h3>
              <p className="text-[11px] text-gray-400">Control search engine crawler behavior</p>
            </div>
          </div>

          <textarea
            value={formData.robotsTxt}
            onChange={(e) => setFormData({ ...formData, robotsTxt: e.target.value })}
            rows={6}
            className={`${textareaClass} font-mono text-xs`}
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm font-medium hover:from-purple-700 hover:to-purple-600 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
