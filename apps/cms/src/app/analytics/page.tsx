'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Eye, Users, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// Mock data for last 30 days
const generateDailyViews = () => {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    data.push({
      day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      views: Math.floor(Math.random() * 500 + 100),
    })
  }
  return data
}

const mockTopEvents = [
  { name: 'Page View', count: 12847, change: '+5.2%' },
  { name: 'Contact Form Submit', count: 248, change: '+12.5%' },
  { name: 'CTA Button Click', count: 1834, change: '+8.1%' },
  { name: 'Video Play', count: 567, change: '+3.4%' },
  { name: 'File Download', count: 189, change: '+1.8%' },
  { name: 'Newsletter Signup', count: 342, change: '+6.7%' },
  { name: 'Social Share', count: 156, change: '+2.3%' },
  { name: 'Scroll to Bottom', count: 4521, change: '+4.5%' },
]

export default function AnalyticsPage() {
  const [dailyViews] = useState(generateDailyViews)

  const totalViews = dailyViews.reduce((sum, d) => sum + d.views, 0)
  const totalContacts = 248
  const totalEvents = mockTopEvents.reduce((sum, e) => sum + e.count, 0)

  return (
    <DashboardLayout title="Analytics" subtitle="Last 30 days">
      <div className="space-y-5">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Eye className="w-4 h-4 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500">Total Page Views</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalViews.toLocaleString()}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              +5.2% vs last month
            </span>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500">Total Contacts</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalContacts.toLocaleString()}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              +12.5% vs last month
            </span>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">Total Events</p>
            </div>
            <p className="text-3xl font-bold text-white">{totalEvents.toLocaleString()}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
              +7.8% vs last month
            </span>
          </div>
        </div>

        {/* Daily Views Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Daily Page Views</h3>
              <p className="text-[11px] text-gray-400">Last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-900" />
              <span className="text-[10px] text-gray-400">Views</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyViews}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                interval={4}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '11px',
                }}
                formatter={(value: number) => [value.toLocaleString(), 'Views']}
              />
              <Bar
                dataKey="views"
                fill="#111827"
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Events */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Events</h3>
          <div className="space-y-0">
            {mockTopEvents.map((event, idx) => (
              <div
                key={event.name}
                className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[11px] text-gray-400 font-medium">{idx + 1}</span>
                  <span className="text-[13px] font-medium text-gray-900">{event.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-semibold text-gray-900 tabular-nums">
                    {event.count.toLocaleString()}
                  </span>
                  <span className="w-16 text-right text-[11px] font-medium text-emerald-600">
                    {event.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
