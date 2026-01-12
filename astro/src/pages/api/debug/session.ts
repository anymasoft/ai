import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';

export const GET: APIRoute = async (context) => {
  const sessionToken = context.cookies.get('session_token')?.value;

  const response: any = {
    sessionTokenInCookie: sessionToken ? sessionToken.slice(0, 16) + '...' : 'MISSING',
    timestamp: new Date().toISOString(),
    now: Math.floor(Date.now() / 1000),
  };

  if (!sessionToken) {
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Проверяем сессию в БД
    const session = db
      .prepare('SELECT * FROM sessions WHERE token = ?')
      .get(sessionToken) as any;

    response.sessionInDb = session ? {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      expiresAtDate: new Date(session.expiresAt * 1000).toISOString(),
      isExpired: session.expiresAt < now,
    } : 'NOT FOUND';

    if (session) {
      // Проверяем пользователя в БД
      const user = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(session.userId) as any;

      response.userInDb = user ? {
        id: user.id,
        email: user.email,
        name: user.name,
      } : 'NOT FOUND';

      // Список всех сессий для этого пользователя
      const allSessions = db
        .prepare('SELECT id, token, expiresAt FROM sessions WHERE userId = ?')
        .all(session.userId) as any[];

      response.allSessionsForUser = allSessions.map(s => ({
        id: s.id,
        token: s.token.slice(0, 16) + '...',
        expiresAt: s.expiresAt,
        isExpired: s.expiresAt < now,
      }));

      // Список всех пользователей
      const allUsers = db.prepare('SELECT id, email FROM users').all() as any[];
      response.totalUsers = allUsers.length;
      response.sampleUsers = allUsers.slice(0, 3).map(u => ({ id: u.id, email: u.email }));
    }
  } catch (error) {
    response.error = error instanceof Error ? error.message : String(error);
  }

  return new Response(JSON.stringify(response, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};
