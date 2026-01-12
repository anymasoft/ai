import { defineMiddleware } from 'astro:middleware';
import { getUserFromSession, isAdmin } from './lib/auth';
import { logger } from './lib/logger';

const COOKIE_NAME = 'session_token';
const COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'lax' as const,
  secure: import.meta.env.PROD,
  httpOnly: true,
};

export const onRequest = defineMiddleware((context, next) => {
  const pathname = context.url.pathname;

  // ✅ MiniMax webhook - публичный endpoint, БЕЗ авторизации
  // Позволяем MiniMax доставлять POST запросы для verification и результатов
  if (pathname === '/minimax_callback' || pathname.startsWith('/minimax_callback/')) {
    logger.log('[MIDDLEWARE] MiniMax webhook /minimax_callback → allow без авторизации');
    return next();
  }

  // Получаем токен сессии из cookies
  const sessionToken = context.cookies.get(COOKIE_NAME)?.value;
  let user = sessionToken ? getUserFromSession(sessionToken) : null;

  // ИСПРАВЛЕНИЕ: Если cookie существует, но сессии нет в БД → удалить cookie
  if (sessionToken && !user) {
    // Проверяем флаг что мы уже очищали в этом request
    if (!context.locals.sessionInvalidated) {
      logger.log(`\n⚠️ MIDDLEWARE: Cookie существует, но сессия не найдена в БД`);
      logger.log(`   - Удаляем "залипшую" cookie`);

      // Правильное удаление cookie с ТЕМИ ЖЕ параметрами
      context.cookies.set(COOKIE_NAME, '', {
        ...COOKIE_OPTIONS,
        maxAge: 0,
      });

      // Отмечаем что очистили
      context.locals.sessionInvalidated = true;
      logger.log(`   ✅ Cookie очищена (maxAge=0)`);
    }
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
      logger.log(`\n🔄 MIDDLEWARE: Авторизованный пользователь на "/"`);
      logger.log(`   - Редирект на /app`);
      return context.redirect('/app');
    }
    // Если неавторизован - показываем главную страницу
    return next();
  }

  // Защищённые маршруты - требуют аутентификации
  if (isProtected) {
    logger.log(`\n🔒 MIDDLEWARE: Проверка доступа к ${pathname}`);
    logger.log(`   - sessionToken: ${sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING'}`);

    if (user) {
      logger.log(`   ✅ Сессия валидна: ${user.email}`);

      // Проверяем права админа для админ-маршрутов
      if (isAdminRoute && !isAdmin(user.email)) {
        logger.log(`   ❌ Нет прав админа`);
        logger.log(`   - Возвращаем 404`);
        return new Response('Not Found', { status: 404 });
      }
    } else {
      logger.log(`   ❌ Сессия невалидна или не найдена`);
      logger.log(`   - Редирект на /`);
      // Редиректим на главную страницу
      return context.redirect('/');
    }
  }

  return next();
});
