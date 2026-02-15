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
import type { AppContext } from '../types'

/**
 * Custom error class for Deploy operations
 * @extends Error
 */
export class DeployError extends Error {
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
    this.name = 'DeployError'
  }
}

export const ErrorCodes = {
  // Client errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PROJECT_ID: 'INVALID_PROJECT_ID',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DEPLOYMENT_LIMIT_EXCEEDED: 'DEPLOYMENT_LIMIT_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  WORKFLOW_ERROR: 'WORKFLOW_ERROR',
  SANDBOX_ERROR: 'SANDBOX_ERROR',
  BUILD_ERROR: 'BUILD_ERROR',
  DEPLOYMENT_ERROR: 'DEPLOYMENT_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
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
  if (error instanceof DeployError) {
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
 * Enhanced error handler for Deploy service
 * Handles all unhandled errors and returns appropriate responses
 */
export function errorHandler() {
  return async (err: Error, c: AppContext) => {
    const requestId = c.get('requestId') || crypto.randomUUID()
    
    // Log the error with appropriate level
    const statusCode = err instanceof HTTPException ? err.status : 
                      err instanceof DeployError ? err.statusCode : 500
    
    const logLevel = statusCode >= 500 ? 'error' : 'warn'
    
    log.deployment(logLevel, 'Request error in Deploy service', {
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
      // Re-throw as DeployError if needed
      if (error instanceof Error && !(error instanceof DeployError) && !(error instanceof HTTPException)) {
        throw new DeployError(
          500,
          ErrorCodes.INTERNAL_ERROR,
          'An unexpected error occurred during deployment operation',
          { originalError: error.message, operation: 'route_handler' }
        )
      }
      throw error
    }
  }
}

/**
 * Common error responses for Deploy service
 */
export const CommonErrors = {
  unauthorized: () => new DeployError(401, ErrorCodes.UNAUTHORIZED, 'Authentication required'),

  forbidden: (reason?: string) => new DeployError(
    403,
    ErrorCodes.FORBIDDEN,
    reason || 'Access denied'
  ),

  notFound: (resource: string) => new DeployError(
    404,
    ErrorCodes.NOT_FOUND,
    `${resource} not found`
  ),

  invalidRequest: (message: string, details?: unknown) => new DeployError(
    400,
    ErrorCodes.INVALID_REQUEST,
    message,
    details
  ),

  invalidProjectId: (projectId: string) => new DeployError(
    400,
    ErrorCodes.INVALID_PROJECT_ID,
    `Invalid project ID: ${projectId}`
  ),

  deploymentLimitExceeded: (limit: number) => new DeployError(
    429,
    ErrorCodes.DEPLOYMENT_LIMIT_EXCEEDED,
    `Deployment limit exceeded. Maximum ${limit} deployments allowed.`
  ),

  rateLimited: (retryAfter?: number) => new DeployError(
    429,
    ErrorCodes.RATE_LIMITED,
    'Too many deployment requests. Please try again later.',
    { retryAfter }
  ),

  workflowError: (operation: string, details?: unknown) => new DeployError(
    500,
    ErrorCodes.WORKFLOW_ERROR,
    `Workflow operation failed: ${operation}`,
    details
  ),

  sandboxError: (operation: string, details?: unknown) => new DeployError(
    500,
    ErrorCodes.SANDBOX_ERROR,
    `Sandbox operation failed: ${operation}`,
    details
  ),

  buildError: (message: string, details?: unknown) => new DeployError(
    500,
    ErrorCodes.BUILD_ERROR,
    `Build failed: ${message}`,
    details
  ),

  deploymentError: (message: string, details?: unknown) => new DeployError(
    500,
    ErrorCodes.DEPLOYMENT_ERROR,
    `Deployment failed: ${message}`,
    details
  ),

  databaseError: (operation: string) => new DeployError(
    500,
    ErrorCodes.DATABASE_ERROR,
    'Database operation failed',
    { operation }
  ),

  internalError: (message: string = 'Internal server error', details?: unknown) => new DeployError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    message,
    details
  ),
}
