/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * deployment-operations.ts
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

import { log } from '@libra/common'
import { z } from 'zod/v4'
import { updateDeploymentStatusSchema } from '../../schemas/project-schema'
import { organizationProcedure } from '../../trpc'
import type { WorkflowInstanceStatus } from '../../types/workflow'
import {
  ensureOrgAccess,
  fetchProject,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'
import { updateProjectFields } from '../../utils/project-operations'

/**
 * Map database deployment status to workflow-like status for compatibility
 */
export function mapDeploymentStatus(
  deploymentStatus: string | null
): WorkflowInstanceStatus['status'] {
  switch (deploymentStatus) {
    case 'idle':
    case null:
      return 'unknown'
    case 'preparing':
      return 'queued'
    case 'deploying':
      return 'running'
    case 'deployed':
      return 'complete'
    case 'failed':
      return 'errored'
    default:
      return 'unknown'
  }
}

/**
 * Build deployment status response
 */
export function buildDeploymentStatusResponse(
  projectData: any,
  workflowStatus: WorkflowInstanceStatus['status']
) {
  return {
    status: {
      status: workflowStatus,
      error: projectData.deploymentStatus === 'failed' ? 'Deployment failed' : undefined,
      output: projectData.deploymentStatus === 'deployed' && projectData.productionDeployUrl
        ? {
            workerUrl: projectData.productionDeployUrl,
            message: 'Deployment completed successfully',
          }
        : undefined,
    },
    deploymentStatus: projectData.deploymentStatus,
    productionDeployUrl: projectData.productionDeployUrl,
  }
}

/**
 * Deployment operations router
 */
export const deploymentOperations = {
  updateDeploymentStatus: organizationProcedure
    .input(updateDeploymentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, deploymentStatus, productionDeployUrl } = input
      const { orgId } = await requireOrgAndUser(ctx)

      return await withDbCleanup(async (db) => {
        // Prepare updates
        const updates: any = {}
        if (deploymentStatus !== undefined) {
          updates.deploymentStatus = deploymentStatus
        }
        if (productionDeployUrl !== undefined) {
          updates.productionDeployUrl = productionDeployUrl
        }

        // Use generic update function with additional logging context
        const result = await updateProjectFields(db, {
          orgId,
          projectId,
          operation: 'deployment-status-update',
        }, updates)

        return result.project
      })
    }),

  getDeploymentStatus: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)
      const { projectId } = input

      return await withDbCleanup(async (db) => {
        // Fetch and verify project access
        const projectData = await fetchProject(db, projectId)
        ensureOrgAccess(projectData, orgId, 'view')

        log.project('info', 'Getting deployment status', {
          orgId,
          projectId,
          operation: 'deployment-status',
          currentStatus: projectData.deploymentStatus,
        })

        // Map database deployment status to workflow-like status for compatibility
        const workflowStatus = mapDeploymentStatus(projectData.deploymentStatus)

        log.project('info', 'Deployment status mapped', {
          orgId,
          projectId,
          operation: 'deployment-status-mapping',
          dbStatus: projectData.deploymentStatus,
          workflowStatus,
        })

        return buildDeploymentStatusResponse(projectData, workflowStatus)
      })
    }),
}
