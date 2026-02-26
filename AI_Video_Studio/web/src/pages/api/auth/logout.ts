import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth';

const COOKIE_NAME = 'session_token';
const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: import.meta.env.PROD,
  httpOnly: true,
};

const logoutHandler: APIRoute = async (context) => {
  try {
    // Получаем токен из cookies
    const sessionToken = context.cookies.get(COOKIE_NAME)?.value;

    console.log(`\n🚪 LOGOUT: Пользователь выходит`);
    console.log(`   - sessionToken: ${sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING'}`);

    if (sessionToken) {
      try {
        // Удаляем сессию из БД
        deleteSession(sessionToken);
        console.log(`   ✅ Сессия удалена из БД`);
      } catch (error) {
        console.error(`   ⚠️ Ошибка удаления сессии:`, error);
      }
    }

    // Правильное удаление cookie с ТЕМИ ЖЕ параметрами
    context.cookies.set(COOKIE_NAME, '', {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
    console.log(`   ✅ Cookie удалена (maxAge=0)`);

    // Редиректим на главную
    console.log(`   - Редирект на /`);
    return context.redirect('/');
  } catch (error) {
    console.error(`\n❌ LOGOUT ERROR:`, error);
    return new Response(JSON.stringify({ error: 'Logout failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Поддерживаем оба метода GET и POST
export const GET = logoutHandler;
export const POST = logoutHandler;
