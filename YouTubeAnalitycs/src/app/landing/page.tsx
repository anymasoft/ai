import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'

// Metadata for the landing page
export const metadata: Metadata = {
  title: 'Beem Analytics - YouTube Competitors Analytics Platform',
  description: 'Powerful YouTube analytics platform for tracking competitors, analyzing content strategies, and gaining actionable insights with AI-powered analysis.',
  keywords: ['youtube analytics', 'competitor analysis', 'youtube insights', 'content strategy', 'ai analysis'],
  openGraph: {
    title: 'Beem Analytics - YouTube Competitors Analytics Platform',
    description: 'Powerful YouTube analytics platform for tracking competitors, analyzing content strategies, and gaining actionable insights with AI-powered analysis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beem Analytics - YouTube Competitors Analytics Platform',
    description: 'Powerful YouTube analytics platform for tracking competitors, analyzing content strategies, and gaining actionable insights with AI-powered analysis.',
  },
}

export default function LandingPage() {
  return <LandingPageContent />
}
