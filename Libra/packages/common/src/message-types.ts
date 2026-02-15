/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * message-types.ts
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

import type {
  CommandMessageType as BaseCommandMessageType,
  DiffMessageType as BaseDiffMessageType,
  HistoryType as BaseHistoryType,
  PlanMessageType as BasePlanMessageType,
  ThinkingMessageType as BaseThinkingMessageType,
  UserMessageType as BaseUserMessageType,
  ScreenshotMessageType as BaseScreenshotMessageType,
  TimingMessageType as BaseTimingMessageType,
  FileDiffType,
  ContentType,
} from './history'

/**
 * Extended user message type with optional content property
 */
export interface UserMessageType extends BaseUserMessageType {
  /** Optional message content field, functionally identical to message field */
  content?: string
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended command message type with optional output property
 */
export interface CommandMessageType extends BaseCommandMessageType {
  /** Command execution output result */
  output?: string
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended diff message type with optional id property
 */
export interface DiffMessageType extends BaseDiffMessageType {
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended plan message type with optional id property
 */
export interface PlanMessageType extends BasePlanMessageType {
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended thinking message type with optional id property
 */
export interface ThinkingMessageType extends BaseThinkingMessageType {
  /** Optional message ID for identifying the message */
  id?: string
  /** Optional thinking status */
  status?: string
  /**
   * Nested content object
   * Some thinking messages may use this structure instead of directly using the content field
   */
  data?: {
    content?: string | { text?: string }
  }
}

/**
 * Extended screenshot message type with optional id property
 */
export interface ScreenshotMessageType extends BaseScreenshotMessageType {
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended timing message type with optional id property
 */
export interface TimingMessageType extends BaseTimingMessageType {
  /** Optional message ID for identifying the message */
  id?: string
}

/**
 * Extended message type union
 */
export type MessageType =
  | UserMessageType
  | DiffMessageType
  | CommandMessageType
  | PlanMessageType
  | ThinkingMessageType
  | ScreenshotMessageType
  | TimingMessageType

/**
 * Extended history record type
 */
export type HistoryType = Array<MessageType>

// Re-export basic types
export type { FileDiffType, ContentType }
