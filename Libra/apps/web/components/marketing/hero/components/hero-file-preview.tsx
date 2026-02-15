/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * hero-file-preview.tsx
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

import { Loader2, X } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@libra/ui/lib/utils'

interface HeroFilePreviewProps {
  previewImageUrl?: string | null
  uploadedFileName?: string | null
  isUploadingFile?: boolean
  isDeletingFile?: boolean
  uploadError?: string | null
  isSubmitting?: boolean
  onRemoveFile?: () => void
}

export const HeroFilePreview = ({
  previewImageUrl,
  uploadedFileName,
  isUploadingFile,
  isDeletingFile = false,
  uploadError,
  isSubmitting,
  onRemoveFile,
}: HeroFilePreviewProps) => {
  if ((!previewImageUrl && !uploadError) || (isSubmitting && previewImageUrl)) {
    return null
  }

  return (
    <div className="mb-3 animate-in fade-in-50 slide-in-from-top-2 duration-300">
      {previewImageUrl && uploadedFileName && !isSubmitting && (
        <div className="p-3 border rounded-lg bg-background/50 backdrop-blur-sm border-input/50 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src={previewImageUrl}
              alt={uploadedFileName}
              width={48}
              height={48}
              className="rounded-md object-cover flex-shrink-0 border border-border/50"
              onError={() => {
                console.error('[HeroFilePreview] Failed to load image preview')
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {uploadedFileName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Image uploaded
              </p>
            </div>
          </div>
          
          {!isUploadingFile && !isDeletingFile && (
            <button
              type="button"
              onClick={onRemoveFile}
              className={cn(
                'flex-shrink-0 p-1.5 rounded-md transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted/80',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              aria-label="Remove file"
              disabled={isDeletingFile}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {(isUploadingFile || isDeletingFile) && (
            <div className="flex-shrink-0 p-1.5">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          )}
        </div>
      )}
      
      {uploadError && !isUploadingFile && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          {uploadError}
        </div>
      )}
    </div>
  )
}
