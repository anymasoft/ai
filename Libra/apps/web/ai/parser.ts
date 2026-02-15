/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * parser.ts
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

import Path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import { mergeFiles } from './files' // Import file processing related functions
import type { ActionChunkType, DescriptionChunkType, ThinkingChunkType } from './type'
import type { StreamingCallbackType, TagType } from './xml-parser'
import { StreamingXMLParser } from './xml-parser'
import { log, tryCatch } from '@libra/common'
// AI will propose a plan, which is expected to contain both file and command actions.
// Example plan format:

/*
 * Example of a plan:
 *
 * <plan>
 *   <action type="file">
 *     <description>{Short justification of changes. Be as brief as possible, like a commit message}</description>
 *     <file filename="package.json">
 *         <![CDATA[{entire file contents}]]]]>
 *     </file>
 *   </action>
 *   <action type="file">
 *     <description>
 *         <![CDATA[{Short description of changes}]]>
 *     </description>
 *     <file filename="./App.tsx">
 *       <![CDATA[
 *         {... file contents (ALL OF THE FILE)}
 *       ]]>
 *     </file>
 *   </action>
 *
 *  <action type="command">
 *    <description>
 *      <![CDATA[
 *        Install required packages for state management and routing
 *      ]]>
 *    </description>
 *    <commandType>bun install</commandType>
 *    <package>react-router-dom</package>
 *  </action>
 *   ...
 * </plan>
 */

interface FileAction {
  type: 'file'
  dirname: string
  basename: string
  path: string
  modified: string
  original: string | null // null if this is a new file. Consider using an enum for 'edit' | 'create' | 'delete' instead.
  description: string
}

type NpmInstallCommand = {
  type: 'command'
  command: 'npm install'
  packages: string[]
  description: string
}

// Later we can add more commands. For now, we only support npm install
type Command = NpmInstallCommand

interface Plan {
  // The high level description of the plan
  // Will be shown to the user above the diff box.
  id: string
  query: string
  description: string
  thinking?: string
  actions: (FileAction | Command)[]
}

interface ParsedResult {
  plan: {
    planDescription: string
    thinking?: string
    action:
      | {
          '@_type': string
          description: string
          file?: { '@_filename': string; '@_isNew'?: string; '#text': string }
          commandType?: string
          package?: string | string[]
        }[]
      | {
          '@_type': string
          description: string
          file?: { '@_filename': string; '@_isNew'?: string; '#text': string }
          commandType?: string
          package?: string | string[]
        }
  }
}

async function parsePlan(response: string, app: any, query: string, planId: string): Promise<Plan> {
  const [result, error] = await tryCatch(async () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
    })
    const result = parser.parse(response) as ParsedResult

    if (!result.plan) {
      throw new Error('Invalid response: missing plan tag')
    }

    // Create base plan structure
    const plan: Plan = {
      id: planId,
      query,
      actions: [],
      description: result.plan.planDescription,
      ...(result.plan.thinking && { thinking: result.plan.thinking }),
    }

    // Ensure actions is always an array
    const actions = Array.isArray(result.plan.action) ? result.plan.action : [result.plan.action]

    // Process each action
    for (const action of actions) {
      if (action['@_type'] === 'file' && action.file) {
        const filePath = action.file['@_filename']
        // Check if it is a new file (explicitly marked as isNew="true")
        const isNewFile = action.file['@_isNew'] === 'true'
        // For files not explicitly marked, check if the path matches common page file naming
        const isPossiblyExistingPage = filePath.includes('/pages/') && !isNewFile

        // If explicitly marked as new file, original is null; for possibly existing page files or others not explicitly marked, assume they exist
        const originalContent = isNewFile ? null : ''

        plan.actions.push({
          type: 'file',
          path: filePath,
          dirname: Path.dirname(filePath),
          basename: Path.basename(filePath),
          modified: action.file['#text'],
          original: originalContent,
          description: action.description,
        })
      } else if (action['@_type'] === 'command' && action.commandType === 'npm install') {
        if (!action.package) {
          continue
        }

        plan.actions.push({
          type: 'command',
          command: 'npm install',
          packages: Array.isArray(action.package) ? action.package : [action.package],
          description: action.description,
        })
      }
    }

    return plan
  })

  if (error) {
    throw new Error('Failed to parse XML response')
  }

  return result
}

function getPackagesToInstall(plan: Plan): string[] {
  return plan.actions
    .filter(
      (action): action is NpmInstallCommand =>
        action.type === 'command' && action.command === 'npm install'
    )
    .flatMap((action) => action.packages)
}

/**
 * Optimized streaming parsing function.
 * Process received XML data fragments in real time and return parsing results immediately, no longer waiting for the entire response to complete.
 * thinking and planDescription are streamed immediately, but only saved to the database once when completed.
 */
