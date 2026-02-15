/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * storage.ts
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

import { eq } from 'drizzle-orm'
import { getDbForHono } from '@libra/db'
import { project } from '@libra/db/schema/project-schema'
import { getCdnScreenshotUploadUrl } from '@libra/common'
import { ScreenshotError, ErrorCodes } from '../../utils/errors'
import type { ScreenshotContext, StorageResult } from '../../types'

/**
 * Store screenshot to CDN and update database
 */
export async function storeScreenshot(
  context: ScreenshotContext
): Promise<StorageResult> {
  const { params, logger, stepResults } = context
  const { projectId, planId } = params

  logger.info('Starting screenshot storage step', {
    screenshotId: context.screenshotId,
    projectId,
    planId
  })

  try {
    // Get screenshot data from previous step
    const captureResult = stepResults?.capture
    if (!captureResult?.success || !captureResult.data?.screenshotDataUrl) {
      throw new ScreenshotError(
        500,
        ErrorCodes.SCREENSHOT_STORAGE_FAILED,
        'No valid screenshot data available from capture step'
      )
    }

    const screenshotDataUrl = captureResult.data.screenshotDataUrl

    logger.info('Uploading screenshot to CDN', {
      screenshotId: context.screenshotId,
      planId,
      dataUrlLength: screenshotDataUrl.length
    })

    // Upload screenshot to CDN
    const uploadStartTime = Date.now()
    const cdnResult = await uploadScreenshotToCdn(screenshotDataUrl, planId, context)
    const cdnUploadTime = Date.now() - uploadStartTime

    if (!cdnResult.success || !cdnResult.key) {
      throw new ScreenshotError(
        500,
        ErrorCodes.SCREENSHOT_STORAGE_FAILED,
        `CDN upload failed: ${cdnResult.error || 'Unknown error'}`
      )
    }

    // Build screenshot URL
    const screenshotUrl = buildScreenshotUrl(cdnResult.key)

    logger.info('Screenshot uploaded to CDN successfully', {
      screenshotId: context.screenshotId,
      screenshotKey: cdnResult.key,
      screenshotUrl,
      cdnUploadTime
    })

    // Update project previewImageUrl in database
    await updateProjectPreviewImage(projectId, screenshotUrl, context)

    logger.info('Screenshot storage completed successfully', {
      screenshotId: context.screenshotId,
      screenshotUrl,
      cdnUploadTime
    })

    return {
      success: true,
      duration: 0, // Will be set by workflow
      data: {
        screenshotKey: cdnResult.key,
        screenshotUrl,
        cdnUploadTime
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Screenshot storage failed', {
      screenshotId: context.screenshotId,
      projectId,
      planId,
      error: errorMessage
    }, error instanceof Error ? error : undefined)

    // Determine appropriate error code
    let errorCode = ErrorCodes.SCREENSHOT_STORAGE_FAILED
    if (error instanceof ScreenshotError) {
      errorCode = error.errorCode
    }

    throw new ScreenshotError(
      500,
      errorCode,
      `Screenshot storage failed: ${errorMessage}`,
      { projectId, planId, originalError: error }
    )
  }
}

/**
 * Upload screenshot to CDN service
 */
async function uploadScreenshotToCdn(
  dataUrl: string,
  planId: string,
  context: ScreenshotContext
): Promise<{ success: boolean; key?: string; error?: string }> {
  const { logger } = context

  try {
    const cdnUrl = getCdnScreenshotUploadUrl()
    
    logger.debug('Uploading to CDN', {
      screenshotId: context.screenshotId,
      cdnUrl,
      planId
    })

    const response = await fetch(cdnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dataUrl,
        planId,
        format: 'png'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `CDN upload failed: ${response.status} ${errorText}`
      }
    }

    const result = await response.json() as { key?: string }

    if (!result.key) {
      return {
        success: false,
        error: 'CDN upload succeeded but no key returned'
      }
    }

    return {
      success: true,
      key: result.key
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('CDN upload request failed', {
      screenshotId: context.screenshotId,
      error: errorMessage
    })

    return {
      success: false,
      error: `CDN upload request failed: ${errorMessage}`
    }
  }
}

/**
 * Build screenshot URL from CDN key
 */
function buildScreenshotUrl(key: string): string {
  const cdnBaseUrl = getCdnScreenshotUploadUrl().replace('/screenshot', '')
  return `${cdnBaseUrl}/image/${key}`
}

/**
 * Update project previewImageUrl in database
 */
async function updateProjectPreviewImage(
  projectId: string,
  screenshotUrl: string,
  context: ScreenshotContext
): Promise<void> {
  const { logger } = context

  try {
    logger.debug('Updating project preview image URL', {
      screenshotId: context.screenshotId,
      projectId,
      screenshotUrl
    })

    // Get database connection
    const db = await getDbForHono({ env: context.env } as any)

    // Update project with new screenshot URL
    await db
      .update(project)
      .set({
        previewImageUrl: screenshotUrl,
        updatedAt: new Date().toISOString()
      })
      .where(eq(project.id, projectId))

    logger.debug('Project preview image URL updated successfully', {
      screenshotId: context.screenshotId,
      projectId,
      screenshotUrl
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Failed to update project preview image URL', {
      screenshotId: context.screenshotId,
      projectId,
      screenshotUrl,
      error: errorMessage
    })

    // Don't throw here - the screenshot was uploaded successfully
    // The database update failure shouldn't fail the entire workflow
    // But we should log it for monitoring
  }
}

/**
 * Validate screenshot upload result
 */
export function validateUploadResult(result: any): boolean {
  return (
    result &&
    typeof result === 'object' &&
    result.success === true &&
    typeof result.key === 'string' &&
    result.key.length > 0
  )
}

/**
 * Generate screenshot key for storage
 */
export function generateScreenshotKey(planId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `screenshots/${planId}/${timestamp}-${random}.png`
}

/**
 * Check if screenshot already exists for planId
 */
export async function checkExistingScreenshot(
  planId: string,
  context: ScreenshotContext
): Promise<string | null> {
  const { logger } = context

  try {
    const cdnUrl = getCdnScreenshotUploadUrl().replace('/screenshot', '')
    const checkUrl = `${cdnUrl}/screenshot/${planId}`

    logger.debug('Checking for existing screenshot', {
      screenshotId: context.screenshotId,
      planId,
      checkUrl
    })

    const response = await fetch(checkUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })

    if (response.ok) {
      const data = await response.json() as { key?: string }
      return data.key || null
    }

    if (response.status === 404) {
      return null
    }

    logger.warn('Unexpected response when checking existing screenshot', {
      screenshotId: context.screenshotId,
      planId,
      status: response.status
    })

    return null

  } catch (error) {
    logger.warn('Failed to check existing screenshot', {
      screenshotId: context.screenshotId,
      planId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Return null on error - we'll proceed with new screenshot
    return null
  }
}
