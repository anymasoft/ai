/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-operations.ts
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

import { log, tryCatch, getCdnFileUrl } from '@libra/common'
import { project, projectAsset } from '@libra/db/schema/project-schema'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { ensureOrgAccess, fetchProject, parseMessageHistory } from './project'
import { terminateSandbox } from './container'
import { restoreProjectQuotaOnDeletion } from '@libra/auth/utils/subscription-limits'
import { deleteProjectWorker } from './cloudflare-workers'
import { headers } from 'next/headers'
import { hasPremiumMembership } from './membership-validation'

/**
 * Generate a random project name with length limit
 * @param maxLength - Maximum length of the project name (default: 20)
 * @returns Random project name
 */
export function generateRandomProjectName(maxLength = 20): string {
  const adjectives = [
    'Amazing', 'Brilliant', 'Creative', 'Dynamic', 'Epic', 'Fantastic',
    'Great', 'Innovative', 'Magical', 'Outstanding', 'Perfect', 'Quick',
    'Smart', 'Unique', 'Wonderful', 'Awesome', 'Cool', 'Fresh', 'Modern', 'Swift'
  ]

  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)]
  const randomNumber = Math.floor(Math.random() * 999) + 1

  const fullName = `${randomAdjective} Project ${randomNumber}`

  // Truncate if exceeds max length
  return fullName.length > maxLength ? fullName.substring(0, maxLength).trim() : fullName
}

/**
 * Project operation context for logging and error handling
 */
export interface ProjectOperationContext {
  orgId: string
  userId?: string
  projectId: string
  operation: string
}

/**
 * Generic project update result
 */
export interface ProjectUpdateResult {
  success: boolean
  project: any
  updatedFields: string[]
}

/**
 * Project creation parameters
 * Note: visibility parameter is ignored - project visibility is determined by user's subscription status
 * Premium users default to private projects, free users default to public projects
 */
export interface ProjectCreationParams {
  name?: string
  templateType?: string
  visibility?: 'public' | 'private' // Ignored - determined by subscription status
  initialMessage?: string
  attachment?: {
    key: string
    name: string
    type: string
  }
  planId?: string
}

/**
 * Project creation context
 */
export interface ProjectCreationContext {
  orgId: string
  userId: string
  operation: string
}

/**
 * Validate project access and return project data
 */
export async function validateProjectAccess(
  db: any,
  projectId: string,
  orgId: string,
  action: string
): Promise<any> {
  const projectData = await fetchProject(db, projectId)
  ensureOrgAccess(projectData, orgId, action)
  return projectData
}

/**
 * Generic function to update project fields with validation and logging
 */
