'use client'

import { useState } from 'react'
import { Mail, Check, X, DollarSign, Users, ChevronDown, Monitor, Smartphone, PartyPopper } from 'lucide-react'

type EmailTemplate = 'account-approved' | 'account-rejected' | 'deposit-approved' | 'deposit-rejected' | 'bm-share-approved' | 'bm-share-rejected' | 'welcome'

interface TemplateData {
  id: EmailTemplate
  label: string
  subject: string
  icon: React.ReactNode
  color: string
}

const templates: TemplateData[] = [
  { id: 'welcome', label: 'Welcome Email', subject: 'Welcome to COINEST!', icon: <Mail className="w-4 h-4" />, color: '#52B788' },
  { id: 'account-approved', label: 'Account Approved', subject: 'Your Ad Account Has Been Approved!', icon: <Check className="w-4 h-4" />, color: '#52B788' },
  { id: 'account-rejected', label: 'Account Rejected', subject: 'Ad Account Application Update', icon: <X className="w-4 h-4" />, color: '#EF4444' },
  { id: 'deposit-approved', label: 'Deposit Approved', subject: 'Deposit Successfully Processed!', icon: <DollarSign className="w-4 h-4" />, color: '#52B788' },
  { id: 'deposit-rejected', label: 'Deposit Rejected', subject: 'Deposit Request Update', icon: <DollarSign className="w-4 h-4" />, color: '#EF4444' },
  { id: 'bm-share-approved', label: 'BM Share Approved', subject: 'BM Share Request Approved!', icon: <Users className="w-4 h-4" />, color: '#52B788' },
  { id: 'bm-share-rejected', label: 'BM Share Rejected', subject: 'BM Share Request Update', icon: <Users className="w-4 h-4" />, color: '#EF4444' },
]

// White-label brand options - Each agent can customize these
const brandOptions = [
  {
    id: 'coinest',
    name: 'COINEST',
    tagline: 'Ad Account Management',
    logo: '6',  // Agent's logo letter/icon
    primaryColor: '#52B788',
    secondaryColor: '#8B5CF6',
    email: 'noreply@coinest.com',  // Agent's email sender
    helpCenterUrl: 'https://help.coinest.com',  // Agent's help center
    contactSupportUrl: 'https://coinest.com/support',  // Agent's support page
  },
  {
    id: 'adspro',
    name: 'AdsPro',
    tagline: 'Digital Marketing Solutions',
    logo: 'A',
    primaryColor: '#3B82F6',
    secondaryColor: '#06B6D4',
    email: 'noreply@adspro.com',
    helpCenterUrl: 'https://help.adspro.com',
    contactSupportUrl: 'https://adspro.com/contact',
  },
  {
    id: 'mediahub',
    name: 'MediaHub',
    tagline: 'Your Advertising Partner',
    logo: 'M',
    primaryColor: '#F59E0B',
    secondaryColor: '#EF4444',
    email: 'noreply@mediahub.io',
    helpCenterUrl: 'https://mediahub.io/help',
    contactSupportUrl: 'https://mediahub.io/support',
  },
  {
    id: 'growthx',
    name: 'GrowthX',
    tagline: 'Scale Your Ads',
    logo: 'G',
    primaryColor: '#10B981',
    secondaryColor: '#6366F1',
    email: 'noreply@growthx.co',
    helpCenterUrl: 'https://growthx.co/help',
    contactSupportUrl: 'https://growthx.co/contact',
  },
]

// Sample data for templates
const sampleData = {
  userName: 'John Doe',
  userEmail: 'john@example.com',
  platform: 'Facebook',
  accountId: 'ACT_123456789',
  accountName: 'My Business Account',
  amount: '$500.00',
  transactionId: 'TXN_987654321',
  bmId: 'BM_456789123',
  date: 'January 30, 2026',
  reason: 'The submitted documents could not be verified. Please resubmit with valid documentation.',
}

