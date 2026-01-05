import type { Metadata } from 'next'
import { LandingPageContent } from './landing/landing-page-content'

// Metadata for the landing page
export const metadata: Metadata = {
  title: 'Beem — проверка карточек товаров для Ozon и Wildberries',
  description:
    'Проверьте описание товара для Ozon и Wildberries и заранее узнайте, пройдёт ли карточка модерацию. Beem находит критические ошибки и стоп-слова до публикации.',
  keywords: [
    'проверка карточки ozon',
    'проверка карточки wildberries',
    'модерация ozon',
    'модерация wildberries',
    'ошибки карточки товара',
    'стоп слова ozon',
    'стоп слова wildberries',
    'проверка описания товара',
  ],
  openGraph: {
    title: 'Beem — проверка карточек товаров Ozon и Wildberries',
    description:
      'Сервис проверки описаний товаров для Ozon и Wildberries. Показывает, пройдёт ли карточка модерацию, и подсвечивает критические ошибки и риски.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Beem — проверка карточек Ozon и WB',
    description:
      'Проверьте описание товара для Ozon и Wildberries перед публикацией и снизьте риск отклонения карточки.',
  },
}

export default function HomePage() {
  return <LandingPageContent />
}