export async function updateProjectFields(
  db: any,
  context: ProjectOperationContext,
  updates: Partial<typeof project.$inferInsert>
): Promise<ProjectUpdateResult> {
  const { orgId, projectId, operation } = context

  // Validate project access
  const projectData = await validateProjectAccess(db, projectId, orgId, 'update')

  log.project('info', `Project ${operation} started`, {
    orgId,
    projectId,
    operation,
    hasUpdates: Object.keys(updates).length > 0,
  })

  // Return early if no updates
  if (Object.keys(updates).length === 0) {
    log.project('info', `Project ${operation} - no changes needed`, {
      orgId,
      projectId,
      operation,
    })
    return {
      success: true,
      project: projectData,
      updatedFields: [],
    }
  }

  // Perform atomic update
  const [updatedProject] = await db
    .update(project)
    .set(updates)
    .where(eq(project.id, projectId))
    .returning()

  if (!updatedProject) {
    log.project('error', `Database operation failed - project ${operation}`, {
      orgId,
      projectId,
      operation,
    })
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to update project ${operation}`,
    })
  }

  const updatedFields = Object.keys(updates)
  log.project('info', `Project ${operation} completed successfully`, {
    orgId,
    projectId,
    operation,
    updatedFields,
  })

  return {
    success: true,
    project: updatedProject,
    updatedFields,
  }
}

/**
 * Build message history for project creation
 */
export function buildMessageHistory(
  initialMessage?: string,
  attachment?: ProjectCreationParams['attachment'],
  planId?: string
): string {
  if (!initialMessage) {
    return '[]'
  }

  const messagePlanId = planId || createId()
  const messageEntry: any = {
    type: 'user',
    message: initialMessage,
    planId: messagePlanId,
  }

  if (attachment) {
    messageEntry.attachment = attachment
  }

  return JSON.stringify([messageEntry])
}

/**
 * Generic function to create project with history
 */
export async function createProjectWithHistory(
  db: any,
  context: ProjectCreationContext,
  params: ProjectCreationParams
): Promise<any> {
  const { orgId, userId, operation } = context
  const { name, templateType, initialMessage, attachment, planId } = params

  // Check user's subscription status to determine project visibility
  const isPremium = await hasPremiumMembership(orgId)

  // Determine project visibility based on subscription status
  // Premium users default to private projects, free users default to public projects
  const projectVisibility: 'public' | 'private' = isPremium ? 'private' : 'public'

  log.project('info', `Project ${operation} started`, {
    orgId,
    userId,
    operation,
    projectName: name,
    templateType,
    isPremium,
    projectVisibility,
    hasInitialMessage: !!initialMessage,
    hasAttachment: !!attachment,
    planId,
  })

  // Build message history
  const messageHistory = buildMessageHistory(initialMessage, attachment, planId)

  // Create project
  const [newProject] = await db
    .insert(project)
    .values({
      name: name ?? generateRandomProjectName(30),
      templateType: templateType ?? 'default',
      visibility: projectVisibility,
      initialMessage,
      messageHistory,
      userId,
      organizationId: orgId,
    })
    .returning()

  if (!newProject) {
    log.project('error', `Database operation failed - project ${operation}`, {
      orgId,
      userId,
      operation,
      projectName: name,
    })
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create project',
    })
  }

  log.project('info', `Project ${operation} completed successfully`, {
    orgId,
    userId,
    projectId: newProject.id,
    projectName: newProject.name,
    operation,
  })

  return newProject
}

/**
 * Build fork history up to a specific planId
 */
export function buildForkHistory(
  sourceProject: any,
  targetPlanId: string,
  context: ProjectOperationContext
): { forkHistory: any[]; initialMessage: string } {
  const { orgId, projectId } = context

  // Parse message history and filter up to the fork point
  const fullHistory = parseMessageHistory(sourceProject.messageHistory)
  const forkHistory = []
  let foundTargetPlanId = false

  for (const message of fullHistory) {
    forkHistory.push(message)

    // Check if this message has the target planId
    if (message.planId === targetPlanId) {
      foundTargetPlanId = true
    }

    // Continue collecting messages until we've processed all messages with the target planId
    // This ensures we capture complete AI responses (thinking + plan + diff + command messages)
    if (foundTargetPlanId) {
      // Look ahead to see if there are more messages with the same planId
      const currentIndex = fullHistory.indexOf(message)
      const hasMoreMessagesWithSamePlanId = fullHistory
        .slice(currentIndex + 1)
        .some((msg) => msg.planId === targetPlanId)

      // If no more messages with the same planId, we can stop
      if (!hasMoreMessagesWithSamePlanId) {
        break
      }
    }
  }

  if (!foundTargetPlanId) {
    log.project('warn', 'Fork point not found in project history', {
      orgId,
      projectId,
      forkPlanId: targetPlanId,
      operation: 'fork',
    })
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Fork point not found in project history',
    })
  }

  // Get the initial message (first user message)
  const initialMessage = forkHistory.find((msg) => msg.type === 'user')?.message || ''

  // Log fork statistics for debugging
  const messageTypeCounts = forkHistory.reduce(
    (counts, msg) => {
      counts[msg.type] = (counts[msg.type] || 0) + 1
      return counts
    },
    {} as Record<string, number>
  )

  log.project('info', 'Fork history built successfully', {
    orgId,
    projectId,
    forkPlanId: targetPlanId,
    operation: 'fork',
    messageCount: forkHistory.length,
    messageTypes: Object.keys(messageTypeCounts),
  })

  return { forkHistory, initialMessage }
}

/**
 * Call CDN delete API to remove files by planId
 */
export async function callCdnDeleteApi(planId: string): Promise<{ success: boolean; error?: string }> {
  const [result, error] = await tryCatch(async () => {
    const fileUrl = getCdnFileUrl(planId)

    log.project('info', 'Calling CDN delete API', {
      planId,
      fileUrl,
      operation: 'cdn-delete-api'
    })
    const headersList = await headers()

    const response = await fetch(fileUrl, {
      method: 'DELETE',
      headers: headersList,
      // Include credentials for authentication
      credentials: 'include',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`CDN delete failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
    }

    const result = await response.json()
    return { success: true, result }
  })

  if (error) {
    log.project('error', 'CDN delete API call failed', {
      planId,
      operation: 'cdn-delete-api'
    }, error instanceof Error ? error : new Error(String(error)))

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }

  return result
}

