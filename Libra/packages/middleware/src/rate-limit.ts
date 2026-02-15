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
 * Rate Limiting Middleware
 *
 * This module provides Cloudflare Workers Native Rate Limiting:
 *    - Uses Cloudflare's built-in rate limiting API
 *    - Provides distributed, persistent rate limiting across all Worker instances
 *    - Better performance and reliability in serverless environments
 *    - Requires Cloudflare rate limiting bindings in wrangler.toml
 *
 * For configuration examples, see the examples/cloudflare-rate-limiting.ts file.
 *
 */

import type { MiddlewareHandler } from 'hono'
import type { CloudflareRateLimitConfig, CloudflareRateLimiter, BaseContext } from './types'
import { CommonErrors } from './error-handler'



/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(c: BaseContext): string {
  return c.req.header('cf-connecting-ip') || 
         c.req.header('x-forwarded-for') || 
         c.req.header('x-real-ip') || 
         'unknown'
}

/**
 * Create rate limiting middleware using Cloudflare's Rate Limiting API
 * This requires a Cloudflare Workers Rate Limiting binding
 */
export function createCloudflareRateLimitMiddleware(
  rateLimiter: CloudflareRateLimiter,
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  const keyGenerator = config?.keyGenerator || defaultKeyGenerator
  const message = config?.message || 'Too many requests, please try again later.'
  const retryAfterSeconds = config?.retryAfterSeconds || 60

  return async (c: BaseContext, next) => {
    const key = keyGenerator(c)

    // Use Cloudflare's rate limiting
    const { success } = await rateLimiter.limit({ key })

    if (!success) {
      c.res.headers.set('Retry-After', retryAfterSeconds.toString())
      c.res.headers.set('X-RateLimit-Remaining', '0')

      throw CommonErrors.rateLimited(message, retryAfterSeconds)
    }

      await next()
  }
}

/**
 * Create general-purpose Cloudflare rate limiting middleware
 * Uses the default RATE_LIMITER binding from the environment
 */
export function createCloudflareRateLimitMiddlewareFromEnv(
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  return async (c: BaseContext, next) => {
    const rateLimiter = c.env.RATE_LIMITER
    if (!rateLimiter) {
      throw new Error('RATE_LIMITER binding not found. Please configure a Cloudflare rate limiting binding.')
    }

    const middleware = createCloudflareRateLimitMiddleware(rateLimiter, config)
    return middleware(c, next)
  }
}

/**
 * Create upload-specific rate limiting middleware using Cloudflare's native API
 */
export function createCloudflareUploadRateLimitMiddleware(
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  return async (c: BaseContext, next) => {
    const rateLimiter = c.env.UPLOAD_RATE_LIMITER
    if (!rateLimiter) {
      throw new Error('UPLOAD_RATE_LIMITER binding not found. Please configure a Cloudflare rate limiting binding.')
    }

    const middleware = createCloudflareRateLimitMiddleware(rateLimiter, config)
    return middleware(c, next)
  }
}

/**
 * Create authentication-specific rate limiting middleware using Cloudflare's native API
 */
export function createCloudflareAuthRateLimitMiddleware(
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  return async (c: BaseContext, next) => {
    const rateLimiter = c.env.AUTH_RATE_LIMITER
    if (!rateLimiter) {
      throw new Error('AUTH_RATE_LIMITER binding not found. Please configure a Cloudflare rate limiting binding.')
    }

    const middleware = createCloudflareRateLimitMiddleware(rateLimiter, config)
    return middleware(c, next)
  }
}

/**
 * Create user-specific rate limiting middleware using Cloudflare's native API
 * Uses user ID from session for rate limiting
 */
export function createCloudflareUserRateLimitMiddleware(
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  const userKeyGenerator = (c: BaseContext): string => {
    const userSession = c.get('userSession')
    if (userSession?.userId) {
      return `user:${userSession.userId}`
    }
    // Fallback to IP-based limiting for unauthenticated users
    return defaultKeyGenerator(c)
  }

  return async (c: BaseContext, next) => {
    const rateLimiter = c.env.USER_RATE_LIMITER
    if (!rateLimiter) {
      throw new Error('USER_RATE_LIMITER binding not found. Please configure a Cloudflare rate limiting binding.')
    }

    const middleware = createCloudflareRateLimitMiddleware(rateLimiter, {
      ...config,
      keyGenerator: userKeyGenerator,
    })

    return middleware(c, next)
  }
}



/**
 * Create endpoint-specific rate limiting middleware using Cloudflare's native API
 * Uses combination of IP and endpoint for rate limiting
 */
export function createCloudflareEndpointRateLimitMiddleware(
  endpoint: string,
  config?: CloudflareRateLimitConfig
): MiddlewareHandler {
  const endpointKeyGenerator = (c: BaseContext): string => {
    const ip = defaultKeyGenerator(c)
    return `${endpoint}:${ip}`
  }

  return async (c: BaseContext, next) => {
    const rateLimiter = c.env.API_RATE_LIMITER
    if (!rateLimiter) {
      throw new Error('API_RATE_LIMITER binding not found. Please configure a Cloudflare rate limiting binding.')
    }

    const middleware = createCloudflareRateLimitMiddleware(rateLimiter, {
      ...config,
      keyGenerator: endpointKeyGenerator,
    })

    return middleware(c, next)
  }
}

/**
 * Cloudflare rate limiting presets for common use cases
 * Note: Cloudflare rate limiting is configured at the binding level,
 * so these presets only configure the message and retry behavior
 */
export const CloudflareRateLimitPresets = {
  // Very strict - for sensitive operations
  strict: {
    message: 'Too many requests for this sensitive operation.',
    retryAfterSeconds: 60,
  },

  // Moderate - for API endpoints
  moderate: {
    message: 'API rate limit exceeded.',
    retryAfterSeconds: 60,
  },

  // Lenient - for public endpoints
  lenient: {
    message: 'Rate limit exceeded.',
    retryAfterSeconds: 60,
  },

  // Upload specific - for file uploads
  upload: {
    message: 'Upload rate limit exceeded.',
    retryAfterSeconds: 60,
  },

  // Authentication - for login attempts
  auth: {
    message: 'Too many authentication attempts.',
    retryAfterSeconds: 900, // 15 minutes
  },
} as const
