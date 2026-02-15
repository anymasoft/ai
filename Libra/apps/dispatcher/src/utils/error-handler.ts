/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error-handler.ts
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

import { log } from '@libra/common'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod/v4'
import type { Context } from 'hono'

type Bindings = {
  DATABASE?: D1Database
  HYPERDRIVE?: Hyperdrive
  KV?: KVNamespace
  dispatcher: DispatchNamespace
  DISPATCH_NAMESPACE_NAME: string
  DISPATCH_NAMESPACE_ACCOUNT_ID: string
  POSTGRES_URL: string
}

type Variables = {
  userSession?: any
  requestId: string
}

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

/**
 * Custom error class for Dispatcher operations
 * @extends Error
 */
export class DispatcherError extends Error {
  /**
   * @param statusCode - HTTP status code
   * @param code - Error code constant
   * @param message - Human-readable error message
   * @param details - Additional error details (hidden in production)
   */
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'DispatcherError'
  }
}

export const ErrorCodes = {
  // Client errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_WORKER_NAME: 'INVALID_WORKER_NAME',
  MISSING_WORKER_NAME: 'MISSING_WORKER_NAME',
  RESERVED_SUBDOMAIN: 'RESERVED_SUBDOMAIN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  WORKER_NOT_FOUND: 'WORKER_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DISPATCH_FAILED: 'DISPATCH_FAILED',
  WORKER_FETCH_FAILED: 'WORKER_FETCH_FAILED',
  CUSTOM_DOMAIN_ERROR: 'CUSTOM_DOMAIN_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NAMESPACE_ERROR: 'NAMESPACE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

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
function isProduction(): boolean {
  return process.env.ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production'
}

/**
 * Create a sanitized error response based on environment
 */
function createErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  const isProd = isProduction()
  
  // Handle known error types
  if (error instanceof DispatcherError) {
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
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Invalid request data',
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
      code: ErrorCodes.INTERNAL_ERROR,
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
    400: ErrorCodes.INVALID_REQUEST,
    401: ErrorCodes.UNAUTHORIZED,
    403: ErrorCodes.FORBIDDEN,
    404: ErrorCodes.WORKER_NOT_FOUND,
    429: ErrorCodes.RATE_LIMITED,
  }
  
  return statusMap[status] || ErrorCodes.INTERNAL_ERROR
}

/**
 * Get generic error message for production
 */
function getGenericMessage(status: number): string {
  const messageMap: Record<number, string> = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Worker not found',
    429: 'Too many requests',
    500: 'Internal server error',
    502: 'Worker fetch failed',
    503: 'Service temporarily unavailable',
  }
  
  return messageMap[status] || 'An error occurred'
}

/**
 * Enhanced error handler for Dispatcher service
 * Handles all unhandled errors and returns appropriate responses
 */
export function errorHandler() {
  return async (err: Error, c: AppContext) => {
    const requestId = c.get('requestId') || crypto.randomUUID()
    
    // Log the error with appropriate level
    const statusCode = err instanceof HTTPException ? err.status : 
                      err instanceof DispatcherError ? err.statusCode : 500
    
    const logLevel = statusCode >= 500 ? 'error' : 'warn'
    
    log.dispatcher(logLevel, 'Request error in Dispatcher service', {
      operation: 'error-handler',
      error: err.message,
      statusCode,
      path: c.req.path,
      method: c.req.method,
      requestId,
      stack: err.stack,
      errorType: err.constructor.name,
    })

    // Create error response
    const errorResponse = createErrorResponse(err, requestId)
    
    // Return error response with appropriate status code
    return c.json(errorResponse, statusCode as any)
  }
}

/**
 * Wrap async route handlers with error handling
 * @description Wraps route handlers to catch and properly handle errors
 * @param handler - The async route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (c: AppContext, ...args: T) => Promise<Response>
) {
  return async (c: AppContext, ...args: T) => {
    try {
      return await handler(c, ...args)
    } catch (error) {
      // Re-throw as DispatcherError if needed
      if (error instanceof Error && !(error instanceof DispatcherError) && !(error instanceof HTTPException)) {
        throw new DispatcherError(
          500,
          ErrorCodes.INTERNAL_ERROR,
          'An unexpected error occurred during dispatch operation',
          { originalError: error.message, operation: 'route_handler' }
        )
      }
      throw error
    }
  }
}

/**
 * Common error responses for Dispatcher service
 */
export const CommonErrors = {
  unauthorized: () => new DispatcherError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required'),

  forbidden: (reason?: string) => new DispatcherError(
    403,
    ErrorCodes.FORBIDDEN,
    reason || 'Access denied'
  ),

  workerNotFound: (workerName: string, namespace?: string) => new DispatcherError(
    404,
    ErrorCodes.WORKER_NOT_FOUND,
    `Worker '${workerName}' not found${namespace ? ` in namespace '${namespace}'` : ''}`
  ),

  invalidWorkerName: (workerName: string, reason?: string) => new DispatcherError(
    400,
    ErrorCodes.INVALID_WORKER_NAME,
    `Invalid worker name '${workerName}'${reason ? `: ${reason}` : ''}`
  ),

  missingWorkerName: () => new DispatcherError(
    400,
    ErrorCodes.MISSING_WORKER_NAME,
    'Worker name is required'
  ),

  reservedSubdomain: (subdomain: string) => new DispatcherError(
    400,
    ErrorCodes.RESERVED_SUBDOMAIN,
    `Subdomain '${subdomain}' is reserved and cannot be used`
  ),

  dispatchFailed: (workerName: string, details?: unknown) => new DispatcherError(
    500,
    ErrorCodes.DISPATCH_FAILED,
    `Failed to dispatch request to worker '${workerName}'`,
    details
  ),

  workerFetchFailed: (workerName: string, details?: unknown) => new DispatcherError(
    502,
    ErrorCodes.WORKER_FETCH_FAILED,
    `Worker '${workerName}' exists but failed to respond`,
    details
  ),

  customDomainError: (domain: string, message: string, details?: unknown) => new DispatcherError(
    500,
    ErrorCodes.CUSTOM_DOMAIN_ERROR,
    `Custom domain error for '${domain}': ${message}`,
    details
  ),

  databaseError: (operation: string) => new DispatcherError(
    500,
    ErrorCodes.DATABASE_ERROR,
    'Database operation failed',
    { operation }
  ),

  namespaceError: (namespace: string, operation: string) => new DispatcherError(
    500,
    ErrorCodes.NAMESPACE_ERROR,
    `Namespace operation failed for '${namespace}'`,
    { operation }
  ),

  rateLimited: (retryAfter?: number) => new DispatcherError(
    429,
    ErrorCodes.RATE_LIMITED,
    'Too many dispatch requests. Please try again later.',
    { retryAfter }
  ),

  invalidRequest: (message: string, details?: unknown) => new DispatcherError(
    400,
    ErrorCodes.INVALID_REQUEST,
    message,
    details
  ),

  internalError: (message: string = 'Internal server error', details?: unknown) => new DispatcherError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    message,
    details
  ),
}
