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
  FileDiffType, 
  ThinkingMessageType as ThinkingMsgType, 
  PlanMessageType as PlanMsgType, 
  DiffMessageType as DiffMsgType, 
  CommandMessageType as CommandMsgType 
} from '@libra/common';

// Define base message type interface
export interface BaseMessage {
  type: string;
  content?: string | { text?: string; thinking?: string };
  data?: any;
  message?: string;
  attachment?: {
    key: string;
    name: string;
    type: string;
  };
}

// Extended message type interface with specific properties
export interface DiffMessage extends BaseMessage {
  diff?: FileDiffType[];
  planId?: string;
}

export interface CommandMessage extends BaseMessage {
  command?: string;
}

// File change definition
export interface FileChange {
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

// Main properties interface
interface MessageGroupProps {
  messages: BaseMessage[];
  onFileClick: (path: string) => void;
  isLoading?: boolean;
}

// Type guard functions
export const isThinkingMessage = (message: BaseMessage): message is ThinkingMsgType => 
  message.type === 'thinking' || (message.data && (message.type === 'thinking-start' || message.data.type === 'thinking'));

export const isPlanMessage = (message: BaseMessage): message is PlanMsgType => 
  message.type === 'plan';

export const isDiffMessage = (message: BaseMessage): message is DiffMessage => 
  message.type === 'diff';

export const isCommandMessage = (message: BaseMessage): message is CommandMessage => 
  message.type === 'command'; 