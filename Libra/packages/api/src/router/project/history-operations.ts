/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * history-operations.ts
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
import { project } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { updateHistoryWithScreenshotSchema } from '../../schemas/project-schema'
import { organizationProcedure } from '../../trpc'
import {
  ensureOrgAccess,
  fetchProject,
  parseMessageHistory,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'

/**
 * Find the latest planId in message history
 */
export function findLatestPlanId(history: any[]): string | null {
  const latestMessage = history.findLast((message) => message?.planId)
  return latestMessage?.planId || null
}

/**
 * Insert screenshot entry into history at the correct position
 */
export function insertScreenshotInHistory(
  currentHistory: any[],
  planId: string,
  screenshotKey: string,
  previewUrl: string
): { newHistory: any[]; wasInserted: boolean } {
  // Check if a screenshot entry already exists for this planId
  const existingScreenshotEntry = currentHistory.find(
    (message) => message.type === 'screenshot' && message.planId === planId
  )

  if (existingScreenshotEntry) {
    return { newHistory: currentHistory, wasInserted: false }
  }

  // Create new screenshot entry
  const screenshotEntry: any = {
    type: 'screenshot' as const,
    planId,
    previewUrl,
    screenshotKey,
    screenshotTimestamp: Date.now(),
  }

  // Find the position to insert the screenshot entry
  // Insert it after the last message with the same planId
  let insertIndex = currentHistory.length
  for (let i = currentHistory.length - 1; i >= 0; i--) {
    if (currentHistory[i]?.planId === planId) {
      insertIndex = i + 1
      break
    }
  }

  const newHistory = [
    ...currentHistory.slice(0, insertIndex),
    screenshotEntry,
    ...currentHistory.slice(insertIndex),
  ]

  return { newHistory, wasInserted: true }
}

/**
 * History operations router
 */
export const historyOperations = {
  updateHistoryWithScreenshot: organizationProcedure
    .input(updateHistoryWithScreenshotSchema)
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)
      const { projectId, planId, screenshotKey, previewUrl } = input

      return await withDbCleanup(async (db) => {
        // Fetch and verify project access
        const projectData = await fetchProject(db, projectId)
        ensureOrgAccess(projectData, orgId, 'update')

        // Parse current message history
        const currentHistory = parseMessageHistory(projectData.messageHistory)

        // Insert screenshot entry if it doesn't exist
        const { newHistory, wasInserted } = insertScreenshotInHistory(
          currentHistory,
          planId,
          screenshotKey,
          previewUrl
        )

        // Check if this planId is the latest in the history to determine if we should update preview image
        const latestPlanId = findLatestPlanId(currentHistory)
        const isLatestPlanId = latestPlanId === planId

        // Prepare updates - only update preview image URL if this is the latest planId
        const updates: Partial<typeof project.$inferInsert> = {}
        if (isLatestPlanId) {
          updates.previewImageUrl = previewUrl
        }

        // Only update message history if we added a new screenshot entry
        if (wasInserted) {
          updates.messageHistory = JSON.stringify(newHistory)
        }

        // Only perform database update if there are actual changes
        if (Object.keys(updates).length > 0) {
          const [dbUpdatedProject] = await db
            .update(project)
            .set(updates)
            .where(eq(project.id, projectId))
            .returning()

          if (!dbUpdatedProject) {
            log.project('error', 'Database operation failed - screenshot update', {
              orgId,
              projectId,
              planId,
              operation: 'screenshot-update',
            })
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Failed to update project with screenshot data',
            })
          }

          log.project('info', 'Project updated with screenshot successfully', {
            orgId,
            projectId,
            planId,
            operation: 'screenshot-update',
            updatedPreviewImage: isLatestPlanId,
            updatedMessages: wasInserted,
          })
        }

        return {
          success: true,
          projectId,
          planId,
          screenshotKey,
          previewUrl,
          updatedMessages: wasInserted,
          updatedPreviewImage: isLatestPlanId,
        }
      })
    }),
}
