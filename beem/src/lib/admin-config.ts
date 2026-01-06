/**
 * Admin Panel Configuration
 * Минимальная конфигурация для админ-панели
 */

export const ADMIN_EMAIL = "nazarov.soft@gmail.com";

/**
 * Проверить, является ли пользователь администратором
 */
export function isAdmin(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}
