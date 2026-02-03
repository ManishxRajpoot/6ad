'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { referralsApi, settingsApi, domainsApi } from '@/lib/api'
import {
  Gift,
  Copy,
  Check,
  Users,
  DollarSign,
  Clock,
  Share2,
  Sparkles,
  TrendingUp,
  ChevronRight
} from 'lucide-react'

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState('')
  const [referralDomain, setReferralDomain] = useState('https://ads.sixad.io')
  const [stats, setStats] = useState({
    totalReferrals: 0,
    qualifiedReferrals: 0,
    pendingRewards: 0,
    totalEarned: 0
  })
  const [referrals, setReferrals] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        // First, try to get agent's custom domain (if user's agent has set one)
        let domainSet = false
        try {
          const agentDomainRes = await domainsApi.getAgentDomain()
          if (agentDomainRes.domain?.domain) {
            // Agent has an approved custom domain
            const customDomain = agentDomainRes.domain.domain
            // Add https:// if not present
            setReferralDomain(
              customDomain.startsWith('http') ? customDomain : `https://${customDomain}`
            )
            domainSet = true
          }
        } catch (e) {
          // No agent domain, continue to check settings
        }

        // Fall back to global referral domain setting if no agent domain
        if (!domainSet) {
          try {
            const domainRes = await settingsApi.referralDomain.get()
            setReferralDomain(domainRes.referralDomain || 'https://ads.sixad.io')
          } catch (e) {
            // Use default domain
          }
        }

        const res = await referralsApi.getStats()
        setReferralCode(res.referralCode || '')
        setStats(res.stats)
        setReferrals(res.referrals || [])
      } catch (error) {
        // Try to get just the code
        try {
          const codeRes = await referralsApi.getMyCode()
          setReferralCode(codeRes.referralCode)
        } catch (e) {
          // Silently fail
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchReferralData()
  }, [])

  const handleCopy = () => {
    const link = `${referralDomain}/register?ref=${referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    const link = `${referralDomain}/register?ref=${referralCode}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join 6AD Platform',
          text: 'Sign up using my referral link and get started with ad account management!',
          url: link
        })
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      handleCopy()
    }
  }

  const referralLink = `${referralDomain}/register?ref=${referralCode}`

  return (
    <DashboardLayout title="Referral Program" subtitle="Invite friends and earn rewards">
      <div className="space-y-6">
        {/* Hero Section */}
        <Card className="bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Invite Friends, Earn Rewards</h2>
                <p className="text-white/80">Get rewarded when your friends make their first deposit</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mt-6">
              <p className="text-sm text-white/60 mb-2">Your Referral Link</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-lg px-4 py-3 font-mono text-sm truncate">
                  {isLoading ? 'Loading...' : referralLink}
                </div>
                <Button
                  onClick={handleCopy}
                  className="bg-white text-[#8B5CF6] hover:bg-white/90 px-4 py-3"
                  disabled={isLoading}
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={handleShare}
                  className="bg-white/20 text-white hover:bg-white/30 px-4 py-3"
                  disabled={isLoading}
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-white/80 text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Referral Code: <span className="font-bold text-white">{referralCode || '---'}</span></span>
            </div>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
          <Card className="p-3 lg:p-5">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 lg:w-5 lg:h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">{stats.totalReferrals}</p>
                <p className="text-xs lg:text-sm text-gray-500">Total Referrals</p>
              </div>
            </div>
          </Card>

          <Card className="p-3 lg:p-5">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-4 h-4 lg:w-5 lg:h-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">{stats.qualifiedReferrals}</p>
                <p className="text-xs lg:text-sm text-gray-500">Qualified</p>
              </div>
            </div>
          </Card>

          <Card className="p-3 lg:p-5">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">${stats.pendingRewards}</p>
                <p className="text-xs lg:text-sm text-gray-500">Pending Rewards</p>
              </div>
            </div>
          </Card>

          <Card className="p-3 lg:p-5">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 lg:w-5 lg:h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg lg:text-2xl font-bold text-gray-900">${stats.totalEarned}</p>
                <p className="text-xs lg:text-sm text-gray-500">Total Earned</p>
              </div>
            </div>
          </Card>
        </div>

        {/* How it Works */}
        <Card className="p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-[#8B5CF6]" />
            How It Works
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#8B5CF6] font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Share Your Link</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Copy your unique referral link and share it with friends
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#8B5CF6] font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Friends Sign Up</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Your friends create an account using your link
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#8B5CF6]/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-[#8B5CF6] font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Earn Rewards</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Get credited when they make their first deposit
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Referral History */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Referral History</h3>

          {referrals.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No referrals yet</p>
              <p className="text-sm text-gray-400">Start sharing your link to earn rewards!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Reward</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            referral.status === 'rewarded'
                              ? 'bg-green-100 text-green-800'
                              : referral.status === 'qualified'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {referral.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        ${referral.rewardAmount}
                      </td>
                      <td className="py-3 px-4">
                        {referral.rewardPaid ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
