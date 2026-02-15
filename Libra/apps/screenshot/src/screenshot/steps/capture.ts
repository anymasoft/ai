/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * capture.ts
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

import { ScreenshotError, ErrorCodes } from '../../utils/errors'
import type { ScreenshotContext, CaptureResult } from '../../types'

/**
 * Capture screenshot using Cloudflare Browser Rendering API
 */
export async function captureScreenshot(
  context: ScreenshotContext
): Promise<CaptureResult> {
  const { params, logger } = context

  logger.info('Starting screenshot capture step', {
    screenshotId: context.screenshotId,
    previewUrl: params.previewUrl
  })

  try {
    // Get preview URL from params (required for URL-based workflow)
    if (!params.previewUrl) {
      throw new ScreenshotError(
        400,
        ErrorCodes.INVALID_REQUEST,
        'previewUrl is required for screenshot capture'
      )
    }

    const previewUrl = params.previewUrl

    logger.info('Capturing screenshot with Cloudflare Browser Rendering', {
      screenshotId: context.screenshotId,
      previewUrl
    })

    // Capture screenshot using Cloudflare Browser Rendering API
    const captureStartTime = Date.now()
    const screenshotDataUrl = await takeScreenshotWithCloudflare(previewUrl, context)
    const captureTime = Date.now() - captureStartTime

    if (!screenshotDataUrl) {
      throw new ScreenshotError(
        500,
        ErrorCodes.SCREENSHOT_CAPTURE_FAILED,
        'Cloudflare Browser Rendering API returned empty result'
      )
    }

    // Calculate image size
    const imageSize = calculateDataUrlSize(screenshotDataUrl)

    logger.info('Screenshot capture completed successfully', {
      screenshotId: context.screenshotId,
      captureTime,
      imageSize,
      previewUrl
    })

    return {
      success: true,
      duration: 0, // Will be set by workflow
      data: {
        screenshotDataUrl,
        captureTime,
        imageSize,
        previewUrl
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error('Screenshot capture failed', {
      screenshotId: context.screenshotId,
      error: errorMessage
    }, error instanceof Error ? error : undefined)

    // Determine appropriate error code
    let errorCode = ErrorCodes.SCREENSHOT_CAPTURE_FAILED
    if (error instanceof ScreenshotError) {
      errorCode = error.errorCode
    }

    throw new ScreenshotError(
      500,
      errorCode,
      `Screenshot capture failed: ${errorMessage}`,
      { originalError: error }
    )
  }
}

/**
 * Take screenshot using Cloudflare Browser Rendering API
 */
async function takeScreenshotWithCloudflare(
  url: string,
  context: ScreenshotContext
): Promise<string> {
  const { env, logger } = context
  const accountId = env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = env.CLOUDFLARE_API_TOKEN

  if (!accountId || !apiToken) {
    throw new ScreenshotError(
      500,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      'Cloudflare API credentials not configured'
    )
  }

  logger.debug('Calling Cloudflare Browser Rendering API', {
    screenshotId: context.screenshotId,
    url,
    accountId: `${accountId.substring(0, 8)}...` // Log partial account ID for debugging
  })

  try {
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
      logger.error('Cloudflare Browser Rendering API error', {
        screenshotId: context.screenshotId,
        status: response.status,
        statusText: response.statusText,
        errorText,
        url
      })

      throw new ScreenshotError(
        502,
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        `Cloudflare Browser Rendering API error: ${response.status} ${errorText}`,
        { status: response.status, responseText: errorText }
      )
    }

    // Convert response to base64 data URL
    const buffer = await response.arrayBuffer()
    // Use btoa for Cloudflare Workers compatibility instead of Buffer
    const uint8Array = new Uint8Array(buffer)
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('')
    const base64 = btoa(binaryString)
    const dataUrl = `data:image/png;base64,${base64}`

    logger.debug('Cloudflare Browser Rendering API call successful', {
      screenshotId: context.screenshotId,
      responseSize: buffer.byteLength,
      dataUrlLength: dataUrl.length
    })

    return dataUrl

  } catch (error) {
    if (error instanceof ScreenshotError) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new ScreenshotError(
      502,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      `Cloudflare Browser Rendering API call failed: ${errorMessage}`,
      { url, originalError: error }
    )
  }
}

/**
 * Calculate the size of a data URL in bytes
 */
function calculateDataUrlSize(dataUrl: string): number {
  // Remove the data URL prefix to get just the base64 data
  const base64Data = dataUrl.split(',')[1] || dataUrl
  
  // Calculate the size of the base64 string
  // Base64 encoding increases size by ~33%, so we need to account for that
  const base64Length = base64Data.length
  const padding = (base64Data.match(/=/g) || []).length
  
  // Calculate actual byte size
  const byteSize = (base64Length * 3) / 4 - padding
  
  return Math.round(byteSize)
}

/**
 * Validate screenshot data URL
 */
export function validateScreenshotDataUrl(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return false
  }

  // Check if it's a valid data URL format
  if (!dataUrl.startsWith('data:image/')) {
    return false
  }

  // Check if it has base64 data
  const parts = dataUrl.split(',')
  if (parts.length !== 2) {
    return false
  }

  const base64Data = parts[1]
  if (!base64Data || base64Data.length === 0) {
    return false
  }

  // Basic base64 validation
  try {
    atob(base64Data)
    return true
  } catch {
    return false
  }
}

/**
 * Get screenshot metadata from data URL
 */
export function getScreenshotMetadata(dataUrl: string): {
  format: string
  size: number
  isValid: boolean
} {
  if (!validateScreenshotDataUrl(dataUrl)) {
    return {
      format: 'unknown',
      size: 0,
      isValid: false
    }
  }

  const parts = dataUrl.split(',')
  const header = parts[0]

  if (!header) {
    return {
      format: 'unknown',
      size: 0,
      isValid: false
    }
  }

  // Extract format from header (e.g., "data:image/png;base64")
  const formatMatch = header.match(/data:image\/([^;]+)/)
  const format: string = formatMatch?.[1] ?? 'unknown'

  const size = calculateDataUrlSize(dataUrl)

  return {
    format,
    size,
    isValid: true
  }
}
