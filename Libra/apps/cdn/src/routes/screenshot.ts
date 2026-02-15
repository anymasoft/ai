/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot.ts
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
import { sha256 } from 'hono/utils/crypto'
import { log, tryCatch } from '@libra/common'
import { screenshotRequestSchema, screenshotResponseSchema, screenshotRetrieveSchema, errorResponseSchema } from '../schemas/screenshot'
import { handleScreenshotStorage, getScreenshotByPlanId } from '../utils/screenshot-management'
import type { AppContext } from '../types'

// Define the screenshot storage route with OpenAPI specification
export const screenshotStoreRoute = createRoute({
  method: 'post',
  path: '/screenshot',
  summary: 'Store a screenshot for a planId',
  description: 'Store a screenshot image associated with a planId for page documentation',
  tags: ['Screenshots'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: screenshotRequestSchema
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Screenshot stored successfully',
      content: {
        'application/json': {
          schema: screenshotResponseSchema
        }
      }
    },
    400: {
      description: 'Bad request - Invalid data',
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      }
    },
    401: {
      description: 'Unauthorized - Valid session required',
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      }
    }
  }
})

// Define the screenshot retrieval route
export const screenshotRetrieveRoute = createRoute({
  method: 'get',
  path: '/screenshot/{planId}',
  summary: 'Retrieve screenshot key by planId',
  description: 'Get the screenshot key associated with a planId (public endpoint for iframe access)',
  tags: ['Screenshots'],
  // Remove security requirement for this endpoint to allow iframe access
  request: {
    params: screenshotRetrieveSchema
  },
  responses: {
    200: {
      description: 'Screenshot key retrieved successfully',
      content: {
        'application/json': {
          schema: screenshotResponseSchema
        }
      }
    },
    404: {
      description: 'Screenshot not found for planId',
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorResponseSchema
        }
      }
    }
  }
})

// Screenshot storage handler implementation
export const screenshotStoreHandler = async (c: AppContext) => {
  const [result, error] = await tryCatch(async () => {
    log.cdn('info', 'Screenshot storage request started', { operation: 'screenshot_store' })
    const { dataUrl, planId, format = 'png' } = await c.req.json()

    // Validate required fields
    if (!dataUrl || !planId) {
      log.cdn('warn', 'Screenshot validation failed: missing required fields', {
        operation: 'screenshot_store',
        validation: 'required_fields',
        hasDataUrl: !!dataUrl,
        hasPlanId: !!planId
      })
      return c.json({
        error: 'Bad Request',
        message: 'dataUrl and planId are required'
      }, 400)
    }

    // Validate dataUrl format
    if (!dataUrl.startsWith('data:image/')) {
      log.cdn('warn', 'Screenshot validation failed: invalid dataUrl format', {
        operation: 'screenshot_store',
        planId,
        validation: 'dataUrl_format'
      })
      return c.json({
        error: 'Bad Request',
        message: 'Invalid dataUrl format - must be a valid data URL'
      }, 400)
    }


    // Convert dataUrl to buffer
    const base64Data = dataUrl.split(',')[1]
    if (!base64Data) {
      log.cdn('warn', 'Screenshot validation failed: missing base64 data', {
        operation: 'screenshot_store',
        planId,
        validation: 'base64_data'
      })
      return c.json({
        error: 'Bad Request',
        message: 'Invalid dataUrl - missing base64 data'
      }, 400)
    }

    log.cdn('info', 'Screenshot validation successful', {
      operation: 'screenshot_store',
      planId,
      format,
      dataSize: base64Data.length
    })

    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    // Generate unique key for screenshot including planId for uniqueness
    const imageHash = await sha256(buffer)
    const planIdHash = await sha256(new TextEncoder().encode(planId))
    const combinedHash = await sha256(new TextEncoder().encode(`${imageHash}_${planIdHash}`))
    const key = `screenshot_${combinedHash}.${format}`

    log.cdn('info', 'Screenshot processing completed', {
      operation: 'screenshot_store',
      planId,
      screenshotKey: key,
      bufferSize: buffer.length
    })


    // Handle screenshot storage using utility function
    const storageResult = await handleScreenshotStorage(
      c.env.KV,
      c.env.BUCKET,
      planId,
      key,
      buffer,
      `image/${format}`
    )

    if (!storageResult.success) {
      log.cdn('error', 'Screenshot storage failed', {
        operation: 'screenshot_store',
        planId,
        screenshotKey: key
      }, new Error(storageResult.error || 'Storage operation failed'))
      return c.json({
        error: 'Internal Server Error',
        message: storageResult.error || 'Failed to store screenshot'
      }, 500)
    }

    log.cdn('info', 'Screenshot storage completed successfully', {
      operation: 'screenshot_store',
      planId,
      screenshotKey: key
    })

    return c.json({
      key,
      planId,
      timestamp: Date.now()
    })
  })

  if (error) {
    log.cdn('error', 'Screenshot storage error occurred', {
      operation: 'screenshot_store'
    }, error instanceof Error ? error : new Error(String(error)))
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to store screenshot'
    }, 500)
  }

  return result
}

// Screenshot retrieval handler implementation
export const screenshotRetrieveHandler = async (c: AppContext) => {
  const [result, error] = await tryCatch(async () => {
    log.cdn('info', 'Screenshot retrieval request started', { operation: 'screenshot_retrieve' })
    const planId = c.req.param('planId')

    if (!planId) {
      log.cdn('warn', 'Screenshot retrieval validation failed: missing planId', {
        operation: 'screenshot_retrieve',
        validation: 'planId'
      })
      return c.json({
        error: 'Bad Request',
        message: 'planId is required'
      }, 400)
    }


    // Get screenshot key from KV storage
    const screenshotKey = await getScreenshotByPlanId(c.env.KV, planId)

    if (!screenshotKey) {
      log.cdn('warn', 'Screenshot not found for planId', {
        operation: 'screenshot_retrieve',
        planId
      })
      return c.json({
        error: 'Not Found',
        message: `No screenshot found for planId: ${planId}`
      }, 404)
    }

    log.cdn('info', 'Screenshot retrieval completed successfully', {
      operation: 'screenshot_retrieve',
      planId,
      screenshotKey
    })


    return c.json({
      key: screenshotKey,
      planId,
      timestamp: Date.now()
    })
  })

  if (error) {
    log.cdn('error', 'Screenshot retrieval error occurred', {
      operation: 'screenshot_retrieve'
    }, error instanceof Error ? error : new Error(String(error)))
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve screenshot'
    }, 500)
  }

  return result
}
