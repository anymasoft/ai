/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * container-operations.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty o≠f
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import { log, tryCatch } from '@libra/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'
import { organizationProcedure } from '../../trpc'
import { prepareContainer } from '../../utils/container'
import { handleAsyncScreenshotViaService } from '../../utils/screenshot-client'
import {
  ensureOrgAccess,
  fetchProject,
  parseMessageHistory,
  requireOrgAndUser,
  withDbCleanup,
} from '../../utils/project'

/**
 * Build preview URL with planId parameter
 */
export function buildPreviewUrl(baseUrl: string, planId?: string): string {
  if (!planId) {
    return baseUrl
  }

  const [url, urlError] = tryCatch(() => {
    const url = new URL(baseUrl)
    url.searchParams.set('planId', planId)
    return url.toString()
  })

  if (urlError) {
    // Fallback: manually append planId as query parameter
    log.project('warn', 'URL construction failed, using fallback method', {
      baseUrl,
      planId,
      error: urlError instanceof Error ? urlError.message : String(urlError),
    })
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}planId=${encodeURIComponent(planId)}`
  }

  return url
}

/**
 * Get container preview information with error handling
 */
export async function getContainerPreviewInfo(
  container: any,
  projectId: string,
  orgId: string,
  operation: string
): Promise<{ url: string; token?: string }> {
  try {
    const previewInfo = await container.getPreviewInfo(5173)
    
    log.project('info', 'Got preview info from container', {
      orgId,
      projectId,
      operation,
      url: previewInfo.url,
      hasToken: !!previewInfo.token,
    })
    
    return previewInfo
  } catch (error) {
    log.project('error', 'Failed to get preview info from container', {
      orgId,
      projectId,
      operation,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get container preview URL',
    })
  }
}

/**
 * Normalize URL to ensure it has a protocol
 */
export function normalizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Invalid base URL from container',
    })
  }

  // Ensure the URL has a protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }

  return url
}

/**
 * Container operations router
 */
export const containerOperations = {
  updateContainerContent: organizationProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, input.id)
        ensureOrgAccess(projectData, orgId, 'access')

        log.project('info', 'Container content update started', {
          orgId,
          projectId: input.id,
          operation: 'container-update',
        })

        // Parse message history and find the latest planId
        const history = parseMessageHistory(projectData.messageHistory)
        const latestMessage = history.findLast((message) => message?.planId)
        const latestPlanId = latestMessage?.planId

        const container = await prepareContainer(ctx, input.id, projectData)
        
        // Get preview info with error handling
        const previewInfo = await getContainerPreviewInfo(
          container,
          input.id,
          orgId,
          'container-update'
        )

        // // Handle async screenshot via new screenshot service
        // await handleAsyncScreenshotViaService(
        //   ctx,
        //   input.id,
        //   latestPlanId || 'initial',
        //   orgId,
        //   previewInfo
        // )

        // Build preview URL with planId
        const previewURL = buildPreviewUrl(previewInfo.url, latestPlanId)

        return { success: true, previewURL }
      })
    }),

  getPreviewUrl: organizationProcedure
    .input(
      z.object({
        id: z.string(),
        planId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { orgId } = await requireOrgAndUser(ctx)

      return await withDbCleanup(async (db) => {
        const projectData = await fetchProject(db, input.id)
        ensureOrgAccess(projectData, orgId, 'access')

        log.project('info', 'Preview URL requested', {
          orgId,
          projectId: input.id,
          operation: 'preview-url',
          hasPlanId: !!input.planId,
        })

        const container = await prepareContainer(ctx, input.id, projectData)

        // Get preview info with error handling
        const previewInfo = await getContainerPreviewInfo(
          container,
          input.id,
          orgId,
          'preview-url'
        )

        // Normalize and validate base URL
        const normalizedBaseUrl = normalizeUrl(previewInfo.url)

        // Build preview URL (planId is optional for this endpoint)
        const previewURL = normalizedBaseUrl

        // Synchronously warm up the preview URL to prevent 502 errors on first load
        // await warmupPreviewUrl(previewURL, orgId, input.id)

        return { success: true, previewURL }
      })
    }),
}
