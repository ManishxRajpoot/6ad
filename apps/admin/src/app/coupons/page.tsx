'use client'

import { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Modal } from '@/components/ui/Modal'
import { usersApi, agentsApi } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { Ticket, Search, Users, UserCog, ChevronDown, Plus, Minus } from 'lucide-react'

type User = {
  id: string
  username: string
  email: string
  realName?: string | null
  couponBalance?: number
  role?: string
}

type Agent = {
  id: string
  username: string
  email: string
  couponBalance?: number
}

export default function CouponsPage() {
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<'user' | 'agent'>('user')
  const [selectedTarget, setSelectedTarget] = useState<User | Agent | null>(null)
  const [couponAmount, setCouponAmount] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [couponAction, setCouponAction] = useState<'add' | 'remove'>('add')

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

  const handleOpenModal = (action: 'add' | 'remove' = 'add') => {
    setSelectedType('user')
    setSelectedTarget(null)
    setCouponAmount(1)
    setSearchQuery('')
    setCouponAction(action)
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedTarget) {
      toast.warning('Selection Required', 'Please select a user or agent')
      return
    }

    if (couponAmount < 1) {
      toast.warning('Invalid Amount', 'Please enter a valid coupon amount')
      return
    }

    // For remove action, check if target has enough coupons
    if (couponAction === 'remove' && (selectedTarget as any).couponBalance < couponAmount) {
      toast.error('Insufficient Coupons', `${selectedTarget.username} only has ${(selectedTarget as any).couponBalance || 0} coupon(s)`)
      return
    }

    setFormLoading(true)
    try {
      if (couponAction === 'add') {
        if (selectedType === 'agent') {
          await agentsApi.addCoupons(selectedTarget.id, couponAmount)
        } else {
          await usersApi.addCoupons(selectedTarget.id, couponAmount)
        }
        toast.success(
          'Coupons Added',
          `Successfully added ${couponAmount} coupon(s) to ${selectedTarget.username}`
        )
      } else {
        if (selectedType === 'agent') {
          await agentsApi.removeCoupons(selectedTarget.id, couponAmount)
        } else {
          await usersApi.removeCoupons(selectedTarget.id, couponAmount)
        }
        toast.success(
          'Coupons Removed',
          `Successfully removed ${couponAmount} coupon(s) from ${selectedTarget.username}`
        )
      }
      setIsModalOpen(false)
      fetchData()
    } catch (error: any) {
      toast.error(`Failed to ${couponAction} coupons`, error.message || 'An error occurred')
    } finally {
      setFormLoading(false)
    }
  }

  // Filter list based on search and type
  const filteredList = selectedType === 'user'
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.realName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents.filter(a =>
        a.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.email.toLowerCase().includes(searchQuery.toLowerCase())
      )

  // Calculate totals
  const totalUserCoupons = users.reduce((sum, u) => sum + (u.couponBalance || 0), 0)
  const totalAgentCoupons = agents.reduce((sum, a) => sum + (a.couponBalance || 0), 0)

  return (
    <DashboardLayout title="Coupon Management">
      {/* Header with Stats */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6366F1] flex items-center justify-center shadow-lg">
              <Ticket className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Coupon Distribution</h2>
              <p className="text-sm text-gray-500">Manage and distribute coupons to users and agents</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenModal('remove')}
              className="h-10 px-5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg shadow-red-500/30"
            >
              <Minus className="h-4 w-4" />
              Remove Coupons
            </button>
            <button
              onClick={() => handleOpenModal('add')}
              className="h-10 px-5 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-2 shadow-lg shadow-purple-500/30"
            >
              <Plus className="h-4 w-4" />
              Give Coupons
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="bg-gradient-to-br from-[#8B5CF6]/5 to-[#6366F1]/5 rounded-xl p-4 border border-[#8B5CF6]/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
                <Ticket className="h-4 w-4 text-[#8B5CF6]" />
              </div>
              <span className="text-sm font-medium text-gray-600">Total Distributed</span>
            </div>
            <p className="text-2xl font-bold text-[#8B5CF6]">{(totalUserCoupons + totalAgentCoupons).toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-[#52B788]/5 to-[#2D5F5D]/5 rounded-xl p-4 border border-[#52B788]/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#52B788]/10 flex items-center justify-center">
                <UserCog className="h-4 w-4 text-[#52B788]" />
              </div>
              <span className="text-sm font-medium text-gray-600">Agent Coupons</span>
            </div>
            <p className="text-2xl font-bold text-[#52B788]">{totalAgentCoupons.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-[#3B82F6]/5 to-[#2563EB]/5 rounded-xl p-4 border border-[#3B82F6]/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-[#3B82F6]" />
              </div>
              <span className="text-sm font-medium text-gray-600">User Coupons</span>
            </div>
            <p className="text-2xl font-bold text-[#3B82F6]">{totalUserCoupons.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Agents List with Coupons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <UserCog className="h-5 w-5 text-[#52B788]" />
          <h3 className="font-semibold text-gray-900">Agents Coupon Balance</h3>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Coupons</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agents.slice(0, 5).map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#52B788] to-[#2D5F5D] flex items-center justify-center text-white text-sm font-semibold">
                          {agent.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{agent.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{agent.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#52B788]/10 text-[#52B788] font-semibold text-sm">
                        <Ticket className="h-3.5 w-3.5" />
                        {agent.couponBalance || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('agent')
                            setSelectedTarget(agent)
                            setCouponAmount(1)
                            setCouponAction('add')
                            setIsModalOpen(true)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-medium hover:bg-[#8B5CF6]/20 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setSelectedType('agent')
                            setSelectedTarget(agent)
                            setCouponAmount(1)
                            setCouponAction('remove')
                            setIsModalOpen(true)
                          }}
                          disabled={(agent.couponBalance || 0) < 1}
                          className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users List with Coupons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <Users className="h-5 w-5 text-[#3B82F6]" />
          <h3 className="font-semibold text-gray-900">Users Coupon Balance</h3>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#8B5CF6] border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Coupons</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.slice(0, 10).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center text-white text-sm font-semibold">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">{user.username}</span>
                          {user.realName && (
                            <p className="text-xs text-gray-500">{user.realName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#3B82F6]/10 text-[#3B82F6] font-semibold text-sm">
                        <Ticket className="h-3.5 w-3.5" />
                        {user.couponBalance || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedType('user')
                            setSelectedTarget(user)
                            setCouponAmount(1)
                            setCouponAction('add')
                            setIsModalOpen(true)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs font-medium hover:bg-[#8B5CF6]/20 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setSelectedType('user')
                            setSelectedTarget(user)
                            setCouponAmount(1)
                            setCouponAction('remove')
                            setIsModalOpen(true)
                          }}
                          disabled={(user.couponBalance || 0) < 1}
                          className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Give/Remove Coupons Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={couponAction === 'add' ? 'Give Coupons' : 'Remove Coupons'}
      >
        <div className="space-y-5">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setSelectedType('user')
                  setSelectedTarget(null)
                  setSearchQuery('')
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  selectedType === 'user'
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 text-[#8B5CF6]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Users className="h-5 w-5" />
                <span className="font-medium">User</span>
              </button>
              <button
                onClick={() => {
                  setSelectedType('agent')
                  setSelectedTarget(null)
                  setSearchQuery('')
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  selectedType === 'agent'
                    ? 'border-[#8B5CF6] bg-[#8B5CF6]/5 text-[#8B5CF6]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <UserCog className="h-5 w-5" />
                <span className="font-medium">Agent</span>
              </button>
            </div>
          </div>

          {/* Select Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select {selectedType === 'user' ? 'User' : 'Agent'}
            </label>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 text-left hover:border-[#8B5CF6]/50 transition-colors"
              >
                {selectedTarget ? (
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                      selectedType === 'user'
                        ? 'bg-gradient-to-br from-[#3B82F6] to-[#2563EB]'
                        : 'bg-gradient-to-br from-[#52B788] to-[#2D5F5D]'
                    }`}>
                      {selectedTarget.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedTarget.username}</p>
                      <p className="text-xs text-gray-500">{selectedTarget.email}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">Select a {selectedType}...</span>
                )}
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-2 z-[70] bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-64">
                    {/* Search */}
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder={`Search ${selectedType}s...`}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 text-sm focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
                        />
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-48 overflow-y-auto">
                      {filteredList.length > 0 ? (
                        filteredList.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedTarget(item)
                              setIsDropdownOpen(false)
                            }}
                            className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left ${
                              selectedTarget?.id === item.id ? 'bg-[#8B5CF6]/5' : ''
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${
                              selectedType === 'user'
                                ? 'bg-gradient-to-br from-[#3B82F6] to-[#2563EB]'
                                : 'bg-gradient-to-br from-[#52B788] to-[#2D5F5D]'
                            }`}>
                              {item.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.username}</p>
                              <p className="text-xs text-gray-500 truncate">{item.email}</p>
                            </div>
                            <span className="text-xs text-gray-400">
                              {(item as any).couponBalance || 0} coupons
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No {selectedType}s found
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Coupon Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Coupons</label>
            <input
              type="number"
              min={1}
              value={couponAmount}
              onChange={(e) => setCouponAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 text-lg font-semibold text-center focus:border-[#8B5CF6] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/20"
            />
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {[5, 10, 25, 50, 100].map((amount) => (
              <button
                key={amount}
                onClick={() => setCouponAmount(amount)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  couponAmount === amount
                    ? 'bg-[#8B5CF6] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {amount}
              </button>
            ))}
          </div>

          {/* Selected Info */}
          {selectedTarget && (
            <div className={`p-4 rounded-xl ${couponAction === 'add' ? 'bg-gray-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Balance:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {(selectedTarget as any).couponBalance || 0} coupons
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">
                  {couponAction === 'add' ? 'After Adding:' : 'After Removing:'}
                </span>
                <span className={`text-sm font-bold ${couponAction === 'add' ? 'text-[#8B5CF6]' : 'text-red-600'}`}>
                  {couponAction === 'add'
                    ? ((selectedTarget as any).couponBalance || 0) + couponAmount
                    : Math.max(0, ((selectedTarget as any).couponBalance || 0) - couponAmount)
                  } coupons
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-5 h-10 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={formLoading || !selectedTarget || (couponAction === 'remove' && (selectedTarget as any)?.couponBalance < couponAmount)}
              className={`px-5 h-10 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
                couponAction === 'add'
                  ? 'bg-[#8B5CF6] hover:bg-[#7C3AED]'
                  : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {formLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {couponAction === 'add' ? 'Adding...' : 'Removing...'}
                </>
              ) : (
                <>
                  {couponAction === 'add' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                  {couponAction === 'add' ? 'Give' : 'Remove'} {couponAmount} Coupon{couponAmount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
