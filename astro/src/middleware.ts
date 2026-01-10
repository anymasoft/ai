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

    // Проверяем, существует ли сессия
    if (!sessionToken || !getUserFromSession(sessionToken)) {
      // Редиректим на страницу входа
      return context.redirect('/sign-in');
    }
  }

  return next();
});
