import React from 'react'
import { LandingNavbar } from './components/navbar'
import { HeroSection } from './components/hero-section'
import { FeaturesSection } from './components/features-section'
import { PricingSection } from './components/pricing-section'
import { FaqSection } from './components/faq-section'
import { CTASection } from './components/cta-section'
import { LandingFooter } from './components/footer'
import { AboutSection } from './components/about-section'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <CTASection />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}
