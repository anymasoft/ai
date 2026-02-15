/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workflow.ts
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

import { validateAndPrepare } from './steps/validate'
import { captureScreenshot } from './steps/capture'
import { storeScreenshot } from './steps/storage'

import { createLogger } from '../utils/logger'
import { ScreenshotError, ErrorCodes } from '../utils/errors'
import type {
  Bindings,
  ScreenshotParams,
  ScreenshotResult,
  ScreenshotContext,
  ScreenshotStatus,
  ScreenshotStepFunction,
  BaseStepResult
} from '../types'

/**
 * Screenshot workflow orchestrator
 */
export class ScreenshotWorkflow {
  private env: Bindings
  private logger: ReturnType<typeof createLogger>
  private stepResults: Record<string, BaseStepResult> = {}

  constructor(
    env: Bindings,
    logger: ReturnType<typeof createLogger>
  ) {
    this.env = env
    this.logger = logger.child({ component: 'screenshot-workflow' })
  }

  /**
   * Execute the URL-based screenshot workflow
   */
  async execute(screenshotId: string, params: ScreenshotParams): Promise<ScreenshotResult> {
    const startTime = Date.now()

    this.logger.info('Starting URL-based screenshot workflow', {
      screenshotId,
      projectId: params.projectId,
      planId: params.planId,
      userId: params.userId,
      organizationId: params.orgId,
      previewUrl: params.previewUrl
    })

    // Validate that previewUrl is provided
    if (!params.previewUrl) {
      throw new ScreenshotError(
        400,
        ErrorCodes.INVALID_REQUEST,
        'previewUrl is required for screenshot service'
      )
    }

    // Create screenshot context
    const context: ScreenshotContext = {
      screenshotId,
      env: this.env,
      params,
      logger: this.logger,
      stepResults: {}
    }

    try {

      // Step 1: Validate permissions and prepare screenshot
      await this.executeStep(
        'validation',
        'Validating project and preparing screenshot',
        25,
        context,
        validateAndPrepare
      )

      // Step 2: Capture screenshot from URL
      await this.executeStep(
        'capture',
        'Capturing screenshot from URL',
        70,
        context,
        captureScreenshot
      )

      // Step 3: Store screenshot to CDN
      await this.executeStep(
        'storage',
        'Storing screenshot to CDN',
        100,
        context,
        storeScreenshot
      )

      // Screenshot completed successfully

      const duration = Date.now() - startTime
      const screenshotUrl = this.stepResults.storage?.data?.screenshotUrl

      this.logger.info('Screenshot workflow completed successfully', {
        screenshotId,
        duration,
        screenshotUrl
      })

      return {
        success: true,
        screenshotUrl,
        duration,
        status: 'completed' as ScreenshotStatus
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error('Screenshot workflow failed', {
        screenshotId,
        duration,
        error: errorMessage,
        stepResults: this.stepResults
      }, error instanceof Error ? error : undefined)

      // Screenshot workflow failed

      return {
        success: false,
        error: errorMessage,
        duration,
        status: 'failed' as ScreenshotStatus
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    stepName: string,
    stepDescription: string,
    progressPercentage: number,
    context: ScreenshotContext,
    stepFunction: ScreenshotStepFunction
  ): Promise<void> {
    const stepStartTime = Date.now()

    this.logger.info(`Starting step: ${stepName}`, {
      screenshotId: context.screenshotId,
      step: stepName,
      description: stepDescription,
      progress: progressPercentage
    })

    try {
      // Update context with latest step results before executing
      if (context.stepResults) {
        context.stepResults = { ...context.stepResults, ...this.stepResults }
      }

      // Execute the step
      const result = await stepFunction(context)
      const stepDuration = Date.now() - stepStartTime

      this.logger.info(`Step completed: ${stepName}`, {
        screenshotId: context.screenshotId,
        step: stepName,
        duration: stepDuration
      })

      // Save step result to state
      // Extract data if result has a data property (for step results), otherwise use result directly
      const stepData = (result as any)?.data ? (result as any).data : result
      const stepResult = {
        success: true,
        duration: stepDuration,
        data: stepData
      }

      this.stepResults[stepName] = stepResult

    } catch (error) {
      const stepDuration = Date.now() - stepStartTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Step failed: ${stepName}`, {
        screenshotId: context.screenshotId,
        step: stepName,
        duration: stepDuration,
        error: errorMessage
      }, error instanceof Error ? error : undefined)

      // Save failed step result
      const stepResult = {
        success: false,
        duration: stepDuration,
        error: errorMessage
      }

      this.stepResults[stepName] = stepResult

      // Re-throw to stop workflow
      throw new ScreenshotError(
        500,
        ErrorCodes.INTERNAL_ERROR,
        `Step '${stepName}' failed: ${errorMessage}`,
        { step: stepName, originalError: error }
      )
    }
  }

}
