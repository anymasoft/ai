/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * producer.ts
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

import { ScreenshotError, ErrorCodes } from '../utils/errors'
import type { 
  Bindings, 
  ScreenshotQueueMessage, 
  ScreenshotQueueProducerOptions 
} from '../types'

/**
 * Send message to screenshot queue using environment bindings
 */
export async function sendToQueue(
  env: Bindings,
  message: ScreenshotQueueMessage,
  options?: ScreenshotQueueProducerOptions
): Promise<void> {
  try {
    await env.SCREENSHOT_QUEUE.send(message, {
      delaySeconds: options?.delaySeconds
    })
  } catch (error) {
    throw new ScreenshotError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send message to screenshot queue: ${error instanceof Error ? error.message : String(error)}`,
      { message, options, originalError: error }
    )
  }
}

/**
 * Send message to screenshot queue (direct queue object)
 */
export async function sendToQueueDirect(
  queue: Queue<ScreenshotQueueMessage>,
  message: ScreenshotQueueMessage,
  options?: ScreenshotQueueProducerOptions
): Promise<void> {
  try {
    await queue.send(message, {
      delaySeconds: options?.delaySeconds
    })
  } catch (error) {
    throw new ScreenshotError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send message to screenshot queue: ${error instanceof Error ? error.message : String(error)}`,
      { message, options, originalError: error }
    )
  }
}

/**
 * Send batch of messages to screenshot queue
 */
export async function sendBatchToQueue(
  env: Bindings,
  messages: ScreenshotQueueMessage[],
  options?: ScreenshotQueueProducerOptions
): Promise<void> {
  try {
    const sendPromises = messages.map(message =>
      env.SCREENSHOT_QUEUE.send(message, {
        delaySeconds: options?.delaySeconds
      })
    )

    await Promise.all(sendPromises)
  } catch (error) {
    throw new ScreenshotError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send batch to screenshot queue: ${error instanceof Error ? error.message : String(error)}`,
      { messageCount: messages.length, options, originalError: error }
    )
  }
}

/**
 * Send priority message to screenshot queue
 */
export async function sendPriorityMessage(
  env: Bindings,
  message: ScreenshotQueueMessage
): Promise<void> {
  // Set high priority
  const priorityMessage: ScreenshotQueueMessage = {
    ...message,
    metadata: {
      ...message.metadata,
      priority: 10 // Highest priority
    }
  }

  await sendToQueue(env, priorityMessage, {
    delaySeconds: 0 // Process immediately
  })
}

/**
 * Send delayed message to screenshot queue
 */
export async function sendDelayedMessage(
  env: Bindings,
  message: ScreenshotQueueMessage,
  delaySeconds: number
): Promise<void> {
  await sendToQueue(env, message, {
    delaySeconds
  })
}

/**
 * Send message with deduplication
 */
export async function sendDedupedMessage(
  env: Bindings,
  message: ScreenshotQueueMessage,
  deduplicationKey: string
): Promise<void> {
  await sendToQueue(env, message, {
    deduplicationId: deduplicationKey,
    contentBasedDeduplication: false
  })
}

/**
 * Create a screenshot queue message from parameters
 */
export function createScreenshotMessage(
  screenshotId: string,
  params: {
    projectId: string
    planId: string
    orgId: string
    userId: string
    previewUrl?: string
  },
  config?: {
    timeout?: number
    skipSteps?: string[]
    debug?: boolean
  }
): ScreenshotQueueMessage {
  return {
    metadata: {
      screenshotId,
      createdAt: new Date().toISOString(),
      userId: params.userId,
      organizationId: params.orgId,
      version: '1.0.0',
      priority: 5, // Default priority
      retryCount: 0
    },
    params: {
      projectId: params.projectId,
      planId: params.planId,
      orgId: params.orgId,
      userId: params.userId,
      previewUrl: params.previewUrl
    },
    config: config || {
      timeout: 300000, // 5 minutes default
      debug: false
    }
  }
}

/**
 * Generate unique screenshot ID
 */
export function generateScreenshotId(): string {
  return `screenshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Create deduplication key for screenshot requests
 */
export function createDeduplicationKey(
  projectId: string,
  planId: string,
  userId: string
): string {
  return `screenshot:${projectId}:${planId}:${userId}`
}

/**
 * Send screenshot request to queue with automatic ID generation
 */
export async function submitScreenshotRequest(
  env: Bindings,
  params: {
    projectId: string
    planId: string
    orgId: string
    userId: string
    previewUrl?: string
  },
  options?: {
    priority?: boolean
    delaySeconds?: number
    deduplicate?: boolean
    config?: {
      timeout?: number
      skipSteps?: string[]
      debug?: boolean
    }
  }
): Promise<string> {
  const screenshotId = generateScreenshotId()
  const message = createScreenshotMessage(screenshotId, params, options?.config)

  if (options?.priority) {
    await sendPriorityMessage(env, message)
  } else if (options?.deduplicate) {
    const deduplicationKey = createDeduplicationKey(params.projectId, params.planId, params.userId)
    await sendDedupedMessage(env, message, deduplicationKey)
  } else if (options?.delaySeconds) {
    await sendDelayedMessage(env, message, options.delaySeconds)
  } else {
    await sendToQueue(env, message)
  }

  return screenshotId
}