export async function streamParsePlan(
  stream: AsyncIterable<string>,
  query: string,
  planId: string,
  projectId: string
) {
  // Get current file map
  let fileMapPromise: Promise<{ fileMap: Record<string, any> }> | null = null

  const [, mergeError] = tryCatch(() => {
    // Use projectId to get file map, if not provided use planId
    const idToUse = projectId

    // Asynchronously get file map
    fileMapPromise = mergeFiles(idToUse)
    return true
  })

  if (mergeError) {
    log.ai('error', 'Failed to merge files', { error: mergeError })
  }

  let fileMap: Record<string, any> = {}

  return new ReadableStream({
    async start(controller) {
      // Get file map
      if (fileMapPromise) {
        const [result, error] = await tryCatch(async () => {
          return await fileMapPromise
        })

        if (!error && result) {
          fileMap = result.fileMap
        }
      }

      const parser = new StreamingXMLParser({
        // Handle complete tags (file actions, etc.)
        async onTag(tag) {
          const [, error] = await tryCatch(async () => {
            // Only process non-streaming tags
            if (tag.name === 'action') {
              await processActionTag(tag, controller, planId, fileMap)
            }
            // Note: thinking and planDescription tags are handled by onStreaming for complete content
            return true
          })

          if (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            controller.enqueue(
              `${JSON.stringify({
                type: 'error',
                data: { content: `Error occurred while processing tag: ${errorMessage}` },
              })}\n`
            )
          }
        },

        // Handle streaming content (thinking and planDescription)
        async onStreaming(tagName, content, isComplete) {
          const [, error] = await tryCatch(async () => {
            if (tagName === 'planDescription') {
              if (!isComplete && content.trim()) {
                // Only send incremental content to frontend for display, do not save to database
                const chunk = {
                  type: 'description',
                  planId: planId,
                  data: { content: content },
                } as DescriptionChunkType
                controller.enqueue(`${JSON.stringify(chunk)}\n`)
              } else if (isComplete && content.trim()) {
                // When completed, send full content for database saving
                const chunk = {
                  type: 'description_complete',
                  planId: planId,
                  data: { content: content },
                } as DescriptionChunkType
                controller.enqueue(`${JSON.stringify(chunk)}\n`)
              }
            } else if (tagName === 'thinking') {
              if (!isComplete && content.trim()) {
                // Only send incremental content to frontend for display, do not save to database
                const chunk = {
                  type: 'thinking',
                  planId: planId,
                  data: { content: content },
                } as ThinkingChunkType
                controller.enqueue(`${JSON.stringify(chunk)}\n`)
              } else if (isComplete && content.trim()) {
                // When completed, send full content for database saving
                const chunk = {
                  type: 'thinking_complete',
                  planId: planId,
                  data: { content: content },
                } as ThinkingChunkType
                controller.enqueue(`${JSON.stringify(chunk)}\n`)

              }
            }

            return true
          })

          if (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            controller.enqueue(
              `${JSON.stringify({
                type: 'error',
                data: {
                  content: `Error occurred while processing streaming content: ${errorMessage}`,
                },
              })}\n`
            )
          }
        },
      })

      // Handle input stream
      const [, streamError] = await tryCatch(async () => {
        for await (const chunk of stream) {
          parser.parse(chunk)
        }
        controller.close()
        return true
      })

      if (streamError) {
        const errorMessage = streamError instanceof Error ? streamError.message : 'Unknown error'
        controller.enqueue(
          `${JSON.stringify({
            type: 'error',
            data: { content: `Error occurred while parsing streaming data: ${errorMessage}` },
          })}\n`
        )
        controller.error(streamError)
      }
    },
  })
}

/**
 * Handle parsed action tags (only after complete parsing)
 */
async function processActionTag(
  tag: TagType,
  controller: ReadableStreamDefaultController,
  planId: string,
  fileMap: Record<string, any> = {}
): Promise<void> {
  const descriptionTag = tag.children.find((t) => t.name === 'description')
  const description = descriptionTag?.content ?? ''
  const type = tag.attributes["type"] as string



  if (type === 'file') {
    const fileTag = tag.children.find((t) => t.name === 'file')

    if (!fileTag) {
      console.error('File action is missing file tag')
      return
    }

    const filePath = fileTag.attributes["filename"] as string
    // Check isNew attribute to determine if it is a new file
    const isNewFile = fileTag.attributes["isNew"] === 'true'

    let originalContent: string | null = null

    if (isNewFile) {
      // New files have no original content
      originalContent = null
    } else {
      // Get existing file content from file map
      // Use optional chaining to avoid null reference errors
      if (fileMap?.[filePath]?.content) {
        originalContent = fileMap[filePath].content
      } else {
        // If file not found in map and not explicitly marked as new, use empty string as default
        originalContent = ''
      }
    }

    const chunk = {
      type: 'action',
      planId: planId,
      data: {
        type: 'file',
        description,
        path: filePath,
        dirname: Path.dirname(filePath),
        basename: Path.basename(filePath),
        modified: fileTag.content,
        original: originalContent,
        isNew: isNewFile,
      },
    } as ActionChunkType

    controller.enqueue(`${JSON.stringify(chunk)}\n`)
    return
  }

  if (type === 'command') {
    const commandTag = tag.children.find((t) => t.name === 'commandType')

    if (!commandTag) {
      return
    }

    const packageTags = tag.children.filter((t) => t.name === 'package')

    const chunk = {
      type: 'action',
      planId: planId,
      data: {
        type: 'command',
        description,
        command: commandTag.content,
        packages: packageTags.map((t) => t.content),
      },
    } as ActionChunkType

    controller.enqueue(`${JSON.stringify(chunk)}\n`)
    return
  }
}
