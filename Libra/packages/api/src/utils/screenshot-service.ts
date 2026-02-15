/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot-service.ts
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

import { tryCatch, log } from '@libra/common'
import { getCdnScreenshotUploadUrl } from '@libra/common'
import { getDbAsync } from '@libra/db'
import { project } from '@libra/db/schema/project-schema'
import { eq } from 'drizzle-orm'
import { getSandboxInstance } from './container'
import { withDbCleanup } from './project'

/**
 * Screenshot service for handling preview URL screenshots
 * Integrates with sandbox abstraction layer, Cloudflare Browser Rendering, and CDN storage
 */

interface ScreenshotServiceOptions {
  projectId: string
  planId: string
  userId: string
  organizationId: string
  requestHeaders?: HeadersInit
  previewUrl?: string // Optional pre-prepared preview URL
}

interface ScreenshotResult {
  success: boolean
  screenshotUrl?: string
  error?: string
}

/**
 * Main screenshot service function
 * Handles the complete workflow: sandbox -> preview URL -> screenshot -> CDN -> database
 */
export async function captureAndStoreScreenshot(
  options: ScreenshotServiceOptions
): Promise<ScreenshotResult> {
  const { projectId, planId, userId, organizationId, requestHeaders, previewUrl } = options

  log.project('info', 'Screenshot service started', {
    projectId,
    planId,
    userId,
    organizationId,
    hasPreviewUrl: !!previewUrl,
    operation: 'screenshot_service'
  })

  try {
    let finalPreviewUrl = ''

    if (previewUrl) {
      // Use the pre-prepared preview URL (from container with synced message history)
      finalPreviewUrl = previewUrl
      log.project('info', 'Using pre-prepared preview URL', {
        projectId,
        previewUrl: finalPreviewUrl,
        operation: 'screenshot_service'
      })
    }

    log.project('info', 'Preview URL obtained', {
      projectId,
      previewUrl: finalPreviewUrl,
      operation: 'screenshot_service'
    })

    // Step 4: Check if screenshot already exists for this planId
    // This is an optimization - if it fails, we'll just proceed with new screenshot
    // Skip this check for now due to authentication issues, proceed directly to screenshot
    const existingScreenshot = await checkExistingScreenshot(planId, requestHeaders)
    if (existingScreenshot) {
      log.project('info', 'Screenshot already exists, using existing one', {
        projectId,
        planId,
        existingKey: existingScreenshot,
        operation: 'screenshot_service'
      })

      // Update project with existing screenshot URL
      const screenshotUrl = `${getCdnScreenshotUploadUrl().replace('/screenshot', '')}/image/${existingScreenshot}`
      await updateProjectPreviewImage(projectId, screenshotUrl)

      return {
        success: true,
        screenshotUrl
      }
    }

    log.project('info', 'No existing screenshot found, proceeding with new screenshot', {
      projectId,
      planId,
      operation: 'screenshot_service'
    })

    // Step 5: Take screenshot using Cloudflare Browser Rendering
    // Ensure URL has proper protocol
    let normalizedUrl = finalPreviewUrl
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`

      log.project('info', 'URL normalized for screenshot', {
        projectId,
        originalUrl: finalPreviewUrl,
        normalizedUrl,
        operation: 'screenshot_service'
      })
    }

    const screenshotDataUrl = await takeScreenshotWithCloudflare(normalizedUrl)
    if (!screenshotDataUrl) {
      throw new Error('Failed to capture screenshot with Cloudflare Browser Rendering')
    }

    log.project('info', 'Screenshot captured successfully', {
      projectId,
      dataUrlLength: screenshotDataUrl.length,
      operation: 'screenshot_service'
    })

    // Step 6: Upload screenshot to CDN
    const cdnResult = await uploadScreenshotToCDN(screenshotDataUrl, planId, requestHeaders)
    if (!cdnResult.success || !cdnResult.key) {
      throw new Error(`Failed to upload screenshot to CDN: ${cdnResult.error}`)
    }

    log.project('info', 'Screenshot uploaded to CDN', {
      projectId,
      screenshotKey: cdnResult.key,
      operation: 'screenshot_service'
    })

    // Step 7: Update project previewImageUrl in database
    const screenshotUrl = `${getCdnScreenshotUploadUrl().replace('/screenshot', '')}/image/${cdnResult.key}`
    await updateProjectPreviewImage(projectId, screenshotUrl)

    log.project('info', 'Screenshot service completed successfully', {
      projectId,
      screenshotUrl,
      operation: 'screenshot_service'
    })

    return {
      success: true,
      screenshotUrl
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    log.project('error', 'Screenshot service failed', {
      projectId,
      planId,
      operation: 'screenshot_service',
      error: errorMessage
    }, error instanceof Error ? error : new Error(errorMessage))

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Check if screenshot already exists for planId (similar to frontend implementation)
 */
async function checkExistingScreenshot(
  planId: string,
  requestHeaders?: HeadersInit
): Promise<string | null> {
  const [result, error] = await tryCatch(async () => {
    const cdnUrl = getCdnScreenshotUploadUrl().replace('/screenshot', '')
    const fullUrl = `${cdnUrl}/screenshot/${planId}`

    log.project('info', 'Checking existing screenshot', {
      planId,
      cdnUrl,
      fullUrl,
      operation: 'check_existing_screenshot'
    })

    const headers: Record<string, string> = {}

    // Pass request headers for authentication
    if (requestHeaders) {
      if (requestHeaders instanceof Headers) {
        const cookieHeader = requestHeaders.get('cookie')
        if (cookieHeader) {
          headers.cookie = cookieHeader
        }
      } else if (typeof requestHeaders === 'object') {
        const cookieHeader = (requestHeaders as Record<string, string>).cookie
        if (cookieHeader) {
          headers.cookie = cookieHeader
        }
      }
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (response.ok) {
      const data = await response.json() as { key: string }
      return data.key
    }

    if (response.status === 404) {
      return null
    }

    throw new Error(`Failed to check existing screenshot: ${response.status}`)
  })

  if (error) {
    log.project('warn', 'Failed to check existing screenshot, will proceed with new screenshot', {
      planId,
      cdnUrl: getCdnScreenshotUploadUrl().replace('/screenshot', ''),
      operation: 'check_existing_screenshot',
      error: error.message
    }, error)
    // Return null to indicate no existing screenshot found, proceed with new screenshot
    return null
  }

  return result
}

/**
 * Take screenshot using Cloudflare Browser Rendering API
 */
async function takeScreenshotWithCloudflare(url: string): Promise<string | null> {
  const [result, error] = await tryCatch(async () => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN

    if (!accountId || !apiToken) {
      throw new Error('Cloudflare credentials not configured')
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          screenshotOptions: {
            fullPage: false,
            omitBackground: false
          },
          viewport: {
            width: 1280,
            height: 720
          },
          gotoOptions: {
            waitUntil: 'networkidle0',
            timeout: 30000
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Cloudflare Browser Rendering API error: ${response.status} ${errorText}`)
    }

    // Convert response to base64 data URL
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:image/png;base64,${base64}`
  })

  if (error) {
    log.project('error', 'Cloudflare screenshot failed', {
      url,
      operation: 'cloudflare_screenshot',
      error: error.message
    }, error)
    return null
  }

  return result
}

/**
 * Upload screenshot to CDN storage
 */
async function uploadScreenshotToCDN(
  dataUrl: string,
  planId: string,
  requestHeaders?: HeadersInit
): Promise<{ success: boolean; key?: string; error?: string }> {
  const [result, error] = await tryCatch(async () => {
    const cdnUrl = getCdnScreenshotUploadUrl()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Pass request headers for authentication (similar to AI route pattern)
    if (requestHeaders) {
      // Pass important authentication headers
      if (requestHeaders instanceof Headers) {
        const cookieHeader = requestHeaders.get('cookie')
        if (cookieHeader) {
          headers.cookie = cookieHeader
        }

        const authHeader = requestHeaders.get('authorization')
        if (authHeader) {
          headers.authorization = authHeader
        }
      } else if (Array.isArray(requestHeaders)) {
        // Handle array format
        for (const [key, value] of requestHeaders) {
          if (key.toLowerCase() === 'cookie' || key.toLowerCase() === 'authorization') {
            headers[key.toLowerCase()] = value
          }
        }
      } else if (typeof requestHeaders === 'object') {
        // Handle object format
        const cookieHeader = (requestHeaders as Record<string, string>).cookie
        if (cookieHeader) {
          headers.cookie = cookieHeader
        }

        const authHeader = (requestHeaders as Record<string, string>).authorization
        if (authHeader) {
          headers.authorization = authHeader
        }
      }
    }

    const response = await fetch(cdnUrl, {
      method: 'POST',
      headers,
      credentials: 'include', // Include credentials like the frontend implementation
      body: JSON.stringify({
        dataUrl,
        planId,
        format: 'png'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`CDN upload failed: ${response.status} ${errorText}`)
    }

    const result = await response.json() as { key: string }
    return {
      success: true,
      key: result.key
    }
  })

  if (error) {
    log.project('error', 'CDN screenshot upload failed', {
      planId,
      operation: 'cdn_upload',
      error: error.message
    }, error)

    return {
      success: false,
      error: error.message
    }
  }

  return result
}

/**
 * Update project previewImageUrl in database
 */
async function updateProjectPreviewImage(projectId: string, screenshotUrl: string): Promise<void> {
  const [, error] = await tryCatch(async () => {
    await withDbCleanup(async (db) => {
      await db
        .update(project)
        .set({ previewImageUrl: screenshotUrl })
        .where(eq(project.id, projectId))

      log.project('info', 'Project preview image updated', {
        projectId,
        screenshotUrl,
        operation: 'database_update'
      })
    })
  })

  if (error) {
    log.project('error', 'Failed to update project preview image', {
      projectId,
      screenshotUrl,
      operation: 'database_update',
      error: error.message
    }, error)
    throw error
  }
}
