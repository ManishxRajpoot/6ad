'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { usersApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { useDateFilterStore } from '@/store/dateFilter'
import { Plus, Search, MoreVertical, ChevronDown, Eye, Edit, Trash2 } from 'lucide-react'

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
  agentId?: string
  agent?: {
    id: string
    username: string
    email: string
  }
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
      facebook: { openingFee: '', depositFee: '' },
      google: { openingFee: '', depositFee: '' },
      tiktok: { openingFee: '', depositFee: '' },
      snapchat: { openingFee: '', depositFee: '' },
      bing: { openingFee: '', depositFee: '' },
    }
  })

  const fetchData = async () => {
    try {
      const [usersData, agentsData] = await Promise.all([
        usersApi.getAll(),
        agentsApi.getAll(),
      ])
      console.log('=== FETCHED USERS DATA ===')
      console.log('First user:', usersData.users?.[0])
      console.log('First user commissions:', {
        fbCommission: usersData.users?.[0]?.fbCommission,
        googleCommission: usersData.users?.[0]?.googleCommission,
        plaintextPassword: usersData.users?.[0]?.plaintextPassword
      })
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
        facebook: { openingFee: '', depositFee: '' },
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
      agentId: user.agentId || '',
      status: user.status,
      personalRemarks: user.personalRemarks || '',
      platformFees: {
        facebook: {
          openingFee: user.fbFee?.toString() || '',
          depositFee: user.fbCommission?.toString() || ''
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
        googleFee: Number(formData.platformFees.google.openingFee) || 0,
        googleCommission: Number(formData.platformFees.google.depositFee) || 0,
        tiktokFee: Number(formData.platformFees.tiktok.openingFee) || 0,
        tiktokCommission: Number(formData.platformFees.tiktok.depositFee) || 0,
        snapchatFee: Number(formData.platformFees.snapchat.openingFee) || 0,
        snapchatCommission: Number(formData.platformFees.snapchat.depositFee) || 0,
        bingFee: Number(formData.platformFees.bing.openingFee) || 0,
        bingCommission: Number(formData.platformFees.bing.depositFee) || 0,
      }

      // Only include password if it's provided
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password
      }

      console.log('=== FRONTEND SUBMIT ===')
      console.log('Submitting payload:', payload)
      console.log('Commission values being sent:', {
        fbCommission: payload.fbCommission,
        googleCommission: payload.googleCommission,
        fbFee: payload.fbFee,
        googleFee: payload.googleFee
      })
      console.log('Is edit mode:', isEditMode)
      console.log('Selected user:', selectedUser)

      if (selectedUser) {
        const response = await usersApi.update(selectedUser.id, payload)
        console.log('=== UPDATE RESPONSE ===')
        console.log('Full response:', response)
        console.log('Returned user commissions:', {
          fbCommission: response.user?.fbCommission,
          googleCommission: response.user?.googleCommission,
          plaintextPassword: response.user?.plaintextPassword
        })
        toast.success('User Updated', `${formData.username} has been updated successfully`)
      } else {
        const response = await usersApi.create(payload)
        console.log('=== CREATE RESPONSE ===')
        console.log('Full response:', response)
        console.log('Created user commissions:', {
          fbCommission: response.user?.fbCommission,
          googleCommission: response.user?.googleCommission,
          plaintextPassword: response.user?.plaintextPassword
        })
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
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
                        <div className="flex items-center justify-center">
                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === user.id ? null : user.id)}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {activeDropdown === user.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-[60]"
                                  onClick={() => setActiveDropdown(null)}
                                />
                                <div className="absolute right-0 top-8 z-[70] w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <button
                                    onClick={() => handleEditUser(user)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit User
                                  </button>
                                  <div className="h-px bg-gray-100 my-1" />
                                  <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete User
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-center py-4 gap-1 border-t border-gray-100">
              {/* Previous Button */}
              {currentPage > 1 && (
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="px-3 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200 font-medium"
                >
                  ← Prev
                </button>
              )}

              {/* Page Numbers */}
              {(() => {
                const pages = []
                const maxVisiblePages = 5

                if (totalPages <= maxVisiblePages) {
                  // Show all pages if total is less than max visible
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  // Always show first page
                  pages.push(1)

                  if (currentPage > 3) {
                    pages.push('...')
                  }

                  // Show pages around current page
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

                  // Always show last page
                  if (!pages.includes(totalPages)) {
                    pages.push(totalPages)
                  }
                }

                return pages.map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="text-sm text-gray-500 px-1">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                        currentPage === page
                          ? 'bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/30 hover:bg-[#7C3AED]'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6]'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))
              })()}

              {/* Next Button */}
              {currentPage < totalPages && (
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="px-3 h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-[#8B5CF6]/30 hover:text-[#8B5CF6] hover:scale-105 active:scale-95 transition-all duration-200 font-medium"
                >
                  Next →
                </button>
              )}
            </div>
          )}

          {/* Show page info when there's data */}
          {filteredAndSortedUsers.length > 0 && (
            <div className="flex items-center justify-center py-2 text-xs text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
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
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>

            {/* Google */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Google</p>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>

            {/* TikTok */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">TikTok</p>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>

            {/* Snapchat */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Snapchat</p>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>

            {/* Bing */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-gray-700">Bing</p>
              <div className="grid grid-cols-2 gap-2">
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
    </DashboardLayout>
  )
}
