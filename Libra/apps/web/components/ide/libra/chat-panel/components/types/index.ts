/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.ts
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

// Import base types from common package
import type {
  FileDiffType,
  ThinkingMessageType as CommonThinkingMsgType,
  PlanMessageType as CommonPlanMsgType,
  DiffMessageType as CommonDiffMsgType,
  CommandMessageType as CommonCommandMsgType,
  UserMessageType as CommonUserMsgType,
  TimingMessageType as CommonTimingMsgType
} from '@libra/common';

// ====================
// Message type definitions
// ====================

// Base message interface
export interface BaseMessage {
  id?: string;
  type: string;
  content?: string | { text?: string; thinking?: string };
  data?: any;
  message?: string;
  error?: string | Error;
  timestamp?: number;
}

// User message
interface UserMessage extends BaseMessage {
  type: 'user';
  content: string;
}

// Thinking message - completely refactored to avoid property conflicts
interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
  planId: string; // from CommonThinkingMsgType
}

// Plan message - completely refactored to avoid property conflicts
interface PlanMessage extends BaseMessage {
  type: 'plan';
  planId: string; // from CommonPlanMsgType
}

// Diff message - completely refactored to avoid property conflicts
interface DiffMessage extends BaseMessage {
  type: 'diff';
  diff: FileDiffType[]; // changed to required field, compatible with CommonDiffMsgType
  planId: string; // changed to required field, compatible with CommonDiffMsgType
}

// Command message - completely refactored to avoid property conflicts
interface CommandMessage extends BaseMessage {
  type: 'command';
  command: 'bun install'; // compatible with CommonCommandMsgType
  planId: string; // from CommonCommandMsgType
  packages: string[]; // from CommonCommandMsgType
  description: string; // from CommonCommandMsgType
}

// Timing message - for recording message group creation time
interface TimingMessage extends BaseMessage {
  type: 'timing';
  planId: string; // from CommonTimingMsgType
  timestamp: number; // from CommonTimingMsgType
}

// Message union type
type Message =
  | UserMessage
  | ThinkingMessage
  | PlanMessage
  | DiffMessage
  | CommandMessage
  | TimingMessage;

// ====================
// Message group and loading state definitions
// ====================

// Message group interface
export interface MessageGroup {
  planId?: string;
  messages: BaseMessage[];
}

// Loading stage type
export type LoadingStage = 'thinking' | 'description' | 'actions' | 'complete';

// Detailed loading status type
export type DetailedLoadingStatus = 
  | 'thinking_start' 
  | 'thinking_progress' 
  | 'thinking_complete' 
  | 'description_start' 
  | 'description_progress' 
  | 'description_complete' 
  | 'actions_start' 
  | 'actions_progress' 
  | 'actions_complete' 
  | 'completed' 
  | 'error' 
  | null;

// ====================
// UI component type definitions
// ====================

// File change definition
interface FileChange {
  path: string;
  type: string;
  additions: number;
  deletions: number;
}

// Tab type definition
export type TabType = 'plan' | 'thinking' | 'commands' | 'files' | 'none';

// Tab definition interface
export interface TabDefinition {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

// ====================
// Component Props type definitions
// ====================

// AI model definition - import from main config to maintain consistency
import type { AIModel } from '@/configs/ai-models'

// Note: ChatInputAreaProps is defined in ../types.ts to avoid duplication

// ====================
// Type guard functions
// ====================

// Type guard functions
export const isUserMessage = (message: BaseMessage): message is UserMessage => 
  message.type === 'user';

export const isThinkingMessage = (message: BaseMessage): message is ThinkingMessage => 
  message.type === 'thinking' || (message.data && (message.type === 'thinking-start' || message.data.type === 'thinking'));

export const isPlanMessage = (message: BaseMessage): message is PlanMessage => 
  message.type === 'plan';

export const isDiffMessage = (message: BaseMessage): message is DiffMessage => 
  message.type === 'diff';

export const isCommandMessage = (message: BaseMessage): message is CommandMessage =>
  message.type === 'command';

export const isTimingMessage = (message: BaseMessage): message is TimingMessage =>
  message.type === 'timing';

// Message group type guard - add undefined check
export const isUserGroup = (group: MessageGroup): boolean => {
  return group.messages.length > 0 && !!group.messages[0] && isUserMessage(group.messages[0]);
};