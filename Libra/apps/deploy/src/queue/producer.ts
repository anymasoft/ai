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

import { DeploymentError, ErrorCodes } from '../utils/errors'
import type { Bindings, QueueMessage, QueueProducerOptions } from '../types'

/**
 * Send message to deployment queue using environment bindings
 */
export async function sendToQueue(
  env: Bindings,
  message: QueueMessage,
  options?: QueueProducerOptions
): Promise<void> {
  try {
    await env.DEPLOYMENT_QUEUE.send(message, {
      delaySeconds: options?.delaySeconds
    })
  } catch (error) {
    throw new DeploymentError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send message to queue: ${error instanceof Error ? error.message : String(error)}`,
      { message, options, originalError: error }
    )
  }
}

/**
 * Send message to deployment queue (direct queue object)
 */
export async function sendToQueueDirect(
  queue: Queue<QueueMessage>,
  message: QueueMessage,
  options?: QueueProducerOptions
): Promise<void> {
  try {
    await queue.send(message, {
      delaySeconds: options?.delaySeconds
    })
  } catch (error) {
    throw new DeploymentError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send message to queue: ${error instanceof Error ? error.message : String(error)}`,
      { message, options, originalError: error }
    )
  }
}

/**
 * Send batch of messages to deployment queue
 */
export async function sendBatchToQueue(
  env: Bindings,
  messages: QueueMessage[],
  options?: QueueProducerOptions
): Promise<void> {
  try {
    const sendPromises = messages.map(message =>
      env.DEPLOYMENT_QUEUE.send(message, {
        delaySeconds: options?.delaySeconds
      })
    )

    await Promise.all(sendPromises)
  } catch (error) {
    throw new DeploymentError(
      500,
      ErrorCodes.QUEUE_SEND_FAILED,
      `Failed to send batch to queue: ${error instanceof Error ? error.message : String(error)}`,
      { messageCount: messages.length, options, originalError: error }
    )
  }
}

/**
 * Send priority message to deployment queue
 */
export async function sendPriorityMessage(
  env: Bindings,
  message: QueueMessage
): Promise<void> {
  // Set high priority
  const priorityMessage: QueueMessage = {
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
 * Send delayed message to deployment queue
 */
export async function sendDelayedMessage(
  env: Bindings,
  message: QueueMessage,
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
  message: QueueMessage,
  deduplicationKey: string
): Promise<void> {
  await sendToQueue(env, message, {
    deduplicationId: deduplicationKey,
    contentBasedDeduplication: false
  })
}
