/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot-client.ts
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

import {env} from "@/env.mjs";

/**
 * Frontend screenshot service client for making requests to the screenshot service
 */

interface ScreenshotRequest {
  projectId: string
  planId: string
  orgId: string
  userId: string
  previewUrl?: string
}

interface ScreenshotResponse {
  success: boolean
  screenshotId?: string
  message?: string
  error?: string
}

/**
 * Get screenshot service URL from environment
 */
function getScreenshotServiceUrl(): string {
  return env.NEXT_PUBLIC_SCREENSHOT_URL || 'http://localhost:3009'
}

/**
 * Submit screenshot request to the screenshot service
 */
/**
 * Normalize URL to ensure it has a protocol prefix
 */
function normalizeUrl(url?: string): string | undefined {
  if (!url) return undefined;

  // If URL already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // For localhost URLs, use http:// instead of https://
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return `http://${url}`;
  }

  // For all other URLs, add https:// prefix
  return `https://${url}`;
}

export async function submitScreenshotRequest(
  projectId: string,
  planId: string,
  orgId: string,
  userId: string,
  previewUrl?: string
): Promise<ScreenshotResponse> {
  const screenshotServiceUrl = getScreenshotServiceUrl()

  // Normalize previewUrl to ensure it has a protocol prefix
  const normalizedPreviewUrl = normalizeUrl(previewUrl)


  try {
    const requestBody: ScreenshotRequest = {
      projectId,
      planId,
      orgId,
      userId,
      previewUrl: normalizedPreviewUrl
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Add authentication headers if available
    // Note: In browser environment, cookies are automatically included
    // for same-origin requests or when credentials: 'include' is set

    const response = await fetch(`${screenshotServiceUrl}/screenshot`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      credentials: 'include', // Include cookies for authentication
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Screenshot service error: ${response.status} ${errorText}`)
    }

    const responseData = await response.json() as ScreenshotResponse
    

    return responseData
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    

    return {
      success: false,
      error: errorMessage
    }
  }
}

/**
 * Trigger screenshot for project deployment
 * This is a convenience function that handles the screenshot request
 * after a successful container content update
 */
export async function triggerDeploymentScreenshot(
  projectId: string,
  planId: string | null,
  orgId: string,
  userId: string,
  previewUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // If no planId is provided, generate one based on current timestamp
    const effectivePlanId = planId || `update-${Date.now()}`
    

    const result = await submitScreenshotRequest(
      projectId,
      effectivePlanId,
      orgId,
      userId,
      previewUrl
    )

    if (!result.success) {
      throw new Error(result.error || 'Screenshot request failed')
    }


    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    

    return {
      success: false,
      error: errorMessage
    }
  }
}
