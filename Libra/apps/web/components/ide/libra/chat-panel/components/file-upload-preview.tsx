/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file-upload-preview.tsx
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

import * as m from '@/paraglide/messages'
import { Loader2, X } from 'lucide-react'
import Image from 'next/image'

interface FileUploadPreviewProps {
  previewImageUrl?: string | null
  uploadedFileName?: string | null
  isUploadingFile?: boolean
  isDeletingFile?: boolean
  uploadError?: string | null
  isSending?: boolean
  onRemoveFile?: () => void
}

export const FileUploadPreview = ({
  previewImageUrl,
  uploadedFileName,
  isUploadingFile,
  isDeletingFile,
  uploadError,
  isSending,
  onRemoveFile,
}: FileUploadPreviewProps) => {
  if ((!previewImageUrl && !uploadError) || (isSending && previewImageUrl)) {
    return null
  }

  return (
    <div className="mb-2 animate-in fade-in-50 slide-in-from-top-2 duration-300">
      {previewImageUrl && uploadedFileName && !isSending && (
        <div className="mt-2 p-2 border rounded-md bg-muted/50 dark:bg-neutral-700/30 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src={previewImageUrl}
              alt={uploadedFileName}
              width={40}
              height={40}
              className="rounded object-cover flex-shrink-0"
              onError={() => {
              }}
            />
            <span className="text-sm text-fg-subtle dark:text-neutral-300 truncate">
              {uploadedFileName}
            </span>
          </div>
          {!isUploadingFile && !isDeletingFile && (
            <button
              type="button"
              onClick={onRemoveFile}
              className="p-1 text-fg-muted hover:text-fg-default dark:text-neutral-400 dark:hover:text-neutral-100 rounded-full hover:bg-muted dark:hover:bg-neutral-600"
              aria-label={m["chatPanel.fileUpload.removeFile"]()}
              disabled={isSending || isDeletingFile}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {(isUploadingFile || isDeletingFile) && (
            <Loader2 className="h-4 w-4 animate-spin text-accent dark:text-blue-400" />
          )}
        </div>
      )}
      {uploadError && !isUploadingFile && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">
          {uploadError}
        </p>
      )}
    </div>
  )
} 