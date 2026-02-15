/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-textarea-resize.ts
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

import { useCallback, useState, useRef, useEffect } from 'react';

interface UseTextareaResizeProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  logPrefix?: string;
}

export const useTextareaResize = ({
  textareaRef,
  logPrefix = '[TextareaResize]'
}: UseTextareaResizeProps) => {
  const [textAreaHeight, setTextAreaHeight] = useState<number>(48);
  const textAreaResizeObserver = useRef<ResizeObserver | null>(null);

  // Auto-resize textarea height function
  const autoResizeTextarea = useCallback(() => {
    if (!textareaRef.current) return;
    
    textareaRef.current.style.height = 'auto';
    const newHeight = Math.min(
      Math.max(textareaRef.current.scrollHeight, 48),
      200 // Maximum height limit
    );
    textareaRef.current.style.height = `${newHeight}px`;
    
  }, [textareaRef, logPrefix]);

  // Update height when textarea size changes
  useEffect(() => {
    if (!textareaRef?.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height !== textAreaHeight) {
          setTextAreaHeight(height);
        }
      }
    });
    
    resizeObserver.observe(textareaRef.current);
    textAreaResizeObserver.current = resizeObserver;
    
    return () => {
      if (textAreaResizeObserver.current) {
        textAreaResizeObserver.current.disconnect();
      }
    };
  }, [textareaRef, textAreaHeight]);

  return {
    textAreaHeight,
    autoResizeTextarea,
  };
};
