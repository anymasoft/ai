/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-ui-helpers.ts
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

'use client'

import { useCallback, useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Chat interface UI helper hooks
 */
export const useUiHelpers = ({
  textareaRef,
  scrollAreaRef
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
}) => {
  // Auto-adjust textarea height
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to get correct scrollHeight
      textarea.style.height = 'auto';
      
      // Set new height, but limit maximum height
      const newHeight = Math.min(textarea.scrollHeight, 120); // Limit maximum height to 120px
      textarea.style.height = `${newHeight}px`;
      
      // Ensure scroll to bottom
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [textareaRef]);
  
  // Fix scroll to bottom issue
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current;
      
      // Calculate target scroll position
      const scrollPosition = scrollElement.scrollHeight - scrollElement.clientHeight;
      
      // Use requestAnimationFrame to ensure scroll executes in next frame, reducing conflicts
      requestAnimationFrame(() => {
        // Set scrollTop directly, avoiding potential inertial scrolling issues from scrollIntoView
        scrollElement.scrollTop = scrollPosition;
      });
    }
  }, [scrollAreaRef]);
  
  // Scroll to bottom when messages change - slightly increased delay to ensure DOM is fully updated
  useEffect(() => {
    setTimeout(scrollToBottom, 150);
  }, [scrollToBottom]); 

  return {
    adjustTextareaHeight,
    scrollToBottom
  };
}; 