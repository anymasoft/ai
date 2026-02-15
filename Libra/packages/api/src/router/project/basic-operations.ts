/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * basic-operations.ts
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

import { checkAndUpdateProjectUsage } from '@libra/auth/utils/subscription-limits'
import { log } from '@libra/common'
import { project, projectAsset } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import {
  projectSchema,
  updateProjectConfigSchema,
  updateProjectVisibilitySchema,
  updateSchema,
} from '../../schemas/project-schema'
import { organizationProcedure } from '../../trpc'
import {
  ensureOrgAccess,
  fetchProject,
  parseMessageHistory,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'
import { requirePrivateProjectAccess } from '../../utils/membership-validation'
import {
  cleanupProjectAssets,
  cleanupProjectContainer,
  cleanupProjectWorkerDeployment,
  createProjectWithHistory,
  restoreProjectQuota,
  updateProjectFields,
} from '../../utils/project-operations'

/**
 * Basic CRUD operations router
 */
export const basicOperations = {
  create: organizationProcedure.input(projectSchema).mutation(async ({ ctx, input }) => {
    const { orgId, userId } = await requireOrgAndUser(ctx)
    const { name, initialMessage, visibility, templateType } = input

    // Check and deduct project quota
    const quotaDeducted = await checkAndUpdateProjectUsage(orgId)
    if (!quotaDeducted) {
      log.project('warn', 'Project creation failed - quota exceeded', {
        orgId,
        userId,
        operation: 'create',
      })
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Project quota exceeded' })
    }

    return await withDbCleanup(async (db) => {
      return await createProjectWithHistory(db, {
        orgId,
        userId,
        operation: 'create',
      }, {
        name,
        templateType,
        visibility,
        initialMessage,
        planId: 'initial',
      })
    })
  }),

  update: organizationProcedure.input(updateSchema).mutation(async ({ ctx, input }) => {
    const { projectId, initialMessage } = input
    const { orgId } = await requireOrgAndUser(ctx)

    return await withDbCleanup(async (db) => {
      // Prepare updates
      const updates: Partial<typeof project.$inferInsert> = {}
      
      if (initialMessage !== undefined) {
        // Fetch project data to get current history
        const projectData = await fetchProject(db, projectId)
        ensureOrgAccess(projectData, orgId, 'update')
        
        updates.initialMessage = initialMessage
        const history = parseMessageHistory(projectData.messageHistory)
        history.push({ type: 'user', message: initialMessage, planId: `update-${Date.now()}` })
        updates.messageHistory = JSON.stringify(history)
      }

      // Use generic update function
      const result = await updateProjectFields(db, {
        orgId,
        projectId,
        operation: 'update',
      }, updates)

      return result.project
    })
  }),

  updateProjectConfig: organizationProcedure.input(updateProjectConfigSchema).mutation(async ({ ctx, input }) => {
    const { projectId, name, knowledge } = input
    const { orgId } = await requireOrgAndUser(ctx)

    return await withDbCleanup(async (db) => {
      // Prepare updates
      const updates: Partial<typeof project.$inferInsert> = {}
      if (name !== undefined) {
        updates.name = name
      }
      if (knowledge !== undefined) {
        updates.knowledge = knowledge
      }

      // Use generic update function
      const result = await updateProjectFields(db, {
        orgId,
        projectId,
        operation: 'config-update',
      }, updates)

      return result.project
    })
  }),

  updateProjectVisibility: organizationProcedure.input(updateProjectVisibilitySchema).mutation(async ({ ctx, input }) => {
    const { projectId, visibility } = input
    const { orgId } = await requireOrgAndUser(ctx)

    return await withDbCleanup(async (db) => {
      // Check if user is trying to set project to private
      if (visibility === 'private') {
        // Require premium membership for private projects
        await requirePrivateProjectAccess(orgId)
      }

      // Prepare updates
      const updates: Partial<typeof project.$inferInsert> = {
        visibility: visibility as 'public' | 'private'
      }

      // Use generic update function
      const result = await updateProjectFields(db, {
        orgId,
        projectId,
        operation: 'visibility-update',
      }, updates)

      log.project('info', 'Project visibility updated successfully', {
        orgId,
        projectId,
        visibility,
        operation: 'visibility-update',
      })

      return result.project
    })
  }),

  list: organizationProcedure.query(async ({ ctx }) => {
    const { orgId } = await requireOrgAndUser(ctx)

    return await withDbCleanup(async (db) => {
      return db
        .select()
        .from(project)
        .where(eq(project.organizationId, orgId))
        .orderBy(desc(project.createdAt))
    })
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, input.id)
        ensureOrgAccess(projectData, orgId, 'view')
        return projectData
      })
    }),

  delete: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, input.id)
        ensureOrgAccess(projectData, orgId, 'delete')

        log.project('info', 'Project deletion started', {
          orgId,
          projectId: input.id,
          operation: 'delete',
          hasContainer: !!projectData.containerId,
        })

        // Clean up project container if it exists
        await cleanupProjectContainer(projectData, {
          orgId,
          projectId: input.id,
          operation: 'delete',
        })

        // Clean up Workers for Platforms deployment if it exists
        log.project('info', 'Starting Workers for Platforms cleanup', {
          orgId,
          projectId: input.id,
          operation: 'delete',
          hasDeployUrl: !!projectData.productionDeployUrl,
        })

        const workerCleanupResult = await cleanupProjectWorkerDeployment(projectData, {
          orgId,
          projectId: input.id,
          operation: 'delete',
        })

        if (workerCleanupResult.attempted) {
          log.project('info', 'Worker cleanup attempt completed', {
            orgId,
            projectId: input.id,
            operation: 'delete',
            success: workerCleanupResult.success,
            workerName: workerCleanupResult.workerName,
            error: workerCleanupResult.error,
          })
        }

        // Log warnings for failed worker cleanup but don't block project deletion
        if (workerCleanupResult.attempted && !workerCleanupResult.success) {
          log.project('warn', 'Worker cleanup failed but proceeding with project deletion', {
            orgId,
            projectId: input.id,
            operation: 'delete',
            workerName: workerCleanupResult.workerName,
            error: workerCleanupResult.error,
          })
        }

        // Clean up project assets (files in CDN) before deleting the project
        log.project('info', 'Starting project assets cleanup before deletion', {
          orgId,
          projectId: input.id,
          operation: 'delete',
        })

        const assetsCleanupResult = await cleanupProjectAssets(db, input.id, orgId)
    
        if (assetsCleanupResult.cleanedCount > 0 || assetsCleanupResult.failedCount > 0) {
          log.project('info', 'Project assets cleanup summary', {
            orgId,
            projectId: input.id,
            operation: 'delete',
            cleanedCount: assetsCleanupResult.cleanedCount,
            failedCount: assetsCleanupResult.failedCount,
            errors: assetsCleanupResult.errors,
          })
        }

        // Log warnings for failed cleanups but don't block project deletion
        if (assetsCleanupResult.failedCount > 0) {
          log.project('warn', 'Some project assets could not be cleaned up', {
            orgId,
            projectId: input.id,
            operation: 'delete',
            failedCount: assetsCleanupResult.failedCount,
            errors: assetsCleanupResult.errors.slice(0, 5), // Limit logged errors
          })
        }

        // Only delete the project if sandbox cleanup succeeded (or no sandbox exists)
        const [deletedProject] = await db.delete(project).where(eq(project.id, input.id)).returning()
        if (!deletedProject) {
          log.project('error', 'Database operation failed - project deletion', {
            orgId,
            projectId: input.id,
            operation: 'delete',
          })
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete project' })
        }

        // Restore project quota after successful deletion
        await restoreProjectQuota({
          orgId,
          projectId: input.id,
          operation: 'delete',
        })

        log.project('info', 'Project deleted successfully', {
          orgId,
          projectId: input.id,
          operation: 'delete',
          assetsCleanedCount: assetsCleanupResult.cleanedCount,
          assetsFailedCount: assetsCleanupResult.failedCount,
        })

        return deletedProject
      })
    }),
}
