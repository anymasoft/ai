/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * upload.ts
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

import {createRoute} from '@hono/zod-openapi'
import {log, logger, LogLevel} from '@libra/common'
import {sha256} from 'hono/utils/crypto'
import {getExtension} from 'hono/utils/mime'
import type {z} from 'zod'
import {errorResponseSchema, uploadRequestSchema, uploadResponseSchema} from '../schemas/upload'
import {checkAndUpdateUploadUsage} from '../utils/quota-management'
import {getConfig, uploadConfig} from '../config'
import type {AppContext} from '../types'
import {CDNError, CommonErrors, ErrorCodes, withErrorHandling} from '../utils/error-handler'
import {getStorageBucket, logWithContext} from '../utils/common'
import {sanitizeFileMetadata, validateFile} from '../utils/file-validation'

/**
 * Storage interface for dependency injection
 */
interface StorageProvider {
  uploadFile(key: string, file: File | ArrayBuffer, metadata?: Record<string, any>): Promise<boolean>
  deleteFile(key: string): Promise<boolean>
}

/**
 * R2 Storage implementation
 */
class R2StorageProvider implements StorageProvider {
  constructor(private bucket: R2Bucket) {}

  async uploadFile(key: string, file: File | ArrayBuffer, metadata?: Record<string, any>): Promise<boolean> {
    try {
      const data = file instanceof File ? await file.arrayBuffer() : file
      await this.bucket.put(key, data, {
        httpMetadata: metadata?.httpMetadata,
        customMetadata: metadata?.customMetadata,
      })
      return true
    } catch (error) {
      console.error('R2 upload failed:', error)
      return false
    }
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      await this.bucket.delete(key)
      return true
    } catch (error) {
      console.error('R2 delete failed:', error)
      return false
    }
  }
}

/**
 * Create storage provider based on available bindings
 */
function createStorageProvider(c: AppContext): StorageProvider {
  const bucket = getStorageBucket(c)
  return new R2StorageProvider(bucket)
}

// Define the upload route with OpenAPI specification
export const uploadRoute = createRoute({
  method: 'put',
  path: '/upload',
  summary: 'Upload an image file',
  description:
    'Upload an image file to R2 storage with optional width and height parameters for resizing',
  tags: ['Images'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: uploadRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Image uploaded successfully',
      content: {
        'text/plain': {
          schema: uploadResponseSchema.shape.key,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid input data',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - Valid session required',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: 'Too Many Requests - Upload quota exceeded',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

// Upload route handler implementation with dependency injection
export const uploadHandler = withErrorHandling(async (c: AppContext) => {
    const requestId = c.get('requestId')
    logWithContext('info', 'Upload request processing', { operation: 'upload', requestId }, c)
    
    // Initialize storage provider
    const storageProvider = createStorageProvider(c)
    
    const data = (await c.req.parseBody()) as z.infer<typeof uploadRequestSchema>

    const config = getConfig(c)
    const file: File = data.image
    const planId: string = data.planId
    const arrayBuffer = await file.arrayBuffer()
    
    // Sanitize file metadata
    const sanitizedMetadata = sanitizeFileMetadata(file)
    
    // Comprehensive file validation
    const validationResult = await validateFile(file, arrayBuffer, {
      allowedMimeTypes: uploadConfig.getAllowedMimeTypes(config),
      maxFileSize: uploadConfig.getMaxFileSize(config)
    })
    
    if (!validationResult.valid) {
      log.cdn('warn', 'File validation failed', {
        operation: 'upload',
        fileName: sanitizedMetadata.name,
        declaredType: file.type,
        error: validationResult.error?.message,
        requestId
      })
      throw validationResult.error || new Error('File validation failed')
    }

    const actualMimeType = validationResult.actualMimeType || 'application/octet-stream'
    const extension = getExtension(actualMimeType) ?? 'png'
    
    log.cdn('info', 'File validation successful', {
      operation: 'upload',
      fileName: sanitizedMetadata.name,
      actualMimeType,
      fileSize: file.size,
      extension,
      requestId
    })

    // Validate required fields
    if (!planId) {
      log.cdn('warn', 'Upload validation failed: missing planId', {
        operation: 'upload',
        validation: 'planId',
        requestId
      })
      throw new CDNError(
        400,
        ErrorCodes.MISSING_REQUIRED_FIELD,
        'planId is required',
        { field: 'planId' }
      )
    }

    log.cdn('info', 'Upload validation successful', {
      operation: 'upload',
      planId,
      fileSize: file.size,
      fileType: actualMimeType,
      dimensions: data.width && data.height ? `${data.width}x${data.height}` : 'original',
      requestId
    })

    // Check and deduct upload quota before processing file
    log.cdn('info', 'Checking and deducting upload quota', { operation: 'upload', planId, requestId })
    const quotaSuccess = await checkAndUpdateUploadUsage(c)
    if (!quotaSuccess) {
      log.cdn('warn', 'Upload quota exceeded or deduction failed', {
        operation: 'upload',
        planId,
        requestId
      })
      throw CommonErrors.quotaExceeded('upload')
    }

    log.cdn('info', 'Upload quota deducted successfully', {
      operation: 'upload',
      planId,
      requestId
    })

    let key: string

    if (data.width && data.height) {
      key = `${await sha256(arrayBuffer)}_${data.width}x${data.height}.${extension}`
    } else {
      key = `${await sha256(arrayBuffer)}.${extension}`
    }

    log.cdn('info', 'File processing completed', {
      operation: 'upload',
      planId,
      fileKey: key,
      fileSize: arrayBuffer.byteLength,
      requestId
    })

    // Use storage provider for file upload
    const uploadSuccess = await storageProvider.uploadFile(key, file, {
      httpMetadata: {
        contentType: actualMimeType,
      },
      customMetadata: {
        planId,
        originalName: sanitizedMetadata.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    if (!uploadSuccess) {
      log.cdn('error', 'Upload failed during file storage', {
        operation: 'upload',
        planId,
        fileKey: key,
        requestId
      })
      throw CommonErrors.storageError('file upload')
    }

    log.cdn('info', 'Upload completed successfully', {
      operation: 'upload',
      planId,
      fileKey: key,
      requestId
    })

    return c.text(key, 200)
})
