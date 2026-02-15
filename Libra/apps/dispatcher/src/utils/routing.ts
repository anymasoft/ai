/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * routing.ts
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
import { isSupportedDomain, extractSubdomain, isValidWorkerSubdomain } from '../config/domains'
import { log } from '@libra/common'

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

export interface RouteInfo {
  workerName: string | null
  strategy: 'subdomain' | 'path' | 'none'
  originalUrl: string
  targetPath: string
}

/**
 * Parse routing information from request (simplified for Solution A)
 */
export function parseRouteInfo(context: Context<{ Bindings: Bindings; Variables: Variables }>): RouteInfo {
  const url = new URL(context.req.url)
  const hostname = url.hostname
  const pathname = url.pathname
  const requestId = context.get('requestId') || crypto.randomUUID()

  log.dispatcher('info', 'Starting route parsing', {
    hostname,
    pathname,
    requestId,
    operation: 'route_parsing'
  })

  let workerName: string | null = null
  let strategy: RouteInfo['strategy'] = 'none'
  let targetPath = pathname

  // Primary strategy: Subdomain-based routing (core of Solution A)
  if (isSupportedDomain(hostname)) {
    const subdomain = extractSubdomain(hostname)
    if (subdomain) {
      const validation = isValidWorkerSubdomain(subdomain)
      if (validation.valid) {
        workerName = subdomain
        strategy = 'subdomain'
        // For subdomain routing, the entire path is forwarded
        targetPath = pathname

        log.dispatcher('info', 'Subdomain routing resolved successfully', {
          workerName: subdomain,
          hostname,
          targetPath,
          requestId,
          operation: 'route_parsing',
          strategy: 'subdomain'
        })
      } else {
        log.dispatcher('warn', 'Invalid subdomain found during route parsing', {
          subdomain,
          hostname,
          requestId,
          operation: 'route_parsing',
          validationError: validation.error
        })
      }
    }
  } else {
    log.dispatcher('warn', 'Unsupported domain in route parsing', {
      hostname,
      requestId,
      operation: 'route_parsing'
    })
  }

  // Fallback strategy: Path-based routing (for API endpoints)
  if (!workerName) {
    const pathMatch = pathname.match(/^\/(?:api\/)?dispatch\/([^\/]+)(.*)$/)
    if (pathMatch?.[1]) {
      const pathWorkerName = pathMatch[1]
      const validation = isValidWorkerSubdomain(pathWorkerName)
      if (validation.valid) {
        workerName = pathWorkerName
        strategy = 'path'
        // Remove the dispatch prefix from the target path
        targetPath = pathMatch[2] || '/'

        log.dispatcher('info', 'Path routing resolved successfully', {
          workerName: pathWorkerName,
          pathname,
          targetPath,
          requestId,
          operation: 'route_parsing',
          strategy: 'path'
        })
      } else {
        log.dispatcher('warn', 'Invalid path worker name during route parsing', {
          pathWorkerName,
          pathname,
          requestId,
          operation: 'route_parsing',
          validationError: validation.error
        })
      }
    }
  }

  const routeInfo = {
    workerName,
    strategy,
    originalUrl: context.req.url,
    targetPath
  }

  if (!workerName) {
    log.dispatcher('warn', 'No worker name resolved from route', {
      hostname,
      pathname,
      requestId,
      operation: 'route_parsing',
      strategy: 'none'
    })
  } else {
    log.dispatcher('info', 'Route parsing completed successfully', {
      workerName,
      strategy,
      targetPath,
      requestId,
      operation: 'route_parsing'
    })
  }

  return routeInfo
}

/**
 * Validate worker name format (delegated to domain config)
 * @deprecated Use isValidWorkerSubdomain from domains config instead
 */
export function validateWorkerName(workerName: string): { valid: boolean; error?: string } {
  return isValidWorkerSubdomain(workerName)
}

/**
 * Create a new request with modified URL for the target worker
 */
export function createWorkerRequest(originalRequest: Request, routeInfo: RouteInfo): Request {
  const originalUrl = new URL(originalRequest.url)
  
  log.dispatcher('info', 'Creating worker request', {
    workerName: routeInfo.workerName,
    operation: 'create_worker_request',
    strategy: routeInfo.strategy,
    originalPath: originalUrl.pathname,
    targetPath: routeInfo.targetPath,
    method: originalRequest.method
  })
  
  // Create new URL with the target path
  const newUrl = new URL(originalUrl)
  newUrl.pathname = routeInfo.targetPath
  
  // Clean up URL parameters (no longer needed for simplified routing)
  
  // Create new request with modified URL
  const newRequest = new Request(newUrl.toString(), {
    method: originalRequest.method,
    headers: originalRequest.headers,
    body: originalRequest.body,
    // @ts-ignore - duplex is needed for streaming
    duplex: 'half'
  })
  
  // Add routing metadata headers
  newRequest.headers.set('X-Original-URL', originalRequest.url)
  newRequest.headers.set('X-Routing-Strategy', routeInfo.strategy)
  if (routeInfo.workerName) {
    newRequest.headers.set('X-Target-Worker', routeInfo.workerName)
  }
  
  log.dispatcher('info', 'Worker request created successfully', {
    workerName: routeInfo.workerName,
    operation: 'create_worker_request',
    newUrl: newUrl.toString(),
    headers: {
      'X-Original-URL': originalRequest.url,
      'X-Routing-Strategy': routeInfo.strategy,
      'X-Target-Worker': routeInfo.workerName || 'none'
    }
  })
  
  return newRequest
}
