import { ThemeSelector } from '@librechat/client';

export default function HomePage() {
  const handleSignIn = () => {
    window.location.href = '/oauth/yandex';
  };

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">RepliqAI</div>
        <div className="absolute bottom-4 right-4">
          <ThemeSelector />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white sm:text-5xl lg:text-6xl">
              RepliqAI
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-300">
              Все лучшие AI-модели в одном интерфейсе.
            </p>
            <p className="mt-2 text-base text-gray-500 dark:text-gray-400">
              GPT • Claude • DeepSeek
            </p>
            <p className="mt-2 text-base font-medium text-gray-600 dark:text-gray-300">
              Работает без VPN.
            </p>
            <button
              onClick={handleSignIn}
              className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Войти через Яндекс
            </button>
          </div>
        </section>

        {/* Why Section */}
        <section className="bg-gray-50 px-4 py-16 dark:bg-gray-900 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Зачем RepliqAI
            </h2>
            <div className="mt-12 space-y-6">
              {[
                'единый доступ к разным AI-моделям',
                'удобный интерфейс для работы',
                'не нужно подключать VPN',
                'не нужно оплачивать несколько сервисов',
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 flex-shrink-0">
                    <span className="text-sm font-bold text-white">—</span>
                  </div>
                  <p className="text-lg text-gray-700 dark:text-gray-300">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Models Section */}
        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Доступные модели
            </h2>
            <div className="mt-12 space-y-4">
              {['OpenAI GPT', 'Claude', 'DeepSeek'].map((model, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{model}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gray-50 px-4 py-16 dark:bg-gray-900 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              Начать пользоваться
            </h2>
            <button
              onClick={handleSignIn}
              className="mt-8 inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Войти через Яндекс
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 py-8 text-center text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
        <p>&copy; 2026 RepliqAI. Все права защищены.</p>
      </footer>
    </div>
  );
}
