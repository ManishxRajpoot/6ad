'use client'

import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { Loader2, TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// ============================================
// KPI CARD
// ============================================
type KPICardProps = {
  title: string
  value: string | number
  growth: number
  color: string
  variant?: 'light' | 'dark'
}

const KPICard = ({ title, value, growth, color, variant = 'light' }: KPICardProps) => {
  const isDark = variant === 'dark'
  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
      <div className="p-5">
        <p className={`text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {title}
        </p>
        <div className="flex items-center gap-3 mb-1">
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-100 text-gray-900'
          }`}>
            +{Math.abs(growth).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MOCK DATA (will be replaced with real API)
// ============================================
const generateMockMonthly = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months.map(m => ({ name: m, contacts: Math.floor(Math.random() * 50 + 10) }))
}

const PLATFORM_COLORS: Record<string, string> = {
  'Website': '#111827',
  'Google Ads': '#6B7280',
  'Facebook': '#9CA3AF',
  'Instagram': '#D1D5DB',
  'Referral': '#E5E7EB',
}

const mockPlatformData = [
  { name: 'Website', value: 45, color: '#111827' },
  { name: 'Google Ads', value: 25, color: '#6B7280' },
  { name: 'Facebook', value: 15, color: '#9CA3AF' },
  { name: 'Instagram', value: 10, color: '#D1D5DB' },
  { name: 'Referral', value: 5, color: '#E5E7EB' },
]

const mockRecentContacts = [
  { id: 1, name: 'John Smith', email: 'john@example.com', platform: 'Website', budget: '$5,000', status: 'New', date: '2024-03-20' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@company.com', platform: 'Google Ads', budget: '$10,000', status: 'Contacted', date: '2024-03-19' },
  { id: 3, name: 'Mike Chen', email: 'mike@startup.io', platform: 'Facebook', budget: '$3,000', status: 'Converted', date: '2024-03-18' },
  { id: 4, name: 'Emily Davis', email: 'emily@brand.co', platform: 'Instagram', budget: '$7,500', status: 'New', date: '2024-03-17' },
  { id: 5, name: 'Alex Wilson', email: 'alex@agency.com', platform: 'Referral', budget: '$15,000', status: 'Contacted', date: '2024-03-16' },
]

export default function DashboardPage() {
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [contactPeriod, setContactPeriod] = useState<'3M' | '6M' | '12M'>('12M')
  const [monthlyData] = useState(generateMockMonthly)

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-50 text-blue-700'
      case 'Contacted': return 'bg-amber-50 text-amber-700'
      case 'Converted': return 'bg-emerald-50 text-emerald-700'
      case 'Archived': return 'bg-gray-100 text-gray-600'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-5">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard title="Total Contacts" value={248} growth={12.5} color="#111827" />
          <KPICard title="New This Week" value={18} growth={8.3} color="#111827" />
          <KPICard title="Page Views" value="12,847" growth={5.2} color="#111827" />
          <KPICard title="Media Files" value={64} growth={3.1} color="#52B788" variant="dark" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-12 gap-4">
          {/* Contact Submissions Chart */}
          <div className="col-span-7 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900">Contact Submissions</h3>
                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {(['3M', '6M', '12M'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setContactPeriod(p)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                        contactPeriod === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-900" />
                <span className="text-[10px] text-gray-400">Contacts</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyData.slice(-(contactPeriod === '3M' ? 3 : contactPeriod === '6M' ? 6 : 12))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [value, 'Contacts']}
                />
                <Line
                  type="monotone"
                  dataKey="contacts"
                  stroke="#111827"
                  strokeWidth={2}
                  dot={{ fill: '#111827', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#111827' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Platforms Donut */}
          <div className="col-span-5 bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top Platforms</h3>
                <p className="text-[11px] text-gray-400">Contact source distribution</p>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="relative">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie
                      data={mockPlatformData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {mockPlatformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[10px] text-gray-400">Total</p>
                  <p className="text-lg font-bold text-gray-900">{mockPlatformData.reduce((s, d) => s + d.value, 0)}</p>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {mockPlatformData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-900">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <p className="text-[10px] text-gray-400">248 total contacts across all platforms</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Contacts Table */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Contacts</h3>
            <a href="/contacts" className="text-[11px] font-medium text-primary-500 hover:text-primary-600">
              View All
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">#</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Platform</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Budget</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {mockRecentContacts.map((contact, idx) => (
                  <tr key={contact.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 text-[12px] text-gray-400">{idx + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-gray-500">
                            {contact.name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-[12px] font-medium text-gray-900">{contact.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-[12px] text-gray-500">{contact.email}</td>
                    <td className="py-3 text-[12px] text-gray-500">{contact.platform}</td>
                    <td className="py-3 text-[12px] font-medium text-gray-900">{contact.budget}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusStyle(contact.status)}`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="py-3 text-[12px] text-gray-400">{contact.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
