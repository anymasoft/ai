import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  try {
    // Получаем токен из cookies
    const sessionToken = context.cookies.get('session_token')?.value;

    if (sessionToken) {
      // Удаляем сессию из БД
      deleteSession(sessionToken);
    }

    // Удаляем cookie
    context.cookies.delete('session_token');

    console.log('✅ User logged out');

    // Редиректим на главную
    return context.redirect('/');
  } catch (error) {
    console.error('Logout error:', error);
    return new Response('Logout failed', { status: 500 });
  }
};
