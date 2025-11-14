import React from 'react';

export default function Features() {
  const features = [
    {
      icon: '🟦',
      title: 'Перевод лучше чем у YouTube',
      description: 'AI GPT-4 обеспечивает более точный и естественный перевод с учётом контекста',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: '🟩',
      title: 'Караоке-подсветка речи',
      description: 'Текст подсвечивается синхронно с видео, как в Netflix. Удобно следить за речью',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: '🟧',
      title: 'Поддержка всех языков',
      description: 'Русский, английский, испанский, немецкий, французский, японский, китайский и другие',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: '🟪',
      title: 'Быстрая работа через GPT',
      description: 'Мгновенный перевод благодаря мощным языковым моделям OpenAI',
      color: 'from-purple-500 to-purple-600',
    },
    {
      icon: '🟨',
      title: 'Сохранение в SRT, VTT, TXT',
      description: 'Экспортируйте субтитры в любом популярном формате для монтажа или просмотра',
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      icon: '🟫',
      title: 'Работает локально в браузере',
      description: 'Не нужно загружать видео на сторонние сервисы. Всё работает прямо в YouTube',
      color: 'from-amber-700 to-amber-800',
    },
    {
      icon: '🔵',
      title: 'Free-тариф без регистрации',
      description: 'Начните использовать расширение немедленно. Никаких аккаунтов и подписок',
      color: 'from-blue-600 to-indigo-600',
    },
    {
      icon: '⚡',
      title: 'Молниеносная скорость',
      description: 'Построчный перевод отображается в реальном времени по мере обработки',
      color: 'from-yellow-400 to-orange-500',
    },
  ];

  return (
    <section className="section">
      <div className="container-custom">
        {/* Section header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 md:text-4xl">
            Почему Video Reader AI?
          </h2>
          <p className="text-lg text-gray-600">
            Мощные возможности для идеального перевода субтитров
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200"
            >
              {/* Icon */}
              <div className="mb-4">
                <span className="text-5xl">{feature.icon}</span>
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              {/* Hover effect */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
            </div>
          ))}
        </div>

        {/* Why better section */}
        <div className="mt-20 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left: Comparison */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Сравнение с YouTube
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">В 10× быстрее</p>
                    <p className="text-sm text-gray-600">Мгновенный перевод vs медленная загрузка</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Контекстный перевод</p>
                    <p className="text-sm text-gray-600">AI понимает смысл, а не просто слова</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Внутри YouTube</p>
                    <p className="text-sm text-gray-600">Не нужно переключаться между вкладками</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Скачивание файлов</p>
                    <p className="text-sm text-gray-600">Экспорт в SRT/VTT/TXT одним кликом</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative">
              <div className="relative bg-white rounded-xl p-6 shadow-xl">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded flex-1"></div>
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <div className="h-3 bg-gray-100 rounded flex-1"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded flex-1"></div>
                  </div>
                  <div className="flex items-center gap-3 pl-5">
                    <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Перевод...</span>
                    <span className="text-green-600 font-medium">95%</span>
                  </div>
                  <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: '95%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
