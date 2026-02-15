/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-management.ts
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
 * File management utilities for CDN service
 * Handles PlanId to file key mapping and R2 file operations
 */

import { log, tryCatch } from '@libra/common'

// Cloudflare Images API types
interface CloudflareImages {
  input(data: ArrayBuffer | ReadableStream): CloudflareImageInput;
}

interface CloudflareImageInput {
  transform(options: ImageTransformOptions): CloudflareImageInput;
  draw(overlay: CloudflareImageInput, options: ImageDrawOptions): CloudflareImageInput;
  output(options: ImageOutputOptions): Promise<CloudflareImageOutput>;
}

interface CloudflareImageOutput {
  response(): Response;
}

interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | { x: number; y: number };
  quality?: number;
  format?: 'avif' | 'webp' | 'jpeg' | 'png';
  background?: string;
  blur?: number;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  saturation?: number;
  sharpen?: number;
  rotate?: 90 | 180 | 270;
  flip?: 'h' | 'v' | 'hv';
  trim?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    width?: number;
    height?: number;
  };
  border?: {
    color: string;
    width?: number;
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  metadata?: 'copyright' | 'keep' | 'none';
  anim?: boolean;
  compression?: 'fast';
  dpr?: number;
}

interface ImageDrawOptions {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  opacity?: number;
}

interface ImageOutputOptions {
  format?: 'image/avif' | 'image/webp' | 'image/jpeg' | 'image/png' | 'json';
  quality?: number;
}

// KV key prefix for plan mappings
const PLAN_MAPPING_PREFIX = 'plan:'

// TTL for plan mappings (30 days in seconds)
const PLAN_MAPPING_TTL = 1 * 24 * 60 * 60

// Image compression settings
const COMPRESSION_QUALITY = 80

/**
 * Get file key associated with a planId from KV storage
 */
export async function getPlanMapping(kv: KVNamespace, planId: string): Promise<string | null> {
  const [fileKey, error] = await tryCatch(async () => {
    const key = `${PLAN_MAPPING_PREFIX}${planId}`
    const fileKey = await kv.get(key)
    
    if (fileKey) {
      log.cdn('info', 'Plan mapping retrieved successfully', {
        operation: 'get_plan_mapping',
        planId,
        fileKey
      })
    }
    
    return fileKey
  })

  if (error) {
    log.cdn('error', 'Error getting plan mapping', {
      operation: 'get_plan_mapping',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return null
  }

  return fileKey
}

/**
 * Delete file key mapping for a planId from KV storage
 */
export async function deletePlanMapping(kv: KVNamespace, planId: string): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    const key = `${PLAN_MAPPING_PREFIX}${planId}`
    await kv.delete(key)
    
    log.cdn('info', 'Plan mapping deleted successfully', {
      operation: 'delete_plan_mapping',
      planId
    })
    
    return true
  })

  if (error) {
    log.cdn('error', 'Error deleting plan mapping', {
      operation: 'delete_plan_mapping',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return result
}

/**
 * Delete a file from R2 bucket
 */
export async function deleteFileFromR2(bucket: R2Bucket, fileKey: string): Promise<boolean> {
  const [result, error] = await tryCatch(async () => {
    await bucket.delete(fileKey)

    log.cdn('info', 'File deleted from R2 successfully', {
      operation: 'delete_file_r2',
      fileKey
    })

    return true
  })

  if (error) {
    log.cdn('error', 'Error deleting file from R2', {
      operation: 'delete_file_r2',
      fileKey
    }, error instanceof Error ? error : new Error(String(error)))
    return false
  }

  return result
}



/**
 * Handle complete file cleanup for a planId
 * 1. Get file key from KV mapping
 * 2. Delete file from R2 bucket
 * 3. Delete KV mapping
 * This is not an atomic operation
 */
export async function handleFileCleanup(
  kv: KVNamespace,
  bucket: R2Bucket,
  planId: string
): Promise<{ success: boolean; error?: string; fileKey?: string }> {
  const [result, error] = await tryCatch(async () => {
    log.cdn('info', 'File cleanup operation started', {
      operation: 'handle_file_cleanup',
      planId
    })

    // Step 1: Get existing file mapping
    const existingFileKey = await getPlanMapping(kv, planId)
    if (!existingFileKey) {
      log.cdn('info', 'No file found for cleanup', {
        operation: 'handle_file_cleanup',
        planId
      })
      return {
        success: true,
        error: 'No file found for this planId',
      }
    }

    // Step 2: Delete file from R2 bucket
    const r2DeleteSuccess = await deleteFileFromR2(bucket, existingFileKey)
    if (!r2DeleteSuccess) {
      log.cdn('error', 'Failed to delete file from R2 during cleanup', {
        operation: 'handle_file_cleanup',
        planId,
        existingFileKey
      })
      return {
        success: false,
        error: 'Failed to delete file from storage',
        fileKey: existingFileKey,
      }
    }

    // Step 3: Delete KV mapping
    const kvDeleteSuccess = await deletePlanMapping(kv, planId)
    if (!kvDeleteSuccess) {
      log.cdn('error', 'Failed to delete KV mapping during cleanup', {
        operation: 'handle_file_cleanup',
        planId,
        existingFileKey
      })
      return {
        success: false,
        error: 'Failed to delete file mapping',
        fileKey: existingFileKey,
      }
    }

    log.cdn('info', 'File cleanup completed successfully', {
      operation: 'handle_file_cleanup',
      planId,
      fileKey: existingFileKey
    })

    return {
      success: true,
      fileKey: existingFileKey,
    }
  })

  if (error) {
    log.cdn('error', 'Error during file cleanup', {
      operation: 'handle_file_cleanup',
      planId
    }, error instanceof Error ? error : new Error(String(error)))
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during file cleanup',
    }
  }

  return result
}
