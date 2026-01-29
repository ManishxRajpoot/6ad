'use client'

import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { useTutorialStore, tutorials } from '@/store/tutorial'
import {
  Wallet,
  Megaphone,
  LayoutDashboard,
  Play,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Link2,
  Briefcase,
  CreditCard
} from 'lucide-react'

const iconMap: Record<string, React.ReactNode> = {
  wallet: <Wallet className="w-6 h-6" />,
  megaphone: <Megaphone className="w-6 h-6" />,
  layout: <LayoutDashboard className="w-6 h-6" />,
  link: <Link2 className="w-6 h-6" />,
  briefcase: <Briefcase className="w-6 h-6" />,
  'credit-card': <CreditCard className="w-6 h-6" />,
}

const colorMap: Record<string, { bg: string; icon: string; border: string; glow: string }> = {
  wallet: {
    bg: 'from-emerald-500 to-teal-600',
    icon: 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
    border: 'hover:border-emerald-200',
    glow: 'group-hover:shadow-emerald-100'
  },
  megaphone: {
    bg: 'from-violet-500 to-purple-600',
    icon: 'bg-violet-500/10 text-violet-600 group-hover:bg-violet-500 group-hover:text-white',
    border: 'hover:border-violet-200',
    glow: 'group-hover:shadow-violet-100'
  },
  layout: {
    bg: 'from-blue-500 to-indigo-600',
    icon: 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white',
    border: 'hover:border-blue-200',
    glow: 'group-hover:shadow-blue-100'
  },
  link: {
    bg: 'from-orange-500 to-amber-600',
    icon: 'bg-orange-500/10 text-orange-600 group-hover:bg-orange-500 group-hover:text-white',
    border: 'hover:border-orange-200',
    glow: 'group-hover:shadow-orange-100'
  },
  briefcase: {
    bg: 'from-cyan-500 to-blue-600',
    icon: 'bg-cyan-500/10 text-cyan-600 group-hover:bg-cyan-500 group-hover:text-white',
    border: 'hover:border-cyan-200',
    glow: 'group-hover:shadow-cyan-100'
  },
  'credit-card': {
    bg: 'from-pink-500 to-rose-600',
    icon: 'bg-pink-500/10 text-pink-600 group-hover:bg-pink-500 group-hover:text-white',
    border: 'hover:border-pink-200',
    glow: 'group-hover:shadow-pink-100'
  },
}

export default function GuidePage() {
  const router = useRouter()
  const { startTutorial, completedTutorials } = useTutorialStore()

  const handleStartTutorial = (tutorial: typeof tutorials[0]) => {
    const firstStep = tutorial.steps[0]
    if (firstStep?.nextRoute) {
      router.push(firstStep.nextRoute)
    }
    startTutorial(tutorial)
  }

  const completedCount = tutorials.filter(t => completedTutorials.includes(t.id)).length
  const totalSteps = tutorials.reduce((sum, t) => sum + t.steps.length, 0)

  return (
    <DashboardLayout title="Guide" subtitle="">
      <div className="flex flex-col h-full overflow-auto">
        {/* Header Stats */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Interactive Tutorials</h1>
            <p className="text-sm text-gray-500">Learn how to use the platform step by step</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{tutorials.length}</p>
                <p className="text-[10px] text-gray-400 uppercase">Guides</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{completedCount}<span className="text-gray-300 text-sm">/{tutorials.length}</span></p>
                <p className="text-[10px] text-gray-400 uppercase">Done</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Play className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">{totalSteps}</p>
                <p className="text-[10px] text-gray-400 uppercase">Steps</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tutorials Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {tutorials.map((tutorial) => {
            const isCompleted = completedTutorials.includes(tutorial.id)
            const colors = colorMap[tutorial.icon] || colorMap.layout

            return (
              <Card
                key={tutorial.id}
                className={`p-0 overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-lg ${colors.border} ${colors.glow}`}
                onClick={() => handleStartTutorial(tutorial)}
              >
                {/* Top gradient bar */}
                <div className={`h-1 bg-gradient-to-r ${colors.bg}`} />

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${colors.icon}`}>
                      {iconMap[tutorial.icon] || <BookOpen className="w-6 h-6" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {tutorial.name}
                        </h3>
                        {isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                        {tutorial.description}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                            {tutorial.steps.length} Steps
                          </span>
                          {isCompleted && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-medium rounded-full">
                              Done
                            </span>
                          )}
                        </div>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${
                          isCompleted
                            ? 'bg-gray-100 text-gray-400'
                            : `bg-gradient-to-r ${colors.bg} text-white shadow-sm`
                        }`}>
                          {isCompleted ? (
                            <Play className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Steps preview - horizontal dots */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1">
                      {tutorial.steps.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            isCompleted ? 'bg-emerald-200' : 'bg-gray-200 group-hover:bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
