'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { StatsChart } from '@/components/ui/StatsChart'
import { PaginationSelect } from '@/components/ui/PaginationSelect'
import { usersApi, agentsApi, accountsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useDateFilterStore } from '@/store/dateFilter'
import {
  Plus, Search, MoreVertical, Eye, Edit, Trash2, Shield, Copy, Check,
  RefreshCw, Monitor, X, Loader2, ChevronDown, ChevronLeft, ChevronRight,
  Users as UsersIcon, DollarSign, Wallet, EyeOff, Ban, Gift, Minus, Ticket, Undo2
} from 'lucide-react'

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
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  fbFee?: number
  googleFee?: number
  tiktokFee?: number
  snapchatFee?: number
  bingFee?: number
  fbCommission?: number
  googleCommission?: number
  tiktokCommission?: number
  snapchatCommission?: number
  bingCommission?: number
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
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Tab refs for sliding indicator
  const allTabRef = useRef<HTMLButtonElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const blockedTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

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

  // Update indicator position when tab changes
  useEffect(() => {
    const updateIndicator = () => {
      let activeRef = allTabRef
      if (statusFilter === 'active') activeRef = activeTabRef
      else if (statusFilter === 'blocked') activeRef = blockedTabRef

      if (activeRef.current) {
        setIndicatorStyle({
          left: activeRef.current.offsetLeft,
          width: activeRef.current.offsetWidth,
        })
      }
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [statusFilter])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setActiveDropdown(null)
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

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

      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      if (selectedUser) {
        await usersApi.update(selectedUser.id, payload)
        toast.success('User Updated', `${formData.username} has been updated successfully`)
      } else {
        await usersApi.create(payload)
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
  const [resetting2FA, setResetting2FA] = useState(false)

  // Ad Accounts Modal state
  const [isAdAccountsModalOpen, setIsAdAccountsModalOpen] = useState(false)
  const [adAccountsUser, setAdAccountsUser] = useState<User | null>(null)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [adAccountsPlatform, setAdAccountsPlatform] = useState<string>('ALL')
  const [adAccountsLoading, setAdAccountsLoading] = useState(false)
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null)

  // Coupon Modal state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [couponUser, setCouponUser] = useState<User | null>(null)
  const [couponAmount, setCouponAmount] = useState<number>(1)
  const [couponAction, setCouponAction] = useState<'add' | 'remove'>('add')
  const [couponLoading, setCouponLoading] = useState(false)

  const handleOpenCouponModal = (user: User) => {
    setCouponUser(user)
    setCouponAmount(1)
    setIsCouponModalOpen(true)
  }

  const handleCouponSubmit = async () => {
    if (!couponUser || couponAmount < 1) {
      toast.warning('Invalid', 'Please enter a valid amount')
      return
    }

    if (couponAction === 'remove' && (couponUser.couponBalance || 0) < couponAmount) {
      toast.error('Insufficient', `${couponUser.username} only has ${couponUser.couponBalance || 0} coupon(s)`)
      return
    }

    setCouponLoading(true)
    try {
      if (couponAction === 'add') {
        await usersApi.addCoupons(couponUser.id, couponAmount)
        toast.success('Coupons Added', `${couponAmount} coupon(s) given to ${couponUser.username}`)
      } else {
        await usersApi.removeCoupons(couponUser.id, couponAmount)
        toast.success('Coupons Removed', `${couponAmount} coupon(s) taken from ${couponUser.username}`)
      }
      setIsCouponModalOpen(false)
      fetchData()
    } catch (error: any) {
      toast.error('Failed', error.message || 'An error occurred')
    } finally {
      setCouponLoading(false)
    }
  }

  const copy2FAKey = (secret: string) => {
    navigator.clipboard.writeText(secret)
    setCopied2FAKey(true)
    setTimeout(() => setCopied2FAKey(false), 2000)
  }

  const handleReset2FA = async (user: User) => {
    if (!confirm(`Are you sure you want to reset 2FA for ${user.username}?`)) return

    setResetting2FA(true)
    try {
      const response = await usersApi.reset2FA(user.id)
      toast.success('2FA Reset', response.message)
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
    if (!confirm(`Remove "${accountName}" from this user's panel?`)) return

    setRemovingAccountId(accountId)
    try {
      await accountsApi.updateStatus(accountId, 'SUSPENDED')
      toast.success('Account Removed', `${accountName} has been suspended`)
      if (adAccountsUser) {
        fetchUserAdAccounts(adAccountsUser.id, adAccountsPlatform === 'ALL' ? undefined : adAccountsPlatform)
      }
    } catch (error: any) {
      toast.error('Failed to remove account', error.message || 'An error occurred')
    } finally {
      setRemovingAccountId(null)
    }
  }

  const handleActivateAccount = async (accountId: string, accountName: string) => {
    setRemovingAccountId(accountId)
    try {
      await accountsApi.updateStatus(accountId, 'APPROVED')
      toast.success('Account Activated', `${accountName} is now active`)
      if (adAccountsUser) {
        fetchUserAdAccounts(adAccountsUser.id, adAccountsPlatform === 'ALL' ? undefined : adAccountsPlatform)
      }
    } catch (error: any) {
      toast.error('Failed to activate account', error.message || 'An error occurred')
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
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">Active</span>
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-700">Pending</span>
      case 'SUSPENDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">Suspended</span>
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">Rejected</span>
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">Refunded</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">{status}</span>
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

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedUsers = filteredAndSortedUsers.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, startDate, endDate])

  // Stats
  const totalUsersCount = users.length
  const totalBalance = users.reduce((sum, user) => sum + Number(user.walletBalance || 0), 0)
  const activeUsers = users.filter(u => u.status === 'ACTIVE').length
  const blockedUsers = users.filter(u => u.status === 'BLOCKED').length

  return (
    <DashboardLayout title="User Management">
      <style jsx>{`
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-row-animate {
          animation: tabFadeIn 0.25s ease-out forwards;
          opacity: 0;
        }
      `}</style>

      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-full lg:w-[260px] focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white transition-all"
            />
          </div>

          {/* Sort Filter */}
          <div className="relative dropdown-container">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[140px] justify-between bg-white"
            >
              <span>
                {sortBy === 'newest' ? 'Newest First' : sortBy === 'balance-high' ? 'High Balance' : sortBy === 'balance-low' ? 'Low Balance' : 'Blocked First'}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 transition-all duration-200 ease-out origin-top ${
              showSortDropdown
                ? 'opacity-100 scale-y-100 translate-y-0 visible'
                : 'opacity-0 scale-y-95 -translate-y-1 invisible'
            }`}>
              {[
                { value: 'newest', label: 'Newest First' },
                { value: 'balance-high', label: 'Balance: High to Low' },
                { value: 'balance-low', label: 'Balance: Low to High' },
                { value: 'blocked', label: 'Blocked First' },
              ].map((option, index) => (
                <button
                  key={option.value}
                  onClick={() => { setSortBy(option.value); setShowSortDropdown(false) }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${sortBy === option.value ? 'text-violet-600 bg-violet-500/5 font-medium' : 'text-gray-600'}`}
                  style={{ transitionDelay: showSortDropdown ? `${index * 30}ms` : '0ms' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add User Button */}
        <button
          onClick={handleAddUser}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Users</span>
              <p className="text-2xl font-bold text-gray-800">{totalUsersCount.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-violet-500 text-white text-sm font-medium rounded">+{activeUsers} active</span>
          </div>
          <StatsChart value={totalUsersCount} color="#8B5CF6" filterId="glowVioletUsers" gradientId="fadeVioletUsers" clipId="clipVioletUsers" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Total Balance</span>
              <p className="text-2xl font-bold text-gray-800">${totalBalance.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#3B82F6] text-white text-sm font-medium rounded">All Users</span>
          </div>
          <StatsChart value={totalBalance} color="#3B82F6" filterId="glowBlueUsers" gradientId="fadeBlueUsers" clipId="clipBlueUsers" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Active Users</span>
              <p className="text-2xl font-bold text-gray-800">{activeUsers.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#52B788] text-white text-sm font-medium rounded">Active</span>
          </div>
          <StatsChart value={activeUsers} color="#52B788" filterId="glowGreenUsers" gradientId="fadeGreenUsers" clipId="clipGreenUsers" />
        </Card>

        <Card className="p-4 relative overflow-hidden min-h-[95px]">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <span className="text-[13px] text-gray-500">Blocked Users</span>
              <p className="text-2xl font-bold text-gray-800">{blockedUsers.toLocaleString()}</p>
            </div>
            <span className="px-2 py-0.5 bg-[#EF4444] text-white text-sm font-medium rounded">Blocked</span>
          </div>
          <StatsChart value={blockedUsers} color="#EF4444" filterId="glowRedUsers" gradientId="fadeRedUsers" clipId="clipRedUsers" />
        </Card>
      </div>

      {/* Tabs & Table */}
      <Card className="p-0 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 300px)' }}>
        {/* Tabs with smooth sliding indicator */}
        <div className="border-b border-gray-100 flex-shrink-0">
          <div className="flex relative">
            <button
              ref={allTabRef}
              onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                statusFilter === 'all' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Users
            </button>
            <button
              ref={activeTabRef}
              onClick={() => { setStatusFilter('active'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                statusFilter === 'active' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active
            </button>
            <button
              ref={blockedTabRef}
              onClick={() => { setStatusFilter('blocked'); setCurrentPage(1) }}
              className={`px-6 py-3.5 text-[15px] font-medium transition-all duration-300 ease-out relative z-10 ${
                statusFilter === 'blocked' ? 'text-violet-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Blocked
            </button>
            {/* Sliding indicator */}
            <div
              className="absolute bottom-0 h-0.5 bg-violet-600 transition-all duration-300 ease-out"
              style={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 min-h-0" key={statusFilter}>
          <table className="w-full text-sm xl:text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">User</th>
                <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Credentials</th>
                <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Agent</th>
                <th className="text-right py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Balance</th>
                <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Rates</th>
                <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Coupons</th>
                <th className="text-left py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50 hidden 2xl:table-cell">Remarks</th>
                <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Joined</th>
                <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Status</th>
                <th className="text-center py-2.5 px-2 xl:px-3 font-semibold text-gray-500 uppercase tracking-wide text-sm whitespace-nowrap bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center">
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-5 h-5 text-violet-600 animate-spin mb-1" />
                      <span className="text-gray-500">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-gray-500">
                    {searchQuery ? 'No matching users found' : 'No users found'}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50/50 align-middle tab-row-animate"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    {/* User Info */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-[13px] shadow-sm">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-white ${
                            user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate max-w-[100px] lg:max-w-[130px] xl:max-w-[160px]">{user.realName || user.username}</p>
                          <p className="text-gray-500 text-sm truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Credentials */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 truncate max-w-[80px] lg:max-w-[110px] xl:max-w-[140px]">{user.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowPasswordId(showPasswordId === user.id ? null : user.id)}
                            className="flex items-center gap-1 group"
                          >
                            <code className={`font-medium px-1.5 py-0.5 rounded text-sm transition-all duration-300 ease-out ${
                              showPasswordId === user.id && user.plaintextPassword
                                ? 'text-gray-700 bg-gray-100'
                                : showPasswordId === user.id && !user.plaintextPassword
                                ? 'text-red-500 bg-red-50'
                                : 'text-gray-400 bg-gray-100'
                            }`}>
                              {showPasswordId === user.id
                                ? (user.plaintextPassword || 'Reset needed')
                                : '••••••'}
                            </code>
                            <span className="flex-shrink-0">
                              {showPasswordId === user.id ? (
                                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                              ) : (
                                <Eye className="w-3 h-3 text-gray-400" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Agent */}
                    <td className="py-2.5 px-2 xl:px-3">
                      {user.agent?.username ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 rounded text-sm font-medium text-violet-700">
                          {user.agent.username}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="py-2.5 px-2 xl:px-3 text-right">
                      <span className="font-semibold text-blue-600">
                        ${Number(user.walletBalance || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Rates — Compact FB & Google */}
                    <td className="py-2.5 px-1.5 xl:px-2">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          <span className="text-[10px] font-medium text-gray-700">${user.fbFee || 0}</span>
                          <span className="text-[9px] text-gray-400">/ {user.fbCommission || 0}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.06c1.68 0 3.19.58 4.39 1.54l3.28-3.28A11.96 11.96 0 0 0 12 .06c-4.74 0-8.8 2.76-10.74 6.76l4 3.1z"/><path fill="#34A853" d="M1.26 9.76A11.91 11.91 0 0 0 0 12.06c0 1.92.45 3.73 1.26 5.34l4-3.1a7.15 7.15 0 0 1 0-4.44l-4-3.1z"/><path fill="#4285F4" d="M12 18.06c-2.67 0-5-1.47-6.26-3.66l-4 3.1C4.2 21.36 7.8 24.06 12 24.06c3.02 0 5.74-1.14 7.84-2.98l-3.9-3.02c-1.1.72-2.47 1.14-3.94 1.14z"/><path fill="#FBBC05" d="M23.94 12.06c0-.9-.08-1.76-.22-2.6H12v5.12h6.72c-.32 1.6-1.18 2.96-2.46 3.88l3.9 3.02c2.28-2.1 3.78-5.2 3.78-9.42z"/></svg>
                          <span className="text-[10px] font-medium text-gray-700">${user.googleFee || 0}</span>
                          <span className="text-[9px] text-gray-400">/ {user.googleCommission || 0}%</span>
                        </div>
                      </div>
                    </td>

                    {/* Coupons */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div className="flex items-center justify-center gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 text-teal-600 font-semibold text-xs">
                          <Ticket className="w-3 h-3" />
                          {user.couponBalance || 0}
                        </span>
                        <div className="flex gap-0.5">
                          <button
                            onClick={() => { setCouponAction('add'); handleOpenCouponModal(user) }}
                            className="p-1 rounded bg-teal-500/10 text-teal-600 hover:bg-teal-500/20 transition-colors"
                            title="Give Coupons"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setCouponAction('remove'); handleOpenCouponModal(user) }}
                            disabled={(user.couponBalance || 0) < 1}
                            className="p-1 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Take Coupons"
                          >
                            <Undo2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Remarks */}
                    <td className="py-2.5 px-2 xl:px-3 hidden 2xl:table-cell">
                      {user.personalRemarks ? (
                        <span className="text-sm text-gray-600 line-clamp-2 max-w-[120px] block">{user.personalRemarks}</span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>

                    {/* Join Date */}
                    <td className="py-2.5 px-2 xl:px-3 text-center whitespace-nowrap">
                      <span className="text-gray-500 text-sm">
                        {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2.5 px-2 xl:px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {user.status === 'ACTIVE' ? 'Active' : 'Blocked'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2 xl:px-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => handleViewProfile(user)}
                          className="flex items-center gap-1 px-1.5 py-1 bg-gray-100 text-gray-600 rounded font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleViewAdAccounts(user)}
                          className="flex items-center gap-1 px-1.5 py-1 bg-emerald-50 text-emerald-600 rounded font-medium hover:bg-emerald-100 transition-colors whitespace-nowrap"
                          title="Ad Accounts"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="flex items-center gap-1 px-1.5 py-1 bg-violet-50 text-violet-600 rounded font-medium hover:bg-violet-100 transition-colors whitespace-nowrap"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="flex items-center gap-1 px-1.5 py-1 bg-red-50 text-red-500 rounded font-medium hover:bg-red-100 transition-colors whitespace-nowrap"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredAndSortedUsers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 flex-shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-500">
                {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length}
              </span>
              <PaginationSelect value={itemsPerPage} onChange={(val) => { setItemsPerPage(val); setCurrentPage(1) }} />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-[13px] font-medium transition-all ${
                      currentPage === pageNum
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit User Modal — Compact with table-style platform fees */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? 'Edit User' : 'Add New User'}
        className="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-3 max-h-[75vh] overflow-y-auto px-0.5">
          {/* Basic Information */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <UsersIcon className="w-4 h-4 text-gray-500" />
              Basic Information
            </h3>
            <div>
              <label className="text-sm font-medium text-gray-500 mb-0.5 block">Real Name *</label>
              <input
                type="text"
                required
                value={formData.realName}
                onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">
                  Password {!isEditMode && '*'}
                  {isEditMode && <span className="text-gray-400 ml-1">(blank = keep)</span>}
                </label>
                <input
                  type="password"
                  required={!isEditMode}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={isEditMode ? "New password" : ""}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                />
              </div>
            </div>
          </div>

          {/* Platform Rates — Compact Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-gray-500" />
              Platform Rates
            </h3>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase">Platform</div>
                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase text-center">Opening ($)</div>
                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase text-center">Commission (%)</div>
                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 uppercase text-center">Unlimited ($)</div>
              </div>

              {/* Facebook */}
              <div className="grid grid-cols-4 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </div>
                  <span className="font-medium text-gray-700 text-[13px]">Facebook</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.facebook.openingFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, openingFee: e.target.value } } })} placeholder="30" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" step="0.1" value={formData.platformFees.facebook.depositFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, depositFee: e.target.value } } })} placeholder="3" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.facebook.unlimitedDomainFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, unlimitedDomainFee: e.target.value } } })} placeholder="0" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
              </div>

              {/* Google */}
              <div className="grid grid-cols-4 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-[#EA4335]" fill="currentColor" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32l3.56 2.76c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  </div>
                  <span className="font-medium text-gray-700 text-[13px]">Google</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.google.openingFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, openingFee: e.target.value } } })} placeholder="50" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" step="0.1" value={formData.platformFees.google.depositFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, depositFee: e.target.value } } })} placeholder="5" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.google.unlimitedDomainFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, unlimitedDomainFee: e.target.value } } })} placeholder="0" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
              </div>

              {/* TikTok */}
              <div className="grid grid-cols-4 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-gray-900" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                  </div>
                  <span className="font-medium text-gray-700 text-[13px]">TikTok</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.tiktok.openingFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, openingFee: e.target.value } } })} placeholder="40" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" step="0.1" value={formData.platformFees.tiktok.depositFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, depositFee: e.target.value } } })} placeholder="4" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.tiktok.unlimitedDomainFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, unlimitedDomainFee: e.target.value } } })} placeholder="0" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
              </div>

              {/* Snapchat */}
              <div className="grid grid-cols-4 border-b border-gray-50 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-yellow-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-.809-.329-1.24-.719-1.24-1.138 0-.389.283-.72.735-.838.209-.06.479-.09.657-.09.135 0 .3.015.449.09.376.18.735.285 1.049.301.181 0 .313-.045.387-.09-.008-.12-.016-.242-.026-.37l-.003-.051c-.104-1.612-.238-3.654.283-4.847C7.879 1.069 11.216.793 12.206.793z"/></svg>
                  </div>
                  <span className="font-medium text-gray-700 text-[13px]">Snapchat</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.snapchat.openingFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, openingFee: e.target.value } } })} placeholder="35" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" step="0.1" value={formData.platformFees.snapchat.depositFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, depositFee: e.target.value } } })} placeholder="3.5" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.snapchat.unlimitedDomainFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, unlimitedDomainFee: e.target.value } } })} placeholder="0" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
              </div>

              {/* Bing */}
              <div className="grid grid-cols-4 hover:bg-gray-50/50">
                <div className="px-2 py-1.5 flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-teal-600" viewBox="0 0 24 24" fill="currentColor"><path d="M10.1 8.6L11.8 12.9L14.6 14.2L9 17.5V3.4L5 2V19.8L9 22L19 16.2V11.7L10.1 8.6Z"/></svg>
                  </div>
                  <span className="font-medium text-gray-700 text-[13px]">Bing</span>
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.bing.openingFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, openingFee: e.target.value } } })} placeholder="45" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" step="0.1" value={formData.platformFees.bing.depositFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, depositFee: e.target.value } } })} placeholder="4.5" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
                <div className="px-1 py-1 flex items-center justify-center">
                  <input type="number" value={formData.platformFees.bing.unlimitedDomainFee} onChange={(e) => setFormData({ ...formData, platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, unlimitedDomainFee: e.target.value } } })} placeholder="0" className="w-full h-6 px-1.5 rounded border border-gray-200 text-sm text-center focus:border-violet-500 focus:outline-none placeholder:text-gray-300" />
                </div>
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-gray-500" />
              Assignment & Status
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">Assign Agent</label>
                <select
                  value={formData.agentId}
                  onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                >
                  <option value="">No Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 mb-0.5 block">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-9 px-2 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 bg-white"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 mb-0.5 block">Personal Remarks</label>
              <textarea
                value={formData.personalRemarks}
                onChange={(e) => setFormData({ ...formData, personalRemarks: e.target.value })}
                placeholder="Notes about this user..."
                rows={2}
                className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="h-8 px-4 text-sm font-medium text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {formLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {selectedUser ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setUserToDelete(null) }}
        title="Delete User"
      >
        <div className="space-y-3">
          {userToDelete && (
            <div className="flex items-center gap-2.5 p-2.5 bg-red-50 rounded-lg border border-red-100">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {userToDelete.username.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{userToDelete.username}</p>
                <p className="text-sm text-gray-500">{userToDelete.email}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-600">
            This action cannot be undone. All data associated with this user will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setIsDeleteModalOpen(false); setUserToDelete(null) }}
              className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="h-8 px-4 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
            >
              Delete User
            </button>
          </div>
        </div>
      </Modal>

      {/* View Profile Modal */}
      <Modal
        isOpen={isViewProfileOpen}
        onClose={() => { setIsViewProfileOpen(false); setViewUser(null) }}
        title="User Profile"
      >
        {viewUser && (
          <div className="space-y-3">
            {/* Profile Header */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-lg border border-violet-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-base font-bold shadow-sm">
                  {viewUser.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{viewUser.realName || viewUser.username}</h3>
                  <p className="text-sm text-gray-500">{viewUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold ${
                  viewUser.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${viewUser.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {viewUser.status}
                </span>
                <button
                  onClick={() => { setIsViewProfileOpen(false); handleEditUser(viewUser) }}
                  className="p-1.5 hover:bg-white/80 rounded-md transition-colors"
                >
                  <Edit className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 text-sm">
              {[
                { label: 'Username', value: viewUser.username },
                { label: 'Phone', value: viewUser.phone || 'Not provided' },
                { label: 'Wallet Balance', value: `$${Number(viewUser.walletBalance || 0).toLocaleString()}`, highlight: true },
                { label: 'Agent', value: viewUser.agent?.username || 'No Agent' },
                { label: 'Created', value: new Date(viewUser.createdAt).toLocaleDateString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2">
                  <span className="text-gray-500">{item.label}</span>
                  <span className={`font-medium ${item.highlight ? 'text-blue-600 font-bold' : 'text-gray-900'}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* 2FA Section */}
            {viewUser.twoFactorEnabled && viewUser.twoFactorSecret && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-violet-500" />
                  Two-Factor Authentication
                </h4>
                <div className="bg-violet-50 rounded-lg p-3 border border-violet-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                      <span className="w-1 h-1 rounded-full bg-green-500" />
                      Enabled
                    </span>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 block mb-1">Secret Key</label>
                    <div className="flex items-center gap-1.5 p-2 bg-white rounded-md border border-gray-200">
                      <code className="flex-1 text-sm font-mono text-gray-700 break-all select-all">{viewUser.twoFactorSecret}</code>
                      <button
                        onClick={() => copy2FAKey(viewUser.twoFactorSecret!)}
                        className="p-1 text-gray-500 hover:text-violet-500 rounded transition-colors"
                      >
                        {copied2FAKey ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleReset2FA(viewUser)}
                    disabled={resetting2FA}
                    className="w-full flex items-center justify-center gap-1.5 h-8 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${resetting2FA ? 'animate-spin' : ''}`} />
                    {resetting2FA ? 'Resetting...' : 'Reset 2FA'}
                  </button>
                </div>
              </div>
            )}

            {/* Remarks */}
            {viewUser.personalRemarks && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Remarks</h4>
                <p className="text-[13px] text-gray-600 bg-gray-50 rounded-lg p-2.5">{viewUser.personalRemarks}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => { setIsViewProfileOpen(false); setViewUser(null) }}
                className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
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
        onClose={() => { setIsAdAccountsModalOpen(false); setAdAccountsUser(null); setAdAccounts([]); setAdAccountsPlatform('ALL') }}
        title={`${adAccountsUser?.username || 'User'}'s Ad Accounts`}
        className="max-w-2xl"
      >
        <div className="space-y-3">
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
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-all ${
                  adAccountsPlatform === tab.value
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.value !== 'ALL' && <span className="flex-shrink-0">{getPlatformIcon(tab.value)}</span>}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Accounts List */}
          <div className="max-h-[350px] overflow-y-auto rounded-lg border border-gray-200">
            {adAccountsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                <span className="ml-2 text-sm text-gray-500">Loading accounts...</span>
              </div>
            ) : adAccounts.length === 0 ? (
              <div className="text-center py-10">
                <Monitor className="w-9 h-9 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No ad accounts found</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-500">Platform</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-500">Account ID</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-gray-500">Name</th>
                    <th className="text-center px-3 py-2 text-sm font-semibold text-gray-500">Status</th>
                    <th className="text-center px-3 py-2 text-sm font-semibold text-gray-500 w-[70px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adAccounts.map((account) => (
                    <tr key={account.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {getPlatformIcon(account.platform)}
                          <span className="text-sm font-medium text-gray-700">{getPlatformLabel(account.platform)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm font-mono text-gray-600">{account.accountId}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-gray-700">{account.accountName || '-'}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {getStatusBadge(account.status)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {account.status === 'SUSPENDED' ? (
                          <button
                            onClick={() => handleActivateAccount(account.id, account.accountName || account.accountId)}
                            disabled={removingAccountId === account.id}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                          >
                            {removingAccountId === account.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Activate
                          </button>
                        ) : account.status === 'REFUNDED' ? (
                          <span className="text-[11px] text-gray-400">-</span>
                        ) : (
                          <button
                            onClick={() => handleRemoveAccount(account.id, account.accountName || account.accountId)}
                            disabled={removingAccountId === account.id}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {removingAccountId === account.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {adAccounts.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-gray-400">
                {adAccounts.length} account{adAccounts.length !== 1 ? 's' : ''}
                {adAccountsPlatform !== 'ALL' ? ` (${getPlatformLabel(adAccountsPlatform)})` : ''}
              </p>
              <button
                onClick={() => { setIsAdAccountsModalOpen(false); setAdAccountsUser(null); setAdAccounts([]) }}
                className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Coupon Give/Take Modal */}
      <Modal isOpen={isCouponModalOpen} onClose={() => setIsCouponModalOpen(false)} title="Manage Coupons">
        {couponUser && (
          <div className="space-y-4">
            {/* User Info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                {couponUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{couponUser.username}</p>
                <p className="text-sm text-gray-500">{couponUser.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Current Balance</p>
                <p className="text-lg font-bold text-gray-900">{couponUser.couponBalance || 0}</p>
              </div>
            </div>

            {/* Action Toggle */}
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1.5 block">Action</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCouponAction('add')}
                  className={`h-9 flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors border ${
                    couponAction === 'add'
                      ? 'bg-violet-50 border-violet-300 text-violet-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Give Coupons
                </button>
                <button
                  type="button"
                  onClick={() => setCouponAction('remove')}
                  className={`h-9 flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors border ${
                    couponAction === 'remove'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Take Coupons
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="text-sm font-medium text-gray-500 mb-1.5 block">Amount</label>
              <input
                type="number"
                value={couponAmount}
                onChange={(e) => setCouponAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                min={1}
              />
            </div>

            {/* Summary */}
            <div className={`p-3 rounded-xl ${couponAction === 'add' ? 'bg-violet-50 border border-violet-100' : 'bg-red-50 border border-red-100'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium text-gray-900">{couponUser.couponBalance || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-gray-600">{couponAction === 'add' ? 'Adding' : 'Removing'}</span>
                <span className={`font-medium ${couponAction === 'add' ? 'text-violet-600' : 'text-red-600'}`}>
                  {couponAction === 'add' ? '+' : '-'}{couponAmount}
                </span>
              </div>
              <div className="border-t border-gray-200/40 my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-700">New Balance</span>
                <span className="font-bold text-gray-900">
                  {couponAction === 'add'
                    ? (couponUser.couponBalance || 0) + couponAmount
                    : Math.max(0, (couponUser.couponBalance || 0) - couponAmount)
                  }
                </span>
              </div>
            </div>

            {couponAction === 'remove' && (couponUser.couponBalance || 0) < couponAmount && (
              <p className="text-sm text-red-600">Insufficient balance. User only has {couponUser.couponBalance || 0} coupon(s).</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="h-8 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCouponSubmit}
                disabled={couponLoading || (couponAction === 'remove' && (couponUser.couponBalance || 0) < couponAmount)}
                className={`h-8 px-4 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  couponAction === 'add'
                    ? 'bg-violet-600 hover:bg-violet-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {couponLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Gift className="w-3.5 h-3.5" />
                )}
                {couponAction === 'add' ? `Give ${couponAmount} Coupon(s)` : `Take ${couponAmount} Coupon(s)`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
