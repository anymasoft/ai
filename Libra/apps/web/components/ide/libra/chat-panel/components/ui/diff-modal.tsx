/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * diff-modal.tsx
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

import React, { useState, useEffect, useRef } from 'react';
import { FileEdit, FilePlus2, RefreshCw, ExternalLink, X } from 'lucide-react';
import { cn } from '@libra/ui/lib/utils';
import { FileDiffView } from '@/components/ide/libra/filetree/file-diff-view';
import type { ExtendedFileChange } from './content-components';
import * as m from '@/paraglide/messages';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@libra/ui/components/dialog';
import { Alert, AlertTitle, AlertDescription } from '@libra/ui/components/alert';
import { Button } from '@libra/ui/components/button';
import { Skeleton } from '@libra/ui/components/skeleton';

interface DiffModalProps {
  file: ExtendedFileChange;
  onClose: () => void;
  onFileClick: () => void;
}

/**
 * Enhanced File Difference Modal Component
 *
 * A modern, accessible modal for displaying file changes with improved UI/UX.
 * Features responsive design, loading states, error handling, and full accessibility support.
 */
export const DiffModal = ({ file, onClose, onFileClick }: DiffModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus close button for accessibility
  useEffect(() => {
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, []);

  // Handle retry for error states
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    // Simulate retry logic - in real implementation this would reload the diff
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // Handle file click with error handling
  const handleFileClick = () => {
    try {
      onFileClick();
      onClose();
    } catch (err) {
      setError('Unable to open file');
    }
  };

  if (!file) {
    return null;
  }

  const fileIcon = file.type === 'create' ? FilePlus2 : FileEdit;
  const fileTypeText = file.type === 'create' ? m['ide.fileComponents.new']() : m['ide.fileComponents.edit']();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          'flex flex-col w-full max-w-2xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl',
          'max-h-[90vh] bg-background/95 backdrop-blur-md border border-border/20 rounded-lg shadow-2xl',
          'p-0 gap-0',
          '[&>button]:hidden' // Hide default close button
        )}
      >
        {/* DialogTitle and DialogDescription for accessibility */}
        <DialogTitle className="sr-only">
          File Diff: {file.path} ({fileTypeText})
        </DialogTitle>

        <DialogDescription className="sr-only">
          Viewing changes for {file.path} ({fileTypeText}). {file.additions} additions, {file.deletions} deletions.
        </DialogDescription>

        {/* Enhanced Header with Glass Effect */}
        <div className={cn(
          'flex items-center justify-between h-16 px-6 glass-2 rounded-t-lg',
          'border-b border-border/20'
        )}>
         <div className="flex items-center gap-3 min-w-0 flex-1">
           {React.createElement(fileIcon, {
             className: "h-5 w-5 text-primary flex-shrink-0",
             'aria-hidden': true
           })}
           <div className="min-w-0 flex-1">
             <h2 className="text-lg font-semibold text-foreground truncate">
               {file.path}
             </h2>
             <div className="flex items-center gap-3 mt-1">
               {/* Modern File Type Badge */}
               <span className={cn(
                 "min-w-[44px] text-center px-2 py-1 rounded-full text-xs font-medium transition-all duration-200",
                 "ring-1 ring-inset",
                 file.type === "create"
                   ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800/50"
                   : "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800/50"
               )}>
                 {file.type === "create" ? m['ide.fileComponents.new']() : m['ide.fileComponents.edit']()}
               </span>

               {/* Modern Change Statistics */}
               <div className="flex items-center gap-1.5 tabular-nums text-xs font-medium">
                 {file.additions > 0 && (
                   <span className="text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20">
                     +{file.additions}
                   </span>
                 )}
                 {file.deletions > 0 && file.additions > 0 && (
                   <span className="mx-0.5 text-muted-foreground">/</span>
                 )}
                 {file.deletions > 0 && (
                   <span className="text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20">
                     -{file.deletions}
                   </span>
                 )}
               </div>
             </div>
           </div>
         </div>

         {/* Simplified Action Button */}
         <div className="flex items-center">
           <Button
             ref={closeButtonRef}
             variant="outline"
             size="sm"
             onClick={onClose}
             className="text-muted-foreground hover:text-foreground"
             aria-label={m['ide.diffModal.closeDialog']()}
           >
             <X className="h-4 w-4" />
           </Button>
         </div>
        </div>

        {/* Content Area with Enhanced Error Handling */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="p-6">
              <Alert variant="error" className="mb-4">
                <AlertTitle>Loading Failed</AlertTitle>
                <AlertDescription className="mb-4">
                  {error}
                </AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {m['common.retry']()}
                </Button>
              </Alert>
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-5/6" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          ) : file.original !== undefined && file.modified !== undefined ? (
            <div className="h-full max-h-[calc(90vh-8rem)] overflow-auto">
              <FileDiffView
                oldContent={file.original ?? ''}
                newContent={file.modified}
                filePath={file.path}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="p-6">
              <Alert variant="warning">
                <AlertTitle>Content Unavailable</AlertTitle>
                <AlertDescription>
                  Unable to load file differences
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className={cn(
          'flex items-center justify-between h-16 px-6 glass-1 rounded-b-lg',
          'border-t border-border/20'
        )}>
          <div className="text-sm text-muted-foreground">
            {file.type === 'create' ? m['ide.fileComponents.new']() : m['ide.fileComponents.edit']()} • {file.path}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              {m['common.close']()}
            </Button>
            <Button
              size="sm"
              onClick={handleFileClick}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open File
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};