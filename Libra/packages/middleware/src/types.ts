/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

import type { Context, MiddlewareHandler } from 'hono'

/**
 * Cloudflare Workers Rate Limiting binding interface
 */
export interface CloudflareRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Universal base bindings (works with any runtime)
 */
export interface BaseBindings {
  // Database connections
  DATABASE?: unknown
  POSTGRES_URL?: string

  // Key-value storage
  KV?: unknown

  // Hyperdrive connection
  HYPERDRIVE?: unknown

  // Rate limiting bindings (Cloudflare Workers)
  RATE_LIMITER?: CloudflareRateLimiter
  USER_RATE_LIMITER?: CloudflareRateLimiter
  API_RATE_LIMITER?: CloudflareRateLimiter
  UPLOAD_RATE_LIMITER?: CloudflareRateLimiter
  AUTH_RATE_LIMITER?: CloudflareRateLimiter

  // Other common bindings
  [key: string]: unknown
}

/**
 * Base context variables
 */
export interface BaseVariables {
  userSession?: UserSession
  requestId: string
}

/**
 * User session interface
 */
export interface UserSession {
  userId: string
  email?: string
  activeOrganizationId?: string
  [key: string]: unknown
}

/**
 * Base application context
 */
export type BaseContext = Context<{ Bindings: BaseBindings; Variables: BaseVariables }>

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  ENVIRONMENT: 'development' | 'production' | 'staging'
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  NODE_ENV?: string
}

/**
 * CORS configuration options
 */
export interface CorsConfig {
  allowedOrigins: string[]
  allowMethods: string[]
  allowHeaders: string[]
  credentials: boolean
  maxAge: number
  exposeHeaders?: string[]
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
  timestamp: string
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  timestamp: string
  requestId?: string
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: BaseContext) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
}

/**
 * Cloudflare-specific rate limiting configuration
 */
export interface CloudflareRateLimitConfig {
  keyGenerator?: (c: BaseContext) => string
  message?: string
  retryAfterSeconds?: number
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  service: string
  level: 'debug' | 'info' | 'warn' | 'error'
  includeHeaders?: boolean
  includeBody?: boolean
  excludePaths?: string[]
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  required: boolean
  skipPaths?: string[]
  skipMethods?: string[]
  headerName?: string
  cookieName?: string
}

/**
 * Middleware factory function type
 */
export type MiddlewareFactory<T = unknown> = (config?: T) => MiddlewareHandler

/**
 * Error handler function type
 */
export type ErrorHandlerFunction = (err: Error, c: BaseContext) => Response | Promise<Response>

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service: string
  requestId: string
  metadata?: Record<string, unknown>
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'error'
  timestamp: string
  service: string
  version: string
  requestId: string
  checks?: Record<string, boolean | { status: boolean; message: string }>
  error?: string
}
