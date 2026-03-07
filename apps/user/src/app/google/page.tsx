'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Download,
  Copy,
  Check,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Wallet,
} from 'lucide-react'
import { authApi, accountsApi, transactionsApi, accountDepositsApi, balanceTransfersApi, accountRefundsApi, dashboardApi, settingsApi, applicationsApi, bmShareApi, PlatformStatus } from '@/lib/api'
import { AccountManageIcon, DepositManageIcon, AfterSaleIcon, ComingSoonIcon } from '@/components/icons/MenuIcons'
import { useToast } from '@/contexts/ToastContext'

// Animated Counter Component - smoothly animates number changes
function AnimatedCounter({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)

  useEffect(() => {
    if (previousValue.current === value) return

    const startValue = previousValue.current
    const endValue = value
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)

      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart)
      setDisplayValue(currentValue)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = value
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return <>{String(displayValue).padStart(2, '0')}</>
}

// Mock admin settings - In real app, these would come from API
const ADMIN_SETTINGS = {
  minimumDeposit: 50,
  platformsEnabled: {
    facebook: true,
    google: true,
    tiktok: true,
    snapchat: true,
    bing: true,
  }
}

type DepositRow = {
  id: number
  accountId: string
  amount: string
}

// Date filter options
const dateFilterOptions = [
  { value: '', label: 'Date and Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
]

// Action filter options
const actionFilterOptions = [
  { value: '', label: 'Action' },
  { value: 'approve', label: 'Approve' },
  { value: 'pending', label: 'Pending' },
]

// Export options
const exportOptions = [
  { id: 'account-list', label: 'Account List' },
  { id: 'account-applied-records', label: 'Account Applied Records' },
  { id: 'bm-share-log', label: 'Access Share Log' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'deposit-report', label: 'Deposit Records' },
  { id: 'transfer-balance', label: 'Transfer Balance' },
  { id: 'refund', label: 'Refund' },
  { id: 'refund-report', label: 'Refund Report' },
]

// Stats data will be computed from dashboard API response

// Account List data
const accountListData = [
  { id: 1, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 2, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 3, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 4, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 5, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 6, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 7, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
  { id: 8, license: 'ADM Marketing', adsAccountId: '7675646567785', adsAccountName: 'gyan creative' },
]


// BM Share Log data

type SubPage = 'apply-ads-account' | 'account-list' | 'account-applied-records' | 'bm-share-log' | 'deposit' | 'deposit-report' | 'transfer-balance' | 'refund' | 'refund-report'

type MenuSection = 'account-manage' | 'deposit-manage' | 'after-sale'

// Country options - full list for target market selection
const countryOptions = [
  { value: 'Afghanistan', label: '🇦🇫 Afghanistan' },
  { value: 'Albania', label: '🇦🇱 Albania' },
  { value: 'Algeria', label: '🇩🇿 Algeria' },
  { value: 'Andorra', label: '🇦🇩 Andorra' },
  { value: 'Angola', label: '🇦🇴 Angola' },
  { value: 'Antigua and Barbuda', label: '🇦🇬 Antigua and Barbuda' },
  { value: 'Argentina', label: '🇦🇷 Argentina' },
  { value: 'Armenia', label: '🇦🇲 Armenia' },
  { value: 'Australia', label: '🇦🇺 Australia' },
  { value: 'Austria', label: '🇦🇹 Austria' },
  { value: 'Azerbaijan', label: '🇦🇿 Azerbaijan' },
  { value: 'Bahamas', label: '🇧🇸 Bahamas' },
  { value: 'Bahrain', label: '🇧🇭 Bahrain' },
  { value: 'Bangladesh', label: '🇧🇩 Bangladesh' },
  { value: 'Barbados', label: '🇧🇧 Barbados' },
  { value: 'Belarus', label: '🇧🇾 Belarus' },
  { value: 'Belgium', label: '🇧🇪 Belgium' },
  { value: 'Belize', label: '🇧🇿 Belize' },
  { value: 'Benin', label: '🇧🇯 Benin' },
  { value: 'Bhutan', label: '🇧🇹 Bhutan' },
  { value: 'Bolivia', label: '🇧🇴 Bolivia' },
  { value: 'Bosnia and Herzegovina', label: '🇧🇦 Bosnia and Herzegovina' },
  { value: 'Botswana', label: '🇧🇼 Botswana' },
  { value: 'Brazil', label: '🇧🇷 Brazil' },
  { value: 'Brunei', label: '🇧🇳 Brunei' },
  { value: 'Bulgaria', label: '🇧🇬 Bulgaria' },
  { value: 'Burkina Faso', label: '🇧🇫 Burkina Faso' },
  { value: 'Burundi', label: '🇧🇮 Burundi' },
  { value: 'Cabo Verde', label: '🇨🇻 Cabo Verde' },
  { value: 'Cambodia', label: '🇰🇭 Cambodia' },
  { value: 'Cameroon', label: '🇨🇲 Cameroon' },
  { value: 'Canada', label: '🇨🇦 Canada' },
  { value: 'Central African Republic', label: '🇨🇫 Central African Republic' },
  { value: 'Chad', label: '🇹🇩 Chad' },
  { value: 'Chile', label: '🇨🇱 Chile' },
  { value: 'China', label: '🇨🇳 China' },
  { value: 'Colombia', label: '🇨🇴 Colombia' },
  { value: 'Comoros', label: '🇰🇲 Comoros' },
  { value: 'Congo (DRC)', label: '🇨🇩 Congo (DRC)' },
  { value: 'Congo (Republic)', label: '🇨🇬 Congo (Republic)' },
  { value: 'Costa Rica', label: '🇨🇷 Costa Rica' },
  { value: "Côte d'Ivoire", label: "🇨🇮 Côte d'Ivoire" },
  { value: 'Croatia', label: '🇭🇷 Croatia' },
  { value: 'Cuba', label: '🇨🇺 Cuba' },
  { value: 'Cyprus', label: '🇨🇾 Cyprus' },
  { value: 'Czech Republic', label: '🇨🇿 Czech Republic' },
  { value: 'Denmark', label: '🇩🇰 Denmark' },
  { value: 'Djibouti', label: '🇩🇯 Djibouti' },
  { value: 'Dominica', label: '🇩🇲 Dominica' },
  { value: 'Dominican Republic', label: '🇩🇴 Dominican Republic' },
  { value: 'Ecuador', label: '🇪🇨 Ecuador' },
  { value: 'Egypt', label: '🇪🇬 Egypt' },
  { value: 'El Salvador', label: '🇸🇻 El Salvador' },
  { value: 'Equatorial Guinea', label: '🇬🇶 Equatorial Guinea' },
  { value: 'Eritrea', label: '🇪🇷 Eritrea' },
  { value: 'Estonia', label: '🇪🇪 Estonia' },
  { value: 'Eswatini', label: '🇸🇿 Eswatini' },
  { value: 'Ethiopia', label: '🇪🇹 Ethiopia' },
  { value: 'Fiji', label: '🇫🇯 Fiji' },
  { value: 'Finland', label: '🇫🇮 Finland' },
  { value: 'France', label: '🇫🇷 France' },
  { value: 'Gabon', label: '🇬🇦 Gabon' },
  { value: 'Gambia', label: '🇬🇲 Gambia' },
  { value: 'Georgia', label: '🇬🇪 Georgia' },
  { value: 'Germany', label: '🇩🇪 Germany' },
  { value: 'Ghana', label: '🇬🇭 Ghana' },
  { value: 'Greece', label: '🇬🇷 Greece' },
  { value: 'Grenada', label: '🇬🇩 Grenada' },
  { value: 'Guatemala', label: '🇬🇹 Guatemala' },
  { value: 'Guinea', label: '🇬🇳 Guinea' },
  { value: 'Guinea-Bissau', label: '🇬🇼 Guinea-Bissau' },
  { value: 'Guyana', label: '🇬🇾 Guyana' },
  { value: 'Haiti', label: '🇭🇹 Haiti' },
  { value: 'Honduras', label: '🇭🇳 Honduras' },
  { value: 'Hungary', label: '🇭🇺 Hungary' },
  { value: 'Iceland', label: '🇮🇸 Iceland' },
  { value: 'India', label: '🇮🇳 India' },
  { value: 'Indonesia', label: '🇮🇩 Indonesia' },
  { value: 'Iran', label: '🇮🇷 Iran' },
  { value: 'Iraq', label: '🇮🇶 Iraq' },
  { value: 'Ireland', label: '🇮🇪 Ireland' },
  { value: 'Israel', label: '🇮🇱 Israel' },
  { value: 'Italy', label: '🇮🇹 Italy' },
  { value: 'Jamaica', label: '🇯🇲 Jamaica' },
  { value: 'Japan', label: '🇯🇵 Japan' },
  { value: 'Jordan', label: '🇯🇴 Jordan' },
  { value: 'Kazakhstan', label: '🇰🇿 Kazakhstan' },
  { value: 'Kenya', label: '🇰🇪 Kenya' },
  { value: 'Kiribati', label: '🇰🇮 Kiribati' },
  { value: 'Kosovo', label: '🇽🇰 Kosovo' },
  { value: 'Kuwait', label: '🇰🇼 Kuwait' },
  { value: 'Kyrgyzstan', label: '🇰🇬 Kyrgyzstan' },
  { value: 'Laos', label: '🇱🇦 Laos' },
  { value: 'Latvia', label: '🇱🇻 Latvia' },
  { value: 'Lebanon', label: '🇱🇧 Lebanon' },
  { value: 'Lesotho', label: '🇱🇸 Lesotho' },
  { value: 'Liberia', label: '🇱🇷 Liberia' },
  { value: 'Libya', label: '🇱🇾 Libya' },
  { value: 'Liechtenstein', label: '🇱🇮 Liechtenstein' },
  { value: 'Lithuania', label: '🇱🇹 Lithuania' },
  { value: 'Luxembourg', label: '🇱🇺 Luxembourg' },
  { value: 'Madagascar', label: '🇲🇬 Madagascar' },
  { value: 'Malawi', label: '🇲🇼 Malawi' },
  { value: 'Malaysia', label: '🇲🇾 Malaysia' },
  { value: 'Maldives', label: '🇲🇻 Maldives' },
  { value: 'Mali', label: '🇲🇱 Mali' },
  { value: 'Malta', label: '🇲🇹 Malta' },
  { value: 'Marshall Islands', label: '🇲🇭 Marshall Islands' },
  { value: 'Mauritania', label: '🇲🇷 Mauritania' },
  { value: 'Mauritius', label: '🇲🇺 Mauritius' },
  { value: 'Mexico', label: '🇲🇽 Mexico' },
  { value: 'Micronesia', label: '🇫🇲 Micronesia' },
  { value: 'Moldova', label: '🇲🇩 Moldova' },
  { value: 'Monaco', label: '🇲🇨 Monaco' },
  { value: 'Mongolia', label: '🇲🇳 Mongolia' },
  { value: 'Montenegro', label: '🇲🇪 Montenegro' },
  { value: 'Morocco', label: '🇲🇦 Morocco' },
  { value: 'Mozambique', label: '🇲🇿 Mozambique' },
  { value: 'Myanmar', label: '🇲🇲 Myanmar' },
  { value: 'Namibia', label: '🇳🇦 Namibia' },
  { value: 'Nauru', label: '🇳🇷 Nauru' },
  { value: 'Nepal', label: '🇳🇵 Nepal' },
  { value: 'Netherlands', label: '🇳🇱 Netherlands' },
  { value: 'New Zealand', label: '🇳🇿 New Zealand' },
  { value: 'Nicaragua', label: '🇳🇮 Nicaragua' },
  { value: 'Niger', label: '🇳🇪 Niger' },
  { value: 'Nigeria', label: '🇳🇬 Nigeria' },
  { value: 'North Korea', label: '🇰🇵 North Korea' },
  { value: 'North Macedonia', label: '🇲🇰 North Macedonia' },
  { value: 'Norway', label: '🇳🇴 Norway' },
  { value: 'Oman', label: '🇴🇲 Oman' },
  { value: 'Pakistan', label: '🇵🇰 Pakistan' },
  { value: 'Palau', label: '🇵🇼 Palau' },
  { value: 'Palestine', label: '🇵🇸 Palestine' },
  { value: 'Panama', label: '🇵🇦 Panama' },
  { value: 'Papua New Guinea', label: '🇵🇬 Papua New Guinea' },
  { value: 'Paraguay', label: '🇵🇾 Paraguay' },
  { value: 'Peru', label: '🇵🇪 Peru' },
  { value: 'Philippines', label: '🇵🇭 Philippines' },
  { value: 'Poland', label: '🇵🇱 Poland' },
  { value: 'Portugal', label: '🇵🇹 Portugal' },
  { value: 'Qatar', label: '🇶🇦 Qatar' },
  { value: 'Romania', label: '🇷🇴 Romania' },
  { value: 'Russia', label: '🇷🇺 Russia' },
  { value: 'Rwanda', label: '🇷🇼 Rwanda' },
  { value: 'Saint Kitts and Nevis', label: '🇰🇳 Saint Kitts and Nevis' },
  { value: 'Saint Lucia', label: '🇱🇨 Saint Lucia' },
  { value: 'Saint Vincent and the Grenadines', label: '🇻🇨 Saint Vincent and the Grenadines' },
  { value: 'Samoa', label: '🇼🇸 Samoa' },
  { value: 'San Marino', label: '🇸🇲 San Marino' },
  { value: 'São Tomé and Príncipe', label: '🇸🇹 São Tomé and Príncipe' },
  { value: 'Saudi Arabia', label: '🇸🇦 Saudi Arabia' },
  { value: 'Senegal', label: '🇸🇳 Senegal' },
  { value: 'Serbia', label: '🇷🇸 Serbia' },
  { value: 'Seychelles', label: '🇸🇨 Seychelles' },
  { value: 'Sierra Leone', label: '🇸🇱 Sierra Leone' },
  { value: 'Singapore', label: '🇸🇬 Singapore' },
  { value: 'Slovakia', label: '🇸🇰 Slovakia' },
  { value: 'Slovenia', label: '🇸🇮 Slovenia' },
  { value: 'Solomon Islands', label: '🇸🇧 Solomon Islands' },
  { value: 'Somalia', label: '🇸🇴 Somalia' },
  { value: 'South Africa', label: '🇿🇦 South Africa' },
  { value: 'South Korea', label: '🇰🇷 South Korea' },
  { value: 'South Sudan', label: '🇸🇸 South Sudan' },
  { value: 'Spain', label: '🇪🇸 Spain' },
  { value: 'Sri Lanka', label: '🇱🇰 Sri Lanka' },
  { value: 'Sudan', label: '🇸🇩 Sudan' },
  { value: 'Suriname', label: '🇸🇷 Suriname' },
  { value: 'Sweden', label: '🇸🇪 Sweden' },
  { value: 'Switzerland', label: '🇨🇭 Switzerland' },
  { value: 'Syria', label: '🇸🇾 Syria' },
  { value: 'Taiwan', label: '🇹🇼 Taiwan' },
  { value: 'Tajikistan', label: '🇹🇯 Tajikistan' },
  { value: 'Tanzania', label: '🇹🇿 Tanzania' },
  { value: 'Thailand', label: '🇹🇭 Thailand' },
  { value: 'Timor-Leste', label: '🇹🇱 Timor-Leste' },
  { value: 'Togo', label: '🇹🇬 Togo' },
  { value: 'Tonga', label: '🇹🇴 Tonga' },
  { value: 'Trinidad and Tobago', label: '🇹🇹 Trinidad and Tobago' },
  { value: 'Tunisia', label: '🇹🇳 Tunisia' },
  { value: 'Turkey', label: '🇹🇷 Turkey' },
  { value: 'Turkmenistan', label: '🇹🇲 Turkmenistan' },
  { value: 'Tuvalu', label: '🇹🇻 Tuvalu' },
  { value: 'Uganda', label: '🇺🇬 Uganda' },
  { value: 'Ukraine', label: '🇺🇦 Ukraine' },
  { value: 'United Arab Emirates', label: '🇦🇪 United Arab Emirates' },
  { value: 'United Kingdom', label: '🇬🇧 United Kingdom' },
  { value: 'United States', label: '🇺🇸 United States' },
  { value: 'Uruguay', label: '🇺🇾 Uruguay' },
  { value: 'Uzbekistan', label: '🇺🇿 Uzbekistan' },
  { value: 'Vanuatu', label: '🇻🇺 Vanuatu' },
  { value: 'Vatican City', label: '🇻🇦 Vatican City' },
  { value: 'Venezuela', label: '🇻🇪 Venezuela' },
  { value: 'Vietnam', label: '🇻🇳 Vietnam' },
  { value: 'Yemen', label: '🇾🇪 Yemen' },
  { value: 'Zambia', label: '🇿🇲 Zambia' },
  { value: 'Zimbabwe', label: '🇿🇼 Zimbabwe' },
]

// Timezone options - comprehensive list for search
const timezoneOptions = [
  { value: 'UTC+0', label: 'UTC+0 (London, UK)' },
  { value: 'UTC+1', label: 'UTC+1 (Paris, France)' },
  { value: 'UTC+2', label: 'UTC+2 (Cairo, Egypt)' },
  { value: 'UTC+3', label: 'UTC+3 (Moscow, Russia)' },
  { value: 'UTC+3:30', label: 'UTC+3:30 (Tehran, Iran)' },
  { value: 'UTC+4', label: 'UTC+4 (Dubai, UAE)' },
  { value: 'UTC+4:30', label: 'UTC+4:30 (Kabul, Afghanistan)' },
  { value: 'UTC+5', label: 'UTC+5 (Karachi, Pakistan)' },
  { value: 'UTC+5:30', label: 'UTC+5:30 (Kolkata, India)' },
  { value: 'UTC+5:45', label: 'UTC+5:45 (Kathmandu, Nepal)' },
  { value: 'UTC+6', label: 'UTC+6 (Dhaka, Bangladesh)' },
  { value: 'UTC+6:30', label: 'UTC+6:30 (Yangon, Myanmar)' },
  { value: 'UTC+7', label: 'UTC+7 (Bangkok, Thailand)' },
  { value: 'UTC+8', label: 'UTC+8 (Singapore, Hong Kong)' },
  { value: 'UTC+9', label: 'UTC+9 (Tokyo, Japan)' },
  { value: 'UTC+9:30', label: 'UTC+9:30 (Adelaide, Australia)' },
  { value: 'UTC+10', label: 'UTC+10 (Sydney, Australia)' },
  { value: 'UTC+11', label: 'UTC+11 (Solomon Islands)' },
  { value: 'UTC+12', label: 'UTC+12 (Auckland, New Zealand)' },
  { value: 'UTC-12', label: 'UTC-12 (Baker Island)' },
  { value: 'UTC-11', label: 'UTC-11 (American Samoa)' },
  { value: 'UTC-10', label: 'UTC-10 (Hawaii, USA)' },
  { value: 'UTC-9', label: 'UTC-9 (Alaska, USA)' },
  { value: 'UTC-8', label: 'UTC-8 (Los Angeles, USA)' },
  { value: 'UTC-7', label: 'UTC-7 (Denver, USA)' },
  { value: 'UTC-6', label: 'UTC-6 (Chicago, USA)' },
  { value: 'UTC-5', label: 'UTC-5 (New York, USA)' },
  { value: 'UTC-4', label: 'UTC-4 (Santiago, Chile)' },
  { value: 'UTC-3', label: 'UTC-3 (Buenos Aires, Argentina)' },
  { value: 'UTC-2', label: 'UTC-2 (Mid-Atlantic)' },
  { value: 'UTC-1', label: 'UTC-1 (Azores, Portugal)' },
]

// Google brand colors
const brandColor = '#4285F4'
const brandColorDark = '#3367D6'
const brandGradient = 'from-[#4285F4] to-[#3367D6]'

export default function GooglePage() {
  const { showToast } = useToast()
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('apply-ads-account')
  const [expandedSections, setExpandedSections] = useState<MenuSection[]>(['account-manage', 'deposit-manage', 'after-sale'])
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // User state from API
  const [user, setUser] = useState<any>(null)
  const [userAccounts, setUserAccounts] = useState<any[]>([])
  const [userApplications, setUserApplications] = useState<any[]>([])
  const [accessRequests, setAccessRequests] = useState<any[]>([])
  const [userRefunds, setUserRefunds] = useState<any[]>([])
  const [userDeposits, setUserDeposits] = useState<any[]>([])
  const [balanceTransfers, setBalanceTransfers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [previousStats, setPreviousStats] = useState<any>(null)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>('active')
  const [reportTab, setReportTab] = useState<'transfer' | 'refund'>('transfer')

  // Generate dynamic chart path based on count - creates wave peaks for each pending item
  const generateChartPath = (count: number, trend: 'up' | 'down') => {
    if (count === 0) {
      return 'M0,38 L120,38'
    }
    const numPeaks = Math.min(count, 6)
    const segmentWidth = 120 / numPeaks
    let path = 'M0,35'
    for (let i = 0; i < numPeaks; i++) {
      const startX = i * segmentWidth
      const peakX = startX + segmentWidth * 0.5
      const endX = (i + 1) * segmentWidth
      const baseHeight = trend === 'up' ? 8 : 25
      const variation = (i % 2 === 0) ? 0 : 8
      const peakY = trend === 'up'
        ? baseHeight + variation + (i * 2)
        : baseHeight - variation + (i * 2)
      const cp1x = startX + segmentWidth * 0.2
      const cp2x = peakX - segmentWidth * 0.15
      const cp3x = peakX + segmentWidth * 0.15
      const cp4x = startX + segmentWidth * 0.8
      path += ` C${cp1x},35 ${cp2x},${peakY} ${peakX},${peakY}`
      path += ` C${cp3x},${peakY} ${cp4x},35 ${endX},35`
    }
    return path
  }

  // Helper function to calculate growth percentage and trend
  const calculateGrowth = (current: number, previous: number | undefined, isRefund: boolean = false) => {
    if (previous === undefined) {
      if (current > 0) {
        return {
          trend: isRefund ? 'down' as const : 'up' as const,
          badge: `${current} Active`
        }
      }
      return { trend: 'neutral' as const, badge: 'None' }
    }
    const diff = current - previous
    if (diff > 0) {
      return { trend: 'up' as const, badge: `+${diff} New` }
    } else if (diff < 0) {
      return { trend: 'down' as const, badge: `${diff} Resolved` }
    }
    if (current > 0) {
      return {
        trend: isRefund ? 'down' as const : 'up' as const,
        badge: `${current} Active`
      }
    }
    return { trend: 'neutral' as const, badge: 'None' }
  }

  // Compute statsData from dashboard API with dynamic chart paths
  const statsData = useMemo(() => {
    const pendingApps = dashboardStats?.pendingApplications || 0
    const pendingDeps = dashboardStats?.pendingDeposits || 0
    const pendingSharesCount = dashboardStats?.pendingShares || 0
    const pendingRefundsCount = dashboardStats?.pendingRefunds || 0

    const prevApps = previousStats?.pendingApplications
    const prevDeps = previousStats?.pendingDeposits
    const prevShares = previousStats?.pendingShares
    const prevRefunds = previousStats?.pendingRefunds

    const appsGrowth = calculateGrowth(pendingApps, prevApps, false)
    const depsGrowth = calculateGrowth(pendingDeps, prevDeps, false)
    const sharesGrowth = calculateGrowth(pendingSharesCount, prevShares, false)
    const refundsGrowth = calculateGrowth(pendingRefundsCount, prevRefunds, true)

    return [
      {
        label: 'Pending Applications',
        numericValue: pendingApps,
        trend: appsGrowth.trend,
        badge: appsGrowth.badge,
        color: '#4285F4',
        chartPath: generateChartPath(pendingApps, 'up')
      },
      {
        label: 'Pending Deposits',
        numericValue: pendingDeps,
        trend: depsGrowth.trend,
        badge: depsGrowth.badge,
        color: '#34A853',
        chartPath: generateChartPath(pendingDeps, 'up')
      },
      {
        label: 'Pending Shares',
        numericValue: pendingSharesCount,
        trend: sharesGrowth.trend,
        badge: sharesGrowth.badge,
        color: '#FBBC04',
        chartPath: generateChartPath(pendingSharesCount, 'up')
      },
      {
        label: 'Pending Refunds',
        numericValue: pendingRefundsCount,
        trend: refundsGrowth.trend,
        badge: refundsGrowth.badge,
        color: '#EA4335',
        chartPath: generateChartPath(pendingRefundsCount, 'down')
      },
    ]
  }, [dashboardStats, previousStats])

  // Function to refresh only dashboard stats (for real-time updates)
  const refreshStats = async () => {
    try {
      const statsRes = await dashboardApi.getStats().catch(() => ({}))
      if (dashboardStats && (
        statsRes.pendingApplications !== dashboardStats.pendingApplications ||
        statsRes.pendingDeposits !== dashboardStats.pendingDeposits ||
        statsRes.pendingShares !== dashboardStats.pendingShares ||
        statsRes.pendingRefunds !== dashboardStats.pendingRefunds
      )) {
        setPreviousStats(dashboardStats)
      }
      setDashboardStats(statsRes)
    } catch (error) {
      // Silently handle errors
    }
  }

  // Handle Google ad account application submission
  const handleSubmitApplication = async () => {
    // Validation
    // Validate form fields
    for (let i = 0; i < adAccounts.length; i++) {
      const acc = adAccounts[i]
      if (businessType === 'clean' && !acc.domain) {
        setSubmitError(`Please enter domain for account ${i + 1}`)
        return
      }
      if (!acc.timezone) {
        setSubmitError(`Please select timezone for account ${i + 1}`)
        return
      }
      if (!acc.gmail) {
        setSubmitError(`Please enter Gmail for account ${i + 1}`)
        return
      }
      if (businessType === 'clean' && !acc.targetMarket) {
        setSubmitError(`Please enter target market for account ${i + 1}`)
        return
      }
    }

    // Check balance
    if (userBalance < costs.totalCost) {
      setSubmitError(`Insufficient balance. You need $${costs.totalCost.toFixed(2)} but have $${userBalance.toFixed(2)}`)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Prepare account details - include all Google-specific fields in the name/remarks
      const accountDetails = adAccounts.map((acc, index) => ({
        name: businessType === 'clean'
          ? `${acc.domain} | ${acc.gmail} | ${acc.timezone} | ${acc.targetMarket}`
          : `${acc.gmail} | ${acc.timezone}`,
      }))

      const applicationData = {
        platform: 'GOOGLE',
        licenseType: 'NEW' as const,
        licenseNo: businessType === 'clean' ? 'Clean Business' : 'Black Hat',
        accountDetails,
        depositAmount: costs.totalDeposits,
        remarks: `Business Type: ${businessType === 'clean' ? 'Clean (White Hat)' : 'Black Hat'}\n` +
          adAccounts.map((acc, i) =>
            `Account ${i + 1}: ${businessType === 'clean' ? `Domain: ${acc.domain}, ` : ''}Gmail: ${acc.gmail}, Timezone: ${acc.timezone}${businessType === 'clean' ? `, Target Market: ${acc.targetMarket}` : ''}, Deposit: $${acc.deposit}`
          ).join('\n'),
      }

      await applicationsApi.create(applicationData)

      showToast('success', 'Application Submitted', 'Your request is now pending review.')
      // Refresh stats immediately to update pending count
      refreshStats()

      // Reset form
      setBusinessType('clean')
      setAdAccountCount('1')
      setAdAccounts([{ domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }])
      // Refresh user data
      const [userRes, accountsRes, applicationsRes] = await Promise.all([
        authApi.me(),
        accountsApi.getAll('GOOGLE'),
        applicationsApi.getAll('GOOGLE').catch(() => ({ applications: [] }))
      ])
      setUser(userRes.user)
      setUserAccounts(accountsRes.accounts || [])
      setUserApplications(applicationsRes.applications || [])

    } catch (error: any) {
      console.error('Submit error:', error)
      setSubmitError(error.message || 'Failed to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Fetch user data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        // Fetch each endpoint separately to handle individual failures gracefully
        const [userRes, accountsRes, applicationsRes, accessRes, refundsRes, depositsRes, transfersRes, statsRes, platformRes] = await Promise.all([
          authApi.me().catch(() => ({ user: null })),
          accountsApi.getAll('GOOGLE').catch(() => ({ accounts: [] })),
          applicationsApi.getAll('GOOGLE').catch(() => ({ applications: [] })),
          bmShareApi.getAll('GOOGLE').catch(() => ({ bmShareRequests: [] })),
          accountRefundsApi.getAll('GOOGLE').catch(() => ({ refunds: [] })),
          accountDepositsApi.getAll('GOOGLE').catch(() => ({ deposits: [] })),
          balanceTransfersApi.getAll('GOOGLE').catch(() => ({ transfers: [] })),
          dashboardApi.getStats().catch(() => ({})),
          settingsApi.platforms.get().catch(() => ({ platforms: { facebook: 'active', google: 'active', tiktok: 'active', snapchat: 'active', bing: 'active' } }))
        ])
        setUser(userRes.user)
        setUserAccounts(accountsRes.accounts || [])
        setUserApplications(applicationsRes.applications || [])
        setAccessRequests(accessRes.bmShareRequests || [])
        setUserRefunds(refundsRes.refunds || [])
        setUserDeposits(depositsRes.deposits || [])
        setBalanceTransfers(transfersRes.transfers || [])
        setDashboardStats(statsRes)
        setPlatformStatus((platformRes.platforms?.google || 'active') as PlatformStatus)
      } catch (error) {
        // Silently handle errors - user will see empty data
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Export to Excel function
  const exportToExcel = (exportType: string) => {
    let data: any[] = []
    let filename = ''
    let headers: string[] = []

    switch (exportType) {
      case 'account-list':
        filename = 'google_account_list'
        headers = ['License', 'Account ID', 'Account Name', 'Status', 'Created At']
        data = userAccounts.map(acc => ({
          'License': acc.licenseName || '-',
          'Account ID': acc.accountId || '-',
          'Account Name': acc.accountName || '-',
          'Status': acc.status || '-',
          'Created At': acc.createdAt ? new Date(acc.createdAt).toLocaleDateString() : '-'
        }))
        break

      case 'account-applied-records':
        filename = 'google_applied_records'
        headers = ['Apply ID', 'License', 'Request Time', 'Total Cost', 'Status']
        data = userAccounts.map(acc => ({
          'Apply ID': acc.id || '-',
          'License': acc.licenseName || '-',
          'Request Time': acc.createdAt ? new Date(acc.createdAt).toLocaleString() : '-',
          'Total Cost': `$${acc.totalCost || 0}`,
          'Status': acc.status || '-'
        }))
        break

      case 'deposit':
      case 'deposit-report':
        filename = exportType === 'deposit' ? 'google_deposits' : 'google_deposit_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Created At']
        data = userDeposits.map(dep => ({
          'Account ID': dep.accountId || '-',
          'Account Name': dep.accountName || '-',
          'Amount': `$${dep.amount || 0}`,
          'Status': dep.status || '-',
          'Created At': dep.createdAt ? new Date(dep.createdAt).toLocaleString() : '-'
        }))
        break

      case 'refund':
      case 'refund-report':
        filename = exportType === 'refund' ? 'google_refunds' : 'google_refund_report'
        headers = ['Account ID', 'Account Name', 'Amount', 'Status', 'Request Date']
        data = userRefunds.map(refund => ({
          'Account ID': refund.accountId || '-',
          'Account Name': refund.accountName || '-',
          'Amount': `$${refund.amount || 0}`,
          'Status': refund.status || '-',
          'Request Date': refund.createdAt ? new Date(refund.createdAt).toLocaleString() : '-'
        }))
        break

      default:
        showToast('warning', 'Warning', 'Export not available for this option')
        return
    }

    if (data.length === 0) {
      showToast('warning', 'Warning', 'No data available to export')
      return
    }

    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header] || ''
        const escaped = String(value).replace(/"/g, '""')
        return escaped.includes(',') ? `"${escaped}"` : escaped
      }).join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Fallback stats refresh every 60s (SSE handles real-time updates)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshStats()
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Get user's Google commission rate from API (fallback to 5% if not set)
  const googleCommissionRate = user?.googleCommission ? parseFloat(user.googleCommission) : 5

  // User wallet balance from API (walletBalance is the correct field name)
  const userBalance = user?.walletBalance ? parseFloat(user.walletBalance) : 0

  // Check if platform is enabled and if user has existing accounts
  // platformStatus: 'active' = can apply, 'stop' = visible but can't apply, 'hidden' = not shown
  const platformEnabled = platformStatus === 'active'
  const platformStopped = platformStatus === 'stop'
  const hasExistingAccounts = userAccounts.length > 0

  // Pagination - get data for current tab
  const ITEMS_PER_PAGE = 7
  const getCurrentData = () => {
    let data: any[] = []
    if (activeSubPage === 'account-list') {
      data = userAccounts
    } else if (activeSubPage === 'account-applied-records') {
      data = userApplications
    } else if (activeSubPage === 'bm-share-log') {
      data = accessRequests
    } else if (activeSubPage === 'deposit-report') {
      data = userDeposits
    } else if (activeSubPage === 'refund-report') {
      data = userRefunds
    }
    return data
  }
  const currentData = getCurrentData()
  const totalPages = Math.ceil(currentData.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedData = currentData.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const generatePageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }
  const pageNumbers = generatePageNumbers()

  // Modal states
  const [showBmShareModal, setShowBmShareModal] = useState(false)
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessGmail, setAccessGmail] = useState('')
  const [accessAccountId, setAccessAccountId] = useState<string | null>(null)

  // Form states
  const [businessType, setBusinessType] = useState<'clean' | 'blackhat'>('clean')
  const [adAccountCount, setAdAccountCount] = useState('1')
  const [adAccounts, setAdAccounts] = useState<{ domain: string; timezone: string; gmail: string; targetMarket: string; deposit: string }[]>([
    { domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }
  ])
  const [applyAdsForm, setApplyAdsForm] = useState({
    licenseNo: '',
    pageNumber: '',
    pageUrl: '',
    domainName: '',
    isApp: 'no',
    domain: 'Https:///ads.google.com',
    hasShopify: 'no',
    adNumber: '',
    adsAccount: 'Https:///ads.google.com',
    timeZone: '',
    depositAmount: '',
    message: ''
  })

  const [bmShareForm, setBmShareForm] = useState({
    bmId: '',
    message: ''
  })

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Deposit form states
  const [depositRows, setDepositRows] = useState<DepositRow[]>([{ id: 1, accountId: '', amount: '' }])

  // Generate ad account options for searchable dropdown (only APPROVED accounts)
  const adAccountOptions = useMemo(() => {
    return userAccounts
      .filter(acc => acc.status === 'APPROVED')
      .map(acc => ({
        value: acc.id,
        label: `${acc.accountName || 'Unknown'} (${acc.accountId || acc.id})`
      }))
  }, [userAccounts])

  // Calculate deposit totals using user's actual commission rate
  const depositTotals = useMemo(() => {
    const totalCharge = depositRows.reduce((sum, row) => {
      const amount = parseInt(row.amount) || 0
      return sum + amount
    }, 0)
    const markupPercent = googleCommissionRate
    const markupAmount = totalCharge * (markupPercent / 100)
    const totalCost = totalCharge + markupAmount
    return { totalCharge, markupPercent, markupAmount, totalCost }
  }, [depositRows, googleCommissionRate])

  // Add new deposit row
  const addDepositRow = () => {
    const newId = Math.max(...depositRows.map(r => r.id)) + 1
    setDepositRows([...depositRows, { id: newId, accountId: '', amount: '' }])
  }

  // Remove deposit row
  const removeDepositRow = (id: number) => {
    if (depositRows.length > 1) {
      setDepositRows(depositRows.filter(r => r.id !== id))
    }
  }

  // Update deposit row
  const updateDepositRow = (id: number, field: 'accountId' | 'amount', value: string) => {
    setDepositRows(depositRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Check if deposit form is valid
  const isDepositFormValid = depositRows.every(row =>
    row.accountId &&
    row.amount &&
    parseFloat(row.amount) >= ADMIN_SETTINGS.minimumDeposit &&
    parseFloat(row.amount) % 50 === 0
  ) && depositTotals.totalCost <= userBalance

  // Handle Deposit Submit
  const handleDepositSubmit = async () => {
    if (!isDepositFormValid) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Submit each deposit row
      for (const row of depositRows) {
        await accountDepositsApi.create(row.accountId, {
          amount: parseFloat(row.amount),
          remarks: `Deposit of $${row.amount}`
        })
      }

      // Reset form
      setDepositRows([{ id: 1, accountId: '', amount: '' }])

      // Refresh user data to update balance and deposits list
      const [userRes, depositsRes] = await Promise.all([
        authApi.me(),
        accountDepositsApi.getAll('GOOGLE')
      ])
      setUser(userRes.user)
      setUserDeposits(depositsRes.deposits || [])
      // Refresh stats immediately to update pending deposits count
      refreshStats()

      showToast('success', 'Deposit Submitted', 'Your deposit request is now pending review.')
      setActiveSubPage('deposit-report')

    } catch (error: any) {
      console.error('Failed to submit deposit:', error)
      setSubmitError(error.message || 'Failed to submit deposit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Transfer balance form state
  const [transferRows, setTransferRows] = useState<{ id: number; fromAccount: string; toAccount: string; amount: string }[]>([
    { id: 1, fromAccount: '', toAccount: '', amount: '' }
  ])

  // Refund form state
  const [refundRows, setRefundRows] = useState<{ id: number; accountId: string; amount: string }[]>([
    { id: 1, accountId: '', amount: '' }
  ])

  // Transfer row functions
  const addTransferRow = () => {
    const newId = Math.max(...transferRows.map(r => r.id), 0) + 1
    setTransferRows([...transferRows, { id: newId, fromAccount: '', toAccount: '', amount: '' }])
  }

  const removeTransferRow = (id: number) => {
    if (transferRows.length > 1) {
      setTransferRows(transferRows.filter(r => r.id !== id))
    }
  }

  const updateTransferRow = (id: number, field: 'fromAccount' | 'toAccount' | 'amount', value: string) => {
    setTransferRows(transferRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Calculate transfer totals
  const transferTotals = useMemo(() => {
    const totalAmount = transferRows.reduce((sum, row) => {
      return sum + (row.amount ? parseFloat(row.amount) : 0)
    }, 0)
    return { totalAmount, totalCost: totalAmount }
  }, [transferRows])

  // Check if transfer form is valid
  const isTransferFormValid = transferRows.every(row =>
    row.fromAccount &&
    row.toAccount &&
    row.fromAccount !== row.toAccount &&
    row.amount &&
    parseFloat(row.amount) >= ADMIN_SETTINGS.minimumDeposit &&
    parseFloat(row.amount) % 50 === 0
  )

  // Handle transfer balance submit
  const handleTransferSubmit = async () => {
    if (!isTransferFormValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      for (const row of transferRows) {
        if (row.fromAccount && row.toAccount && row.amount) {
          await balanceTransfersApi.create({
            fromAccountId: row.fromAccount,
            toAccountId: row.toAccount,
            amount: parseFloat(row.amount)
          })
        }
      }
      setTransferRows([{ id: 1, fromAccount: '', toAccount: '', amount: '' }])
      showToast('success', 'Transfer Submitted', 'Your transfer request is now pending review.')
      refreshStats()
    } catch (error: any) {
      showToast('error', 'Error', error.message || 'Failed to submit transfer request')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Refund row functions
  const addRefundRow = () => {
    const newId = Math.max(...refundRows.map(r => r.id), 0) + 1
    setRefundRows([...refundRows, { id: newId, accountId: '', amount: '' }])
  }

  const removeRefundRow = (id: number) => {
    if (refundRows.length > 1) {
      setRefundRows(refundRows.filter(r => r.id !== id))
    }
  }

  const updateRefundRow = (id: number, field: 'accountId' | 'amount', value: string) => {
    setRefundRows(refundRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  // Check if refund form is valid
  const isRefundFormValid = refundRows.every(row =>
    row.accountId &&
    row.amount &&
    parseFloat(row.amount) >= 1
  )

  // Handle refund submit
  const handleRefundSubmit = async () => {
    if (!isRefundFormValid || isSubmitting) return
    setIsSubmitting(true)
    try {
      for (const row of refundRows) {
        if (row.accountId && row.amount) {
          await accountRefundsApi.create(row.accountId, {
            amount: parseFloat(row.amount),
            reason: 'Refund request'
          })
        }
      }
      setRefundRows([{ id: 1, accountId: '', amount: '' }])
      showToast('success', 'Refund Submitted', 'Your refund request is now pending review.')
      const refundsRes = await accountRefundsApi.getAll('GOOGLE').catch(() => ({ refunds: [] }))
      setUserRefunds(refundsRes.refunds || [])
      refreshStats()
    } catch (error: any) {
      showToast('error', 'Error', error.message || 'Failed to submit refund request')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate costs using user's actual commission rate and opening fee
  const costs = useMemo(() => {
    const totalDeposits = adAccounts.reduce((sum, acc) => sum + parseFloat(acc.deposit || '0'), 0)
    const depositMarkupAmount = totalDeposits * googleCommissionRate / 100
    const depositWithMarkup = totalDeposits + depositMarkupAmount
    const adAccountQty = adAccounts.length
    const openingFeePerAccount = user?.googleFee ? parseFloat(user.googleFee) : 30
    const openingFee = openingFeePerAccount * adAccountQty
    const totalCost = openingFee + depositWithMarkup

    return {
      totalDeposits,
      depositMarkupAmount,
      depositWithMarkup,
      totalCost,
      openingFee,
      commissionRate: googleCommissionRate
    }
  }, [adAccounts, googleCommissionRate, user])

  const toggleSection = (section: MenuSection) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium"
    switch (status) {
      case 'APPROVED':
        return <span className={`${baseClasses} bg-emerald-50 border border-emerald-200 text-emerald-700`}><CheckCircle className="w-3 h-3" /> Approved</span>
      case 'PENDING':
        return <span className={`${baseClasses} bg-amber-50 border border-amber-200 text-amber-700`}><Clock className="w-3 h-3" /> Pending</span>
      case 'REJECTED':
        return <span className={`${baseClasses} bg-red-50 border border-red-200 text-red-700`}><XCircle className="w-3 h-3" /> Rejected</span>
      default:
        return <span className={`${baseClasses} bg-gray-50 border border-gray-200 text-gray-600`}>{status}</span>
    }
  }

  const menuItems = [
    {
      section: 'account-manage' as MenuSection,
      title: 'Account Manage',
      icon: <AccountManageIcon />,
      items: [
        { id: 'apply-ads-account' as SubPage, label: 'Apply Ads Account' },
        { id: 'account-list' as SubPage, label: 'Account List' },
        { id: 'account-applied-records' as SubPage, label: 'Account Applied Records' },
        { id: 'bm-share-log' as SubPage, label: 'Access Share Log' },
      ]
    },
    {
      section: 'deposit-manage' as MenuSection,
      title: 'Deposit Manage',
      icon: <DepositManageIcon />,
      items: [
        { id: 'deposit' as SubPage, label: 'Deposit' },
        { id: 'deposit-report' as SubPage, label: 'Deposit Records' },
      ]
    },
    {
      section: 'after-sale' as MenuSection,
      title: 'After Sale',
      icon: <AfterSaleIcon />,
      items: [
        { id: 'transfer-balance' as SubPage, label: 'Transfer Balance' },
        { id: 'refund' as SubPage, label: 'Refund' },
        { id: 'refund-report' as SubPage, label: 'Refund Report' },
      ]
    }
  ]

  return (
    <DashboardLayout title="Google User Management Account" subtitle="">
      {/* Show Coming Soon if platform disabled and no existing accounts */}
      {!platformEnabled && !hasExistingAccounts ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 flex items-center justify-center text-[#4285F4]">
              <ComingSoonIcon />
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</p>
            <p className="text-base text-gray-600 mb-4">Google Ads platform is currently unavailable</p>
            <p className="text-sm text-gray-400">Please check back later or contact support for more information</p>
          </div>
        </div>
      ) : (
      <div className="flex flex-col h-full">
      {/* Add global styles for animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4); }
          50% { box-shadow: 0 0 20px 5px rgba(66, 133, 244, 0.2); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.3s ease-out forwards; }
        .animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
        .table-row-animate { animation: fadeInUp 0.3s ease-out forwards; }
        .table-row-animate:nth-child(1) { animation-delay: 0.05s; }
        .table-row-animate:nth-child(2) { animation-delay: 0.1s; }
        .table-row-animate:nth-child(3) { animation-delay: 0.15s; }
        .table-row-animate:nth-child(4) { animation-delay: 0.2s; }
        .table-row-animate:nth-child(5) { animation-delay: 0.25s; }
        .table-row-animate:nth-child(6) { animation-delay: 0.3s; }
        .table-row-animate:nth-child(7) { animation-delay: 0.35s; }
        .table-row-animate:nth-child(8) { animation-delay: 0.4s; }
        .stat-card { transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(66, 133, 244, 0.15); }
        .brand-glow { animation: pulse-glow 3s ease-in-out infinite; }
      `}</style>

      {/* Row 1: Header Bar - Compact */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-xl shadow-sm border border-gray-100/50">
        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-[#4285F4]/20 focus:border-[#4285F4] focus:bg-white transition-all"
          />
        </div>

        {/* Filters */}
        <div className="w-36">
          <Select
            options={dateFilterOptions}
            value={dateFilter}
            onChange={setDateFilter}
            placeholder="Date and Time"
            size="sm"
            
          />
        </div>
        <div className="w-28">
          <Select
            options={actionFilterOptions}
            value={actionFilter}
            onChange={setActionFilter}
            placeholder="Action"
            size="sm"
            
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Export Dropdown */}
        <div className="relative" ref={exportDropdownRef}>
          <Button
            variant="outline"
            className="border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 whitespace-nowrap text-xs px-3 py-1.5 h-auto"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
            <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform duration-200 ${showExportDropdown ? 'rotate-180' : ''}`} />
          </Button>

          {showExportDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="py-1">
                {exportOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      exportToExcel(option.id)
                      setShowExportDropdown(false)
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left text-gray-700 hover:bg-[#4285F4]/10 hover:text-[#4285F4] transition-colors duration-150 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={() => setActiveSubPage('apply-ads-account')}
          className={`bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-md shadow-sm whitespace-nowrap text-xs px-3 py-1.5 h-auto`}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Ads Account
        </Button>
      </div>

      {/* Row 2: Stats Cards - Compact with Real-time Updates */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-3 lg:mb-4">
        {statsData.map((stat, index) => (
          <Card key={index} className="stat-card p-2.5 lg:p-4 border border-gray-100 bg-white rounded-xl relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]">
            {/* Top row: Title and Badge */}
            <div className="flex items-center justify-between mb-1.5 lg:mb-2">
              <p className="text-[11px] lg:text-sm text-gray-500 font-medium">{stat.label}</p>
              {stat.badge !== 'None' && (
                <span className={`text-[8px] lg:text-[10px] px-1.5 lg:px-2.5 py-0.5 lg:py-1 rounded-full font-semibold whitespace-nowrap transition-all duration-500 ${
                  stat.trend === 'up'
                    ? 'bg-[#22C55E] text-white animate-pulse'
                    : stat.trend === 'down'
                      ? 'bg-[#EF4444] text-white animate-pulse'
                      : 'bg-blue-100 text-blue-600'
                }`}>
                  {stat.badge}
                </span>
              )}
            </div>
            {/* Bottom row: Number on left, Chart on right */}
            <div className="flex items-end justify-between">
              <p className="text-lg lg:text-2xl font-bold text-gray-900 tabular-nums">
                <AnimatedCounter value={stat.numericValue} duration={600} />
              </p>
              {/* Chart container - positioned on the right with smooth transitions */}
              <div className="w-16 h-8 lg:w-24 lg:h-12 relative hidden sm:block">
                <svg viewBox="0 0 100 50" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`stat-gradient-google-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={stat.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={stat.color} stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  {/* Area fill with transition */}
                  <path
                    d={`${stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')} L100,50 L0,50 Z`}
                    fill={`url(#stat-gradient-google-${index})`}
                    className="transition-all duration-700 ease-in-out"
                  />
                  {/* Line stroke with transition */}
                  <path
                    d={stat.chartPath.replace(/120/g, '100').replace(/40/g, '50').replace(/38/g, '48')}
                    fill="none"
                    stroke={stat.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-700 ease-in-out"
                  />
                </svg>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Row 3: Main Content */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Balanced size, scroll only on small screens */}
        <div className="w-64 lg:w-72 flex-shrink-0 hidden md:block">
          <Card className="p-4 h-full border border-gray-100/50 bg-gradient-to-b from-white to-gray-50/50 relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-[#4285F4]/5 via-transparent to-[#52B788]/5" />

            {/* Google Logo - Larger and balanced */}
            <div className="relative z-10 flex flex-col items-center mb-4 pb-4 border-b border-gray-100 flex-shrink-0">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg shadow-blue-500/20 border border-gray-100">
                  <svg viewBox="0 0 24 24" className="w-8 h-8">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-100">
                  <div className="w-4 h-4 bg-[#52B788] rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-600">Ad Management</p>
            </div>

            {/* Navigation Menu - Scroll only on small screens */}
            <div className="relative z-10 space-y-2 overflow-y-auto flex-1 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
              {menuItems.map((menu) => (
                <div key={menu.section}>
                  <button
                    onClick={() => toggleSection(menu.section)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#4285F4]/5 rounded-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{menu.icon}</span>
                      <span>{menu.title}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 transition-all duration-300 ${
                        expandedSections.includes(menu.section)
                          ? 'rotate-180 text-[#4285F4]'
                          : 'rotate-0 text-gray-400'
                      }`}
                    />
                  </button>

                  <div
                    className={`ml-5 space-y-1 border-l-2 border-[#4285F4]/20 pl-4 overflow-hidden transition-all duration-300 ease-in-out ${
                      expandedSections.includes(menu.section)
                        ? 'max-h-96 opacity-100 mt-1'
                        : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    {menu.items.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveSubPage(item.id)
                          setCurrentPage(1)
                        }}
                        style={{
                          animationDelay: `${index * 50}ms`,
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-200 ease-out transform hover:translate-x-0.5 active:scale-95 ${
                          expandedSections.includes(menu.section) ? 'animate-slideIn' : ''
                        } ${
                          activeSubPage === item.id
                            ? 'bg-gradient-to-r from-[#4285F4] to-[#3367D6] text-white font-medium shadow-md shadow-blue-200'
                            : 'text-gray-600 hover:bg-[#4285F4]/5 hover:text-[#4285F4]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Content - Scrollable Form */}
        <Card className="flex-1 p-0 rounded-2xl overflow-hidden border border-gray-100/50 shadow-sm flex flex-col min-h-0">
          {/* Scrollable Content Area */}
          <div className="overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-white to-gray-50/30">
              {/* Apply Ads Account Form */}
              {activeSubPage === 'apply-ads-account' && (
                <>
                  {/* Show message if platform stopped - user can see but can't apply */}
                  {platformStopped ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#F59E0B]/10 to-[#EF4444]/10 flex items-center justify-center">
                        <span className="text-3xl">⏸️</span>
                      </div>
                      <p className="text-lg font-semibold text-gray-700">New Applications Paused</p>
                      <p className="text-sm text-gray-500 mt-2">New ad account applications are temporarily paused</p>
                      {hasExistingAccounts && (
                        <p className="text-xs text-gray-400 mt-3">You can still manage your existing accounts through the menu</p>
                      )}
                    </div>
                  ) : !platformEnabled && hasExistingAccounts ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#4285F4]/10 to-[#34A853]/10 flex items-center justify-center text-[#4285F4]">
                        <ComingSoonIcon />
                      </div>
                      <p className="text-lg font-semibold text-gray-700">Coming Soon</p>
                      <p className="text-sm text-gray-500 mt-2">New account applications are currently disabled</p>
                      <p className="text-xs text-gray-400 mt-3">You can still manage your existing accounts through the menu</p>
                    </div>
                  ) : (
                <div className="px-8 py-6 space-y-6">
                  {/* Business Type Toggle */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">Business Type</label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setBusinessType('clean')}
                        className={`flex-1 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                          businessType === 'clean'
                            ? 'bg-gradient-to-r from-[#4285F4] to-[#3367D6] text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Clean Business (White Hat)
                      </button>
                      <button
                        onClick={() => setBusinessType('blackhat')}
                        className={`flex-1 px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                          businessType === 'blackhat'
                            ? 'bg-gradient-to-r from-[#1F2937] to-[#374151] text-white shadow-lg shadow-gray-500/30'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Black Hat
                      </button>
                    </div>
                  </div>

                  {/* Ad Num Selector */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-800">
                      <span className="text-red-500">*</span> Ad Num
                    </label>
                    <Select
                      options={[
                        { value: '1', label: '1' },
                        { value: '2', label: '2' },
                        { value: '3', label: '3' },
                        { value: '4', label: '4' },
                        { value: '5', label: '5' },
                      ]}
                      value={adAccountCount}
                      onChange={(value) => {
                        setAdAccountCount(value)
                        const count = parseInt(value)
                        setAdAccounts(Array.from({ length: count }, (_, i) =>
                          adAccounts[i] || { domain: '', timezone: '', gmail: '', targetMarket: '', deposit: '50' }
                        ))
                      }}
                      placeholder="Select number of accounts"
                    />
                  </div>

                  {/* Ad Account Fields */}
                  <div className="space-y-6">
                    {adAccounts.map((account, index) => (
                      <div key={index} className="p-5 bg-gradient-to-br from-[#4285F4]/5 to-[#34A853]/5 rounded-xl border border-[#4285F4]/10 space-y-4">
                        {/* Clean Business Fields */}
                        {businessType === 'clean' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.clean domain</label>
                              <input
                                type="text"
                                placeholder="Please enter domain"
                                value={account.domain}
                                onChange={(e) => {
                                  const updated = [...adAccounts]
                                  updated[index].domain = e.target.value
                                  setAdAccounts(updated)
                                }}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.ads timezone</label>
                              <SearchableSelect
                                options={timezoneOptions}
                                value={account.timezone}
                                onChange={(value) => {
                                  const updated = [...adAccounts]
                                  updated[index].timezone = value
                                  setAdAccounts(updated)
                                }}
                                placeholder="Select Timezone"
                                searchPlaceholder="Type to search (e.g., kol)"
                              />
                            </div>
                          </div>
                        )}

                        {/* Common Fields for both types */}
                        <div className="grid grid-cols-2 gap-4">
                          {businessType === 'blackhat' && (
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.ads timezone</label>
                              <SearchableSelect
                                options={timezoneOptions}
                                value={account.timezone}
                                onChange={(value) => {
                                  const updated = [...adAccounts]
                                  updated[index].timezone = value
                                  setAdAccounts(updated)
                                }}
                                placeholder="Select Timezone"
                                searchPlaceholder="Type to search (e.g., kol)"
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700">{index + 1}.gmail</label>
                            <input
                              type="email"
                              placeholder="Please enter Ads Gmail"
                              value={account.gmail}
                              onChange={(e) => {
                                const updated = [...adAccounts]
                                updated[index].gmail = e.target.value
                                setAdAccounts(updated)
                              }}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                            />
                          </div>
                          {businessType === 'clean' && (
                            <div className="space-y-1">
                              <label className="block text-sm font-medium text-gray-700">{index + 1}.target market</label>
                              <SearchableSelect
                                options={countryOptions}
                                value={account.targetMarket}
                                onChange={(value) => {
                                  const updated = [...adAccounts]
                                  updated[index].targetMarket = value
                                  setAdAccounts(updated)
                                }}
                                placeholder="Select Country"
                                searchPlaceholder="Type to search (e.g., United States)"
                              />
                            </div>
                          )}
                        </div>

                        {/* Deposit Field */}
                        <div className="space-y-1">
                          <label className="block text-sm font-medium text-gray-700">{index + 1}.ads deposit</label>
                          <Select
                            options={[
                              { value: '50', label: '$50' },
                              { value: '100', label: '$100' },
                              { value: '200', label: '$200' },
                              { value: '500', label: '$500' },
                              { value: '1000', label: '$1000' },
                            ]}
                            value={account.deposit}
                            onChange={(value) => {
                              const updated = [...adAccounts]
                              updated[index].deposit = value
                              setAdAccounts(updated)
                            }}
                            placeholder="Please enter Ads Deposit"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cost Summary - Compact (matches Facebook style) */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Cost Items - Inline */}
                    <div className="px-3 py-2 bg-gray-50 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] lg:text-xs">
                      <span className="text-gray-500">Fee: <span className="font-medium text-gray-700">${costs.openingFee.toFixed(2)}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">Deposit: <span className="font-medium text-gray-700">${costs.totalDeposits}</span></span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">{costs.commissionRate}%: <span className="font-medium text-[#F59E0B]">+${costs.depositMarkupAmount.toFixed(2)}</span></span>
                    </div>
                    {/* Total Row */}
                    <div className="px-3 py-2 bg-white flex items-center justify-between border-t border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] lg:text-xs text-gray-500">Total:</span>
                          <span className="text-sm lg:text-base font-bold text-[#52B788]">${costs.totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] lg:text-xs text-gray-500">Bal:</span>
                          <span className="text-sm lg:text-base font-bold text-[#3B82F6]">${userBalance.toLocaleString()}</span>
                        </div>
                      </div>
                      {userBalance < costs.totalCost && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-[#EF4444]/10 text-[#EF4444]">
                          Insufficient
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error/Success Messages */}
                  {submitError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-[10px] lg:text-xs text-red-700 font-medium text-center">
                        {submitError}
                      </p>
                    </div>
                  )}
                  {/* Submit Button */}
                  <Button
                    className={`w-full bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-lg py-2.5 text-xs lg:text-sm font-semibold shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={userBalance < costs.totalCost || isSubmitting}
                    onClick={handleSubmitApplication}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </span>
                    ) : userBalance < costs.totalCost ? (
                      'Insufficient Balance'
                    ) : (
                      `Pay $${costs.totalCost.toFixed(2)} & Submit`
                    )}
                  </Button>
                </div>
                  )}
                </>
              )}

              {/* Account List Cards */}
              {activeSubPage === 'account-list' && (
                <div className="p-6">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Your Ad Accounts</h3>
                      <p className="text-sm text-gray-500 mt-1">Manage your Google advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Total:</span>
                      <span className="px-3 py-1 bg-[#4285F4]/10 text-[#4285F4] rounded-full text-sm font-semibold">{userAccounts.length} accounts</span>
                    </div>
                  </div>

                  {/* Account Cards Grid */}
                  <div className="grid gap-4">
                    {userAccounts.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4285F4]/10 flex items-center justify-center">
                          <span className="text-2xl">📊</span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">No Ad Accounts Yet</h4>
                        <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                          You don't have any approved ad accounts. Apply for a new ad account to get started.
                        </p>
                        <button
                          onClick={() => setActiveSubPage('apply-ads-account')}
                          className="px-4 py-2 bg-[#4285F4] text-white rounded-lg text-sm font-medium hover:bg-[#3367D6] transition-colors"
                        >
                          Apply for Ad Account
                        </button>
                      </div>
                    ) : userAccounts.map((item: any, index: number) => (
                      <div
                        key={item.id}
                        className="table-row-animate p-4 bg-white border border-gray-100 rounded-xl hover:border-[#4285F4]/30 hover:shadow-lg hover:shadow-[#4285F4]/5 transition-all duration-300 group"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="grid grid-cols-3 items-center gap-4">
                          {/* Left Side - Account Info */}
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Account Avatar */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center group-hover:from-[#4285F4]/20 group-hover:to-[#4285F4]/10 transition-all flex-shrink-0">
                              <span className="text-lg font-bold text-[#4285F4]">{(item.accountName || 'G').charAt(0).toUpperCase()}</span>
                            </div>

                            {/* Account Details */}
                            <div className="space-y-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-800">{item.accountName || 'Google Ad Account'}</h4>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-gray-500">License:</span>
                                <span className="text-gray-700 font-medium">{item.licenseName || item.license || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Center - Account ID */}
                          <div className="flex justify-center">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg">
                              <span className="text-xs text-gray-500">ID:</span>
                              <span className="text-sm text-[#4285F4] font-mono font-semibold">{item.accountId}</span>
                            </div>
                          </div>

                          {/* Right Side - Actions */}
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              className="px-4 py-2 bg-[#4285F4]/10 text-[#4285F4] rounded-lg text-sm font-medium hover:bg-[#4285F4] hover:text-white transition-all duration-200"
                              onClick={() => {
                                setAccessAccountId(item.id)
                                setAccessGmail('')
                                setShowAccessModal(true)
                              }}
                            >
                              Access
                            </button>
                            <button
                              className="px-4 py-2 bg-[#52B788]/10 text-[#52B788] rounded-lg text-sm font-medium hover:bg-[#52B788] hover:text-white transition-all duration-200"
                              onClick={() => setActiveSubPage('deposit')}
                            >
                              Deposit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Applied Records Table */}
              {activeSubPage === 'account-applied-records' && (
                <>
                  {loading ? (
                    <div className="p-10 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#4285F4] mx-auto mb-4" />
                      <p className="text-sm text-gray-500">Loading applications...</p>
                    </div>
                  ) : paginatedData.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-lg font-semibold text-gray-700">No Applications Yet</p>
                      <p className="text-sm text-gray-500 mt-2">Submit your first ad account application to get started</p>
                      <Button
                        onClick={() => setActiveSubPage('apply-ads-account')}
                        className={`mt-4 bg-gradient-to-r ${brandGradient} text-white`}
                      >
                        Apply for Ad Account
                      </Button>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Apply ID</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">License</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Time</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Accounts</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedData.map((item: any) => {
                          const createdDate = new Date(item.createdAt)
                          const dateStr = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')
                          const timeStr = createdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          return (
                            <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0 }}>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700 font-mono">{item.applyId}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 hidden sm:table-cell">
                                <div className="flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] lg:text-[10px] font-semibold ${
                                    item.licenseType === 'NEW' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {item.licenseType}
                                  </span>
                                  <span className="text-[10px] lg:text-xs text-gray-700 truncate max-w-[80px]">{item.licenseNo || '-'}</span>
                                </div>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">
                                <span className="text-[10px] lg:text-xs">
                                  <span className="text-gray-700 hidden lg:inline">{dateStr}/</span>
                                  <span className="text-[#4285F4] font-medium">{timeStr}</span>
                                </span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700 font-medium">${parseFloat(item.totalCost).toFixed(2)}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 hidden md:table-cell">
                                <span className="px-1.5 py-0.5 bg-[#4285F4]/10 text-[#4285F4] rounded text-[9px] lg:text-xs font-semibold">
                                  {item.adAccountQty}
                                </span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">{getStatusBadge(item.status)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Access Share Log Table */}
              {activeSubPage === 'bm-share-log' && (
                <>
                  {loading ? (
                    <div className="p-10 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#4285F4] mx-auto mb-4" />
                      <p className="text-sm text-gray-500">Loading access requests...</p>
                    </div>
                  ) : paginatedData.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-lg font-semibold text-gray-700">No Access Requests Yet</p>
                      <p className="text-sm text-gray-500 mt-2">Use the Access button on your accounts to request Gmail access</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Request ID</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Gmail ID</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                          <th className="text-left py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginatedData.map((item: any) => {
                          const createdDate = new Date(item.createdAt)
                          const dateStr = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/')
                          const timeStr = createdDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          return (
                            <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0 }}>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700 font-mono">{item.applyId}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4 text-[10px] lg:text-xs text-gray-700">{item.adAccountName}</td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">
                                <span className="text-[10px] lg:text-xs text-[#4285F4] font-medium">{item.bmId}</span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">
                                <span className="text-[10px] lg:text-xs">
                                  <span className="text-gray-700 hidden lg:inline">{dateStr}/</span>
                                  <span className="text-[#4285F4] font-medium">{timeStr}</span>
                                </span>
                              </td>
                              <td className="py-2.5 lg:py-3 px-3 lg:px-4">{getStatusBadge(item.status)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}

              {/* Deposit Form */}
              {activeSubPage === 'deposit' && (
                <div className="p-4 space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit to Ad Account</h3>
                      <p className="text-sm text-gray-500 mt-1">Add funds to your Google advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4285F4]/10 to-[#4285F4]/5 rounded-xl border border-[#4285F4]/20">
                        <Wallet className="w-4 h-4 text-[#4285F4]" />
                        <span className="text-sm text-gray-600">Wallet Balance:</span>
                        <span className="text-sm font-bold text-[#4285F4]">${userBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deposit Rows */}
                  <div className="space-y-3">
                    {depositRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-3.5 bg-white border border-gray-100 rounded-xl hover:border-[#4285F4]/30 hover:shadow-lg hover:shadow-[#4285F4]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: depositRows.length - index }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#4285F4]">{index + 1}</span>
                          </div>

                          {/* Ad Account Select */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">Choose Ad Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                !depositRows.some(r => r.id !== row.id && r.accountId === opt.value)
                              )}
                              value={row.accountId}
                              onChange={(value) => updateDepositRow(row.id, 'accountId', value)}
                              placeholder="Search ad account name or ID..."
                              searchPlaceholder="Type to search..."
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Deposit Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min={ADMIN_SETTINGS.minimumDeposit}
                                step="50"
                                value={row.amount}
                                onChange={(e) => updateDepositRow(row.id, 'amount', e.target.value)}
                                placeholder={`Min $${ADMIN_SETTINGS.minimumDeposit} (50s)`}
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < ADMIN_SETTINGS.minimumDeposit && (
                              <p className="text-xs text-red-500 mt-1">Minimum deposit is ${ADMIN_SETTINGS.minimumDeposit}</p>
                            )}
                            {row.amount && parseFloat(row.amount) % 50 !== 0 && (
                              <p className="text-xs text-red-500 mt-1">Amount must be in $50 increments</p>
                            )}
                          </div>

                          {/* Remove Button */}
                          <div className="flex-shrink-0 pt-5">
                            {depositRows.length > 1 && (
                              <button
                                onClick={() => removeDepositRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    onClick={addDepositRow}
                    className="w-full p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#4285F4]/50 hover:text-[#4285F4] hover:bg-[#4285F4]/5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Another Ad Account</span>
                  </button>

                  {/* Cost Breakdown */}
                  <div className="p-3.5 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-700">Cost Breakdown</h4>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Deposit Amount</span>
                        <span className="text-gray-700 font-medium">${depositTotals.totalCharge.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Service Fee ({depositTotals.markupPercent}%)</span>
                        <span className="text-[#4285F4] font-medium">+${depositTotals.markupAmount.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">Total Cost</span>
                          <span className="text-lg font-bold text-[#34A853]">${depositTotals.totalCost.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Info */}
                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#4285F4]/5 to-[#4285F4]/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#4285F4]" />
                        <span className="text-sm text-gray-600">Your Wallet Balance</span>
                      </div>
                      <span className="text-sm font-bold text-[#4285F4]">${userBalance.toLocaleString()}</span>
                    </div>

                    {depositTotals.totalCost > userBalance && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">Insufficient balance. Please add funds to your wallet.</p>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button
                    className={`w-full bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-xl py-3.5 text-base font-semibold shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed`}
                    disabled={!isDepositFormValid || isSubmitting}
                    onClick={handleDepositSubmit}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </span>
                    ) : depositTotals.totalCost > userBalance ? (
                      'Insufficient Balance'
                    ) : depositRows.some(r => !r.accountId || !r.amount) ? (
                      'Select Ad Account & Amount'
                    ) : (
                      `Submit Deposit Request ($${depositTotals.totalCost.toFixed(2)})`
                    )}
                  </Button>

                  {/* Error Message */}
                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 font-medium text-center">{submitError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Deposit Records Table */}
              {activeSubPage === 'deposit-report' && (
                <div className="p-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Deposit Records</h3>
                      <p className="text-sm text-gray-500 mt-0.5">View all your ad account deposit requests and their status</p>
                    </div>
                  </div>

                  {paginatedData.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#34A853]/10 flex items-center justify-center">
                        <Wallet className="w-8 h-8 text-[#34A853]" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">No Deposit Records</h4>
                      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                        You haven't made any deposits to your ad accounts yet.
                      </p>
                      <button
                        onClick={() => setActiveSubPage('deposit')}
                        className="px-4 py-2 bg-[#34A853] text-white rounded-lg text-sm font-medium hover:bg-[#2d8f47] transition-colors"
                      >
                        Make a Deposit
                      </button>
                    </div>
                  ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Apply ID</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ads Account</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#34A853] uppercase tracking-wider">Deposit</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#FBBC04] uppercase tracking-wider">Fee</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Total</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Request Time</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedData.map((item: any, index: number) => {
                        const depositAmount = parseFloat(item.amount) || 0
                        const commissionRate = item.commissionRate || 0
                        const commissionAmount = item.commissionAmount || 0
                        const totalDeducted = depositAmount + commissionAmount
                        return (
                        <tr key={item.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                          <td className="py-2.5 px-3">
                            <code className="text-xs font-mono text-[#4285F4] bg-[#4285F4]/10 px-2 py-0.5 rounded font-semibold">
                              {item.applyId || '-'}
                            </code>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              <p className="text-sm text-gray-700 font-medium">{item.adAccount?.accountName || '-'}</p>
                              <p className="text-xs text-gray-400 font-mono">{item.adAccount?.accountId || '-'}</p>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-sm font-semibold text-[#34A853]">${depositAmount.toLocaleString()}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              <span className="text-sm font-semibold text-[#FBBC04]">${commissionAmount.toFixed(2)}</span>
                              {commissionRate > 0 && (
                                <p className="text-xs text-gray-400">({commissionRate}%)</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-sm font-bold text-[#4285F4]">${totalDeducted.toFixed(2)}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-sm text-gray-700">
                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{getStatusBadge(item.status)}</td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              )}

              {/* Transfer Balance Form */}
              {activeSubPage === 'transfer-balance' && (
                <div className="p-4 space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Transfer Balance</h3>
                      <p className="text-sm text-gray-500 mt-1">Transfer balance between your advertising accounts</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4285F4]/10 to-[#4285F4]/5 rounded-xl border border-[#4285F4]/20">
                      <Wallet className="w-4 h-4 text-[#4285F4]" />
                      <span className="text-sm text-gray-600">Wallet Balance:</span>
                      <span className="text-sm font-bold text-[#4285F4]">${userBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Transfer Rows */}
                  <div className="space-y-4">
                    {transferRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-3.5 bg-white border border-gray-100 rounded-xl hover:border-[#4285F4]/30 hover:shadow-lg hover:shadow-[#4285F4]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: transferRows.length - index }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#4285F4]">{index + 1}</span>
                          </div>

                          {/* From Account */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">From Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                opt.value !== row.toAccount &&
                                !transferRows.some(r => r.id !== row.id && r.fromAccount === opt.value)
                              )}
                              value={row.fromAccount}
                              onChange={(value) => updateTransferRow(row.id, 'fromAccount', value)}
                              placeholder="Search account..."
                              searchPlaceholder="Type to search..."
                            />
                          </div>

                          {/* Transfer Icon */}
                          <div className="flex-shrink-0 pt-5">
                            <svg className="w-5 h-5 text-[#4285F4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>

                          {/* To Account */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">To Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                opt.value !== row.fromAccount &&
                                !transferRows.some(r => r.id !== row.id && r.toAccount === opt.value)
                              )}
                              value={row.toAccount}
                              onChange={(value) => updateTransferRow(row.id, 'toAccount', value)}
                              placeholder="Search account..."
                              searchPlaceholder="Type to search..."
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Transfer Amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min={ADMIN_SETTINGS.minimumDeposit}
                                step="50"
                                value={row.amount}
                                onChange={(e) => updateTransferRow(row.id, 'amount', e.target.value)}
                                placeholder={`Min $${ADMIN_SETTINGS.minimumDeposit} (50s)`}
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < ADMIN_SETTINGS.minimumDeposit && (
                              <p className="text-xs text-red-500 mt-1">Min ${ADMIN_SETTINGS.minimumDeposit}</p>
                            )}
                            {row.amount && parseFloat(row.amount) % 50 !== 0 && (
                              <p className="text-xs text-red-500 mt-1">Must be $50 increments</p>
                            )}
                          </div>

                          {/* Remove Button */}
                          <div className="flex-shrink-0 pt-5">
                            {transferRows.length > 1 && (
                              <button
                                onClick={() => removeTransferRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Button */}
                  <button
                    onClick={addTransferRow}
                    className="w-full p-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#4285F4]/50 hover:text-[#4285F4] hover:bg-[#4285F4]/5 transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="font-medium">Add Another Transfer</span>
                  </button>

                  {/* Transfer Summary */}
                  <div className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">Transfer Summary</h4>
                    <div className="space-y-3 mb-4">
                      {transferRows.filter(row => row.fromAccount && row.toAccount && row.amount).map((row, index) => {
                        const fromLabel = adAccountOptions.find(opt => opt.value === row.fromAccount)?.label || 'Unknown'
                        const toLabel = adAccountOptions.find(opt => opt.value === row.toAccount)?.label || 'Unknown'
                        return (
                          <div key={row.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-[#4285F4]/10 text-[#4285F4] text-xs font-bold flex items-center justify-center flex-shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600 truncate">
                                <span className="font-medium text-gray-700 truncate max-w-[120px]" title={fromLabel}>{fromLabel}</span>
                                <svg className="w-3 h-3 text-[#4285F4] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span className="font-medium text-gray-700 truncate max-w-[120px]" title={toLabel}>{toLabel}</span>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-[#4285F4] ml-3">${parseFloat(row.amount).toFixed(2)}</span>
                          </div>
                        )
                      })}
                      {transferRows.filter(row => row.fromAccount && row.toAccount && row.amount).length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">No transfers added yet</p>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-700">Total Transfer Amount</span>
                      <span className="text-lg font-bold text-[#4285F4]">${transferTotals.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleTransferSubmit}
                    disabled={!isTransferFormValid || isSubmitting}
                    className={`w-full bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-xl py-3 text-base font-semibold shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Transfers'}
                  </button>
                </div>
              )}

              {/* Refund Form */}
              {activeSubPage === 'refund' && (
                <div className="p-4 space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Ads Refund Request</h3>
                      <p className="text-sm text-gray-500 mt-1">Request a refund for your ad account balance</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4285F4]/10 to-[#4285F4]/5 rounded-xl border border-[#4285F4]/20">
                      <Wallet className="w-4 h-4 text-[#4285F4]" />
                      <span className="text-sm text-gray-600">Wallet Balance:</span>
                      <span className="text-sm font-bold text-[#4285F4]">${userBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Refund Rows */}
                  <div className="space-y-4">
                    {refundRows.map((row, index) => (
                      <div
                        key={row.id}
                        className="table-row-animate p-3.5 bg-white border border-gray-100 rounded-xl hover:border-[#4285F4]/30 hover:shadow-lg hover:shadow-[#4285F4]/5 transition-all duration-300 overflow-visible"
                        style={{ opacity: 0, animationDelay: `${index * 0.05}s`, position: 'relative', zIndex: refundRows.length - index }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Row Number */}
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4285F4]/10 to-[#4285F4]/5 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-[#4285F4]">{index + 1}</span>
                          </div>

                          {/* Ad Account Select */}
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1.5">Ad Account</label>
                            <SearchableSelect
                              options={adAccountOptions.filter(opt =>
                                !refundRows.some(r => r.id !== row.id && r.accountId === opt.value)
                              )}
                              value={row.accountId}
                              onChange={(value) => updateRefundRow(row.id, 'accountId', value)}
                              placeholder="Select Ads Account"
                              searchPlaceholder="Type to search..."
                            />
                          </div>

                          {/* Amount Input */}
                          <div className="w-48">
                            <label className="block text-xs text-gray-500 mb-1.5">Money</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={row.amount}
                                onChange={(e) => updateRefundRow(row.id, 'amount', e.target.value)}
                                placeholder="Enter Amount"
                                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] transition-all"
                              />
                            </div>
                            {row.amount && parseFloat(row.amount) < 1 && (
                              <p className="text-xs text-red-500 mt-1">Min $1</p>
                            )}
                          </div>

                          {/* Add/Remove Buttons */}
                          <div className="flex-shrink-0 pt-5 flex gap-2">
                            <button
                              onClick={addRefundRow}
                              className="p-2 text-[#34A853] hover:text-white hover:bg-[#34A853] rounded-lg transition-all duration-200"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                            {refundRows.length > 1 && (
                              <button
                                onClick={() => removeRefundRow(row.id)}
                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                              >
                                <Minus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleRefundSubmit}
                    disabled={!isRefundFormValid || isSubmitting}
                    className={`w-full bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] text-white rounded-xl py-3 text-base font-semibold shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              )}

              {/* Refund Report - With tabs for Transfer and Refund History */}
              {activeSubPage === 'refund-report' && (
                <div className="p-4">
                  {/* Header with Tabs */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {reportTab === 'transfer' ? 'Balance Transfer History' : 'Refund Request History'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {reportTab === 'transfer'
                          ? 'View all your balance transfers between ad accounts'
                          : 'View all your refund requests and their status'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
                      <button
                        onClick={() => setReportTab('transfer')}
                        className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                          reportTab === 'transfer'
                            ? 'bg-white text-[#4285F4] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Transfer History
                      </button>
                      <button
                        onClick={() => setReportTab('refund')}
                        className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                          reportTab === 'refund'
                            ? 'bg-white text-[#EA4335] shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Refund History
                      </button>
                    </div>
                  </div>

                  {/* Transfer History */}
                  {reportTab === 'transfer' && (
                    <>
                      {balanceTransfers.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4285F4]/10 flex items-center justify-center">
                            <svg className="w-8 h-8 text-[#4285F4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-2">No Transfer History</h4>
                          <p className="text-sm text-gray-500 mb-4">You haven't made any balance transfers yet.</p>
                          <button
                            onClick={() => setActiveSubPage('transfer-balance')}
                            className="px-4 py-2 bg-[#4285F4] text-white rounded-lg text-sm font-medium hover:bg-[#3367D6] transition-colors"
                          >
                            Transfer Balance
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#4285F4]/5 to-gray-50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">From Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">To Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-[#4285F4] uppercase tracking-wider">Amount</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {balanceTransfers.map((transfer: any, index: number) => (
                                <tr key={transfer.id} className="table-row-animate hover:bg-[#4285F4]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                                  <td className="py-2 px-3">
                                    <div className="text-sm text-gray-700 font-medium">{transfer.fromAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{transfer.fromAccount?.accountId || '-'}</div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <svg className="w-4 h-4 text-[#4285F4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="text-sm text-gray-700 font-medium">{transfer.toAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{transfer.toAccount?.accountId || '-'}</div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-sm font-semibold text-[#4285F4]">${Number(transfer.amount).toFixed(2)}</span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-xs text-gray-600">
                                      {new Date(transfer.createdAt).toLocaleDateString()}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">{getStatusBadge(transfer.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {/* Refund History */}
                  {reportTab === 'refund' && (
                    <>
                      {userRefunds.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#EA4335]/10 flex items-center justify-center">
                            <span className="text-2xl">💸</span>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-2">No Refund Requests</h4>
                          <p className="text-sm text-gray-500 mb-4">You haven't made any refund requests yet.</p>
                          <button
                            onClick={() => setActiveSubPage('refund')}
                            className="px-4 py-2 bg-[#EA4335] text-white rounded-lg text-sm font-medium hover:bg-[#D32F2F] transition-colors"
                          >
                            Request a Refund
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#EA4335]/5 to-gray-50">
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-[#EA4335] uppercase tracking-wider">Amount</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {userRefunds.map((item: any, index: number) => (
                                <tr key={item.id} className="table-row-animate hover:bg-[#EA4335]/5 transition-all duration-300" style={{ opacity: 0, animationDelay: `${index * 0.05}s` }}>
                                  <td className="py-2 px-3">
                                    <div className="text-sm text-gray-700 font-medium">{item.adAccount?.accountName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400 font-mono">{item.adAccount?.accountId || item.accountId || '-'}</div>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-sm font-semibold text-[#EA4335]">${Number(item.amount).toFixed(2)}</span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-xs text-gray-600">
                                      {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">{getStatusBadge(item.status)}</td>
                                  <td className="py-2 px-3">
                                    <span className="text-xs text-gray-600 line-clamp-2" title={item.reason}>{item.reason || '-'}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
          </div>

          {/* Pagination */}
          {activeSubPage !== 'apply-ads-account' && activeSubPage !== 'deposit' && activeSubPage !== 'transfer-balance' && activeSubPage !== 'refund' && activeSubPage !== 'refund-report' && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between bg-white">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#4285F4]/5 hover:border-[#4285F4]/30 hover:text-[#4285F4] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((page, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof page === 'number' && setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      currentPage === page
                        ? `bg-gradient-to-r ${brandGradient} text-white shadow-sm`
                        : page === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#4285F4]/10 hover:text-[#4285F4]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 font-medium border border-gray-200 rounded-lg hover:bg-[#4285F4]/5 hover:border-[#4285F4]/30 hover:text-[#4285F4] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Access Ad Account Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        title="Request Account Access"
        className="max-w-md"
      >
        <p className="text-sm text-gray-500 -mt-2 mb-5">
          Enter the Gmail ID to grant access to this ad account
        </p>

        <div className="space-y-5">
          {/* Gmail ID */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Gmail ID</label>
            <input
              type="email"
              placeholder="example@gmail.com"
              value={accessGmail}
              onChange={(e) => setAccessGmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4285F4]/20 focus:border-[#4285F4] focus:bg-white transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-200 rounded-xl py-3 hover:bg-gray-50"
              onClick={() => setShowAccessModal(false)}
            >
              Cancel
            </Button>
            <Button
              className={`flex-1 bg-gradient-to-r ${brandGradient} hover:from-[#3367D6] hover:to-[#2851A3] rounded-xl py-3 shadow-md shadow-blue-500/25`}
              disabled={!accessGmail || isSubmitting}
              onClick={async () => {
                if (!accessGmail) return
                setIsSubmitting(true)
                try {
                  const account = userAccounts.find((a: any) => a.id === accessAccountId)
                  await bmShareApi.create({
                    platform: 'GOOGLE',
                    adAccountId: account?.accountId || '',
                    adAccountName: account?.accountName || 'Google Ad Account',
                    bmId: accessGmail,
                  })
                  showToast('success', 'Access Request Submitted', 'Your request is now pending admin review.')
                  setShowAccessModal(false)
                  setAccessGmail('')
                  // Refresh access requests
                  const res = await bmShareApi.getAll('GOOGLE').catch(() => ({ bmShareRequests: [] }))
                  setAccessRequests(res.bmShareRequests || [])
                } catch (error: any) {
                  showToast('error', 'Failed', error.message || 'Failed to submit access request.')
                } finally {
                  setIsSubmitting(false)
                }
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </span>
              ) : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>
      </div>
      )}
    </DashboardLayout>
  )
}
