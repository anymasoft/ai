import React from 'react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-12 md:pt-40 md:pb-20">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-100 to-purple-100 rounded-full blur-3xl opacity-30"></div>
      </div>

      <div className="container-custom">
        {/* Hero content */}
        <div className="pb-12 md:pb-16">
          {/* Section header */}
          <div className="pb-12 text-center md:pb-16">
            {/* Badges/Stats */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/50 backdrop-blur-sm px-4 py-2 shadow-sm">
              <div className="flex -space-x-2">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-white"></div>
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-white"></div>
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 border-2 border-white"></div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                Переведено более 100,000+ видео
              </span>
            </div>

            {/* Main heading */}
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
              Мгновенный перевод<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                субтитров YouTube
              </span>
            </h1>

            {/* Subheading */}
            <div className="mx-auto max-w-3xl">
              <p className="mb-8 text-lg text-gray-600 md:text-xl">
                Переводите субтитры на любой язык в один клик. Получайте точный текст, скачивайте файлы SRT/VTT/TXT. Работает прямо внутри YouTube.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#"
                  className="btn btn-primary group w-full sm:w-auto"
                >
                  <span className="relative inline-flex items-center">
                    Установить расширение
                    <span className="ml-2 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </a>
                <a
                  href="#how-it-works"
                  className="btn btn-secondary w-full sm:w-auto"
                >
                  Как это работает
                </a>
              </div>

              {/* Trust indicators */}
              <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Бесплатно</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Без регистрации</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>9 языков</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero image/demo */}
          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-2xl">
              {/* Browser chrome */}
              <div className="mb-4 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 mx-4 rounded bg-gray-700/50 px-3 py-1 text-xs text-gray-400">
                  youtube.com/watch?v=...
                </div>
              </div>

              {/* Demo content */}
              <div className="aspect-video rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-gray-700 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm mb-4">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-white text-sm font-medium">Демо расширения</p>
                  <p className="text-gray-400 text-xs mt-1">Работает прямо в YouTube</p>
                </div>
              </div>

              {/* Floating features */}
              <div className="absolute -right-4 top-1/4 hidden lg:block">
                <div className="rounded-lg bg-white p-3 shadow-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">🎯</span>
                    <span className="font-medium">AI перевод</span>
                  </div>
                </div>
              </div>
              <div className="absolute -left-4 bottom-1/4 hidden lg:block">
                <div className="rounded-lg bg-white p-3 shadow-xl">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-2xl">⚡</span>
                    <span className="font-medium">Быстро</span>
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
