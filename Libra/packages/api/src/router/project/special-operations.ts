/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * special-operations.ts
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
import { project } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import { projectSchema } from '../../schemas/project-schema'
import { organizationProcedure } from '../../trpc'
import {
  ensureOrgAccess,
  fetchProject,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'
import {
  buildForkHistory,
  createProjectWithHistory,
  generateRandomProjectName,
} from '../../utils/project-operations'

/**
 * Special operations router
 */
export const specialOperations = {
  heroProjectCreate: organizationProcedure.input(projectSchema).mutation(async ({ ctx, input }) => {
    const { orgId, userId } = await requireOrgAndUser(ctx)
    const { initialMessage, attachment, planId } = input

    // Check and deduct project quota
    const quotaDeducted = await checkAndUpdateProjectUsage(orgId)
    if (!quotaDeducted) {
      log.project('warn', 'Hero project creation failed - quota exceeded', {
        orgId,
        userId,
        operation: 'hero-create',
      })
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Project quota exceeded' })
    }

    // Note: AI message deduction now occurs when sending the actual AI request
    // No longer deducting in advance here to avoid incorrect charges when creating projects

    return await withDbCleanup(async (db) => {
      return await createProjectWithHistory(db, {
        orgId,
        userId,
        operation: 'hero-create',
      }, {
        // name: undefined - let createProjectWithHistory generate a random name
        templateType: '0',
        visibility: 'public',
        initialMessage,
        attachment,
        planId,
      })
    })
  }),

  fork: organizationProcedure
    .input(
      z.object({
        projectId: z.string(),
        planId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId, userId } = await requireOrgAndUser(ctx)
      const { projectId, planId } = input

      log.project('info', 'Project fork started', {
        orgId,
        userId,
        sourceProjectId: projectId,
        forkPlanId: planId,
        operation: 'fork',
      })

      // Check and deduct project quota
      const quotaDeducted = await checkAndUpdateProjectUsage(orgId)
      if (!quotaDeducted) {
        log.project('warn', 'Project fork failed - quota exceeded', {
          orgId,
          userId,
          sourceProjectId: projectId,
          operation: 'fork',
        })
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Project quota exceeded' })
      }

      return await withDbCleanup(async (db) => {
        // Fetch the source project
        const sourceProject = await fetchProject(db, projectId)
        ensureOrgAccess(sourceProject, orgId, 'view')

        // Build fork history up to the target planId
        const { forkHistory, initialMessage } = buildForkHistory(sourceProject, planId, {
          orgId,
          projectId,
          operation: 'fork',
        })

        // Generate a smart fork name that follows the same naming pattern as createProjectWithHistory
        // If the source project name is too long, use a random name instead of appending "(Fork)"
        const maxForkNameLength = 30
        const forkSuffix = ' (Fork)'
        let forkName: string

        if (sourceProject.name.length + forkSuffix.length <= maxForkNameLength) {
          forkName = `${sourceProject.name}${forkSuffix}`
        } else {
          // Use the same random naming pattern as createProjectWithHistory for consistency
          forkName = generateRandomProjectName(maxForkNameLength)
        }

        // Create the new forked project using the generic creation function
        const newProject = await createProjectWithHistory(db, {
          orgId,
          userId,
          operation: 'fork',
        }, {
          name: forkName,
          templateType: sourceProject.templateType,
          visibility: sourceProject.visibility,
          initialMessage,
        })

        // Override the message history with the fork history
        const [updatedProject] = await db
          .update(project)
          .set({ messageHistory: JSON.stringify(forkHistory) })
          .where(eq(project.id, newProject.id))
          .returning()

        if (!updatedProject) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update forked project history',
          })
        }

        log.project('info', 'Project forked successfully', {
          orgId,
          userId,
          sourceProjectId: projectId,
          forkedProjectId: newProject.id,
          forkPlanId: planId,
          operation: 'fork',
          messageCount: forkHistory.length,
        })

        return updatedProject
      })
    }),
}
