/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * content-components.tsx
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

import { useCallback } from 'react';
import { Terminal } from 'lucide-react';
import type { BaseMessage, CommandMessage } from '../types/message-types';
import { useMessageContent } from '../hooks/use-message-hooks';
import { LoadingState } from './status-components';
import { MessageSkeleton } from './unified-loading-system';

// Export other components for compatibility
export { FileChanges,  } from './file-components';
;
export type { ExtendedFileChange } from './file-components';

/**
 * Thinking process content component
 * Displays formatted content of AI thinking process
 * Optimized to match plan component's design standards
 */
export const ThinkingContent = ({
  thinking,
  isLoading = false,
  hasThinkingInProgress = false,
  planId
}: {
  thinking?: BaseMessage;
  isLoading?: boolean;
  hasThinkingInProgress?: boolean;
  planId?: string;
}) => {
  const content = useMessageContent(thinking);

  // // If loading and no content, show skeleton screen with improved styling
  // if (hasThinkingInProgress && (!content || !content.trim())) {
  //   return (
  //     <div className="p-4">
  //       <MessageSkeleton
  //         isActive={true}
  //         lines={4}
  //         className="rounded-md"
  //       />
  //     </div>
  //   );
  // }

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed p-4 overflow-visible rounded-b-lg">
      <div
        className="thinking-content"
        data-content-height={content.length}
        data-content-lines={content.split('\n').length}
      >
        {content}
      </div>
    </div>
  );
};

/**
 * Execution plan content component
 * Displays formatted content of AI execution plan
 */
export const PlanContent = ({ plan }: { plan?: BaseMessage }) => {
  const content = useMessageContent(plan);
  
  if (!content.trim()) return null;

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed p-4 overflow-visible rounded-b-lg">
      <div 
        className="plan-content"
        data-content-height={content.length}
        data-content-lines={content.split('\n').length}
      >
        {content}
      </div>
    </div>
  );
};

/**
 * Command content component
 * Displays formatted content of executed command list
 */
export const CommandContent = ({ commands }: { commands: CommandMessage[] }) => {
  if (!commands.length) return null;

  // Helper function to extract description text
  const getCommandDescription = useCallback((command: CommandMessage) => {
    return useMessageContent(command);
  }, []);

  return (
    <div className="rounded-b-lg overflow-hidden bg-green-50/50 dark:bg-green-900/10 border-t border-green-200 dark:border-green-800/50">
      <div className="p-3 flex items-center text-green-800 dark:text-green-300 text-sm font-medium border-b border-green-100 dark:border-green-800/30">
        <Terminal className="h-4 w-4 mr-1.5" />
        <span>Executed Commands</span>
      </div>
      <div className="divide-y divide-green-100 dark:divide-green-800/30 max-h-[400px]">
        {commands.map((command, index) => {
          const commandText = command.command || '';
          const description = getCommandDescription(command);
          
          return (
            <div 
              key={`cmd-${index}`}
              className="p-3 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors duration-200"
            >
              <div className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed bg-green-100/50 dark:bg-green-800/30 p-3 rounded-md border border-green-200 dark:border-green-800/50 text-green-900 dark:text-green-100">
                $ {commandText}
              </div>
              {description && (
                <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/30 p-2 rounded-md">
                  {description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 