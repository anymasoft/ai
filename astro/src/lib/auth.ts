import { getDb } from './db';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
  generation_balance: number;
  generation_used: number;
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
  const now = Math.floor(Date.now() / 1000);

  console.log(`   🔍 Querying session in DB for token: ${token.slice(0, 16)}...`);

  // Сначала проверим все сессии для этого токена БЕЗ проверки expiry
  const sessionAny = db
    .prepare('SELECT userId, token, expiresAt FROM sessions WHERE token = ?')
    .get(token) as any;

  if (!sessionAny) {
    console.log(`   ❌ Session token not found in DB at all`);
    console.log(`   ⏰ Current timestamp: ${now}`);
    return null;
  }

  console.log(`   ✅ Session found in DB`);
  console.log(`   ⏰ expiresAt: ${sessionAny.expiresAt}, now: ${now}, expired: ${sessionAny.expiresAt <= now}`);

  if (sessionAny.expiresAt <= now) {
    console.log(`   ❌ Session expired`);
    return null;
  }

  const session = sessionAny as Session;
  console.log(`   ✅ Session valid, userId: ${session.userId}`);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as User | undefined;

  if (!user) {
    console.log(`   ❌ User not found for userId: ${session.userId}`);
    // Let's check what users exist
    const allUsers = db.prepare('SELECT id, email FROM users').all() as any[];
    console.log(`   📊 Total users in DB: ${allUsers.length}`);
    if (allUsers.length > 0) {
      console.log(`   📊 Sample users: ${allUsers.slice(0, 2).map(u => u.email).join(', ')}`);
    }
    return null;
  }

  console.log(`   ✅ User found: ${user.email}`);
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
    console.log(`👤 User already exists: ${email} (id: ${googleId}), updating name/image`);
    db.prepare('UPDATE users SET name = ?, image = ?, updatedAt = ? WHERE id = ?').run(
      name,
      image,
      now,
      googleId
    );
    return db.prepare('SELECT * FROM users WHERE id = ?').get(googleId) as User;
  }

  // Создаём нового пользователя с 3 бонусными кредитами
  console.log(`✨ Creating new user: ${email} (id: ${googleId}) with 3 bonus credits`);
  db.prepare(
    'INSERT INTO users (id, email, name, image, generation_balance, generation_used, plan, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(googleId, email, name, image, 3, 0, 'free', 'user', now, now);

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
 * Обновляет generation_balance пользователя
 */
export function updateUserBalance(userId: string, newBalance: number): void {
  const db = getDb();
  db.prepare('UPDATE users SET generation_balance = ?, updatedAt = ? WHERE id = ?').run(
    newBalance,
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
