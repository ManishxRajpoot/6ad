'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, ChevronLeft, ChevronRight, Play, Loader2, Calendar } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { dashboardApi, accountsApi } from '@/lib/api'

// Platform color and icon mapping
const platformConfig: Record<string, { color: string; textColor?: string; icon: string; chartColor: string }> = {
  FACEBOOK: { color: '#1877F2', icon: 'f', chartColor: '#52B788' },
  GOOGLE: { color: '#4285F4', icon: 'G', chartColor: '#3B82F6' },
  TIKTOK: { color: '#000000', icon: 'T', chartColor: '#FF0050' },
  SNAPCHAT: { color: '#FFFC00', textColor: '#000', icon: 'S', chartColor: '#FFFC00' },
  BING: { color: '#00897B', icon: 'B', chartColor: '#00897B' },
}

// Platform Logo Components
const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
)

const SnapchatLogo = () => (
  <svg viewBox="0 0 500 500" className="w-4 h-4" fill="currentColor">
    <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
  </svg>
)

const BingLogo = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <defs>
      <linearGradient id="bingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#26B8F4"/>
        <stop offset="100%" stopColor="#1B48EF"/>
      </linearGradient>
    </defs>
    <path fill="url(#bingGradient)" d="M4.5 2L8 3.5V16.5L14 13L11.5 11.5L10 8L18 11.5V15.5L8 21L4.5 19V2Z"/>
  </svg>
)

