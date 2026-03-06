const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { isEnabled } = require('@librechat/api');
const { getUserById, findUser, createUser } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');

const domains = {
  client: process.env.DOMAIN_CLIENT,
  server: process.env.DOMAIN_SERVER,
};

/**
 * ШАГ 1: Инициация Yandex OAuth redirect
 * GET /oauth/yandex
 *
 * Генерируем state для CSRF защиты,
 * сохраняем в httpOnly cookie,
 * редиректим на Yandex OAuth
 */
const yandexOAuthRedirect = async (req, res) => {
  try {
    const yandexClientId = process.env.YANDEX_CLIENT_ID;
    const redirectUri = process.env.YANDEX_URI || `${domains.server}/oauth/yandex/callback`;

    if (!yandexClientId) {
      logger.error('❌ YANDEX_CLIENT_ID is not configured');
      return res.status(500).json({ message: 'OAuth configuration error' });
    }

    // Генерируем криптографически стойкий state
    const state = crypto.randomBytes(32).toString('hex');

    console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_REDIRECT`);
    console.log(`   - provider: yandex`);
    console.log(`   - state: ${state.slice(0, 8)}...`);
    console.log(`   - redirectUri: ${redirectUri}`);

    // Сохраняем state в httpOnly cookie на 10 минут
    console.log(`\n🍪 SETTING STATE COOKIE:`);
    console.log(`   - name: oauth_state_yandex`);
    console.log(`   - value: ${state.slice(0, 8)}...`);
    console.log(`   - httpOnly: true`);
    console.log(`   - secure: ${process.env.NODE_ENV === 'production'}`);
    console.log(`   - sameSite: lax`);
    console.log(`   - path: /`);
    console.log(`   - maxAge: 600000 (10 min)`);

    res.cookie('oauth_state_yandex', state, {
      httpOnly: true,
      secure: false, // Для тестирования localhost
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000, // 10 минут
    });

    console.log(`✅ Yandex OAuth state saved to cookie`);

    // Параметры для Yandex OAuth authorize endpoint
    const params = new URLSearchParams({
      client_id: yandexClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state: state,
    });

    const yandexAuthUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`;
    console.log(`🔄 Redirecting to Yandex OAuth: ${yandexAuthUrl.slice(0, 80)}...`);

    return res.redirect(yandexAuthUrl);
  } catch (error) {
    logger.error('Error in yandex OAuth redirect:', error);
    return res.status(500).json({ message: 'OAuth initialization failed' });
  }
};

/**
 * ШАГ 2: Обработка Yandex OAuth callback
 * GET /oauth/yandex/callback?code=...&state=...
 */
