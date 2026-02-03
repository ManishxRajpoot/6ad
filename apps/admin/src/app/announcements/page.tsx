'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import {
  Plus,
  Edit2,
  Trash2,
  Megaphone,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { announcementsApi } from '@/lib/api'

interface Announcement {
  id: string
  title: string
  message: string
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
  isActive: boolean
  isPinned: boolean
  showOnce: boolean
  targetRole?: string
  startDate?: string
  endDate?: string
  createdAt: string
}

const typeOptions = [
  { value: 'INFO', label: 'Info', icon: Info, color: 'bg-blue-100 text-blue-600' },
  { value: 'WARNING', label: 'Warning', icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-600' },
  { value: 'SUCCESS', label: 'Success', icon: CheckCircle, color: 'bg-green-100 text-green-600' },
  { value: 'ERROR', label: 'Error', icon: AlertCircle, color: 'bg-red-100 text-red-600' },
]

const roleOptions = [
  { value: '', label: 'All Users' },
  { value: 'USER', label: 'Users Only' },
  { value: 'AGENT', label: 'Agents Only' },
]

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'INFO' as 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR',
    isActive: true,
    isPinned: false,
    showOnce: false,
    targetRole: '',
    startDate: '',
    endDate: '',
  })

  const fetchAnnouncements = async () => {
    try {
      const res = await announcementsApi.getAllAdmin()
      setAnnouncements(res.announcements || [])
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const handleOpenModal = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement)
      setFormData({
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        isActive: announcement.isActive,
        isPinned: announcement.isPinned || false,
        showOnce: announcement.showOnce || false,
        targetRole: announcement.targetRole || '',
        startDate: announcement.startDate ? announcement.startDate.split('T')[0] : '',
        endDate: announcement.endDate ? announcement.endDate.split('T')[0] : '',
      })
    } else {
      setEditingAnnouncement(null)
      setFormData({
        title: '',
        message: '',
        type: 'INFO',
        isActive: true,
        isPinned: false,
        showOnce: false,
        targetRole: '',
        startDate: '',
        endDate: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const data = {
        ...formData,
        targetRole: formData.targetRole || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      }

      if (editingAnnouncement) {
        await announcementsApi.update(editingAnnouncement.id, data)
      } else {
        await announcementsApi.create(data)
      }

      setIsModalOpen(false)
      fetchAnnouncements()
    } catch (error) {
      alert('Failed to save announcement')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      await announcementsApi.delete(id)
      fetchAnnouncements()
    } catch {
      alert('Failed to delete announcement')
    }
  }

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      await announcementsApi.update(announcement.id, { isActive: !announcement.isActive })
      fetchAnnouncements()
    } catch {
      alert('Failed to update announcement')
    }
  }

  const getTypeConfig = (type: string) => {
    return typeOptions.find(t => t.value === type) || typeOptions[0]
  }

  return (
    <DashboardLayout title="Announcements" subtitle="Manage system announcements for users">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
              <p className="text-sm text-gray-500">{announcements.length} total announcements</p>
            </div>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No announcements yet</p>
            <p className="text-sm text-gray-400">Create your first announcement to notify users</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const typeConfig = getTypeConfig(announcement.type)
              const TypeIcon = typeConfig.icon

              return (
                <div
                  key={announcement.id}
                  className={`border rounded-xl p-4 ${announcement.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-gray-900">{announcement.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          {announcement.showOnce ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                              Once Only
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-600">
                              Every Time
                            </span>
                          )}
                          {announcement.isPinned && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                              Pinned
                            </span>
                          )}
                          {!announcement.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{announcement.message}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Created: {new Date(announcement.createdAt).toLocaleDateString()}</span>
                          {announcement.targetRole && (
                            <span>Target: {announcement.targetRole}</span>
                          )}
                          {announcement.startDate && (
                            <span>Start: {new Date(announcement.startDate).toLocaleDateString()}</span>
                          )}
                          {announcement.endDate && (
                            <span>End: {new Date(announcement.endDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(announcement)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={announcement.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {announcement.isActive ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenModal(announcement)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Announcement title"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Announcement message"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="grid grid-cols-4 gap-2">
              {typeOptions.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value as any })}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                      formData.type === type.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${formData.type === type.value ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-medium ${formData.type === type.value ? 'text-purple-600' : 'text-gray-500'}`}>
                      {type.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <select
              value={formData.targetRole}
              onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date (Optional)"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <Input
              label="End Date (Optional)"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>

          {/* Display Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Display Frequency</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, showOnce: false })}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  !formData.showOnce
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  !formData.showOnce ? 'border-purple-500' : 'border-gray-300'
                }`}>
                  {!formData.showOnce && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${!formData.showOnce ? 'text-purple-600' : 'text-gray-700'}`}>
                    Every Time
                  </p>
                  <p className="text-xs text-gray-500">Show on every login</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, showOnce: true })}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  formData.showOnce
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  formData.showOnce ? 'border-purple-500' : 'border-gray-300'
                }`}>
                  {formData.showOnce && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${formData.showOnce ? 'text-purple-600' : 'text-gray-700'}`}>
                    Once Only
                  </p>
                  <p className="text-xs text-gray-500">Show once per user</p>
                </div>
              </button>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Active (visible to users)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPinned"
                checked={formData.isPinned}
                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="isPinned" className="text-sm text-gray-700">
                Pinned (cannot be dismissed by user)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
