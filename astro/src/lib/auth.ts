import { getDb } from './db';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  credits: number;
  plan: 'free' | 'pro' | 'enterprise';
  role: 'user' | 'admin';
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Получает юзера из сессии по токену
 */
export function getUserFromSession(token: string): User | null {
  const db = getDb();

  const session = db
    .prepare('SELECT userId FROM sessions WHERE token = ? AND expiresAt > ?')
    .get(token, Math.floor(Date.now() / 1000)) as Session | undefined;

  if (!session) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as User | undefined;

  if (!user) return null;

  return user;
}

/**
 * Создаёт новую сессию для пользователя
 */
export function createSession(userId: string): string {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 дней
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    'INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, token, expiresAt, now);

  return token;
}

/**
 * Удаляет сессию
 */
export function deleteSession(token: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/**
 * Создаёт или обновляет пользователя
 */
export function upsertUser(googleId: string, email: string, name: string, image?: string): User {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  // Проверяем, существует ли пользователь
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User | undefined;

  if (existing) {
    // Обновляем
    db.prepare('UPDATE users SET name = ?, image = ?, updatedAt = ? WHERE id = ?').run(
      name,
      image,
      now,
      googleId
    );
    return db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User;
  }

  // Создаём нового пользователя с 3 кредитами по умолчанию (тестовые)
  db.prepare(
    'INSERT INTO users (id, email, name, image, credits, plan, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(googleId, email, name, image, 3, 'free', 'user', now, now);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User;
}

/**
 * Получает пользователя по ID
 */
export function getUserById(userId: string): User | null {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  return user || null;
}

/**
 * Обновляет количество кредитов пользователя
 */
export function updateUserCredits(userId: string, newCredits: number): void {
  const db = getDb();
  db.prepare('UPDATE users SET credits = ?, updatedAt = ? WHERE id = ?').run(
    newCredits,
    Math.floor(Date.now() / 1000),
    userId
  );
}

/**
 * Проверяет, является ли пользователь админом
 */
export function isAdmin(email: string): boolean {
  return email === 'nazarov.soft@gmail.com';
}
