'use client'

import { useEffect } from 'react'
import Header from '@/components/sections/Header'
import HeroSection from '@/components/sections/HeroSection'
import HowItWorksSection from '@/components/sections/HowItWorksSection'
import ServicesSection from '@/components/sections/ServicesSection'
import BenefitsSection from '@/components/sections/BenefitsSection'
import ComparisonSection from '@/components/sections/ComparisonSection'
import PricingSection from '@/components/sections/PricingSection'
import GuaranteeSection from '@/components/sections/GuaranteeSection'
import TestimonialsSection from '@/components/sections/TestimonialsSection'
import MeetTeamSection from '@/components/sections/MeetTeamSection'
import GlobalPresenceSection from '@/components/sections/GlobalPresenceSection'
import FooterSection from '@/components/sections/FooterSection'
import MilestoneSection from '@/components/sections/MilestoneSection'
import ContactSection from '@/components/sections/ContactSection'

export default function HomePage() {
  // Add 'is-scrolling' class to body during scroll for CSS perf optimizations
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      document.body.classList.add('is-scrolling')
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearTimeout(scrollTimer)
    }
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 text-white overflow-x-hidden">
      <Header />
      <HeroSection />
      <ServicesSection />
      <BenefitsSection />
      <HowItWorksSection />
      <ComparisonSection />
      <PricingSection />
      <GuaranteeSection />
      <ContactSection />
      <MilestoneSection />
      <TestimonialsSection />
      <MeetTeamSection />
      <GlobalPresenceSection />
      <FooterSection />
    </div>
  )
}
