import type { APIRoute } from 'astro';
import { upsertUser, createSession } from '../../lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export const GET: APIRoute = async (context) => {
  const code = context.url.searchParams.get('code');
  const state = context.url.searchParams.get('state');
  const error = context.url.searchParams.get('error');

  console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_CALLBACK_START`);
  console.log(`   - provider: google`);
  console.log(`   - error: ${error || 'none'}`);
  console.log(`   - code: ${code ? code.slice(0, 10) + '...' : 'missing'}`);
  console.log(`   - state: ${state ? state.slice(0, 8) + '...' : 'missing'}`);

  // Проверяем, есть ли ошибка от Google
  if (error) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: google`);
    console.error(`   - reason: ${error}`);
    return context.redirect('/sign-in?error=google_auth_failed&provider=google');
  }

  // Проверяем code и state
  if (!code || !state) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: google`);
    console.error(`   - reason: missing_params`);
    return context.redirect('/sign-in?error=missing_params&provider=google');
  }

  // Получаем saved state из cookies
  const savedState = context.cookies.get('oauth_state')?.value;
  console.log(`   - savedState from cookie: ${savedState ? savedState.slice(0, 8) + '...' : 'MISSING'}`);

  if (!savedState || savedState !== state) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: google`);
    console.error(`   - reason: state_mismatch`);
    return context.redirect('/sign-in?error=state_mismatch&provider=google');
  }

  console.log(`✅ State verified successfully`);

  // Очищаем state cookie
  context.cookies.delete('oauth_state');

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${new URL(context.url.toString()).origin}/auth/google-callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials');
    }

    console.log(`📡 Exchanging code for tokens...`);

    // Обмениваем код на токены
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get tokens from Google: ${tokenResponse.status}`);
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
    console.log(`✅ Tokens received`);

    console.log(`👤 Fetching user info from Google...`);

    // Получаем информацию о пользователе
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error(`Failed to get user info from Google: ${userInfoResponse.status}`);
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;
    console.log(`✅ User info received`);

    console.log(`📊 AUTH_CHECKPOINT: USER_CREATED`);
    console.log(`   - provider: google`);
    console.log(`   - email: ${googleUser.email}`);
    console.log(`   - name: ${googleUser.name}`);
    console.log(`   - googleId: ${googleUser.sub}`);

    try {
      // Создаём или обновляем пользователя в нашей БД
      const user = upsertUser(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture);
      console.log(`✅ User upserted: ${user.email} (id: ${user.id})`);

      // Создаём сессию
      const sessionToken = createSession(user.id);
      console.log(`📊 AUTH_CHECKPOINT: SESSION_CREATED`);
      console.log(`   - provider: google`);
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

      console.log(`✅ User logged in successfully via Google: ${user.email}`);
      console.log(`🔄 Redirecting to /app...`);

      // Редиректим на /app с параметром auth=1 для отслеживания события
      return context.redirect('/app?auth=1&provider=google');
    } catch (dbError) {
      console.error(`❌ AUTH_FAILED`);
      console.error(`   - provider: google`);
      console.error(`   - stage: user_creation`);
      console.error(`   - reason: ${dbError instanceof Error ? dbError.message : String(dbError)}`);

      if (dbError instanceof Error && dbError.message.includes('UNIQUE')) {
        return context.redirect('/sign-in?error=user_already_exists&provider=google');
      }

      throw dbError;
    }
  } catch (error) {
    console.error(`❌ AUTH_FAILED`);
    console.error(`   - provider: google`);
    console.error(`   - error: ${error instanceof Error ? error.message : String(error)}`);

    return context.redirect('/sign-in?error=callback_failed&provider=google');
  }
};
