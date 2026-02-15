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
import { createSandbox } from './steps/sandbox'
import { syncFiles } from './steps/sync'
import { buildProject } from './steps/build'
import { deployToCloudflare } from './steps/deploy'
import { updateDatabaseAndCleanup } from './steps/cleanup'
import { DeploymentStateManager } from './state'
import { createLogger } from '../utils/logger'
import { DeploymentError, ErrorCodes } from '../utils/errors'
import type { 
  Bindings, 
  DeploymentParams, 
  DeploymentResult, 
  DeploymentContext,
  DeploymentStatus 
} from '../types'

/**
 * Queue-based deployment workflow
 * Migrated from the original Workflow-based implementation
 */
export class QueueDeploymentWorkflow {
  private env: Bindings
  private stateManager: DeploymentStateManager
  private logger: ReturnType<typeof createLogger>
  private stepResults: Record<string, any> = {}

  constructor(
    env: Bindings,
    stateManager: DeploymentStateManager,
    logger: ReturnType<typeof createLogger>
  ) {
    this.env = env
    this.stateManager = stateManager
    this.logger = logger
  }

  /**
   * Execute the complete deployment workflow
   */
  async execute(deploymentId: string, params: DeploymentParams): Promise<DeploymentResult> {
    const startTime = Date.now()

    this.logger.info('Starting deployment workflow', {
      deploymentId,
      projectId: params.projectId,
      userId: params.userId,
      organizationId: params.orgId
    })

    // Create deployment context
    const currentState = await this.stateManager.getDeploymentStateByProjectId(params.projectId, deploymentId)
    if (!currentState) {
      throw new Error(`Deployment state not found: ${deploymentId}`)
    }

    const context: DeploymentContext = {
      deploymentId,
      env: this.env,
      params,
      state: currentState,
      logger: this.logger
    }

    try {

      // Step 1: Validate permissions and prepare deployment
      await this.executeStep(
        'validation',
        'Validating project and preparing deployment',
        10,
        context,
        validateAndPrepare
      )

      // Step 2: Create sandbox
      await this.executeStep(
        'sandbox',
        'Creating deployment sandbox',
        25,
        context,
        createSandbox
      )

      // Step 3: Sync files to sandbox
      await this.executeStep(
        'sync',
        'Syncing files to sandbox',
        45,
        context,
        syncFiles
      )

      // Step 4: Build project
      await this.executeStep(
        'build',
        'Building project',
        70,
        context,
        buildProject
      )

      // Step 5: Deploy to Cloudflare Workers
      await this.executeStep(
        'deploy',
        'Deploying to Cloudflare Workers',
        90,
        context,
        deployToCloudflare
      )

      // Step 6: Update database and cleanup
      await this.executeStep(
        'cleanup',
        'Updating database and cleaning up',
        100,
        context,
        updateDatabaseAndCleanup
      )

      // Get final state
      const finalState = await this.stateManager.getDeploymentStateByProjectId(params.projectId, deploymentId)
      const duration = Date.now() - startTime

      // Mark deployment as completed
      await this.stateManager.updateDeploymentStatusByProjectId(
        params.projectId,
        'completed' as DeploymentStatus
      )

      this.logger.info('Deployment workflow completed successfully', {
        deploymentId,
        duration,
        workerUrl: finalState?.stepResults.deploy?.data?.workerUrl
      })

      return {
        success: true,
        deploymentId,
        workerUrl: finalState?.stepResults.deploy?.data?.workerUrl,
        message: 'Project deployed successfully via Queue',
        duration,
        state: finalState!
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error('Deployment workflow failed', {
        deploymentId,
        error: errorMessage,
        duration
      })

      // Attempt to cleanup sandbox if it was created
      await this.cleanupOnFailure(context)

      // Mark deployment as failed - ensure this always happens even if cleanup fails
      try {
        await this.stateManager.updateDeploymentStatusByProjectId(
          params.projectId,
          'failed' as DeploymentStatus
        )
        this.logger.info('Deployment status updated to failed', {
          deploymentId,
          projectId: params.projectId
        })
      } catch (statusError) {
        // Critical: Log but don't throw - we must not prevent error response
        this.logger.error('CRITICAL: Failed to update deployment status to failed', {
          deploymentId,
          projectId: params.projectId,
          error: statusError instanceof Error ? statusError.message : String(statusError)
        })
      }

      const finalState = await this.stateManager.getDeploymentStateByProjectId(params.projectId, deploymentId)

      return {
        success: false,
        deploymentId,
        error: errorMessage,
        message: 'Deployment failed',
        duration,
        state: finalState!
      }
    }
  }

  /**
   * Execute a single deployment step with error handling and state management
   */
  private async executeStep<T>(
    stepName: string,
    description: string,
    _progressPercentage: number,
    context: DeploymentContext,
    stepFunction: (context: DeploymentContext) => Promise<T>
  ): Promise<T> {
    const stepStartTime = Date.now()

    this.logger.info(`Starting step: ${stepName}`, {
      deploymentId: context.deploymentId,
      step: stepName,
      description
    })

    // Update deployment status
    await this.stateManager.updateDeploymentStatusByProjectId(
      context.params.projectId,
      this.getStatusForStep(stepName)
    )

    try {
      // Update context with latest step results before executing
      context.state.stepResults = { ...context.state.stepResults, ...this.stepResults }

      // Execute the step
      const result = await stepFunction(context)
      const stepDuration = Date.now() - stepStartTime

      this.logger.info(`Step completed: ${stepName}`, {
        deploymentId: context.deploymentId,
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

      // Save to memory for immediate access by subsequent steps
      this.stepResults[stepName] = result

      // Also save to state manager for logging
      await this.stateManager.saveStepResult(context.deploymentId, stepName, stepResult)

      return result

    } catch (error) {
      const stepDuration = Date.now() - stepStartTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      this.logger.error(`Step failed: ${stepName}`, {
        deploymentId: context.deploymentId,
        step: stepName,
        error: errorMessage,
        duration: stepDuration
      })

      // Save step error to state
      await this.stateManager.saveStepResult(context.deploymentId, stepName, {
        success: false,
        duration: stepDuration,
        error: errorMessage
      })

      // Wrap and re-throw error
      throw new DeploymentError(
        500,
        ErrorCodes.DEPLOYMENT_STEP_FAILED,
        `${stepName} failed: ${errorMessage}`,
        { step: stepName, originalError: error }
      )
    }
  }

  /**
   * Map step names to deployment statuses
   */
  private getStatusForStep(stepName: string): DeploymentStatus {
    const statusMap: Record<string, DeploymentStatus> = {
      'validation': 'validating' as DeploymentStatus,
      'sandbox': 'creating_sandbox' as DeploymentStatus,
      'sync': 'syncing_files' as DeploymentStatus,
      'build': 'building' as DeploymentStatus,
      'deploy': 'deploying' as DeploymentStatus,
      'cleanup': 'updating_database' as DeploymentStatus
    }

    return statusMap[stepName] || 'pending' as DeploymentStatus
  }

  /**
   * Cleanup resources when deployment fails
   */
  private async cleanupOnFailure(context: DeploymentContext): Promise<void> {
    try {
      // Check if sandbox was created
      const sandboxResult = context.state.stepResults.sandbox
      if (sandboxResult?.data?.sandboxId) {
        const sandboxId = sandboxResult.data.sandboxId

        this.logger.info('Attempting to cleanup sandbox after deployment failure', {
          deploymentId: context.deploymentId,
          sandboxId
        })

        // Import terminateDeploymentSandbox function
        const { terminateDeploymentSandbox } = await import('../utils/deployment')

        const cleanupSuccess = await terminateDeploymentSandbox(sandboxId, {
          timeoutMs: 30000 // 30 seconds timeout
        })

        if (cleanupSuccess) {
          this.logger.info('Sandbox cleaned up successfully after failure', {
            deploymentId: context.deploymentId,
            sandboxId
          })
        } else {
          this.logger.warn('Failed to cleanup sandbox after failure', {
            deploymentId: context.deploymentId,
            sandboxId
          })
        }
      }
    } catch (error) {
      this.logger.error('Error during failure cleanup', {
        deploymentId: context.deploymentId,
        error: error instanceof Error ? error.message : String(error)
      })
      // Don't throw error for cleanup operations
    }
  }
}
