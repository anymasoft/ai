/**
 * Fetch with exponential backoff retry logic
 * Используется для всех API запросов к критичным эндпоинтам
 */

interface FetchOptions extends RequestInit {
  maxRetries?: number
  initialDelay?: number
  timeout?: number
}

interface RetryConfig {
  maxRetries: number
  initialDelay: number
  timeout: number
}

class FetchError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string
  ) {
    super(message)
    this.name = "FetchError"
  }
}

/**
 * Exponential backoff with jitter
 * Delay = initialDelay * (2 ^ attempt) + random jitter
 */
function getDelay(attempt: number, initialDelay: number): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt)
  const jitter = Math.random() * (exponentialDelay * 0.1)
  return exponentialDelay + jitter
}

/**
 * Wait for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch with retry, timeout, and exponential backoff
 * @param url - API endpoint
 * @param options - Fetch options (maxRetries, initialDelay, timeout)
 * @returns Response JSON
 * @throws FetchError with readable message
 */
export async function fetchWithRetry<T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 500,
    timeout = 15000,
    ...fetchOptions
  } = options

  const config: RetryConfig = {
    maxRetries,
    initialDelay,
    timeout,
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Успешный ответ (200-299)
        if (response.ok) {
          try {
            return await response.json()
          } catch {
            throw new FetchError(
              response.status,
              response.statusText,
              "Failed to parse response JSON"
            )
          }
        }

        // Ошибка: не пытаться рестартировать для 4xx кроме 429
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`
          try {
            const errorBody = await response.json()
            if (errorBody.error) {
              errorMessage = errorBody.error
            }
          } catch {
            // Ignore JSON parse error
          }
          throw new FetchError(response.status, response.statusText, errorMessage)
        }

        // Ошибка: можно попробовать рестартировать (5xx, 429)
        throw new FetchError(
          response.status,
          response.statusText,
          `Server error: ${response.status} ${response.statusText}`
        )
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Не пытаться рестартировать для невалидных URL или FetchError с 4xx
      if (error instanceof FetchError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error
      }

      // Если это последняя попытка
      if (attempt === config.maxRetries) {
        if (lastError instanceof FetchError) {
          throw lastError
        }
        throw new Error(
          `Failed after ${config.maxRetries} retries: ${lastError.message}`
        )
      }

      // Ждём перед следующей попыткой
      const waitTime = getDelay(attempt, config.initialDelay)
      await delay(waitTime)
    }
  }

  // Никогда не должны достичь сюда, но на всякий случай
  throw lastError || new Error("Unknown fetch error")
}

/**
 * Helper для GET запросов
 */
export async function getWithRetry<T = any>(
  url: string,
  options?: Omit<FetchOptions, "method">
): Promise<T> {
  return fetchWithRetry<T>(url, {
    method: "GET",
    ...options,
  })
}

/**
 * Helper для POST запросов
 */
export async function postWithRetry<T = any>(
  url: string,
  body?: any,
  options?: Omit<FetchOptions, "method" | "body">
): Promise<T> {
  return fetchWithRetry<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  })
}
