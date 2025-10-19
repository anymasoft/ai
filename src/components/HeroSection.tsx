"use client";

import { Bot, MessageSquare, Zap, Shield, Target, Clock, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Hero Section
const HeroSection = () => {
  return (
    <section className="py-12 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-3xl text-lg md:text-xl">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="mt-8">
            Попробовать бесплатно
          </Button>
        </div>
      </div>
    </section>
  );
};

// Problems Section
const ProblemsSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-6">Почему это важно</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Clock className="size-8 text-red-500 mb-4" />
              <CardTitle className="text-lg">Сотни отзывов в день</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Невозможно отвечать вручную на все отзывы качественно и быстро
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Target className="size-8 text-red-500 mb-4" />
              <CardTitle className="text-lg">Падение рейтинга</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Медленные ответы приводят к снижению позиций в поиске
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="size-8 text-red-500 mb-4" />
              <CardTitle className="text-lg">Траты на менеджеров</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                25-40 тысяч рублей в месяц на менеджеров по отзывам
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

// Solution Section
const SolutionSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-6">Как наш сервис решает эти проблемы</h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Zap className="size-8 text-blue-500 mb-4" />
              <CardTitle className="text-lg">AI-генерация ответов</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Уникальные ответы на отзывы, созданные искусственным интеллектом
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Shield className="size-8 text-blue-500 mb-4" />
              <CardTitle className="text-lg">Несколько маркетплейсов</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Поддержка нескольких маркетплейсов в одном кабинете
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Target className="size-8 text-blue-500 mb-4" />
              <CardTitle className="text-lg">Настройка стиля</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Выбор стиля ответа, настройка промптов, ключевых слов и стоп-слов
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <MessageSquare className="size-8 text-blue-500 mb-4" />
              <CardTitle className="text-lg">Уведомления</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Оповещения в Telegram и Email о новых негативных отзывах
              </p>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2 lg:col-span-2">
            <CardHeader>
              <Bot className="size-8 text-blue-500 mb-4" />
              <CardTitle className="text-lg">Полуавтомат</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                AI предлагает варианты ответов, вы публикуете один из них в один клик
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

// Pricing Section
const PricingSection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-6">Тарифы</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Start</CardTitle>
              <div className="text-3xl font-bold">1,990 ₽<span className="text-lg font-normal text-muted-foreground">/мес</span></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  До 100 отзывов
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  1 маркетплейс
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Базовый AI
                </li>
              </ul>
              <Button className="w-full" variant="outline">Выбрать план</Button>
            </CardContent>
          </Card>
          
          <Card className="border-2 border-blue-500 relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">Популярный</span>
            </div>
            <CardHeader>
              <CardTitle className="text-xl">Pro</CardTitle>
              <div className="text-3xl font-bold">3,990 ₽<span className="text-lg font-normal text-muted-foreground">/мес</span></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  До 500 отзывов
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  До 3 маркетплейсов
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Умный AI (GPT-4)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Telegram-оповещения
                </li>
              </ul>
              <Button className="w-full">Выбрать план</Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Enterprise</CardTitle>
              <div className="text-3xl font-bold">7,990 ₽<span className="text-lg font-normal text-muted-foreground">/мес</span></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Безлимит отзывов
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Персональный менеджер
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-green-500" />
                  Расширенная аналитика
                </li>
              </ul>
              <Button className="w-full" variant="outline">Связаться с нами</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-6">Начните экономить время уже сегодня</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button size="lg" className="mt-8">
            Попробовать бесплатно
          </Button>
        </div>
      </div>
    </section>
  );
};

// Footer
const Footer = () => {
  return (
    <footer className="bg-background border-t py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-6" />
            <span className="font-medium">АИ Отвечатор</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#privacy" className="hover:text-foreground">Политика конфиденциальности</Link>
            <Link href="#terms" className="hover:text-foreground">Условия использования</Link>
            <Link href="#contact" className="hover:text-foreground">Контакты</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Landing Page Component
const LandingPage = () => {
  return (
    <div>
      <HeroSection />
      <ProblemsSection />
      <SolutionSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export { LandingPage as FeatureSection };
export default HeroSection;