/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auth-middleware.ts
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

import type { Context, Next } from 'hono'
import { validateSession, hasBasicDeployPermission } from '../auth'
import { log, tryCatch } from '@libra/common'
import type { Bindings, Variables } from '../types'

export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const requestId = c.get('requestId') || crypto.randomUUID()
  
  log.deployment('info', 'Starting authentication middleware', {
    requestId,
    operation: 'auth_middleware',
    url: c.req.url,
    method: c.req.method
  })
  
  const [result, error] = await tryCatch(async () => {
    // Validate session
    const session = await validateSession(c)
    
    if (!session) {
      log.deployment('warn', 'Authentication failed - no valid session', {
        requestId,
        operation: 'auth_validation',
        url: c.req.url
      })

      return c.json({
        error: 'Unauthorized',
        message: 'Access denied. Valid session required.',
        requestId
      }, 401)
    }
    
    log.deployment('info', 'Session validated successfully', {
      requestId,
      operation: 'auth_validation',
      userId: session.userId,
      sessionId: session.id
    })

    // Check basic deployment permissions (without quota deduction)
    const hasPermission = await hasBasicDeployPermission(session)

    if (!hasPermission) {
      log.deployment('warn', 'Authentication failed - insufficient permissions', {
        requestId,
        operation: 'permission_check',
        userId: session.userId,
        sessionId: session.id
      })

      return c.json({
        error: 'Forbidden',
        message: 'Insufficient permissions for deployment operations.',
        requestId
      }, 403)
    }

    // Note: Quota checking and deduction is now handled in the workflow's first step
    // to avoid duplicate deductions during retries
    
    // Set session in context - wrap session in the expected format
    c.set('userSession', {
      session: session,
      user: {
        id: session.userId,
        email: '', // Will be populated from session data if available
        name: null
      }
    })
    
    log.deployment('info', 'Authentication completed successfully', {
      requestId,
      operation: 'auth_middleware',
      userId: session.userId,
      sessionId: session.id
    })
    
    await next()
    return null // Indicate successful completion
  })

  if (error) {
    log.deployment('error', 'Authentication middleware error', {
      requestId,
      operation: 'auth_middleware',
      url: c.req.url
    }, error instanceof Error ? error : new Error(String(error)))

    return c.json({
      error: 'Authentication Error',
      message: 'Failed to authenticate request.',
      requestId
    }, 500)
  }

  // If result is a response (401 or 403), return it
  if (result && result !== null) {
    return result
  }
}
