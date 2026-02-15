/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

// ============================================================================
// Type Definitions for AI Generation
// ============================================================================

export interface ImageData {
  data: ArrayBuffer
  contentType: string
}

export interface AttachmentData {
  key: string
  name: string
  type: string
}

export interface SelectedItem {
  [key: string]: any
}

export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  image: Uint8Array
  mimeType: string
}

export type MessageContent = TextContent | ImageContent

export interface GenerationMessage {
  role: 'user'
  content: MessageContent[]
}

export interface GenerationConfig {
  isFileEdit: boolean
  targetFilename?: string
  quotaType: 'ai' | 'enhance'
  modelId?: string
}

export interface ProjectData {
  id: string
  organizationId: string
  messageHistory: string | null
  knowledge?: string | null
}

export interface GenerationContext {
  projectData: ProjectData
  userPlan: string
  fileMap: Record<string, any>
  xmlFiles: string
}
