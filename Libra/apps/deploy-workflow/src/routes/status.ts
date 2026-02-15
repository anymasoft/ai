/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status.ts
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

import { createRoute } from '@hono/zod-openapi'
import { log } from '@libra/common'
import {
  deploymentStatusQuerySchema,
  deploymentStatusResponseSchema,
  errorResponseSchema
} from '../schemas/deploy'
import type { AppContext } from '../types'
import { CommonErrors } from '../utils/error-handler'

/**
 * OpenAPI route definition for deployment status endpoint
 */
export const statusRoute = createRoute({
  method: 'get',
  path: '/deploy-status',
  summary: 'Get deployment status',
  description: 'Get the status of a deployment workflow instance',
  tags: ['Deployment'],
  request: {
    query: deploymentStatusQuerySchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: deploymentStatusResponseSchema
        }
      },
      description: 'Deployment status retrieved successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      },
      description: 'Missing or invalid instance ID'
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      },
      description: 'Workflow instance not found'
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
})

/**
 * Status route handler implementation
 */
export const statusHandler = async (c: AppContext) => {
  try {
  const requestId = c.get('requestId') || crypto.randomUUID()
  const url = new URL(c.req.url)
  const instanceId = url.searchParams.get('instanceId')

  log.deployment('info', 'Deploy status request received', {
    requestId,
    operation: 'deploy_status',
    instanceId
  })

  if (!instanceId) {
    throw CommonErrors.invalidRequest('Missing required parameter: instanceId')
  }

  log.deployment('info', 'Getting workflow instance status', {
    requestId,
    operation: 'get_workflow_status',
    instanceId
  })

  try {
    // Get workflow instance and its status
    const instance = await c.env.DEPLOY_WORKFLOW.get(instanceId)
    const status = await instance.status()

    log.deployment('info', 'Retrieved workflow status', {
      requestId,
      operation: 'workflow_status_retrieved',
      instanceId,
      status: status.status
    })

    return c.json({
      status
    }, 200)

  } catch (error) {
    log.deployment('error', 'Failed to get workflow status', {
      requestId,
      operation: 'get_workflow_status',
      instanceId,
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)))

    throw CommonErrors.notFound(`Workflow instance ${instanceId}`)
  }
  } catch (error) {
    // Handle any unexpected errors
    const requestId = c.get('requestId') || crypto.randomUUID()

    log.deployment('error', 'Unexpected error in status handler', {
      requestId,
      operation: 'status_handler',
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)))

    // Return appropriate error response based on error type
    if (error instanceof Error && error.message.includes('not found')) {
      return c.json({
        success: false,
        error: 'Resource not found',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId
      }, 404)
    }

    if (error instanceof Error && error.message.includes('Missing required parameter')) {
      return c.json({
        success: false,
        error: 'Validation error',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
}
