/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-file-upload.ts
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

import { createId } from '@paralleldrive/cuid2'
import { useCallback, useRef, useState } from 'react'
import { getCdnFileUrl, getCdnUploadUrl, getCdnImageUrl } from '@libra/common'

interface UseFileUploadProps {
  onFileUploadSuccess?: (
    fileDetails: { key: string; name: string; type: string },
    planId: string
  ) => void
  onFileRemoved?: () => void
  logPrefix?: string
}

export const useFileUpload = ({
  onFileUploadSuccess,
  onFileRemoved,
  logPrefix = '[FileUpload]',
}: UseFileUploadProps) => {
  // File upload states
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileKey, setUploadedFileKey] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadedFileType, setUploadedFileType] = useState<string | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)
  const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false)

  // Delete file from CDN
  const deleteFile = useCallback(
    async (planId: string): Promise<void> => {
      const response = await fetch(getCdnFileUrl(planId), {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(response.statusText + (errorText ? `: ${errorText}` : ''))
      }

      await response.json()
    },
    []
  )

  // Clear all file state
  const clearFileState = useCallback(() => {
    setUploadedFileKey(null)
    setUploadedFileName(null)
    setUploadedFileType(null)
    setPreviewImageUrl(null)
    setUploadError(null)
    setCurrentPlanId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Remove uploaded file
  const handleRemoveUploadedFile = useCallback(async () => {
    if (currentPlanId && !isDeletingFile) {
      setIsDeletingFile(true)

      try {
        await deleteFile(currentPlanId)
      } catch (error: unknown) {
        console.error(`${logPrefix} File deletion API call failed:`, error)
        setUploadError(`File deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsDeletingFile(false)
      }
    }

    clearFileState()
    onFileRemoved?.()
  }, [currentPlanId, isDeletingFile, deleteFile, onFileRemoved, clearFileState, logPrefix])

  // Upload file to CDN
  const uploadFile = useCallback(
    async (file: File) => {
      setUploadError(null)
      setIsUploadingFile(true)

      // Create temporary preview
      const tempPreviewUrl = URL.createObjectURL(file)
      setPreviewImageUrl(tempPreviewUrl)
      setUploadedFileName(file.name)
      setUploadedFileType(file.type)

      // Generate or reuse planId
      let planId = currentPlanId
      if (!planId) {
        planId = createId()
        setCurrentPlanId(planId)
      }

      const formData = new FormData()
      formData.append('image', file)
      formData.append('planId', planId)

      try {
        const response = await fetch(getCdnUploadUrl(), {
          method: 'PUT',
          body: formData,
          credentials: 'include',
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(response.statusText + (errorText ? `: ${errorText}` : ''))
        }

        const key = await response.text()

        setUploadedFileKey(key)
        setPreviewImageUrl(key ? getCdnImageUrl(key) : tempPreviewUrl)

        if (key) URL.revokeObjectURL(tempPreviewUrl)

        onFileUploadSuccess?.({ key, name: file.name, type: file.type }, planId)
      } catch (error: unknown) {
        console.error(`${logPrefix} File upload failed:`, error)
        setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setPreviewImageUrl(null)
        URL.revokeObjectURL(tempPreviewUrl)
        setUploadedFileKey(null)
        setUploadedFileName(null)
        setUploadedFileType(null)
        setCurrentPlanId(null)
      } finally {
        setIsUploadingFile(false)
      }
    },
    [onFileUploadSuccess, currentPlanId, logPrefix]
  )

  // Validate and handle file selection
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        if (uploadedFileKey || previewImageUrl) {
          handleRemoveUploadedFile()
        }
        return
      }

      // Validate file size (max 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024
      if (file.size > maxSizeInBytes) {
        const errorMsg = `File is too large (max 5MB). Selected: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        setUploadError(errorMsg)
        clearFileState()
        return
      }

      // Validate file type (image/*)
      if (!file.type.startsWith('image/')) {
        const errorMsg = `Invalid file type. Please select an image. Selected: ${file.type}`
        setUploadError(errorMsg)
        clearFileState()
        return
      }

      // Clear previous file state for replacement
      if (uploadedFileKey || previewImageUrl) {
        setUploadedFileKey(null)
        setUploadedFileName(null)
        setUploadedFileType(null)
        setPreviewImageUrl(null)
        setUploadError(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }

      setUploadError(null)
      uploadFile(file)
    },
    [uploadFile, uploadedFileKey, previewImageUrl, clearFileState, handleRemoveUploadedFile]
  )

  // Trigger file input click
  const handleFileSelectClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return {
    fileInputRef,
    uploadedFileKey,
    uploadedFileName,
    uploadedFileType,
    previewImageUrl,
    isUploadingFile,
    uploadError,
    currentPlanId,
    isDeletingFile,
    handleFileSelectClick,
    handleFileChange,
    handleRemoveUploadedFile,
    clearFileState,
  }
}
