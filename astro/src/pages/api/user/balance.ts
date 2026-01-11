import { getUserFromSession } from '../../../lib/auth';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  // Получаем сессию пользователя из cookies
  const sessionToken = context.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const user = getUserFromSession(sessionToken);

    if (!user) {
      console.warn('[BALANCE] Invalid session token');
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BALANCE] GET balance for user ${user.id}: balance=${user.generation_balance}, used=${user.generation_used}`);

    return new Response(
      JSON.stringify({
        success: true,
        generation_balance: user.generation_balance,
        generation_used: user.generation_used,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[BALANCE] Error fetching user balance:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
