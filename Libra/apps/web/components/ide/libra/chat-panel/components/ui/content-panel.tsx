/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * content-panel.tsx
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

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ThinkingContent,
  PlanContent,
  CommandContent,
  FileChanges
} from './content-components';
import type { BaseMessage, DiffMessage, CommandMessage } from '../types/message-types';
import { DiffModal } from './diff-modal';
import type { ExtendedFileChange } from './content-components';
import { cn } from '@libra/ui/lib/utils';

interface ContentPanelProps {
  activeTab: string;
  isContentExpanded: boolean;
  thinking?: BaseMessage;
  plan?: BaseMessage;
  commands?: CommandMessage[];
  diff?: DiffMessage;
  onFileClick: (path: string) => void;
  maxHeight?: number;
  isLoading?: boolean;
  hasThinkingInProgress?: boolean;
  planId?: string;
}

export const ContentPanel = ({
  activeTab,
  isContentExpanded,
  thinking,
  plan,
  commands,
  diff,
  onFileClick,
  maxHeight,
  isLoading = false,
  hasThinkingInProgress = false,
  planId
}: ContentPanelProps) => {
  const [selectedFile, setSelectedFile] = useState<ExtendedFileChange | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);



  // Calculate effective height based on content type
  const getEffectiveHeight = useCallback(() => {
    if (activeTab === 'files') {
      // Remove height limits for files content - let it display naturally like thinking
      return null;
    }
    return maxHeight;
  }, [activeTab, maxHeight]);

  useEffect(() => {
    if (!isContentExpanded || !contentRef.current) return;

    const contentContainer = contentRef.current.querySelector('.content-area');
    if (contentContainer && contentContainer instanceof HTMLElement) {
      const effectiveHeight = getEffectiveHeight();
      
      if (effectiveHeight) {
        // Set max-height to allow natural content flow while preventing excessive growth
        contentContainer.style.maxHeight = `${effectiveHeight}px`;
        contentContainer.style.height = 'auto';
        contentContainer.style.overflowY = 'auto';
      } else {
        // Fallback: remove restrictions to let content display naturally
        contentContainer.style.maxHeight = 'none';
        contentContainer.style.height = 'auto';
        contentContainer.style.overflowY = 'visible';
      }
    }
  }, [getEffectiveHeight, isContentExpanded]);

  // Handle view diff
  const handleViewDiff = useCallback((file: ExtendedFileChange) => {
    setSelectedFile(file);
    setShowDiffModal(true);
  }, []);

  // Close diff dialog
  const handleCloseDiffModal = useCallback(() => {
    setShowDiffModal(false);
  }, []);

  // Avoid showing empty content
  if (!isContentExpanded) return null;
  

  return (
    <div
      ref={contentRef}
      className={cn(
        "w-full overflow-hidden transition-all duration-300 ease-in-out",
        "bg-card/30 rounded-b-lg border-t border-border/20",
        activeTab === 'plan' ? 'plan-container' : ''
      )}
    >
      <div
        className="content-area animate-in fade-in-50 duration-200 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
      >
        {activeTab === 'thinking' && (
          <div className="p-1">
            {/*// @ts-ignore*/}
            <ThinkingContent
              thinking={thinking}
              isLoading={isLoading}
              hasThinkingInProgress={hasThinkingInProgress}
              planId={planId}
            />
          </div>
        )}

        {activeTab === 'plan' && plan && (
          <div className="p-1">
            <PlanContent plan={plan} />
          </div>
        )}

        {activeTab === 'commands' && commands && commands.length > 0 && (
          <div className="p-1">
            <CommandContent commands={commands} />
          </div>
        )}

        {activeTab === 'files' && diff && (
          <div>
            <FileChanges diff={diff} onFileClick={onFileClick} onViewDiff={handleViewDiff} />
            {showDiffModal && selectedFile && (
              <DiffModal
                file={selectedFile}
                onClose={handleCloseDiffModal}
                onFileClick={() => {
                  if (selectedFile && onFileClick) {
                    onFileClick(selectedFile.path);
                    handleCloseDiffModal();
                  }
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 