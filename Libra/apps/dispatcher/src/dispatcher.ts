/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * dispatcher.ts
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

import { log, tryCatch } from '@libra/common'
import type { Context } from 'hono'
import { extractSubdomain, isSupportedDomain, isValidWorkerSubdomain } from './config/domains'
import { CommonErrors } from './utils/error-handler'

type Bindings = {
  DATABASE?: D1Database
  KV?: KVNamespace
  dispatcher: DispatchNamespace
  DISPATCH_NAMESPACE_NAME: string
  DISPATCH_NAMESPACE_ACCOUNT_ID: string
}

type Variables = {
  userSession?: unknown
  requestId: string
}

export interface DispatchOptions {
  workerName: string
  request: Request
  context: Context<{ Bindings: Bindings; Variables: Variables }>
}

export interface DispatchResult {
  success: boolean
  response?: Response
  error?: string
  workerName: string
  requestId: string
}

/**
 * Core dispatch function to route requests to user workers (optimized version for Plan A)
 */
export async function dispatchToWorker(options: DispatchOptions): Promise<DispatchResult> {
  const { workerName, request, context } = options
  const requestId = context.get('requestId') || crypto.randomUUID()

  log.dispatcher('info', 'Starting worker dispatch', {
    workerName,
    requestId,
    operation: 'dispatch',
    url: request.url,
    method: request.method,
  })

  const [result, error] = await tryCatch(async () => {
    // Validate worker name using domain config
    if (!workerName || workerName.trim() === '') {
      log.dispatcher('warn', 'Worker dispatch failed - empty worker name', {
        requestId,
        operation: 'validation',
      })
      throw CommonErrors.missingWorkerName()
    }

    const validation = isValidWorkerSubdomain(workerName)
    if (!validation.valid) {
      log.dispatcher('warn', 'Worker dispatch failed - invalid worker name', {
        workerName,
        requestId,
        operation: 'validation',
        validationError: validation.error,
      })
      throw CommonErrors.invalidWorkerName(workerName, validation.error)
    }

    // Get the user worker from dispatch namespace
    const userWorker = context.env.dispatcher.get(workerName)

    // Forward the request to the user worker
    const response = await userWorker.fetch(request)

    log.dispatcher('info', 'Worker dispatch completed successfully', {
      workerName,
      requestId,
      operation: 'dispatch',
      responseStatus: response.status,
      responseHeaders: Object.fromEntries(response.headers.entries()),
    })

    return {
      success: true,
      response,
      workerName,
      requestId,
    }
  })

  if (error) {
    // Re-throw the error to be handled by the error middleware
    // This allows for consistent error handling across the application
    throw error
  }

  return result
}

/**
 * Extract worker name from request (simplified for Plan A)
 */
export function extractWorkerName(
  context: Context<{ Bindings: Bindings; Variables: Variables }>
): string | null {
  const url = new URL(context.req.url)
  const hostname = url.hostname
  const pathname = url.pathname
  const requestId = context.get('requestId') || crypto.randomUUID()

  log.dispatcher('info', 'Starting worker name extraction', {
    hostname,
    pathname,
    requestId,
    operation: 'extract_worker',
  })

  // Primary strategy: Subdomain-based routing (core of Plan A)
  if (isSupportedDomain(hostname)) {
    const subdomain = extractSubdomain(hostname)
    if (subdomain) {
      const validation = isValidWorkerSubdomain(subdomain)
      if (validation.valid) {
        log.dispatcher('info', 'Worker name extracted via subdomain routing', {
          workerName: subdomain,
          hostname,
          requestId,
          operation: 'extract_worker',
          strategy: 'subdomain',
        })
        return subdomain
      }
      log.dispatcher('warn', 'Invalid subdomain found during extraction', {
        subdomain,
        hostname,
        requestId,
        operation: 'extract_worker',
        validationError: validation.error,
      })
    }
  } else {
    log.dispatcher('warn', 'Unsupported domain in worker extraction', {
      hostname,
      requestId,
      operation: 'extract_worker',
    })
  }

  // Fallback strategy: Path-based routing (for API endpoints)
  const pathMatch = pathname.match(/^\/(?:api\/)?dispatch\/([^\/]+)/)
  if (pathMatch?.[1]) {
    const pathWorkerName = pathMatch[1]
    const validation = isValidWorkerSubdomain(pathWorkerName)
    if (validation.valid) {
      log.dispatcher('info', 'Worker name extracted via path routing', {
        workerName: pathWorkerName,
        pathname,
        requestId,
        operation: 'extract_worker',
        strategy: 'path',
      })
      return pathWorkerName
    }
    log.dispatcher('warn', 'Invalid path worker name during extraction', {
      pathWorkerName,
      pathname,
      requestId,
      operation: 'extract_worker',
      validationError: validation.error,
    })
  }

  log.dispatcher('warn', 'No valid worker name found', {
    hostname,
    pathname,
    requestId,
    operation: 'extract_worker',
  })

  return null
}

/**
 * Get dispatch namespace information
 */
export function getNamespaceInfo(context: Context<{ Bindings: Bindings; Variables: Variables }>) {
  return {
    name: context.env.DISPATCH_NAMESPACE_NAME,
    accountId: context.env.DISPATCH_NAMESPACE_ACCOUNT_ID,
  }
}
