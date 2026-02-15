/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deploy.ts
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
import { eq } from 'drizzle-orm'
import { log } from '@libra/common'
import { project } from '@libra/db'
import { getPostgresDb } from '../database'
import {
  deploymentRequestSchema,
  deploymentResponseSchema,
  errorResponseSchema,
  workflowInstanceQuerySchema
} from '../schemas/deploy'
import type { AppContext, DeploymentParams } from '../types'
import { CommonErrors } from '../utils/error-handler'

/**
 * OpenAPI route definition for deployment endpoint
 */
export const deployRoute = createRoute({
  method: 'post',
  path: '/deploy',
  summary: 'Deploy a project',
  description: 'Create a new deployment workflow instance for a project or get status of existing instance',
  tags: ['Deployment'],
  request: {
    query: workflowInstanceQuerySchema,
    body: {
      content: {
        'application/json': {
          schema: deploymentRequestSchema
        }
      },
      description: 'Deployment configuration (required when creating new deployment)'
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: deploymentResponseSchema
        }
      },
      description: 'Deployment initiated successfully or existing instance status retrieved'
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      },
      description: 'Invalid request parameters'
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
 * Deploy route handler implementation
 */
export const deployHandler = async (c: AppContext) => {
  try {
  const requestId = c.get('requestId') || crypto.randomUUID()
  const url = new URL(c.req.url)
  const instanceId = url.searchParams.get('instanceId')

  log.deployment('info', 'Deploy request received', {
    requestId,
    operation: 'deploy',
    method: c.req.method,
    hasInstanceId: !!instanceId,
    instanceId
  })

  // If instanceId is provided, get existing workflow instance
  if (instanceId) {
    log.deployment('info', 'Getting existing workflow instance', {
      requestId,
      operation: 'get_workflow_instance',
      instanceId
    })

    try {
      const instance = await c.env.DEPLOY_WORKFLOW.get(instanceId)
      const status = await instance.status()

      log.deployment('info', 'Retrieved workflow instance status', {
        requestId,
        operation: 'get_workflow_status',
        instanceId,
        status: status.status
      })

      return c.json({
        success: true,
        id: instanceId,
        details: status
      }, 200)
    } catch (error) {
      log.deployment('error', 'Failed to get workflow instance', {
        requestId,
        operation: 'get_workflow_instance',
        instanceId,
        error: error instanceof Error ? error.message : String(error)
      }, error instanceof Error ? error : new Error(String(error)))

      throw CommonErrors.notFound(`Workflow instance ${instanceId}`)
    }
  }

  // If no instanceId, create new workflow instance
  const body = await c.req.json()
  const { projectId, customDomain, orgId, userId, initFiles, historyMessages } = body

  // Validate required parameters
  if (!projectId || !orgId || !userId) {
    throw CommonErrors.invalidRequest('Missing required parameters: projectId, orgId, userId')
  }

  log.deployment('info', 'Creating new workflow instance', {
    requestId,
    operation: 'create_workflow_instance',
    projectId,
    orgId,
    userId,
    hasCustomDomain: !!customDomain,
    hasInitFiles: !!initFiles,
    hasHistoryMessages: !!historyMessages
  })

  // Create deployment parameters
  const deploymentParams: DeploymentParams = {
    projectId,
    customDomain,
    orgId,
    userId,
    initFiles,
    historyMessages
  }

  try {
    // Create new workflow instance
    const instance = await c.env.DEPLOY_WORKFLOW.create({
      params: deploymentParams
    })

    log.deployment('info', 'Created workflow instance', {
      requestId,
      operation: 'workflow_created',
      instanceId: instance.id,
      projectId
    })

    // Get initial status
    const details = await instance.status()

    log.deployment('info', 'Retrieved initial workflow status', {
      requestId,
      operation: 'initial_workflow_status',
      instanceId: instance.id,
      status: details.status
    })

    // Update database with workflow ID and initial status
    const db = await getPostgresDb(c)
    try {
      await db
        .update(project)
        .set({
          workflowId: instance.id,
          deploymentStatus: 'preparing'
        })
        .where(eq(project.id, projectId))

      log.deployment('info', 'Updated project with workflow ID', {
        requestId,
        operation: 'database_update',
        projectId,
        workflowId: instance.id,
        status: 'preparing'
      })
    } catch (dbError) {
      log.deployment('error', 'Failed to update project with workflow ID', {
        requestId,
        operation: 'database_update',
        projectId,
        workflowId: instance.id,
        error: dbError instanceof Error ? dbError.message : String(dbError)
      }, dbError instanceof Error ? dbError : new Error(String(dbError)))

      // Don't fail the deployment if database update fails
      // The workflow will continue and can be tracked by the workflow ID
    } finally {
      // Clean up database connection
      c.executionCtx.waitUntil(db.$client.end())
    }

    return c.json({
      success: true,
      id: instance.id,
      details
    }, 200)

  } catch (error) {
    log.deployment('error', 'Failed to create workflow instance', {
      requestId,
      operation: 'create_workflow_instance',
      projectId,
      error: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)))

    throw CommonErrors.workflowError(`Failed to create workflow instance: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  } catch (error) {
    // Handle any unexpected errors
    const requestId = c.get('requestId') || crypto.randomUUID()

    log.deployment('error', 'Unexpected error in deploy handler', {
      requestId,
      operation: 'deploy_handler',
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

    if (error instanceof Error && error.message.includes('validation')) {
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
