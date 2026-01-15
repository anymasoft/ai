import type { APIRoute } from 'astro';
import { upsertUser, createSession } from '../../lib/auth';

interface YandexTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface YandexUserInfo {
  id: string;
  login?: string;
  display_name?: string;
  real_name?: string;
  emails?: string[];
  default_email?: string;
  avatar_id?: string;
}

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get('code');
  const state = context.url.searchParams.get('state');
  const error = context.url.searchParams.get('error');

  console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START`);
  console.log(`   - provider: yandex`);
  console.log(`   - error: ${error || 'none'}`);
  console.log(`   - code: ${code ? code.slice(0, 10) + '...' : 'missing'}`);
  console.log(`   - state: ${state ? state.slice(0, 8) + '...' : 'missing'}`);

  // Проверяем, есть ли ошибка от Yandex
  if (error) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: yandex`);
    console.error(`   - reason: ${error}`);
    return context.redirect(`/sign-in?error=yandex_auth_failed&provider=yandex`);
  }

  // Проверяем code и state
  if (!code || !state) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: yandex`);
    console.error(`   - reason: missing_params`);
    return context.redirect('/sign-in?error=missing_params&provider=yandex');
  }

  // Получаем saved state из cookies
  const savedState = context.cookies.get('oauth_state_yandex')?.value;
  console.log(`   - savedState from cookie: ${savedState ? savedState.slice(0, 8) + '...' : 'MISSING'}`);

  if (!savedState || savedState !== state) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: yandex`);
    console.error(`   - reason: state_mismatch`);
    return context.redirect('/sign-in?error=state_mismatch&provider=yandex');
  }

  console.log(`✅ State verified successfully`);

  // Очищаем state cookie
  context.cookies.delete('oauth_state_yandex');

  try {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const clientSecret = process.env.YANDEX_CLIENT_SECRET;
    const redirectUri = `${new URL(context.url.toString()).origin}/auth/yandex-callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Yandex OAuth credentials');
    }

    console.log(`📡 Exchanging code for tokens...`);

    // Обмениваем код на токены
    const tokenResponse = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      throw new Error(`Failed to get tokens from Yandex: ${tokenResponse.status} ${errorData}`);
    }

    const tokens = (await tokenResponse.json()) as YandexTokenResponse;
    console.log(`✅ Tokens received`);

    console.log(`👤 Fetching user info from Yandex...`);

    // Получаем информацию о пользователе
    const userInfoResponse = await fetch('https://login.yandex.ru/info', {
      headers: {
        Authorization: `OAuth ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      throw new Error(`Failed to get user info from Yandex: ${userInfoResponse.status} ${errorData}`);
    }

    const yandexUser = (await userInfoResponse.json()) as YandexUserInfo;
    console.log(`✅ User info received`);

    // Выбираем email - приоритет: default_email > первый из массива emails
    const userEmail = yandexUser.default_email || yandexUser.emails?.[0] || `yandex_${yandexUser.id}@beem.local`;
    const userName = yandexUser.display_name || yandexUser.real_name || yandexUser.login || 'Yandex User';

    console.log(`📊 AUTH_CHECKPOINT: USER_CREATED`);
    console.log(`   - provider: yandex`);
    console.log(`   - email: ${userEmail}`);
    console.log(`   - name: ${userName}`);
    console.log(`   - yandexId: ${yandexUser.id}`);

    try {
      // Создаём или обновляем пользователя в нашей БД
      // Используем yandexId как уникальный идентификатор: "yandex_{id}"
      const userId = `yandex_${yandexUser.id}`;
      const user = upsertUser(userId, userEmail, userName, undefined);
      console.log(`✅ User upserted: ${user.email} (id: ${user.id})`);

      // Создаём сессию
      const sessionToken = createSession(user.id);
      console.log(`📊 AUTH_CHECKPOINT: SESSION_CREATED`);
      console.log(`   - provider: yandex`);
      console.log(`   - sessionToken: ${sessionToken.slice(0, 16)}...`);

      // Сохраняем токен сессии в cookies
      context.cookies.set('session_token', sessionToken, {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 дней
      });
      console.log(`🍪 Session cookie set`);

      console.log(`✅ User logged in successfully via Yandex: ${user.email}`);
      console.log(`🔄 Redirecting to /app...`);

      // Редиректим на /app с параметром auth=1 для отслеживания события
      return context.redirect('/app?auth=1&provider=yandex');
    } catch (dbError) {
      console.error(`❌ AUTH_FAILED`);
      console.error(`   - provider: yandex`);
      console.error(`   - stage: user_creation`);
      console.error(`   - reason: ${dbError instanceof Error ? dbError.message : String(dbError)}`);

      if (dbError instanceof Error && dbError.message.includes('UNIQUE')) {
        return context.redirect('/sign-in?error=user_already_exists&provider=yandex');
      }

      throw dbError;
    }
  } catch (error) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: yandex`);
    console.error(`   - error: ${error instanceof Error ? error.message : String(error)}`);

    return context.redirect('/sign-in?error=callback_failed&provider=yandex');
  }
};
