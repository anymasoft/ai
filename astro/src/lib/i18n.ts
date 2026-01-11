/**
 * Internationalization (i18n) - Русская и английская локализация
 * Использование: import { i18n } from '@/lib/i18n'
 * Пример: i18n.ru.header.title или i18n.en.header.title
 */

export const i18n = {
  ru: {
    // ========== ОБЩИЕ ==========
    common: {
      appName: 'Video Reader AI',
      logout: 'Выход',
      loading: 'Загрузка...',
      error: 'Ошибка',
      success: 'Успешно',
      coming_soon: 'Скоро',
      copyright: '© 2025 Video Reader AI. Все права защищены.',
    },

    // ========== HEADER & NAVIGATION ==========
    header: {
      features: 'Возможности',
      how_it_works: 'Как это работает',
      testimonials: 'Отзывы',
      pricing: 'Тарифы',
      login: 'Вход',
    },

    // ========== HERO SECTION (Landing) ==========
    hero: {
      title: 'Поймите видео на любом языке',
      subtitle: 'Мгновенный перевод субтитров прямо в YouTube. Без регистрации.',
      cta_install: 'Установить в Chrome — Бесплатно',
      cta_pricing: 'Посмотреть тарифы',
      trusted: 'Доверяют пользователи по всему миру',
    },

    // ========== FEATURES SECTION ==========
    features: {
      title: 'Мощный ассистент для понимания контента на других языках',
      subtitle: 'Video Reader AI помогает вам смотреть видео на любом языке с мгновенным переводом субтитров.',

      feature_1: 'Мгновенный перевод субтитров',
      feature_1_desc: 'Получайте точные субтитры на любом языке в момент их появления.',

      feature_2: 'Учитесь во время просмотра',
      feature_2_desc: 'Улучшайте языковые навыки естественным образом с помощью контекстного перевода.',

      feature_3: 'Экспорт субтитров (Premium)',
      feature_3_desc: 'Загружайте переведённые субтитры в форматах SRT, VTT и TXT.',

      feature_4: 'Приватный дизайн',
      feature_4_desc: 'Ваши данные просмотра никогда не покидают ваш браузер. Без отслеживания.',
    },

    // ========== STATS SECTION ==========
    stats: {
      title: 'Перевод с помощью AI, созданный для YouTube',
      subtitle: 'Video Reader AI разработан для зрителей, которые хотят получить доступ к мировому контенту без языковых барьеров. Смотрите ли вы на иностранном языке или создателей со всего мира — наш AI даст вам понятные, контекстные субтитры.',

      stat_1: 'Перевод на экране',
      stat_1_desc: 'Всё происходит прямо в плеере YouTube. Без переключения между приложениями.',

      stat_2: 'Быстро и точно',
      stat_2_desc: 'Работает на основе передовых AI-моделей, оптимизированных для реального времени.',
    },

    // ========== TESTIMONIALS ==========
    testimonials: {
      title: 'Что говорят пользователи о Video Reader AI',

      testimonial_1: {
        name: 'Анна Петрова',
        role: 'Студентка',
        text: 'Это расширение помогло мне смотреть японские видео, которые я раньше не могла понять.',
      },

      testimonial_2: {
        name: 'Карлос Мендес',
        role: 'Разработчик',
        text: 'Идеально подходит для просмотра международного контента о технологиях. Качество перевода потрясающее.',
      },

      testimonial_3: {
        name: 'Эмили Чжан',
        role: 'Контент-создатель',
        text: 'Экономит массу времени. Экспорт субтитров в Premium — бесценный инструмент.',
      },

      testimonial_4: {
        name: 'Дэвид Ким',
        role: 'Изучающий язык',
        text: 'Игра меняет правила. Учу испанский через аутентичный контент — контекст сохраняется идеально.',
      },

      testimonial_5: {
        name: 'Сара Джонсон',
        role: 'Исследователь',
        text: 'Необходимо для доступа к международному академическому контенту. Точность впечатляет.',
      },

      testimonial_6: {
        name: 'Майкл Браун',
        role: 'Учитель',
        text: 'Мои ученики используют это для доступа к образовательному контенту со всего мира. Просто и эффективно.',
      },
    },

    // ========== PRICING SECTION ==========
    pricing: {
      title: 'Простые и понятные тарифы',

      plan_free: 'Бесплатно',
      plan_free_desc: 'Отличный способ попробовать инструмент',
      plan_free_features: [
        'Перевод до 30% текста видео',
        'Базовое качество',
        'Без экспорта',
      ],

      plan_pro: 'Профессиональный',
      plan_pro_desc: 'Полный перевод субтитров с приоритетом',
      plan_pro_price: '$9/месяц',
      plan_pro_features: [
        'Перевод 100% субтитров',
        'Приоритетная обработка',
        'Без экспорта',
      ],

      plan_premium: 'Премиум',
      plan_premium_desc: 'Полный перевод с возможностью экспорта',
      plan_premium_price: '$19/месяц',
      plan_premium_features: [
        'Перевод 100% субтитров',
        'Приоритетная обработка',
        'Экспорт субтитров в SRT',
      ],

      most_popular: 'Самый популярный',
      get_started: 'Начать',
    },

    // ========== CTA SECTION ==========
    cta: {
      title: 'Начните использовать Video Reader AI сегодня',
      subtitle: 'Присоединитесь к тысячам пользователей, которые смотрят YouTube без языковых барьеров.',
    },

    // ========== FOOTER ==========
    footer: {
      features: 'Возможности',
      how_it_works: 'Как это работает',
      testimonials: 'Отзывы',
      pricing: 'Тарифы',
      description: 'AI-powered YouTube subtitle translation для мирового контента',
      terms: 'Условия использования',
      privacy: 'Политика конфиденциальности',
      need_help: 'Нужна помощь?',
      contact: 'Связаться',
    },

    // ========== BLOG SECTION ==========
    blog: {
      title: 'Руководства и видеоуроки',
      subtitle: 'Узнайте, как максимально эффективно использовать Video Reader AI.',

      article_1_title: 'Как перевести YouTube субтитры в один клик',
      article_1_desc: 'Быстрое руководство для начинающих использовать Video Reader AI.',
      article_2_title: 'Топ-5 способов выучить языки с помощью YouTube',
      article_2_desc: 'Как AI перевод помогает усваивать контент быстрее.',
      article_3_title: 'Как экспортировать субтитры для учёбы и работы',
      article_3_desc: 'Используйте Premium план для извлечения субтитров в разных форматах.',
      read_more: 'Читать дальше',
    },

    // ========== /APP PAGE (Рабочая область) ==========
    app: {
      upload_placeholder_title: 'Перетащите фото сюда',
      upload_placeholder_text: 'или нажмите, чтобы выбрать',
      duration_6s: '6 сек',
      duration_10s: '10 сек',
      video_placeholder: 'Создайте видео',
      video_loading: 'Создаём видео...',
      prompt_placeholder: 'Опишите, как должен двигаться товар…',
      generate_tooltip: 'Выберите фото, введите описание видео',
      download_button: 'Скачать',
      clear_button: 'Очистить',
    },

    // ========== /BILLING PAGE (Тарифы) ==========
    billing: {
      title: 'Пополнить баланс',
      subtitle: 'Купите кредиты для создания видео',

      pack_starter: 'Стартовый пакет',
      pack_starter_desc: 'Идеально для начинающих',
      pack_starter_price: '$9',
      pack_starter_features: [
        '10 видеогенераций',
        'До 60 секунд',
        'Стандартное качество',
      ],

      pack_pro: 'Профессиональный пакет',
      pack_pro_desc: 'Для активных создателей',
      pack_pro_price: '$29',
      pack_pro_features: [
        '50 видеогенераций',
        'До 120 секунд',
        'Премиум качество',
        'Приоритетная обработка',
      ],

      most_popular: 'Самый популярный',
      coming_soon: 'Скоро',
      payment_info: 'Обработка платежей скоро. Пока что享受 5 бесплатных видео!',
    },

    // ========== /ACCOUNT PAGE (Аккаунт) ==========
    account: {
      title: 'Мой профиль',
      subtitle: 'Управляйте информацией вашего аккаунта',
      plan: 'Тариф',
      credits: 'Генерации',
      admin_section: 'Администраторские функции',
      admin_access: 'У вас есть доступ администратора',
      admin_info: 'Функции администратора скоро. Вы можете управлять кредитами и планами пользователей через базу данных.',
    },

    // ========== /ADMIN PAGE (Администратор) ==========
    admin: {
      title: 'Администраторские настройки',
      subtitle: 'Управляйте системой и данными пользователей',
      administrator: 'Администратор',

      user_management: '👥 Управление пользователями',
      user_management_desc: 'Просматривайте и управляйте всеми пользователями в системе',

      credits_management: '💰 Управление генерациями',
      credits_management_desc: 'Управляйте кредитами и тарифами пользователей',

      settings: '⚙️ Системные настройки',
      settings_desc: 'Настройте глобальные параметры приложения',

      coming_soon: '🚀 Скоро',
      coming_soon_desc: 'Функции административной панели разрабатываются. Скоро будут доступны дополнительные инструменты управления.',
    },

    // ========== /SIGN-IN PAGE (Вход) ==========
    signin: {
      title: 'Добро пожаловать',
      subtitle: 'Войдите через Google для продолжения',
      continue_google: 'Войти через Google',
      no_account: 'Нет аккаунта? Он создастся автоматически при входе.',

      error_auth: 'Ошибка при входе через Google. Попробуйте ещё раз.',
      error_params: 'Отсутствуют обязательные параметры. Попробуйте ещё раз.',
      error_security: 'Ошибка безопасности. Попробуйте ещё раз.',
      error_generic: 'Ошибка при авторизации. Попробуйте ещё раз.',
    },

    // ========== NAVBAR (Приложение) ==========
    navbar: {
      appName: 'Video Reader AI',
      credits_remaining: 'Осталось генераций',
      upgrade: 'Пополнить баланс',
      account_settings: 'Мой профиль',
      admin_settings: 'Администратор',
      logout: 'Выход',
    },
  },

  // ========== ENGLISH VERSIONS ==========
  en: {
    // ========== COMMON ==========
    common: {
      appName: 'Video Reader AI',
      logout: 'Logout',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      coming_soon: 'Coming Soon',
      copyright: '© 2025 Video Reader AI. All rights reserved.',
    },

    // ========== HEADER & NAVIGATION ==========
    header: {
      features: 'Features',
      how_it_works: 'How it works',
      testimonials: 'Testimonials',
      pricing: 'Pricing',
      login: 'Log in',
    },

    // ========== HERO SECTION ==========
    hero: {
      title: 'Understand YouTube in Any Language',
      subtitle: 'Instant AI-powered subtitle translation directly inside YouTube. No registration required.',
      cta_install: 'Add to Chrome — Free',
      cta_pricing: 'View Pricing',
      trusted: 'Trusted by users worldwide',
    },

    // ========== FEATURES ==========
    features: {
      title: 'A powerful AI assistant for understanding global content',
      subtitle: 'Video Reader AI helps you watch videos in any language with real-time subtitle translation.',

      feature_1: 'Instant subtitle translation',
      feature_1_desc: 'Get accurate subtitles in your preferred language the moment they appear.',

      feature_2: 'Learn while watching',
      feature_2_desc: 'Improve language skills naturally with context-rich translations.',

      feature_3: 'Export subtitles (Premium)',
      feature_3_desc: 'Download translated subtitles in SRT, VTT and TXT formats.',

      feature_4: 'Privacy-first design',
      feature_4_desc: 'Your viewing data never leaves your browser. No tracking, ever.',
    },

    // ========== STATS ==========
    stats: {
      title: 'AI-powered translation built for YouTube',
      subtitle: 'Video Reader AI is designed for viewers who want to access global content without language barriers. Whether you\'re learning a language or watching foreign creators, our AI gives you clear, context-aware subtitles.',

      stat_1: 'On-screen translation',
      stat_1_desc: 'Everything happens directly inside the YouTube player. No switching apps.',

      stat_2: 'Fast & accurate',
      stat_2_desc: 'Powered by advanced AI models optimized for real-time performance.',
    },

    // ========== TESTIMONIALS ==========
    testimonials: {
      title: 'What users say about Video Reader AI',

      testimonial_1: {
        name: 'Anna Petrova',
        role: 'Student',
        text: 'This extension helped me watch Japanese videos I could never understand before.',
      },

      testimonial_2: {
        name: 'Carlos Mendez',
        role: 'Developer',
        text: 'Perfect for watching international tech content. Translation quality is amazing.',
      },

      testimonial_3: {
        name: 'Emily Zhang',
        role: 'Content creator',
        text: 'Saves me hours. The Premium subtitle export is priceless.',
      },

      testimonial_4: {
        name: 'David Kim',
        role: 'Language learner',
        text: 'Game changer for learning Spanish through authentic content. Context is preserved perfectly.',
      },

      testimonial_5: {
        name: 'Sarah Johnson',
        role: 'Researcher',
        text: 'Essential for accessing international academic content. The accuracy is impressive.',
      },

      testimonial_6: {
        name: 'Michael Brown',
        role: 'Teacher',
        text: 'My students use this to access educational content from around the world. Simple and effective.',
      },
    },

    // ========== PRICING ==========
    pricing: {
      title: 'Simple and transparent pricing',

      plan_free: 'Free',
      plan_free_desc: 'Great way to try the tool',
      plan_free_features: [
        'Translate up to 30% of video text',
        'Basic quality',
        'No export',
      ],

      plan_pro: 'Pro',
      plan_pro_desc: 'Full subtitle translation with priority access',
      plan_pro_price: '$9/month',
      plan_pro_features: [
        'Translate 100% of subtitles',
        'Priority processing',
        'No export',
      ],

      plan_premium: 'Premium',
      plan_premium_desc: 'Full subtitle translation with export capabilities',
      plan_premium_price: '$19/month',
      plan_premium_features: [
        'Translate 100% of subtitles',
        'Priority processing',
        'Export subtitles to SRT',
      ],

      most_popular: 'Most Popular',
      get_started: 'Get Started',
    },

    // ========== CTA ==========
    cta: {
      title: 'Start using Video Reader AI today',
      subtitle: 'Join thousands of users watching YouTube without language barriers.',
    },

    // ========== FOOTER ==========
    footer: {
      features: 'Features',
      how_it_works: 'How it works',
      testimonials: 'Testimonials',
      pricing: 'Pricing',
      description: 'AI-powered YouTube subtitle translation for global content',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      need_help: 'Need help?',
      contact: 'Contact Us',
    },

    // ========== BLOG ==========
    blog: {
      title: 'Guides & Tutorials',
      subtitle: 'Learn how to get the most out of Video Reader AI.',

      article_1_title: 'How to translate YouTube subtitles in one click',
      article_1_desc: 'A quick guide to using Video Reader AI for beginners.',
      article_2_title: 'Top 5 ways to learn languages using YouTube',
      article_2_desc: 'How AI translation helps you absorb content faster.',
      article_3_title: 'How to export subtitles for study or work',
      article_3_desc: 'Use the Premium plan to extract subtitles in multiple formats.',
      read_more: 'Read more',
    },

    // ========== /APP PAGE ==========
    app: {
      upload_placeholder_title: 'Drag image here',
      upload_placeholder_text: 'or click to select',
      duration_6s: '6s',
      duration_10s: '10s',
      video_placeholder: 'Generate your video',
      video_loading: 'Generating your video...',
      prompt_placeholder: 'Describe your video...',
      generate_tooltip: 'Select an image and describe your video',
      download_button: 'Download',
      clear_button: 'Clear',
    },

    // ========== /BILLING PAGE ==========
    billing: {
      title: 'Upgrade Your Account',
      subtitle: 'Buy more credits to continue generating videos',

      pack_starter: 'Starter Pack',
      pack_starter_desc: 'Perfect for trying out',
      pack_starter_price: '$9',
      pack_starter_features: [
        '10 video credits',
        'Up to 60 seconds',
        'Standard quality',
      ],

      pack_pro: 'Pro Pack',
      pack_pro_desc: 'For serious creators',
      pack_pro_price: '$29',
      pack_pro_features: [
        '50 video credits',
        'Up to 120 seconds',
        'Premium quality',
        'Priority processing',
      ],

      most_popular: 'Most Popular',
      coming_soon: 'Coming Soon',
      payment_info: 'Payment processing coming soon. Enjoy 5 free credits!',
    },

    // ========== /ACCOUNT PAGE ==========
    account: {
      title: 'Account Settings',
      subtitle: 'Manage your account information',
      plan: 'Plan',
      credits: 'Credits',
      admin_section: 'Admin Settings',
      admin_access: 'You have admin access',
      admin_info: 'Admin features coming soon. You can manage user credits and plans through the database.',
    },

    // ========== /ADMIN PAGE ==========
    admin: {
      title: 'Admin Settings',
      subtitle: 'Manage system and user data',
      administrator: 'Administrator',

      user_management: '👥 User Management',
      user_management_desc: 'View and manage all users in the system',

      credits_management: '💰 Credits Management',
      credits_management_desc: 'Manage user credits and subscription plans',

      settings: '⚙️ System Settings',
      settings_desc: 'Configure global application settings',

      coming_soon: '🚀 Coming Soon',
      coming_soon_desc: 'Admin panel features are being developed. More management tools will be available soon.',
    },

    // ========== /SIGN-IN PAGE ==========
    signin: {
      title: 'Welcome back',
      subtitle: 'Sign in with your Google account to continue',
      continue_google: 'Continue with Google',
      no_account: 'Don\'t have an account? One will be created automatically when you sign in.',

      error_auth: 'Google authentication failed. Please try again.',
      error_params: 'Missing required parameters. Please try again.',
      error_security: 'Security check failed. Please try again.',
      error_generic: 'An error occurred. Please try again.',
    },

    // ========== NAVBAR ==========
    navbar: {
      appName: 'Video Reader AI',
      credits_remaining: 'Credits remaining',
      upgrade: 'Upgrade',
      account_settings: 'Account Settings',
      admin_settings: 'Admin Settings',
      logout: 'Logout',
    },
  },
};

// Экспортируем функцию для получения текстов на нужном языке
export function getI18n(language: 'ru' | 'en' = 'ru') {
  return i18n[language];
}

// Экспортируем для быстрого доступа к русским текстам
export const ru = i18n.ru;
export const en = i18n.en;
