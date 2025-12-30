import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'

// Metadata for the landing page
export const metadata: Metadata = {
  title: 'Beem Analytics — AI-сервис для создания сценариев YouTube и анализа конкурентов',
  description: 'Создавайте сильные YouTube-сценарии и находите идеи для роста канала с помощью AI: анализ конкурентов, контента и работающих форматов — всё в одном сервисе.',
  keywords: [
    'youtube сценарии',
    'идеи для youtube',
    'анализ конкурентов youtube',
    'ai сценарии видео',
    'продвижение youtube канала',
  ],
  openGraph: {
    title: 'Beem Analytics — AI-сценарии и рост YouTube-каналов',
    description: 'AI-платформа для создания сценариев YouTube и поиска идей через анализ конкурентов и контента. Помогает быстрее расти и снимать видео, которые заходят.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beem Analytics — AI-сценарии для YouTube',
    description: 'Создавайте сценарии YouTube и находите выигрышные идеи с помощью AI-анализа конкурентов и контента.',
  },
}


export default function LandingPage() {
  return <LandingPageContent />
}
