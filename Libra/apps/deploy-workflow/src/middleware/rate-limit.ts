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
  extractProjectId?: (c: Context) => string | null
}

// Rate limit error response interface
export interface RateLimitErrorResponse {
  success: false
  error: string
  message: string
  retryAfter?: number
}

/**
 * Creates a rate limiting middleware for Hono applications
 * Uses Cloudflare Workers Rate Limiting API to enforce limits
 * Supports composite keys with user_id + project_id for deployment rate limiting
 * 
 * @param options - Configuration options for the rate limiter
 * @returns Hono middleware function
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const { binding, keyPrefix = 'deploy', skipOnMissingUser = false, extractProjectId } = options

  return async (c: Context, next: Next) => {
    try {
      // Get user session from context (set by auth middleware)
      const userSession = c.get('userSession')
      
      if (!userSession) {
        if (skipOnMissingUser) {
          log.deployment('warn', 'Rate limit middleware: No user session found, skipping rate limit check', {
            operation: 'rate_limit',
            url: c.req.url,
            method: c.req.method
          })
          await next()
          return
        }

        log.deployment('error', 'Rate limit middleware: No user session found', {
          operation: 'rate_limit',
          url: c.req.url,
          method: c.req.method
        })
        return c.json({
          success: false,
          error: 'Unauthorized',
          message: 'Valid session required for rate limiting'
        }, 401)
      }

      // Extract user ID from session
      const userId = userSession.user?.id || userSession.userId
      
      if (!userId) {
        log.deployment('error', 'Rate limit middleware: No user ID found in session', {
          operation: 'rate_limit',
          sessionId: userSession.session?.id,
          url: c.req.url
        })
        return c.json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid user session'
        }, 400)
      }

      // Create rate limiting key - support composite keys with project ID
      let rateLimitKey = `${keyPrefix}:${userId}`
      
      // If project ID extraction is provided, create composite key
      if (extractProjectId) {
        const projectId = extractProjectId(c)
        if (projectId) {
          rateLimitKey = `${keyPrefix}:${userId}:${projectId}`
        }
      }
      
      log.deployment('info', 'Rate limit check started', {
        operation: 'rate_limit',
        userId,
        rateLimitKey,
        url: c.req.url,
        method: c.req.method
      })

      // Check rate limit
      const { success } = await binding.limit({ key: rateLimitKey })
      
      if (!success) {
        log.deployment('warn', 'Rate limit exceeded', {
          operation: 'rate_limit',
          userId,
          rateLimitKey,
          url: c.req.url,
          method: c.req.method,
          status: 'rate_limited'
        })

        const errorResponse: RateLimitErrorResponse = {
          success: false,
          error: 'Too Many Requests',
          message: 'Deployment rate limit exceeded. Please wait before trying again.',
          retryAfter: 60 // Suggest retry after 60 seconds
        }

        return c.json(errorResponse, 429, {
          'Retry-After': '60',
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Window': '60'
        })
      }

      log.deployment('info', 'Rate limit check passed', {
        operation: 'rate_limit',
        userId,
        rateLimitKey,
        status: 'allowed'
      })

      // Rate limit check passed, continue to next middleware
      await next()

    } catch (error) {
      log.deployment('error', 'Rate limit middleware error', {
        operation: 'rate_limit',
        url: c.req.url,
        method: c.req.method
      }, error instanceof Error ? error : new Error(String(error)))

      // On error, allow the request to proceed (fail open)
      // This ensures that rate limiting issues don't break the deployment service
      await next()
    }
  }
}

/**
 * Pre-configured rate limit middleware for deployment operations
 * Uses the DEPLOYMENT_RATE_LIMITER binding with user+project composite keys
 */
export function createDeploymentRateLimitMiddleware(
  binding: RateLimitBinding,
  extractProjectId?: (c: Context) => string | null
) {
  return createRateLimitMiddleware({
    binding,
    keyPrefix: 'deploy',
    skipOnMissingUser: false,
    extractProjectId
  })
}

/**
 * Helper function to extract project ID from deployment request
 * Used for creating composite rate limiting keys
 * Note: This function tries query parameters first, then falls back to null
 * since accessing request body synchronously is not reliable
 */
export function extractProjectIdFromRequest(c: Context): string | null {
  try {
    // Try to get project ID from query parameters first
    const projectIdFromQuery = c.req.query('projectId')
    if (projectIdFromQuery) {
      return projectIdFromQuery
    }

    // For POST requests, we can't reliably access the body synchronously
    // The rate limiting will still work with user-only keys
    return null
  } catch {
    return null
  }
}
