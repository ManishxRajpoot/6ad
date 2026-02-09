'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { usersApi, agentsApi, accountsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useDateFilterStore } from '@/store/dateFilter'
import { Plus, Search, MoreVertical, ChevronDown, Eye, Edit, Trash2, Shield, Copy, Check, RefreshCw, Monitor, X, Loader2 } from 'lucide-react'

type User = {
  id: string
  username: string
  email: string
  plaintextPassword?: string | null
  phone: string | null
  phone2?: string | null
  realName?: string | null
  address?: string | null
  website?: string | null
  status: string
  walletBalance: string
  couponBalance?: number
  uniqueId: string
  createdAt: string
  agentId?: string
  agent?: {
    id: string
    username: string
    email: string
  }
  // 2FA
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  // Platform opening fees (rates user can open accounts with)
  fbFee?: number
  googleFee?: number
  tiktokFee?: number
  snapchatFee?: number
  bingFee?: number
  // Commission percentages
  fbCommission?: number
  googleCommission?: number
  tiktokCommission?: number
  snapchatCommission?: number
  bingCommission?: number
  // Remarks
  personalRemarks?: string
}

type Agent = {
  id: string
  username: string
  email: string
}

export default function UsersPage() {
  const toast = useToast()
  const { startDate, endDate } = useDateFilterStore()
  const [users, setUsers] = useState<User[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    phone2: '',
    realName: '',
    address: '',
    website: '',
    agentId: '',
    status: 'ACTIVE',
    personalRemarks: '',
    platformFees: {
      facebook: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      google: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      tiktok: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      snapchat: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      bing: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
    }
  })

  const fetchData = async () => {
    try {
      const [usersData, agentsData] = await Promise.all([
        usersApi.getAll(),
        agentsApi.getAll(),
      ])
      setUsers(usersData.users || [])
      setAgents(agentsData.agents || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddUser = () => {
    setSelectedUser(null)
    setFormData({
      username: '',
      email: '',
      password: '',
      phone: '',
      phone2: '',
      realName: '',
      address: '',
      website: '',
      agentId: '',
      status: 'ACTIVE',
      personalRemarks: '',
      platformFees: {
        facebook: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
        google: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
        tiktok: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
        snapchat: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
        bing: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      }
    })
    setIsEditMode(false)
    setIsModalOpen(true)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      phone: user.phone || '',
      phone2: user.phone2 || '',
      realName: user.realName || '',
      address: user.address || '',
      website: user.website || '',
      agentId: user.agentId || '',
      status: user.status,
      personalRemarks: user.personalRemarks || '',
      platformFees: {
        facebook: {
          openingFee: user.fbFee?.toString() || '',
          depositFee: user.fbCommission?.toString() || '',
          unlimitedDomainFee: (user as any).fbUnlimitedDomainFee?.toString() || ''
        },
        google: {
          openingFee: user.googleFee?.toString() || '',
          depositFee: user.googleCommission?.toString() || '',
          unlimitedDomainFee: (user as any).googleUnlimitedDomainFee?.toString() || ''
        },
        tiktok: {
          openingFee: user.tiktokFee?.toString() || '',
          depositFee: user.tiktokCommission?.toString() || '',
          unlimitedDomainFee: (user as any).tiktokUnlimitedDomainFee?.toString() || ''
        },
        snapchat: {
          openingFee: user.snapchatFee?.toString() || '',
          depositFee: user.snapchatCommission?.toString() || '',
          unlimitedDomainFee: (user as any).snapchatUnlimitedDomainFee?.toString() || ''
        },
        bing: {
          openingFee: user.bingFee?.toString() || '',
          depositFee: user.bingCommission?.toString() || '',
          unlimitedDomainFee: (user as any).bingUnlimitedDomainFee?.toString() || ''
        },
      }
    })
    setIsEditMode(true)
    setIsModalOpen(true)
    setActiveDropdown(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const payload: any = {
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
        phone2: formData.phone2,
        realName: formData.realName,
        address: formData.address,
        website: formData.website,
        agentId: formData.agentId || undefined,
        status: formData.status,
        personalRemarks: formData.personalRemarks,
        fbFee: Number(formData.platformFees.facebook.openingFee) || 0,
        fbCommission: Number(formData.platformFees.facebook.depositFee) || 0,
        fbUnlimitedDomainFee: Number(formData.platformFees.facebook.unlimitedDomainFee) || 0,
        googleFee: Number(formData.platformFees.google.openingFee) || 0,
        googleCommission: Number(formData.platformFees.google.depositFee) || 0,
        googleUnlimitedDomainFee: Number(formData.platformFees.google.unlimitedDomainFee) || 0,
        tiktokFee: Number(formData.platformFees.tiktok.openingFee) || 0,
        tiktokCommission: Number(formData.platformFees.tiktok.depositFee) || 0,
        tiktokUnlimitedDomainFee: Number(formData.platformFees.tiktok.unlimitedDomainFee) || 0,
        snapchatFee: Number(formData.platformFees.snapchat.openingFee) || 0,
        snapchatCommission: Number(formData.platformFees.snapchat.depositFee) || 0,
        snapchatUnlimitedDomainFee: Number(formData.platformFees.snapchat.unlimitedDomainFee) || 0,
        bingFee: Number(formData.platformFees.bing.openingFee) || 0,
        bingCommission: Number(formData.platformFees.bing.depositFee) || 0,
        bingUnlimitedDomainFee: Number(formData.platformFees.bing.unlimitedDomainFee) || 0,
      }

      // Only include password if it's provided
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      if (selectedUser) {
        const response = await usersApi.update(selectedUser.id, payload)
        toast.success('User Updated', `${formData.username} has been updated successfully`)
      } else {
        const response = await usersApi.create(payload)
        toast.success('User Created', `${formData.username} has been added successfully`)
      }

      setIsModalOpen(false)
      await fetchData()
    } catch (error: any) {
      console.error('Submit error:', error)
      toast.error('Failed to save user', error.message || 'An error occurred while saving the user')
    } finally {
      setFormLoading(false)
    }
  }

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isViewProfileOpen, setIsViewProfileOpen] = useState(false)
  const [viewUser, setViewUser] = useState<User | null>(null)
  const [copied2FAKey, setCopied2FAKey] = useState(false)

  const copy2FAKey = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopied2FAKey(true)
    setTimeout(() => setCopied2FAKey(false), 2000)
  }

  const [resetting2FA, setResetting2FA] = useState(false)

  // Ad Accounts Modal state
  const [isAdAccountsModalOpen, setIsAdAccountsModalOpen] = useState(false)
  const [adAccountsUser, setAdAccountsUser] = useState<User | null>(null)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [adAccountsPlatform, setAdAccountsPlatform] = useState<string>('ALL')
  const [adAccountsLoading, setAdAccountsLoading] = useState(false)
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null)

  const handleReset2FA = async (user: User) => {
    if (!confirm(`Are you sure you want to reset 2FA for ${user.username}? They will need to set up 2FA again on next login.`)) {
      return
    }

    setResetting2FA(true)
    try {
      const response = await usersApi.reset2FA(user.id)
      toast.success('2FA Reset', response.message)
      // Update the local user state to reflect 2FA is now disabled
      if (viewUser?.id === user.id) {
        setViewUser({ ...viewUser, twoFactorEnabled: false, twoFactorSecret: undefined })
      }
      fetchData()
    } catch (error: any) {
      toast.error('Failed to reset 2FA', error.message || 'An error occurred')
    } finally {
      setResetting2FA(false)
    }
  }

  // Ad Accounts handlers
  const fetchUserAdAccounts = async (userId: string, platform?: string) => {
    setAdAccountsLoading(true)
    try {
      const data = await accountsApi.getByUser(userId, platform)
      setAdAccounts(data.accounts || [])
    } catch (error) {
      console.error('Failed to fetch user ad accounts:', error)
      setAdAccounts([])
    } finally {
      setAdAccountsLoading(false)
    }
  }

  const handleViewAdAccounts = (user: User) => {
    setAdAccountsUser(user)
    setAdAccountsPlatform('ALL')
    setIsAdAccountsModalOpen(true)
    fetchUserAdAccounts(user.id)
    setActiveDropdown(null)
  }

  const handleAdAccountsPlatformChange = (platform: string) => {
    setAdAccountsPlatform(platform)
    if (adAccountsUser) {
      fetchUserAdAccounts(adAccountsUser.id, platform === 'ALL' ? undefined : platform)
    }
  }

  const handleRemoveAccount = async (accountId: string, accountName: string) => {
    if (!confirm(`Remove "${accountName}" from this user's panel? The account status will be set to Suspended.`)) return

    setRemovingAccountId(accountId)
    try {
      await accountsApi.updateStatus(accountId, 'SUSPENDED')
      toast.success('Account Removed', `${accountName} has been suspended`)
      // Re-fetch the list
      if (adAccountsUser) {
        fetchUserAdAccounts(adAccountsUser.id, adAccountsPlatform === 'ALL' ? undefined : adAccountsPlatform)
      }
    } catch (error: any) {
      toast.error('Failed to remove account', error.message || 'An error occurred')
    } finally {
      setRemovingAccountId(null)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'FACEBOOK':
        return <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      case 'GOOGLE':
        return <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1z"/><path fill="#34A853" d="M1.26 9.76A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4-3.1a7.15 7.15 0 0 1 0-4.44l-4-3.1z"/><path fill="#4285F4" d="M12 18.06c-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14z"/><path fill="#FBBC05" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/></svg>
      case 'TIKTOK':
        return <svg className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
      case 'SNAPCHAT':
        return <svg className="w-4 h-4 text-[#FFFC00]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.603.603 0 0 1 .272-.063c.12 0 .24.03.345.09.264.135.39.345.39.585 0 .196-.076.375-.21.515-.15.135-.39.27-.795.39-.06.016-.12.03-.18.045-.165.045-.345.09-.51.135-.075.016-.15.045-.225.075-.15.06-.255.135-.3.225-.045.105-.045.225 0 .36.09.195.18.39.285.585.12.24.375.705.66 1.125.36.54.78.99 1.245 1.35.27.195.54.36.81.495.15.075.27.15.375.225.27.165.42.39.435.6.03.21-.075.435-.285.615a1.665 1.665 0 0 1-.765.345 4.2 4.2 0 0 1-.84.12c-.225.015-.45.045-.675.105-.15.045-.285.12-.405.21-.21.165-.315.33-.315.465-.015.135.015.27.075.405.06.135.135.27.225.405.18.27.285.585.255.885-.045.405-.345.72-.735.84-.21.06-.435.09-.66.09-.21 0-.405-.03-.585-.075a4.065 4.065 0 0 0-.675-.12c-.15-.015-.3-.015-.45 0-.195.015-.39.045-.585.09-.255.06-.51.135-.765.225l-.09.03c-.255.09-.54.18-.84.255a4.62 4.62 0 0 1-1.095.135c-.375 0-.75-.045-1.11-.135a7.316 7.316 0 0 1-.84-.255l-.075-.03a8.06 8.06 0 0 0-.765-.225 3.975 3.975 0 0 0-.585-.09c-.15-.015-.3-.015-.45 0-.225.015-.45.06-.675.12-.195.045-.39.075-.585.075-.225 0-.45-.03-.66-.09-.39-.12-.69-.435-.735-.84-.03-.3.075-.615.255-.885.09-.135.165-.27.225-.405.06-.135.09-.27.075-.405 0-.135-.105-.3-.315-.465a1.11 1.11 0 0 0-.405-.21 4.62 4.62 0 0 0-.675-.105 4.2 4.2 0 0 1-.84-.12 1.665 1.665 0 0 1-.765-.345c-.21-.18-.315-.405-.285-.615.015-.21.165-.435.435-.6.105-.075.225-.15.375-.225.27-.135.54-.3.81-.495.465-.36.885-.81 1.245-1.35.285-.42.54-.885.66-1.125.105-.195.195-.39.285-.585.045-.135.045-.255 0-.36-.045-.09-.15-.165-.3-.225a1.665 1.665 0 0 0-.225-.075 6.6 6.6 0 0 1-.51-.135c-.06-.015-.12-.03-.18-.045-.405-.12-.645-.255-.795-.39a.585.585 0 0 1-.21-.515c0-.24.126-.45.39-.585a.69.69 0 0 1 .345-.09c.09 0 .18.015.27.063.375.18.735.285 1.035.3.198 0 .326-.044.4-.089a4.95 4.95 0 0 1-.032-.51l-.004-.06c-.103-1.628-.229-3.654.3-4.847C7.86 1.069 11.215.793 12.206.793z"/></svg>
      case 'BING':
        return <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#008373" d="M5 3v16.5l4.5 2.5 8-4.5v-4L9.5 10V5.5L5 3z"/><path fill="#00A99D" d="M9.5 5.5V10l8 3.5v4l-8 4.5L5 19.5V3l4.5 2.5z"/><path fill="#00C8B4" d="M9.5 10l8 3.5v4l-8 4.5v-12z"/></svg>
      default:
        return <Monitor className="w-4 h-4 text-gray-400" />
    }
  }

  const getPlatformLabel = (platform: string) => {
    switch (platform) {
      case 'FACEBOOK': return 'Facebook'
      case 'GOOGLE': return 'Google'
      case 'TIKTOK': return 'TikTok'
      case 'SNAPCHAT': return 'Snapchat'
      case 'BING': return 'Bing'
      default: return platform
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Active</span>
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Pending</span>
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Suspended</span>
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">Rejected</span>
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">Refunded</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{status}</span>
    }
  }

  const handleViewProfile = (user: User) => {
    setViewUser(user)
    setIsViewProfileOpen(true)
    setActiveDropdown(null)
  }

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user)
    setIsDeleteModalOpen(true)
    setActiveDropdown(null)
  }

  const confirmDelete = async () => {
    if (!userToDelete) return

    try {
      await usersApi.delete(userToDelete.id)
      toast.success('User Deleted', `${userToDelete.username} has been removed from the system`)
      setIsDeleteModalOpen(false)
      setUserToDelete(null)
      fetchData()
    } catch (error: any) {
      toast.error('Failed to delete user', error.message || 'An error occurred while deleting the user')
    }
  }

  // Filter and sort users
  const filteredAndSortedUsers = users
    .filter((user) => {
      const matchesSearch =
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.realName?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.status === 'ACTIVE') ||
        (statusFilter === 'blocked' && user.status === 'BLOCKED')

      // Date filter from global store
      const userDate = new Date(user.createdAt)
      const matchesDate =
        (!startDate || userDate >= startDate) &&
        (!endDate || userDate <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1))

      return matchesSearch && matchesStatus && matchesDate
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'balance-high':
          return Number(b.walletBalance) - Number(a.walletBalance)
        case 'balance-low':
          return Number(a.walletBalance) - Number(b.walletBalance)
        case 'blocked':
          return a.status === 'BLOCKED' ? -1 : 1
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedUsers = filteredAndSortedUsers.slice(startIndex, startIndex + itemsPerPage)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, startDate, endDate])

  // Calculate totals
  const totalBalance = users.reduce((sum, user) => sum + Number(user.walletBalance || 0), 0)
  const totalUsers = users.length

  return (
    <DashboardLayout title="User Management">
      {/* Header with Search and Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-[250px] rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 transition-all duration-200 focus:w-[300px]"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 flex items-center gap-2 transition-all duration-200 min-w-[120px]"
              >
                <span className="capitalize">
                  {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Active' : 'Blocked'}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStatusDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsStatusDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-11 z-[70] w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: 'all', label: 'All Status' },
                      { value: 'active', label: 'Active' },
                      { value: 'blocked', label: 'Blocked' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value)
                          setIsStatusDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          statusFilter === option.value
                            ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sort By Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 flex items-center gap-2 transition-all duration-200 min-w-[150px]"
              >
                <span>
                  Sort By: {sortBy === 'balance-high' ? 'High Balance' : sortBy === 'balance-low' ? 'Low Balance' : sortBy === 'blocked' ? 'Blocked Users' : 'Newest'}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isSortDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setIsSortDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-11 z-[70] w-52 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { value: 'newest', label: 'Newest First' },
                      { value: 'balance-high', label: 'Balance: High to Low' },
                      { value: 'balance-low', label: 'Balance: Low to High' },
                      { value: 'blocked', label: 'Blocked Users' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value)
                          setIsSortDropdownOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          sortBy === option.value
                            ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Add User Button - Right Side */}
          <button
            onClick={handleAddUser}
            className="h-9 px-4 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Total Users:</span>
            <span className="text-sm font-bold text-gray-900">{totalUsers}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Total Balance:</span>
            <span className="text-sm font-bold text-[#3B82F6]">${totalBalance.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-xl">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Real Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Password</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Wallet</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Opening Fee</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Deposit Fee Commission</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Create Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Remarks</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{user.realName || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{user.username}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                          <span className="text-xs text-gray-400">+{user.phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setShowPasswordId(showPasswordId === user.id ? null : user.id)}
                          onMouseEnter={() => setShowPasswordId(user.id)}
                          onMouseLeave={() => setShowPasswordId(null)}
                          className={`text-sm cursor-pointer font-mono transition-colors ${
                            showPasswordId === user.id && !user.plaintextPassword
                              ? 'text-red-500'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                          title={user.plaintextPassword ? "Click to show password" : "Password not stored - edit user to set new password"}
                        >
                          {showPasswordId === user.id
                            ? (user.plaintextPassword || 'Reset needed')
                            : '••••••••'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-[#3B82F6]">
                          ${Number(user.walletBalance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white font-bold text-[10px]">f</span>
                            <span className="font-medium">${user.fbFee || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 rounded bg-gradient-to-r from-blue-500 to-red-500 flex items-center justify-center text-white font-bold text-[10px]">G</span>
                            <span className="font-medium">${user.googleFee || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white font-bold text-[10px]">f</span>
                            <span className="font-medium">{user.fbCommission || 0}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-5 h-5 rounded bg-gradient-to-r from-blue-500 to-red-500 flex items-center justify-center text-white font-bold text-[10px]">G</span>
                            <span className="font-medium">{user.googleCommission || 0}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.personalRemarks ? (
                          <span className="text-xs">{user.personalRemarks}</span>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {user.status === 'ACTIVE' ? 'Confirmed' : user.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewProfile(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleViewAdAccounts(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Ad Accounts"
                          >
                            <Monitor className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-colors"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredAndSortedUsers.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              {/* Left: Page info */}
              <div className="text-sm text-gray-500">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
              </div>

              {/* Right: Navigation */}
              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 h-9 rounded-lg border text-sm font-medium transition-all duration-200 ${
                    currentPage === 1
                      ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                  }`}
                >
                  ← Prev
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages: (number | string)[] = []
                  const maxVisiblePages = 5

                  if (totalPages <= maxVisiblePages) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    pages.push(1)
                    if (currentPage > 3) {
                      pages.push('...')
                    }
                    const start = Math.max(2, currentPage - 1)
                    const end = Math.min(totalPages - 1, currentPage + 1)
                    for (let i = start; i <= end; i++) {
                      if (!pages.includes(i)) {
                        pages.push(i)
                      }
                    }
                    if (currentPage < totalPages - 2) {
                      pages.push('...')
                    }
                    if (!pages.includes(totalPages)) {
                      pages.push(totalPages)
                    }
                  }

                  return pages.map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="text-sm text-gray-400 px-2">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200 ${
                          currentPage === page
                            ? 'bg-[#8B5CF6] text-white shadow-md'
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))
                })()}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className={`px-3 h-9 rounded-lg border text-sm font-medium transition-all duration-200 ${
                    currentPage >= totalPages
                      ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                  }`}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit User Modal with Platform Fees - Same as before but keeping for completeness */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? 'Edit User Information' : 'Add User Information'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Basic Info */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-1">Real Name *</label>
              <input
                type="text"
                required
                value={formData.realName}
                onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-1">
                Password {!isEditMode && '*'}
                {isEditMode && <span className="text-gray-500 font-normal ml-1">(leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                required={!isEditMode}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditMode ? "Enter new password to change" : ""}
                className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
          </div>

          {/* Platform Fees (Rates user can open accounts with) */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-gray-900">Platform Rates</h3>

            {/* Facebook */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Facebook</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Opening Fee ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.facebook.openingFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, openingFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    value={formData.platformFees.facebook.depositFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, depositFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Unlimited Domain ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.facebook.unlimitedDomainFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, unlimitedDomainFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
              </div>
            </div>

            {/* Google */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Google</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Opening Fee ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.google.openingFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, openingFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    value={formData.platformFees.google.depositFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, depositFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Unlimited Domain ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.google.unlimitedDomainFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, unlimitedDomainFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
              </div>
            </div>

            {/* TikTok */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">TikTok</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Opening Fee ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.tiktok.openingFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, openingFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    value={formData.platformFees.tiktok.depositFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, depositFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Unlimited Domain ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.tiktok.unlimitedDomainFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, unlimitedDomainFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
              </div>
            </div>

            {/* Snapchat */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Snapchat</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Opening Fee ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.snapchat.openingFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, openingFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    value={formData.platformFees.snapchat.depositFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, depositFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Unlimited Domain ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.snapchat.unlimitedDomainFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, unlimitedDomainFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
              </div>
            </div>

            {/* Bing */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Bing</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Opening Fee ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.bing.openingFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, openingFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Commission %</label>
                  <input
                    type="number"
                    value={formData.platformFees.bing.depositFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, depositFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Unlimited Domain ($)</label>
                  <input
                    type="number"
                    value={formData.platformFees.bing.unlimitedDomainFee}
                    onChange={(e) => setFormData({
                      ...formData,
                      platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, unlimitedDomainFee: e.target.value } }
                    })}
                    className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-gray-900">Contact Details</h3>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
              />
            </div>
          </div>

          {/* Assign Agent & Status */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-gray-900">Assignment</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Assign Agent</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                >
                  <option value="">No Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-8 px-2 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-1">Personal Remarks</label>
              <textarea
                value={formData.personalRemarks}
                onChange={(e) => setFormData({ ...formData, personalRemarks: e.target.value })}
                placeholder="Add any notes or remarks about this user..."
                rows={3}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 h-9 rounded-lg bg-[#8B5CF6] text-white text-sm hover:bg-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? 'Saving...' : (selectedUser ? 'Update User' : 'Create User')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setUserToDelete(null)
        }}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{userToDelete?.username}</span>? This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false)
                setUserToDelete(null)
              }}
              className="px-4 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 h-9 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
            >
              Delete User
            </button>
          </div>
        </div>
      </Modal>

      {/* View Profile Modal */}
      <Modal
        isOpen={isViewProfileOpen}
        onClose={() => {
          setIsViewProfileOpen(false)
          setViewUser(null)
        }}
        title="User Profile Details"
      >
        {viewUser && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {viewUser.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{viewUser.realName || viewUser.username}</h3>
                  <p className="text-sm text-gray-500">{viewUser.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-2 h-2 rounded-full ${viewUser.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-semibold ${viewUser.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                      {viewUser.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsViewProfileOpen(false)
                  handleEditUser(viewUser)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit User"
              >
                <Edit className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Account Info */}
            <div className="space-y-0 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Username</span>
                <span className="text-sm font-medium text-gray-900">{viewUser.username}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Email</span>
                <span className="text-sm font-medium text-gray-900">{viewUser.email}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Phone</span>
                <span className="text-sm font-medium text-gray-900">{viewUser.phone || 'Not provided'}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Wallet Balance</span>
                <span className="text-sm font-bold text-[#3B82F6]">${Number(viewUser.walletBalance || 0).toLocaleString()}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Agent</span>
                <span className="text-sm font-medium text-gray-900">{viewUser.agent?.username || 'No Agent'}</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">Created</span>
                <span className="text-sm font-medium text-gray-900">{new Date(viewUser.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* 2FA Security Section */}
            {viewUser.twoFactorEnabled && viewUser.twoFactorSecret && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[#8B5CF6]" />
                  Two-Factor Authentication
                </h4>
                <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#6366F1]/5 rounded-xl p-4 border border-[#8B5CF6]/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">2FA Status</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      Enabled
                    </span>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 block mb-1.5">2FA Secret Key</label>
                    <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-200">
                      <code className="flex-1 text-xs font-mono text-gray-700 break-all select-all">
                        {viewUser.twoFactorSecret}
                      </code>
                      <button
                        onClick={() => copy2FAKey(viewUser.twoFactorSecret!)}
                        className="p-1.5 text-gray-500 hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 rounded transition-all"
                        title="Copy 2FA Key"
                      >
                        {copied2FAKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      This key can be used to recover the authenticator app setup
                    </p>
                  </div>
                  {/* Reset 2FA Button */}
                  <div className="mt-4 pt-3 border-t border-[#8B5CF6]/20">
                    <button
                      onClick={() => handleReset2FA(viewUser)}
                      disabled={resetting2FA}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${resetting2FA ? 'animate-spin' : ''}`} />
                      {resetting2FA ? 'Resetting...' : 'Reset 2FA'}
                    </button>
                    <p className="text-[10px] text-gray-500 mt-2 text-center">
                      User will be prompted to set up 2FA again on next login
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Remarks */}
            {viewUser.personalRemarks && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Remarks</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{viewUser.personalRemarks}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setIsViewProfileOpen(false)
                  setViewUser(null)
                }}
                className="px-4 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* Ad Accounts Modal */}
      <Modal
        isOpen={isAdAccountsModalOpen}
        onClose={() => {
          setIsAdAccountsModalOpen(false)
          setAdAccountsUser(null)
          setAdAccounts([])
          setAdAccountsPlatform('ALL')
        }}
        title={`${adAccountsUser?.username || 'User'}'s Ad Accounts`}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Platform Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'ALL', label: 'All' },
              { value: 'FACEBOOK', label: 'Facebook' },
              { value: 'GOOGLE', label: 'Google' },
              { value: 'TIKTOK', label: 'TikTok' },
              { value: 'SNAPCHAT', label: 'Snapchat' },
              { value: 'BING', label: 'Bing' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleAdAccountsPlatformChange(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  adAccountsPlatform === tab.value
                    ? 'bg-[#8B5CF6] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.value !== 'ALL' && <span className="flex-shrink-0">{getPlatformIcon(tab.value)}</span>}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Accounts List */}
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-200">
            {adAccountsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
                <span className="ml-2 text-sm text-gray-500">Loading accounts...</span>
              </div>
            ) : adAccounts.length === 0 ? (
              <div className="text-center py-12">
                <Monitor className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No ad accounts found</p>
                <p className="text-xs text-gray-400 mt-1">
                  {adAccountsPlatform !== 'ALL' ? `No ${getPlatformLabel(adAccountsPlatform)} accounts for this user` : 'This user has no ad accounts yet'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Platform</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Account ID</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-[80px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adAccounts.map((account) => (
                    <tr key={account.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(account.platform)}
                          <span className="text-xs font-medium text-gray-700">{getPlatformLabel(account.platform)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-mono text-gray-600">{account.accountId}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-gray-700">{account.accountName || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {getStatusBadge(account.status)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {account.status !== 'SUSPENDED' && account.status !== 'REFUNDED' ? (
                          <button
                            onClick={() => handleRemoveAccount(account.id, account.accountName || account.accountId)}
                            disabled={removingAccountId === account.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Remove from user panel"
                          >
                            {removingAccountId === account.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Remove
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {adAccounts.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                Showing {adAccounts.length} account{adAccounts.length !== 1 ? 's' : ''}
                {adAccountsPlatform !== 'ALL' ? ` (${getPlatformLabel(adAccountsPlatform)})` : ''}
              </p>
              <button
                onClick={() => {
                  setIsAdAccountsModalOpen(false)
                  setAdAccountsUser(null)
                  setAdAccounts([])
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  )
}
