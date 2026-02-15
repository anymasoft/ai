/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * errors.ts
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

/**
 * Error codes for screenshot service
 */
export enum ErrorCodes {
  // Queue errors
  QUEUE_SEND_FAILED = 'QUEUE_SEND_FAILED',
  QUEUE_PROCESSING_FAILED = 'QUEUE_PROCESSING_FAILED',
  
  // Validation errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_PARAMETERS = 'MISSING_PARAMETERS',
  INVALID_PROJECT = 'INVALID_PROJECT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Sandbox errors
  SANDBOX_CREATION_FAILED = 'SANDBOX_CREATION_FAILED',
  SANDBOX_NOT_FOUND = 'SANDBOX_NOT_FOUND',
  FILE_SYNC_FAILED = 'FILE_SYNC_FAILED',
  
  // Screenshot errors
  PREVIEW_GENERATION_FAILED = 'PREVIEW_GENERATION_FAILED',
  SCREENSHOT_CAPTURE_FAILED = 'SCREENSHOT_CAPTURE_FAILED',
  SCREENSHOT_STORAGE_FAILED = 'SCREENSHOT_STORAGE_FAILED',
  
  // System errors
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
}

/**
 * Custom error class for screenshot service
 */
export class ScreenshotError extends Error {
  public readonly statusCode: number
  public readonly errorCode: ErrorCodes
  public readonly context?: any
  public readonly timestamp: string

  constructor(
    statusCode: number,
    errorCode: ErrorCodes,
    message: string,
    context?: any
  ) {
    super(message)
    this.name = 'ScreenshotError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.context = context
    this.timestamp = new Date().toISOString()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScreenshotError)
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }

  /**
   * Create API response format
   */
  toApiResponse() {
    return {
      success: false,
      error: this.errorCode,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    }
  }
}

/**
 * Common error factory functions
 */
export class CommonErrors {
  static invalidRequest(message: string, context?: any): ScreenshotError {
    return new ScreenshotError(400, ErrorCodes.INVALID_REQUEST, message, context)
  }

  static missingParameters(parameters: string[]): ScreenshotError {
    return new ScreenshotError(
      400,
      ErrorCodes.MISSING_PARAMETERS,
      `Missing required parameters: ${parameters.join(', ')}`,
      { missingParameters: parameters }
    )
  }

  static permissionDenied(message: string = 'Permission denied'): ScreenshotError {
    return new ScreenshotError(403, ErrorCodes.PERMISSION_DENIED, message)
  }

  static projectNotFound(projectId: string): ScreenshotError {
    return new ScreenshotError(
      404,
      ErrorCodes.INVALID_PROJECT,
      `Project not found: ${projectId}`,
      { projectId }
    )
  }

  static rateLimitExceeded(message: string = 'Rate limit exceeded'): ScreenshotError {
    return new ScreenshotError(429, ErrorCodes.RATE_LIMIT_EXCEEDED, message)
  }

  static internalError(message: string, context?: any): ScreenshotError {
    return new ScreenshotError(500, ErrorCodes.INTERNAL_ERROR, message, context)
  }

  static timeoutError(operation: string, timeout: number): ScreenshotError {
    return new ScreenshotError(
      408,
      ErrorCodes.TIMEOUT_ERROR,
      `Operation '${operation}' timed out after ${timeout}ms`,
      { operation, timeout }
    )
  }

  static externalServiceError(service: string, error: any): ScreenshotError {
    return new ScreenshotError(
      502,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      `External service '${service}' error: ${error instanceof Error ? error.message : String(error)}`,
      { service, originalError: error }
    )
  }
}

/**
 * Error handler utility for async operations
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  errorContext?: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof ScreenshotError) {
      throw error
    }

    // Convert unknown errors to ScreenshotError
    const message = error instanceof Error ? error.message : String(error)
    const context = errorContext ? { operation: errorContext, originalError: error } : { originalError: error }
    
    throw new ScreenshotError(500, ErrorCodes.INTERNAL_ERROR, message, context)
  }
}

/**
 * Validation helper for required fields
 */
export function validateRequired<T extends Record<string, any>>(
  obj: T,
  requiredFields: (keyof T)[]
): void {
  const missing = requiredFields.filter(field => 
    obj[field] === undefined || obj[field] === null || obj[field] === ''
  )

  if (missing.length > 0) {
    throw CommonErrors.missingParameters(missing as string[])
  }
}
