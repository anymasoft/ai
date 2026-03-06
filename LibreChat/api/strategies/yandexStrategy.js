const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const axios = require('axios');
const socialLogin = require('./socialLogin');

/**
 * Извлечение данных профиля Yandex
 * @param {Object} profile - Профиль от Yandex API
 * @returns {Object} Нормализованные данные
 */
const getProfileDetails = ({ profile }) => {
  // Генерируем аватар URL если есть ID аватара
  const avatarUrl = profile.default_avatar_id
    ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
    : null;

  // Получаем email (приоритет: default_email -> первый из emails)
  const email = profile.default_email || profile.emails?.[0];

  // Генерируем имя пользователя
  const username = profile.login;
  const name = profile.display_name || profile.real_name || profile.login;

  return {
    email,
    id: profile.id,
    avatarUrl,
    username,
    name,
    emailVerified: true, // Yandex гарантирует верификацию
  };
};

/**
 * Yandex OAuth 2.0 Strategy
 *
 * Yandex использует стандартный OAuth 2.0 и дополнительный API для получения профиля
 */
class YandexStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    options.authorizationURL = 'https://oauth.yandex.ru/authorize';
    options.tokenURL = 'https://oauth.yandex.ru/token';
    super(options, verify);

    this.name = 'yandex';
    this._userProfileURL = 'https://login.yandex.ru/info';
    this._passReqToCallback = options.passReqToCallback;
  }

  /**
   * Получить профиль пользователя от Yandex API
   */
  async userProfile(accessToken) {
    try {
      const response = await axios.get(
        `${this._userProfileURL}?format=json`,
        {
          headers: {
            Authorization: `OAuth ${accessToken}`,
            'User-Agent': 'passport-yandex',
          },
        }
      );

      const profile = response.data;
      profile.provider = 'yandex';

      return profile;
    } catch (error) {
      console.error('Yandex profile fetch error:', error);
      throw error;
    }
  }

  /**
   * OAuth 2.0 callback
   * НЕ используем scope для Yandex OAuth (в отличие от Google/Facebook)
   */
  authenticate(req, options) {
    // Yandex OAuth не требует scope в запросе авторизации
    // Права доступа определяются при регистрации приложения
    super.authenticate(req, options);
  }
}

// Создать обработчик для socialLogin
const yandexLogin = socialLogin('yandex', getProfileDetails);

/**
 * Экспортировать конструктор стратегии
 */
module.exports = () => {
  // Callback URL может быть кастомным через YANDEX_URI или стандартным
  // Примеры:
  // - /oauth/yandex/callback (стандартный)
  // - /auth/yandex-callback (кастомный)
  let callbackURL;

  if (process.env.YANDEX_URI) {
    // Если YANDEX_URI установлена, использовать её как полный URL
    callbackURL = process.env.YANDEX_URI;
    console.log('[Yandex OAuth] Using custom YANDEX_URI:', callbackURL);
  } else {
    // Иначе использовать стандартный путь
    callbackURL = `${process.env.DOMAIN_SERVER}/oauth/yandex/callback`;
    console.log('[Yandex OAuth] Using default callback URL:', callbackURL);
  }

  return new YandexStrategy(
    {
      clientID: process.env.YANDEX_CLIENT_ID,
      clientSecret: process.env.YANDEX_CLIENT_SECRET,
      callbackURL,
    },
    yandexLogin
  );
};