/**
 * Clean up all project assets by deleting associated files from CDN
 */
export async function cleanupProjectAssets(db: any, projectId: string, orgId: string): Promise<{
  success: boolean;
  cleanedCount: number;
  failedCount: number;
  errors: string[]
}> {
  const [result, error] = await tryCatch(async () => {
    log.project('info', 'Starting project assets cleanup', {
      projectId,
      orgId,
      operation: 'assets-cleanup'
    })

    // Query all project assets for this project
    const assets = await db
      .select({
        id: projectAsset.id,
        planId: projectAsset.planId,
        attachmentKey: projectAsset.attachmentKey,
      })
      .from(projectAsset)
      .where(eq(projectAsset.projectId, projectId))

    if (assets.length === 0) {
      log.project('info', 'No assets found for cleanup', {
        projectId,
        orgId,
        operation: 'assets-cleanup'
      })
      return { success: true, cleanedCount: 0, failedCount: 0, errors: [] }
    }

    log.project('info', 'Found assets for cleanup', {
      projectId,
      orgId,
      assetCount: assets.length,
      operation: 'assets-cleanup'
    })

    // Use Promise.allSettled for concurrent deletion, allowing partial failures
    const deletePromises = assets.map((asset: any) =>
      callCdnDeleteApi(asset.planId).then(result => ({
        planId: asset.planId,
        attachmentKey: asset.attachmentKey,
        ...result
      }))
    )

    const deleteResults = await Promise.allSettled(deletePromises)

    let cleanedCount = 0
    let failedCount = 0
    const errors: string[] = []

    deleteResults.forEach((result, index) => {
      const asset = assets[index]

      if (!asset) {
        failedCount++
        errors.push(`Asset at index ${index} is undefined`)
        return
      }

      if (result.status === 'fulfilled') {
        if (result.value.success) {
          cleanedCount++
          log.project('info', 'Asset cleaned successfully', {
            projectId,
            orgId,
            planId: asset.planId,
            attachmentKey: asset.attachmentKey,
            operation: 'assets-cleanup'
          })
        } else {
          failedCount++
          const errorMsg = `Failed to delete asset ${asset.planId}: ${result.value.error}`
          errors.push(errorMsg)
          log.project('warn', 'Asset cleanup failed', {
            projectId,
            orgId,
            planId: asset.planId,
            attachmentKey: asset.attachmentKey,
            error: result.value.error,
            operation: 'assets-cleanup'
          })
        }
      } else {
        failedCount++
        const errorMsg = `Promise rejected for asset ${asset.planId}: ${result.reason}`
        errors.push(errorMsg)
        log.project('error', 'Asset cleanup promise rejected', {
          projectId,
          orgId,
          planId: asset.planId,
          attachmentKey: asset.attachmentKey,
          operation: 'assets-cleanup'
        }, result.reason instanceof Error ? result.reason : new Error(String(result.reason)))
      }
    })

    log.project('info', 'Project assets cleanup completed', {
      projectId,
      orgId,
      totalAssets: assets.length,
      cleanedCount,
      failedCount,
      operation: 'assets-cleanup'
    })

    return { success: true, cleanedCount, failedCount, errors }
  })

  if (error) {
    log.project('error', 'Project assets cleanup failed', {
      projectId,
      orgId,
      operation: 'assets-cleanup'
    }, error instanceof Error ? error : new Error(String(error)))

    return {
      success: false,
      cleanedCount: 0,
      failedCount: 0,
      errors: [error instanceof Error ? error.message : String(error)]
    }
  }

  return result
}

