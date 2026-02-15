/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * validation.ts
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

import type { Context } from 'hono'

type Bindings = {
  DATABASE?: D1Database
  KV?: KVNamespace
  dispatcher: DispatchNamespace
  DISPATCH_NAMESPACE_NAME: string
  DISPATCH_NAMESPACE_ACCOUNT_ID: string
}

type Variables = {
  userSession?: any
  requestId: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
  code?: string
}

/**
 * Validate dispatch request
 */
export function validateDispatchRequest(
  context: Context<{ Bindings: Bindings; Variables: Variables }>,
  workerName: string
): ValidationResult {
  // Check if dispatch namespace is available
  if (!context.env.dispatcher) {
    return {
      valid: false,
      error: 'Dispatch namespace not configured',
      code: 'NAMESPACE_NOT_CONFIGURED'
    }
  }
  
  // Validate worker name
  const workerValidation = validateWorkerName(workerName)
  if (!workerValidation.valid) {
    return {
      valid: false,
      error: workerValidation.error || 'Invalid worker name',
      code: 'INVALID_WORKER_NAME'
    }
  }
  
  // Check request method (optional validation)
  const method = context.req.method
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
  if (!allowedMethods.includes(method)) {
    return {
      valid: false,
      error: `HTTP method '${method}' not allowed`,
      code: 'METHOD_NOT_ALLOWED'
    }
  }
  
  return { valid: true }
}

/**
 * Validate worker name format
 */
export function validateWorkerName(workerName: string): ValidationResult {
  if (!workerName || workerName.trim() === '') {
    return {
      valid: false,
      error: 'Worker name is required',
      code: 'WORKER_NAME_REQUIRED'
    }
  }
  
  // Basic format validation
  if (!/^[a-zA-Z0-9-_]+$/.test(workerName)) {
    return {
      valid: false,
      error: 'Worker name can only contain letters, numbers, hyphens, and underscores',
      code: 'INVALID_WORKER_NAME_FORMAT'
    }
  }
  
  // Length validation
  if (workerName.length > 63) {
    return {
      valid: false,
      error: 'Worker name must be 63 characters or less',
      code: 'WORKER_NAME_TOO_LONG'
    }
  }
  
  if (workerName.length < 1) {
    return {
      valid: false,
      error: 'Worker name must be at least 1 character',
      code: 'WORKER_NAME_TOO_SHORT'
    }
  }
  
  // Reserved names
  const reservedNames = ['dispatcher', 'api', 'health', 'admin', 'system', 'www', 'mail', 'ftp']
  if (reservedNames.includes(workerName.toLowerCase())) {
    return {
      valid: false,
      error: `Worker name '${workerName}' is reserved`,
      code: 'WORKER_NAME_RESERVED'
    }
  }
  
  return { valid: true }
}

/**
 * Validate request headers
 */
export function validateRequestHeaders(
  context: Context<{ Bindings: Bindings; Variables: Variables }>
): ValidationResult {
  const headers = context.req.header()
  
  // Check for required headers (if any)
  // This can be extended based on specific requirements
  
  // Validate Content-Type for POST/PUT requests
  const method = context.req.method
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = headers['content-type']
    if (!contentType) {
      return {
        valid: false,
        error: 'Content-Type header is required for POST/PUT/PATCH requests',
        code: 'CONTENT_TYPE_REQUIRED'
      }
    }
  }
  
  // Check for potentially dangerous headers
  const dangerousHeaders = ['x-forwarded-for', 'x-real-ip']
  for (const header of dangerousHeaders) {
    if (headers[header]) {
    }
  }
  
  return { valid: true }
}

/**
 * Validate request size
 */
export function validateRequestSize(
  context: Context<{ Bindings: Bindings; Variables: Variables }>,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
): ValidationResult {
  const contentLength = context.req.header('content-length')
  
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10)
    if (size > maxSizeBytes) {
      return {
        valid: false,
        error: `Request size (${size} bytes) exceeds maximum allowed size (${maxSizeBytes} bytes)`,
        code: 'REQUEST_TOO_LARGE'
      }
    }
  }
  
  return { valid: true }
}
