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

  console.log(`🔐 OAuth state generated: ${state.slice(0, 8)}...`);

  // Сохраняем state в cookies
  context.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 минут
  });

  console.log(`✅ OAuth state saved to cookie (maxAge: 600s)`);

  // Параметры для Google OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state: state,
    prompt: 'consent', // Всегда показываем экран согласия
  });

  return context.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};
