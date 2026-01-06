"use client"

import React from 'react'
import { LandingNavbar } from './components/navbar'
import { HeroSection } from './components/hero-section'
import { FeaturesSection } from './components/features-section'
import { PricingSection } from './components/pricing-section'
import { LandingFooter } from './components/footer'
import { AboutSection } from './components/about-section'
import { FreeFormSection } from './components/free-form-section'

export function LandingPageContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        <HeroSection />
        <FreeFormSection />
        <AboutSection />
        <FeaturesSection />
        <PricingSection />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}
