import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      appName: 'Screenshot to Code'
    },
    landing: {
      header: {
        navLinks: {
          pricing: 'Pricing'
        },
        login: 'Sign In',
        register: 'Sign Up'
      },
      hero: {
        title: 'Screenshot to Code',
        description: 'Turn any screenshot into clean, production-ready code',
        badge: 'Build faster with AI',
        cta: {
          primary: 'Get Started',
          secondary: 'View on GitHub'
        },
        image: {
          light: 'App preview light',
          dark: 'App preview dark'
        }
      },
      cta: {
        title: 'Ready to get started?',
        description: 'Start converting your screenshots to code today.',
        buttons: {
          primary: 'Get Started',
          secondary: 'Learn More'
        }
      },
      logos: {
        title: 'Trusted by developers'
      },
      description: {
        title: 'Why choose us?',
        items: [
          'Fast and accurate',
          'Production-ready code',
          'Easy to use'
        ]
      },
      features: {
        title: 'Powerful features',
        items: [
          {
            title: 'AI-Powered',
            description: 'Uses advanced AI to generate code'
          }
        ]
      },
      faq: {
        title: 'Frequently Asked Questions',
        items: [
          {
            question: 'How does it work?',
            answer: 'Upload a screenshot and our AI will generate code for you.'
          }
        ]
      },
      footer: {
        description: 'Convert screenshots to code with AI'
      }
    }
  },
  ru: {
    translation: {
      appName: 'Скриншот в Код'
    },
    landing: {
      header: {
        navLinks: {
          pricing: 'Цены'
        },
        login: 'Войти',
        register: 'Зарегистрироваться'
      },
      hero: {
        title: 'Скриншот в Код',
        description: 'Превратите любой скриншот в чистый, готовый к использованию код',
        badge: 'Разрабатывайте быстрее с помощью AI',
        cta: {
          primary: 'Начать',
          secondary: 'Смотреть на GitHub'
        },
        image: {
          light: 'Превью приложения светлая',
          dark: 'Превью приложения тёмная'
        }
      },
      cta: {
        title: 'Готовы начать?',
        description: 'Начните конвертировать скриншоты в код сегодня.',
        buttons: {
          primary: 'Начать',
          secondary: 'Узнать больше'
        }
      },
      logos: {
        title: 'Доверяют разработчики'
      },
      description: {
        title: 'Почему выбрать нас?',
        items: [
          'Быстро и точно',
          'Готовый к использованию код',
          'Легко использовать'
        ]
      },
      features: {
        title: 'Мощные возможности',
        items: [
          {
            title: 'На базе AI',
            description: 'Использует продвинутый AI для генерации кода'
          }
        ]
      },
      faq: {
        title: 'Часто задаваемые вопросы',
        items: [
          {
            question: 'Как это работает?',
            answer: 'Загрузите скриншот и наш AI сгенерирует для вас код.'
          }
        ]
      },
      footer: {
        description: 'Конвертируйте скриншоты в код с помощью AI'
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