/**
 * Clean up project container if it exists
 */
export async function cleanupProjectContainer(
  projectData: any,
  context: ProjectOperationContext
): Promise<void> {
  const { orgId, projectId } = context

  if (!projectData.containerId) {
    return
  }

  log.project('info', 'Terminating container before project deletion', {
    orgId,
    projectId,
    containerId: projectData.containerId,
    operation: 'container-cleanup',
  })

  const cleanupResult = await terminateSandbox(projectData.containerId)

  if (!cleanupResult.success) {
    log.project('error', 'Container cleanup failed during project deletion', {
      orgId,
      projectId,
      containerId: projectData.containerId,
      operation: 'container-cleanup',
      error: cleanupResult.error,
    })
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Cannot delete project: Failed to terminate associated sandbox. ${cleanupResult.error || 'Unknown error'}`,
    })
  }

  log.project('info', 'Container terminated successfully', {
    orgId,
    projectId,
    containerId: projectData.containerId,
    operation: 'container-cleanup',
  })
}

/**
 * Restore project quota after successful deletion
 */
export async function restoreProjectQuota(
  context: ProjectOperationContext
): Promise<void> {
  const { orgId, projectId } = context

  // This should not fail the deletion operation even if quota restoration fails
  const [, quotaRestoreError] = await tryCatch(async () => {
    const quotaRestoreResult = await restoreProjectQuotaOnDeletion(orgId)

    if (!quotaRestoreResult.success) {
      log.project('error', 'Quota restoration failed after project deletion', {
        orgId,
        projectId,
        operation: 'quota-restore',
        error: quotaRestoreResult.error,
      })
      // Log error but don't throw - project deletion should still be considered successful
    }
  })

  if (quotaRestoreError) {
    log.project('error', 'Unexpected error during quota restoration', {
      orgId,
      projectId,
      operation: 'quota-restore',
      error:
        quotaRestoreError instanceof Error
          ? quotaRestoreError.message
          : String(quotaRestoreError),
    })
    // Don't throw here - project deletion was successful, quota restoration is a bonus
  }
}

/**
 * Log project operation start with standardized format
 */
export function logProjectOperation(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: ProjectOperationContext | ProjectCreationContext,
  additionalData?: Record<string, any>,
  error?: Error
): void {
  const logData: Record<string, any> = {
    orgId: context.orgId,
    operation: context.operation,
    ...additionalData,
  }

  if ('projectId' in context) {
    logData.projectId = context.projectId
  }

  if ('userId' in context) {
    logData.userId = context.userId
  }

  log.project(level, message, logData, error)
}

/**
 * Cleanup Workers for Platforms deployment when project is deleted
 * This function attempts to delete the deployed worker but doesn't block project deletion if it fails
 */
export async function cleanupProjectWorkerDeployment(
  projectData: any,
  context: ProjectOperationContext
): Promise<{
  attempted: boolean
  success: boolean
  workerName?: string
  error?: string
}> {
  const { orgId, projectId, operation } = context

  // Check if project has a deployment URL (indicating a deployed worker)
  if (!projectData.productionDeployUrl) {
    logProjectOperation('info', 'No deployment URL found, skipping worker cleanup', context)
    return {
      attempted: false,
      success: true, // No worker to clean up is considered success
    }
  }

  // Worker name generation only needs projectId (format: {projectId}-worker)

  logProjectOperation('info', 'Starting Workers for Platforms cleanup', context)

  const [result, error] = await tryCatch(async () => {
    return await deleteProjectWorker(projectId, {
      orgId,
      operation,
    })
  })

  if (error) {
    logProjectOperation('error', 'Worker cleanup failed with exception', context, error)
    return {
      attempted: true,
      success: false,
      error: error.message || 'Unknown error during worker cleanup'
    }
  }

  if (result.success) {
    logProjectOperation('info', 'Worker cleanup completed successfully', context)
  } else {
    logProjectOperation('warn', 'Worker cleanup failed', context)
  }

  return {
    attempted: true,
    success: result.success,
    workerName: result.workerName,
    error: result.error?.message
  }
}
