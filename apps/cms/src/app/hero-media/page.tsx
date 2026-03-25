'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useAuthStore } from '@/store/auth'
import { api, uploadFile } from '@/lib/api'
import { Image, Video, Upload, Save, Loader2, Trash2, ExternalLink, Check } from 'lucide-react'

type HeroMediaData = {
  mode: 'video' | 'image'
  videoUrl: string
  imageUrl: string
  imagePublicId: string
}

const defaultData: HeroMediaData = {
  mode: 'video',
  videoUrl: '',
  imageUrl: '',
  imagePublicId: '',
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
  return match?.[1] || null
}

function extractVimeoId(url: string): string | null {
  if (!url) return null
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match?.[1] || null
}

export default function HeroMediaPage() {
  const token = useAuthStore((s) => s.token) || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
  const [data, setData] = useState<HeroMediaData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    const fetchData = async () => {
      try {
        const res = await api('/cms/admin/sections/hero-media', { token, cache: false })
        if (res.section?.data) {
          setData({ ...defaultData, ...res.section.data })
        }
      } catch {
        // Section doesn't exist yet, use defaults
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  const handleSave = async () => {
    if (!token) return
    setSaving(true)
    try {
      await api('/cms/admin/sections/hero-media', {
        method: 'PUT',
        token,
        body: JSON.stringify({ data, isActive: true }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpload = async (file: File) => {
    if (!token) return
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.')
      return
    }
    setUploading(true)
    try {
      const res = await uploadFile(file, token)
      setData(prev => ({ ...prev, imageUrl: res.url, imagePublicId: res.publicId }))
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const handleRemoveImage = async () => {
    if (!token || !data.imagePublicId) return
    try {
      // Find and delete the media record
      const mediaList = await api('/cms/admin/media', { token, cache: false })
      const mediaItem = mediaList.media?.find((m: any) => m.publicId === data.imagePublicId)
      if (mediaItem) {
        await api(`/cms/admin/media/${mediaItem.id}`, { method: 'DELETE', token })
      }
    } catch {
      // Ignore deletion errors
    }
    setData(prev => ({ ...prev, imageUrl: '', imagePublicId: '' }))
  }

  const youtubeId = extractYouTubeId(data.videoUrl)
  const vimeoId = extractVimeoId(data.videoUrl)

  if (loading) {
    return (
      <DashboardLayout title="Hero Media">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Hero Media">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">Manage the hero section video or image on the landing page.</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
          {/* Left: Mode Selection & Input */}
          <div className="flex flex-col gap-4">
            {/* Mode Toggle */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Media Type</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setData(prev => ({ ...prev, mode: 'video' }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    data.mode === 'video'
                      ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  Video URL
                </button>
                <button
                  onClick={() => setData(prev => ({ ...prev, mode: 'image' }))}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    data.mode === 'image'
                      ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Image className="w-4 h-4" />
                  Image Upload
                </button>
              </div>
            </Card>

            {/* Video Input */}
            {data.mode === 'video' && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Video URL</h3>
                <input
                  type="url"
                  value={data.videoUrl}
                  onChange={(e) => setData(prev => ({ ...prev, videoUrl: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-2">Supports YouTube and Vimeo URLs</p>
                {data.videoUrl && !youtubeId && !vimeoId && (
                  <p className="text-[11px] text-red-500 mt-1">Could not detect a valid YouTube or Vimeo URL</p>
                )}
                {youtubeId && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-600">
                    <Check className="w-3 h-3" />
                    YouTube video detected (ID: {youtubeId})
                  </div>
                )}
                {vimeoId && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-600">
                    <Check className="w-3 h-3" />
                    Vimeo video detected (ID: {vimeoId})
                  </div>
                )}
              </Card>
            )}

            {/* Image Upload */}
            {data.mode === 'image' && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Upload Image</h3>

                {data.imageUrl ? (
                  <div className="relative group">
                    <img
                      src={data.imageUrl}
                      alt="Hero"
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <a
                        href={data.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-700" />
                      </a>
                      <button
                        onClick={handleRemoveImage}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 truncate">{data.imageUrl}</p>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                        <p className="text-sm text-gray-500">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-300" />
                        <p className="text-sm text-gray-500">Drag & drop an image here</p>
                        <p className="text-[11px] text-gray-400">or click to browse (Max 10MB)</p>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(file)
                      }}
                    />
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Right: Live Preview */}
          <Card className="p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Preview</h3>
            <div className="flex-1 rounded-lg overflow-hidden bg-gray-900 min-h-[300px] relative">
              {data.mode === 'video' ? (
                youtubeId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : vimeoId ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${vimeoId}`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Enter a video URL to preview</p>
                    </div>
                  </div>
                )
              ) : data.imageUrl ? (
                <img
                  src={data.imageUrl}
                  alt="Hero Preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Image className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Upload an image to preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* Current status */}
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                (data.mode === 'video' && (youtubeId || vimeoId)) || (data.mode === 'image' && data.imageUrl)
                  ? 'bg-emerald-500'
                  : 'bg-gray-300'
              }`} />
              <span className="text-[11px] text-gray-500">
                {data.mode === 'video'
                  ? youtubeId || vimeoId ? 'Video ready — save to publish' : 'No video set'
                  : data.imageUrl ? 'Image ready — save to publish' : 'No image set'
                }
              </span>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
