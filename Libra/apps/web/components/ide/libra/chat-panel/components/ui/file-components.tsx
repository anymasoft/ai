/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-components.tsx
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

import type React from 'react';
import { useMemo, useCallback } from 'react';
import { cn } from '@libra/ui/lib/utils';
import { 
  FileEdit, 
  FilePlus2, 
  Code,
  GitCompareArrows
} from 'lucide-react';
import type { DiffMessage, FileChange } from '../types/message-types';
import { getFilePathParts } from './file-utils';
import * as m from '@/paraglide/messages';

// Extended file change definition, adding content fields
export interface ExtendedFileChange extends FileChange {
  modified?: string;
  original?: string | null;
}

// File type badge component with responsive design
const FileTypeBadge = ({ fileType }: { fileType: string }) => (
  <span className={cn(
    "px-1.5 py-0.5 md:px-2 md:py-1 rounded text-xs font-medium transition-all duration-200",
    "hidden sm:inline-block", // Hidden on very small screens
    fileType === "create"
      ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
      : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20"
  )}>
    {fileType === "create" ? m['ide.fileComponents.new']() : m['ide.fileComponents.edit']()}
  </span>
);

// Single file change item component
const FileItem = ({
  file,
  onFileClick,
  onViewDiff
}: {
  file: ExtendedFileChange,
  onFileClick: (path: string) => void,
  onViewDiff?: (file: ExtendedFileChange) => void
}) => {
  const { fileName, directory } = getFilePathParts(file.path);
  
  const handleClick = useCallback(() => {
    onFileClick(file.path);
  }, [file.path, onFileClick]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }, [handleClick]);

  const handleViewDiff = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onViewDiff?.(file);
  }, [file, onViewDiff]);

  const handleDiffKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      onViewDiff?.(file);
    }
  }, [file, onViewDiff]);

  return (
    <div
      className={cn(
        "w-full text-left group transition-all duration-200",
        "py-2 px-3 sm:py-3 sm:px-4", // Responsive padding
        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0", // Responsive layout
        "hover:bg-accent/5",
        "text-sm",
        "min-h-[48px] sm:min-h-[52px]" // Responsive height
      )}
    >
      {/* Main content wrapper for mobile layout */}
      <div className="flex items-center w-full sm:flex-1">
        {/* File icon */}
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center rounded transition-all duration-200",
          "w-5 h-5 sm:w-6 sm:h-6", // Responsive icon container size
          file.type === 'create'
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
            : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
        )}>
          {file.type === 'create' ? (
            <FilePlus2 className="w-3 h-3 sm:w-4 sm:h-4" />
          ) : (
            <FileEdit className="w-3 h-3 sm:w-4 sm:h-4" />
          )}
        </div>

        {/* File information */}
        <div className="flex-1 min-w-0 ml-2 sm:ml-3">
          <button
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
              "text-left transition-all duration-200 focus:outline-none",
              "hover:text-primary focus:text-primary",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
            )}
            title={m['ide.fileComponents.openFile']({ path: file.path })}
          >
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors text-sm sm:text-base">
                {fileName}
              </span>
              {directory && (
                <span className="text-muted-foreground text-xs opacity-75 truncate">
                  {directory}/
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Action area */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:ml-3 flex-shrink-0 w-full sm:w-auto">
        {/* Change statistics */}
        <div className="flex items-center text-xs font-medium gap-1">
          {file.additions > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 px-1 py-0.5 sm:px-1.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-xs">
              +{file.additions}
            </span>
          )}

          {file.deletions > 0 && file.additions > 0 && (
            <span className="mx-0.5 text-muted-foreground">/</span>
          )}

          {file.deletions > 0 && (
            <span className="text-rose-600 dark:text-rose-400 px-1 py-0.5 sm:px-1.5 rounded bg-rose-50 dark:bg-rose-900/20 text-xs">
              -{file.deletions}
            </span>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Diff view button */}
          <button
            type="button"
            onClick={handleViewDiff}
            onKeyDown={handleDiffKeyDown}
            className={cn(
              "p-1 sm:p-1.5 rounded transition-all duration-200",
              "text-muted-foreground hover:text-primary hover:bg-accent/20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px]" // Touch-friendly size
            )}
            aria-label={m['ide.fileComponents.viewDiff']({ fileName })}
            title={m['ide.fileComponents.viewDiff']({ fileName })}
          >
            <GitCompareArrows className="w-3 h-3 sm:w-4 sm:h-4" />
          </button>

          {/* File type badge */}
          <FileTypeBadge fileType={file.type} />
        </div>
      </div>
    </div>
  );
};

// File changes list component
export const FileChanges = ({
  diff,
  onFileClick,
  onViewDiff
}: {
  diff?: DiffMessage,
  onFileClick: (path: string) => void,
  onViewDiff?: (file: ExtendedFileChange) => void
}) => {
  // Process file change data
  const fileChanges: ExtendedFileChange[] = useMemo(() => {
    if (!diff?.diff || !Array.isArray(diff.diff)) {
      return [];
    }
    
    const allFiles = diff.diff.map(item => {
      const hasModified = 'modified' in item && item.modified !== undefined;
      const hasOriginal = 'original' in item;
      
      if (!hasModified || !hasOriginal) {
      }
      
      return {
        ...item,
        modified: hasModified ? item.modified : '',
        original: hasOriginal ? item.original : null
      } as ExtendedFileChange;
    });
    
    // Filter out files with both additions and deletions equal to 0 (no actual changes)
    const filteredFiles = allFiles.filter(item => item.additions > 0 || item.deletions > 0);

    return filteredFiles;
  }, [diff]);
  
  // Handle file click events
  const handleFileClick = useCallback((path: string) => {
    onFileClick(path);
  }, [onFileClick]);

  // Handle view diff events
  const handleViewDiff = useCallback((file: ExtendedFileChange) => {
    onViewDiff?.(file);
  }, [onViewDiff]);
  
  if (fileChanges.length === 0) {
    return (
      <div className="rounded-b-lg overflow-hidden">
        {/* Header for empty state */}
        <div className="px-4 py-3 flex items-center justify-between bg-muted/5">
          <div className="flex items-center text-sm text-foreground font-medium">
            <Code className="h-4 w-4 mr-2 text-primary" />
            <span>{m['ide.fileComponents.fileChanges']()}</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium px-2 py-1 rounded bg-accent/10">
            0 files
          </div>
        </div>

        {/* Empty state with improved styling */}
        <div className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
              <Code className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              {m['ide.fileComponents.noFileChanges']()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-b-lg overflow-visible">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between bg-muted/5">
        <div className="flex items-center text-sm font-medium text-foreground min-w-0">
          <Code className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-primary flex-shrink-0" />
          <span className="truncate">File Changes</span>
        </div>
        <div className="text-xs font-medium px-1.5 py-0.5 sm:px-2 sm:py-1 rounded bg-accent/10 text-muted-foreground flex-shrink-0">
          <span className="hidden sm:inline">
            {fileChanges.length} {fileChanges.length === 1 ? m['ide.fileComponents.file']() : m['ide.fileComponents.files']()}
          </span>
          <span className="sm:hidden">
            {fileChanges.length}
          </span>
        </div>
      </div>

      {/* File list - remove height restrictions to show all files naturally */}
      <div className="overflow-visible">
        {fileChanges.map((file, index) => (
          <FileItem
            key={`file-${file.path}-${index}`}
            file={file}
            onFileClick={handleFileClick}
            onViewDiff={handleViewDiff}
          />
        ))}
      </div>
    </div>
  );
}; 