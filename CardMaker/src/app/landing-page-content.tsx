"use client"

import React from 'react'
import { LandingNavbar } from './landing/components/navbar'
import { HeroSection } from './landing/components/hero-section'
import { LogoCarousel } from './landing/components/logo-carousel'
// import { StatsSection } from './landing/components/stats-section'
import { FeaturesSection } from './landing/components/features-section'
// import { TeamSection } from './landing/components/team-section'
// import { TestimonialsSection } from './landing/components/testimonials-section'
// import { BlogSection } from './landing/components/blog-section'
import { PricingSection } from './landing/components/pricing-section'
import { CTASection } from './landing/components/cta-section'
// import { ContactSection } from './landing/components/contact-section'
// import { FaqSection } from './landing/components/faq-section'
import { LandingFooter } from './landing/components/footer'
// import { LandingThemeCustomizer, LandingThemeCustomizerTrigger } from './landing/components/landing-theme-customizer'
import { AboutSection } from './landing/components/about-section'
import { FreeFormSection } from './landing/components/free-form-section'

export function LandingPageContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <LandingNavbar />

      {/* Main Content */}
      <main>
        <HeroSection />
        {/* Free-form generation — directly after "Your success starts here" button */}
        <FreeFormSection />
        {/* <LogoCarousel /> */}
        {/* <StatsSection /> */}
        <AboutSection />
        <FeaturesSection />
        {/* <TeamSection /> */}
        <PricingSection />
        {/* <TestimonialsSection /> */}
        {/* <BlogSection /> */}
        {/* <FaqSection /> */}
        {/* <CTASection /> */}
        {/* <ContactSection /> */}
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}
