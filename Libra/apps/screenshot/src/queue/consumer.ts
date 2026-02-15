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
import { ScreenshotWorkflow } from '../screenshot/workflow'
import { createLogger, generateBatchId } from '../utils/logger'
import type {
  Bindings,
  ScreenshotQueueMessage,
  ScreenshotQueueProcessingResult,
  ScreenshotQueueBatchResult,
  ScreenshotStatus,
  ScreenshotQueueParams,
  ScreenshotParams
} from '../types'

/**
 * Convert ScreenshotQueueParams to ScreenshotParams with validation
 */
function convertQueueParamsToScreenshotParams(queueParams: ScreenshotQueueParams): ScreenshotParams {
  if (!queueParams.previewUrl) {
    throw new Error('previewUrl is required for screenshot processing')
  }

  return {
    projectId: queueParams.projectId,
    planId: queueParams.planId,
    orgId: queueParams.orgId,
    userId: queueParams.userId,
    previewUrl: queueParams.previewUrl
  }
}

/**
 * Handle a batch of queue messages for screenshot processing
 */
export async function handleQueueBatch(
  batch: MessageBatch<ScreenshotQueueMessage>,
  env: Bindings,
  ctx: ExecutionContext
): Promise<ScreenshotQueueBatchResult> {
  const logger = createLogger(env, 'screenshot-queue')
  const startTime = Date.now()
  const batchId = generateBatchId()

  logger.info('Starting screenshot queue batch processing', {
    batchSize: batch.messages.length,
    batchId,
    timestamp: new Date().toISOString()
  })

  // Process messages sequentially (Cloudflare Workers is single-threaded)
  const results: ScreenshotQueueProcessingResult[] = []

  // Process each message one by one
  for (const message of batch.messages) {
    const messageId = message.id
    const screenshotId = message.body.metadata.screenshotId

    logger.info('Processing queue message', {
      batchId,
      messageId,
      screenshotId,
      projectId: message.body.params.projectId
    })

    try {
      const result = await processQueueMessage(message, env, ctx, logger)
      results.push(result)

      // Acknowledge successful message
      if (result.success) {
        logger.info('Message processed successfully', {
          batchId,
          messageId,
          screenshotId,
          duration: result.duration
        })
        message.ack()
      } else {
        // Handle failed message - retry or send to DLQ
        const retryCount = message.body.metadata.retryCount || 0
        logger.warn('Message processing failed', {
          batchId,
          messageId,
          screenshotId,
          error: result.error,
          retryCount
        })

        if (retryCount < 2) {
          logger.info('Retrying message', { batchId, messageId, screenshotId, retryCount })
          message.retry()
        } else {
          logger.error('Message exceeded max retries, sending to DLQ', {
            batchId,
            messageId,
            screenshotId,
            retryCount
          })
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
        screenshotId: message?.body.metadata.screenshotId || 'unknown',
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
  const successRate = results.length > 0 ? successCount / results.length : 0
  const retryCount = results.filter(r => !r.success).length

  const batchResult: ScreenshotQueueBatchResult = {
    batchId: generateBatchId(),
    results,
    successRate,
    totalDuration,
    retryCount
  }

  logger.info('Screenshot queue batch processing completed', {
    batchResult,
    successCount,
    failureCount: results.length - successCount
  })

  return batchResult
}

/**
 * Process a single queue message
 */
async function processQueueMessage(
  message: Message<ScreenshotQueueMessage>,
  env: Bindings,
  _ctx: ExecutionContext,
  logger: ReturnType<typeof createLogger>
): Promise<ScreenshotQueueProcessingResult> {
  const startTime = Date.now()
  const { metadata, params } = message.body
  const screenshotId = metadata.screenshotId

  try {
    logger.info('Processing screenshot message', {
      screenshotId,
      projectId: params.projectId,
      planId: params.planId,
      userId: params.userId,
      organizationId: params.orgId
    })

    // Create screenshot workflow
    const workflow = new ScreenshotWorkflow(env, logger)

    // Convert queue params to screenshot params with validation
    const screenshotParams = convertQueueParamsToScreenshotParams(params)

    // Execute screenshot workflow directly - Cloudflare Workers has built-in execution time limits
    // No need for custom timeout as Workers will terminate automatically if CPU time is exceeded
    const result = await workflow.execute(screenshotId, screenshotParams)

    const duration = Date.now() - startTime

    logger.info('Screenshot completed successfully', {
      screenshotId,
      duration,
      screenshotUrl: result.screenshotUrl
    })

    return {
      messageId: message.id,
      screenshotId,
      success: true,
      duration,
      status: result.status,
      screenshotUrl: result.screenshotUrl
    }

  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Screenshot processing failed', {
      screenshotId,
      duration,
      error: errorMessage
    }, error instanceof Error ? error : undefined)

    // Screenshot processing failed - error already logged

    return {
      messageId: message.id,
      screenshotId,
      success: false,
      error: errorMessage,
      duration,
      status: 'failed'
    }
  }
}

/**
 * Send message to dead letter queue
 */
async function sendToDLQ(
  message: Message<ScreenshotQueueMessage>,
  env: Bindings,
  error: Error
): Promise<void> {
  try {
    const dlqMessage = {
      ...message.body,
      dlqReason: 'max_retries_exceeded' as const,
      originalQueue: env.SCREENSHOT_QUEUE_NAME || 'screenshot-queue',
      finalError: error.message,
      totalRetries: (message.body.metadata.retryCount || 0) + 1,
      retryHistory: [new Date().toISOString()]
    }

    await env.SCREENSHOT_DLQ.send(dlqMessage)
  } catch (dlqError) {
  }
}
