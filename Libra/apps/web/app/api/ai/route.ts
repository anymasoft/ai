/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * route.ts
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
import { headers } from 'next/headers'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { streamGenerateApp, streamGenerateAppForFileEdit } from '@/ai/generate'
import { streamParsePlan } from '@/ai/parser'
import { aiMessageSchema } from '@libra/api'
import { initAuth } from '@libra/auth/auth-server'
import { log, tryCatch, getCdnImageUrl, DatabaseError } from '@libra/common'
import { getDbAsync } from '@libra/db'
import { project, projectAsset } from '@libra/db/schema/project-schema'

// Type definitions are now handled by the schema validation

// Utility function to convert ReadableStream<string> to AsyncIterable<string>
async function* streamToAsyncIterable(
  stream: ReadableStream<string>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (value) {
        yield value
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// Function to fetch image data from CDN
async function fetchImageFromCDN(
  key: string,
  requestHeaders: HeadersInit
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const [result, error] = await tryCatch(async () => {
    const imageUrl = getCdnImageUrl(key)

    log.ai('info', 'Fetching image from CDN', {
      operation: 'fetchImageFromCDN',
      imageKey: key,
      imageUrl,
    })

    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: requestHeaders,
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      log.ai('warn', 'Failed to fetch image from CDN', {
        operation: 'fetchImageFromCDN',
        imageKey: key,
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    const data = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    log.ai('info', 'Successfully fetched image from CDN', {
      operation: 'fetchImageFromCDN',
      imageKey: key,
      contentType,
      dataSize: data.byteLength,
    })

    return { data, contentType }
  })

  if (error) {
    log.ai(
      'error',
      'Error fetching image from CDN',
      {
        operation: 'fetchImageFromCDN',
        imageKey: key,
      },
      error as Error
    )
    return null
  }

  return result
}

// Database operation wrapper for Next.js API routes
async function withDbConnection<T>(operation: (db: any) => Promise<T>): Promise<T> {
  const db = await getDbAsync()

  try {
    return await operation(db)
  } finally {
    // Clean up database connection
    const [cloudflareContext, contextError] = await tryCatch(async () =>
      getCloudflareContext({ async: true })
    )
    if (!contextError && cloudflareContext?.ctx) {
      cloudflareContext.ctx.waitUntil(db.$client.end())
    }
  }
}

// Save project asset information to database
async function saveProjectAsset(
  organizationId: string,
  projectId: string,
  planId: string,
  attachmentKey: string
): Promise<{ success: boolean; error?: string }> {
  const [result, error] = await tryCatch(async () => {
    return await withDbConnection(async (db) => {
      log.ai('info', 'Saving project asset to database', {
        operation: 'saveProjectAsset',
        organizationId,
        projectId,
        planId,
        attachmentKey,
      })

      await db.insert(projectAsset).values({
        organizationId,
        projectId,
        planId,
        attachmentKey,
      })

      log.ai('info', 'Project asset saved successfully', {
        operation: 'saveProjectAsset',
        organizationId,
        projectId,
        planId,
        attachmentKey,
      })

      return { success: true }
    })
  })

  if (error) {
    log.ai('error', 'Failed to save project asset', {
      operation: 'saveProjectAsset',
      organizationId,
      projectId,
      planId,
      attachmentKey,
    }, error instanceof Error ? error : new Error(String(error)))

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }

  return result
}

export async function POST(request: Request) {
  const [result, outerError] = await tryCatch(async () => {
    log.ai('info', 'AI route request started', {
      operation: 'POST',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    const auth = await initAuth()
    const session = await auth.api.getSession({
      headers: await headers(),
    })
    const user = session?.user

    if (!user) {
      log.ai('warn', 'Unauthorized AI route access attempt', {
        operation: 'POST',
      })
      return new Response('Unauthorized', { status: 401 })
    }

    // Get user's organization ID for AI message deduction check
    const orgId = (session?.session as unknown as { activeOrganizationId: string })
      ?.activeOrganizationId
    if (!orgId) {
      log.ai('warn', 'AI route access without organization ID', {
        operation: 'POST',
        userId: user.id,
      })
      return new Response('Organization ID is required', { status: 400 })
    }

    log.ai('info', 'AI route authentication successful', {
      operation: 'POST',
      userId: user.id,
      organizationId: orgId,
    })

    const [requestResult, requestError] = await tryCatch(async () => {
      // Extract and validate the request body
      const rawRequestData = await request.json()

      // Validate request data against schema
      const validationResult = aiMessageSchema.safeParse(rawRequestData)
      if (!validationResult.success) {
        const errorMessage = validationResult.error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        log.ai('warn', 'AI route request validation failed', {
          operation: 'POST',
          userId: user.id,
          organizationId: orgId,
          validationErrors: errorMessage,
        })
        throw new Error(`Validation failed: ${errorMessage}`)
      }

      const requestData = validationResult.data

      log.ai('info', 'AI route request data parsed', {
        operation: 'POST',
        userId: user.id,
        organizationId: orgId,
        projectId: requestData.projectId,
        planId: requestData.planId,
        messageLength: requestData.message.length,
        selectedItemsCount: requestData.selectedItems?.length || 0,
        hasAttachment: !!requestData.attachment,
        selectedModelId: requestData.selectedModelId,
        isDirectModification: requestData.isDirectModification,
        targetFilename: requestData.targetFilename,
      })

      // Use the message field instead of the prompt field
      const userMessage = requestData.message
      const planId = requestData.planId
      const projectId = requestData.projectId
      // Get selected items
      const selectedItems = requestData.selectedItems || []
      // Get attachment info
      const attachment = requestData.attachment
      // Get selected model ID
      const selectedModelId = requestData.selectedModelId
      // Get direct modification flag
      const isDirectModification = requestData.isDirectModification
      // Get target filename for focused editing
      const targetFilename = requestData.targetFilename

      // Handle image attachment
      let imageData: { data: ArrayBuffer; contentType: string } | null = null
      if (attachment?.key) {
        log.ai('info', 'Processing image attachment', {
          operation: 'POST',
          userId: user.id,
          projectId: requestData.projectId,
          planId: requestData.planId,
          attachmentKey: attachment.key,
          attachmentName: attachment.name,
          attachmentType: attachment.type,
        })

        // Pass request headers and cookies to CDN
        const requestHeaders: HeadersInit = {}
        const originalHeaders = await headers()

        // Pass important authentication headers
        const cookieHeader = originalHeaders.get('cookie')
        if (cookieHeader) {
          requestHeaders.cookie = cookieHeader
        }

        // Pass other necessary headers
        const authHeader = originalHeaders.get('authorization')
        if (authHeader) {
          requestHeaders.authorization = authHeader
        }

        imageData = await fetchImageFromCDN(attachment.key, requestHeaders)

        if (!imageData) {
          log.ai('warn', 'Failed to fetch image attachment', {
            operation: 'POST',
            userId: user.id,
            projectId: requestData.projectId,
            planId: requestData.planId,
            attachmentKey: attachment.key,
          })
        } else {
          // Save attachment information to database
          log.ai('info', 'Saving attachment to project assets database', {
            operation: 'POST',
            userId: user.id,
            organizationId: orgId,
            projectId: requestData.projectId,
            planId: requestData.planId,
            attachmentKey: attachment.key,
          })

          const saveResult = await saveProjectAsset(
            orgId,
            requestData.projectId,
            requestData.planId,
            attachment.key
          )

          if (!saveResult.success) {
            log.ai('warn', 'Failed to save attachment to database', {
              operation: 'POST',
              userId: user.id,
              organizationId: orgId,
              projectId: requestData.projectId,
              planId: requestData.planId,
              attachmentKey: attachment.key,
              error: saveResult.error,
            })
            // Note: We don't throw here to avoid disrupting AI generation
            // The attachment file is already uploaded and can be used
          } else {
            log.ai('info', 'Attachment saved to database successfully', {
              operation: 'POST',
              userId: user.id,
              organizationId: orgId,
              projectId: requestData.projectId,
              planId: requestData.planId,
              attachmentKey: attachment.key,
            })
          }
        }
      }

      // Reset deployment status when user submits AI request
      // This allows new deployments after AI modifications
      try {
        const db = await getDbAsync()
        await db.update(project)
          .set({ deploymentStatus: 'idle' })
          .where(eq(project.id, requestData.projectId))

        log.ai('info', 'Reset deployment status for AI request', {
          operation: 'POST',
          projectId: requestData.projectId,
          userId: user.id,
          organizationId: orgId,
        })
      } catch (dbError) {
        // Log error but don't fail the AI request
        log.ai('warn', 'Failed to reset deployment status', {
          operation: 'POST',
          projectId: requestData.projectId,
          error: dbError instanceof Error ? dbError.message : String(dbError),
        })
      }

      // Use optimized file-focused function for direct modifications with target filename
      log.ai('info', 'Starting AI generation', {
        operation: 'POST',
        userId: user.id,
        organizationId: orgId,
        projectId: requestData.projectId,
        planId: requestData.planId,
        isDirectModification: isDirectModification,
        targetFilename: targetFilename,
        selectedModelId: selectedModelId,
        hasImageData: !!imageData,
      })

      const genStream =
        isDirectModification && targetFilename
          ? await streamGenerateAppForFileEdit(
              userMessage,
              projectId,
              targetFilename,
              selectedItems,
              imageData,
              request.signal
            )
          : await streamGenerateApp(
              userMessage,
              projectId,
              selectedItems,
              imageData, // Pass image data
              request.signal, // Pass AbortController signal
              selectedModelId // Pass selected model ID
            )

      // Convert ReadableStream to AsyncIterable
      const asyncIterable = streamToAsyncIterable(genStream)

      // Get parsed readable stream
      const parsedReadable = await streamParsePlan(asyncIterable, userMessage, planId, projectId)

      log.ai('info', 'AI route request completed successfully', {
        operation: 'POST',
        userId: user.id,
        organizationId: orgId,
        projectId: requestData.projectId,
        planId: requestData.planId,
      })

      return new Response(parsedReadable as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })
    })

    if (requestError) {
      log.ai(
        'error',
        'AI route request processing failed',
        {
          operation: 'POST',
          userId: user?.id,
          organizationId: (session?.session as unknown as { activeOrganizationId: string })
            ?.activeOrganizationId,
          errorMessage: requestError.message,
        },
        requestError
      )

      // Check if it's a validation error
      if (requestError instanceof Error && requestError.message.startsWith('Validation failed:')) {
        return new Response(
          JSON.stringify({
            error: 'Validation Error',
            details: requestError.message,
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }

      // Handle database errors with user-friendly messages
      const errorMessage = 'Error processing request'
      const errorDetails = requestError.message || 'Unknown error'

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          stack: process.env.NODE_ENV === 'development' ? requestError.stack : undefined,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return requestResult
  })

  if (outerError) {
    log.ai(
      'error',
      'AI route authentication or initialization failed',
      {
        operation: 'POST',
      },
      outerError as Error
    )

    // Handle outer errors with user-friendly messages
    let outerErrorMessage = 'Error processing request'

    if (outerError instanceof DatabaseError) {
      outerErrorMessage = outerError.userMessage
    } else if (outerError instanceof Error && outerError.message?.includes('Failed to build AI generation context')) {
      outerErrorMessage = outerError.message
    }

    return new Response(JSON.stringify({ error: outerErrorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  return result
}
