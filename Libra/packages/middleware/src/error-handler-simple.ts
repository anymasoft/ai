/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error-handler-simple.ts
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

import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod/v4'
import type { Context } from 'hono'

/**
 * Base error class for applications
 */
export class LibraError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'LibraError'
  }
}

/**
 * Common error codes used across all applications
 */
export const CommonErrorCodes = {
  // Client errors (4xx)
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const

export type CommonErrorCode = typeof CommonErrorCodes[keyof typeof CommonErrorCodes]

/**
 * Error response structure
 */
interface ErrorResponse {
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
 * Check if running in production environment
 */
function isProduction(env?: any): boolean {
  if (env) {
    return env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production'
  }
  if (typeof process !== 'undefined' && process.env) {
    return (process.env.ENVIRONMENT as string) === 'production' || (process.env.NODE_ENV as string) === 'production'
  }
  return false
}

/**
 * Create a sanitized error response based on environment
 */
function createErrorResponse(
  error: unknown,
  requestId?: string,
  env?: any
): ErrorResponse {
  const isProd = isProduction(env)
  
  // Handle known error types
  if (error instanceof LibraError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: isProd ? undefined : error.details,
        requestId,
      },
      timestamp: new Date().toISOString()
    }
  }
  
  if (error instanceof HTTPException) {
    return {
      success: false,
      error: {
        code: getHttpErrorCode(error.status),
        message: isProd ? getGenericMessage(error.status) : error.message,
        requestId,
      },
      timestamp: new Date().toISOString()
    }
  }
  
  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        code: CommonErrorCodes.VALIDATION_ERROR,
        message: 'Request validation failed',
        details: isProd ? undefined : error.issues,
        requestId,
      },
      timestamp: new Date().toISOString()
    }
  }
  
  // Generic error handling
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  
  return {
    success: false,
    error: {
      code: CommonErrorCodes.INTERNAL_ERROR,
      message: isProd ? 'An unexpected error occurred' : message,
      details: isProd ? undefined : { 
        stack: error instanceof Error ? error.stack : undefined,
        raw: String(error)
      },
      requestId,
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Get appropriate error code based on HTTP status
 */
function getHttpErrorCode(status: number): string {
  const statusMap: Record<number, string> = {
    400: CommonErrorCodes.INVALID_REQUEST,
    401: CommonErrorCodes.UNAUTHORIZED,
    403: CommonErrorCodes.FORBIDDEN,
    404: CommonErrorCodes.NOT_FOUND,
    405: CommonErrorCodes.METHOD_NOT_ALLOWED,
    409: CommonErrorCodes.CONFLICT,
    413: CommonErrorCodes.PAYLOAD_TOO_LARGE,
    422: CommonErrorCodes.VALIDATION_ERROR,
    429: CommonErrorCodes.RATE_LIMITED,
    500: CommonErrorCodes.INTERNAL_ERROR,
    503: CommonErrorCodes.SERVICE_UNAVAILABLE,
    504: CommonErrorCodes.TIMEOUT_ERROR,
  }
  
  return statusMap[status] || CommonErrorCodes.INTERNAL_ERROR
}

/**
 * Get generic error message for production
 */
function getGenericMessage(status: number): string {
  const messageMap: Record<number, string> = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    405: 'Method not allowed',
    409: 'Resource conflict',
    413: 'Request too large',
    422: 'Validation failed',
    429: 'Too many requests',
    500: 'Internal server error',
    503: 'Service temporarily unavailable',
    504: 'Request timeout',
  }
  
  return messageMap[status] || 'An error occurred'
}

/**
 * Simple error handler that works with any Hono context
 */
export function createErrorHandler(service = 'unknown') {
  return async (err: Error, c: Context) => {
    // Get request ID or generate one inside the handler
    let requestId: string
    try {
      requestId = (c.get as any)('requestId')
    } catch {
      requestId = undefined as any
    }
    
    if (!requestId) {
      requestId = crypto.randomUUID()
    }
    
    // Determine status code
    const statusCode = err instanceof HTTPException ? err.status : 
                      err instanceof LibraError ? err.statusCode : 500
    
    // Get environment from context
    const env = (c.env as any) || {}
    
    // Simple console logging
    const logData = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'error' : 'warn',
      service,
      requestId,
      error: err.message,
      statusCode,
      path: c.req.path,
      method: c.req.method,
      errorType: err.constructor.name,
    }
    
    if (statusCode >= 500) {
      console.error(JSON.stringify(logData))
    } else {
      console.warn(JSON.stringify(logData))
    }

    // Create error response
    const errorResponse = createErrorResponse(err, requestId, env)
    
    // Return error response with appropriate status code
    return c.json(errorResponse, statusCode as any)
  }
}

/**
 * Common error factory functions
 */
export const CommonErrors = {
  unauthorized: (message = 'Authentication required') => 
    new LibraError(401, CommonErrorCodes.UNAUTHORIZED, message),

  forbidden: (message = 'Access denied') => 
    new LibraError(403, CommonErrorCodes.FORBIDDEN, message),

  notFound: (resource = 'Resource') => 
    new LibraError(404, CommonErrorCodes.NOT_FOUND, `${resource} not found`),

  conflict: (message = 'Resource conflict') => 
    new LibraError(409, CommonErrorCodes.CONFLICT, message),

  validationError: (message = 'Validation failed', details?: unknown) => 
    new LibraError(422, CommonErrorCodes.VALIDATION_ERROR, message, details),

  rateLimited: (message = 'Too many requests', retryAfter?: number) => 
    new LibraError(429, CommonErrorCodes.RATE_LIMITED, message, { retryAfter }),

  payloadTooLarge: (message = 'Request payload too large', maxSize?: number) => 
    new LibraError(413, CommonErrorCodes.PAYLOAD_TOO_LARGE, message, { maxSize }),

  internalError: (message = 'Internal server error', details?: unknown) => 
    new LibraError(500, CommonErrorCodes.INTERNAL_ERROR, message, details),

  serviceUnavailable: (message = 'Service temporarily unavailable') => 
    new LibraError(503, CommonErrorCodes.SERVICE_UNAVAILABLE, message),

  databaseError: (operation = 'Database operation failed') => 
    new LibraError(500, CommonErrorCodes.DATABASE_ERROR, operation),

  externalServiceError: (service: string, message?: string) => 
    new LibraError(500, CommonErrorCodes.EXTERNAL_SERVICE_ERROR, 
      message || `External service error: ${service}`),

  timeoutError: (operation = 'Operation timed out') => 
    new LibraError(504, CommonErrorCodes.TIMEOUT_ERROR, operation),
}
