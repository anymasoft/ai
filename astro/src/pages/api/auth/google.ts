import type { APIRoute } from 'astro';
import crypto from 'crypto';

export const GET: APIRoute = async (context) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${new URL(context.url.toString()).origin}/auth/google-callback`;

  if (!clientId) {
    return new Response('GOOGLE_CLIENT_ID is not set', { status: 500 });
  }

  // Генерируем state для защиты от CSRF атак
  const state = crypto.randomBytes(32).toString('hex');

  console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_REDIRECT`);
  console.log(`   - provider: google`);
  console.log(`   - state: ${state.slice(0, 8)}...`);
  console.log(`   - redirectUri: ${redirectUri}`);

  // Сохраняем state в cookies
  context.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 минут
  });

  console.log(`✅ Google OAuth state saved to cookie`);

  // Параметры для Google OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
    prompt: 'consent', // Всегда показываем экран согласия
  });

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log(`🔄 Redirecting to Google OAuth: ${googleAuthUrl.slice(0, 80)}...`);

  return context.redirect(googleAuthUrl);
};
