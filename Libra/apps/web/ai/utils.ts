/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * utils.ts
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

import { env } from '@/env.mjs'
import { SystemPromptEnhanced } from './prompts/enhanced-system-prompt'
import { systemPrompt } from './prompts/system-prompt'
import type { ImageData, MessageContent, SelectedItem } from './types'

// ============================================================================
// Utility Functions
// ============================================================================

const CHINESE_REGEX = /[\u4E00-\u9FFF]/

/**
 * Check if text contains Chinese characters
 */
export const containsChinese = (text: string): boolean => {
  return CHINESE_REGEX.test(text)
}

/**
 * Prepare system prompt based on environment configuration
 */
export const prepareSystemPrompt = (): string => {
  return env.ENHANCED_PROMPT ? SystemPromptEnhanced() : systemPrompt
}

/**
 * Build user prompt with XML files and user request
 */
export const buildUserPrompt = (files: string, query: string, knowledge?: string | null): string => {
  const userRequestXml = `<userRequest>${query}</userRequest>`
  const knowledgeSection = knowledge 
    ? `\n<projectKnowledge>\n${knowledge}\n</projectKnowledge>\n` 
    : ''
  
  return `Following below are the project XML and the user request.

${files}
${knowledgeSection}
${userRequestXml}`.trim()
}

/**
 * Validate abort signal and throw error if aborted
 */
export const validateAbortSignal = (abortSignal?: AbortSignal): void => {
  if (abortSignal?.aborted) {
    throw new Error('Request was aborted')
  }
}

/**
 * Build selected elements info string
 */
export const buildSelectedElementsInfo = (selectedItems: SelectedItem[]): string => {
  if (!selectedItems || selectedItems.length === 0) return ''
  return `\n\nSelected elements info:\n${JSON.stringify(selectedItems, null, 2)}`
}

/**
 * Build message content array with optional image
 */
export const buildMessageContent = (
  basePrompt: string,
  imageData?: ImageData | null
): MessageContent[] => {
  const content: MessageContent[] = [{ type: 'text', text: basePrompt }]

  if (imageData) {
    content.push({
      type: 'image',
      image: new Uint8Array(imageData.data),
      mimeType: imageData.contentType,
    })
  }

  return content
}
