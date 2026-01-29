'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Sparkles,
  Facebook,
  Plus,
  Play,
  Pause,
  Target,
  ArrowRight,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings,
  Eye,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Building2,
  Layers,
  FileText,
  Image,
  BarChart3,
  TrendingUp,
  Search,
  Filter,
  Download,
  Copy,
  Trash2,
  MoreHorizontal,
  Calendar,
  X,
  Edit3,
  ToggleLeft,
  ToggleRight,
  ArrowUpDown,
  Check,
  AlertTriangle,
  Clock,
  DollarSign,
  Users,
  MousePointer,
  Percent,
  Activity
} from 'lucide-react'

// Facebook OAuth URL builder
const getFacebookOAuthUrl = () => {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  // Use current window origin for redirect URI (works in both dev and production)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ads.6ad.in'
  const redirectUri = encodeURIComponent(`${baseUrl}/ai-campaigns`)
  const scope = encodeURIComponent('ads_management,ads_read,business_management')
  const state = Math.random().toString(36).substring(7)

  if (typeof window !== 'undefined') {
    localStorage.setItem('fb_oauth_state', state)
  }

  return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`
}

// Types
interface FacebookProfile {
  id: string
  facebookUserId: string
  name: string
  email?: string
  isValid: boolean
  adAccountCount?: number
  accountCount?: number
  tokenExpiresAt?: string
  createdAt: string
  error?: string
  accessToken?: string
}

interface AdAccount {
  id: string
  accountId: string
  name: string
  status: string
  statusCode: number
  amountSpent: number
  balance: number
  currency: string
  businessName?: string
  disableReason?: number
  createdTime?: string
  // Profile info for multi-profile support
  profileId?: string
  profileName?: string
  profileFbId?: string
}

interface Campaign {
  id: string
  name: string
  status: string
  effectiveStatus: string
  objective: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  budgetRemaining: number | null
  createdTime: string
  updatedTime: string
  // Metrics
  reach: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  spend: number
  frequency: number
  results: number
  resultType: string | null
  costPerResult: number
}

interface AdSet {
  id: string
  name: string
  status: string
  effectiveStatus: string
  dailyBudget: number | null
  lifetimeBudget: number | null
  budgetRemaining: number | null
  billingEvent?: string
  optimizationGoal?: string
  createdTime: string
  updatedTime: string
  // Metrics
  reach: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  spend: number
  frequency: number
  results: number
  resultType: string | null
  costPerResult: number
}

interface Ad {
  id: string
  name: string
  status: string
  effectiveStatus: string
  createdTime: string
  updatedTime: string
  previewLink?: string
  thumbnailUrl?: string | null
  // Metrics
  reach: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  spend: number
  frequency: number
  results: number
  resultType: string | null
  costPerResult: number
}

interface FacebookUser {
  id: string
  name: string
  email?: string
}

interface AccountInsights {
  reach: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  spend: number
  frequency: number
}

// Date preset options
const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_14d', label: 'Last 14 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'maximum', label: 'Lifetime' },
]

export default function AICampaignsPage() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [fbUser, setFbUser] = useState<FacebookUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Multi-profile state
  const [fbProfiles, setFbProfiles] = useState<FacebookProfile[]>([])
  const [showProfilesPanel, setShowProfilesPanel] = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [currentProfileToken, setCurrentProfileToken] = useState<string | null>(null)

  // Data state
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [adSets, setAdSets] = useState<AdSet[]>([])
  const [ads, setAds] = useState<Ad[]>([])
  const [accountInsights, setAccountInsights] = useState<AccountInsights | null>(null)

  // Selection state
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([])
  const [selectedAdSets, setSelectedAdSets] = useState<string[]>([])
  const [selectedAds, setSelectedAds] = useState<string[]>([])
  const [expandedCampaigns, setExpandedCampaigns] = useState<string[]>([])
  const [expandedAdSets, setExpandedAdSets] = useState<string[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [loadingAdSets, setLoadingAdSets] = useState<string | null>(null)
  const [loadingAds, setLoadingAds] = useState<string | null>(null)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns')
  const [datePreset, setDatePreset] = useState('last_7d')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [sortColumn, setSortColumn] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dateDropdownRef = useRef<HTMLDivElement>(null)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  // Get selected account data
  const selectedAccountData = adAccounts.find(acc => acc.id === selectedAccount)
  const accountCurrency = selectedAccountData?.currency || 'USD'

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(event.target as Node)) {
        setShowDateDropdown(false)
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target as Node)) {
        setShowStatusFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Format currency
  const formatCurrency = (amount: number | null, currencyCode?: string) => {
    if (amount === null || amount === undefined) return '-'
    const currency = currencyCode || accountCurrency
    const currencySymbols: { [key: string]: string } = {
      'USD': '$', 'INR': '₹', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CNY': '¥',
      'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'HKD': 'HK$', 'MYR': 'RM',
      'PHP': '₱', 'THB': '฿', 'IDR': 'Rp', 'VND': '₫', 'KRW': '₩',
      'BRL': 'R$', 'MXN': 'MX$', 'AED': 'د.إ', 'SAR': '﷼',
    }
    const symbol = currencySymbols[currency] || currency + ' '
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Format number with abbreviation
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  // Format percentage
  const formatPercent = (num: number) => {
    return num.toFixed(2) + '%'
  }

  // API Functions

  // Fetch all connected Facebook profiles
  const fetchFbProfiles = async () => {
    const authToken = localStorage.getItem('token')
    if (!authToken) return []

    setLoadingProfiles(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/profiles`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setFbProfiles(data.profiles || [])
        return data.profiles || []
      }
    } catch (err) {
      console.error('Error fetching FB profiles:', err)
    } finally {
      setLoadingProfiles(false)
    }
    return []
  }

  // Fetch all ad accounts from all connected profiles
  const fetchAllAdAccounts = async () => {
    // Check if user is authenticated first
    const authToken = localStorage.getItem('token')
    if (!authToken) {
      console.log('No auth token found, skipping profile fetch')
      return null
    }

    setLoadingAccounts(true)
    setError(null)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/all-ad-accounts`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // If unauthorized, don't throw - just return null and let fallback handle it
        if (response.status === 401) {
          console.log('User not authenticated for profile fetch')
          return null
        }
        throw new Error(errorData.error || 'Failed to fetch ad accounts')
      }

      const data = await response.json()
      setFbProfiles(data.profiles || [])
      setAdAccounts(data.adAccounts || [])

      // Set first user as current
      if (data.profiles?.length > 0) {
        setFbUser({ id: data.profiles[0].facebookUserId, name: data.profiles[0].name })
      }

      // Auto-select first account if none selected
      if (data.adAccounts?.length > 0 && !selectedAccount) {
        setSelectedAccount(data.adAccounts[0].id)
        // Get token for this profile
        if (data.adAccounts[0].profileId) {
          await fetchProfileToken(data.adAccounts[0].profileId)
        }
      }

      return data
    } catch (err: any) {
      console.error('Error fetching all ad accounts:', err)
      // Don't set error for network failures - just return null
      // This allows fallback to localStorage token
      return null
    } finally {
      setLoadingAccounts(false)
    }
  }

  // Get access token for a specific profile
  const fetchProfileToken = async (profileId: string) => {
    const authToken = localStorage.getItem('token')
    if (!authToken) return null

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/profile-token/${profileId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentProfileToken(data.accessToken)
        localStorage.setItem('fb_access_token', data.accessToken)
        return data.accessToken
      }
    } catch (err) {
      console.error('Error fetching profile token:', err)
    }
    return null
  }

  // Disconnect a Facebook profile
  const disconnectProfile = async (profileId: string) => {
    const authToken = localStorage.getItem('token')
    if (!authToken) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        // Refresh all data
        await fetchAllAdAccounts()
      }
    } catch (err) {
      console.error('Error disconnecting profile:', err)
    }
  }

  const fetchAdAccounts = async (token: string) => {
    setLoadingAccounts(true)
    setError(null)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/ad-accounts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Facebook-Token': token
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.code === 190) {
          localStorage.removeItem('fb_access_token')
          setIsConnected(false)
          setError('Facebook session expired. Please reconnect.')
          return
        }
        throw new Error(errorData.error || 'Failed to fetch ad accounts')
      }

      const data = await response.json()
      setFbUser(data.user)
      setAdAccounts(data.adAccounts)

      if (data.adAccounts.length > 0 && !selectedAccount) {
        setSelectedAccount(data.adAccounts[0].id)
      }
    } catch (err: any) {
      console.error('Error fetching ad accounts:', err)
      setError(err.message || 'Failed to load ad accounts')
    } finally {
      setLoadingAccounts(false)
    }
  }

  const fetchCampaigns = async (accountId: string, token: string) => {
    setLoadingCampaigns(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/facebook/campaigns/${accountId}?date_preset=${datePreset}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Facebook-Token': token
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch campaigns')
      }

      const data = await response.json()
      setCampaigns(data.campaigns)
    } catch (err: any) {
      console.error('Error fetching campaigns:', err)
      setCampaigns([])
    } finally {
      setLoadingCampaigns(false)
    }
  }

  const fetchAdSets = async (campaignId: string, token: string) => {
    setLoadingAdSets(campaignId)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/facebook/adsets/${campaignId}?date_preset=${datePreset}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Facebook-Token': token
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch ad sets')
      }

      const data = await response.json()
      setAdSets(prev => {
        const filtered = prev.filter(a => !data.adSets.some((n: AdSet) => n.id === a.id))
        return [...filtered, ...data.adSets]
      })
    } catch (err: any) {
      console.error('Error fetching ad sets:', err)
    } finally {
      setLoadingAdSets(null)
    }
  }

  const fetchAds = async (adSetId: string, token: string) => {
    setLoadingAds(adSetId)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/facebook/ads/${adSetId}?date_preset=${datePreset}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Facebook-Token': token
          }
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch ads')
      }

      const data = await response.json()
      setAds(prev => {
        const filtered = prev.filter(a => !data.ads.some((n: Ad) => n.id === a.id))
        return [...filtered, ...data.ads]
      })
    } catch (err: any) {
      console.error('Error fetching ads:', err)
    } finally {
      setLoadingAds(null)
    }
  }

  const fetchAccountInsights = async (accountId: string, token: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/facebook/account-insights/${accountId}?date_preset=${datePreset}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Facebook-Token': token
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setAccountInsights(data)
      }
    } catch (err) {
      console.error('Error fetching account insights:', err)
    }
  }

  const updateStatus = async (type: 'campaigns' | 'adsets' | 'ads', id: string, status: string) => {
    const token = localStorage.getItem('fb_access_token')
    if (!token) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/facebook/${type}/${id}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Facebook-Token': token
          },
          body: JSON.stringify({ status })
        }
      )

      if (response.ok) {
        // Refresh data
        if (selectedAccount) {
          fetchCampaigns(selectedAccount, token)
        }
      }
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const exchangeCodeForToken = async (code: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/facebook/exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ code })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('fb_access_token', data.accessToken)
        return data.accessToken
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to exchange token')
      }
    } catch (err: any) {
      console.error('Token exchange error:', err)
      setError(err.message || 'Failed to connect to Facebook')
      return null
    }
  }

  // Initial load
  useEffect(() => {
    const checkConnection = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      // Handle both 'fb_code' (from callback page) and 'code' (direct from Facebook OAuth)
      const fbCode = urlParams.get('fb_code') || urlParams.get('code')

      if (fbCode) {
        window.history.replaceState({}, '', '/ai-campaigns')
        setLoading(true)
        const token = await exchangeCodeForToken(fbCode)
        if (token) {
          setIsConnected(true)
          // After connecting a new profile, fetch all accounts
          await fetchAllAdAccounts()
        }
        setLoading(false)
        return
      }

      // Check if we have any connected profiles
      setLoading(true)

      try {
        const data = await fetchAllAdAccounts()

        if (data?.profiles?.length > 0) {
          setIsConnected(true)
        } else {
          // Fallback to localStorage token for backward compatibility
          const fbToken = localStorage.getItem('fb_access_token')
          if (fbToken && !fbToken.startsWith('demo_')) {
            setIsConnected(true)
            await fetchAdAccounts(fbToken)
          }
        }
      } catch (err) {
        // If API fails, try localStorage fallback
        const fbToken = localStorage.getItem('fb_access_token')
        if (fbToken && !fbToken.startsWith('demo_')) {
          setIsConnected(true)
          await fetchAdAccounts(fbToken)
        }
      }
      setLoading(false)
    }
    checkConnection()
  }, [])

  // Fetch campaigns when account or date changes
  useEffect(() => {
    const loadCampaignsForAccount = async () => {
      if (selectedAccount && isConnected) {
        // Get the profile for this account
        const account = adAccounts.find(a => a.id === selectedAccount)
        let fbToken = localStorage.getItem('fb_access_token')

        // If account has a profileId, get that profile's token
        if (account?.profileId) {
          const token = await fetchProfileToken(account.profileId)
          if (token) {
            fbToken = token
          }
        }

        if (fbToken) {
          fetchCampaigns(selectedAccount, fbToken)
          fetchAccountInsights(selectedAccount, fbToken)
          // Clear nested data
          setAdSets([])
          setAds([])
          setExpandedCampaigns([])
          setExpandedAdSets([])
        }
      }
    }
    loadCampaignsForAccount()
  }, [selectedAccount, isConnected, datePreset])

  // Toggle campaign expansion
  const toggleCampaignExpand = async (campaignId: string) => {
    const isExpanded = expandedCampaigns.includes(campaignId)
    if (isExpanded) {
      setExpandedCampaigns(prev => prev.filter(id => id !== campaignId))
    } else {
      setExpandedCampaigns(prev => [...prev, campaignId])
      const fbToken = localStorage.getItem('fb_access_token')
      if (fbToken) {
        await fetchAdSets(campaignId, fbToken)
      }
    }
  }

  // Toggle ad set expansion
  const toggleAdSetExpand = async (adSetId: string) => {
    const isExpanded = expandedAdSets.includes(adSetId)
    if (isExpanded) {
      setExpandedAdSets(prev => prev.filter(id => id !== adSetId))
    } else {
      setExpandedAdSets(prev => [...prev, adSetId])
      const fbToken = localStorage.getItem('fb_access_token')
      if (fbToken) {
        await fetchAds(adSetId, fbToken)
      }
    }
  }

  // Handlers
  const handleConnectFacebook = () => {
    setIsConnecting(true)
    window.location.href = getFacebookOAuthUrl()
  }

  const handleDisconnect = () => {
    localStorage.removeItem('fb_access_token')
    setIsConnected(false)
    setAdAccounts([])
    setCampaigns([])
    setAdSets([])
    setAds([])
    setFbUser(null)
    setSelectedAccount(null)
    setError(null)
  }

  const handleRefresh = async () => {
    const fbToken = localStorage.getItem('fb_access_token')
    if (fbToken && selectedAccount) {
      await fetchCampaigns(selectedAccount, fbToken)
      await fetchAccountInsights(selectedAccount, fbToken)
    }
  }

  // Select all in current view
  const handleSelectAll = (type: 'campaigns' | 'adsets' | 'ads', items: any[]) => {
    const ids = items.map(i => i.id)
    if (type === 'campaigns') {
      setSelectedCampaigns(prev => prev.length === ids.length ? [] : ids)
    } else if (type === 'adsets') {
      setSelectedAdSets(prev => prev.length === ids.length ? [] : ids)
    } else {
      setSelectedAds(prev => prev.length === ids.length ? [] : ids)
    }
  }

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.effectiveStatus === statusFilter || c.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-700'
      case 'PAUSED': return 'bg-yellow-100 text-yellow-700'
      case 'DELETED': case 'ARCHIVED': return 'bg-gray-100 text-gray-500'
      case 'PENDING_REVIEW': case 'IN_PROCESS': return 'bg-blue-100 text-blue-700'
      case 'DISAPPROVED': case 'WITH_ISSUES': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  // Loading state
  if (loading) {
    return (
      <DashboardLayout title="Ads Manager" subtitle="Manage your Facebook ad campaigns">
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  // Not connected state
  if (!isConnected) {
    return (
      <DashboardLayout title="Ads Manager" subtitle="Manage your Facebook ad campaigns">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 mb-6 bg-gradient-to-br from-[#1877F2]/5 via-blue-50/50 to-white border-2 border-dashed border-[#1877F2]/30 rounded-2xl">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#1877F2] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Facebook className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[#1E293B] mb-3">
                Connect to Facebook Ads Manager
              </h2>
              <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                Connect your Facebook account to manage your ad campaigns, view performance metrics, and optimize your advertising.
              </p>
              <Button
                onClick={handleConnectFacebook}
                disabled={isConnecting}
                className="bg-[#1877F2] hover:bg-[#1565D8] text-white px-8 py-3 rounded-xl text-base font-medium shadow-lg shadow-blue-500/30"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Facebook className="w-5 h-5 mr-2" />
                    Connect Facebook Account
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Ads Manager" subtitle="Manage your Facebook ad campaigns">
      <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden -mx-6 -mt-4">
        {/* Top Bar - Account & Date Selector */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            {/* Account Dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-6 h-6 bg-[#1877F2] rounded flex items-center justify-center">
                  <Facebook className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-medium text-sm text-[#1E293B] max-w-[200px] truncate">
                  {selectedAccountData?.name || 'Select Account'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAccountDropdown && (
                <div className="absolute z-50 top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[500px] overflow-y-auto">
                  <div className="p-2">
                    {/* Group accounts by profile */}
                    {fbProfiles.length > 0 ? (
                      <>
                        {fbProfiles.map((profile) => {
                          const profileAccounts = adAccounts.filter(a => a.profileId === profile.id)
                          if (profileAccounts.length === 0) return null

                          return (
                            <div key={profile.id} className="mb-3">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-[#1877F2] rounded-full flex items-center justify-center">
                                    <Facebook className="w-3 h-3 text-white" />
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">{profile.name}</span>
                                  {!profile.isValid && (
                                    <span className="text-xs text-red-500">(Token Expired)</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400">{profileAccounts.length} accounts</span>
                              </div>
                              {profileAccounts.map((account) => (
                                <button
                                  key={account.id}
                                  onClick={() => {
                                    setSelectedAccount(account.id)
                                    setShowAccountDropdown(false)
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ml-2 ${
                                    selectedAccount === account.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="w-7 h-7 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-3.5 h-3.5 text-gray-500" />
                                  </div>
                                  <div className="flex-1 text-left min-w-0">
                                    <p className="font-medium text-[#1E293B] text-sm truncate">{account.name}</p>
                                    <p className="text-xs text-gray-500">{account.accountId}</p>
                                  </div>
                                  <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(account.status)}`}>
                                    {account.status}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <>
                        <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Ad Accounts ({adAccounts.length})</p>
                        {adAccounts.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => {
                              setSelectedAccount(account.id)
                              setShowAccountDropdown(false)
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                              selectedAccount === account.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="w-8 h-8 bg-[#1877F2] rounded flex items-center justify-center flex-shrink-0">
                              <Facebook className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-[#1E293B] text-sm truncate">{account.name}</p>
                              <p className="text-xs text-gray-500">{account.accountId}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(account.status)}`}>
                              {account.status}
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Manage Profiles Button */}
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button
                        onClick={() => {
                          setShowAccountDropdown(false)
                          setShowProfilesPanel(true)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1877F2] hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Facebook Profiles ({fbProfiles.length})
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="w-px h-6 bg-gray-200" />

            {/* Connected Profiles Info */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowProfilesPanel(true)}
                className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-sm text-gray-600">
                  {fbProfiles.length > 1
                    ? `${fbProfiles.length} Profiles Connected`
                    : fbUser?.name || 'Connected'
                  }
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-3">
            <div ref={dateDropdownRef} className="relative">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-[#1E293B]">
                  {DATE_PRESETS.find(d => d.value === datePreset)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDateDropdown && (
                <div className="absolute z-50 top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-1">
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => {
                          setDatePreset(preset.value)
                          setShowDateDropdown(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                          datePreset === preset.value ? 'bg-blue-50 text-[#1877F2]' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={loadingCampaigns}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loadingCampaigns ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metrics Summary Bar */}
        {accountInsights && (
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-6 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Spent</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatCurrency(accountInsights.spend)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Reach</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatNumber(accountInsights.reach)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Impressions</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatNumber(accountInsights.impressions)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">Clicks</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatNumber(accountInsights.clicks)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">CTR</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatPercent(accountInsights.ctr)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">CPC</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatCurrency(accountInsights.cpc)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">CPM</span>
              <span className="font-semibold text-sm text-[#1E293B]">{formatCurrency(accountInsights.cpm)}</span>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-64 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2]"
              />
            </div>

            {/* Status Filter */}
            <div ref={statusFilterRef} className="relative">
              <button
                onClick={() => setShowStatusFilter(!showStatusFilter)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                  statusFilter !== 'all' ? 'border-[#1877F2] bg-blue-50 text-[#1877F2]' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Status
                {statusFilter !== 'all' && <span className="font-medium">: {statusFilter}</span>}
              </button>

              {showStatusFilter && (
                <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-1">
                    {['all', 'ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status)
                          setShowStatusFilter(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                          statusFilter === status ? 'bg-blue-50 text-[#1877F2]' : 'hover:bg-gray-50'
                        }`}
                      >
                        {status === 'all' ? 'All Statuses' : status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Actions */}
            {selectedCampaigns.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
                <span className="text-xs text-gray-600 mr-2">{selectedCampaigns.length} selected</span>
                <button
                  onClick={() => selectedCampaigns.forEach(id => updateStatus('campaigns', id, 'ACTIVE'))}
                  className="p-1 hover:bg-white rounded transition-colors"
                  title="Activate"
                >
                  <Play className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={() => selectedCampaigns.forEach(id => updateStatus('campaigns', id, 'PAUSED'))}
                  className="p-1 hover:bg-white rounded transition-colors"
                  title="Pause"
                >
                  <Pause className="w-4 h-4 text-yellow-600" />
                </button>
                <button className="p-1 hover:bg-white rounded transition-colors" title="Duplicate">
                  <Copy className="w-4 h-4 text-gray-500" />
                </button>
                <button className="p-1 hover:bg-white rounded transition-colors" title="Export">
                  <Download className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}

            <Button className="bg-[#1877F2] hover:bg-[#1565D8] text-white px-4 py-1.5 text-sm">
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-[1200px]">
            {/* Table Header */}
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedCampaigns.length === filteredCampaigns.length && filteredCampaigns.length > 0}
                    onChange={() => handleSelectAll('campaigns', filteredCampaigns)}
                    className="w-4 h-4 rounded border-gray-300 text-[#1877F2] focus:ring-[#1877F2]"
                  />
                </th>
                <th className="w-10 px-2 py-3"></th>
                <th className="w-12 px-2 py-3">On/Off</th>
                <th className="px-4 py-3 min-w-[250px]">Name</th>
                <th className="px-4 py-3 text-center">Delivery</th>
                <th className="px-4 py-3 text-right">Budget</th>
                <th className="px-4 py-3 text-right">Spent</th>
                <th className="px-4 py-3 text-right">Results</th>
                <th className="px-4 py-3 text-right">Cost per Result</th>
                <th className="px-4 py-3 text-right">Reach</th>
                <th className="px-4 py-3 text-right">Impressions</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">CPC</th>
                <th className="px-4 py-3 text-right">CPM</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-100">
              {loadingCampaigns ? (
                <tr>
                  <td colSpan={16} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-[#1877F2] animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading campaigns...</p>
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Layers className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-[#1E293B] mb-1">No campaigns found</h4>
                    <p className="text-sm text-gray-500">
                      {searchQuery ? 'Try adjusting your search' : 'Create your first campaign to get started'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => {
                  const isExpanded = expandedCampaigns.includes(campaign.id)
                  const isSelected = selectedCampaigns.includes(campaign.id)
                  const campaignAdSets = adSets.filter(a =>
                    // This would need campaign_id on adsets, for now show all loaded
                    expandedCampaigns.includes(campaign.id)
                  )
                  const isActive = campaign.effectiveStatus === 'ACTIVE'

                  return (
                    <React.Fragment key={campaign.id}>
                      {/* Campaign Row */}
                      <tr
                        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedCampaigns(prev =>
                                isSelected ? prev.filter(id => id !== campaign.id) : [...prev, campaign.id]
                              )
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-[#1877F2] focus:ring-[#1877F2]"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => toggleCampaignExpand(campaign.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {loadingAdSets === campaign.id ? (
                              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            ) : (
                              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            )}
                          </button>
                        </td>
                        <td className="px-2 py-3">
                          <button
                            onClick={() => updateStatus('campaigns', campaign.id, isActive ? 'PAUSED' : 'ACTIVE')}
                            className={`w-9 h-5 rounded-full transition-colors relative ${
                              isActive ? 'bg-[#1877F2]' : 'bg-gray-300'
                            }`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              isActive ? 'right-0.5' : 'left-0.5'
                            }`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#1877F2] flex-shrink-0" />
                            <div>
                              <p className="font-medium text-[#1E293B] text-sm">{campaign.name}</p>
                              <p className="text-xs text-gray-400">{campaign.objective?.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(campaign.effectiveStatus)}`}>
                            {campaign.effectiveStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatCurrency(campaign.dailyBudget || campaign.lifetimeBudget)}
                          <span className="text-xs text-gray-400 block">
                            {campaign.dailyBudget ? '/day' : campaign.lifetimeBudget ? 'lifetime' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(campaign.spend)}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          {campaign.results > 0 ? (
                            <div>
                              <span className="font-medium">{formatNumber(campaign.results)}</span>
                              <span className="text-xs text-gray-400 block">{campaign.resultType?.replace(/_/g, ' ').replace('onsite conversion.', '')}</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {campaign.costPerResult > 0 ? formatCurrency(campaign.costPerResult) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{formatNumber(campaign.reach)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatNumber(campaign.impressions)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatNumber(campaign.clicks)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatPercent(campaign.ctr)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(campaign.cpc)}</td>
                        <td className="px-4 py-3 text-right text-sm">{formatCurrency(campaign.cpm)}</td>
                        <td className="px-4 py-3">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                            <MoreHorizontal className="w-4 h-4 text-gray-400" />
                          </button>
                        </td>
                      </tr>

                      {/* Ad Sets under Campaign */}
                      {isExpanded && adSets.filter(() => isExpanded).map((adSet) => {
                        const adSetExpanded = expandedAdSets.includes(adSet.id)
                        const adSetActive = adSet.effectiveStatus === 'ACTIVE'

                        return (
                          <React.Fragment key={adSet.id}>
                            <tr
                              className="bg-gray-50/50 hover:bg-gray-100/50 transition-colors"
                            >
                              <td className="px-4 py-2"></td>
                              <td className="px-2 py-2 pl-6">
                                <button
                                  onClick={() => toggleAdSetExpand(adSet.id)}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  {loadingAds === adSet.id ? (
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                  ) : (
                                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${adSetExpanded ? 'rotate-90' : ''}`} />
                                  )}
                                </button>
                              </td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => updateStatus('adsets', adSet.id, adSetActive ? 'PAUSED' : 'ACTIVE')}
                                  className={`w-8 h-4 rounded-full transition-colors relative ${
                                    adSetActive ? 'bg-[#1877F2]' : 'bg-gray-300'
                                  }`}
                                >
                                  <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                                    adSetActive ? 'right-0.5' : 'left-0.5'
                                  }`} />
                                </button>
                              </td>
                              <td className="px-4 py-2 pl-8">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                  <div>
                                    <p className="font-medium text-[#1E293B] text-sm">{adSet.name}</p>
                                    <p className="text-xs text-gray-400">{adSet.optimizationGoal?.replace(/_/g, ' ')}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(adSet.effectiveStatus)}`}>
                                  {adSet.effectiveStatus}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-sm">{formatCurrency(adSet.dailyBudget || adSet.lifetimeBudget)}</td>
                              <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(adSet.spend)}</td>
                              <td className="px-4 py-2 text-right text-sm">{adSet.results > 0 ? formatNumber(adSet.results) : '-'}</td>
                              <td className="px-4 py-2 text-right text-sm">{adSet.costPerResult > 0 ? formatCurrency(adSet.costPerResult) : '-'}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatNumber(adSet.reach)}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatNumber(adSet.impressions)}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatNumber(adSet.clicks)}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatPercent(adSet.ctr)}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatCurrency(adSet.cpc)}</td>
                              <td className="px-4 py-2 text-right text-sm">{formatCurrency(adSet.cpm)}</td>
                              <td className="px-4 py-2">
                                <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                </button>
                              </td>
                            </tr>

                            {/* Ads under Ad Set */}
                            {adSetExpanded && ads.map((ad) => {
                              const adActive = ad.effectiveStatus === 'ACTIVE'

                              return (
                                <tr
                                  key={`ad-${ad.id}`}
                                  className="bg-gray-100/30 hover:bg-gray-100/50 transition-colors"
                                >
                                  <td className="px-4 py-2"></td>
                                  <td className="px-2 py-2 pl-10"></td>
                                  <td className="px-2 py-2">
                                    <button
                                      onClick={() => updateStatus('ads', ad.id, adActive ? 'PAUSED' : 'ACTIVE')}
                                      className={`w-8 h-4 rounded-full transition-colors relative ${
                                        adActive ? 'bg-[#1877F2]' : 'bg-gray-300'
                                      }`}
                                    >
                                      <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                                        adActive ? 'right-0.5' : 'left-0.5'
                                      }`} />
                                    </button>
                                  </td>
                                  <td className="px-4 py-2 pl-12">
                                    <div className="flex items-center gap-2 group relative">
                                      {/* Ad Thumbnail with hover preview */}
                                      <div className="relative">
                                        {ad.thumbnailUrl ? (
                                          <img
                                            src={ad.thumbnailUrl}
                                            alt={ad.name}
                                            className="w-8 h-8 rounded object-cover border border-gray-200 cursor-pointer"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 rounded bg-pink-50 flex items-center justify-center border border-pink-100">
                                            <Image className="w-4 h-4 text-pink-500" />
                                          </div>
                                        )}
                                        {/* Hover Preview Popup */}
                                        {ad.thumbnailUrl && (
                                          <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
                                            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-72">
                                              <img
                                                src={ad.thumbnailUrl}
                                                alt={ad.name}
                                                className="w-full h-auto rounded-lg"
                                              />
                                              <div className="mt-2 pt-2 border-t border-gray-100">
                                                <p className="font-medium text-sm text-[#1E293B] truncate">{ad.name}</p>
                                                <p className="text-xs text-gray-400 mt-1">ID: {ad.id}</p>
                                                {ad.previewLink && (
                                                  <a
                                                    href={ad.previewLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 inline-flex items-center gap-1 text-xs text-[#1877F2] hover:underline"
                                                  >
                                                    <Eye className="w-3 h-3" />
                                                    View Full Preview
                                                  </a>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium text-[#1E293B] text-sm">{ad.name}</p>
                                        <p className="text-xs text-gray-400">ID: {ad.id}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(ad.effectiveStatus)}`}>
                                      {ad.effectiveStatus}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right text-sm">-</td>
                                  <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(ad.spend)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{ad.results > 0 ? formatNumber(ad.results) : '-'}</td>
                                  <td className="px-4 py-2 text-right text-sm">{ad.costPerResult > 0 ? formatCurrency(ad.costPerResult) : '-'}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatNumber(ad.reach)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatNumber(ad.impressions)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatNumber(ad.clicks)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatPercent(ad.ctr)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatCurrency(ad.cpc)}</td>
                                  <td className="px-4 py-2 text-right text-sm">{formatCurrency(ad.cpm)}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-1">
                                      {ad.previewLink && (
                                        <a
                                          href={ad.previewLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                                        >
                                          <Eye className="w-4 h-4 text-gray-400" />
                                        </a>
                                      )}
                                      <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Stats */}
        <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
          <span>{filteredCampaigns.length} campaigns</span>
          <span>Total Spend: {formatCurrency(campaigns.reduce((sum, c) => sum + c.spend, 0))}</span>
        </div>

        {/* Profiles Management Modal */}
        {showProfilesPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1877F2] rounded-xl flex items-center justify-center">
                    <Facebook className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1E293B]">Connected Facebook Profiles</h2>
                    <p className="text-sm text-gray-500">Manage your connected Facebook accounts</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfilesPanel(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                {loadingProfiles ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#1877F2] animate-spin" />
                  </div>
                ) : fbProfiles.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Facebook className="w-8 h-8 text-gray-400" />
                    </div>
                    <h4 className="font-medium text-[#1E293B] mb-1">No profiles connected</h4>
                    <p className="text-sm text-gray-500 mb-4">Connect your first Facebook profile to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fbProfiles.map((profile) => {
                      const profileAccounts = adAccounts.filter(a => a.profileId === profile.id)
                      return (
                        <div
                          key={profile.id}
                          className={`p-4 border rounded-xl transition-colors ${
                            profile.isValid ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                profile.isValid ? 'bg-[#1877F2]' : 'bg-red-400'
                              }`}>
                                <Facebook className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-[#1E293B]">{profile.name}</h4>
                                  {profile.isValid ? (
                                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Connected
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> Token Expired
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {profile.email || `FB ID: ${profile.facebookUserId}`}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {profileAccounts.length} ad account{profileAccounts.length !== 1 ? 's' : ''} • Connected {new Date(profile.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!profile.isValid && (
                                <Button
                                  onClick={handleConnectFacebook}
                                  className="bg-[#1877F2] hover:bg-[#1565D8] text-white px-3 py-1.5 text-sm"
                                >
                                  Reconnect
                                </Button>
                              )}
                              <button
                                onClick={() => disconnectProfile(profile.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Disconnect profile"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Show ad accounts for this profile */}
                          {profileAccounts.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">AD ACCOUNTS</p>
                              <div className="grid grid-cols-2 gap-2">
                                {profileAccounts.slice(0, 4).map((account) => (
                                  <div key={account.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-[#1E293B] truncate">{account.name}</p>
                                      <p className="text-xs text-gray-400">{account.currency}</p>
                                    </div>
                                  </div>
                                ))}
                                {profileAccounts.length > 4 && (
                                  <div className="flex items-center justify-center p-2 bg-gray-50 rounded-lg">
                                    <span className="text-xs text-gray-500">+{profileAccounts.length - 4} more</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {fbProfiles.length} profile{fbProfiles.length !== 1 ? 's' : ''} connected • {adAccounts.length} total ad accounts
                  </div>
                  <Button
                    onClick={() => {
                      setShowProfilesPanel(false)
                      handleConnectFacebook()
                    }}
                    className="bg-[#1877F2] hover:bg-[#1565D8] text-white px-4 py-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Connect Another Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
