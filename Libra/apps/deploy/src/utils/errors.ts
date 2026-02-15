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
 * Error codes for Deploy V2 service
 */
export const ErrorCodes = {
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  
  // Deployment specific errors
  DEPLOYMENT_STEP_FAILED: 'DEPLOYMENT_STEP_FAILED',
  DEPLOYMENT_TIMEOUT: 'DEPLOYMENT_TIMEOUT',
  DEPLOYMENT_QUOTA_EXCEEDED: 'DEPLOYMENT_QUOTA_EXCEEDED',
  DEPLOYMENT_VALIDATION_FAILED: 'DEPLOYMENT_VALIDATION_FAILED',
  
  // Queue specific errors
  QUEUE_SEND_FAILED: 'QUEUE_SEND_FAILED',
  QUEUE_PROCESSING_FAILED: 'QUEUE_PROCESSING_FAILED',
  
  // Storage specific errors
  STORAGE_READ_FAILED: 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  
  // Sandbox specific errors
  SANDBOX_CREATE_FAILED: 'SANDBOX_CREATE_FAILED',
  SANDBOX_CONNECT_FAILED: 'SANDBOX_CONNECT_FAILED',
  SANDBOX_COMMAND_FAILED: 'SANDBOX_COMMAND_FAILED',
  
  // Project specific errors
  INVALID_PROJECT_ID: 'INVALID_PROJECT_ID',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_INACTIVE: 'PROJECT_INACTIVE'
} as const

/**
 * Custom error class for Deploy V2 operations
 */
export class DeploymentError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'DeploymentError'
  }

  /**
   * Convert error to JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details
    }
  }
}

/**
 * Common error factory functions
 */
export const CommonErrors = {
  unauthorized: () => new DeploymentError(
    401, 
    ErrorCodes.UNAUTHORIZED, 
    'Authentication required'
  ),

  forbidden: (reason?: string) => new DeploymentError(
    403,
    ErrorCodes.FORBIDDEN,
    reason || 'Access denied'
  ),

  notFound: (resource: string) => new DeploymentError(
    404,
    ErrorCodes.NOT_FOUND,
    `${resource} not found`
  ),

  invalidRequest: (message: string, details?: unknown) => new DeploymentError(
    400,
    ErrorCodes.INVALID_REQUEST,
    message,
    details
  ),

  invalidProjectId: (projectId: string) => new DeploymentError(
    400,
    ErrorCodes.INVALID_PROJECT_ID,
    `Invalid project ID: ${projectId}`
  ),

  projectNotFound: (projectId: string) => new DeploymentError(
    404,
    ErrorCodes.PROJECT_NOT_FOUND,
    `Project ${projectId} not found`
  ),

  projectInactive: (projectId: string) => new DeploymentError(
    400,
    ErrorCodes.PROJECT_INACTIVE,
    `Project ${projectId} is inactive`
  ),

  deploymentTimeout: (deploymentId: string) => new DeploymentError(
    408,
    ErrorCodes.DEPLOYMENT_TIMEOUT,
    `Deployment ${deploymentId} timed out`
  ),

  quotaExceeded: (organizationId: string) => new DeploymentError(
    429,
    ErrorCodes.DEPLOYMENT_QUOTA_EXCEEDED,
    `Deploy quota exhausted for organization ${organizationId}`
  ),

  sandboxCreateFailed: (reason: string) => new DeploymentError(
    500,
    ErrorCodes.SANDBOX_CREATE_FAILED,
    `Failed to create sandbox: ${reason}`
  ),

  sandboxConnectFailed: (sandboxId: string, reason: string) => new DeploymentError(
    500,
    ErrorCodes.SANDBOX_CONNECT_FAILED,
    `Failed to connect to sandbox ${sandboxId}: ${reason}`
  ),

  sandboxCommandFailed: (command: string, reason: string) => new DeploymentError(
    500,
    ErrorCodes.SANDBOX_COMMAND_FAILED,
    `Sandbox command failed: ${command}. Reason: ${reason}`
  ),

  queueSendFailed: (reason: string) => new DeploymentError(
    500,
    ErrorCodes.QUEUE_SEND_FAILED,
    `Failed to send message to queue: ${reason}`
  ),

  storageReadFailed: (key: string, reason: string) => new DeploymentError(
    500,
    ErrorCodes.STORAGE_READ_FAILED,
    `Failed to read from storage ${key}: ${reason}`
  ),

  storageWriteFailed: (key: string, reason: string) => new DeploymentError(
    500,
    ErrorCodes.STORAGE_WRITE_FAILED,
    `Failed to write to storage ${key}: ${reason}`
  ),

  internalError: (message?: string) => new DeploymentError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    message || 'An unexpected error occurred'
  )
}

/**
 * Error handler utility for async operations
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  errorCode: string = ErrorCodes.INTERNAL_ERROR
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof DeploymentError) {
      throw error
    }
    
    throw new DeploymentError(
      500,
      errorCode,
      `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    )
  }
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error = new Error('No attempts made')

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new DeploymentError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
    { originalError: lastError, attempts: maxRetries + 1 }
  )
}

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(
  obj: Record<string, any>,
  requiredFields: string[],
  objectName: string = 'object'
): void {
  const missingFields = requiredFields.filter(field => 
    obj[field] === undefined || obj[field] === null || obj[field] === ''
  )

  if (missingFields.length > 0) {
    throw CommonErrors.invalidRequest(
      `Missing required fields in ${objectName}: ${missingFields.join(', ')}`,
      { missingFields, providedFields: Object.keys(obj) }
    )
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(
  jsonString: string,
  defaultValue: T,
  errorMessage: string = 'Invalid JSON'
): T {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    throw CommonErrors.invalidRequest(
      `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
      { jsonString: jsonString.slice(0, 100) + '...' }
    )
  }
}
