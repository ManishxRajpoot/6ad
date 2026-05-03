'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import {
  CreditCard, Eye, ArrowDownToLine, ArrowUpFromLine, MoreVertical,
  Snowflake, Copy, ChevronRight, Wifi, Lock, CheckCircle2, Sparkles,
} from 'lucide-react'

// ─── Mock data — 6 cards with varied state ─────────────────────────
const MOCK_CARDS = [
  { id: '1', label: 'Facebook Ads', alias: 'Main FB',  cardNumber: '4413 5942 1234 6114', last4: '6114', status: 'ACTIVE',  balance: 245.50, totalSpent: 1240.30, currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '08/29' },
  { id: '2', label: 'Google Ads',   alias: 'Search',   cardNumber: '4413 5942 8821 0294', last4: '0294', status: 'ACTIVE',  balance: 1290.00, totalSpent: 3402.18, currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '06/28' },
  { id: '3', label: 'TikTok Spend', alias: 'Creator',  cardNumber: '4413 5942 9923 1192', last4: '1192', status: 'FROZEN',  balance: 50.00,  totalSpent: 198.25,  currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '11/27' },
  { id: '4', label: 'Snapchat Test', alias: '',         cardNumber: '4413 5942 0011 4421', last4: '4421', status: 'PENDING', balance: 0,      totalSpent: 0,       currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '—' },
  { id: '5', label: 'Bing Backup',   alias: 'B2',       cardNumber: '4413 5942 5520 7783', last4: '7783', status: 'ACTIVE',  balance: 12.40,  totalSpent: 487.60,  currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '03/30' },
  { id: '6', label: 'Closed',        alias: '',         cardNumber: '4413 5942 6610 0098', last4: '0098', status: 'CANCELLED', balance: 0,    totalSpent: 89.50,   currency: 'USD', cardholder: { firstName: 'Test', lastName: 'User' }, expiry: '—' },
]

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PENDING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    FROZEN: 'bg-blue-50 text-blue-700 border-blue-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${colors[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const c = status === 'ACTIVE' ? 'bg-emerald-500' : status === 'PENDING' ? 'bg-yellow-500' : status === 'FROZEN' ? 'bg-blue-500' : 'bg-red-500'
  return <span className={`inline-block w-2 h-2 rounded-full ${c}`} />
}

const VARIANTS = [
  { id: 'A', name: 'A · Compact row (current)', desc: 'Tight, mirrors Facebook account list' },
  { id: 'B', name: 'B · Card-themed row', desc: 'Card chip, gradient background, prominent balance' },
  { id: 'C', name: 'C · Dark stripe', desc: 'Black card surface as the row, info on top of it' },
  { id: 'D', name: 'D · Grid card', desc: 'Square card-like tiles, big balance, action grid' },
  { id: 'E', name: 'E · Premium pill', desc: 'Rounded-full pill rows with badge cluster' },
  { id: 'F', name: 'F · Minimal table', desc: 'Single-line dense table layout' },
] as const

type Variant = typeof VARIANTS[number]['id']

