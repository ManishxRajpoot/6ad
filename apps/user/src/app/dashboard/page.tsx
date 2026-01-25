'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Link from 'next/link'

// Reports chart data matching Figma
const reportsData = [
  { name: 'Jun', balance: 80000 },
  { name: 'Jul', balance: 120000 },
  { name: 'Aug', balance: 200000 },
  { name: 'Sep', balance: 280000 },
  { name: 'Oct', balance: 350000 },
  { name: 'Nov', balance: 502000 },
  { name: 'Dec', balance: 620000 },
]

// Platform accounts data
const platformAccounts = [
  { name: 'Facebook', accounts: 90, color: '#1877F2', icon: 'f' },
  { name: 'Google', accounts: 10, color: '#4285F4', icon: 'G' },
  { name: 'Snapchat', accounts: 8, color: '#FFFC00', textColor: '#000', icon: 'S' },
]

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState(2025)

  // Circular progress data
  const spentAmount = 2283870

  return (
    <DashboardLayout title="Dashboard" subtitle="">
      {/* Overview Section Title */}
      <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Overview</h2>

      {/* Top Row - Welcome Banner and Circular Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Welcome Banner */}
        <div className="bg-[#52B788] rounded-xl p-6 text-white relative overflow-hidden min-h-[200px]">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">Welcome</h2>
            <p className="text-white/90 text-sm max-w-[260px] leading-relaxed">
              Ready to scale? Get access to top-tier ad accounts built for serious marketers and agencies like yours.
            </p>
            <button className="mt-4 w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </button>
          </div>

          {/* Decorative elements */}
          <div className="absolute right-4 top-0 bottom-0 w-[200px] flex items-center justify-center">
            {/* TikTok badge */}
            <div className="absolute top-4 left-8 w-9 h-9 bg-black rounded-lg flex items-center justify-center shadow-lg z-10">
              <span className="text-white font-bold text-xs">T</span>
            </div>

            {/* Center circle */}
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
              <div className="w-14 h-14 bg-[#F5A623] rounded-full"></div>
            </div>

            {/* Google badge */}
            <div className="absolute top-10 right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
              <span className="text-[#4285F4] font-bold text-sm">G</span>
            </div>

            {/* Facebook badge */}
            <div className="absolute bottom-6 right-6 w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center shadow-lg z-10">
              <span className="text-white font-bold text-sm">f</span>
            </div>
          </div>
        </div>

        {/* Circular Stats Card */}
        <Card className="p-6 rounded-xl">
          {/* Year selector */}
          <div className="flex items-center justify-center gap-8 mb-6">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400" />
            </button>
            <span className="text-2xl font-semibold text-[#1E293B]">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Donut Chart with Conic Gradient */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              {/* Donut chart using conic-gradient */}
              <div
                className="w-40 h-40 rounded-full"
                style={{
                  background: `conic-gradient(
                    #52B788 0deg 216deg,
                    #EAB308 216deg 288deg,
                    #3B82F6 288deg 360deg
                  )`
                }}
              >
                {/* Inner white circle to create donut effect */}
                <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-[#1E293B]">${(spentAmount / 1000).toLocaleString()}k</span>
                  <span className="text-xs text-gray-500">Spent Till now</span>
                </div>
              </div>
            </div>
          </div>

          {/* Platform legend */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#52B788]" />
              <span className="text-sm text-gray-500">Facebook</span>
              <span className="text-sm font-semibold text-[#1E293B]">2.1k</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              <span className="text-sm text-gray-500">Google</span>
              <span className="text-sm font-semibold text-[#1E293B]">1k</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Create Deposit Banner - Dashed Purple Border */}
      <div className="border-2 border-dashed border-purple-400 rounded-xl p-5 mb-6 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1E293B]">Create Deposit in your Wallet Balance</h3>
            <p className="text-sm text-gray-500">Click on add and create a deposit in your wallet</p>
          </div>
          <Link href="/deposits">
            <Button className="bg-[#52B788] hover:bg-[#16A34A] text-white px-5 rounded-xl">
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
                <span className="text-sm text-gray-500">Balance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-sm text-gray-500">Pending</span>
              </div>
            </div>
          </div>
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
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
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
        </Card>

        {/* Active Accounts Status */}
        <Card className="p-6 rounded-xl">
          <h3 className="text-base font-semibold text-[#1E293B] mb-4">Active Accounts Status</h3>
          <div className="space-y-3">
            {platformAccounts.map((platform) => (
              <Link
                key={platform.name}
                href={`/accounts?platform=${platform.name.toLowerCase()}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: platform.color }}
                  >
                    <span
                      className="font-bold text-base"
                      style={{ color: platform.textColor || '#fff' }}
                    >
                      {platform.icon}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-[#1E293B]">{platform.name}</h4>
                    <p className="text-sm text-[#52B788]">{platform.accounts} Account</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
