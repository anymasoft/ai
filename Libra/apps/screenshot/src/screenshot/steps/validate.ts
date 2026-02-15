/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * validate.ts
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

import { eq, and } from 'drizzle-orm'
import { getDbForHono } from '@libra/db'
import { project } from '@libra/db/schema/project-schema'
import { CommonErrors, validateRequired } from '../../utils/errors'
import type { ScreenshotContext, ValidationResult } from '../../types'

/**
 * Validate permissions and prepare screenshot
 */
export async function validateAndPrepare(
  context: ScreenshotContext
): Promise<ValidationResult> {
  const { params, logger } = context
  const { projectId, planId, orgId, userId } = params

  logger.info('Starting validation step', {
    screenshotId: context.screenshotId,
    projectId,
    planId,
    orgId,
    userId
  })

  try {
    // Validate required parameters
    validateRequired(params, ['projectId', 'planId', 'orgId', 'userId'])

    // Get database connection
    const db = await getDbForHono({ env: context.env } as any)

    // Check if project exists and user has access
    const projectData = await db.select()
      .from(project)
      .where(and(
        eq(project.id, projectId),
        eq(project.organizationId, orgId)
      ))
      .limit(1)

    if (!projectData || projectData.length === 0) {
      throw CommonErrors.projectNotFound(projectId)
    }

    const projectRecord = projectData[0]
    if (!projectRecord) {
      throw CommonErrors.projectNotFound(projectId)
    }

    // Validate organization access
    if (projectRecord.organizationId !== orgId) {
      throw CommonErrors.permissionDenied('Project does not belong to the specified organization')
    }

    // For URL-based screenshots, we don't need to validate message history
    // The screenshot will be taken from the provided URL directly
    logger.info('Project validation completed for URL-based screenshot', {
      screenshotId: context.screenshotId,
      projectId,
      planId,
      hasPreviewUrl: !!params.previewUrl
    })

    // Check for existing screenshot (optional - for deduplication)
    const existingScreenshotUrl = projectRecord.previewImageUrl
    if (existingScreenshotUrl) {
      logger.info('Project already has a screenshot, will replace', {
        screenshotId: context.screenshotId,
        existingUrl: existingScreenshotUrl
      })
    }

    logger.info('Validation completed successfully', {
      screenshotId: context.screenshotId,
      projectExists: true,
      hasPermission: true,
      organizationValid: true,
      previewUrl: params.previewUrl
    })

    return {
      success: true,
      duration: 0, // Will be set by workflow
      data: {
        projectExists: true,
        hasPermission: true,
        organizationValid: true,
        previewUrl: params.previewUrl,
        existingScreenshot: !!existingScreenshotUrl
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Validation failed', {
      screenshotId: context.screenshotId,
      error: errorMessage
    }, error instanceof Error ? error : undefined)

    return {
      success: false,
      duration: 0,
      error: errorMessage,
      data: {
        projectExists: false,
        hasPermission: false,
        organizationValid: false
      }
    }
  }
}

/**
 * Validate screenshot request parameters
 */
export function validateScreenshotParams(params: any): void {
  const requiredFields = ['projectId', 'planId', 'orgId', 'userId']
  
  for (const field of requiredFields) {
    if (!params[field] || typeof params[field] !== 'string' || params[field].trim() === '') {
      throw CommonErrors.missingParameters([field])
    }
  }

  // Validate ID formats (basic validation)
  if (params.projectId.length < 10) {
    throw CommonErrors.invalidRequest('Invalid project ID format')
  }

  if (params.orgId.length < 10) {
    throw CommonErrors.invalidRequest('Invalid organization ID format')
  }

  if (params.userId.length < 10) {
    throw CommonErrors.invalidRequest('Invalid user ID format')
  }

  // Validate planId (can be 'initial' or a valid plan ID)
  if (params.planId !== 'initial' && params.planId.length < 5) {
    throw CommonErrors.invalidRequest('Invalid plan ID format')
  }

  // Validate previewUrl if provided
  if (params.previewUrl) {
    try {
      new URL(params.previewUrl)
    } catch {
      throw CommonErrors.invalidRequest('Invalid preview URL format')
    }
  }
}

/**
 * Check rate limits for screenshot requests
 */
export async function checkRateLimits(
  context: ScreenshotContext
): Promise<boolean> {
  // This is a placeholder for rate limiting logic
  // In a real implementation, you would check against a rate limiting service
  // or database to ensure users don't exceed their screenshot quota
  
  const { params, logger } = context
  
  logger.debug('Checking rate limits', {
    screenshotId: context.screenshotId,
    userId: params.userId,
    orgId: params.orgId
  })

  // For now, always allow (implement actual rate limiting as needed)
  return true
}
