/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * history.ts
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

import { tryCatch } from '@libra/common'
import { project } from '@libra/db/schema/project-schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import type { ContentType, HistoryType, MessageType } from '../schemas/history'
import { createTRPCRouter, organizationProcedure } from '../trpc'
import { prepareContainer } from '../utils/container'
import { handleAsyncScreenshotViaService } from '../utils/screenshot-client'
import { ensureOrgAccess, fetchProject, requireOrgAndUser, withDbCleanup } from '../utils/project'
import { buildPreviewUrl } from './project/container-operations'

/**
 * Get default content type based on message type
 */
const getDefaultContentType = (messageType: string): ContentType => {
  switch (messageType) {
    case 'user':
      return 'user_message'
    case 'thinking':
      return 'thinking'
    case 'plan':
      return 'plan'
    case 'diff':
      return 'files'
    case 'command':
      return 'files'
    case 'screenshot':
      return 'files'
    case 'timing':
      return 'user_message'
    default:
      return 'user_message'
  }
}

/**
 * Ensure message has contentType field with appropriate default value
 */
const ensureContentType = (message: any): MessageType => {
  if (!message.contentType && message.type) {
    return {
      ...message,
      contentType: getDefaultContentType(message.type),
    }
  }
  return message
}

export const historyRouter = createTRPCRouter({
  getAll: organizationProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)
      const inputId = input.id

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, inputId)
        ensureOrgAccess(projectData, orgId, 'view')
        return JSON.parse(projectData?.messageHistory || '[]') as HistoryType
      })
    }),

  appendHistory: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        messages: z.union([z.lazy(() => z.any()), z.array(z.lazy(() => z.any()))]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)
      const inputId = input.id

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, inputId)
        ensureOrgAccess(projectData, orgId, 'update')
        // Type assertion to handle potential undefined cases
        const messageHistoryStr = projectData?.messageHistory || '[]'

        // Parse current history (with defensive checks)
        const [parsed, parseError] = tryCatch(() => {
          return JSON.parse(messageHistoryStr)
        })

        let currentHistory: HistoryType
        if (parseError) {
          // Use empty array when parsing fails
          currentHistory = []
        } else {
          // Ensure history is always an array
          currentHistory = Array.isArray(parsed) ? parsed : []
        }

        // Append new messages with contentType ensured
        const messagesToAdd = Array.isArray(input.messages)
          ? input.messages.map(ensureContentType)
          : [ensureContentType(input.messages)]

        const newHistory = [...currentHistory, ...messagesToAdd]
        // Update database
        await db
          .update(project)
          .set({ messageHistory: JSON.stringify(newHistory) })
          .where(eq(project.id, inputId))
        return { success: true, historyLength: newHistory.length }
      })
    }),
  revert: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        planId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const inputId = input.id
      const planId = input.planId
      const orgId = ctx?.orgId

      return await withDbCleanup(async (db) => {
        const res = await db.query.project.findFirst({
          where: eq(project.id, inputId),
        })

        if (!res) {
          throw new Error(`Project with ID ${inputId} not found`)
        }
        const messageHistoryStr = res?.messageHistory || '[]'

        // Parse current history
        const [parsed2, parseError2] = tryCatch(() => {
          return JSON.parse(messageHistoryStr)
        })

        let currentHistory: HistoryType
        if (parseError2) {
          throw new Error('Failed to parse history')
        }
        // Ensure history is always an array
        currentHistory = Array.isArray(parsed2) ? parsed2 : []

        // Find the last index position of the specified planId
        let planIndex = -1
        // Traverse from back to front to find the last matching planId
        for (let i = currentHistory.length - 1; i >= 0; i--) {
          const item = currentHistory[i]
          if (item && 'planId' in item && item.planId === planId) {
            planIndex = i
            break
          }
        }

        if (planIndex === -1) {
          throw new Error(`History record with plan ID ${planId} not found`)
        }

        // Extract history records up to planId position (including the record corresponding to planId)
        const revertedHistory = currentHistory.slice(0, planIndex + 1)
        const removedMessagesCount = currentHistory.length - revertedHistory.length

        if (removedMessagesCount === 0) {
          return {
            success: true,
            historyLength: revertedHistory.length,
            message: `Currently already at the latest state for plan ID: ${planId}, no rollback needed`,
          }
        }

        // Record statistics of deleted message types
        const removedTypesCount: Record<string, number> = {}
        for (let i = planIndex + 1; i < currentHistory.length; i++) {
          const type = currentHistory[i]?.type || 'Unknown type'
          removedTypesCount[type] = (removedTypesCount[type] || 0) + 1
        }

        // Update database and get updated project data
        // Reset deployment status when user reverts history - allows new deployments
        const updatedProjectData = await db
          .update(project)
          .set({
            messageHistory: JSON.stringify(revertedHistory),
            deploymentStatus: 'idle'
          })
          .where(eq(project.id, inputId))
          .returning()

        // Check if reverted history contains "files" type messages for screenshot capture
        const hasFilesMessage = revertedHistory.some((msg) => msg.contentType === 'files')
        let previewURL: string | undefined

        if (hasFilesMessage && updatedProjectData[0]) {
          // Get the latest planId from the reverted history
          const latestMessage = revertedHistory.findLast((msg) => msg.planId)
          const latestPlanId = latestMessage?.planId

          if (latestPlanId && ctx.session?.user?.id && orgId) {
            try {
              // Prepare container to ensure it reflects the reverted state
              const container = await prepareContainer(ctx, inputId, {
                containerId: updatedProjectData[0].containerId || undefined,
                messageHistory: JSON.stringify(revertedHistory),
              })

              // Get preview info from the prepared container
              const previewInfo = await container.getPreviewInfo(5173)

              // Build preview URL with planId (similar to updateContainerContent)
              previewURL = buildPreviewUrl(previewInfo.url, latestPlanId)

              // Handle async screenshot via service (similar to updateContainerContent)
              await handleAsyncScreenshotViaService(
                ctx,
                inputId,
                latestPlanId || 'initial',
                orgId,
                previewInfo
              )

            } catch (error) {
              // Screenshot capture failed but don't fail the revert operation
            }
          }
        }

        return {
          success: true,
          historyLength: revertedHistory.length,
          revertedFrom: currentHistory.length,
          removedMessagesCount,
          removedTypes: removedTypesCount,
          previewURL,
          message: `Successfully rolled back to the last occurrence of plan ID: ${planId}, removed ${removedMessagesCount} subsequent messages`,
        }
      })
    }),
})
