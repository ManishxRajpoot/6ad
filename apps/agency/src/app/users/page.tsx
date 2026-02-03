'use client'

import { useEffect, useState, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { StatsChart } from '@/components/ui/StatsChart'
import { usersApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useToast } from '@/contexts/ToastContext'
import {
  Plus,
  Search,
  Edit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ticket,
  Undo2,
  Users,
  Wallet,
  Copy,
  Eye,
  EyeOff,
  Download,
  Loader2,
  Ban,
  CheckCircle,
  ShieldOff
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
  uniqueId: string
  createdAt: string
  couponBalance?: number
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
  fbUnlimitedDomainFee?: number
  personalRemarks?: string
}

export default function UsersPage() {
  const { user: agentUser, updateUser } = useAuthStore()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('newest')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  // Coupon modal state
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [couponUser, setCouponUser] = useState<User | null>(null)
  const [couponAmount, setCouponAmount] = useState(1)
  const [couponLoading, setCouponLoading] = useState(false)
  const [agentCoupons, setAgentCoupons] = useState(0)
  const [couponUserDropdownOpen, setCouponUserDropdownOpen] = useState(false)
  const [couponMode, setCouponMode] = useState<'give' | 'take'>('give')

  // Block modal state
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [userToBlock, setUserToBlock] = useState<User | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [blockLoading, setBlockLoading] = useState(false)

  // Tab refs for sliding indicator
  const allTabRef = useRef<HTMLButtonElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)
  const blockedTabRef = useRef<HTMLButtonElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

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

  // Sync agent coupons with auth store
  useEffect(() => {
    if (agentUser?.couponBalance !== undefined) {
      setAgentCoupons(agentUser.couponBalance)
    }
  }, [agentUser?.couponBalance])

  const usernamePrefix = (agentUser?.username || '').replace(/\s+/g, '') + '_'

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    phone2: '',
    realName: '',
    address: '',
    website: '',
    status: 'ACTIVE',
    personalRemarks: '',
    platformFees: {
      facebook: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
      google: { openingFee: '', depositFee: '' },
      tiktok: { openingFee: '', depositFee: '' },
      snapchat: { openingFee: '', depositFee: '' },
      bing: { openingFee: '', depositFee: '' },
    }
  })

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.dropdown-container')) {
        setShowStatusDropdown(false)
        setShowSortDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [usersData, meData] = await Promise.all([
        usersApi.getAll(),
        authApi.me()
      ])
      setUsers(usersData.users || [])
      if (meData?.user) {
        // Update all relevant user data including fees
        const userData = meData.user
        setAgentCoupons(userData.couponBalance || 0)
        updateUser({
          couponBalance: userData.couponBalance || 0,
          fbFee: userData.fbFee,
          fbCommission: userData.fbCommission,
          fbUnlimitedDomainFee: userData.fbUnlimitedDomainFee,
          googleFee: userData.googleFee,
          googleCommission: userData.googleCommission,
          tiktokFee: userData.tiktokFee,
          tiktokCommission: userData.tiktokCommission,
          snapchatFee: userData.snapchatFee,
          snapchatCommission: userData.snapchatCommission,
          bingFee: userData.bingFee,
          bingCommission: userData.bingCommission,
        })
      }
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
      status: 'ACTIVE',
      personalRemarks: '',
      platformFees: {
        facebook: { openingFee: '', depositFee: '', unlimitedDomainFee: '' },
        google: { openingFee: '', depositFee: '' },
        tiktok: { openingFee: '', depositFee: '' },
        snapchat: { openingFee: '', depositFee: '' },
        bing: { openingFee: '', depositFee: '' },
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
      status: user.status,
      personalRemarks: user.personalRemarks || '',
      platformFees: {
        facebook: {
          openingFee: user.fbFee?.toString() || '',
          depositFee: user.fbCommission?.toString() || '',
          unlimitedDomainFee: user.fbUnlimitedDomainFee?.toString() || ''
        },
        google: {
          openingFee: user.googleFee?.toString() || '',
          depositFee: user.googleCommission?.toString() || ''
        },
        tiktok: {
          openingFee: user.tiktokFee?.toString() || '',
          depositFee: user.tiktokCommission?.toString() || ''
        },
        snapchat: {
          openingFee: user.snapchatFee?.toString() || '',
          depositFee: user.snapchatCommission?.toString() || ''
        },
        bing: {
          openingFee: user.bingFee?.toString() || '',
          depositFee: user.bingCommission?.toString() || ''
        },
      }
    })
    setIsEditMode(true)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      // Client-side validation for minimum fees
      const errors: string[] = []
      const fbFee = Number(formData.platformFees.facebook.openingFee) || 0
      const fbCommission = Number(formData.platformFees.facebook.depositFee) || 0
      const fbUnlimitedDomainFee = Number(formData.platformFees.facebook.unlimitedDomainFee) || 0
      const googleFee = Number(formData.platformFees.google.openingFee) || 0
      const googleCommission = Number(formData.platformFees.google.depositFee) || 0
      const tiktokFee = Number(formData.platformFees.tiktok.openingFee) || 0
      const tiktokCommission = Number(formData.platformFees.tiktok.depositFee) || 0
      const snapchatFee = Number(formData.platformFees.snapchat.openingFee) || 0
      const snapchatCommission = Number(formData.platformFees.snapchat.depositFee) || 0
      const bingFee = Number(formData.platformFees.bing.openingFee) || 0
      const bingCommission = Number(formData.platformFees.bing.depositFee) || 0

      // Check minimums based on agent's fees - only validate if agent has minimum set (> 0)
      if (agentUser) {
        const agentFbFee = Number(agentUser.fbFee) || 0
        const agentFbCommission = Number(agentUser.fbCommission) || 0
        const agentFbUnlimitedDomainFee = Number(agentUser.fbUnlimitedDomainFee) || 0
        const agentGoogleFee = Number(agentUser.googleFee) || 0
        const agentGoogleCommission = Number(agentUser.googleCommission) || 0
        const agentTiktokFee = Number(agentUser.tiktokFee) || 0
        const agentTiktokCommission = Number(agentUser.tiktokCommission) || 0
        const agentSnapchatFee = Number(agentUser.snapchatFee) || 0
        const agentSnapchatCommission = Number(agentUser.snapchatCommission) || 0
        const agentBingFee = Number(agentUser.bingFee) || 0
        const agentBingCommission = Number(agentUser.bingCommission) || 0

        if (agentFbFee > 0 && fbFee < agentFbFee) {
          errors.push(`Facebook Opening Fee cannot be less than $${agentFbFee}`)
        }
        if (agentFbCommission > 0 && fbCommission < agentFbCommission) {
          errors.push(`Facebook Commission cannot be less than ${agentFbCommission}%`)
        }
        if (agentFbUnlimitedDomainFee > 0 && fbUnlimitedDomainFee < agentFbUnlimitedDomainFee) {
          errors.push(`Facebook Unlimited Domain Fee cannot be less than $${agentFbUnlimitedDomainFee}`)
        }
        if (agentGoogleFee > 0 && googleFee < agentGoogleFee) {
          errors.push(`Google Opening Fee cannot be less than $${agentGoogleFee}`)
        }
        if (agentGoogleCommission > 0 && googleCommission < agentGoogleCommission) {
          errors.push(`Google Commission cannot be less than ${agentGoogleCommission}%`)
        }
        if (agentTiktokFee > 0 && tiktokFee < agentTiktokFee) {
          errors.push(`TikTok Opening Fee cannot be less than $${agentTiktokFee}`)
        }
        if (agentTiktokCommission > 0 && tiktokCommission < agentTiktokCommission) {
          errors.push(`TikTok Commission cannot be less than ${agentTiktokCommission}%`)
        }
        if (agentSnapchatFee > 0 && snapchatFee < agentSnapchatFee) {
          errors.push(`Snapchat Opening Fee cannot be less than $${agentSnapchatFee}`)
        }
        if (agentSnapchatCommission > 0 && snapchatCommission < agentSnapchatCommission) {
          errors.push(`Snapchat Commission cannot be less than ${agentSnapchatCommission}%`)
        }
        if (agentBingFee > 0 && bingFee < agentBingFee) {
          errors.push(`Bing Opening Fee cannot be less than $${agentBingFee}`)
        }
        if (agentBingCommission > 0 && bingCommission < agentBingCommission) {
          errors.push(`Bing Commission cannot be less than ${agentBingCommission}%`)
        }
      }

      if (errors.length > 0) {
        toast.error('Validation Error', errors[0])
        setFormLoading(false)
        return
      }

      const finalUsername = selectedUser
        ? formData.username
        : (usernamePrefix + formData.username)

      const payload: any = {
        username: finalUsername,
        email: formData.email,
        phone: formData.phone,
        phone2: formData.phone2,
        realName: formData.realName,
        address: formData.address,
        website: formData.website,
        status: formData.status,
        personalRemarks: formData.personalRemarks,
        fbFee,
        fbCommission,
        fbUnlimitedDomainFee,
        googleFee,
        googleCommission,
        tiktokFee,
        tiktokCommission,
        snapchatFee,
        snapchatCommission,
        bingFee,
        bingCommission,
      }

      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      if (selectedUser) {
        await usersApi.update(selectedUser.id, payload)
        toast.success('User Updated', `${formData.username} has been updated successfully`)
      } else {
        await usersApi.create(payload)
        toast.success('User Created', `${finalUsername} has been added successfully`)
      }

      setIsModalOpen(false)
      await fetchData()
    } catch (error: any) {
      console.error('Submit error:', error)
      toast.error('Error', error.message || 'An error occurred while saving the user')
    } finally {
      setFormLoading(false)
    }
  }


  const handleGiveCoupon = (user: User, mode: 'give' | 'take' = 'give') => {
    setCouponUser(user)
    setCouponAmount(1)
    setCouponMode(mode)
    setIsCouponModalOpen(true)
  }

  // Block user handler
  const handleBlockUser = (user: User) => {
    setUserToBlock(user)
    setBlockReason('')
    setIsBlockModalOpen(true)
  }

  // Confirm block user
  const confirmBlockUser = async () => {
    if (!userToBlock) return
    setBlockLoading(true)
    try {
      await usersApi.block(userToBlock.id, blockReason || undefined)
      toast.success('User Blocked', `${userToBlock.username} has been blocked successfully`)
      setIsBlockModalOpen(false)
      setUserToBlock(null)
      setBlockReason('')
      await fetchData()
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to block user')
    } finally {
      setBlockLoading(false)
    }
  }

  // Unblock user handler
  const handleUnblockUser = async (user: User) => {
    try {
      await usersApi.unblock(user.id)
      toast.success('User Unblocked', `${user.username} has been unblocked successfully`)
      await fetchData()
    } catch (error: any) {
      toast.error('Error', error.message || 'Failed to unblock user')
    }
  }

  const handleTakeCoupon = (user: User) => {
    handleGiveCoupon(user, 'take')
  }

  const confirmCouponAction = async () => {
    if (!couponUser || couponAmount < 1) return

    setCouponLoading(true)

    try {
      let response
      if (couponMode === 'give') {
        response = await usersApi.giveCoupons(couponUser.id, couponAmount)
        toast.success('Coupons Sent', response.message)
      } else {
        response = await usersApi.takeCoupons(couponUser.id, couponAmount)
        toast.success('Coupons Taken Back', response.message)
      }

      setAgentCoupons(response.agentCouponsRemaining)
      updateUser({ couponBalance: response.agentCouponsRemaining })

      setIsCouponModalOpen(false)
      setCouponUser(null)
      fetchData()
    } catch (error: any) {
      toast.error('Error', error.message || `Failed to ${couponMode === 'give' ? 'give' : 'take back'} coupons`)
    } finally {
      setCouponLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied', 'Copied to clipboard')
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Filter users based on search and status
  const filteredUsers = users.filter((user) => {
    // Search filter
    const query = searchQuery.toLowerCase().trim()
    const matchesSearch = !query ||
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.realName?.toLowerCase().includes(query) ||
      user.phone?.includes(query) ||
      user.uniqueId?.toLowerCase().includes(query) ||
      user.walletBalance?.toString().includes(query) ||
      formatDate(user.createdAt).includes(query)

    // Status filter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.status === 'ACTIVE') ||
      (statusFilter === 'blocked' && user.status === 'BLOCKED')

    return matchesSearch && matchesStatus
  }).sort((a, b) => {
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
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortBy])

  // Stats calculations
  const totalBalance = users.reduce((sum, user) => sum + Number(user.walletBalance || 0), 0)
  const totalUsers = users.length
  const activeUsers = users.filter(u => u.status === 'ACTIVE').length
  const blockedUsers = users.filter(u => u.status === 'BLOCKED').length

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#52B788] text-white">Active</span>
    }
    return <span className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[#EF4444] text-white">Blocked</span>
  }

  return (
    <DashboardLayout title="Users Management" subtitle="">
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Fixed Top Section */}
        <div className="flex-shrink-0 bg-[#F6F6F6] pb-4">
          {/* Top Actions Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm w-[250px] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>

              {/* Sort Filter */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => { setShowSortDropdown(!showSortDropdown); setShowStatusDropdown(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-gray-300 transition-colors min-w-[160px] justify-between bg-white"
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
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-all duration-150 ${sortBy === option.value ? 'text-[#7C3AED] bg-[#7C3AED]/5 font-medium' : 'text-gray-600'}`}
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
              className="flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] text-white rounded-lg text-sm font-medium hover:bg-[#6D28D9] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Users - Purple */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Users</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{totalUsers.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#52B788] text-white text-xs font-medium rounded">+{activeUsers} active</span>
              </div>
              <StatsChart value={totalUsers} color="#7C3AED" filterId="glowPurpleUsers" gradientId="fadePurpleUsers" clipId="clipPurpleUsers" />
            </Card>

            {/* Total Balance - Green */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Total Balance</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">${totalBalance.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#52B788] text-white text-xs font-medium rounded">All Users</span>
              </div>
              <StatsChart value={totalBalance} color="#52B788" filterId="glowGreenUsers" gradientId="fadeGreenUsers" clipId="clipGreenUsers" />
            </Card>

            {/* Your Coupons - Orange */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Your Coupons</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{agentCoupons.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#F59E0B] text-white text-xs font-medium rounded">Available</span>
              </div>
              <StatsChart value={agentCoupons} color="#F59E0B" filterId="glowOrangeUsers" gradientId="fadeOrangeUsers" clipId="clipOrangeUsers" />
            </Card>

            {/* Blocked Users - Red */}
            <Card className="p-4 relative overflow-hidden">
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <span className="text-sm text-gray-500">Blocked Users</span>
                  <p className="text-2xl font-bold text-gray-800 mt-1">{blockedUsers.toLocaleString()}</p>
                </div>
                <span className="px-2 py-0.5 bg-[#EF4444] text-white text-xs font-medium rounded">Blocked</span>
              </div>
              <StatsChart value={blockedUsers} color="#EF4444" filterId="glowRedUsers" gradientId="fadeRedUsers" clipId="clipRedUsers" />
            </Card>
          </div>
        </div>

        {/* Tabs & Table */}
        <Card className="p-0 overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Tabs with smooth sliding indicator */}
          <div className="border-b border-gray-100">
            <div className="flex relative">
              <button
                ref={allTabRef}
                onClick={() => { setStatusFilter('all'); setCurrentPage(1) }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'all'
                    ? 'text-[#7C3AED]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All Users
              </button>
              <button
                ref={activeTabRef}
                onClick={() => { setStatusFilter('active'); setCurrentPage(1) }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'active'
                    ? 'text-[#7C3AED]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Active
              </button>
              <button
                ref={blockedTabRef}
                onClick={() => { setStatusFilter('blocked'); setCurrentPage(1) }}
                className={`px-6 py-4 text-sm font-medium transition-all duration-300 ease-out relative z-10 ${
                  statusFilter === 'blocked'
                    ? 'text-[#7C3AED]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Blocked
              </button>
              {/* Sliding indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-[#7C3AED] transition-all duration-300 ease-out"
                style={{
                  left: indicatorStyle.left,
                  width: indicatorStyle.width,
                }}
              />
            </div>
          </div>

          {/* Table with animation */}
          <div className="overflow-auto flex-1 min-h-0" key={statusFilter}>
            <table className="w-full animate-tabFadeIn">
              <thead>
                <tr className="bg-gray-50/50 transition-all duration-300">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Credentials</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Balance</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Coupons</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Join Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-[#7C3AED] animate-spin mb-2" />
                        <span className="text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      {searchQuery ? 'No matching users found' : 'No users found'}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 align-middle tab-row-animate"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {/* User Info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C3AED] to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {(user.realName || user.username).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{user.realName || user.username}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Credentials */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{user.username}</code>
                            <button onClick={() => copyToClipboard(user.username)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                              <Copy className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowPasswordId(showPasswordId === user.id ? null : user.id)}
                              className="flex items-center gap-1.5 group min-w-0"
                            >
                              <code
                                className={`text-xs font-medium px-2 py-0.5 rounded transition-all duration-300 ease-out ${
                                  showPasswordId === user.id && user.plaintextPassword
                                    ? 'text-gray-700 bg-gray-100'
                                    : showPasswordId === user.id && !user.plaintextPassword
                                    ? 'text-red-500 bg-red-50'
                                    : 'text-gray-400 bg-gray-100'
                                }`}
                              >
                                {showPasswordId === user.id
                                  ? (user.plaintextPassword || 'Not stored')
                                  : '••••••••'}
                              </code>
                              <span className="flex-shrink-0">
                                {showPasswordId === user.id ? (
                                  <EyeOff className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <Eye className="w-3 h-3 text-gray-400" />
                                )}
                              </span>
                            </button>
                            {showPasswordId === user.id && user.plaintextPassword && (
                              <button onClick={() => copyToClipboard(user.plaintextPassword!)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                                <Copy className="w-3 h-3 text-gray-400" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="py-4 px-4">
                        <p className="text-sm font-semibold text-[#52B788]">
                          ${Number(user.walletBalance || 0).toLocaleString()}
                        </p>
                      </td>

                      {/* Coupons */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] font-semibold text-sm">
                            <Ticket className="w-3.5 h-3.5" />
                            {user.couponBalance || 0}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleGiveCoupon(user, 'give')}
                              disabled={agentCoupons < 1}
                              className="p-1.5 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Give Coupon"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTakeCoupon(user)}
                              disabled={(user.couponBalance || 0) < 1}
                              className="p-1.5 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Take Back Coupon"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="py-4 px-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {getStatusBadge(user.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditUser(user)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7C3AED]/10 text-[#7C3AED] rounded-md text-xs font-medium hover:bg-[#7C3AED]/20 transition-colors whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {user.status === 'BLOCKED' ? (
                            <button
                              onClick={() => handleUnblockUser(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-600 rounded-md text-xs font-medium hover:bg-green-200 transition-colors whitespace-nowrap"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBlockUser(user)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 rounded-md text-xs font-medium hover:bg-red-200 transition-colors whitespace-nowrap"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Block
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Fixed at bottom */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-t border-gray-100 bg-white">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {totalPages <= 7 ? (
                Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-[#52B788] text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))
              ) : (
                <>
                  {[1, 2, 3].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-[#52B788] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
                  {[totalPages - 2, totalPages - 1, totalPages].map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-[#52B788] text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </>
              )}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? 'Edit User' : 'Add New User'}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto px-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#7C3AED]/10 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
              </div>
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.realName}
                  onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Username *</label>
                {isEditMode ? (
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{usernamePrefix}</span>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                      style={{ paddingLeft: `${usernamePrefix.length * 8 + 12}px` }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                  placeholder="email@example.com"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Password {!isEditMode && '*'}
                  {isEditMode && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!isEditMode}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                  placeholder={isEditMode ? "Enter new password to change" : "Enter password"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>
          </div>

          {/* Platform Fees - Compact Table Design */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#52B788]/10 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5 text-[#52B788]" />
              </div>
              Platform Rates
            </h3>

            {/* Table Header */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-600">Platform</div>
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-600 text-center">Opening Fee ($)</div>
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-600 text-center">Commission (%)</div>
                <div className="px-4 py-2.5 text-xs font-semibold text-gray-600 text-center">Unlimited ($)</div>
              </div>

              {/* Facebook Row - with Unlimited Domain Fee */}
              <div className="grid grid-cols-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">Facebook</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.facebook.openingFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, openingFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.fbFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.platformFees.facebook.depositFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, depositFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.fbCommission) || 0}`}
                      className="w-full h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.facebook.unlimitedDomainFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, facebook: { ...formData.platformFees.facebook, unlimitedDomainFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.fbUnlimitedDomainFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Google Row */}
              <div className="grid grid-cols-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">Google</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.google.openingFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, openingFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.googleFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.platformFees.google.depositFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, google: { ...formData.platformFees.google, depositFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.googleCommission) || 0}`}
                      className="w-full h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <span className="text-xs text-gray-300">—</span>
                </div>
              </div>

              {/* TikTok Row */}
              {/* TikTok Row */}
              <div className="grid grid-cols-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">TikTok</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.tiktok.openingFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, openingFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.tiktokFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.platformFees.tiktok.depositFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, tiktok: { ...formData.platformFees.tiktok, depositFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.tiktokCommission) || 0}`}
                      className="w-full h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <span className="text-xs text-gray-300">—</span>
                </div>
              </div>

              {/* Snapchat Row */}
              <div className="grid grid-cols-4 border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-.809-.329-1.24-.719-1.24-1.138 0-.389.283-.72.735-.838.209-.06.479-.09.657-.09.135 0 .3.015.449.09.376.18.735.285 1.049.301.181 0 .313-.045.387-.09-.008-.12-.016-.242-.026-.37l-.003-.051c-.104-1.612-.238-3.654.283-4.847C7.879 1.069 11.216.793 12.206.793z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">Snapchat</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.snapchat.openingFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, openingFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.snapchatFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.platformFees.snapchat.depositFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, snapchat: { ...formData.platformFees.snapchat, depositFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.snapchatCommission) || 0}`}
                      className="w-full h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <span className="text-xs text-gray-300">—</span>
                </div>
              </div>

              {/* Bing Row */}
              <div className="grid grid-cols-4 hover:bg-gray-50/50 transition-colors">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10.1 8.6L11.8 12.9L14.6 14.2L9 17.5V3.4L5 2V19.8L9 22L19 16.2V11.7L10.1 8.6Z"/>
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700">Bing</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input
                      type="number"
                      value={formData.platformFees.bing.openingFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, openingFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.bingFee) || 0}`}
                      className="w-full h-8 pl-6 pr-2 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <div className="relative w-full max-w-[100px]">
                    <input
                      type="number"
                      step="0.1"
                      value={formData.platformFees.bing.depositFee}
                      onChange={(e) => setFormData({
                        ...formData,
                        platformFees: { ...formData.platformFees, bing: { ...formData.platformFees.bing, depositFee: e.target.value } }
                      })}
                      placeholder={`${Number(agentUser?.bingCommission) || 0}`}
                      className="w-full h-8 pl-2 pr-6 rounded-lg border border-gray-200 text-xs text-center focus:border-[#7C3AED] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div className="px-3 py-2 flex items-center justify-center">
                  <span className="text-xs text-gray-300">—</span>
                </div>
              </div>
            </div>

            {/* Min Values Note */}
            <p className="text-[10px] text-gray-400 text-center">
              Placeholders show minimum rates. Values below minimum will show error on submit.
            </p>
          </div>

          {/* Remarks */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-gray-600">Personal Remarks</label>
            <textarea
              value={formData.personalRemarks}
              onChange={(e) => setFormData({ ...formData, personalRemarks: e.target.value })}
              placeholder="Add any notes about this user..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-5 h-10 rounded-lg bg-[#7C3AED] text-white text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {formLoading ? 'Saving...' : (selectedUser ? 'Update User' : 'Create User')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Block User Modal */}
      <Modal
        isOpen={isBlockModalOpen}
        onClose={() => {
          setIsBlockModalOpen(false)
          setUserToBlock(null)
          setBlockReason('')
        }}
        title="Block User"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldOff className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Are you sure you want to block this user?</p>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-semibold text-gray-700">{userToBlock?.username}</span> will not be able to login.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Enter reason for blocking this user..."
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:bg-white resize-none"
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xs text-amber-700">
              <span className="font-semibold">Note:</span> Blocked users will see a message to contact support when they try to login.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsBlockModalOpen(false)
                setUserToBlock(null)
                setBlockReason('')
              }}
              className="px-5 h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmBlockUser}
              disabled={blockLoading}
              className="px-5 h-10 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {blockLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  Block User
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Give/Take Coupon Modal */}
      <Modal
        isOpen={isCouponModalOpen}
        onClose={() => {
          setIsCouponModalOpen(false)
          setCouponUser(null)
          setCouponAmount(1)
          setCouponUserDropdownOpen(false)
          setCouponMode('give')
        }}
        title={couponMode === 'give' ? 'Give Coupons' : 'Take Back Coupons'}
      >
        <div className="space-y-5">
          {/* Agent's Coupons */}
          <div className={`flex items-center gap-4 p-4 rounded-xl ${couponMode === 'give' ? 'bg-[#7C3AED]/10' : 'bg-[#F59E0B]/10'}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              couponMode === 'give' ? 'bg-[#7C3AED]/20' : 'bg-[#F59E0B]/20'
            }`}>
              {couponMode === 'give' ? (
                <Ticket className="w-6 h-6 text-[#7C3AED]" />
              ) : (
                <Undo2 className="w-6 h-6 text-[#F59E0B]" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Available Coupons</p>
              <p className={`text-2xl font-bold ${couponMode === 'give' ? 'text-[#7C3AED]' : 'text-[#F59E0B]'}`}>
                {agentCoupons}
              </p>
            </div>
          </div>

          {/* Select User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select User</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCouponUserDropdownOpen(!couponUserDropdownOpen)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 text-sm text-left flex items-center justify-between hover:border-[#7C3AED]/30 transition-colors"
              >
                {couponUser ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                      {couponUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{couponUser.username}</p>
                      <p className="text-xs text-gray-500">{couponUser.couponBalance || 0} coupons</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">Choose a user...</span>
                )}
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${couponUserDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {couponUserDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setCouponUserDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-2 z-[70] bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto">
                    {(couponMode === 'take' ? users.filter(u => (u.couponBalance || 0) > 0) : users).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setCouponUser(user)
                          setCouponUserDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                          couponUser?.id === user.id ? 'bg-[#7C3AED]/5' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{user.username}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <span className="text-xs text-[#7C3AED] bg-[#7C3AED]/10 px-2 py-1 rounded-full">
                          {user.couponBalance || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Coupons</label>
            <input
              type="number"
              min="1"
              max={couponMode === 'give' ? agentCoupons : (couponUser?.couponBalance || 1)}
              value={couponAmount}
              onChange={(e) => {
                const max = couponMode === 'give' ? agentCoupons : (couponUser?.couponBalance || 1)
                setCouponAmount(Math.min(Math.max(1, parseInt(e.target.value) || 1), max))
              }}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-lg font-semibold text-center focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
            />
            {couponUser && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                {couponMode === 'give'
                  ? `${couponUser.username} will have ${(couponUser.couponBalance || 0) + couponAmount} coupons`
                  : `${couponUser.username} will have ${Math.max(0, (couponUser.couponBalance || 0) - couponAmount)} coupons`
                }
              </p>
            )}
          </div>

          {/* Quick Select */}
          <div className="flex gap-2">
            {[1, 5, 10, 25, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setCouponAmount(amt)}
                disabled={couponMode === 'give' ? amt > agentCoupons : amt > (couponUser?.couponBalance || 0)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  couponAmount === amt
                    ? couponMode === 'give' ? 'bg-[#7C3AED] text-white' : 'bg-[#F59E0B] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsCouponModalOpen(false)
                setCouponUser(null)
                setCouponAmount(1)
                setCouponMode('give')
              }}
              className="px-5 h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmCouponAction}
              disabled={
                couponLoading ||
                !couponUser ||
                couponAmount < 1 ||
                (couponMode === 'give' && couponAmount > agentCoupons) ||
                (couponMode === 'take' && couponAmount > (couponUser?.couponBalance || 0))
              }
              className={`px-5 h-10 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
                couponMode === 'give' ? 'bg-[#7C3AED] hover:bg-[#6D28D9]' : 'bg-[#F59E0B] hover:bg-[#D97706]'
              }`}
            >
              {couponLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {couponMode === 'give' ? <Ticket className="w-4 h-4" /> : <Undo2 className="w-4 h-4" />}
                  {couponMode === 'give' ? 'Give' : 'Take Back'} {couponAmount} Coupon{couponAmount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
