'use client'

import { useState, useRef, useEffect } from 'react'

const features = [
  { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', title: 'Increased Ad Approval Rate', desc: 'Get your ads approved in 5 minutes' },
  { icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', title: 'Run Ads For Almost Any Vertical', desc: 'Almost all types of ads supported' },
  { icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', title: 'Unlimited Ad Accounts', desc: 'Create unlimited ad accounts for your businesses.' },
  { icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z', title: '24/7 Customer Support', desc: 'We are here to support you 24/7.' },
]

const budgetOptions = ['$1,000 - $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000 - $50,000', '$50,000 - $100,000', '$100,000+']
const platformOptions = ['Facebook / Meta', 'Google Ads', 'TikTok', 'Snapchat', 'Bing / Microsoft', 'Multiple Platforms']

export default function ContactSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasPromo, setHasPromo] = useState(false)
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', companyName: '', website: '', country: '', budget: '', platform: '', description: '', promoCode: '' })

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setIsVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const msg = `New Contact from ADS360:\n\nName: ${formData.fullName}\nPhone: ${formData.phone}\nEmail: ${formData.email}\nCompany: ${formData.companyName}\nWebsite: ${formData.website}\nCountry: ${formData.country}\nBudget: ${formData.budget}\nPlatform: ${formData.platform}\nDescription: ${formData.description}${hasPromo ? `\nPromo: ${formData.promoCode}` : ''}`
    window.open(`https://t.me/ads360support?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const inp = 'w-full bg-white/[0.05] border border-white/[0.08] rounded-md sm:rounded-lg px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/40 transition-colors'
  const lbl = 'block text-[8px] sm:text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-0.5 sm:mb-1'
  const sel = `${inp} appearance-none cursor-pointer text-white/50`

  return (
    <section ref={sectionRef} id="contact" className="relative pt-6 sm:pt-16 pb-8 sm:pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
      {/* Edge animations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Left edge — vertical scanning line */}
        <div className="absolute left-[2%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.2]">
          <div className="benefits-grid-scan absolute left-0 right-0 h-[80px] bg-gradient-to-b from-transparent via-blue-400 to-transparent" />
        </div>
        {/* Right edge — vertical scanning line */}
        <div className="absolute right-[2%] top-0 bottom-0 w-[2px] overflow-hidden opacity-[0.2]">
          <div className="benefits-grid-scan absolute left-0 right-0 h-[80px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent" style={{animationDelay: '4s'}} />
        </div>
        {/* Corner brackets */}
        <div className="absolute top-6 left-6 w-12 h-12 border-l-2 border-t-2 border-blue-400/15 rounded-tl-md" />
        <div className="absolute top-6 right-6 w-12 h-12 border-r-2 border-t-2 border-blue-400/15 rounded-tr-md" />
        <div className="absolute bottom-6 left-6 w-12 h-12 border-l-2 border-b-2 border-blue-400/15 rounded-bl-md" />
        <div className="absolute bottom-6 right-6 w-12 h-12 border-r-2 border-b-2 border-blue-400/15 rounded-br-md" />
        {/* Floating orbs on edges */}
        <div className="team-glow-wander absolute top-[20%] left-[-5%] w-[300px] h-[300px] bg-blue-600/[0.06] rounded-full blur-[100px]" />
        <div className="team-glow-wander absolute bottom-[20%] right-[-5%] w-[250px] h-[250px] bg-cyan-600/[0.05] rounded-full blur-[100px]" style={{animationDelay: '6s'}} />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className={`text-center mb-4 sm:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <span className="text-blue-400 text-[9px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase">Contact Us</span>
          <h2 className="text-lg sm:text-4xl font-bold text-white mt-1 sm:mt-2">Get Started with ADS360</h2>
          <p className="text-white/45 text-[10px] sm:text-sm mt-1 sm:mt-2 max-w-lg mx-auto">Have questions or need help getting started? Reach out and we&apos;ll get back to you within 24 hours.</p>
        </div>

        {/* Card */}
        <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="grid lg:grid-cols-[1fr,1.2fr]">

            {/* Left */}
            <div className="p-4 sm:p-7 lg:p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-sm sm:text-xl font-bold text-white">Provide us with your business details</h3>
                <p className="text-white/40 text-[10px] sm:text-sm mt-1 sm:mt-2 leading-relaxed">Chat with us on Telegram or fill in the contact form and we will get back to you.</p>
                <a href="https://t.me/ads360support" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-5 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#2AABEE]/15 border border-[#2AABEE]/25 rounded-lg text-[#2AABEE] text-[10px] sm:text-sm font-medium hover:bg-[#2AABEE]/25 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Chat on Telegram
                </a>
              </div>

              {/* Features */}
              <div className="mt-4 sm:mt-8 pt-3 sm:pt-6 border-t border-white/[0.06] space-y-2 sm:space-y-4">
                {features.map((f, i) => (
                  <div key={i} className={`flex items-start gap-2 sm:gap-3 transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: `${400 + i * 80}ms` }}>
                    <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={f.icon} /></svg>
                    </div>
                    <div>
                      <h4 className="text-white text-[10px] sm:text-sm font-semibold">{f.title}</h4>
                      <p className="text-white/30 text-[8px] sm:text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Form */}
            <div className="bg-white/[0.02] border-l border-white/[0.06] p-4 sm:p-7 lg:p-8">
              <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
                {/* Name + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Full Name *</label><input type="text" name="fullName" placeholder="Name" value={formData.fullName} onChange={handleChange} className={inp} required /></div>
                  <div><label className={lbl}>Phone Number</label><input type="tel" name="phone" placeholder="+1 432 43 2434" value={formData.phone} onChange={handleChange} className={inp} /></div>
                </div>
                {/* Email */}
                <div><label className={lbl}>Email Address *</label><input type="email" name="email" placeholder="Enter your email" value={formData.email} onChange={handleChange} className={inp} required /></div>
                {/* Company */}
                <div><label className={lbl}>Company Name *</label><input type="text" name="companyName" placeholder="Enter your company name" value={formData.companyName} onChange={handleChange} className={inp} required /></div>
                {/* Website */}
                <div><label className={lbl}>Company Website *</label><input type="url" name="website" placeholder="https://www.yourcompany.com" value={formData.website} onChange={handleChange} className={inp} required /></div>
                {/* Country */}
                <div><label className={lbl}>Country / Region *</label><input type="text" name="country" placeholder="Enter your country or region" value={formData.country} onChange={handleChange} className={inp} required /></div>
                {/* Budget + Platform */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className={lbl}>Monthly Ad Spend *</label>
                    <select name="budget" value={formData.budget} onChange={handleChange} className={sel} required>
                      <option value="" className="bg-[#0a0f1e]">Select budget</option>
                      {budgetOptions.map(o => <option key={o} value={o} className="bg-[#0a0f1e] text-white">{o}</option>)}
                    </select>
                    <svg className="absolute right-3 bottom-3 w-4 h-4 text-white/25 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  <div className="relative">
                    <label className={lbl}>Advertising Platform *</label>
                    <select name="platform" value={formData.platform} onChange={handleChange} className={sel} required>
                      <option value="" className="bg-[#0a0f1e]">Select platform</option>
                      {platformOptions.map(o => <option key={o} value={o} className="bg-[#0a0f1e] text-white">{o}</option>)}
                    </select>
                    <svg className="absolute right-3 bottom-3 w-4 h-4 text-white/25 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label className={lbl}>Describe Your Business *</label>
                  <textarea name="description" placeholder="Describe your business and goals in a few sentences" value={formData.description} onChange={handleChange} rows={3} className={`${inp} resize-none`} required />
                </div>
                {/* Promo */}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="promo-check" checked={hasPromo} onChange={() => setHasPromo(!hasPromo)} className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.06] text-blue-500 cursor-pointer" />
                  <label htmlFor="promo-check" className="text-white/40 text-sm cursor-pointer select-none">Have a promo code?</label>
                </div>
                {hasPromo && <input type="text" name="promoCode" placeholder="Enter promo code" value={formData.promoCode} onChange={handleChange} className={inp} />}
                {/* Submit */}
                <button type="submit" className="w-full py-2 sm:py-3 bg-white text-[#0a0f1e] font-semibold text-xs sm:text-sm rounded-md sm:rounded-lg hover:bg-white/90 transition-all active:scale-[0.98]">
                  Submit
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
