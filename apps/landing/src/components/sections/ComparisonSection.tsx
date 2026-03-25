'use client'

import { useScrollReveal } from '../shared/useScrollReveal'

type RowValue =
  | { type: 'check' }
  | { type: 'cross' }
  | { type: 'text'; value: string }
  | { type: 'badge'; value: string; color: 'green' | 'red' }

const rows: { feature: string; us: RowValue; them: RowValue }[] = [
  { feature: 'Run Ads For Almost Any Vertical', us: { type: 'check' }, them: { type: 'cross' } },
  { feature: 'Unlimited Spending Limit', us: { type: 'check' }, them: { type: 'cross' } },
  { feature: 'Unlimited Ad Accounts', us: { type: 'check' }, them: { type: 'cross' } },
  { feature: 'Accounts HIVA Score', us: { type: 'text', value: 'Platinum' }, them: { type: 'text', value: 'Silver' } },
  { feature: "CPM's & CPA's", us: { type: 'badge', value: 'Low', color: 'green' }, them: { type: 'badge', value: 'High', color: 'red' } },
  { feature: 'Increase Ad Approval Rate', us: { type: 'text', value: '687%' }, them: { type: 'text', value: '0%' } },
  { feature: '24/7 Customer Support', us: { type: 'check' }, them: { type: 'cross' } },
  { feature: 'Average Ad Approval Time', us: { type: 'text', value: '5 Minutes' }, them: { type: 'text', value: '5-9 Hours' } },
  { feature: 'Payment Options', us: { type: 'text', value: 'Bank, Card, Crypto' }, them: { type: 'text', value: 'Card Only' } },
  { feature: 'US/EU Accounts', us: { type: 'check' }, them: { type: 'cross' } },
  { feature: 'Ban Protection', us: { type: 'check' }, them: { type: 'cross' } },
]

function Check() {
  return (
    <div className="relative inline-flex items-center justify-center">
      <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
        <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3L12.5 5" />
        </svg>
      </div>
      <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-md" />
    </div>
  )
}

function Cross() {
  return (
    <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/15 flex items-center justify-center">
      <svg viewBox="0 0 16 16" className="w-3 h-3 text-red-400/70" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
      </svg>
    </div>
  )
}

function Badge({ value, color }: { value: string; color: 'green' | 'red' }) {
  return (
    <span
      className={`inline-flex px-3.5 py-1 rounded-full text-xs font-bold tracking-wide ${
        color === 'green'
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'bg-red-500/10 text-red-400 border border-red-500/15'
      }`}
    >
      {value}
    </span>
  )
}

function CellValue({ val }: { val: RowValue }) {
  switch (val.type) {
    case 'check':
      return <Check />
    case 'cross':
      return <Cross />
    case 'badge':
      return <Badge value={val.value} color={val.color} />
    case 'text':
      return <span>{val.value}</span>
  }
}

function MiniVal({ v, side }: { v: RowValue; side: 'us' | 'them' }) {
  if (v.type === 'check') return (
    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 12 12" className="w-2 h-2 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 6l2.5 2.5L9 4"/></svg>
    </div>
  )
  if (v.type === 'cross') return (
    <div className="w-3.5 h-3.5 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
      <svg viewBox="0 0 12 12" className="w-2 h-2 text-red-400/50" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6"/></svg>
    </div>
  )
  if (v.type === 'badge') return <span className={`text-[6px] font-bold px-1 py-0.5 rounded-full flex-shrink-0 ${v.color === 'green' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400/60'}`}>{v.value}</span>
  return <span className={`text-[7px] font-semibold flex-shrink-0 ${side === 'us' ? 'text-white' : 'text-gray-500'}`}>{v.value}</span>
}

