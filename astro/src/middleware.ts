import { defineMiddleware } from 'astro:middleware';
import { getUserFromSession, isAdmin } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  // Получаем токен сессии из cookies
  const sessionToken = context.cookies.get('session_token')?.value;
  const user = sessionToken ? getUserFromSession(sessionToken) : null;

  // Защищённые маршруты - требуют аутентификации
  const protectedRoutes = ['/app', '/account', '/billing', '/admin'];
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  // Маршруты, требующие прав админа
  const adminRoutes = ['/admin'];
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // Главная страница "/" - только для неавторизованных
  if (pathname === '/') {
    if (user) {
      // Если авторизован - редирект на /app
      console.log(`\n🔄 Auth Middleware: Authorized user accessing "/"`);
      console.log(`   - Redirecting to /app`);
      return context.redirect('/app');
    }
    // Если неавторизован - показываем главную страницу
    return next();
  }

  // Защищённые маршруты - требуют аутентификации
  if (isProtected) {
    console.log(`\n🔒 Auth Middleware for: ${pathname}`);
    console.log(`   - sessionToken: ${sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING'}`);

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
      console.log(`   - Redirecting to /`);
      // Редиректим на главную страницу
      return context.redirect('/');
    }
  }

  return next();
});
