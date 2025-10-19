"use client";

import { Bot, Zap, Shield, MessageSquare, Clock, TrendingDown, Users, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROBLEMS = [
  {
    icon: Clock,
    title: "Сотни отзывов в день",
    description: "Невозможно отвечать вручную на все отзывы покупателей"
  },
  {
    icon: TrendingDown,
    title: "Падение рейтинга",
    description: "Медленные ответы снижают позиции в поиске"
  },
  {
    icon: Users,
    title: "Высокие затраты",
    description: "Траты на менеджеров — 25–40 тыс руб/мес"
  }
];

const SOLUTIONS = [
  {
    icon: Bot,
    title: "AI-генерация ответов",
    description: "Уникальные персонализированные ответы на каждый отзыв"
  },
  {
    icon: Shield,
    title: "Единый кабинет",
    description: "Wildberries, Ozon, Яндекс.Маркет в одном месте"
  },
  {
    icon: MessageSquare,
    title: "Настройка стиля",
    description: "Выбор тона, промптов, ключевых и стоп-слов"
  },
  {
    icon: Zap,
    title: "Умные уведомления",
    description: "Telegram и Email о критических отзывах"
  },
  {
    icon: Sparkles,
    title: "Полуавтомат режим",
    description: "AI предлагает варианты, вы выбираете в один клик"
  }
];

const PRICING = [
  {
    name: "Free",
    price: "0",
    description: "Попробуй без риска",
    features: [
      "10 отзывов в месяц",
      "1 маркетплейс (WB или Ozon)",
      "1 вариант ответа",
      "Только ручная публикация"
    ]
  },
  {
    name: "Pro",
    price: "2,490",
    popular: true,
    description: "Автоматизация без головной боли",
    features: [
      "200 отзывов в месяц",
      "2 маркетплейса",
      "3 варианта ответа",
      "Авто-публикация",
      "Telegram-уведомления",
      "Кастомные промпты"
    ]
  },
  {
    name: "Business",
    price: "4,990",
    description: "Полный контроль + безлимит",
    features: [
      "Безлимит отзывов",
      "До 5 магазинов",
      "Приоритетная обработка",
      "Экспорт в Excel",
      "Поддержка 2 часа"
    ]
  }
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-purple-100/40 to-pink-100/40 gradient-animated" />
        <div className="container max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center space-y-8">
            <Badge className="premium-glow text-blue-600 border-blue-300 bg-white shadow-lg">
              <Bot className="w-4 h-4 mr-2" />
              AI Автоответчик
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="premium-glow bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Автоматические
              </span>
              <br />
              <span className="text-gray-900">ответы на отзывы</span>
              <br />
              <span className="premium-glow bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
                маркетплейсов
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
              Сохраните рейтинг, время и нервы. <br />Владельцы магазинов теряют тысячи рублей в день из-за падения рейтинга.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-10 py-6 premium-glow bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transition-all duration-300 shadow-xl hover:shadow-2xl"
            >
              Попробовать бесплатно
            </Button>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="py-20 relative bg-white/50 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="premium-glow bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Почему это важно
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {PROBLEMS.map((problem, idx) => (
              <Card 
                key={idx} 
                className="border-red-200 bg-white shadow-lg hover:border-red-300 hover:shadow-xl transition-all duration-300 float-animation"
                style={{ animationDelay: `${idx * 0.2}s` }}
              >
                <CardHeader>
                  <problem.icon className="w-12 h-12 text-red-500 premium-glow mb-4" />
                  <h3 className="text-xl font-semibold text-red-600">{problem.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-lg text-gray-600 mt-12 max-w-2xl mx-auto font-medium">
            Если не отвечать на отзывы оперативно, продажи падают и репутация страдает
          </p>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/80 to-blue-50/80" />
        <div className="container max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="premium-glow bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Как наш сервис
              </span>
              <br />
              <span className="premium-glow bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                решает эти проблемы
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SOLUTIONS.map((solution, idx) => (
              <Card 
                key={idx} 
                className="border-blue-200 bg-white shadow-lg hover:border-blue-400 hover:shadow-2xl transition-all duration-300 group"
              >
                <CardHeader>
                  <solution.icon className="w-10 h-10 text-blue-600 group-hover:premium-glow mb-3 transition-all duration-300" />
                  <h3 className="text-lg font-semibold text-gray-900">{solution.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{solution.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 relative bg-white/50 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="premium-glow bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Тарифы
              </span>
            </h2>
            <p className="text-xl text-gray-600">Выберите подходящий план</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {PRICING.map((plan, idx) => (
              <Card 
                key={idx} 
                className={`relative border-2 bg-white transition-all duration-300 ${
                  plan.popular 
                    ? 'border-purple-400 scale-105 shadow-2xl ring-4 ring-purple-100' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-xl'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 premium-glow bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0 shadow-lg">
                    Популярный
                  </Badge>
                )}
                <CardHeader className="text-center pb-4">
                  <h3 className={`text-2xl font-bold ${plan.popular ? 'text-purple-600' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <div className="mt-4 mb-2">
                    <span className={`text-4xl font-bold ${plan.popular ? 'premium-glow bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    <span className="text-gray-600"> ₽/мес</span>
                  </div>
                  <p className={`text-sm font-medium ${plan.popular ? 'text-purple-600' : 'text-blue-600'}`}>
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-purple-600' : 'text-blue-600'}`} />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full ${
                      plan.popular 
                        ? 'premium-glow bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-xl' 
                        : 'border-2 border-blue-300 hover:border-blue-500 bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 text-blue-600 hover:text-blue-700 hover:shadow-lg font-medium'
                    } transition-all duration-300`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    Выбрать план
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 gradient-animated" />
        <div className="container max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="premium-glow bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Начните экономить
            </span>
            <br />
            <span className="premium-glow bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              время уже сегодня
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Без риска, без необходимости нанимать менеджеров
          </p>
          <Button 
            size="lg" 
            className="text-lg px-12 py-6 premium-glow bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300"
          >
            Попробовать бесплатно
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 bg-white">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-6 h-6 text-blue-600 premium-glow" />
                <span className="font-bold text-lg text-gray-900">AI Автоответчик</span>
              </div>
              <p className="text-sm text-gray-600">
                Автоматизация ответов на отзывы для маркетплейсов
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-purple-600">Контакты</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>support@airesponse.ru</p>
                <p>+7 (999) 123-45-67</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-blue-600">Документы</h3>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-gray-600 hover:text-blue-600 transition-colors">
                  Политика конфиденциальности
                </a>
                <a href="#" className="block text-gray-600 hover:text-blue-600 transition-colors">
                  Условия использования
                </a>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
            © 2024 AI Response. Все права защищены.
          </div>
        </div>
      </footer>
    </div>
  );
};

export { LandingPage };