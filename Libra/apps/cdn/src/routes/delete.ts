/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * delete.ts
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

import { createRoute } from '@hono/zod-openapi'
import { tryCatch, log } from '@libra/common'
import { deleteParamsSchema, deleteResponseSchema, deleteErrorResponseSchema } from '../schemas/delete'
import { handleFileCleanup } from '../utils/file-management'
import { restoreUploadQuotaOnDeletion } from '../utils/quota-management'
import type { AppContext } from '../types'

// Define the file deletion route with OpenAPI specification
export const deleteRoute = createRoute({
  method: 'delete',
  path: '/file/{planId}',
  summary: 'Delete files by plan ID',
  description: 'Delete all files associated with a specific plan ID from R2 storage',
  tags: ['Files'],
  security: [{ bearerAuth: [] }],
  request: {
    params: deleteParamsSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: deleteResponseSchema
        }
      },
      description: 'File deleted successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: deleteErrorResponseSchema
        }
      },
      description: 'Bad request - invalid plan ID'
    },
    401: {
      content: {
        'application/json': {
          schema: deleteErrorResponseSchema
        }
      },
      description: 'Unauthorized - authentication required'
    },
    500: {
      content: {
        'application/json': {
          schema: deleteErrorResponseSchema
        }
      },
      description: 'Internal server error'
    }
  }
})

// Delete route handler implementation
export const deleteHandler = async (c: AppContext) => {
  const [result, error] = await tryCatch(async () => {
    const planId = c.req.param('planId')

    // Validate planId
    if (!planId || planId.trim() === '') {
      return c.json({
        error: 'Bad Request',
        message: 'planId is required'
      }, 400)
    }


    // Handle file cleanup using the utility function
    const cleanupResult = await handleFileCleanup(c.env.KV, c.env.BUCKET, planId)

    if (!cleanupResult.success) {
      log.cdn('error', 'File cleanup failed', {
        operation: 'delete',
        planId,
        error: cleanupResult.error
      })
      return c.json({
        error: 'Internal Server Error',
        message: cleanupResult.error || 'Failed to delete file'
      }, 500)
    }

    log.cdn('info', 'File deleted successfully', {
      operation: 'delete',
      planId,
      fileKey: cleanupResult.fileKey
    })

    // Restore upload quota after successful deletion
    log.cdn('info', 'Restoring upload quota', { operation: 'delete', planId, fileKey: cleanupResult.fileKey })
    const quotaRestore = await restoreUploadQuotaOnDeletion(c)
    if (!quotaRestore.success) {
      log.cdn('error', 'Failed to restore upload quota', {
        operation: 'delete',
        planId,
        fileKey: cleanupResult.fileKey,
        error: quotaRestore.error
      })
      // Note: File was deleted successfully, but quota restoration failed
      // This is a non-critical error - we still return success to user
      // but log the issue for monitoring
    } else {
      log.cdn('info', 'Upload quota restored successfully', {
        operation: 'delete',
        planId,
        fileKey: cleanupResult.fileKey,
        restoredTo: quotaRestore.restoredTo,
        planName: quotaRestore.planName
      })
    }

    return c.json({
      success: true,
      message: 'File deleted successfully',
      fileKey: cleanupResult.fileKey
    })
  })

  if (error) {
    console.error('[FileDelete] Delete error:', error)
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to delete file'
    }, 500)
  }

  return result
}
