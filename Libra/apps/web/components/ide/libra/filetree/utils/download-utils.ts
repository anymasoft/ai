/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * download-utils.ts
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

import type { FileContentMap } from '@libra/common'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import * as m from '@/paraglide/messages'

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: number) => void

/**
 * Generate project download file name
 * @returns Generated file name with timestamp
 */
export function generateProjectName(): string {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '')
  return `libra-project-${timestamp}.zip`
}

/**
 * Create ZIP file from FileContentMap
 * @param fileContentMap File content mapping
 * @param onProgress Progress callback function
 * @returns Promise that resolves to ZIP blob
 */
export async function createZipFromFileMap(
  fileContentMap: FileContentMap,
  onProgress?: ProgressCallback
): Promise<Blob> {

  const zip = new JSZip()
  const files = Object.entries(fileContentMap)
  const totalFiles = files.length


  if (totalFiles === 0) {
    console.error('[DownloadUtils] ' + m["ide.fileTree.download.noFilesAvailable"]())
    throw new Error(m["ide.fileTree.download.noFilesAvailable"]())
  }
  
  // Process each file
  for (const [index, [filePath, fileData]] of files.entries()) {
    try {
      // Skip files with empty content unless they are intentionally empty
      if (!fileData.content && fileData.content !== '') {
        continue
      }

      // Handle binary files
      if (fileData.isBinary) {
        // For binary files, we need to handle them appropriately
        // Since we're getting content as string, we'll treat it as base64 if it looks like it
        try {
          const binaryData = atob(fileData.content)
          const bytes = new Uint8Array(binaryData.length)
          for (let j = 0; j < binaryData.length; j++) {
            bytes[j] = binaryData.charCodeAt(j)
          }
          zip.file(filePath, bytes)
        } catch {
          // If base64 decode fails, treat as regular text
          zip.file(filePath, fileData.content)
        }
      } else {
        // Handle text files
        zip.file(filePath, fileData.content)
      }

      // Update progress
      if (onProgress) {
        const progress = Math.round(((index + 1) / totalFiles) * 50) // First 50% for file processing
        onProgress(progress)
      }

    } catch (error) {
      console.error(`[DownloadUtils] Failed to process file: ${filePath}`, error)
      // Continue with other files instead of failing completely
    }
  }
  
  
  // Generate ZIP blob
  try {
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    }, (metadata) => {
      // Update progress for ZIP generation (50% - 100%)
      if (onProgress) {
        const progress = 50 + Math.round((metadata.percent || 0) * 0.5)
        onProgress(progress)
      }
    })
    
    return blob
    
  } catch (error) {
    throw new Error(m["ide.fileTree.download.zipGenerationFailed"]())
  }
}

/**
 * Download ZIP file using file-saver
 * @param blob ZIP file blob
 * @param filename Download file name
 */
export function downloadZipFile(blob: Blob, filename: string): void {
  try {
    saveAs(blob, filename)
  } catch (error) {
    throw new Error(m["ide.fileTree.download.downloadFailed"]())
  }
}

/**
 * Complete download process: create ZIP and trigger download
 * @param fileContentMap File content mapping
 * @param onProgress Progress callback function
 * @returns Promise that resolves when download is triggered
 */
export async function downloadProjectAsZip(
  fileContentMap: FileContentMap,
  onProgress?: ProgressCallback
): Promise<void> {
  try {

    // Create ZIP file
    const zipBlob = await createZipFromFileMap(fileContentMap, onProgress)

    // Generate filename
    const filename = generateProjectName()

    // Trigger download
    downloadZipFile(zipBlob, filename)

    // Complete progress
    if (onProgress) {
      onProgress(100)
    }


  } catch (error) {
    throw error
  }
}
