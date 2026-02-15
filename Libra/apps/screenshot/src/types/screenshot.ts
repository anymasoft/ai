/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot.ts
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
 * Screenshot status enumeration
 */
export enum ScreenshotStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  VALIDATING = 'validating',
  CAPTURING = 'capturing',
  STORING = 'storing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Screenshot parameters passed from queue message
 */
export interface ScreenshotParams {
  projectId: string
  planId: string
  orgId: string
  userId: string
  previewUrl: string
}

/**
 * Screenshot context for step execution
 */
export interface ScreenshotContext {
  /** Unique screenshot identifier */
  screenshotId: string
  /** Environment bindings */
  env: import('./index').Bindings
  /** Screenshot parameters */
  params: ScreenshotParams
  /** Logger instance */
  logger: import('../utils/logger').Logger
  /** Step results for sharing data between steps */
  stepResults?: Record<string, BaseStepResult>
}

// Screenshot state management removed - using simplified approach

/**
 * Base result interface for all steps
 */
export interface BaseStepResult {
  success: boolean
  duration: number
  error?: string
  data?: any
}

/**
 * Validation step result
 */
export interface ValidationResult extends BaseStepResult {
  data?: {
    projectExists: boolean
    hasPermission: boolean
    organizationValid: boolean
    messageHistoryLength?: number
    existingScreenshot?: boolean
    previewUrl?: string
  }
}

/**
 * Sandbox step result
 */
export interface SandboxResult extends BaseStepResult {
  data?: {
    containerId: string
    sandboxUrl: string
    isNewContainer: boolean
    sandbox?: any // Store sandbox reference for next steps
  }
}

/**
 * File sync step result
 */
export interface SyncResult extends BaseStepResult {
  data?: {
    fileCount: number
    syncedFiles: string[]
    skippedFiles: string[]
    syncDuration?: number
  }
}

/**
 * Preview generation step result
 */
export interface PreviewResult extends BaseStepResult {
  data?: {
    previewUrl: string
    isReady: boolean
    warmupTime: number
    baseUrl?: string
  }
}

/**
 * Screenshot capture step result
 */
export interface CaptureResult extends BaseStepResult {
  data?: {
    screenshotDataUrl: string
    captureTime: number
    imageSize: number
    previewUrl?: string
  }
}

/**
 * Storage step result
 */
export interface StorageResult extends BaseStepResult {
  data?: {
    screenshotKey: string
    screenshotUrl: string
    cdnUploadTime: number
  }
}

/**
 * Cleanup step result
 */
export interface CleanupResult extends BaseStepResult {
  data?: {
    cleanedResources: string[]
    sandboxKept: boolean
    cleanupWarnings?: string[]
  }
}

/**
 * Screenshot workflow result
 */
export interface ScreenshotResult {
  /** Whether the screenshot was successful */
  success: boolean
  /** Screenshot URL if successful */
  screenshotUrl?: string
  /** Error message if failed */
  error?: string
  /** Processing duration in milliseconds */
  duration: number
  /** Final status */
  status: ScreenshotStatus
}

/**
 * Screenshot request from API
 */
export interface ScreenshotRequest {
  projectId: string
  planId: string
  orgId: string
  userId: string
  previewUrl?: string
}

/**
 * Screenshot response to API
 */
export interface ScreenshotResponse {
  success: boolean
  screenshotId?: string
  message?: string
  error?: string
}

/**
 * Screenshot status response
 */
export interface ScreenshotStatusResponse {
  screenshotId: string
  status: ScreenshotStatus
  progress: number
  stage: string
  startedAt: string
  completedAt?: string
  error?: string
  screenshotUrl?: string
  duration?: number
}

/**
 * Screenshot step function type
 */
export type ScreenshotStepFunction = (
  context: ScreenshotContext
) => Promise<BaseStepResult>

/**
 * Screenshot step result with metadata
 */
export interface ScreenshotStepResult extends BaseStepResult {
  stepName: string
  startTime: number
  endTime: number
}
