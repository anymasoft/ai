import React, { useState } from 'react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'Как работает Video Reader AI?',
      answer: 'Установите расширение в Chrome, откройте любое видео на YouTube, нажмите кнопку "Перевести субтитры" и выберите язык. AI автоматически переведёт субтитры с учётом контекста и отобразит их в боковой панели с синхронизацией по времени.',
    },
    {
      question: 'Сколько стоит использование?',
      answer: 'У нас есть бесплатный тариф, который позволяет переводить первые 3-5 минут любого видео без регистрации. Для полного доступа к длинным видео и скачиванию файлов доступен тариф Pro за 490₽/месяц. Premium-тариф с AI-обработкой текста стоит 1490₽/месяц.',
    },
    {
      question: 'Работает ли расширение на телефоне?',
      answer: 'К сожалению, расширения браузера работают только на десктопных версиях Chrome. Мы работаем над мобильным решением и планируем выпустить его в ближайшее время. Следите за обновлениями!',
    },
    {
      question: 'Есть ли поддержка длинных видео?',
      answer: 'Да! Тарифы Pro и Premium поддерживают перевод видео любой длительности. Бесплатный тариф ограничен первыми 3-5 минутами. Перевод длинных видео происходит построчно в реальном времени, поэтому вы начинаете видеть результат сразу.',
    },
    {
      question: 'Почему перевод точнее чем YouTube?',
      answer: 'Мы используем GPT-4 от OpenAI, который понимает контекст всего предложения и абзаца, а не переводит слова по отдельности. Это обеспечивает более естественный и точный перевод, особенно для идиом, жаргона и технических терминов.',
    },
    {
      question: 'Какие языки поддерживаются?',
      answer: 'Video Reader AI поддерживает перевод на 9 языков: русский, английский, испанский, немецкий, французский, японский, китайский, итальянский и португальский. Мы постоянно добавляем новые языки на основе запросов пользователей.',
    },
    {
      question: 'Можно ли скачать переведённые субтитры?',
      answer: 'Да! В тарифах Pro и Premium вы можете скачивать субтитры в трёх форматах: SRT (для видеомонтажа), VTT (веб-стандарт) и TXT (обычный текст). Это удобно для создания собственных видео или учебных материалов.',
    },
    {
      question: 'Безопасно ли расширение?',
      answer: 'Абсолютно! Расширение работает локально в вашем браузере, не собирает персональные данные и не отправляет видео на сторонние серверы. На перевод отправляется только текст субтитров. Мы не храним историю ваших просмотров.',
    },
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="section">
      <div className="container-custom">
        {/* Section header */}
        <div className="mx-auto max-w-3xl text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 md:text-4xl">
            Часто задаваемые вопросы
          </h2>
          <p className="text-lg text-gray-600">
            Всё, что нужно знать о Video Reader AI
          </p>
        </div>

        {/* FAQ List */}
        <div className="mx-auto max-w-3xl">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="text-lg font-semibold text-gray-900 pr-8">
                    {faq.question}
                  </span>
                  <svg
                    className={`flex-shrink-0 w-6 h-6 text-gray-500 transition-transform ${
                      openIndex === index ? 'transform rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Не нашли ответ на свой вопрос?
          </p>
          <a
            href="#"
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Связаться с нами
          </a>
        </div>
      </div>
    </section>
  );
}
