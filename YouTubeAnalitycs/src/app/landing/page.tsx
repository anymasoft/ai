import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'

// Metadata for the landing page
export const metadata: Metadata = {
  title: 'Сценарии для YouTube — идеи видео, которые набирают просмотры',
  description: 'Генератор идей и сценариев для YouTube на основе анализа конкурентов и трендовых видео. Создавайте видео, которые реально набирают просмотры.',
  keywords: ['сценарии для youtube', 'идеи для youtube', 'что снимать на youtube', 'анализ конкурентов youtube', 'рост просмотров youtube', 'youtube сценарии', 'youtube идеи видео'],
  openGraph: {
    title: 'Сценарии для YouTube — идеи видео, которые набирают просмотры',
    description: 'Генератор идей и сценариев для YouTube на основе анализа конкурентов и трендовых видео. Создавайте видео, которые реально набирают просмотры.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Сценарии для YouTube — идеи видео, которые набирают просмотры',
    description: 'Генератор идей и сценариев для YouTube на основе анализа конкурентов и трендовых видео. Создавайте видео, которые реально набирают просмотры.',
  },
}

export default function LandingPage() {
  return <LandingPageContent />
}
