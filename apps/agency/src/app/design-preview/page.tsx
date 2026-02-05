'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Check, X, Clock, AlertCircle, CheckCircle, XCircle, Zap, Circle } from 'lucide-react'

export default function DesignPreviewPage() {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)

  const statuses = ['Approved', 'Pending', 'Rejected']

  return (
    <DashboardLayout title="Design Preview" subtitle="Choose your preferred status badge style">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {/* Option 1: Pill with Icon (Current) */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 1 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(1)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 1: Pill with Icon</h3>
            {selectedOption === 1 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Current style - rounded pills with checkmark</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-full text-sm font-medium">
              <Check className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-full text-sm font-medium">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-full text-sm font-medium">
              <X className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 2: Soft Subtle Badge */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 2 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(2)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 2: Soft Subtle</h3>
            {selectedOption === 2 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Light background with colored text</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 3: Minimal Dot */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 3 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(3)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 3: Minimal Dot</h3>
            {selectedOption === 3 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Clean minimal with status dot</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span> Rejected
            </span>
          </div>
        </Card>

        {/* Option 4: Gradient Glow */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 4 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(4)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 4: Gradient Glow</h3>
            {selectedOption === 4 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Modern gradient with subtle glow</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-medium shadow-sm shadow-emerald-500/30">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg text-sm font-medium shadow-sm shadow-amber-500/30">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-lg text-sm font-medium shadow-sm shadow-red-500/30">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 5: Outline Only */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 5 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(5)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 5: Outline Only</h3>
            {selectedOption === 5 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Clean outlined badges</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-emerald-500 text-emerald-600 rounded-full text-sm font-semibold">
              <Check className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-amber-500 text-amber-600 rounded-full text-sm font-semibold">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-red-500 text-red-600 rounded-full text-sm font-semibold">
              <X className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 6: Chip Style (Material) */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 6 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(6)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 6: Chip Style</h3>
            {selectedOption === 6 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Material design inspired chips</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold uppercase tracking-wide">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Rejected
            </span>
          </div>
        </Card>

        {/* Option 7: Tag Style */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 7 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(7)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 7: Tag Style</h3>
            {selectedOption === 7 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Left accent border tags</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-l-4 border-amber-500 text-amber-700 text-sm font-medium">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 8: Glass Morphism */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 8 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(8)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 8: Glass Effect</h3>
            {selectedOption === 8 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Modern glassmorphism style</p>
          <div className="space-y-3 bg-gradient-to-br from-gray-100 to-gray-200 p-4 rounded-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium shadow-sm">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-amber-200 text-amber-700 rounded-xl text-sm font-medium shadow-sm">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-red-200 text-red-700 rounded-xl text-sm font-medium shadow-sm">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 9: Compact Square */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 9 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(9)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 9: Compact Square</h3>
            {selectedOption === 9 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Minimal square badges</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-semibold">
              <Check className="w-3.5 h-3.5" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded text-xs font-semibold">
              <X className="w-3.5 h-3.5" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 10: Icon Badge */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 10 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(10)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 10: Icon Badge</h3>
            {selectedOption === 10 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Large icon with text below</p>
          <div className="flex gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-emerald-700">Approved</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-amber-700">Pending</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-xs font-medium text-red-700">Rejected</span>
            </div>
          </div>
        </Card>

        {/* Option 11: Neon Glow */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 11 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(11)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 11: Neon Glow</h3>
            {selectedOption === 11 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Dark with neon glow effect</p>
          <div className="space-y-3 bg-slate-900 p-4 rounded-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg text-sm font-medium shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <CheckCircle className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded-lg text-sm font-medium shadow-[0_0_10px_rgba(245,158,11,0.3)]">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-sm font-medium shadow-[0_0_10px_rgba(239,68,68,0.3)]">
              <XCircle className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

        {/* Option 12: Simple Text */}
        <Card className={`p-5 cursor-pointer transition-all ${selectedOption === 12 ? 'ring-2 ring-teal-500 bg-teal-50/50' : 'hover:shadow-md'}`}
          onClick={() => setSelectedOption(12)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Option 12: Simple Text</h3>
            {selectedOption === 12 && <Check className="w-5 h-5 text-teal-600" />}
          </div>
          <p className="text-xs text-gray-500 mb-4">Minimal colored text only</p>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
              <Check className="w-4 h-4" /> Approved
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600">
              <Clock className="w-4 h-4" /> Pending
            </span>
            <br />
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <X className="w-4 h-4" /> Rejected
            </span>
          </div>
        </Card>

      </div>

      {/* Selected Option Info */}
      {selectedOption && (
        <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-teal-900">Option {selectedOption} Selected</p>
              <p className="text-sm text-teal-700">Tell me this option number and I'll implement it across all pages!</p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
