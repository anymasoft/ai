/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * consumer.ts
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

import { eq } from 'drizzle-orm'
import { project, getDbForHono } from '@libra/db'
import { QueueDeploymentWorkflow } from '../deployment/workflow'
import { DeploymentStateManager } from '../deployment/state'
import { createLogger } from '../utils/logger'
import type {
  Bindings,
  QueueMessage,
  QueueProcessingResult,
  QueueBatchResult,
  DeploymentStatus
} from '../types'

/**
 * Handle a batch of queue messages for deployment processing
 */
export async function handleQueueBatch(
  batch: MessageBatch<QueueMessage>,
  env: Bindings,
  ctx: ExecutionContext
): Promise<QueueBatchResult> {
  const logger = createLogger(env)
  const stateManager = new DeploymentStateManager(env)
  const startTime = Date.now()

  logger.info('Starting queue batch processing', {
    batchSize: batch.messages.length,
    batchId: generateBatchId(),
    timestamp: new Date().toISOString()
  })

  // Process messages sequentially (Cloudflare Workers is single-threaded)
  const results: QueueProcessingResult[] = []

  // Process each message one by one
  for (const message of batch.messages) {
    try {
      const result = await processQueueMessage(message, env, ctx, stateManager, logger)
      results.push(result)

      // Acknowledge successful message
      if (result.success) {
        message.ack()
      } else {
        // Handle failed message - retry or send to DLQ
        const retryCount = message.body.metadata.retryCount || 0
        if (retryCount < 2) {
          message.retry()
        } else {
          // Send to dead letter queue
          await sendToDLQ(message, env, new Error(result.error || 'Unknown error'))
          message.ack()
        }
      }
    } catch (error) {
      logger.error('Message processing failed', {
        messageId: message?.id,
        error: error instanceof Error ? error.message : String(error)
      })

      results.push({
        messageId: message?.id || 'unknown',
        deploymentId: message?.body.metadata.deploymentId || 'unknown',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      })

      // Retry or send to DLQ based on retry count
      const retryCount = message.body.metadata.retryCount || 0
      if (retryCount < 2) {
        message.retry()
      } else {
        // Send to dead letter queue
        await sendToDLQ(message, env, error instanceof Error ? error : new Error(String(error)))
        message.ack()
      }
    }
  }

  const totalDuration = Date.now() - startTime
  const successCount = results.filter(r => r.success).length
  const successRate = successCount / results.length

  const batchResult: QueueBatchResult = {
    batchId: generateBatchId(),
    results,
    successRate,
    totalDuration,
    retryCount: results.filter(r => !r.success).length
  }

  logger.info('Queue batch processing completed', {
    ...batchResult,
    timestamp: new Date().toISOString()
  })

  return batchResult
}

/**
 * Process a single queue message
 */
async function processQueueMessage(
  message: Message<QueueMessage>,
  env: Bindings,
  _ctx: ExecutionContext,
  stateManager: DeploymentStateManager,
  logger: ReturnType<typeof createLogger>
): Promise<QueueProcessingResult> {
  const startTime = Date.now()
  const { metadata, params } = message.body
  const deploymentId = metadata.deploymentId

  try {
    logger.info('Processing deployment message', {
      deploymentId,
      projectId: params.projectId,
      userId: params.userId,
      organizationId: params.orgId
    })

    // Initialize deployment state
    await stateManager.initializeDeployment(deploymentId, params)

    // Create deployment workflow
    const workflow = new QueueDeploymentWorkflow(env, stateManager, logger)

    // Execute deployment directly - Cloudflare Workers has built-in execution time limits
    // No need for custom timeout as Workers will terminate automatically if CPU time is exceeded
    const result = await workflow.execute(deploymentId, params)

    const duration = Date.now() - startTime

    logger.info('Deployment completed successfully', {
      deploymentId,
      duration,
      workerUrl: (result as any).workerUrl
    })

    return {
      messageId: message.id,
      deploymentId,
      success: true,
      duration,
      status: 'completed'
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Deployment failed', {
      deploymentId,
      error: errorMessage,
      duration
    })

    // Update deployment state to failed - this is critical for preventing stuck deployments
    try {
      await stateManager.updateDeploymentStatusByProjectId(
        params.projectId,
        'failed' as DeploymentStatus
      )
      logger.info('Deployment status updated to failed after error', {
        deploymentId,
        projectId: params.projectId
      })
    } catch (stateError) {
      // CRITICAL: This should never fail, but if it does, we must log it prominently
      logger.error('CRITICAL: Failed to update deployment state to failed - deployment may be stuck', {
        deploymentId,
        projectId: params.projectId,
        originalError: errorMessage,
        stateUpdateError: stateError instanceof Error ? stateError.message : String(stateError)
      })

      // Try one more time with a simpler approach
      try {
        const db = await getDbForHono({ env: (stateManager as any).env } as any)
        await db.update(project).set({ deploymentStatus: 'failed' }).where(eq(project.id, params.projectId))
        logger.info('Deployment status updated to failed on retry', {
          deploymentId,
          projectId: params.projectId
        })
      } catch (retryError) {
        logger.error('CRITICAL: Final attempt to update deployment status failed', {
          deploymentId,
          projectId: params.projectId,
          retryError: retryError instanceof Error ? retryError.message : String(retryError)
        })
      }
    }

    return {
      messageId: message.id,
      deploymentId,
      success: false,
      error: errorMessage,
      duration,
      status: 'failed'
    }
  }
}

/**
 * Send failed message to dead letter queue
 */
async function sendToDLQ(
  message: Message<QueueMessage>,
  env: Bindings,
  error: any
): Promise<void> {
  try {
    const dlqMessage = {
      ...message.body,
      dlqReason: 'max_retries_exceeded' as const,
      originalQueue: env.DEPLOYMENT_QUEUE_NAME || 'deployment-queue',
      finalError: error instanceof Error ? error.message : String(error),
      totalRetries: (message.body.metadata.retryCount || 0) + 1,
      retryHistory: [new Date().toISOString()]
    }

    await env.DEPLOYMENT_DLQ.send(dlqMessage)
  } catch (dlqError) {
    // Create a temporary logger for this error since we don't have access to the main logger here
    const tempLogger = createLogger(env)
    tempLogger.error('Failed to send message to DLQ', {
      originalMessageId: message.id,
      deploymentId: message.body.metadata.deploymentId,
      error: dlqError instanceof Error ? dlqError.message : String(dlqError)
    })
  }
}

/**
 * Generate a unique batch ID
 */
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
