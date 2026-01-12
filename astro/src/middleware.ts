import { defineMiddleware } from 'astro:middleware';
import { getUserFromSession, isAdmin } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  // ✅ MiniMax webhook - публичный endpoint, БЕЗ авторизации
  // Позволяем MiniMax доставлять POST запросы для verification и результатов
  if (pathname === '/minimax_callback' || pathname.startsWith('/minimax_callback/')) {
    console.log('[MIDDLEWARE] MiniMax webhook /minimax_callback → allow без авторизации');
    return next();
  }

  // Получаем токен сессии из cookies
  const sessionToken = context.cookies.get('session_token')?.value;
  let user = sessionToken ? getUserFromSession(sessionToken) : null;

  // ИСПРАВЛЕНИЕ: Если cookie существует, но сессии нет в БД → удалить cookie
  if (sessionToken && !user) {
    console.log(`\n⚠️ MIDDLEWARE: Cookie существует, но сессия не найдена в БД`);
    console.log(`   - Удаляем "залипшую" cookie`);
    context.cookies.delete('session_token');
    user = null;
  }

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
      console.log(`\n🔄 MIDDLEWARE: Авторизованный пользователь на "/"`);
      console.log(`   - Редирект на /app`);
      return context.redirect('/app');
    }
    // Если неавторизован - показываем главную страницу
    return next();
  }

  // Защищённые маршруты - требуют аутентификации
  if (isProtected) {
    console.log(`\n🔒 MIDDLEWARE: Проверка доступа к ${pathname}`);
    console.log(`   - sessionToken: ${sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING'}`);

    if (user) {
      console.log(`   ✅ Сессия валидна: ${user.email}`);

      // Проверяем права админа для админ-маршрутов
      if (isAdminRoute && !isAdmin(user.email)) {
        console.log(`   ❌ Нет прав админа`);
        console.log(`   - Возвращаем 404`);
        return new Response('Not Found', { status: 404 });
      }
    } else {
      console.log(`   ❌ Сессия невалидна или не найдена`);
      console.log(`   - Редирект на /`);
      // Редиректим на главную страницу
      return context.redirect('/');
    }
  }

  return next();
});
