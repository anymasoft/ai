/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * generate.ts
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

import { tryCatch } from '@libra/common'
import { streamText } from 'ai'
import { buildGenerationContext, fetchProjectData, validateQuota } from './context'
import { buildProviderOptions, selectModel } from './models'
import { myProvider } from './providers'
// Import types from separate module
import type { GenerationConfig, GenerationMessage, ImageData, SelectedItem } from './types.js'
import {
  buildMessageContent,
  buildSelectedElementsInfo,
  buildUserPrompt,
  prepareSystemPrompt,
  validateAbortSignal,
} from './utils'

// ============================================================================
// Core Generation Functions
// ============================================================================

export const generateStreamResponse = async (
  prompt: string,
  projectId: string,
  selectedItems: SelectedItem[] = [],
  imageData?: ImageData | null,
  abortSignal?: AbortSignal,
  config: GenerationConfig = { isFileEdit: false, quotaType: 'ai' }
) => {
  const [result, error] = await tryCatch(async () => {
    validateAbortSignal(abortSignal)

    // Fetch and validate project data
    const projectData = await fetchProjectData(projectId)

    // Check quota based on operation type
    await validateQuota(projectData.organizationId, config.quotaType)

    // Build generation context
    const context = await buildGenerationContext(projectData, config)

    // Prepare prompts and messages
    const systemPromptText = prepareSystemPrompt()
    const selectedElementsInfo = buildSelectedElementsInfo(selectedItems)
    const userPrompt = buildUserPrompt(context.xmlFiles, prompt + selectedElementsInfo, context.projectData.knowledge)
    const messageContent = buildMessageContent(userPrompt, imageData)

    const messages: GenerationMessage[] = [
      {
        role: 'user',
        content: messageContent,
      },
    ]

    // Select and validate model
    const selectedModel = selectModel(context.userPlan, config.modelId, config.isFileEdit)

    // Generate response
    const streamResult = streamText({
      model: myProvider.languageModel(selectedModel),
      system: systemPromptText,
      messages,
      ...(abortSignal && { abortSignal }),
      providerOptions: buildProviderOptions(),
    })

    return streamResult.textStream
  })

  if (error) {
    const operation = config.isFileEdit ? 'streamGenerateAppForFileEdit' : 'streamGenerateApp'
    console.error(`Error in ${operation}:`, error)
    throw error
  }

  return result
}

/**
 * Streamed application response generation.
 * Refactored version: ensures thinking and plan data are transmitted in real time, and code data is transmitted completely.
 */
export async function streamGenerateApp(
  prompt: string,
  projectId: string,
  selectedItems: SelectedItem[] = [],
  imageData?: { data: ArrayBuffer; contentType: string } | null,
  abortSignal?: AbortSignal,
  selectedModelId?: string
) {
  return generateStreamResponse(prompt, projectId, selectedItems, imageData, abortSignal, {
    isFileEdit: false,
    quotaType: 'ai',
    modelId: selectedModelId || '',
  })
}

/**
 * Optimized file-focused application response generation for element editing.
 * This function follows the same structure as streamGenerateApp but processes only the target file.
 */
export async function streamGenerateAppForFileEdit(
  prompt: string,
  projectId: string,
  targetFilename: string,
  selectedItems: SelectedItem[] = [],
  imageData?: { data: ArrayBuffer; contentType: string } | null,
  abortSignal?: AbortSignal
) {
  return generateStreamResponse(prompt, projectId, selectedItems, imageData, abortSignal, {
    isFileEdit: true,
    targetFilename,
    quotaType: 'enhance',
  })
}
