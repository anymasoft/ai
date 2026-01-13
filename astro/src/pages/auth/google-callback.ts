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

  console.log(`\n📨 OAuth Callback received:`);
  console.log(`   - error: ${error || 'none'}`);
  console.log(`   - code: ${code ? code.slice(0, 10) + '...' : 'missing'}`);
  console.log(`   - state: ${state ? state.slice(0, 8) + '...' : 'missing'}`);

  // Проверяем, есть ли ошибка от Google
  if (error) {
    console.error('❌ Google OAuth error:', error);
    return context.redirect('/sign-in?error=google_auth_failed');
  }

  // Проверяем code и state
  if (!code || !state) {
    console.error('❌ Missing code or state');
    return context.redirect('/sign-in?error=missing_params');
  }

  // Получаем saved state из cookies
  const savedState = context.cookies.get('oauth_state')?.value;
  console.log(`   - savedState from cookie: ${savedState ? savedState.slice(0, 8) + '...' : 'MISSING'}`);

  if (!savedState || savedState !== state) {
    console.error('❌ State mismatch!');
    console.error(`   Expected: ${savedState}`);
    console.error(`   Got: ${state}`);
    return context.redirect('/sign-in?error=state_mismatch');
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
      throw new Error('Failed to get tokens from Google');
    }

    const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

    // Получаем информацию о пользователе
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const googleUser = (await userInfoResponse.json()) as GoogleUserInfo;

    // Создаём или обновляем пользователя в нашей БД
    const user = upsertUser(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture);
    console.log(`👤 User created/updated: ${user.email} (id: ${user.id})`);

    // Создаём сессию
    const sessionToken = createSession(user.id);
    console.log(`🔐 Session created: ${sessionToken.slice(0, 16)}... (expires in 30 days)`);

    // Сохраняем токен сессии в cookies
    context.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 дней
    });
    console.log(`🍪 Session cookie set: session_token=${sessionToken.slice(0, 16)}...`);

    console.log(`✅ User logged in successfully: ${user.email}`);
    console.log(`🔄 Redirecting to /app...`);

    // Редиректим на /app с параметром auth=1 для отслеживания события
    return context.redirect('/app?auth=1');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return context.redirect('/sign-in?error=callback_failed');
  }
};
