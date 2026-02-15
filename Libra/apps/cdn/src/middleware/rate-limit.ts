/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * rate-limit.ts
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

import type { Context, Next } from 'hono'
import { log } from '@libra/common'

// Rate limiting binding interface
export interface RateLimitBinding {
  limit: (options: { key: string }) => Promise<{ success: boolean }>
}

// Rate limit middleware options
export interface RateLimitOptions {
  binding: RateLimitBinding
  keyPrefix?: string
  skipOnMissingUser?: boolean
}

// Rate limit error response interface
export interface RateLimitErrorResponse {
  error: string
  message: string
  retryAfter?: number
}

/**
 * Creates a rate limiting middleware for Hono applications
 * Uses Cloudflare Workers Rate Limiting API to enforce limits
 * 
 * @param options - Configuration options for the rate limiter
 * @returns Hono middleware function
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const { binding, keyPrefix = 'upload', skipOnMissingUser = false } = options

  return async (c: Context, next: Next) => {
    try {
      // Get user session from context (set by auth middleware)
      const userSession = c.get('userSession')
      
      if (!userSession) {
        if (skipOnMissingUser) {
          log.cdn('warn', 'Rate limit middleware: No user session found, skipping rate limit check', {
            operation: 'rate_limit',
            url: c.req.url,
            method: c.req.method
          })
          await next()
          return
        }

        log.cdn('error', 'Rate limit middleware: No user session found', {
          operation: 'rate_limit',
          url: c.req.url,
          method: c.req.method
        })
        return c.json({
          error: 'Unauthorized',
          message: 'Valid session required for rate limiting'
        }, 401)
      }

      // Extract user ID from session
      const userId = userSession.user?.id || userSession.userId
      
      if (!userId) {
        log.cdn('error', 'Rate limit middleware: No user ID found in session', {
          operation: 'rate_limit',
          sessionId: userSession.id,
          url: c.req.url
        })
        return c.json({
          error: 'Bad Request',
          message: 'Invalid user session'
        }, 400)
      }

      // Create rate limiting key
      const rateLimitKey = `${keyPrefix}:${userId}`
      
      log.cdn('info', 'Rate limit check started', {
        operation: 'rate_limit',
        userId,
        rateLimitKey,
        url: c.req.url,
        method: c.req.method
      })

      // Check rate limit
      const { success } = await binding.limit({ key: rateLimitKey })
      
      if (!success) {
        log.cdn('warn', 'Rate limit exceeded', {
          operation: 'rate_limit',
          userId,
          rateLimitKey,
          url: c.req.url,
          method: c.req.method,
          status: 'rate_limited'
        })

        const errorResponse: RateLimitErrorResponse = {
          error: 'Too Many Requests',
          message: 'Upload rate limit exceeded. Please wait before trying again.',
          retryAfter: 10 // Suggest retry after 10 seconds
        }

        return c.json(errorResponse, 429, {
          'Retry-After': '60',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Window': '60'
        })
      }

      log.cdn('info', 'Rate limit check passed', {
        operation: 'rate_limit',
        userId,
        rateLimitKey,
        status: 'allowed'
      })

      // Rate limit check passed, continue to next middleware
      await next()

    } catch (error) {
      log.cdn('error', 'Rate limit middleware error', {
        operation: 'rate_limit',
        url: c.req.url,
        method: c.req.method
      }, error instanceof Error ? error : new Error(String(error)))

      // On error, allow the request to proceed (fail open)
      // This ensures that rate limiting issues don't break the service
      await next()
    }
  }
}

/**
 * Pre-configured rate limit middleware for file uploads
 * Uses the FILE_UPLOAD_RATE_LIMITER binding
 */
export function createUploadRateLimitMiddleware(binding: RateLimitBinding) {
  return createRateLimitMiddleware({
    binding,
    keyPrefix: 'upload',
    skipOnMissingUser: false
  })
}
