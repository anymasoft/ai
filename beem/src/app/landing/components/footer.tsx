"use client"

import { Separator } from '@/components/ui/separator'
import { Heart } from 'lucide-react'
import { Logo } from '@/components/logo'

const footerLinks = {
  product: [
    { name: 'Функции', href: '#features' },
    { name: 'Тарифы', href: '#pricing' },
    { name: 'О нас', href: '#about' },
    { name: 'ЧаВО', href: '#faq' },
  ],
  company: [
    { name: 'Контакты', href: '#contact' },
    // { name: 'Blog', href: '#blog' },
    // { name: 'Careers', href: '#careers' },
    // { name: 'Press', href: '#press' },
  ],
  // resources: [
  //   { name: 'Help Center', href: '#help' },
  //   { name: 'Community', href: '#community' },
  //   { name: 'Guides', href: '#guides' },
  //   { name: 'Webinars', href: '#webinars' },
  // ],
  legal: [
    { name: 'Политика конфиденциальности', href: '/privacy' },
    { name: 'Условия использования', href: '/terms' },
    // { name: 'Security', href: '#security' },
    // { name: 'Status', href: '#status' },
  ],
}

export function LandingFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Contact Section */}
        <div className="mb-16" id="contact">
          <div className="mx-auto max-w-2xl text-center">
            <h3 className="text-2xl font-bold mb-4">Контакты</h3>
            <p className="text-muted-foreground mb-6">
              Есть вопросы или предложения? Свяжитесь с нами по email.
            </p>
            <div className="text-center">
              <a href="mailto:support@beem.ink" className="text-lg font-medium text-primary hover:underline">
                support@beem.ink
              </a>
            </div>
          </div>
        </div>

        {/* Main Footer Content */}
        <div className="grid gap-8 grid-cols-4 lg:grid-cols-6">
          {/* Brand Column */}
          <div className="col-span-4 lg:col-span-2 max-w-2xl">
            <div className="flex items-center space-x-2 mb-4 max-lg:justify-center">
              <div className="flex items-center space-x-2">
                <Logo size={32} />
                <span className="font-bold text-xl">Beem Analytics</span>
              </div>
            </div>
            <p className="text-muted-foreground mb-6 max-lg:text-center max-lg:flex max-lg:justify-center">
              Инструмент для подготовки описаний карточек товаров для Ozon и Wildberries с учётом требований маркетплейсов.
            </p>
          </div>

          {/* Links Columns */}
          <div className='max-md:col-span-2 lg:col-span-1'>
            <h4 className="font-semibold mb-4">Продукт</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className='max-md:col-span-2 lg:col-span-1'>
            <h4 className="font-semibold mb-4">Компания</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* <div className='max-md:col-span-2 lg:col-span-1'>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div> */}

          <div className='max-md:col-span-2 lg:col-span-1'>
            <h4 className="font-semibold mb-4">Юридические</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-2">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-muted-foreground text-sm">
            <div className="flex items-center gap-1">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-red-500 fill-current" />
              <span>by</span>
              <span className="font-semibold text-foreground">Beem Analytics</span>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-4 md:mt-0">
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Политика конфиденциальности
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors">
              Условия использования
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
