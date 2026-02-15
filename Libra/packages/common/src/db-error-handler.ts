/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * db-error-handler.ts
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
 * Database error types for classification
 */
export enum DatabaseErrorType {
  CONNECTION_TERMINATED = 'CONNECTION_TERMINATED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT', 
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  QUERY_FAILED = 'QUERY_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  UNKNOWN = 'UNKNOWN'
}

/**
 * User-friendly error messages in English
 */
export const DB_ERROR_MESSAGES = {
  [DatabaseErrorType.CONNECTION_TERMINATED]: 'Database connection was unexpectedly terminated. Please try again later.',
  [DatabaseErrorType.CONNECTION_TIMEOUT]: 'Database connection timed out. Please check your network connection and try again.',
  [DatabaseErrorType.CONNECTION_REFUSED]: 'Unable to connect to the database. Please try again later.',
  [DatabaseErrorType.QUERY_FAILED]: 'Database query failed. Please try again later.',
  [DatabaseErrorType.PERMISSION_DENIED]: 'Insufficient database access permissions. Please contact your administrator.',
  [DatabaseErrorType.UNKNOWN]: 'Database service is temporarily unavailable. Please try again later.'
} as const

/**
 * Enhanced database error with user-friendly message
 */
export class DatabaseError extends Error {
  public readonly type: DatabaseErrorType
  public readonly userMessage: string
  public readonly originalError: Error
  public readonly isRetryable: boolean

  constructor(
    type: DatabaseErrorType,
    originalError: Error,
    userMessage?: string
  ) {
    super(originalError.message)
    this.name = 'DatabaseError'
    this.type = type
    this.userMessage = userMessage || DB_ERROR_MESSAGES[type]
    this.originalError = originalError
    this.isRetryable = this.determineRetryability(type)
    
    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError)
    }
  }

  private determineRetryability(type: DatabaseErrorType): boolean {
    switch (type) {
      case DatabaseErrorType.CONNECTION_TERMINATED:
      case DatabaseErrorType.CONNECTION_TIMEOUT:
      case DatabaseErrorType.CONNECTION_REFUSED:
        return true
      case DatabaseErrorType.PERMISSION_DENIED:
        return false
      case DatabaseErrorType.QUERY_FAILED:
      case DatabaseErrorType.UNKNOWN:
      default:
        return true
    }
  }
}

/**
 * Classify database error based on error message and properties
 */
export function classifyDatabaseError(error: Error): DatabaseErrorType {
  const message = error.message.toLowerCase()
  
  // Connection terminated patterns
  if (message.includes('connection terminated') || 
      message.includes('connection closed') ||
      message.includes('connection lost')) {
    return DatabaseErrorType.CONNECTION_TERMINATED
  }
  
  // Connection timeout patterns
  if (message.includes('timeout') || 
      message.includes('timed out') ||
      message.includes('connection timeout')) {
    return DatabaseErrorType.CONNECTION_TIMEOUT
  }
  
  // Connection refused patterns
  if (message.includes('connection refused') ||
      message.includes('could not connect') ||
      message.includes('connection failed')) {
    return DatabaseErrorType.CONNECTION_REFUSED
  }
  
  // Permission denied patterns
  if (message.includes('permission denied') ||
      message.includes('access denied') ||
      message.includes('authentication failed')) {
    return DatabaseErrorType.PERMISSION_DENIED
  }
  
  // Query failed patterns
  if (message.includes('syntax error') ||
      message.includes('invalid query') ||
      message.includes('constraint violation')) {
    return DatabaseErrorType.QUERY_FAILED
  }
  
  return DatabaseErrorType.UNKNOWN
}

/**
 * Transform database error into user-friendly DatabaseError
 */
export function transformDatabaseError(error: Error): DatabaseError {
  const type = classifyDatabaseError(error)
  return new DatabaseError(type, error)
}

/**
 * Check if an error is database-related
 */
export function isDatabaseError(error: Error): boolean {
  const message = error.message.toLowerCase()
  
  // Common database error indicators
  const dbErrorPatterns = [
    'connection',
    'database',
    'query',
    'sql',
    'postgres',
    'pg',
    'drizzle'
  ]
  
  return dbErrorPatterns.some(pattern => message.includes(pattern))
}

/**
 * Wrapper function for database operations with automatic error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof Error && isDatabaseError(error)) {
      const dbError = transformDatabaseError(error)
      
      // Log the original error for debugging
      console.error(`Database error in ${context || 'unknown context'}:`, {
        type: dbError.type,
        originalMessage: error.message,
        userMessage: dbError.userMessage,
        isRetryable: dbError.isRetryable,
        stack: error.stack
      })
      
      throw dbError
    }
    
    // Re-throw non-database errors as-is
    throw error
  }
}