export default function DashboardPage() {
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [adAccounts, setAdAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all')
  const [accountInsights, setAccountInsights] = useState<any[]>([])
  const [insightsTotals, setInsightsTotals] = useState<{
    impressions: number
    clicks: number
    spent: number
    results: number
    conversions: number
    cpc: number
    ctr: number
    cpr: number
    cpm: number
    cpa: number
  } | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [cheetahBalances, setCheetahBalances] = useState<Record<string, any>>({})
  const [datePreset, setDatePreset] = useState<'3d' | '7d' | '30d' | '90d' | '6mo' | 'custom'>('3d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [activeMetric, setActiveMetric] = useState<'cpr' | 'cpc' | 'ctr' | 'cpm'>('cpr')

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [data, accountsRes] = await Promise.all([
          dashboardApi.getStats(),
          accountsApi.getAll('FACEBOOK')
        ])
        setDashboardData(data)
        const accounts = accountsRes.accounts || []
        setAdAccounts(accounts)

        // Fetch Cheetah balances for all accounts
        if (accounts.length > 0) {
          const fbAccountIds = accounts.map((acc: any) => acc.accountId).filter(Boolean)
          if (fbAccountIds.length > 0) {
            try {
              const balancesRes = await accountsApi.getCheetahBalancesBatch(fbAccountIds)
              if (balancesRes.balances) {
                setCheetahBalances(balancesRes.balances)
                // Find first Cheetah account and select it
                const firstCheetahAccount = accounts.find((acc: any) => balancesRes.balances[acc.accountId]?.isCheetah)
                if (firstCheetahAccount) {
                  setSelectedAccountId(firstCheetahAccount.accountId)
                }
              }
            } catch {
              // Silently fail
            }
          }
        }
      } catch {
        // Silently fail - show empty state if API is unavailable
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  // Get Cheetah accounts list
  const cheetahAccounts = adAccounts.filter(acc => cheetahBalances[acc.accountId]?.isCheetah)

  // Get current date range
  const getDateRange = () => {
    if (datePreset === 'custom' && customStart && customEnd) return { start: customStart, end: customEnd }
    const end = new Date()
    const start = new Date()
    switch (datePreset) {
      case '3d': start.setDate(end.getDate() - 3); break
      case '7d': start.setDate(end.getDate() - 7); break
      case '30d': start.setDate(end.getDate() - 30); break
      case '90d': start.setDate(end.getDate() - 90); break
      case '6mo': default: start.setMonth(end.getMonth() - 6); break
    }
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }

  const dateRange = getDateRange()

  const metricColors: Record<string, string> = { cpr: '#EC4899', cpc: '#3B82F6', ctr: '#10B981', cpm: '#F97316' }
  const metricLabels: Record<string, string> = { cpr: 'Cost/Result', cpc: 'CPC', ctr: 'CTR', cpm: 'CPM' }

  // Fetch insights when selected account or date range changes
  useEffect(() => {
    let cancelled = false

    const normalizeInsights = (data: any): any[] => {
      if (!data) return []
      if (Array.isArray(data)) return data
      return [data]
    }

    const processDay = (d: any) => ({
      month: d.date_start || d.month || d.date || '',
      deposits: d.deposits || 0,
      spent: parseFloat(d.spend || d.spent || 0),
      impressions: parseInt(d.impressions || 0),
      clicks: parseInt(d.clicks || 0),
      results: parseInt(d.results || d.actions?.length || 0),
      cpc: parseFloat(d.cpc || 0),
      ctr: parseFloat(d.ctr || 0),
      cpm: parseFloat(d.cpm || 0),
      cpr: parseFloat(d.cost_per_result || d.cpr || 0),
    })

    const fetchInsights = async () => {
      if (cheetahAccounts.length === 0) {
        setAccountInsights([])
        setInsightsTotals(null)
        return
      }

      setInsightsLoading(true)

      // Determine if we should fetch daily or monthly data
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const useDaily = daysDiff <= 90

      console.log('[Reports Debug] selectedAccountId:', selectedAccountId, 'dateRange:', dateRange, 'daysDiff:', daysDiff, 'useDaily:', useDaily, 'cheetahAccounts:', cheetahAccounts.length)

      try {
        if (selectedAccountId === 'all') {
          if (useDaily) {
            // Fetch daily data for all accounts
            const allResults = await Promise.all(
              cheetahAccounts.map(acc =>
                accountsApi.getInsightsDateRange(acc.accountId, dateRange.start, dateRange.end).catch((err) => { console.log('[Reports Debug] getInsightsDateRange error for', acc.accountId, err); return null })
              )
            )
            console.log('[Reports Debug] allResults:', JSON.stringify(allResults?.map(r => ({ insights: r?.insights ? (Array.isArray(r.insights) ? `array(${r.insights.length})` : typeof r.insights) : null, error: r?.error }))))
            if (cancelled) return

            let totalSpent = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0
            const dailyAggregated: Record<string, any> = {}

            allResults.forEach(result => {
              const insights = normalizeInsights(result?.insights)
              insights.forEach((d: any) => {
                const day = processDay(d)
                totalSpent += day.spent
                totalImpressions += day.impressions
                totalClicks += day.clicks
                totalResults += day.results
                const key = day.month
                if (!dailyAggregated[key]) {
                  dailyAggregated[key] = { month: key, deposits: 0, spent: 0, impressions: 0, clicks: 0, results: 0, cpc: 0, ctr: 0, cpm: 0, cpr: 0 }
                }
                dailyAggregated[key].deposits += day.deposits
                dailyAggregated[key].spent += day.spent
                dailyAggregated[key].impressions += day.impressions
                dailyAggregated[key].clicks += day.clicks
                dailyAggregated[key].results += day.results
              })
            })

            // Calculate derived metrics for each aggregated day
            Object.values(dailyAggregated).forEach((day: any) => {
              day.cpc = day.clicks > 0 ? day.spent / day.clicks : 0
              day.ctr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0
              day.cpm = day.impressions > 0 ? (day.spent / day.impressions) * 1000 : 0
              day.cpr = day.results > 0 ? day.spent / day.results : 0
            })

            const cpr = totalResults > 0 ? parseFloat((totalSpent / totalResults).toFixed(2)) : 0
            setInsightsTotals({
              spent: totalSpent, impressions: totalImpressions, clicks: totalClicks, results: totalResults, conversions: 0,
              cpc: totalClicks > 0 ? parseFloat((totalSpent / totalClicks).toFixed(2)) : 0,
              ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
              cpr, cpm: totalImpressions > 0 ? parseFloat(((totalSpent / totalImpressions) * 1000).toFixed(2)) : 0,
              cpa: cpr
            })
            setAccountInsights(Object.values(dailyAggregated).sort((a: any, b: any) => a.month.localeCompare(b.month)))
          } else {
            // Fetch monthly data for all accounts
            const allResults = await Promise.all(
              cheetahAccounts.map(acc => accountsApi.getMonthlyInsights(acc.accountId).catch(() => null))
            )
            if (cancelled) return

            let totalSpent = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0
            const monthlyAggregated: Record<string, any> = {}

            allResults.forEach(result => {
              if (result?.totals) {
                totalSpent += result.totals.spent || 0
                totalImpressions += result.totals.impressions || 0
                totalClicks += result.totals.clicks || 0
                totalResults += result.totals.results || 0
              }
              if (result?.monthlyData) {
                result.monthlyData.forEach((m: any) => {
                  const key = `${m.month}-${m.year}`
                  if (!monthlyAggregated[key]) {
                    monthlyAggregated[key] = { month: m.month, year: m.year, deposits: 0, spent: 0 }
                  }
                  monthlyAggregated[key].deposits += m.deposits || 0
                  monthlyAggregated[key].spent += m.spent || 0
                })
              }
            })

            const cpr = totalResults > 0 ? parseFloat((totalSpent / totalResults).toFixed(2)) : 0
            setInsightsTotals({
              spent: totalSpent, impressions: totalImpressions, clicks: totalClicks, results: totalResults, conversions: 0,
              cpc: totalClicks > 0 ? parseFloat((totalSpent / totalClicks).toFixed(2)) : 0,
              ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
              cpr, cpm: totalImpressions > 0 ? parseFloat(((totalSpent / totalImpressions) * 1000).toFixed(2)) : 0,
              cpa: cpr
            })
            setAccountInsights(Object.values(monthlyAggregated))
          }
        } else {
          // Single account
          if (useDaily) {
            const result = await accountsApi.getInsightsDateRange(selectedAccountId, dateRange.start, dateRange.end)
            console.log('[Reports Debug] Single account result:', JSON.stringify({ insights: result?.insights ? (Array.isArray(result.insights) ? `array(${result.insights.length})` : typeof result.insights) : null, error: (result as any)?.error }))
            if (cancelled) return
            const insights = normalizeInsights(result?.insights)
            const processed = insights.map(processDay)
            console.log('[Reports Debug] Processed days:', processed.length, 'sample:', JSON.stringify(processed[0]))

            let totalSpent = 0, totalImpressions = 0, totalClicks = 0, totalResults = 0
            processed.forEach(d => {
              totalSpent += d.spent; totalImpressions += d.impressions; totalClicks += d.clicks; totalResults += d.results
            })

            const cpr = totalResults > 0 ? parseFloat((totalSpent / totalResults).toFixed(2)) : 0
            setInsightsTotals({
              spent: totalSpent, impressions: totalImpressions, clicks: totalClicks, results: totalResults, conversions: 0,
              cpc: totalClicks > 0 ? parseFloat((totalSpent / totalClicks).toFixed(2)) : 0,
              ctr: totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0,
              cpr, cpm: totalImpressions > 0 ? parseFloat(((totalSpent / totalImpressions) * 1000).toFixed(2)) : 0,
              cpa: cpr
            })
            setAccountInsights(processed)
          } else {
            const result = await accountsApi.getMonthlyInsights(selectedAccountId)
            if (cancelled) return
            if (result.monthlyData) setAccountInsights(result.monthlyData)
            if (result.totals) setInsightsTotals(result.totals)
          }
        }
      } catch (err) {
        console.error('[Reports Debug] Fetch error:', err)
        if (!cancelled) {
          setAccountInsights([])
          setInsightsTotals(null)
        }
      } finally {
        if (!cancelled) setInsightsLoading(false)
      }
    }
    fetchInsights()
    return () => { cancelled = true }
  }, [selectedAccountId, cheetahAccounts.length, datePreset, customStart, customEnd])

  // Calculate total spent from all platforms (totalDeposit represents money spent on ad accounts)
  const totalSpent = dashboardData?.accountsByPlatform?.reduce((sum: number, platform: any) => {
    return sum + (platform._sum?.totalDeposit || 0)
  }, 0) || 0

  // Calculate platform breakdown for donut chart
  const platformBreakdown = dashboardData?.accountsByPlatform?.map((platform: any) => ({
    name: platform.platform,
    amount: platform._sum?.totalDeposit || 0,
    count: platform._count || 0,
    color: platformConfig[platform.platform]?.chartColor || '#94A3B8'
  })).filter((p: any) => p.amount > 0) || []

  // Generate conic gradient stops for donut chart
  const generateConicGradient = () => {
    if (platformBreakdown.length === 0 || totalSpent === 0) {
      return 'conic-gradient(#E5E7EB 0deg 360deg)'
    }

    let currentAngle = 0
    const gradientStops: string[] = []

    platformBreakdown.forEach((platform: any) => {
      const percentage = platform.amount / totalSpent
      const degrees = percentage * 360
      gradientStops.push(`${platform.color} ${currentAngle}deg ${currentAngle + degrees}deg`)
      currentAngle += degrees
    })

    return `conic-gradient(${gradientStops.join(', ')})`
  }

  // Format number for display with full amount and commas (e.g., 82500 -> "$82,500.00")
  const formatAmount = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Platform accounts for Active Accounts Status section
  const platformAccounts = dashboardData?.accountsByPlatform?.map((platform: any) => ({
    name: platform.platform.charAt(0) + platform.platform.slice(1).toLowerCase(),
    accounts: platform._count || 0,
    color: platformConfig[platform.platform]?.color || '#94A3B8',
    textColor: platformConfig[platform.platform]?.textColor,
    icon: platformConfig[platform.platform]?.icon || platform.platform.charAt(0)
  })) || []

  return (
    <DashboardLayout title="Dashboard" subtitle="">
      <div className="h-full flex flex-col">
      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(-3deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(255,255,255,0.3), 0 0 30px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.2); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-float-delay-1 { animation: float 4s ease-in-out infinite 0.5s; }
        .animate-float-delay-2 { animation: float-reverse 5s ease-in-out infinite 1s; }
        .animate-float-delay-3 { animation: float 4.5s ease-in-out infinite 1.5s; }
        .animate-float-delay-4 { animation: float-reverse 5s ease-in-out infinite 0.3s; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 8s ease infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Overview Section Title */}
      <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Overview</h2>

      {/* Top Row - Welcome Banner and Circular Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Welcome Banner - Compact */}
        <div className="relative rounded-xl p-4 lg:p-5 text-white overflow-hidden min-h-[160px] bg-gradient-to-br from-[#52B788] via-[#40916C] to-[#2D6A4F] animate-gradient">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -right-16 -top-16 w-56 h-56 bg-white/5 rounded-full animate-spin-slow" />
            <div className="absolute -right-8 -bottom-24 w-48 h-48 bg-white/5 rounded-full" style={{ animationDuration: '25s' }} />
            <div className="absolute left-1/3 top-1/4 w-24 h-24 bg-white/5 rounded-full animate-pulse" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-full lg:max-w-[240px]">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/15 backdrop-blur-sm rounded-full text-[10px] font-medium mb-2">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              Ad Accounts Ready
            </div>
            <h2 className="text-xl lg:text-2xl font-bold mb-1.5 tracking-tight">Welcome Back!</h2>
            <p className="text-white/85 text-[11px] lg:text-xs leading-relaxed mb-3 lg:mb-4">
              Ready to scale? Get access to top-tier ad accounts built for serious marketers.
            </p>
            <button onClick={() => router.push('/guide')} className="group flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-300 hover:scale-105">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Play className="w-2.5 h-2.5 text-white fill-white ml-0.5" />
              </div>
              <span className="text-[11px] font-medium">Watch Tutorial</span>
            </button>
          </div>

          {/* Floating Platform Logos - Hidden on mobile */}
          <div className="absolute right-2 lg:right-6 top-0 bottom-0 w-[120px] lg:w-[180px] hidden sm:flex items-center justify-center">
            {/* Center glowing orb */}
            <div className="relative">
              <div className="w-16 lg:w-20 h-16 lg:h-20 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse-glow">
                <div className="w-11 lg:w-14 h-11 lg:h-14 bg-white rounded-full shadow-xl shadow-white/20 flex items-center justify-center">
                  <div className="w-8 lg:w-10 h-8 lg:h-10 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-full flex items-center justify-center shadow-lg shadow-purple-500/40">
                    <svg className="w-4 lg:w-5 h-4 lg:h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 w-16 lg:w-20 h-16 lg:h-20 border border-white/25 rounded-full animate-spin-slow" />
            </div>

            {/* TikTok - Top Left */}
            <div className="absolute top-2 lg:top-4 left-1 lg:left-2 animate-float">
              <div className="w-7 lg:w-9 h-7 lg:h-9 bg-black rounded-lg flex items-center justify-center shadow-lg shadow-black/30 hover:scale-110 transition-transform cursor-pointer">
                <TikTokLogo />
              </div>
            </div>

            {/* Google - Top Right */}
            <div className="absolute top-3 lg:top-6 right-0 animate-float-delay-1">
              <div className="w-6 lg:w-8 h-6 lg:h-8 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-black/10 hover:scale-110 transition-transform cursor-pointer">
                <GoogleLogo />
              </div>
            </div>

            {/* Facebook - Bottom Right */}
            <div className="absolute bottom-3 lg:bottom-6 right-0 lg:right-1 animate-float-delay-2">
              <div className="w-7 lg:w-9 h-7 lg:h-9 bg-[#1877F2] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30 hover:scale-110 transition-transform cursor-pointer">
                <FacebookLogo />
              </div>
            </div>

            {/* Snapchat - Bottom Left */}
            <div className="absolute bottom-1 lg:bottom-3 left-3 lg:left-6 animate-float-delay-3">
              <div className="w-6 lg:w-8 h-6 lg:h-8 bg-[#FFFC00] rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/30 hover:scale-110 transition-transform cursor-pointer">
                <span className="text-black"><SnapchatLogo /></span>
              </div>
            </div>

            {/* Bing - Middle Left */}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 animate-float-delay-4">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-black/10 hover:scale-110 transition-transform cursor-pointer">
                <BingLogo />
              </div>
            </div>
          </div>
        </div>

        {/* Spending Overview Card */}
        <Card data-tutorial="stats-section" className="p-4 lg:p-5 rounded-xl overflow-hidden relative bg-gradient-to-br from-white to-gray-50/50">
          {/* Animated background elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#52B788]/8 via-emerald-400/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 animate-pulse" style={{ animationDuration: '4s' }} />

          <div className="relative z-10 min-h-[160px] flex flex-col">
            {/* Header with Year selector */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-1.5">
                  <span className="w-1 h-4 bg-gradient-to-b from-[#52B788] to-emerald-400 rounded-full" />
                  Spending Overview
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5 ml-2.5">Track your platform ad spend</p>
              </div>
              <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="p-1.5 hover:bg-gray-50 transition-all duration-200 hover:text-[#52B788] border-r border-gray-100"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold text-[#1E293B] min-w-[50px] text-center px-1.5">{selectedYear}</span>
                <button
                  onClick={() => setSelectedYear(y => y + 1)}
                  disabled={selectedYear >= new Date().getFullYear()}
                  className="p-1.5 hover:bg-gray-50 transition-all duration-200 hover:text-[#52B788] border-l border-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-6 w-full">
                  <div className="w-[100px] h-[100px] lg:w-[120px] lg:h-[120px] rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-100 animate-spin" style={{ animationDuration: '3s', borderTopColor: '#52B788' }} />
                    <Loader2 className="w-6 h-6 text-[#52B788] animate-spin" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="h-10 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg animate-pulse" />
                    <div className="h-10 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg animate-pulse" />
                  </div>
                </div>
              ) : selectedYear !== new Date().getFullYear() || totalSpent === 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 lg:gap-6 w-full">
                  <div className="w-[100px] h-[100px] lg:w-[120px] lg:h-[120px] rounded-full flex items-center justify-center flex-shrink-0 relative">
                    <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '20s' }} viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="55" fill="none" stroke="#E5E7EB" strokeWidth="5" strokeDasharray="12 8" />
                    </svg>
                    <div className="w-[75px] h-[75px] lg:w-[95px] lg:h-[95px] bg-gradient-to-br from-gray-50 to-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      {selectedYear !== new Date().getFullYear() ? (
                        <>
                          <svg className="w-8 h-8 text-gray-300 mb-0.5 animate-bounce" style={{ animationDuration: '2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm font-bold text-gray-400">{selectedYear}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl font-bold text-gray-300">$0</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">No Spend</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600">
                            {selectedYear !== new Date().getFullYear() ? `No data for ${selectedYear}` : 'No spending yet'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {selectedYear !== new Date().getFullYear() ? 'Historical data unavailable' : 'Start advertising to track'}
                          </p>
                        </div>
                      </div>
                      {selectedYear !== new Date().getFullYear() && (
                        <button
                          onClick={() => setSelectedYear(new Date().getFullYear())}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#52B788] to-emerald-500 text-white rounded-lg text-[11px] font-medium hover:shadow-md transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          View {new Date().getFullYear()}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch gap-4 lg:gap-6 w-full">
                  {/* Animated Donut Chart - Left Side */}
                  <div className="relative flex-shrink-0 flex items-center justify-center">
                    <div className="relative group">
                      <div className="absolute -inset-3 bg-gradient-to-r from-[#52B788]/20 via-emerald-400/10 to-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div
                        className="w-[100px] h-[100px] lg:w-[120px] lg:h-[120px] rounded-full relative transition-transform duration-500 group-hover:scale-105"
                        style={{
                          background: generateConicGradient(),
                          boxShadow: '0 8px 30px rgba(82, 183, 136, 0.2), inset 0 2px 4px rgba(255,255,255,0.5)'
                        }}
                      >
                        <div className="absolute inset-[10px] lg:inset-[12px] bg-gradient-to-br from-white to-gray-50 rounded-full flex flex-col items-center justify-center shadow-inner">
                          <span className="text-sm lg:text-base font-bold text-[#1E293B] transition-all duration-300 group-hover:scale-110">{formatAmount(totalSpent)}</span>
                          <span className="text-[7px] lg:text-[8px] text-gray-400 uppercase tracking-widest font-medium">Total Spent</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Platform breakdown list - Right Side with Progress Bars */}
                  <div className="flex-1 flex flex-col justify-center space-y-2">
                    {platformBreakdown.length > 0 ? (
                      platformBreakdown.map((platform: any) => {
                        const percentage = totalSpent > 0 ? ((platform.amount / totalSpent) * 100) : 0
                        const platformKey = platform.name.toUpperCase()
                        return (
                          <div key={platform.name} className="group/item">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-300 group-hover/item:scale-110 ${
                                    platformKey === 'GOOGLE' || platformKey === 'BING' ? 'bg-white border border-gray-200' : ''
                                  }`}
                                  style={{
                                    backgroundColor: platformKey === 'GOOGLE' || platformKey === 'BING' ? undefined : platform.color,
                                    boxShadow: `0 2px 8px ${platform.color}40`
                                  }}
                                >
                                  {platformKey === 'FACEBOOK' && (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                    </svg>
                                  )}
                                  {platformKey === 'GOOGLE' && (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                  )}
                                  {platformKey === 'TIKTOK' && (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                                    </svg>
                                  )}
                                  {platformKey === 'SNAPCHAT' && (
                                    <svg viewBox="0 0 500 500" className="w-4 h-4" fill="black">
                                      <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
                                    </svg>
                                  )}
                                  {platformKey === 'BING' && (
                                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                                      <defs>
                                        <linearGradient id="bingGradientSpending" x1="0%" y1="0%" x2="0%" y2="100%">
                                          <stop offset="0%" stopColor="#26B8F4"/>
                                          <stop offset="100%" stopColor="#1B48EF"/>
                                        </linearGradient>
                                      </defs>
                                      <path fill="url(#bingGradientSpending)" d="M4.5 2L8 3.5V16.5L14 13L11.5 11.5L10 8L18 11.5V15.5L8 21L4.5 19V2Z"/>
                                    </svg>
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-gray-700">
                                  {platform.name.charAt(0) + platform.name.slice(1).toLowerCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-[#1E293B]">{formatAmount(platform.amount)}</span>
                                <span className="text-sm font-bold text-gray-500 tabular-nums w-12 text-right">{percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                            {/* Progress Bar */}
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: platform.color,
                                  boxShadow: `0 0 8px ${platform.color}60`
                                }}
                              />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-400">No platform data available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Create Deposit Banner - Compact */}
      <div data-tutorial="balance-card" className="border-2 border-dashed border-purple-400 rounded-lg p-3 lg:p-4 mb-4 bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1E293B]">Create Deposit in your Wallet Balance</h3>
            <p className="text-[11px] text-gray-500">Click on add and create a deposit in your wallet</p>
          </div>
          <Link href="/deposits" className="flex-shrink-0">
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-4 py-2 text-[11px] rounded-lg">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Money
            </Button>
          </Link>
        </div>
      </div>

      {/* Reports & Analytics - Full Width Redesigned */}
      <Card className="p-4 lg:p-5 rounded-xl flex flex-col bg-white mb-4">
        {/* Header Row with Account Selector & Date Range */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-0.5 h-5 bg-[#52B788] rounded-full" />
              <h3 className="text-sm font-semibold text-[#1E293B]">Reports & Analytics</h3>
            </div>
            {/* Date Range Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['3d', '7d', '30d', '90d', '6mo'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setDatePreset(p)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    datePreset === p ? 'bg-[#52B788] text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {p === '3d' ? '3D' : p === '7d' ? '7D' : p === '30d' ? '30D' : p === '90d' ? '90D' : '6M'}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <Calendar className="w-3 h-3 text-gray-400" />
                <input type="date" value={datePreset === 'custom' ? customStart : dateRange.start}
                  onChange={(e) => { setDatePreset('custom'); setCustomStart(e.target.value) }}
                  className="px-1.5 py-1 border border-gray-200 rounded text-[10px] text-gray-600 focus:outline-none focus:border-[#52B788] w-[100px]" />
                <span className="text-[10px] text-gray-400">-</span>
                <input type="date" value={datePreset === 'custom' ? customEnd : dateRange.end}
                  onChange={(e) => { setDatePreset('custom'); setCustomEnd(e.target.value) }}
                  className="px-1.5 py-1 border border-gray-200 rounded text-[10px] text-gray-600 focus:outline-none focus:border-[#52B788] w-[100px]" />
              </div>
            </div>
          </div>

          {/* Account Selector */}
          {cheetahAccounts.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
              <button onClick={() => setSelectedAccountId('all')}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
                  selectedAccountId === 'all' ? 'bg-[#8B5CF6] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>All</button>
              {cheetahAccounts.map((acc) => (
                <button key={acc.accountId} onClick={() => setSelectedAccountId(acc.accountId)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
                    selectedAccountId === acc.accountId ? 'bg-[#8B5CF6] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}>{acc.accountName || acc.accountId}</button>
              ))}
            </div>
          )}
        </div>

        {/* KPI Metrics Row */}
        {insightsTotals && !insightsLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
            {[
              { label: 'Spent', value: `$${insightsTotals.spent.toLocaleString(undefined, {maximumFractionDigits: 0})}` },
              { label: 'Impressions', value: insightsTotals.impressions >= 1000000 ? `${(insightsTotals.impressions/1000000).toFixed(1)}M` : insightsTotals.impressions >= 1000 ? `${(insightsTotals.impressions/1000).toFixed(1)}K` : insightsTotals.impressions.toLocaleString() },
              { label: 'Clicks', value: insightsTotals.clicks >= 1000000 ? `${(insightsTotals.clicks/1000000).toFixed(1)}M` : insightsTotals.clicks >= 1000 ? `${(insightsTotals.clicks/1000).toFixed(1)}K` : insightsTotals.clicks.toLocaleString() },
              { label: 'Results', value: insightsTotals.results >= 1000000 ? `${(insightsTotals.results/1000000).toFixed(1)}M` : insightsTotals.results >= 1000 ? `${(insightsTotals.results/1000).toFixed(1)}K` : insightsTotals.results.toLocaleString() },
              { label: 'Cost/Result', value: `$${insightsTotals.cpr.toFixed(2)}` },
              { label: 'CPC', value: `$${insightsTotals.cpc.toFixed(2)}` },
              { label: 'CTR', value: `${insightsTotals.ctr.toFixed(2)}%` },
              { label: 'CPM', value: `$${insightsTotals.cpm.toFixed(2)}` },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <p className="text-[9px] text-gray-400 uppercase mb-1">{kpi.label}</p>
                <p className="text-sm font-bold text-[#1E293B]">{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts Row - Spend/Deposits + Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[240px]">
          {/* Spend & Deposits Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Spend & Deposits</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#52B788]" /><span className="text-[9px] text-gray-400">Deposits</span></div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3B82F6]" /><span className="text-[9px] text-gray-400">Spent</span></div>
              </div>
            </div>
            <div className="h-[220px]">
              {loading || insightsLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-[#52B788] animate-spin" /></div>
              ) : cheetahAccounts.length === 0 || accountInsights.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <p className="text-[10px] text-gray-400">{cheetahAccounts.length === 0 ? 'No ad accounts' : 'No data for range'}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={accountInsights} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#52B788" stopOpacity={0.25} /><stop offset="95%" stopColor="#52B788" stopOpacity={0} /></linearGradient>
                      <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9 }} dy={5} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} width={40} />
                    <Tooltip formatter={(value: number, name: string) => [`$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, name === 'deposits' ? 'Deposits' : 'Spent']}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '11px' }}
                      labelStyle={{ color: '#9CA3AF', marginBottom: '4px', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="deposits" stroke="#52B788" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" dot={{ r: 4, fill: '#52B788', strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="spent" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Performance Metrics Chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Performance</span>
              <div className="flex items-center gap-1">
                {(['cpr', 'cpc', 'ctr', 'cpm'] as const).map(m => (
                  <button key={m} onClick={() => setActiveMetric(m)}
                    className={`px-2 py-0.5 rounded text-[9px] font-medium transition-all ${activeMetric === m ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    style={activeMetric === m ? { backgroundColor: metricColors[m] } : {}}
                  >{metricLabels[m]}</button>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              {loading || insightsLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 text-[#52B788] animate-spin" /></div>
              ) : accountInsights.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <svg className="w-8 h-8 text-gray-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  <p className="text-[10px] text-gray-400">No performance data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accountInsights} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9 }} dy={5} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 9 }}
                      tickFormatter={(v) => activeMetric === 'ctr' ? `${v}%` : `$${v}`} width={40} />
                    <Tooltip formatter={(value: number) => [activeMetric === 'ctr' ? `${value.toFixed(2)}%` : `$${value.toFixed(2)}`, metricLabels[activeMetric]]}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '6px', color: '#fff', padding: '6px 10px', fontSize: '11px' }}
                      labelStyle={{ color: '#9CA3AF', marginBottom: '4px', fontSize: '10px' }} />
                    <Line type="monotone" dataKey={activeMetric} stroke={metricColors[activeMetric]} strokeWidth={2.5} dot={{ r: 4, fill: metricColors[activeMetric], strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Active Accounts Status */}
      <Card data-tutorial="recent-activity" className="p-4 rounded-lg flex flex-col">
        <h3 className="text-sm font-semibold text-[#1E293B] mb-3">Active Accounts Status</h3>
          <div className="space-y-2 flex-1">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-200 animate-pulse" />
                      <div>
                        <div className="h-2.5 w-14 bg-gray-200 rounded animate-pulse mb-1" />
                        <div className="h-2 w-10 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : platformAccounts.length > 0 ? (
              platformAccounts.map((platform: any) => {
                const platformKey = platform.name.toUpperCase()
                return (
                  <Link
                    key={platform.name}
                    href={`/${platform.name.toLowerCase()}`}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:from-gray-100 hover:to-gray-50 transition-all duration-300 group border border-gray-100 hover:border-gray-200 hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 ${
                        platformKey === 'FACEBOOK' ? 'bg-[#1877F2] shadow-blue-500/30' :
                        platformKey === 'GOOGLE' ? 'bg-white border border-gray-200 shadow-gray-200/50' :
                        platformKey === 'TIKTOK' ? 'bg-black shadow-black/30' :
                        platformKey === 'SNAPCHAT' ? 'bg-[#FFFC00] shadow-yellow-500/30' :
                        platformKey === 'BING' ? 'bg-white border border-gray-200 shadow-gray-200/50' :
                        'bg-gray-200'
                      }`}>
                        {platformKey === 'FACEBOOK' && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {platformKey === 'GOOGLE' && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {platformKey === 'TIKTOK' && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                          </svg>
                        )}
                        {platformKey === 'SNAPCHAT' && (
                          <svg viewBox="0 0 500 500" className="w-5 h-5" fill="black">
                            <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
                          </svg>
                        )}
                        {platformKey === 'BING' && (
                          <svg viewBox="0 0 24 24" className="w-5 h-5">
                            <defs>
                              <linearGradient id="bingGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#26B8F4"/>
                                <stop offset="100%" stopColor="#1B48EF"/>
                              </linearGradient>
                            </defs>
                            <path fill="url(#bingGradient2)" d="M4.5 2L8 3.5V16.5L14 13L11.5 11.5L10 8L18 11.5V15.5L8 21L4.5 19V2Z"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[#1E293B] group-hover:text-[#52B788] transition-colors">{platform.name}</h4>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-[#52B788]">{platform.accounts}</span>
                          <span className="text-xs text-gray-500">Account{platform.accounts !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#52B788] group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="text-center py-8 text-gray-400 flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No accounts yet</p>
                <p className="text-xs mt-1 text-gray-400">Apply for your first ad account</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
