/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status-operations.ts
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

import { getCombinedProjectQuota } from '@libra/auth/utils/subscription-limits'
import { log, tryCatch } from '@libra/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'
import { organizationProcedure } from '../../trpc'
import {
  ensureOrgAccess,
  fetchProject,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'

/**
 * Handle project status query errors and return appropriate response
 */
export function handleProjectStatusError(
  error: any,
  orgId: string,
  projectId: string
): { isActive: boolean; hasAccess: boolean; projectId: string; name: null } {
  log.project('error', 'Project status query failed', {
    orgId,
    projectId,
    operation: 'status-query',
    error: error instanceof Error ? error.message : String(error),
  })

  // If project not found or access denied, return appropriate status
  if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
    log.project('warn', 'Project not found for status query', {
      orgId,
      projectId,
      operation: 'status-query',
    })
    return {
      isActive: false,
      hasAccess: false,
      projectId,
      name: null,
    }
  }

  if (error instanceof TRPCError && error.code === 'FORBIDDEN') {
    log.project('warn', 'Access denied for project status query', {
      orgId,
      projectId,
      operation: 'status-query',
    })
    return {
      isActive: false,
      hasAccess: false,
      projectId,
      name: null,
    }
  }

  throw error
}

/**
 * Status operations router
 */
export const statusOperations = {
  getProjectStatus: organizationProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)
      const { projectId } = input

      return await withDbCleanup(async (db) => {
        const [statusInfo, error] = await tryCatch(async () => {
          // Fetch project and verify organization access
          const projectData = await fetchProject(db, projectId)
          ensureOrgAccess(projectData, orgId, 'view')

          return {
            isActive: projectData.isActive,
            hasAccess: true,
            projectId: projectData.id,
            name: projectData.name,
          }
        })

        if (error) {
          return handleProjectStatusError(error, orgId, projectId)
        }

        return statusInfo
      })
    }),

  getQuotaStatus: organizationProcedure.query(async ({ ctx }) => {
    const { orgId } = await requireOrgAndUser(ctx)

    const [quotaInfo, error] = await tryCatch(async () => {
      // Get combined project quota from both FREE and PAID plans
      const combinedQuota = await getCombinedProjectQuota(orgId)

      return {
        projectNums: combinedQuota.projectNums,
        projectNumsLimit: combinedQuota.projectNumsLimit,
        plan: combinedQuota.plan,
        periodEnd: combinedQuota.periodEnd,
      }
    })

    if (error) {
      log.project('error', 'Project quota query failed', {
        orgId,
        operation: 'quota-query',
        error: error instanceof Error ? error.message : String(error),
      })
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve project quota information',
      })
    }

    return quotaInfo
  }),
}
