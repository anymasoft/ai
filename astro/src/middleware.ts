import { defineMiddleware } from 'astro:middleware';
import { getUserFromSession, isAdmin } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  // Защищённые маршруты - требуют аутентификации
  const protectedRoutes = ['/app', '/account', '/admin'];

  // Маршруты, требующие прав админа
  const adminRoutes = ['/admin'];

  // Проверяем, является ли текущий маршрут защищённым
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

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

      // Проверяем права админа для админ-маршрутов
      if (isAdminRoute && !isAdmin(user.email)) {
        console.log(`   ❌ User is not admin`);
        console.log(`   - Redirecting to /app`);
        return context.redirect('/app');
      }
    } else {
      console.log(`   ❌ Session invalid or not found`);
      console.log(`   - Redirecting to /sign-in`);
      // Редиректим на страницу входа
      return context.redirect('/sign-in');
    }
  }

  return next();
});
