import type { Metadata } from 'next'
import { LandingPageContent } from './landing-page-content'

export const metadata: Metadata = {
  title: 'Помощник описаний товаров для ОЗОН, Wildberries и маркетплейсов',
  description: 'Проверьте описание товара за 10 секунд. Система анализирует соответствие требованиям маркетплейсов, находит ошибки и помогает оптимизировать текст перед публикацией.',
  keywords: [
    'проверка описания товара',
    'проверитель озон',
    'проверитель wildberries',
    'описание товара маркетплейс',
    'модерация описания товара',
    'сео описание товара',
  ],
  openGraph: {
    title: 'Помощник описаний товаров для маркетплейсов',
    description: 'Проверьте, пройдет ли описание товара модерацию маркетплейсов. Анализ за 10 секунд, исправления в один клик.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Помощник описаний товаров для ОЗОН и Wildberries',
    description: 'Проверьте описание товара на соответствие требованиям маркетплейсов и избежьте отклонений модерации.',
  },
}

export default function LandingPage() {
  return <LandingPageContent />
}