export default function TestEmailPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>('account-approved')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState(brandOptions[0])
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)

  const currentTemplate = templates.find(t => t.id === selectedTemplate)!
  const isSuccess = currentTemplate.color === '#52B788'

  // Email content component - reusable for both views
  const EmailContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const padding = isMobile ? 'px-4 py-5' : 'px-8 py-8'
    const headerPadding = isMobile ? 'px-4 py-5' : 'px-8 py-8'
    const footerPadding = isMobile ? 'px-4 py-5' : 'px-8 py-6'
    const titleSize = isMobile ? 'text-xl' : 'text-2xl'
    const iconSize = isMobile ? 'w-14 h-14' : 'w-20 h-20'
    const iconInnerSize = isMobile ? 'w-7 h-7' : 'w-10 h-10'
    const amountSize = isMobile ? 'text-2xl' : 'text-4xl'

    // Dynamic brand colors
    const brandGradient = `linear-gradient(135deg, ${selectedBrand.primaryColor}, ${selectedBrand.secondaryColor})`

    return (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header with gradient */}
        <div className={`${headerPadding} relative overflow-hidden`}>
          {/* Gradient Background - Dynamic based on brand */}
          <div className="absolute inset-0" style={{ background: brandGradient }}></div>
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-white/5 rounded-full"></div>

          {/* Logo - Dynamic based on brand */}
          <div className="relative z-10 flex items-center gap-3">
            <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30`}>
              <span className={`text-white font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{selectedBrand.logo}</span>
            </div>
            <div>
              <span className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-white`}>{selectedBrand.name}</span>
              <p className={`text-white/70 ${isMobile ? 'text-xs' : 'text-sm'}`}>{selectedBrand.tagline}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={padding}>
          {/* Status Icon */}
          <div className="flex justify-center mb-5 -mt-10 relative z-20">
            <div className={`${iconSize} rounded-2xl flex items-center justify-center shadow-lg ${
              isSuccess
                ? 'bg-gradient-to-br from-[#52B788] to-[#40916C]'
                : 'bg-gradient-to-br from-[#EF4444] to-[#DC2626]'
            }`}>
              {selectedTemplate === 'welcome' && <PartyPopper className={`${iconInnerSize} text-white`} />}
              {selectedTemplate === 'account-approved' && <Check className={`${iconInnerSize} text-white`} strokeWidth={3} />}
              {selectedTemplate === 'account-rejected' && <X className={`${iconInnerSize} text-white`} strokeWidth={3} />}
              {selectedTemplate === 'deposit-approved' && <DollarSign className={`${iconInnerSize} text-white`} strokeWidth={2.5} />}
              {selectedTemplate === 'deposit-rejected' && <DollarSign className={`${iconInnerSize} text-white`} strokeWidth={2.5} />}
              {selectedTemplate === 'bm-share-approved' && <Users className={`${iconInnerSize} text-white`} strokeWidth={2} />}
              {selectedTemplate === 'bm-share-rejected' && <Users className={`${iconInnerSize} text-white`} strokeWidth={2} />}
            </div>
          </div>

          {/* Welcome Email */}
          {selectedTemplate === 'welcome' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                Welcome to {selectedBrand.name}! 🎉
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your journey to smarter ad management starts here
              </p>

              <div className={`bg-gradient-to-br from-gray-50 rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border border-gray-100`} style={{ background: `linear-gradient(135deg, #f9fafb, ${selectedBrand.secondaryColor}10)` }}>
                <p className={`text-gray-700 mb-3 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold" style={{ color: selectedBrand.secondaryColor }}>{sampleData.userName}</span>,
                </p>
                <p className={`text-gray-600 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Thank you for joining {selectedBrand.name}! We're thrilled to have you on board. Start managing your ad accounts across multiple platforms today.
                </p>

                <div className={`space-y-2 ${isMobile ? 'text-sm' : ''}`}>
                  {[
                    { icon: '🚀', text: 'Apply for new ad accounts' },
                    { icon: '💰', text: 'Make deposits to your wallet' },
                    { icon: '🤝', text: 'Request BM shares' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-gray-700">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                Go to Dashboard →
              </a>
            </>
          )}

          {/* Account Approved */}
          {selectedTemplate === 'account-approved' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                Account Approved! 🎉
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your ad account is ready to use
              </p>

              <div className={`rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border`} style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}10, ${selectedBrand.secondaryColor}10)`, borderColor: `${selectedBrand.primaryColor}30` }}>
                <p className={`text-gray-700 mb-3 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold" style={{ color: selectedBrand.primaryColor }}>{sampleData.userName}</span>,
                </p>
                <p className={`text-gray-600 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Great news! Your <span className="font-semibold" style={{ color: selectedBrand.secondaryColor }}>{sampleData.platform}</span> ad account has been approved and is ready to use.
                </p>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Platform</span>
                    <span className="font-semibold text-gray-900 px-3 py-1 rounded-full text-sm" style={{ background: `${selectedBrand.secondaryColor}15` }}>{sampleData.platform}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Account ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.accountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Account Name</span>
                    <span className="font-medium text-gray-900">{sampleData.accountName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                View Account Details →
              </a>
            </>
          )}

          {/* Account Rejected */}
          {selectedTemplate === 'account-rejected' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                Application Update
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your application needs attention
              </p>

              <div className={`bg-gradient-to-br from-red-50 to-purple-50/30 rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border border-red-100`}>
                <p className={`text-gray-700 mb-3 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold text-gray-900">{sampleData.userName}</span>,
                </p>
                <p className={`text-gray-600 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Unfortunately, your <span className="font-semibold">{sampleData.platform}</span> ad account application could not be approved at this time.
                </p>

                <div className={`bg-red-50 border-l-4 border-red-400 rounded-lg ${isMobile ? 'p-3' : 'p-4'} mb-4`}>
                  <p className={`font-semibold text-red-800 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>⚠️ Reason:</p>
                  <p className={`text-red-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.reason}</p>
                </div>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Platform</span>
                    <span className="font-medium text-gray-900">{sampleData.platform}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                Resubmit Application →
              </a>
            </>
          )}

          {/* Deposit Approved */}
          {selectedTemplate === 'deposit-approved' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                Deposit Successful! 💰
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your funds have been added
              </p>

              <div className={`rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border`} style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}10, ${selectedBrand.secondaryColor}10)`, borderColor: `${selectedBrand.primaryColor}30` }}>
                <p className={`text-gray-700 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold" style={{ color: selectedBrand.primaryColor }}>{sampleData.userName}</span>, your deposit has been successfully processed!
                </p>

                {/* Amount Card - Dynamic gradient */}
                <div className={`rounded-xl ${isMobile ? 'p-4' : 'p-6'} mb-4 text-center relative overflow-hidden`} style={{ background: brandGradient }}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <p className={`text-white/80 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>Amount Deposited</p>
                  <p className={`${amountSize} font-bold text-white`}>{sampleData.amount}</p>
                </div>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.transactionId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Status</span>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 font-semibold rounded-full ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ background: `${selectedBrand.primaryColor}15`, color: selectedBrand.primaryColor }}>
                      <Check className="w-3 h-3" /> Approved
                    </span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                View Wallet →
              </a>
            </>
          )}

          {/* Deposit Rejected */}
          {selectedTemplate === 'deposit-rejected' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                Deposit Update
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your deposit needs attention
              </p>

              <div className={`bg-gradient-to-br from-red-50 to-purple-50/30 rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border border-red-100`}>
                <p className={`text-gray-700 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold text-gray-900">{sampleData.userName}</span>, unfortunately your deposit could not be processed.
                </p>

                <div className={`bg-red-50 border-l-4 border-red-400 rounded-lg ${isMobile ? 'p-3' : 'p-4'} mb-4`}>
                  <p className={`font-semibold text-red-800 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>⚠️ Reason:</p>
                  <p className={`text-red-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.reason}</p>
                </div>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold text-gray-900">{sampleData.amount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.transactionId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                Submit New Deposit →
              </a>
            </>
          )}

          {/* BM Share Approved */}
          {selectedTemplate === 'bm-share-approved' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                BM Share Approved! 🤝
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                You now have access to the shared account
              </p>

              <div className={`rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border`} style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}10, ${selectedBrand.secondaryColor}10)`, borderColor: `${selectedBrand.primaryColor}30` }}>
                <p className={`text-gray-700 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold" style={{ color: selectedBrand.primaryColor }}>{sampleData.userName}</span>, your Business Manager share request has been approved!
                </p>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Platform</span>
                    <span className="font-semibold text-gray-900 px-3 py-1 rounded-full text-sm" style={{ background: `${selectedBrand.secondaryColor}15` }}>{sampleData.platform}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">BM ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.bmId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Account ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.accountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                View BM Share Log →
              </a>
            </>
          )}

          {/* BM Share Rejected */}
          {selectedTemplate === 'bm-share-rejected' && (
            <>
              <h1 className={`${titleSize} font-bold text-gray-900 text-center mb-1`}>
                BM Share Update
              </h1>
              <p className={`text-gray-500 text-center mb-5 ${isMobile ? 'text-sm' : ''}`}>
                Your request needs attention
              </p>

              <div className={`bg-gradient-to-br from-red-50 rounded-2xl ${isMobile ? 'p-4' : 'p-6'} mb-5 border border-red-100`} style={{ background: `linear-gradient(135deg, #FEF2F2, ${selectedBrand.secondaryColor}10)` }}>
                <p className={`text-gray-700 mb-4 ${isMobile ? 'text-sm' : ''}`}>
                  Hi <span className="font-semibold text-gray-900">{sampleData.userName}</span>, unfortunately your BM share request could not be approved.
                </p>

                <div className={`bg-red-50 border-l-4 border-red-400 rounded-lg ${isMobile ? 'p-3' : 'p-4'} mb-4`}>
                  <p className={`font-semibold text-red-800 mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>⚠️ Reason:</p>
                  <p className={`text-red-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.reason}</p>
                </div>

                <div className={`bg-white rounded-xl p-4 space-y-3 border border-gray-100 ${isMobile ? 'text-sm' : ''}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Platform</span>
                    <span className="font-medium text-gray-900">{sampleData.platform}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">BM ID</span>
                    <span className={`font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded ${isMobile ? 'text-xs' : 'text-sm'}`}>{sampleData.bmId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Date</span>
                    <span className="text-gray-700">{sampleData.date}</span>
                  </div>
                </div>
              </div>

              <a href="#" className={`block w-full ${isMobile ? 'py-3 text-sm' : 'py-3.5'} hover:opacity-90 text-white text-center font-semibold rounded-xl transition-all shadow-lg`} style={{ background: brandGradient }}>
                Submit New Request →
              </a>
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`${footerPadding} border-t border-gray-100`} style={{ background: `linear-gradient(135deg, #f9fafb, ${selectedBrand.secondaryColor}10)` }}>
          <p className={`text-center text-gray-500 mb-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Need help? Our support team is here for you.
          </p>
          <div className={`flex justify-center gap-4 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            <a href={selectedBrand.helpCenterUrl} className="hover:underline font-medium" style={{ color: selectedBrand.secondaryColor }}>Help Center</a>
            <span className="text-gray-300">•</span>
            <a href={selectedBrand.contactSupportUrl} className="hover:underline font-medium" style={{ color: selectedBrand.primaryColor }}>Contact Support</a>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: brandGradient }}>
              <span className="text-white font-bold text-xs">{selectedBrand.logo}</span>
            </div>
            <span className={`text-gray-400 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>© 2026 {selectedBrand.name}. All rights reserved.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-green-50/30">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}, ${selectedBrand.secondaryColor})`, boxShadow: `0 10px 15px -3px ${selectedBrand.secondaryColor}30` }}>
                <Mail className="text-white w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Email Templates Preview</h1>
                <p className="text-sm text-gray-500">Desktop & Mobile • White-label Support</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Brand Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowBrandDropdown(!showBrandDropdown); setShowDropdown(false) }}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-lg transition-all"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}, ${selectedBrand.secondaryColor})` }}>
                    <span className="text-white font-bold text-sm">{selectedBrand.logo}</span>
                  </div>
                  <span className="font-medium text-gray-700">{selectedBrand.name}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBrandDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showBrandDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-20">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-400 uppercase">White-label Brands</span>
                    </div>
                    {brandOptions.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() => {
                          setSelectedBrand(brand)
                          setShowBrandDropdown(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all ${
                          selectedBrand.id === brand.id ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})` }}>
                          <span className="text-white font-bold">{brand.logo}</span>
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-medium text-gray-700">{brand.name}</p>
                          <p className="text-xs text-gray-400">{brand.tagline}</p>
                        </div>
                        {selectedBrand.id === brand.id && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.secondaryColor})` }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Template Selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowDropdown(!showDropdown); setShowBrandDropdown(false) }}
                  className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:shadow-lg transition-all"
                  style={{ borderColor: showDropdown ? selectedBrand.secondaryColor : undefined }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    currentTemplate.color === '#52B788'
                      ? 'text-white'
                      : 'bg-red-50 text-red-500'
                  }`} style={currentTemplate.color === '#52B788' ? { background: `linear-gradient(135deg, ${selectedBrand.primaryColor}30, ${selectedBrand.secondaryColor}30)`, color: selectedBrand.primaryColor } : {}}>
                    {currentTemplate.icon}
                  </div>
                  <span className="font-medium text-gray-700">{currentTemplate.label}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-20">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplate(template.id)
                          setShowDropdown(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all ${
                          selectedTemplate === template.id ? 'bg-gray-50' : ''
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          template.color === '#52B788'
                            ? ''
                            : 'bg-red-50 text-red-500'
                        }`} style={template.color === '#52B788' ? { background: `linear-gradient(135deg, ${selectedBrand.primaryColor}20, ${selectedBrand.secondaryColor}20)`, color: selectedBrand.primaryColor } : {}}>
                          {template.icon}
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-medium text-gray-700">{template.label}</p>
                          <p className="text-xs text-gray-400 truncate">{template.subject}</p>
                        </div>
                        {selectedTemplate === template.id && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}, ${selectedBrand.secondaryColor})` }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Email Subject Preview */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}, ${selectedBrand.secondaryColor})` }}>
                <span className="text-white font-bold">{selectedBrand.logo}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{selectedBrand.name}</span>
                <span className="text-gray-400 text-sm">&lt;{selectedBrand.email}&gt;</span>
              </div>
              <p className="font-medium text-gray-900">{currentTemplate.subject.replace('COINEST', selectedBrand.name)}</p>
              <p className="text-sm text-gray-500">To: {sampleData.userEmail}</p>
            </div>
            <div className="text-sm text-gray-400">
              {sampleData.date}
            </div>
          </div>
        </div>
      </div>

      {/* Side by Side Preview */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Desktop View */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}20, ${selectedBrand.secondaryColor}20)` }}>
                <Monitor className="w-4 h-4" style={{ color: selectedBrand.secondaryColor }} />
              </div>
              <span className="font-semibold text-gray-700">Desktop View</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">600px</span>
            </div>
            <div className="p-8 rounded-2xl" style={{ background: `linear-gradient(135deg, #e5e7eb, ${selectedBrand.secondaryColor}20)` }}>
              <div className="max-w-[600px] mx-auto">
                <EmailContent isMobile={false} />
              </div>
            </div>
          </div>

          {/* Mobile View */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${selectedBrand.primaryColor}20, ${selectedBrand.secondaryColor}20)` }}>
                <Smartphone className="w-4 h-4" style={{ color: selectedBrand.primaryColor }} />
              </div>
              <span className="font-semibold text-gray-700">Mobile View</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">320px</span>
            </div>
            <div className="p-8 rounded-2xl flex justify-center" style={{ background: `linear-gradient(135deg, #e5e7eb, ${selectedBrand.primaryColor}20)` }}>
              {/* Phone Frame */}
              <div className="relative">
                {/* Dynamic Island */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-10 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-800"></div>
                  <div className="w-3 h-3 rounded-full bg-gray-800 ring-1 ring-gray-700"></div>
                </div>
                {/* Phone Frame */}
                <div className="w-[350px] bg-gray-900 rounded-[50px] p-3 shadow-2xl">
                  {/* Screen */}
                  <div className="bg-white rounded-[42px] overflow-hidden">
                    {/* Status Bar */}
                    <div className="bg-white text-black px-8 pt-4 pb-2 flex justify-between items-center text-sm font-semibold">
                      <span>9:41</span>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                        </svg>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2 22h20V2z"/>
                        </svg>
                        <div className="w-7 h-3.5 border-2 border-black rounded-sm flex items-center justify-end pr-0.5 relative">
                          <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-black rounded-r"></div>
                          <div className="w-5 h-2 bg-green-500 rounded-sm"></div>
                        </div>
                      </div>
                    </div>
                    {/* Email App Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
                      <svg className="w-5 h-5" style={{ color: selectedBrand.secondaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">Inbox</span>
                    </div>
                    {/* Email Content */}
                    <div className="max-h-[560px] overflow-y-auto">
                      <div className="w-[324px]">
                        <EmailContent isMobile={true} />
                      </div>
                    </div>
                  </div>
                </div>
                {/* Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1 bg-white rounded-full"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