const yandexOAuthCallback = async (req, res) => {
  try {
    // Отладка: проверяем что получили на callback
    console.log(`\n🔍 DEBUG: CALLBACK HEADERS & COOKIES`);
    console.log(`   - req.headers.cookie: ${req.headers.cookie || '❌ EMPTY'}`);
    console.log(`   - req.cookies keys: ${Object.keys(req.cookies).join(', ') || '❌ EMPTY'}`);
    console.log(`   - req.cookies.oauth_state_yandex: ${req.cookies.oauth_state_yandex ? req.cookies.oauth_state_yandex.slice(0, 8) + '...' : '❌ NOT FOUND'}`);

    const code = req.query.code;
    const state = req.query.state;
    const error = req.query.error;

    console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START`);
    console.log(`   - provider: yandex`);
    console.log(`   - error: ${error || 'none'}`);
    console.log(`   - code: ${code ? code.slice(0, 10) + '...' : 'missing'}`);
    console.log(`   - state: ${state ? state.slice(0, 8) + '...' : 'missing'}`);

    // Шаг 1: Проверяем ошибки от Yandex
    if (error) {
      console.error(`❌ AUTH_FAILED (Yandex error): ${error}`);
      return res.redirect(`${domains.client}/sign-in?error=yandex_auth_failed&provider=yandex`);
    }

    // Шаг 2: Проверяем наличие code и state
    if (!code || !state) {
      console.error(`❌ AUTH_FAILED - missing params`);
      return res.redirect(`${domains.client}/sign-in?error=missing_params&provider=yandex`);
    }

    // Шаг 3: Получаем сохранённый state из cookie и проверяем совпадение
    const savedState = req.cookies.oauth_state_yandex;
    console.log(`   - savedState from cookie: ${savedState ? savedState.slice(0, 8) + '...' : '❌ MISSING'}`);

    if (!savedState || savedState !== state) {
      console.error(`❌ AUTH_FAILED - state mismatch`);
      return res.redirect(`${domains.client}/sign-in?error=state_mismatch&provider=yandex`);
    }

    console.log(`✅ State verified successfully`);

    // Очищаем state cookie - больше не нужна
    res.clearCookie('oauth_state_yandex');

    // Шаг 4: Обмениваем code на access_token
    const yandexClientId = process.env.YANDEX_CLIENT_ID;
    const yandexClientSecret = process.env.YANDEX_CLIENT_SECRET;
    const redirectUri = process.env.YANDEX_URI || `${domains.server}/oauth/yandex/callback`;

    if (!yandexClientId || !yandexClientSecret) {
      logger.error('❌ Missing Yandex OAuth credentials');
      return res.redirect(`${domains.client}/sign-in?error=oauth_config_error&provider=yandex`);
    }

    console.log(`📡 Exchanging code for tokens...`);

    const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: yandexClientId,
        client_secret: yandexClientSecret,
        code: code,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      logger.error(`Failed to get tokens from Yandex: ${tokenResponse.status} ${errorData}`);
      return res.redirect(`${domains.client}/sign-in?error=token_exchange_failed&provider=yandex`);
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    console.log(`✅ Tokens received`);

    // Шаг 5: Получаем профиль пользователя
    console.log(`👤 Fetching user info from Yandex...`);

    const userInfoResponse = await fetch('https://login.yandex.ru/info', {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      logger.error(`Failed to get user info from Yandex: ${userInfoResponse.status} ${errorData}`);
      return res.redirect(`${domains.client}/sign-in?error=profile_fetch_failed&provider=yandex`);
    }

    const yandexUser = await userInfoResponse.json();
    console.log(`✅ User info received`);

    // Выбираем email - приоритет: default_email > первый из массива emails
    const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@librechat.local`;
    const userName = yandexUser.display_name || yandexUser.real_name || yandexUser.login || 'Yandex User';

    console.log(`📊 AUTH_CHECKPOINT: USER_CREATED`);
    console.log(`   - provider: yandex`);
    console.log(`   - email: ${userEmail}`);
    console.log(`   - name: ${userName}`);
    console.log(`   - yandexId: ${yandexUser.id}`);

    // Шаг 6: Создаём или находим пользователя по email
    try {
      // Ищем пользователя по email (стандартный способ LibreChat)
      let user = await findUser({ email: userEmail });

      if (!user) {
        // Проверяем разрешена ли социальная регистрация
        const allowSocialRegistration = isEnabled(process.env.ALLOW_SOCIAL_REGISTRATION);
        if (!allowSocialRegistration) {
          logger.error(`Social registration is disabled`);
          return res.redirect(`${domains.client}/sign-in?error=registration_disabled&provider=yandex`);
        }

        // Создаём нового пользователя со всеми необходимыми полями
        // username: используем login из профиля Yandex или часть email
        const username = yandexUser.login || userEmail.split('@')[0];

        user = await createUser({
          email: userEmail,
          username: username,
          name: userName,
        });

        console.log(`✅ New user created: ${user.email} (id: ${user._id})`);
      } else {
        console.log(`✅ Existing user found: ${user.email}`);
      }

      // Шаг 7: Устанавливаем auth tokens через AuthService (стандартный LibreChat способ)
      console.log(`📊 AUTH_CHECKPOINT: SESSION_CREATED`);
      console.log(`   - provider: yandex`);
      console.log(`   - userId: ${user._id}`);
      console.log(`   - email: ${user.email}`);
      console.log(`   - username: ${user.username}`);

      await setAuthTokens(user._id, res);
      console.log(`🍪 Auth tokens set`);

      console.log(`✅ User logged in successfully via Yandex: ${user.email}`);
      console.log(`🔄 Redirecting to ${domains.client}`);

      // Редиректим на клиент (стандартный способ как в oauth.js)
      // Frontend сам обработает редирект на чат
      return res.redirect(domains.client);
    } catch (dbError) {
      logger.error(`Failed to create/update user:`, dbError);
      return res.redirect(`${domains.client}/sign-in?error=user_creation_failed&provider=yandex`);
    }
  } catch (error) {
    logger.error('Error in yandex OAuth callback:', error);
    return res.redirect(`${domains.client}/sign-in?error=callback_failed&provider=yandex`);
  }
};

module.exports = {
  yandexOAuthRedirect,
  yandexOAuthCallback,
};
