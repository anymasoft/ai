/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-input-styles.ts
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

import { cn } from '@libra/ui/lib/utils';

interface HoverStates {
  mic: boolean;
  edit: boolean;
  image: boolean;
  send: boolean;
}

interface StyleGeneratorProps {
  hoverStates: HoverStates;
  isOverLimit: boolean;
  isSending: boolean;
  message: string;
  isInspectorActive: boolean;
  messageLength: number;
  maxMessageLength: number;
}

export const generateChatInputStyles = ({
  hoverStates,
  isOverLimit,
  isSending,
  message,
  isInspectorActive,
  messageLength,
  maxMessageLength,
}: StyleGeneratorProps) => {
  // Base button classes
  const buttonBaseClasses = "flex items-center justify-center rounded-md transition-colors";
  
  // Tool button classes (microphone, image)
  const toolButtonClasses = (key: keyof HoverStates) => cn(
    buttonBaseClasses,
    "h-10 w-10",
    hoverStates[key]
      ? "text-fg -subtle/50"
      : "text-fg-muted hover:text-fg hover:-subtle/30",
    "dark:text-gray-400 dark:hover:text-gray-200"
  );

  // Send button classes
  const sendButtonClasses = cn(
    buttonBaseClasses,
    "h-10 w-10",
    isOverLimit || (!isSending && message.trim() === '') ? "opacity-50 cursor-not-allowed" : "",
    (isSending || (message.trim() !== '' && !isOverLimit))
      ? "text-accent hover:text-accent-hover"
      : "text-fg-muted",
    "dark:text-gray-300 dark:hover:text-indigo-400",
    (isOverLimit || (!isSending && message.trim() === '')) && "dark:opacity-50"
  );

  // Selector button classes - dashed border to match design
  const selectorButtonClasses = cn(
    buttonBaseClasses,
    "h-10 px-4 gap-2 text-sm font-medium",
    "border border-dashed border-gray-300 -subtle/30 hover:-subtle/60",
    isInspectorActive 
      ? "text-accent border-accent/70"
      : "text-fg-muted hover:text-fg",
    "dark:bg-gray-700/30 dark:hover:bg-gray-700/50 dark:border-gray-500 dark:text-gray-300"
  );

  // Character count text classes
  const counterClasses = cn(
    "text-xs transition-colors absolute right-4 top-2",
    messageLength > maxMessageLength
      ? "text-error-fg font-medium"
      : messageLength > (maxMessageLength * 0.9)
        ? "text-warning-fg"
        : "text-fg-muted",
    "dark:text-gray-400"
  );

  return {
    toolButtonClasses,
    sendButtonClasses,
    selectorButtonClasses,
    counterClasses,
  };
};
