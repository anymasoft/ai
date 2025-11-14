import React from 'react';

export default function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '0₽',
      period: 'навсегда',
      description: 'Попробуйте основные возможности',
      features: [
        'Перевод первых 3-5 минут видео',
        'Базовый перевод субтитров',
        'Просмотр в боковой панели',
        'Без регистрации',
        'Без скачивания полного текста',
      ],
      cta: 'Начать бесплатно',
      popular: false,
      disabled: [4],
    },
    {
      name: 'Pro',
      price: '490₽',
      period: 'в месяц',
      description: 'Для активных пользователей',
      features: [
        'Полный перевод длинных видео',
        'Скачивание SRT/VTT/TXT',
        'Караоке-режим с подсветкой',
        'Приоритетная скорость',
        'Поддержка 24/7',
      ],
      cta: 'Выбрать Pro',
      popular: true,
      disabled: [],
    },
    {
      name: 'Premium',
      price: '1490₽',
      period: 'в месяц',
      description: 'Максимум возможностей для профи',
      features: [
        'Всё из Pro +',
        'Литературная обработка текста GPT',
        'Структурированный итог с абзацами',
        'Краткое саммари (1-3 версии)',
        'Авто-создание поста для Telegram',
        'Генерация аудио перевода (ElevenLabs)',
        'Приоритетная поддержка',
      ],
      cta: 'Выбрать Premium',
      popular: false,
      disabled: [],
    },
  ];

  return (
    <section className="section bg-gray-50">
      <div className="container-custom">
        {/* Section header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 md:text-4xl">
            Выберите свой тариф
          </h2>
          <p className="text-lg text-gray-600">
            Начните с бесплатного тарифа или выберите план для профессиональной работы
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 ${
                plan.popular ? 'border-2 border-blue-500 scale-105 md:scale-110' : 'border border-gray-200'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold shadow-lg">
                    ⭐ Популярный
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Plan name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-600">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <a
                  href="#"
                  className={`btn w-full mb-6 ${
                    plan.popular
                      ? 'btn-primary'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </a>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className={`flex items-start gap-3 ${
                        plan.disabled.includes(featureIndex) ? 'opacity-40' : ''
                      }`}
                    >
                      <svg
                        className={`flex-shrink-0 w-5 h-5 mt-0.5 ${
                          plan.disabled.includes(featureIndex)
                            ? 'text-gray-300'
                            : 'text-green-500'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        {plan.disabled.includes(featureIndex) ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        )}
                      </svg>
                      <span
                        className={`text-sm ${
                          plan.disabled.includes(featureIndex)
                            ? 'text-gray-400 line-through'
                            : 'text-gray-700'
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Money back guarantee */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-50 rounded-full border border-green-200">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-900">
              Гарантия возврата денег в течение 14 дней
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
