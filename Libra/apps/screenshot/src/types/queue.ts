/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * queue.ts
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

/**
 * Queue message metadata for tracking and debugging
 */
export interface ScreenshotQueueMessageMetadata {
  /** Unique identifier for this screenshot task */
  screenshotId: string
  /** Timestamp when the message was created */
  createdAt: string
  /** User who initiated the screenshot */
  userId: string
  /** Organization ID for quota and permissions */
  organizationId: string
  /** Message version for compatibility */
  version: string
  /** Priority level (1-10, higher = more priority) */
  priority?: number
  /** Retry count for this message */
  retryCount?: number
  /** Previous error message if this is a retry */
  lastError?: string
}

/**
 * Core screenshot parameters for queue processing
 */
export interface ScreenshotQueueParams {
  /** Project ID to screenshot */
  projectId: string
  /** Plan ID for screenshot identification */
  planId: string
  /** Organization ID for permissions and quota */
  orgId: string
  /** User ID who initiated screenshot */
  userId: string
  /** Optional pre-prepared preview URL */
  previewUrl?: string
}

/**
 * Queue message structure for screenshot requests
 */
export interface ScreenshotQueueMessage {
  /** Message metadata */
  metadata: ScreenshotQueueMessageMetadata
  /** Screenshot parameters */
  params: ScreenshotQueueParams
  /** Optional configuration overrides */
  config?: {
    /** Custom timeout in milliseconds */
    timeout?: number
    /** Skip certain steps (for debugging) */
    skipSteps?: string[]
    /** Enable debug logging */
    debug?: boolean
  }
}

/**
 * Queue batch processing interface
 */
export interface ScreenshotQueueBatch {
  /** Array of messages in this batch */
  messages: Message<ScreenshotQueueMessage>[]
  /** Batch metadata */
  metadata: {
    /** Batch ID for tracking */
    batchId: string
    /** Timestamp when batch was created */
    createdAt: string
    /** Number of messages in batch */
    size: number
  }
}

/**
 * Queue processing result for individual messages
 */
export interface ScreenshotQueueProcessingResult {
  /** Message that was processed */
  messageId: string
  /** Screenshot ID for tracking */
  screenshotId: string
  /** Whether processing was successful */
  success: boolean
  /** Error message if processing failed */
  error?: string
  /** Processing duration in milliseconds */
  duration: number
  /** Final screenshot status */
  status?: string
  /** Screenshot URL if successful */
  screenshotUrl?: string
}

/**
 * Queue batch processing result
 */
export interface ScreenshotQueueBatchResult {
  /** Batch ID that was processed */
  batchId: string
  /** Results for individual messages */
  results: ScreenshotQueueProcessingResult[]
  /** Overall batch success rate */
  successRate: number
  /** Total processing time for batch */
  totalDuration: number
  /** Number of messages that need retry */
  retryCount: number
}

/**
 * Queue producer options for sending messages
 */
export interface ScreenshotQueueProducerOptions {
  /** Delay before processing (in seconds) */
  delaySeconds?: number
  /** Message deduplication ID */
  deduplicationId?: string
  /** Content-based deduplication */
  contentBasedDeduplication?: boolean
}

/**
 * Dead letter queue message with additional context
 */
export interface ScreenshotDLQMessage extends ScreenshotQueueMessage {
  /** Reason why message was sent to DLQ */
  dlqReason: 'max_retries_exceeded' | 'processing_timeout' | 'invalid_message' | 'system_error'
  /** Original queue name */
  originalQueue: string
  /** Final error that caused DLQ placement */
  finalError: string
  /** Total number of retry attempts */
  totalRetries: number
  /** Timestamps of all retry attempts */
  retryHistory: string[]
}
