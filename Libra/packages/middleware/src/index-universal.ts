/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index-universal.ts
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

// Import functions for internal use
import { createCorsMiddleware } from './cors'
import { createErrorHandler } from './error-handler-universal'
import { createRequestIdMiddleware, createLoggingMiddleware } from './logging'
import { createAuthMiddleware } from './auth'
import type { CorsConfig, LoggingConfig, AuthConfig } from './types-universal'

// Export all types
export type {
  BaseBindings,
  BaseVariables,
  BaseContext,
  UserSession,
  EnvironmentConfig,
  CorsConfig,
  ErrorResponse,
  SuccessResponse,
  RateLimitConfig,
  CloudflareRateLimitConfig,
  CloudflareRateLimiter,
  LoggingConfig,
  AuthConfig,
  MiddlewareFactory,
  ErrorHandlerFunction,
  LogEntry,
  HealthCheckResult,
} from './types-universal'

// Export CORS middleware
export {
  createCorsMiddleware,
  createPublicCorsMiddleware,
  createStrictCorsMiddleware,
  createCdnCorsMiddleware,
} from './cors'

// Export error handling
export {
  LibraError,
  CommonErrorCodes,
  createErrorHandler,
  CommonErrors,
} from './error-handler-universal'
export type { CommonErrorCode } from './error-handler-universal'

// Export logging middleware
export {
  createRequestIdMiddleware,
  createLoggingMiddleware,
  createLogger,
  createPerformanceLoggingMiddleware,
} from './logging'

// Export rate limiting middleware
export {
  createCloudflareRateLimitMiddleware,
  createCloudflareRateLimitMiddlewareFromEnv,
  createCloudflareUserRateLimitMiddleware,
  createCloudflareEndpointRateLimitMiddleware,
  createCloudflareUploadRateLimitMiddleware,
  createCloudflareAuthRateLimitMiddleware,
  CloudflareRateLimitPresets,
} from './rate-limit'

// Export authentication middleware
export {
  createAuthMiddleware,
  createOptionalAuthMiddleware,
  createRoleAuthMiddleware,
  createOrgAuthMiddleware,
  createApiKeyAuthMiddleware,
  AuthUtils,
} from './auth'

/**
 * Standard middleware stack for applications
 * Provides a consistent set of middleware for all services
 */
export function createStandardMiddlewareStack(config: {
  service: string
  cors?: Partial<CorsConfig>
  logging?: Partial<LoggingConfig>
  auth?: Partial<AuthConfig>
}) {
  return {
    // Request ID middleware (should be first)
    requestId: createRequestIdMiddleware(),

    // Error handler (should be early in the stack)
    errorHandler: createErrorHandler(config.service),

    // CORS middleware
    cors: createCorsMiddleware(config.cors),

    // Logging middleware
    logging: createLoggingMiddleware({
      service: config.service,
      ...config.logging,
    }),

    // Authentication middleware (optional)
    auth: config.auth ? createAuthMiddleware(config.auth) : null,
  }
}

/**
 * Middleware presets for common application types
 */
export const MiddlewarePresets = {
  /**
   * API service preset
   * Full middleware stack with authentication
   * Note: Use Cloudflare rate limiting middleware separately for rate limiting
   */
  api: (service: string) => createStandardMiddlewareStack({
    service,
    cors: {
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    logging: {
      level: 'info',
      excludePaths: ['/health', '/docs'],
    },
    auth: {
      required: true,
      skipPaths: ['/health', '/docs', '/openapi.json'],
    },
  }),

  /**
   * CDN service preset
   * Public access with performance optimizations
   * Note: Use Cloudflare rate limiting middleware separately for rate limiting
   */
  cdn: (service: string) => createStandardMiddlewareStack({
    service,
    cors: {
      allowMethods: ['GET', 'HEAD', 'OPTIONS'],
      credentials: false,
      maxAge: 86400 * 7, // 7 days
    },
    logging: {
      level: 'warn', // Less verbose for high-traffic CDN
      excludePaths: ['/health', '/favicon.ico'],
    },
  }),

  /**
   * Dispatcher service preset
   * Optimized for routing with minimal overhead
   * Note: Use Cloudflare rate limiting middleware separately for rate limiting
   */
  dispatcher: (service: string) => createStandardMiddlewareStack({
    service,
    cors: {
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
    logging: {
      level: 'info',
      excludePaths: ['/health'],
    },
  }),

  /**
   * Deploy service preset
   * Authenticated service for deployments
   * Note: Use Cloudflare rate limiting middleware separately for rate limiting
   */
  deploy: (service: string) => createStandardMiddlewareStack({
    service,
    cors: {
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
    logging: {
      level: 'info',
      includeHeaders: true, // More detailed logging for deployments
    },
    auth: {
      required: true,
      skipPaths: ['/health', '/docs', '/openapi.json'],
    },
  }),

  /**
   * Public service preset
   * No authentication
   * Note: Use Cloudflare rate limiting middleware separately for rate limiting
   */
  public: (service: string) => createStandardMiddlewareStack({
    service,
    cors: {
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      credentials: false,
    },
    logging: {
      level: 'info',
    },
  }),
}
