import { defineMiddleware } from 'astro:middleware';
import { getUserFromSession } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  // Защищённые маршруты - требуют аутентификации
  const protectedRoutes = ['/app', '/account'];

  // Проверяем, является ли текущий маршрут защищённым
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (isProtected) {
    // Получаем токен сессии из cookies
    const cookies = context.cookies;
    const sessionToken = cookies.get('session_token')?.value;

    console.log(`\n🔒 Auth Middleware for: ${pathname}`);
    console.log(`   - sessionToken: ${sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING'}`);

    // Проверяем, существует ли сессия
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (user) {
      console.log(`   ✅ Session valid for user: ${user.email}`);
    } else {
      console.log(`   ❌ Session invalid or not found`);
      console.log(`   - Redirecting to /sign-in`);
      // Редиректим на страницу входа
      return context.redirect('/sign-in');
    }
  }

  return next();
});
