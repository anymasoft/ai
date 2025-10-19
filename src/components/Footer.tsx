"use client";

import { Bot, MessageSquare, Settings, Zap, CheckCircle, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";

const MarketplaceAutoResponder = () => {
  const problems = [
    "Сотни отзывов в день, невозможно отвечать вручную",
    "Падение рейтинга из-за медленных ответов",
    "Траты на менеджеров по отзывам — 25–40 тыс руб/мес"
  ];

  const solutions = [
    {
      icon: Bot,
      text: "AI-генерация уникальных ответов на отзывы"
    },
    {
      icon: Settings,
      text: "Поддержка нескольких маркетплейсов в одном кабинете"
    },
    {
      icon: MessageSquare,
      text: "Выбор стиля ответа, настройка промптов, ключевых слов и стоп-слов"
    },
    {
      icon: Zap,
      text: "Оповещения в Telegram и Email о новых негативных или критических отзывах"
    },
    {
      icon: CheckCircle,
      text: "Полуавтомат: AI предлагает варианты, вы публикуете один из них в один клик"
    },
    {
      icon: TrendingUp,
      text: "Аналитика ответов и мониторинг рейтинга в режиме реального времени"
    }
  ];

  const plans = [
    {
      name: "Start",
      price: "1,990",
      period: "/мес",
      features: [
        "До 100 отзывов",
        "1 маркетплейс", 
        "Базовый AI"
      ]
    },
    {
      name: "Pro",
      price: "3,990",
      period: "/мес",
      popular: true,
      features: [
        "До 500 отзывов",
        "До 3 маркетплейсов",
        "Умный AI (GPT-4)",
        "Telegram-оповещения"
      ]
    },
    {
      name: "Enterprise",
      price: "7,990", 
      period: "/мес",
      features: [
        "Безлимит отзывов",
        "Персональный менеджер",
        "Расширенная аналитика"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="py-24 px-4" id="hero">
        <div className="container max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Автоматические ответы на отзывы маркетплейсов
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Экономьте время и повышайте продажи, используя AI для управления отзывами на Wildberries, Ozon и Яндекс.Маркет
          </p>
          <Button size="lg" className="text-lg px-8 py-3">
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Почему это важно
          </h2>
          <div className="space-y-6 mb-8">
            {problems.map((problem, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-semibold">{index + 1}</span>
                </div>
                <p className="text-lg text-gray-700">{problem}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-600 text-lg">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-20 px-4" id="features">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Как наш сервис решает эти проблемы
          </h2>
          <div className="space-y-8">
            {solutions.map((solution, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <solution.icon className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-lg text-gray-700 pt-2">{solution.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 bg-gray-50" id="pricing">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Тарифы
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}>
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500">
                    Популярный
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-6" variant={plan.popular ? "default" : "outline"}>
                    Выбрать план
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">
            Начните экономить время уже сегодня
          </h2>
          <Button size="lg" className="text-lg px-8 py-3">
            Попробовать бесплатно
          </Button>
          <p className="text-gray-600 mt-4">
            Без риска, без необходимости нанимать менеджеров
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-4 bg-gray-900 text-white" id="contacts">
        <div className="container max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-2xl font-bold mb-4">
                <Bot className="w-8 h-8" />
                RepIQ
              </div>
              <p className="text-gray-400">
                Автоматизация ответов на отзывы для маркетплейсов
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Контакты</h3>
              <ul className="space-y-2 text-gray-400">
                <li>support@repiq.ru</li>
                <li>+7 (495) 123-45-67</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Документы</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Политика конфиденциальности</a></li>
                <li><a href="#" className="hover:text-white">Условия использования</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© 2025 RepIQ. Все права защищены.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export { MarketplaceAutoResponder as Footer };