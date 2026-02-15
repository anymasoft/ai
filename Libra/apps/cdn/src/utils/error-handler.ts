import { log } from '@libra/common'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod/v4'
import { getConfig, isProduction } from '../config'
import type { AppContext } from '../types'

/**
 * Custom error class for CDN operations
 * @extends Error
 */
export class CDNError extends Error {
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
    this.name = 'CDNError'
  }
}

export const ErrorCodes = {
  // Client errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

/**
 * Create a sanitized error response based on environment
 */
function createErrorResponse(
  error: unknown,
  c: AppContext,
  requestId?: string
): ErrorResponse {
  const config = getConfig(c)
  const isProd = isProduction(config)
  
  // Handle known error types
  if (error instanceof CDNError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: isProd ? undefined : error.details,
        requestId,
      }
    }
  }
  
  if (error instanceof HTTPException) {
    return {
      error: {
        code: getHttpErrorCode(error.status),
        message: isProd ? getGenericMessage(error.status) : error.message,
        requestId,
      }
    }
  }
  
  if (error instanceof ZodError) {
    return {
      error: {
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Invalid request data',
        details: isProd ? undefined : error.issues,
        requestId,
      }
    }
  }
  
  // Generic error handling
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  
  return {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProd ? 'An unexpected error occurred' : message,
      details: isProd ? undefined : { 
        stack: error instanceof Error ? error.stack : undefined,
        raw: String(error)
      },
      requestId,
    }
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
    404: ErrorCodes.NOT_FOUND,
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
    404: 'Resource not found',
    429: 'Too many requests',
    500: 'Internal server error',
    503: 'Service temporarily unavailable',
  }
  
  return messageMap[status] || 'An error occurred'
}

/**
 * Global error handler middleware
 * @description Handles all errors in the application and returns appropriate responses
 * @returns Hono error handler function
 */
export function errorHandler() {
  return async (err: Error, c: AppContext) => {
    // Get request ID from Hono middleware or generate one
    const requestId = c.get('requestId') ?? crypto.randomUUID()
    
    // Log the error with appropriate level
    const statusCode = err instanceof HTTPException ? err.status : 
                      err instanceof CDNError ? err.statusCode : 500
    
    const logLevel = statusCode >= 500 ? 'error' : 'warn'
    
    log.cdn(logLevel, 'Request error', {
      operation: 'error-handler',
      error: err.message,
      statusCode,
      path: c.req.path,
      method: c.req.method,
      requestId,
      stack: err.stack,
    })
    
    const response = createErrorResponse(err, c, requestId)
    
    // Use Response constructor to avoid Hono status code type issues
    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
      },
    })
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
      const requestId = c.get('requestId') ?? crypto.randomUUID()

      // Log the original error for debugging
      log.cdn('error', 'Handler error caught by withErrorHandling', {
        operation: 'error-handler',
        requestId,
        path: c.req.path,
        method: c.req.method,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        isCDNError: error instanceof CDNError,
        isHTTPException: error instanceof HTTPException
      })

      // Re-throw as CDNError if needed
      if (error instanceof Error && !(error instanceof CDNError) && !(error instanceof HTTPException)) {
        throw new CDNError(
          500,
          ErrorCodes.INTERNAL_ERROR,
          `An unexpected error occurred: ${error.message}`,
          {
            originalError: error.message,
            originalStack: error.stack,
            requestId
          }
        )
      }
      throw error
    }
  }
}

/**
 * Common error responses
 */
export const CommonErrors = {
  unauthorized: () => new CDNError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required'),
  
  forbidden: (reason?: string) => new CDNError(
    403, 
    ErrorCodes.FORBIDDEN, 
    reason || 'Access denied'
  ),
  
  notFound: (resource: string) => new CDNError(
    404,
    ErrorCodes.NOT_FOUND,
    `${resource} not found`
  ),
  
  invalidRequest: (message: string, details?: unknown) => new CDNError(
    400,
    ErrorCodes.INVALID_REQUEST,
    message,
    details
  ),
  
  quotaExceeded: (quotaType: 'upload' | 'storage' = 'upload') => new CDNError(
    429,
    ErrorCodes.QUOTA_EXCEEDED,
    `${quotaType} quota exceeded. Please upgrade your plan.`
  ),
  
  rateLimited: (retryAfter?: number) => new CDNError(
    429,
    ErrorCodes.RATE_LIMITED,
    'Too many requests. Please try again later.',
    { retryAfter }
  ),
  
  storageError: (operation: string) => new CDNError(
    500,
    ErrorCodes.STORAGE_ERROR,
    'Storage operation failed',
    { operation }
  ),
  
  databaseError: (operation: string) => new CDNError(
    500,
    ErrorCodes.DATABASE_ERROR,
    'Database operation failed',
    { operation }
  ),
}