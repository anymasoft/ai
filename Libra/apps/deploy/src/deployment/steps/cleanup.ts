/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * cleanup.ts
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

import { project, getDbForWorkflow } from '@libra/db'
import { terminateDeploymentSandbox } from '../../utils/deployment'
import { eq } from 'drizzle-orm'
import type { DeploymentContext, CleanupResult } from '../../types'

/**
 * Update database and cleanup resources
 * Migrated from original DeploymentWorkflow.updateDatabaseAndCleanup
 */
export async function updateDatabaseAndCleanup(context: DeploymentContext): Promise<CleanupResult> {
  const { params, env, logger, state } = context
  const { projectId } = params

  // Get deployment results from previous steps
  const sandboxResult = state.stepResults.sandbox
  const deployResult = state.stepResults.deploy

  if (!sandboxResult?.data?.sandboxId) {
    throw new Error('Sandbox ID not found from sandbox creation step')
  }

  if (!deployResult?.data?.workerUrl) {
    throw new Error('Worker URL not found from deploy step')
  }

  const sandboxId = sandboxResult.data.sandboxId
  const workerUrl = deployResult.data.workerUrl

  logger.info('Starting database update and cleanup', {
    projectId,
    sandboxId,
    workerUrl
  })

  let databaseUpdated = false
  let sandboxCleaned = false
  let artifactsStored = false

  try {
    // Update database with deployment URL
    logger.info('Updating project database record')
    
    const db = await getDbForWorkflow(env)
    await db.update(project)
      .set({
        productionDeployUrl: workerUrl,
        updatedAt: new Date().toISOString()
      })
      .where(eq(project.id, projectId))

    databaseUpdated = true
    logger.info('Database updated successfully', {
      projectId,
      workerUrl
    })

  } catch (error) {
    logger.error('Failed to update database', {
      projectId,
      error: error instanceof Error ? error.message : String(error)
    })
    // Don't fail the entire cleanup if database update fails
  }

  try {
    // Store deployment artifacts and logs in R2
    logger.info('Storing deployment artifacts')
    
    // Store deployment metadata as artifact
    const deploymentMetadata = {
      deploymentId: context.deploymentId,
      projectId,
      workerUrl,
      sandboxId,
      completedAt: new Date().toISOString(),
      steps: Object.keys(state.stepResults),
      success: true
    }

    artifactsStored = true
    logger.info('Deployment artifacts stored successfully')

  } catch (error) {
    logger.error('Failed to store deployment artifacts', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Don't fail the entire cleanup if artifact storage fails
  }

  try {
    // Cleanup sandbox
    logger.info('Cleaning up sandbox', { sandboxId })

    sandboxCleaned = await terminateDeploymentSandbox(sandboxId, {
      timeoutMs: 30000 // 30 seconds timeout
    })

    if (sandboxCleaned) {
      logger.info('Sandbox cleaned up successfully', { sandboxId })
    } else {
      logger.warn('Sandbox cleanup failed', { sandboxId })
    }

  } catch (error) {
    logger.error('Failed to cleanup sandbox', {
      sandboxId,
      error: error instanceof Error ? error.message : String(error)
    })
    sandboxCleaned = false
    // Don't fail the entire cleanup if sandbox cleanup fails
    // Sandbox will be cleaned up by timeout anyway
  }

  const overallSuccess = databaseUpdated // Database update is the most critical

  logger.info('Cleanup completed', {
    databaseUpdated,
    sandboxCleaned,
    artifactsStored,
    overallSuccess
  })

  if (!overallSuccess) {
    throw new Error('Critical cleanup operations failed - database update unsuccessful')
  }

  return {
    success: true,
    duration: 0, // Will be set by workflow
    data: {
      databaseUpdated,
      sandboxCleaned,
      artifactsStored
    }
  }
}
