/**
 * Admin Panel Configuration
 * Конфигурация для админ-панели Screen2Code
 */

/**
 * Проверить, является ли пользователь администратором.
 * В будущем это будет проверяться через API/session.
 * Сейчас - через environment variable для dev mode.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false

  // TODO: Replace with real API check when auth system is implemented
  // For now, check against environment variable or hardcoded email
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@screen2code.com"

  return email === adminEmail
}

/**
 * Get current admin email from session/auth.
 * TODO: Integrate with real auth system when implemented.
 */
export function getAdminEmail(): string | null {
  // TODO: Get from session/auth
  // For now, return from localStorage (dev mode only)
  if (typeof window !== "undefined") {
    return localStorage.getItem("dev_admin_email") || null
  }
  return null
}

/**
 * Set admin email in dev mode.
 * REMOVE THIS IN PRODUCTION - only for development.
 */
export function setDevAdminEmail(email: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("dev_admin_email", email)
  }
}
