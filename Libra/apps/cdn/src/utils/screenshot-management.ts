/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot-management.ts
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

/**
 * Screenshot management utilities for CDN service
 * Handles planId to screenshot key mapping and R2 screenshot operations
 * Separate from regular file management to distinguish between AI-readable images and page documentation
 */

import { log, tryCatch } from '@libra/common'

// KV key prefix for screenshot mappings
const SCREENSHOT_MAPPING_PREFIX = 'screenshot:'

// TTL for screenshot mappings (90 days in seconds)
const SCREENSHOT_MAPPING_TTL = 90 * 24 * 60 * 60

/**
 * Get screenshot key associated with a planId from KV storage
 */
export async function getScreenshotByPlanId(kv: KVNamespace, planId: string): Promise<string | null> {
  const [screenshotKey, error] = await tryCatch(async () => {
    const key = `${SCREENSHOT_MAPPING_PREFIX}${planId}`
    const screenshotKey = await kv.get(key)
    
    if (screenshotKey) {
      log.cdn('info', 'Screenshot mapping retrieved successfully', {
        operation: 'get_screenshot_by_plan_id',
        planId,
        screenshotKey
      })
    }
    
    return screenshotKey
  })

  if (error) {
    log.cdn('error', 'Error getting screenshot mapping', {
      operation: 'get_screenshot_by_plan_id',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return null
  }

  return screenshotKey
}

/**
 * Set screenshot key mapping for a planId in KV storage
 */
export async function setScreenshotMapping(
  kv: KVNamespace,
  planId: string,
  screenshotKey: string
): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    const key = `${SCREENSHOT_MAPPING_PREFIX}${planId}`
    await kv.put(key, screenshotKey, { expirationTtl: SCREENSHOT_MAPPING_TTL })
    
    log.cdn('info', 'Screenshot mapping set successfully', {
      operation: 'set_screenshot_mapping',
      planId,
      screenshotKey,
      ttl: SCREENSHOT_MAPPING_TTL
    })
    
    return true
  })

  if (error) {
    log.cdn('error', 'Error setting screenshot mapping', {
      operation: 'set_screenshot_mapping',
      planId,
      screenshotKey
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return result
}

/**
 * Delete screenshot key mapping for a planId from KV storage
 */
export async function deleteScreenshotMapping(kv: KVNamespace, planId: string): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    const key = `${SCREENSHOT_MAPPING_PREFIX}${planId}`
    await kv.delete(key)
    
    log.cdn('info', 'Screenshot mapping deleted successfully', {
      operation: 'delete_screenshot_mapping',
      planId
    })
    
    return true
  })

  if (error) {
    log.cdn('error', 'Error deleting screenshot mapping', {
      operation: 'delete_screenshot_mapping',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return result
}

/**
 * Delete a screenshot from R2 bucket
 */
export async function deleteScreenshotFromR2(bucket: R2Bucket, screenshotKey: string): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    await bucket.delete(screenshotKey)
    
    log.cdn('info', 'Screenshot deleted from R2 successfully', {
      operation: 'delete_screenshot_r2',
      screenshotKey
    })
    
    return true
  })

  if (error) {
    log.cdn('error', 'Error deleting screenshot from R2', {
      operation: 'delete_screenshot_r2',
      screenshotKey
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return result
}

/**
 * Check if a screenshot exists in R2 bucket
 */
export async function screenshotExistsInR2(bucket: R2Bucket, screenshotKey: string): Promise<boolean> {
  const [exists, error] = await tryCatch(async () => {
    const object = await bucket.head(screenshotKey)
    const exists = object !== null
    
    log.cdn('info', 'Screenshot existence check completed', {
      operation: 'screenshot_exists_r2',
      screenshotKey,
      exists
    })
    
    return exists
  })

  if (error) {
    log.cdn('error', 'Error checking screenshot existence in R2', {
      operation: 'screenshot_exists_r2',
      screenshotKey
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return exists
}

/**
 * Handle screenshot storage logic
 * 1. Check if planId has existing screenshot mapping
 * 2. If exists, delete old screenshot from R2 (non-blocking)
 * 3. Upload new screenshot to R2
 * 4. Update KV mapping
 */
export async function handleScreenshotStorage(
  kv: KVNamespace,
  bucket: R2Bucket,
  planId: string,
  newScreenshotKey: string,
  screenshotBuffer: Uint8Array,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  const [result, error] = await tryCatch(async () => {
    log.cdn('info', 'Screenshot storage operation started', {
      operation: 'handle_screenshot_storage',
      planId,
      newScreenshotKey,
      bufferSize: screenshotBuffer.length,
      contentType
    })

    // Step 1: Check for existing screenshot mapping
    const existingScreenshotKey = await getScreenshotByPlanId(kv, planId)

    // Step 2: If there's an existing screenshot, try to delete it (non-blocking)
    if (existingScreenshotKey && existingScreenshotKey !== newScreenshotKey) {
      log.cdn('info', 'Existing screenshot found, attempting cleanup', {
        operation: 'handle_screenshot_storage',
        planId,
        existingScreenshotKey,
        newScreenshotKey
      })

      // Delete old screenshot (don't block on failure)
      const deleteSuccess = await deleteScreenshotFromR2(bucket, existingScreenshotKey)
      if (!deleteSuccess) {
        log.cdn('warn', 'Failed to delete old screenshot, continuing with upload', {
          operation: 'handle_screenshot_storage',
          planId,
          existingScreenshotKey
        })
      }
    }

    // Step 3: Upload new screenshot to R2
    // Note: Screenshots are already optimized by the browser capture process
    // Additional compression may not provide significant benefits
    await bucket.put(newScreenshotKey, screenshotBuffer, {
      httpMetadata: { contentType },
    })
    
    log.cdn('info', 'Screenshot uploaded to R2 successfully', {
      operation: 'handle_screenshot_storage',
      planId,
      newScreenshotKey,
      bufferSize: screenshotBuffer.length
    })

    // Step 4: Update KV mapping
    const mappingSuccess = await setScreenshotMapping(kv, planId, newScreenshotKey)
    if (!mappingSuccess) {
      log.cdn('error', 'Failed to update KV mapping after successful screenshot upload', {
        operation: 'handle_screenshot_storage',
        planId,
        newScreenshotKey
      })
      return {
        success: false,
        error: 'Failed to update screenshot mapping',
      }
    }

    log.cdn('info', 'Screenshot storage completed successfully', {
      operation: 'handle_screenshot_storage',
      planId,
      newScreenshotKey
    })

    return { success: true }
  })

  if (error) {
    log.cdn('error', 'Error during screenshot storage', {
      operation: 'handle_screenshot_storage',
      planId,
      newScreenshotKey
    }, error instanceof Error ? error : new Error(String(error)))
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during screenshot storage',
    }
  }

  return result
}

/**
 * Handle complete screenshot cleanup for a planId
 * 1. Get screenshot key from KV mapping
 * 2. Delete screenshot from R2 bucket
 * 3. Delete KV mapping
 */
export async function handleScreenshotCleanup(
  kv: KVNamespace,
  bucket: R2Bucket,
  planId: string
): Promise<{ success: boolean; error?: string; screenshotKey?: string }> {
  const [result, error] = await tryCatch(async () => {
    log.cdn('info', 'Screenshot cleanup operation started', {
      operation: 'handle_screenshot_cleanup',
      planId
    })

    // Step 1: Get existing screenshot mapping
    const existingScreenshotKey = await getScreenshotByPlanId(kv, planId)
    if (!existingScreenshotKey) {
      log.cdn('info', 'No screenshot found for cleanup', {
        operation: 'handle_screenshot_cleanup',
        planId
      })
      return {
        success: true,
        error: 'No screenshot found for this planId',
      }
    }


    // Step 2: Delete screenshot from R2 bucket
    const r2DeleteSuccess = await deleteScreenshotFromR2(bucket, existingScreenshotKey)
    if (!r2DeleteSuccess) {
      log.cdn('error', 'Failed to delete screenshot from R2 during cleanup', {
        operation: 'handle_screenshot_cleanup',
        planId,
        existingScreenshotKey
      })
      return {
        success: false,
        error: 'Failed to delete screenshot from storage',
        screenshotKey: existingScreenshotKey,
      }
    }

    // Step 3: Delete KV mapping
    const kvDeleteSuccess = await deleteScreenshotMapping(kv, planId)
    if (!kvDeleteSuccess) {
      log.cdn('error', 'Failed to delete KV mapping during screenshot cleanup', {
        operation: 'handle_screenshot_cleanup',
        planId,
        existingScreenshotKey
      })
      return {
        success: false,
        error: 'Failed to delete screenshot mapping',
        screenshotKey: existingScreenshotKey,
      }
    }

    log.cdn('info', 'Screenshot cleanup completed successfully', {
      operation: 'handle_screenshot_cleanup',
      planId,
      screenshotKey: existingScreenshotKey
    })

    return {
      success: true,
      screenshotKey: existingScreenshotKey,
    }
  })

  if (error) {
    log.cdn('error', 'Error during screenshot cleanup', {
      operation: 'handle_screenshot_cleanup',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during screenshot cleanup',
    }
  }

  return result
}
