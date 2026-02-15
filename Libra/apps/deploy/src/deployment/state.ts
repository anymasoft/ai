/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * state.ts
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

import { project, getDbForHono } from '@libra/db'
import { eq } from 'drizzle-orm'
import { createLogger } from '../utils/logger'
import type {
  Bindings,
  DeploymentState,
  DeploymentStatus,
  DeploymentParams,
  DeploymentStepResult
} from '../types'

// Map deployment statuses to project deployment statuses
const PROJECT_STATUS_MAP: Record<DeploymentStatus, string> = {
  'pending': 'preparing',
  'validating': 'preparing',
  'creating_sandbox': 'preparing',
  'syncing_files': 'deploying',
  'building': 'deploying',
  'deploying': 'deploying',
  'updating_database': 'deploying',
  'completed': 'deployed',
  'failed': 'failed',
  'cancelled': 'failed'
}

/**
 * Deployment state manager
 * Uses project.deploymentStatus field instead of R2 storage
 */
export class DeploymentStateManager {
  private env: Bindings
  private logger: ReturnType<typeof createLogger>

  constructor(env: Bindings) {
    this.env = env
    this.logger = createLogger(env)
  }

  /**
   * Initialize a new deployment state
   */
  async initializeDeployment(_deploymentId: string, params: DeploymentParams): Promise<void> {
    const db = await getDbForHono({ env: this.env } as any)

    // Store deployment ID in project for mapping
    // Update project deployment status to preparing
    await db.update(project)
      .set({
        deploymentStatus: 'preparing',
        // Store the deployment ID in a field for mapping (if available)
        // For now, we'll use the updatedAt field to track deployment time
        updatedAt: new Date().toISOString()
      })
      .where(eq(project.id, params.projectId))
  }

  /**
   * Get current deployment state by project ID
   * Creates a mock state based on project's deploymentStatus
   */
  async getDeploymentStateByProjectId(projectId: string, deploymentId: string): Promise<DeploymentState | null> {
    try {
      const db = await getDbForHono({ env: this.env } as any)
      const projectData = await db.select().from(project)
        .where(eq(project.id, projectId))
        .limit(1)

      if (!projectData?.[0]) {
        return null
      }

      const proj = projectData[0]

      // Create a mock deployment state based on project status
      const state: DeploymentState = {
        id: deploymentId,
        status: this.mapProjectStatusToDeploymentStatus(proj.deploymentStatus),
        progress: this.getProgressFromStatus(proj.deploymentStatus),
        stage: this.getStageFromStatus(proj.deploymentStatus),
        startedAt: proj.updatedAt || new Date().toISOString(),
        completedAt: proj.deploymentStatus === 'deployed' || proj.deploymentStatus === 'failed'
          ? proj.updatedAt || undefined
          : undefined,
        error: proj.deploymentStatus === 'failed' ? 'Deployment failed' : undefined,
        stepResults: {},
        config: {
          projectId: proj.id,
          workerName: `${proj.id}-worker`,
          customDomain: proj.customDomain || undefined,
          template: 'vite',
          timeout: 600000
        },
        metadata: {
          userId: proj.userId,
          organizationId: proj.organizationId,
          createdAt: proj.createdAt || new Date().toISOString(),
          updatedAt: proj.updatedAt || new Date().toISOString(),
          version: '1.0.0'
        }
      }

      return state

    } catch (error) {
      this.logger.error('Failed to get deployment state', {
        projectId,
        deploymentId,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Save complete deployment state
   * Updates project's deploymentStatus field
   */
  async saveDeploymentState(state: DeploymentState): Promise<void> {
    try {
      const db = await getDbForHono({ env: this.env } as any)
      const projectStatus = PROJECT_STATUS_MAP[state.status] || 'preparing'

      await db.update(project)
        .set({
          deploymentStatus: projectStatus as any,
          updatedAt: new Date().toISOString()
        })
        .where(eq(project.id, state.config.projectId))

    } catch (error) {
      this.logger.error('Failed to save deployment state', {
        deploymentId: state.id,
        projectId: state.config.projectId,
        status: state.status,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`Failed to save deployment state: ${error}`)
    }
  }

  /**
   * Update deployment status by project ID (more direct approach)
   */
  async updateDeploymentStatusByProjectId(
    projectId: string,
    status: DeploymentStatus
  ): Promise<void> {
    try {
      const db = await getDbForHono({ env: this.env } as any)
      const projectStatus = PROJECT_STATUS_MAP[status] || 'preparing'

      await db.update(project)
        .set({
          deploymentStatus: projectStatus as any,
          updatedAt: new Date().toISOString()
        })
        .where(eq(project.id, projectId))

    } catch (error) {
      this.logger.error('Failed to update deployment status', {
        projectId,
        status,
        error: error instanceof Error ? error.message : String(error)
      })
      throw new Error(`Failed to update deployment status: ${error}`)
    }
  }

  /**
   * Save step result to deployment state
   * Simplified - just logs the step completion
   */
  async saveStepResult(
    deploymentId: string,
    stepName: string,
    result: DeploymentStepResult
  ): Promise<void> {
    // For now, just log the step completion
    // In a full implementation, you might want to store step results in a separate table
    this.logger.info(`Step ${stepName} completed for deployment ${deploymentId}`, {
      deploymentId,
      stepName,
      success: result.success,
      duration: result.duration,
      error: result.error
    })
  }

  /**
   * Map project deployment status to our deployment status
   * Null or 'idle' status means the project is ready for new deployment
   */
  private mapProjectStatusToDeploymentStatus(projectStatus: string | null): DeploymentStatus {
    switch (projectStatus) {
      case 'preparing': return 'validating' as DeploymentStatus
      case 'deploying': return 'deploying' as DeploymentStatus
      case 'deployed': return 'completed' as DeploymentStatus
      case 'failed': return 'failed' as DeploymentStatus
      case 'idle':
      case null:
      default: return 'pending' as DeploymentStatus
    }
  }

  /**
   * Get progress percentage from project status
   */
  private getProgressFromStatus(projectStatus: string | null): number {
    switch (projectStatus) {
      case 'preparing': return 25
      case 'deploying': return 75
      case 'deployed': return 100
      case 'failed': return 100
      default: return 0
    }
  }

  /**
   * Get stage description from project status
   */
  private getStageFromStatus(projectStatus: string | null): string {
    switch (projectStatus) {
      case 'preparing': return 'Preparing deployment'
      case 'deploying': return 'Deploying to Cloudflare'
      case 'deployed': return 'Deployment completed'
      case 'failed': return 'Deployment failed'
      default: return 'Initializing'
    }
  }
}
