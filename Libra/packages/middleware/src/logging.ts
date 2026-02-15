/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * logging.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import { requestId } from 'hono/request-id'
import type { MiddlewareHandler, Context, Next } from 'hono'
import type { LoggingConfig, LogEntry } from './types'

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  service: 'unknown',
  level: 'info',
  includeHeaders: false,
  includeBody: false,
  excludePaths: ['/health', '/favicon.ico'],
}

/**
 * Check if path should be excluded from logging
 */
function shouldExcludePath(path: string, excludePaths: string[]): boolean {
  return excludePaths.some(excludePath => {
    if (excludePath.endsWith('*')) {
      return path.startsWith(excludePath.slice(0, -1))
    }
    return path === excludePath
  })
}

/**
 * Create request ID middleware
 * Generates a unique request ID for each request
 */
export function createRequestIdMiddleware(): MiddlewareHandler {
  return requestId()
}

/**
 * Create logging middleware for request/response logging
 */
export function createLoggingMiddleware(config?: Partial<LoggingConfig>): MiddlewareHandler {
  const finalConfig: LoggingConfig = {
    ...DEFAULT_LOGGING_CONFIG,
    ...config,
  }

  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    const requestId = c.get('requestId') || crypto.randomUUID()
    
    // Set request ID if not already set
    if (!c.get('requestId')) {
      c.set('requestId', requestId)
    }

    // Check if this path should be excluded from logging
    if (shouldExcludePath(c.req.path, finalConfig.excludePaths || [])) {
      await next()
      return
    }

    // Extract request information
    const method = c.req.method
    const url = c.req.url
    const userAgent = c.req.header('user-agent') || 'Unknown'
    const cfConnectingIp = c.req.header('cf-connecting-ip') || 
                          c.req.header('x-forwarded-for') || 
                          'Unknown'
    const cfRay = c.req.header('cf-ray') || 'Unknown'

    // Log request start (only for debug level)
    if (finalConfig.level === 'debug') {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'debug',
        message: 'Request started',
        service: finalConfig.service,
        requestId,
        metadata: {
          method,
          url,
          userAgent,
          cfConnectingIp,
          cfRay,
          ...(finalConfig.includeHeaders && { headers: Object.fromEntries(c.req.raw.headers.entries()) }),
        },
      }
      console.log(JSON.stringify(logEntry))
    }

    try {
      await next()
      
      // Calculate response time
      const duration = Date.now() - startTime
      const status = c.res.status

      // Add response headers for debugging
      c.res.headers.set('X-Request-ID', requestId)
      c.res.headers.set('X-Response-Time', `${duration}ms`)

      // Log successful response
      if (finalConfig.level === 'debug' || finalConfig.level === 'info') {
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Request completed',
          service: finalConfig.service,
          requestId,
          metadata: {
            method,
            url,
            status,
            duration,
            userAgent,
            cfConnectingIp,
            cfRay,
          },
        }
        console.log(JSON.stringify(logEntry))
      }
    } catch (error) {
      // Calculate response time for error case
      const duration = Date.now() - startTime

      // Log error
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Request failed',
        service: finalConfig.service,
        requestId,
        metadata: {
          method,
          url,
          duration,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userAgent,
          cfConnectingIp,
          cfRay,
        },
      }
      console.error(JSON.stringify(logEntry))

      // Re-throw the error to be handled by error middleware
      throw error
    }
  }
}

/**
 * Create structured logger for application use
 */
export function createLogger(service: string) {
  return {
    debug: (message: string, metadata?: Record<string, unknown>) => {
      if ((process.env.LOG_LEVEL as string) === 'debug') {
        const logEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'debug',
          message,
          service,
          requestId: crypto.randomUUID(),
          metadata,
        }
        console.log(JSON.stringify(logEntry))
      }
    },

    info: (message: string, metadata?: Record<string, unknown>) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        service,
        requestId: crypto.randomUUID(),
        metadata,
      }
      console.log(JSON.stringify(logEntry))
    },

    warn: (message: string, metadata?: Record<string, unknown>) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message,
        service,
        requestId: crypto.randomUUID(),
        metadata,
      }
      console.warn(JSON.stringify(logEntry))
    },

    error: (message: string, metadata?: Record<string, unknown>, error?: Error) => {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        service,
        requestId: crypto.randomUUID(),
        metadata: {
          ...metadata,
          ...(error && {
            error: error.message,
            stack: error.stack,
          }),
        },
      }
      console.error(JSON.stringify(logEntry))
    },
  }
}

/**
 * Create performance logging middleware
 * Logs slow requests based on threshold
 */
export function createPerformanceLoggingMiddleware(
  service: string,
  thresholdMs = 1000
): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    const requestId = c.get('requestId') || crypto.randomUUID()

    await next()

    const duration = Date.now() - startTime
    
    if (duration > thresholdMs) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Slow request detected',
        service,
        requestId,
        metadata: {
          method: c.req.method,
          url: c.req.url,
          duration,
          threshold: thresholdMs,
          status: c.res.status,
        },
      }
      console.warn(JSON.stringify(logEntry))
    }
  }
}