export default function ComparisonSection() {
  const heading = useScrollReveal()
  const table = useScrollReveal()

  return (
    <section id="comparison" className="relative pt-10 sm:pt-14 pb-6 sm:pb-8 overflow-hidden">
      {/* BG effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[180px]" />
        {/* Grid dots — techy */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Matrix-style falling columns */}
        {[8, 22, 38, 55, 72, 88].map((left, i) => (
          <div key={i} className="comp-matrix-col absolute top-0 w-[2px] h-[250px] bg-gradient-to-b from-transparent via-blue-400/40 to-transparent" style={{ left: `${left}%`, animationDelay: `${i * 2.5}s`, animationDuration: `${10 + i * 2}s` }} />
        ))}
        {/* Crosshair targeting overlay */}
        <div className="comp-crosshair absolute top-1/2 left-1/2 w-[400px] h-[400px]">
          <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-blue-400/20" />
          <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-blue-400/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120px] h-[120px] rounded-full border border-blue-400/20" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border border-blue-400/10" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div
          ref={heading.ref}
          className={`text-center mb-6 sm:mb-16 transition-all duration-700 ${heading.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 bg-blue-500/[0.08] border border-blue-500/15 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 mb-3 sm:mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.15em]">Comparison</span>
          </div>
          <h2 className="text-lg sm:text-3xl md:text-4xl lg:text-[42px] font-bold text-white leading-tight mb-1 sm:mb-4">
            ADS360 vs Traditional
          </h2>
          <p className="text-gray-500 text-xs sm:text-base max-w-lg mx-auto leading-relaxed">
            See how our agency accounts beat all other service providers.
          </p>
        </div>

        {/* Scroll reveal trigger for table */}
        <div ref={table.ref} />

        {/* ===== MOBILE: Glow Diff Table (Design D) ===== */}
        <div
          className={`sm:hidden transition-all duration-700 delay-200 ${table.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#060a18]">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr] border-b border-white/[0.06]">
              <div className="relative px-2 py-2 bg-blue-500/[0.06]">
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500" />
                <div className="flex items-center gap-1">
                  <img src="/logo-icon.svg" alt="" className="w-3.5 h-3.5 rounded" />
                  <span className="text-blue-400 text-[9px] font-bold">ADS360</span>
                  <span className="ml-auto text-[6px] text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded-full font-bold">WINNER</span>
                </div>
              </div>
              <div className="px-2 py-2 border-l border-white/[0.04]">
                <span className="text-gray-500 text-[9px] font-bold">Traditional</span>
              </div>
            </div>
            {/* Rows */}
            {rows.map((row, i) => (
              <div key={i} className={`grid grid-cols-[1fr_1fr] ${i < rows.length - 1 ? 'border-b border-white/[0.03]' : ''}`}>
                <div className="px-2 py-1.5 bg-blue-500/[0.02] flex items-center gap-1">
                  <MiniVal v={row.us} side="us" />
                  <span className="text-[7px] text-gray-300 leading-tight">{row.feature}</span>
                </div>
                <div className="px-2 py-1.5 border-l border-white/[0.03] flex items-center gap-1">
                  <MiniVal v={row.them} side="them" />
                  <span className="text-[7px] text-gray-500 leading-tight">{row.feature}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile CTA */}
          <div className="mt-4 text-center">
            <a href="#contact" className="inline-flex items-center gap-1.5 bg-blue-500/15 border border-blue-400/20 px-3.5 py-1.5 rounded-full text-[10px] font-semibold text-white">
              Switch to ADS360
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </a>
          </div>
        </div>

        {/* ===== DESKTOP: Table ===== */}
        <div
          className={`hidden sm:block transition-all duration-700 delay-200 ${table.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
        >
          <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a0a1e]/90 backdrop-blur-sm overflow-hidden">
            {/* Scan line */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <div
                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/20 to-transparent"
                style={{ animation: 'scanDown 5s ease-in-out infinite' }}
              />
              <style jsx>{`
                @keyframes scanDown {
                  0% { top: -2%; opacity: 0; }
                  10% { opacity: 1; }
                  90% { opacity: 1; }
                  100% { top: 102%; opacity: 0; }
                }
              `}</style>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_160px] sm:grid-cols-[1fr_200px_200px] border-b border-white/[0.06]">
              <div className="px-6 sm:px-8 py-5" />
              {/* ADS360 column header */}
              <div className="relative px-4 py-5 flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-500/[0.04]" />
                {/* Top glow bar */}
                <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 rounded-full">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0 animate-pulse" style={{ animationDuration: '2s' }} />
                </div>
                <div className="flex items-center gap-2.5 relative z-10">
                  <div className="relative">
                    <img src="/logo-icon.svg" alt="ADS360" className="w-6 h-6 rounded-[6px]" />
                    <div className="absolute -inset-1 bg-blue-500/20 blur-md rounded-full" />
                  </div>
                  <span className="text-white font-bold text-sm tracking-wide">ADS360</span>
                </div>
              </div>
              {/* Traditional column header */}
              <div className="px-4 py-5 flex items-center justify-center">
                <span className="text-gray-500 font-medium text-sm">Traditional</span>
              </div>
            </div>

            {/* Rows */}
            {rows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_160px_160px] sm:grid-cols-[1fr_200px_200px] items-center group hover:bg-white/[0.015] transition-colors duration-300 ${
                  i < rows.length - 1 ? 'border-b border-white/[0.04]' : ''
                }`}
                style={{
                  opacity: table.visible ? 1 : 0,
                  transform: table.visible ? 'translateX(0)' : 'translateX(-15px)',
                  transition: `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms`,
                }}
              >
                {/* Feature name */}
                <div className="px-6 sm:px-8 py-4 sm:py-5">
                  <span className="text-gray-300 text-sm sm:text-[15px]">{row.feature}</span>
                </div>
                {/* ADS360 value */}
                <div className="relative px-4 py-4 sm:py-5 flex justify-center">
                  <div className="absolute inset-0 bg-blue-500/[0.02] group-hover:bg-blue-500/[0.04] transition-colors duration-300" />
                  <span className="text-white font-semibold text-sm relative z-10">
                    <CellValue val={row.us} />
                  </span>
                </div>
                {/* Traditional value */}
                <div className="px-4 py-4 sm:py-5 flex justify-center">
                  <span className="text-gray-500 text-sm">
                    <CellValue val={row.them} />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 text-center">
            <a
              href="#contact"
              className="inline-flex items-center gap-3 bg-blue-500/15 backdrop-blur-md border border-blue-400/20 hover:border-blue-400/40 hover:bg-blue-500/25 px-7 py-3.5 rounded-full text-sm font-semibold text-white transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] group"
            >
              <span>Switch to ADS360</span>
              <svg viewBox="0 0 16 16" className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
