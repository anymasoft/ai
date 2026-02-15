/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * image.ts
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
import { log } from '@libra/common'
import { imageParamsSchema, notFoundResponseSchema } from '../schemas/image'
import type { AppContext } from '../types'
import { CommonErrors, withErrorHandling } from '../utils/error-handler'
import { getConfig, cacheConfig } from '../config'
import { createPublicCorsMiddleware } from '../middleware/cors'

// Define the image retrieval route with OpenAPI specification
export const imageRoute = createRoute({
  method: 'get',
  path: '/image/{key}',
  summary: 'Retrieve an image by key',
  description: 'Retrieve an uploaded image from R2 storage using its unique key',
  tags: ['Images'],
  request: {
    params: imageParamsSchema
  },
  responses: {
    200: {
      description: 'Image retrieved successfully',
      content: {
        'image/*': {
          schema: {
            type: 'string',
            format: 'binary',
            description: 'The image file content'
          }
        }
      },
      headers: {
        'Content-Type': {
          description: 'MIME type of the image',
          schema: {
            type: 'string',
            example: 'image/jpeg'
          }
        },
        'Cache-Control': {
          description: 'Cache control header',
          schema: {
            type: 'string',
            example: 'public, max-age=2592000'
          }
        }
      }
    },
    404: {
      description: 'Image not found',
      content: {
        'application/json': {
          schema: notFoundResponseSchema
        }
      }
    }
  }
})

// Image route handler implementation
export const imageHandler = withErrorHandling(async (c: AppContext) => {
    const key = c.req.param('key')
    log.cdn('info', 'Image retrieval request started', {
      operation: 'image_retrieve',
      imageKey: key
    })

    const config = getConfig(c)
    const bucket = c.env.BUCKET || c.env.R2
    
    if (!bucket) {
      throw CommonErrors.storageError('bucket not configured')
    }

    const object = await bucket.get(key)
    if (!object) {
      log.cdn('warn', 'Image not found in storage', {
        operation: 'image_retrieve',
        imageKey: key
      })
      throw CommonErrors.notFound('Image')
    }

    const data = await object.arrayBuffer()
    const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'

    const cacheHeaders = cacheConfig.getCacheHeaders(config, true)

    log.cdn('info', 'Image retrieval completed successfully', {
      operation: 'image_retrieve',
      imageKey: key,
      contentType,
      size: data.byteLength,
      cacheMaxAge: config.CACHE_MAX_AGE
    })

    return c.body(data, 200, {
      'Content-Type': contentType,
      ...cacheHeaders
    })
})
