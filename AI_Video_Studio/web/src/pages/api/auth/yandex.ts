import type { APIRoute } from 'astro';
import crypto from 'crypto';

export const GET: APIRoute = async (context) => {
  const clientId = process.env.YANDEX_CLIENT_ID;
  const redirectUri = `${new URL(context.url.toString()).origin}/auth/yandex-callback`;

  if (!clientId) {
    console.error('❌ YANDEX_CLIENT_ID is not set');
    return new Response('YANDEX_CLIENT_ID is not set', { status: 500 });
  }

  // Генерируем state для защиты от CSRF атак
  const state = crypto.randomBytes(32).toString('hex');

  console.log(`\n📊 AUTH_CHECKPOINT: OAUTH_REDIRECT`);
  console.log(`   - provider: yandex`);
  console.log(`   - state: ${state.slice(0, 8)}...`);
  console.log(`   - redirectUri: ${redirectUri}`);

  // Сохраняем state в cookies
  context.cookies.set('oauth_state_yandex', state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 минут
  });

  console.log(`✅ Yandex OAuth state saved to cookie`);

  // Параметры для Yandex OAuth
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state,
  });

  const yandexAuthUrl = `https://oauth.yandex.ru/authorize?${params.toString()}`;
  console.log(`🔄 Redirecting to Yandex OAuth: ${yandexAuthUrl.slice(0, 80)}...`);

  return context.redirect(yandexAuthUrl);
};
