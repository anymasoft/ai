/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project.ts
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

import type { HistoryType } from '@libra/common'
import { tryCatch } from '@libra/common'
import { getDbAsync } from '@libra/db'
import { project } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function requireOrgAndUser(ctx: any) {
  const orgId = ctx?.orgId
  const userId = ctx?.session?.user?.id
  if (!orgId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Organization ID is missing' })
  }
  if (!userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'User ID is missing' })
  }
  return { orgId, userId }
}

export async function getBusinessDb() {
  const db = await getDbAsync()
  if (!db) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database connection is not available',
    })
  }
  return db
}

/**
 * Execute a database operation with automatic connection cleanup
 */
export async function withDbCleanup<T>(
  operation: (db: any) => Promise<T>
): Promise<T> {
  const db = await getBusinessDb()

  try {
    return await operation(db)
  } finally {
    // Clean up database connection
    const [cloudflareContext, contextError] = await tryCatch(async () =>
      getCloudflareContext({ async: true })
    )
    if (!contextError && cloudflareContext?.ctx) {
      cloudflareContext.ctx.waitUntil(db.$client.end())
    }
  }
}

export async function fetchProject(db: any, projectId: string) {
  const results = await db.select().from(project).where(eq(project.id, projectId))
  if (results.length === 0) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
  }
  const projectData = results[0]
  if (!projectData) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Project data is corrupted' })
  }
  return projectData
}

export function ensureOrgAccess(
  projectData: { organizationId?: string },
  orgId: string,
  action: string
) {
  if (projectData.organizationId !== orgId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} this project`,
    })
  }
}

export function parseMessageHistory(historyStr: string) {
  try {
    return JSON.parse(historyStr || '[]') as HistoryType
  } catch (error) {
    return []
  }
}

/**
 * Update project Git information with validation and logging
 * @param db Database instance
 * @param projectId Project ID to update
 * @param gitInfo Git information to update
 * @param orgId Organization ID for access control
 * @returns Updated project data
 */
export async function updateProjectGitInfo(
  db: any,
  projectId: string,
  gitInfo: { gitUrl?: string; gitBranch?: string },
  orgId: string
) {
  // Validate project exists and user has access
  const projectData = await fetchProject(db, projectId)
  ensureOrgAccess(projectData, orgId, 'update')

  // Prepare update object with only defined values
  const updates: Partial<typeof project.$inferInsert> = {}
  if (gitInfo.gitUrl !== undefined) {
    updates.gitUrl = gitInfo.gitUrl
  }
  if (gitInfo.gitBranch !== undefined) {
    updates.gitBranch = gitInfo.gitBranch
  }

  // Only update if there are changes
  if (Object.keys(updates).length === 0) {
    return projectData
  }

  // Perform atomic update
  const [updatedProject] = await db
    .update(project)
    .set(updates)
    .where(eq(project.id, projectId))
    .returning()

  if (!updatedProject) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to update project Git information',
    })
  }

  return updatedProject
}

/**
 * Validate Git URL format and accessibility
 * @param gitUrl Git repository URL to validate
 * @returns Validation result with normalized URL
 */
export function validateGitUrl(gitUrl: string): {
  isValid: boolean
  normalizedUrl?: string
  error?: string
} {
  try {
    // Basic URL validation
    const url = new URL(gitUrl)

    // Check if it's a supported Git hosting service
    const supportedHosts = ['github.com', 'gitlab.com', 'bitbucket.org']
    const isSupported = supportedHosts.some((host) => url.hostname.includes(host))

    if (!isSupported) {
      return {
        isValid: false,
        error: 'Only GitHub, GitLab, and Bitbucket repositories are supported',
      }
    }

    // Ensure URL ends with .git
    const normalizedUrl = gitUrl.endsWith('.git') ? gitUrl : `${gitUrl}.git`

    return {
      isValid: true,
      normalizedUrl,
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid URL format',
    }
  }
}