export default function VccTestPage() {
  const [variant, setVariant] = useState<Variant>('A')

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">VCC List Designs — Test</h1>
          <p className="text-sm text-gray-500">Pick a variant. None of these are wired up. No auth required.</p>
        </div>
      <div className="space-y-4">
        {/* Variant picker */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  variant === v.id
                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-md shadow-purple-200'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">{VARIANTS.find(v => v.id === variant)?.desc}</p>
        </Card>

        {/* Render variant */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Your VCC Cards</h2>
              <p className="text-xs text-gray-500 mt-0.5">Manage your virtual credit cards</p>
            </div>
            <span className="text-xs text-gray-500">Total: <span className="font-semibold text-[#8B5CF6]">{MOCK_CARDS.length}</span></span>
          </div>
          {variant === 'A' && <VariantA cards={MOCK_CARDS} />}
          {variant === 'B' && <VariantB cards={MOCK_CARDS} />}
          {variant === 'C' && <VariantC cards={MOCK_CARDS} />}
          {variant === 'D' && <VariantD cards={MOCK_CARDS} />}
          {variant === 'E' && <VariantE cards={MOCK_CARDS} />}
          {variant === 'F' && <VariantF cards={MOCK_CARDS} />}
        </Card>
      </div>
      </div>
    </div>
  )
}

// ─── A · Current compact row ───────────────────────────────────────
function VariantA({ cards }: { cards: any[] }) {
  return (
    <div className="space-y-2">
      {cards.map(card => (
        <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/5 transition-colors">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {card.cardholder.firstName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-900 truncate">{card.label}</p>
              <StatusBadge status={card.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{card.cardNumber}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
            <p className="text-sm font-bold text-gray-900">${card.balance.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-medium">Access</button>
            <button className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium">Deposit</button>
            <button className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-medium">Withdraw</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── B · Card-themed row with mini-card chip + button-style picker ───
const BUTTON_STYLES = [
  { id: 'b1', name: 'B1 · Soft icon squares (current)' },
  { id: 'b2', name: 'B2 · Icon + label pills' },
  { id: 'b3', name: 'B3 · Filled colored buttons' },
  { id: 'b4', name: 'B4 · Outlined buttons' },
  { id: 'b5', name: 'B5 · Gradient buttons' },
  { id: 'b6', name: 'B6 · Text-link style' },
  { id: 'b7', name: 'B7 · Stacked icon + tiny label' },
  { id: 'b8', name: 'B8 · Single primary + dropdown' },
  { id: 'b9', name: 'B9 · Segmented bar' },
  { id: 'b10', name: 'B10 · Floating circle icons' },
  { id: 'b11', name: 'B11 · Facebook-style (tint→solid hover)' },
  { id: 'b12', name: 'B12 · FB-style with Withdraw' },
] as const
type ButtonStyle = typeof BUTTON_STYLES[number]['id']

function VariantB({ cards }: { cards: any[] }) {
  const [btnStyle, setBtnStyle] = useState<ButtonStyle>('b1')
  return (
    <div>
      {/* Button-style picker */}
      <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Button style</p>
        <div className="flex flex-wrap gap-2">
          {BUTTON_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setBtnStyle(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                btnStyle === s.id
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-md shadow-purple-200'
                  : 'bg-white text-gray-600 hover:bg-purple-50 border border-gray-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {cards.map(card => (
          <div key={card.id} className="group relative flex items-center gap-4 p-3 rounded-2xl border border-gray-100 bg-gradient-to-r from-white via-white to-purple-50/40 hover:to-purple-50/80 hover:shadow-md transition-all">
            {/* Mini card chip */}
            <div className="relative w-20 h-12 rounded-lg bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 flex flex-col justify-between p-1.5 flex-shrink-0 overflow-hidden">
              <Wifi className="w-3 h-3 text-white/40 self-end rotate-90" />
              <p className="font-mono text-[8px] text-white/80 tracking-wider">•• {card.last4}</p>
              <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-purple-500/30 blur-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-gray-900 truncate">{card.label}</p>
                <StatusDot status={card.status} />
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{card.status}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Exp {card.expiry} · {card.currency}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance</p>
              <p className="text-base font-bold text-gray-900 tabular-nums">${card.balance.toFixed(2)}</p>
            </div>
            <ButtonGroup style={btnStyle} disabled={card.status !== 'ACTIVE'} />
          </div>
        ))}
      </div>
    </div>
  )
}

function ButtonGroup({ style, disabled }: { style: ButtonStyle; disabled?: boolean }) {
  const dim = disabled ? 'opacity-40 cursor-not-allowed' : ''
  switch (style) {
    case 'b1':
      return (
        <div className="flex items-center gap-1">
          <button title="Access"   className={`w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 flex items-center justify-center ${dim}`}><Eye className="w-4 h-4" /></button>
          <button title="Deposit"  className={`w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center ${dim}`}><ArrowDownToLine className="w-4 h-4" /></button>
          <button title="Withdraw" className={`w-8 h-8 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 flex items-center justify-center ${dim}`}><ArrowUpFromLine className="w-4 h-4" /></button>
          <button title="More"     className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center"><MoreVertical className="w-4 h-4" /></button>
        </div>
      )
    case 'b2':
      return (
        <div className="flex items-center gap-1.5">
          <button className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-medium ${dim}`}><Eye className="w-3.5 h-3.5" /> Access</button>
          <button className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium ${dim}`}><ArrowDownToLine className="w-3.5 h-3.5" /> Deposit</button>
          <button className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-medium ${dim}`}><ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw</button>
        </div>
      )
    case 'b3':
      return (
        <div className="flex items-center gap-1.5">
          <button className={`px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium shadow-sm ${dim}`}>Access</button>
          <button className={`px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium shadow-sm ${dim}`}>Deposit</button>
          <button className={`px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-medium shadow-sm ${dim}`}>Withdraw</button>
        </div>
      )
    case 'b4':
      return (
        <div className="flex items-center gap-1.5">
          <button className={`px-3 py-1.5 rounded-lg border border-purple-300 hover:bg-purple-50 text-purple-700 text-[11px] font-medium ${dim}`}>Access</button>
          <button className={`px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-700 text-[11px] font-medium ${dim}`}>Deposit</button>
          <button className={`px-3 py-1.5 rounded-lg border border-orange-300 hover:bg-orange-50 text-orange-700 text-[11px] font-medium ${dim}`}>Withdraw</button>
        </div>
      )
    case 'b5':
      return (
        <div className="flex items-center gap-1.5">
          <button className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:opacity-90 text-white text-[11px] font-semibold shadow-md shadow-purple-200 ${dim}`}>Access</button>
          <button className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white text-[11px] font-semibold shadow-md shadow-emerald-200 ${dim}`}>Deposit</button>
          <button className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white text-[11px] font-semibold shadow-md shadow-orange-200 ${dim}`}>Withdraw</button>
        </div>
      )
    case 'b6':
      return (
        <div className="flex items-center gap-3">
          <button className={`text-[12px] font-semibold text-purple-600 hover:text-purple-800 hover:underline ${dim}`}>Access</button>
          <span className="text-gray-200">|</span>
          <button className={`text-[12px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline ${dim}`}>Deposit</button>
          <span className="text-gray-200">|</span>
          <button className={`text-[12px] font-semibold text-orange-600 hover:text-orange-800 hover:underline ${dim}`}>Withdraw</button>
        </div>
      )
    case 'b7':
      return (
        <div className="flex items-center gap-1">
          <button className={`flex flex-col items-center justify-center gap-0.5 w-14 py-1.5 rounded-lg hover:bg-purple-50 text-purple-700 ${dim}`}>
            <Eye className="w-4 h-4" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Access</span>
          </button>
          <button className={`flex flex-col items-center justify-center gap-0.5 w-14 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700 ${dim}`}>
            <ArrowDownToLine className="w-4 h-4" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Deposit</span>
          </button>
          <button className={`flex flex-col items-center justify-center gap-0.5 w-14 py-1.5 rounded-lg hover:bg-orange-50 text-orange-700 ${dim}`}>
            <ArrowUpFromLine className="w-4 h-4" />
            <span className="text-[9px] font-semibold uppercase tracking-wider">Withdraw</span>
          </button>
        </div>
      )
    case 'b8':
      return (
        <div className="flex items-center gap-1.5">
          <button className={`px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-[11px] font-semibold shadow-md shadow-purple-200 ${dim}`}>Access Card</button>
          <button className="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 flex items-center justify-center" title="More actions">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      )
    case 'b9':
      return (
        <div className={`inline-flex items-center rounded-lg border border-gray-200 overflow-hidden divide-x divide-gray-200 ${dim}`}>
          <button className="px-3 py-1.5 hover:bg-purple-50 text-purple-700 text-[11px] font-medium inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Access</button>
          <button className="px-3 py-1.5 hover:bg-emerald-50 text-emerald-700 text-[11px] font-medium inline-flex items-center gap-1"><ArrowDownToLine className="w-3.5 h-3.5" /> Deposit</button>
          <button className="px-3 py-1.5 hover:bg-orange-50 text-orange-700 text-[11px] font-medium inline-flex items-center gap-1"><ArrowUpFromLine className="w-3.5 h-3.5" /> Withdraw</button>
        </div>
      )
    case 'b10':
      return (
        <div className="flex items-center gap-1.5">
          <button title="Access" className={`w-9 h-9 rounded-full bg-white border border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-700 flex items-center justify-center shadow-sm ${dim}`}><Eye className="w-4 h-4" /></button>
          <button title="Deposit" className={`w-9 h-9 rounded-full bg-white border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-sm ${dim}`}><ArrowDownToLine className="w-4 h-4" /></button>
          <button title="Withdraw" className={`w-9 h-9 rounded-full bg-white border border-orange-200 hover:border-orange-400 hover:bg-orange-50 text-orange-700 flex items-center justify-center shadow-sm ${dim}`}><ArrowUpFromLine className="w-4 h-4" /></button>
        </div>
      )
    case 'b11':
      // Exact match for the user-side Facebook account-list buttons:
      // tinted background with colored text, invert to solid on hover.
      return (
        <div className="flex items-center gap-2">
          <button className={`px-3.5 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg text-xs font-medium hover:bg-[#8B5CF6] hover:text-white transition-all duration-200 ${dim}`}>Access</button>
          <button className={`px-3.5 py-1.5 bg-[#52B788]/10 text-[#52B788] rounded-lg text-xs font-medium hover:bg-[#52B788] hover:text-white transition-all duration-200 ${dim}`}>Deposit</button>
        </div>
      )
    case 'b12':
      // Same FB style but with the third Withdraw action in orange.
      return (
        <div className="flex items-center gap-2">
          <button className={`px-3.5 py-1.5 bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-lg text-xs font-medium hover:bg-[#8B5CF6] hover:text-white transition-all duration-200 ${dim}`}>Access</button>
          <button className={`px-3.5 py-1.5 bg-[#52B788]/10 text-[#52B788] rounded-lg text-xs font-medium hover:bg-[#52B788] hover:text-white transition-all duration-200 ${dim}`}>Deposit</button>
          <button className={`px-3.5 py-1.5 bg-[#F97316]/10 text-[#F97316] rounded-lg text-xs font-medium hover:bg-[#F97316] hover:text-white transition-all duration-200 ${dim}`}>Withdraw</button>
        </div>
      )
  }
}

// ─── C · Dark stripe — card IS the row ──────────────────────────────
function VariantC({ cards }: { cards: any[] }) {
  return (
    <div className="space-y-3">
      {cards.map(card => (
        <div key={card.id} className="relative rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-4 overflow-hidden hover:shadow-xl transition-shadow">
          {/* Decorative orbs */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl" />
          <div className="absolute -right-12 top-4 w-24 h-24 rounded-full border border-white/10" />
          <div className="absolute -right-16 top-0 w-24 h-24 rounded-full border border-white/5" />

          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Virtual Card</span>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${card.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' : card.status === 'FROZEN' ? 'bg-blue-500/20 text-blue-300' : card.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>{card.status}</span>
              </div>
              <p className="font-mono text-base tracking-[0.25em] text-white/90 mb-1">{card.cardNumber.replace(/\d(?=\d{4})/g, '•')}</p>
              <div className="flex items-center gap-4 text-[11px] text-white/60">
                <span>{card.label || card.alias}</span>
                <span>·</span>
                <span>Exp {card.expiry}</span>
              </div>
            </div>
            <div className="text-right relative">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Balance</p>
              <p className="text-2xl font-bold text-white tabular-nums">${card.balance.toFixed(2)}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium backdrop-blur">Access</button>
              <div className="flex gap-1.5">
                <button className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[11px] font-medium">Deposit</button>
                <button className="flex-1 px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 text-[11px] font-medium">Withdraw</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── D · Grid of square card tiles ─────────────────────────────────
function VariantD({ cards }: { cards: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.id} className="rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg transition-shadow">
          <div className="bg-gradient-to-br from-gray-900 to-gray-700 p-4 text-white relative overflow-hidden">
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full border border-white/20" />
            <div className="absolute top-3 right-7 w-8 h-8 rounded-full border border-white/10" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Virtual Card</span>
              <StatusBadge status={card.status} />
            </div>
            <p className="font-mono text-sm tracking-[0.2em] mb-3">{card.cardNumber.replace(/\d(?=\d{4})/g, '•')}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[9px] text-white/30 uppercase">Holder</p>
                <p className="text-xs">{card.cardholder.firstName} {card.cardholder.lastName}</p>
              </div>
              <p className="text-[10px] text-white/50 font-mono">{card.expiry}</p>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">${card.balance.toFixed(2)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[10px] font-medium text-purple-700"><Eye className="w-4 h-4" /> Access</button>
              <button className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[10px] font-medium text-emerald-700"><ArrowDownToLine className="w-4 h-4" /> Deposit</button>
              <button className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-[10px] font-medium text-orange-700"><ArrowUpFromLine className="w-4 h-4" /> Withdraw</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── E · Premium pill rows ─────────────────────────────────────────
function VariantE({ cards }: { cards: any[] }) {
  return (
    <div className="space-y-2">
      {cards.map(card => (
        <div key={card.id} className="flex items-center gap-3 pl-3 pr-2 py-2 rounded-full border border-gray-100 bg-white hover:border-[#8B5CF6]/40 hover:shadow-sm transition-all">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <p className="font-semibold text-sm text-gray-900 truncate min-w-[100px]">{card.label}</p>
            <span className="text-xs font-mono text-gray-400">•• {card.last4}</span>
            <span className="hidden md:inline text-xs text-gray-400">{card.expiry}</span>
            <div className="flex-1" />
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${card.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : card.status === 'FROZEN' ? 'bg-blue-100 text-blue-700' : card.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{card.status}</span>
            <p className="font-bold text-sm text-gray-900 tabular-nums min-w-[80px] text-right">${card.balance.toFixed(2)}</p>
          </div>
          <button className="px-3 py-1.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-medium">Access</button>
          <button className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium">Deposit</button>
          <button className="px-3 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-medium">Withdraw</button>
        </div>
      ))}
    </div>
  )
}

// ─── F · Minimal dense table ───────────────────────────────────────
function VariantF({ cards }: { cards: any[] }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-y border-gray-100">
          <tr>
            <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Label</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Card</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Exp</th>
            <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Balance</th>
            <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cards.map(card => (
            <tr key={card.id} className="hover:bg-gray-50">
              <td className="px-5 py-2.5">
                <p className="font-medium text-gray-900 text-sm">{card.label}</p>
                <p className="text-[10px] text-gray-400">{card.alias || '—'}</p>
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-gray-600">•• {card.last4}</td>
              <td className="px-3 py-2.5 text-xs text-gray-500">{card.expiry}</td>
              <td className="px-3 py-2.5"><div className="flex items-center gap-1.5"><StatusDot status={card.status} /><span className="text-xs text-gray-600">{card.status}</span></div></td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">${card.balance.toFixed(2)}</td>
              <td className="px-5 py-2.5 text-right">
                <div className="inline-flex items-center gap-1">
                  <button className="px-2 py-1 rounded text-[10px] font-medium text-purple-700 hover:bg-purple-50">Access</button>
                  <button className="px-2 py-1 rounded text-[10px] font-medium text-emerald-700 hover:bg-emerald-50">Deposit</button>
                  <button className="px-2 py-1 rounded text-[10px] font-medium text-orange-700 hover:bg-orange-50">Withdraw</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
