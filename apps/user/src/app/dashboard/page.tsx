'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'
import { dashboardApi } from '@/lib/api'

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
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
  </svg>
)

const SnapchatLogo = () => (
  <svg viewBox="0 0 500 500" className="w-5 h-5" fill="currentColor">
    <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
  </svg>
)

const BingLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const data = await dashboardApi.getStats()
        setDashboardData(data)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

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

  // Format number for display (e.g., 2283870 -> "2.28M" or "2,283.87k")
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`
    }
    return `$${amount.toFixed(2)}`
  }

  // Generate reports chart data from recent activity
  const generateReportsData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const currentMonth = new Date().getMonth()

    // Get last 7 months
    const data: { name: string; balance: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12
      data.push({ name: months[monthIndex], balance: 0 })
    }

    // Aggregate wallet flows by month if available
    if (dashboardData?.recentActivity) {
      dashboardData.recentActivity.forEach((activity: any) => {
        const activityDate = new Date(activity.createdAt)
        const activityMonth = months[activityDate.getMonth()]
        const monthData = data.find(d => d.name === activityMonth)
        if (monthData && activity.type === 'DEPOSIT') {
          monthData.balance += Number(activity.amount) || 0
        }
      })
    }

    // If no data, use cumulative total as last month
    if (data.every(d => d.balance === 0) && totalSpent > 0) {
      data[data.length - 1].balance = totalSpent
    }

    return data
  }

  const reportsData = generateReportsData()

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
      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-5deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 30px rgba(255,255,255,0.5), 0 0 60px rgba(255,255,255,0.2); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
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
        .animate-orbit { animation: orbit 20s linear infinite; }
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
      <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Overview</h2>

      {/* Top Row - Welcome Banner and Circular Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Welcome Banner - Enhanced with animations */}
        <div className="relative rounded-2xl p-8 text-white overflow-hidden min-h-[280px] bg-gradient-to-br from-[#52B788] via-[#40916C] to-[#2D6A4F] animate-gradient">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Large decorative circles */}
            <div className="absolute -right-20 -top-20 w-72 h-72 bg-white/5 rounded-full animate-spin-slow" />
            <div className="absolute -right-10 -bottom-32 w-64 h-64 bg-white/5 rounded-full" style={{ animationDuration: '25s' }} />
            <div className="absolute left-1/3 top-1/4 w-32 h-32 bg-white/5 rounded-full animate-pulse" />

            {/* Glowing lines */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-[280px]">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium mb-4">
              <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
              Ad Accounts Ready
            </div>
            <h2 className="text-3xl font-bold mb-3 tracking-tight">Welcome Back!</h2>
            <p className="text-white/85 text-sm leading-relaxed mb-6">
              Ready to scale? Get access to top-tier ad accounts built for serious marketers and agencies like yours.
            </p>
            <button className="group flex items-center gap-3 px-5 py-2.5 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all duration-300 hover:scale-105">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
              </div>
              <span className="text-sm font-medium">Watch Tutorial</span>
            </button>
          </div>

          {/* Floating Platform Logos */}
          <div className="absolute right-8 top-0 bottom-0 w-[220px] flex items-center justify-center">
            {/* Center glowing orb */}
            <div className="relative">
              <div className="w-28 h-28 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse-glow">
                <div className="w-20 h-20 bg-white rounded-full shadow-xl shadow-white/20 flex items-center justify-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-full flex items-center justify-center shadow-lg shadow-purple-500/40">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Orbiting ring */}
              <div className="absolute inset-0 w-28 h-28 border-2 border-white/25 rounded-full animate-spin-slow" />
              <div className="absolute -inset-4 w-36 h-36 border border-dashed border-white/15 rounded-full animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '40s' }} />
            </div>

            {/* TikTok - Top Left */}
            <div className="absolute top-4 left-4 animate-float">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shadow-xl shadow-black/30 hover:scale-110 transition-transform cursor-pointer">
                <TikTokLogo />
              </div>
            </div>

            {/* Google - Top Right */}
            <div className="absolute top-8 right-0 animate-float-delay-1">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-xl shadow-black/10 hover:scale-110 transition-transform cursor-pointer">
                <GoogleLogo />
              </div>
            </div>

            {/* Facebook - Bottom Right */}
            <div className="absolute bottom-8 right-2 animate-float-delay-2">
              <div className="w-12 h-12 bg-[#1877F2] rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/30 hover:scale-110 transition-transform cursor-pointer">
                <FacebookLogo />
              </div>
            </div>

            {/* Snapchat - Bottom Left */}
            <div className="absolute bottom-4 left-8 animate-float-delay-3">
              <div className="w-10 h-10 bg-[#FFFC00] rounded-xl flex items-center justify-center shadow-xl shadow-yellow-500/30 hover:scale-110 transition-transform cursor-pointer">
                <span className="text-black"><SnapchatLogo /></span>
              </div>
            </div>

            {/* Bing - Middle Left */}
            <div className="absolute top-1/2 -left-2 -translate-y-1/2 animate-float-delay-4">
              <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-xl shadow-black/10 hover:scale-110 transition-transform cursor-pointer">
                <BingLogo />
              </div>
            </div>

            {/* Small decorative dots */}
            <div className="absolute top-16 right-16 w-2 h-2 bg-white/40 rounded-full animate-pulse" />
            <div className="absolute bottom-20 left-16 w-1.5 h-1.5 bg-white/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/3 right-8 w-1 h-1 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>

        {/* Circular Stats Card - Redesigned with Animations */}
        <Card data-tutorial="stats-section" className="p-6 rounded-2xl overflow-hidden relative bg-gradient-to-br from-white to-gray-50/50">
          {/* Animated background elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#52B788]/8 via-emerald-400/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-blue-500/8 via-indigo-400/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/3 animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />

          <div className="relative z-10 min-h-[260px] flex flex-col">
            {/* Header with Year selector */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-gradient-to-b from-[#52B788] to-emerald-400 rounded-full" />
                  Spending Overview
                </h3>
                <p className="text-xs text-gray-400 mt-1 ml-3.5">Track your platform ad spend</p>
              </div>
              <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="p-2.5 hover:bg-gray-50 transition-all duration-200 hover:text-[#52B788] border-r border-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-[#1E293B] min-w-[60px] text-center px-2">{selectedYear}</span>
                <button
                  onClick={() => setSelectedYear(y => y + 1)}
                  disabled={selectedYear >= new Date().getFullYear()}
                  className="p-2.5 hover:bg-gray-50 transition-all duration-200 hover:text-[#52B788] border-l border-gray-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-current"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Content - Fixed height container */}
            <div className="flex-1 flex items-center justify-center">
              {loading ? (
                <div className="flex items-center gap-8 w-full">
                  <div className="w-[150px] h-[150px] rounded-full bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center flex-shrink-0 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-100 animate-spin" style={{ animationDuration: '3s', borderTopColor: '#52B788' }} />
                    <Loader2 className="w-8 h-8 text-[#52B788] animate-spin" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl animate-pulse" />
                    <div className="h-12 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl animate-pulse" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              ) : selectedYear !== new Date().getFullYear() || totalSpent === 0 ? (
                /* No data state - consistent layout */
                <div className="flex items-center gap-8 w-full">
                  {/* Empty donut placeholder with animation */}
                  <div className="w-[150px] h-[150px] rounded-full flex items-center justify-center flex-shrink-0 relative">
                    {/* Animated dashed border */}
                    <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '20s' }}>
                      <circle cx="75" cy="75" r="70" fill="none" stroke="#E5E7EB" strokeWidth="6" strokeDasharray="15 10" />
                    </svg>
                    <div className="w-[120px] h-[120px] bg-gradient-to-br from-gray-50 to-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      {selectedYear !== new Date().getFullYear() ? (
                        <>
                          <svg className="w-10 h-10 text-gray-300 mb-1 animate-bounce" style={{ animationDuration: '2s' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-base font-bold text-gray-400">{selectedYear}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-gray-300">$0</span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">No Spend</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Empty state message */}
                  <div className="flex-1">
                    <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600">
                            {selectedYear !== new Date().getFullYear()
                              ? `No data for ${selectedYear}`
                              : 'No spending yet'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {selectedYear !== new Date().getFullYear()
                              ? 'Historical data unavailable'
                              : 'Start advertising to track'}
                          </p>
                        </div>
                      </div>
                      {selectedYear !== new Date().getFullYear() && (
                        <button
                          onClick={() => setSelectedYear(new Date().getFullYear())}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#52B788] to-emerald-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-[#52B788]/25 transition-all duration-300 hover:-translate-y-0.5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          View {new Date().getFullYear()}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Has data - show donut chart with animations */
                <div className="flex items-center gap-8 w-full">
                  {/* Animated Donut Chart */}
                  <div className="relative flex-shrink-0 group">
                    {/* Outer glow ring */}
                    <div className="absolute -inset-2 bg-gradient-to-r from-[#52B788]/20 via-emerald-400/10 to-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Main donut */}
                    <div
                      className="w-[150px] h-[150px] rounded-full relative transition-transform duration-500 group-hover:scale-105"
                      style={{
                        background: generateConicGradient(),
                        boxShadow: '0 10px 40px rgba(82, 183, 136, 0.2), inset 0 2px 4px rgba(255,255,255,0.5)'
                      }}
                    >
                      {/* Inner white circle */}
                      <div className="absolute inset-[16px] bg-gradient-to-br from-white to-gray-50 rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-xl font-bold text-[#1E293B] transition-all duration-300 group-hover:scale-110">{formatAmount(totalSpent)}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Total Spent</span>
                      </div>

                      {/* Animated ring */}
                      <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
                    </div>
                  </div>

                  {/* Platform breakdown list with animations */}
                  <div className="flex-1 space-y-3">
                    {platformBreakdown.slice(0, 4).map((platform: any, index: number) => {
                      const percentage = totalSpent > 0 ? ((platform.amount / totalSpent) * 100).toFixed(0) : 0
                      return (
                        <div
                          key={platform.name}
                          className="group/item flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {/* Platform icon with color */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover/item:scale-110 shadow-sm"
                            style={{
                              backgroundColor: platform.color,
                              boxShadow: `0 4px 12px ${platform.color}40`
                            }}
                          >
                            <span className="text-white text-sm font-bold">
                              {platform.name.charAt(0)}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-semibold text-gray-700 truncate">
                                {platform.name.charAt(0) + platform.name.slice(1).toLowerCase()}
                              </span>
                              <span className="text-sm font-bold text-[#1E293B] ml-2 tabular-nums">
                                {formatAmount(platform.amount)}
                              </span>
                            </div>
                            {/* Animated progress bar */}
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: platform.color
                                }}
                              >
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-shimmer" />
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-500 tabular-nums">{percentage}%</span>
                          </div>
                        </div>
                      )
                    })}
                    {platformBreakdown.length === 0 && (
                      <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl">
                        No platform data available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Create Deposit Banner - Dashed Purple Border */}
      <div data-tutorial="balance-card" className="border-2 border-dashed border-purple-400 rounded-xl p-5 mb-6 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1E293B]">Create Deposit in your Wallet Balance</h3>
            <p className="text-sm text-gray-500">Click on add and create a deposit in your wallet</p>
          </div>
          <Link href="/deposits">
            <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-5 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              Add Money
            </Button>
          </Link>
        </div>
      </div>

      {/* Bottom Row - Reports Chart and Active Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reports Chart */}
        <Card className="p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1E293B]">Reports</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#52B788]" />
                <span className="text-sm text-gray-500">Deposits</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span className="text-sm text-gray-500">Spent</span>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={reportsData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#52B788" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#52B788" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : `${value}`}
                />
                <Tooltip
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    padding: '8px 12px'
                  }}
                  labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#52B788"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Active Accounts Status */}
        <Card data-tutorial="recent-activity" className="p-6 rounded-xl">
          <h3 className="text-base font-semibold text-[#1E293B] mb-4">Active Accounts Status</h3>
          <div className="space-y-3">
            {loading ? (
              // Loading skeleton
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse" />
                      <div>
                        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-1" />
                        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
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
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:from-gray-100 hover:to-gray-50 transition-all duration-300 group border border-gray-100 hover:border-gray-200 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      {/* Platform Logo Container */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 ${
                        platformKey === 'FACEBOOK' ? 'bg-[#1877F2] shadow-blue-500/30' :
                        platformKey === 'GOOGLE' ? 'bg-white border border-gray-200 shadow-gray-200/50' :
                        platformKey === 'TIKTOK' ? 'bg-black shadow-black/30' :
                        platformKey === 'SNAPCHAT' ? 'bg-[#FFFC00] shadow-yellow-500/30' :
                        platformKey === 'BING' ? 'bg-white border border-gray-200 shadow-gray-200/50' :
                        'bg-gray-200'
                      }`}>
                        {platformKey === 'FACEBOOK' && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )}
                        {platformKey === 'GOOGLE' && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                        )}
                        {platformKey === 'TIKTOK' && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                          </svg>
                        )}
                        {platformKey === 'SNAPCHAT' && (
                          <svg viewBox="0 0 500 500" className="w-6 h-6" fill="black">
                            <path d="M417.93,340.71c-60.61-29.34-70.27-74.64-70.7-78-.52-4.07-1.11-7.27,3.38-11.41,4.33-4,23.54-15.89,28.87-19.61,8.81-6.16,12.69-12.31,9.83-19.87-2-5.23-6.87-7.2-12-7.2a22.3,22.3,0,0,0-4.81.54c-9.68,2.1-19.08,6.95-24.52,8.26a8.56,8.56,0,0,1-2,.27c-2.9,0-4-1.29-3.72-4.78.68-10.58,2.12-31.23.45-50.52-2.29-26.54-10.85-39.69-21-51.32C316.8,101.43,294,77.2,250,77.2S183.23,101.43,178.35,107c-10.18,11.63-18.73,24.78-21,51.32-1.67,19.29-.17,39.93.45,50.52.2,3.32-.82,4.78-3.72,4.78a8.64,8.64,0,0,1-2-.27c-5.43-1.31-14.83-6.16-24.51-8.26a22.3,22.3,0,0,0-4.81-.54c-5.15,0-10,2-12,7.2-2.86,7.56,1,13.71,9.84,19.87,5.33,3.72,24.54,15.6,28.87,19.61,4.48,4.14,3.9,7.34,3.38,11.41-.43,3.41-10.1,48.71-70.7,78-3.55,1.72-9.59,5.36,1.06,11.24,16.72,9.24,27.85,8.25,36.5,13.82,7.34,4.73,3,14.93,8.34,18.61,6.56,4.53,25.95-.32,51,7.95,21,6.92,33.76,26.47,71,26.47s50.37-19.64,71-26.47c25-8.27,44.43-3.42,51-7.95,5.33-3.68,1-13.88,8.34-18.61,8.65-5.57,19.77-4.58,36.5-13.82C427.52,346.07,421.48,342.43,417.93,340.71Z"/>
                          </svg>
                        )}
                        {platformKey === 'BING' && (
                          <svg viewBox="0 0 24 24" className="w-6 h-6">
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
                        <h4 className="font-semibold text-[#1E293B] group-hover:text-[#52B788] transition-colors">{platform.name}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#52B788]">{platform.accounts}</span>
                          <span className="text-sm text-gray-500">Account{platform.accounts !== 1 ? 's' : ''}</span>
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
              <div className="text-center py-10 text-gray-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="font-medium text-gray-500">No accounts yet</p>
                <p className="text-sm mt-1">Apply for your first ad account to get started</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
