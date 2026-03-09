import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleOpenChat = () => {
    navigate('/c/new');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
      {/* Navbar */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">AI Hub</div>
            <button
              onClick={handleOpenChat}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Открыть чат
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold text-white sm:text-6xl md:text-7xl">
            AI Hub
          </h1>
          <p className="mt-6 text-xl text-gray-300 sm:text-2xl">
            Доступ к современным AI моделям без VPN
          </p>
          <p className="mt-4 text-lg text-gray-400">
            Общайтесь с GPT-4o, Claude, DeepSeek и другими передовыми моделями в одном месте
          </p>
          <button
            onClick={handleOpenChat}
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Начать
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white mb-16">Возможности</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
              <div className="mb-4 text-3xl">🚀</div>
              <h3 className="mb-2 text-lg font-semibold text-white">Быстро и мощно</h3>
              <p className="text-gray-400">
                Доступ к самым передовым AI моделям с высокой скоростью ответа
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
              <div className="mb-4 text-3xl">🔒</div>
              <h3 className="mb-2 text-lg font-semibold text-white">Безопасно</h3>
              <p className="text-gray-400">
                Ваши данные защищены, все запросы обрабатываются с шифрованием
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
              <div className="mb-4 text-3xl">💰</div>
              <h3 className="mb-2 text-lg font-semibold text-white">Доступно</h3>
              <p className="text-gray-400">
                Гибкие тарифы, платите только за то, что используете
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-white mb-16">Тарифы</h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Free Plan */}
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
              <h3 className="text-xl font-bold text-white mb-2">Free</h3>
              <p className="text-gray-400 mb-6">0 ₽/мес</p>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  300 000 токенов
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Доступ к популярным моделям
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gray-500"></span>
                  Web-поиск
                </li>
              </ul>
              <button
                onClick={handleOpenChat}
                className="w-full rounded-lg border border-gray-600 px-4 py-2 font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Начать
              </button>
            </div>

            {/* Pro Plan */}
            <div className="rounded-lg border-2 border-blue-500 bg-gray-800/50 p-8 backdrop-blur relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold text-white">
                Рекомендуется
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Pro</h3>
              <p className="text-gray-400 mb-6">Гибкие платежи</p>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Безлимитные токены
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Все доступные модели
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Web-поиск (Tavily)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Code Interpreter
                </li>
              </ul>
              <button
                onClick={handleOpenChat}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Начать
              </button>
            </div>

            {/* Business Plan */}
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
              <h3 className="text-xl font-bold text-white mb-2">Business</h3>
              <p className="text-gray-400 mb-6">Пользовательское ценообразование</p>
              <ul className="space-y-3 mb-8 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Безлимитные токены
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Все доступные модели
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  Приоритетная поддержка
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  API доступ
                </li>
              </ul>
              <button
                onClick={handleOpenChat}
                className="w-full rounded-lg border border-gray-600 px-4 py-2 font-medium text-white hover:bg-gray-700 transition-colors"
              >
                Начать
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div className="text-gray-400">
              <p>&copy; 2026 AI Hub. Все права защищены.</p>
            </div>
            <button
              onClick={handleOpenChat}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Открыть чат
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
