// Default to false if set to anything other than "true" or unset
export const IS_RUNNING_ON_CLOUD =
  import.meta.env.VITE_IS_DEPLOYED === "true" || false

/**
 * Формирует WebSocket URL на основе текущего origin браузера.
 * Это обеспечивает same-origin для WebSocket, чтобы браузер
 * отправлял session_id cookie при WebSocket upgrade.
 *
 * Преобразует:
 * - http: → ws:
 * - https: → wss:
 * - Сохраняет текущий хост и порт
 */
function getWsBackendUrl(): string {
  if (import.meta.env.VITE_WS_BACKEND_URL) {
    return import.meta.env.VITE_WS_BACKEND_URL
  }

  // Использовать текущий origin браузера для гарантированного same-origin
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.hostname
  const port = window.location.port ? `:${window.location.port}` : ''

  return `${protocol}//${host}${port}`
}

export const WS_BACKEND_URL =
  typeof window !== 'undefined' ? getWsBackendUrl() : 'ws://127.0.0.1:5173'

/**
 * HTTP Backend URL для REST API.
 * Должен совпадать с WebSocket origin для same-origin policy.
 */
function getHttpBackendUrl(): string {
  if (import.meta.env.VITE_HTTP_BACKEND_URL) {
    return import.meta.env.VITE_HTTP_BACKEND_URL
  }

  // Использовать текущий origin браузера (same-origin как WebSocket)
  const protocol = window.location.protocol
  const host = window.location.hostname
  const port = window.location.port ? `:${window.location.port}` : ''

  return `${protocol}//${host}${port}`
}

export const HTTP_BACKEND_URL =
  typeof window !== 'undefined' ? getHttpBackendUrl() : 'http://127.0.0.1:5173'

export const PICO_BACKEND_FORM_SECRET =
  import.meta.env.VITE_PICO_BACKEND_FORM_SECRET || null
