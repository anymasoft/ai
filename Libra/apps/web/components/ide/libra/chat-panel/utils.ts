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

// Chat panel utility functions

import type { DetailedLoadingStatus } from './types'
import { getCdnUrl, getCdnStaticAssetUrl } from '@libra/common'

/**
 * Check if message is a thinking message
 * @param msg Message object
 * @returns Whether it's a thinking message
 */
const isThinkingMessage = (msg: any): boolean => {
  return msg.type === 'thinking' || (msg.content?.thinking !== undefined);
};

/**
 * Check if message is a plan message
 * @param msg Message object
 * @returns Whether it's a plan message
 */
const isPlanMessage = (msg: any): boolean => {
  return msg.content?.plan !== undefined;
};

/**
 * Check if message is a diff message
 * @param msg Message object
 * @returns Whether it's a diff message
 */
const isDiffMessage = (msg: any): boolean => {
  return msg.content?.diff !== undefined;
};

/**
 * Check if message is a command message
 * @param msg Message object
 * @returns Whether it's a command message
 */
const isCommandMessage = (msg: any): boolean => {
  return msg.content?.command !== undefined;
};

/**
 * Check if message group is a user message group
 * @param group Message group object
 * @returns Whether it's a user message group
 */
export const isUserGroup = (group: { messages: any[] }): boolean => {
  return group.messages.length > 0 && group.messages[0]?.type === 'user';
};

/**
 * Return user-friendly description text based on loading status
 */
export const getLoadingStatusText = (loading: DetailedLoadingStatus): string => {
  switch (loading) {
    case 'thinking_start':
    case 'thinking_progress':
    case 'thinking_complete':
      return 'AI assistant is thinking...';
    case 'description_start':
    case 'description_progress':
    case 'description_complete':
      return 'Analyzing your request...';
    case 'actions_start':
    case 'actions_progress':
    case 'actions_complete':
      return 'Generating solution...';
    case 'error':
      return 'Processing error occurred...';
    case 'complete':
      return 'Processing complete';
    default:
      return 'Processing...';
  }
};



/**
 * Play new message notification sound
 */
export const playNotificationSound = (): void => {
  try {
    const audio = new Audio(getCdnStaticAssetUrl('notification.wav'));
    audio.volume = 0.5;
    audio.play().catch(e => {});
  } catch (error) {
  }
};