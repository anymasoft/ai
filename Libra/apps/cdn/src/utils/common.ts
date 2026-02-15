import { log } from '@libra/common'
import type { AppContext } from '../types'

/**
 * Get the appropriate storage bucket from context
 */
export function getStorageBucket(c: AppContext): R2Bucket {
  const bucket = c.env.BUCKET || c.env.R2
  if (!bucket) {
    throw new Error('Storage bucket not configured')
  }
  return bucket
}

/**
 * Get the appropriate database instance from context
 */
export function getDatabase(c: AppContext): D1Database {
  const db = c.env.DB || c.env.DATABASE
  if (!db) {
    throw new Error('Database not configured')
  }
  return db
}

/**
 * Generate a unique request ID if not provided
 */
export function getRequestId(c: AppContext): string {
  return c.req.header('x-request-id') ?? crypto.randomUUID()
}

/**
 * Log with request context
 */
export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: Record<string, unknown>,
  c: AppContext,
  error?: Error
) {
  const requestId = getRequestId(c)
  const enrichedContext = {
    ...context,
    requestId,
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header('user-agent') ?? undefined,
    ip: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? undefined,
  }
  
  // Convert debug level to info since log.cdn doesn't support debug
  const logLevel = level === 'debug' ? 'info' : level

  if (error) {
    log.cdn(logLevel, message, enrichedContext, error)
  } else {
    log.cdn(logLevel, message, enrichedContext)
  }
}

/**
 * Get authenticated user information from context
 */
export function getAuthInfo(c: AppContext): {
  userId: string
  organizationId: string
} | null {
  const userSession = c.get('userSession')
  if (!userSession?.session) {
    return null
  }
  
  return {
    userId: userSession.session.userId,
    organizationId: userSession.session.activeOrganizationId || '',
  }
}

/**
 * Create a cache key with proper namespacing
 */
export function createCacheKey(namespace: string, ...parts: string[]): string {
  return `libra:cdn:${namespace}:${parts.join(':')}`
}

/**
 * Parse and validate integer query parameter
 */
export function parseIntParam(
  value: string | undefined,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue
  
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return defaultValue
  
  if (min !== undefined && parsed < min) return min
  if (max !== undefined && parsed > max) return max
  
  return parsed
}

/**
 * Create consistent response headers
 */
export function createResponseHeaders(
  contentType: string,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...additionalHeaders,
  }
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    factor?: number
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    factor = 2,
    onRetry,
  } = options
  
  let lastError: Error | undefined
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(initialDelay * (factor ** attempt), maxDelay)
        
        if (onRetry) {
          onRetry(attempt + 1, lastError)
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed')
}

/**
 * Batch operations for better performance
 */
export class BatchProcessor<T, R> {
  private batch: Array<{ item: T; resolve: (result: R) => void; reject: (error: unknown) => void }> = []
  private timer: number | null = null

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize?: number
      maxWaitTime?: number
    } = {}
  ) {}

  async add(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.batch.push({ item, resolve, reject })

      const processBatch = async (): Promise<void> => {
        const currentBatch = this.batch.splice(0)
        if (this.timer) {
          clearTimeout(this.timer)
          this.timer = null
        }

        if (currentBatch.length === 0) {
          return
        }

        try {
          const items = currentBatch.map(entry => entry.item)
          const results = await this.processor(items)

          // Resolve individual promises with their corresponding results
          currentBatch.forEach((entry, index) => {
            if (index < results.length) {
              const result = results[index]
              if (result !== undefined) {
                entry.resolve(result)
              } else {
                entry.reject(new Error('Missing result for batch item'))
              }
            } else {
              entry.reject(new Error('Missing result for batch item'))
            }
          })
        } catch (error) {
          // Reject all promises in the batch
          currentBatch.forEach(entry => entry.reject(error))
        }
      }

      if (this.batch.length >= (this.options.maxBatchSize || 10)) {
        void processBatch()
      } else if (!this.timer) {
        this.timer = setTimeout(() => void processBatch(), this.options.maxWaitTime || 100) as unknown as number
      }
    })
  }
}

