/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-hero-file-upload.ts
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

import { useCallback, useState, useRef } from 'react'
import { createId } from '@paralleldrive/cuid2'
import * as m from '@/paraglide/messages'
import { getCdnFileUrl, getCdnUploadUrl, getCdnImageUrl } from '@libra/common'

interface UseHeroFileUploadProps {
  onFileUploadSuccess?: (fileDetails: { key: string; name: string; type: string }, planId: string) => void
  onFileRemoved?: () => void
}

export const useHeroFileUpload = ({
  onFileUploadSuccess,
  onFileRemoved,
}: UseHeroFileUploadProps) => {
  // File upload related states and ref
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileKey, setUploadedFileKey] = useState<string | null>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadedFileType, setUploadedFileType] = useState<string | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null)

  // File deletion related states
  const [isDeletingFile, setIsDeletingFile] = useState<boolean>(false)

  // Delete file function using direct CDN call
  const deleteFile = useCallback(async (planId: string): Promise<void> => {
    const response = await fetch(getCdnFileUrl(planId), {
      method: 'DELETE',
      credentials: 'include', // Include cookies for authentication
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(response.statusText + (errorText ? `: ${errorText}` : ''))
    }

    const result = await response.json()
  }, [])

  const handleFileSelectClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRemoveUploadedFile = useCallback(async () => {
    // If we have a planId, attempt to delete the file from storage
    if (currentPlanId && !isDeletingFile) {
      setIsDeletingFile(true)

      try {
        // Call the delete function
        await deleteFile(currentPlanId)
      } catch (error: any) {
        // Show error but don't restore file state since user intended to remove it
        setUploadError(`${m['hero.fileUpload.deleteFailed']()}: ${error.message || m['hero.fileUpload.unknownError']()}`)
        // Continue with UI cleanup even if deletion fails
      } finally {
        setIsDeletingFile(false)
      }
    }

    // Clear UI state regardless of deletion result
    setUploadedFileKey(null)
    setUploadedFileName(null)
    setUploadedFileType(null)
    setPreviewImageUrl(null)
    setUploadError(null)
    setCurrentPlanId(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = '' // Reset file input to allow re-selecting the same file
    }
    onFileRemoved?.()
  }, [currentPlanId, isDeletingFile, deleteFile, onFileRemoved])

  // Clear file state for external calls
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

  // Reset PlanId for new form session
  const resetPlanId = useCallback(() => {
    setCurrentPlanId(null)
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null)
    setIsUploadingFile(true)
    // Use a temporary blob URL for immediate preview while uploading
    const tempPreviewUrl = URL.createObjectURL(file)
    setPreviewImageUrl(tempPreviewUrl)
    setUploadedFileName(file.name) // Show name immediately
    setUploadedFileType(file.type) // Show type immediately


    // Generate PlanId only if we don't have one (for file replacement)
    let planId = currentPlanId
    if (!planId) {
      planId = createId()
      setCurrentPlanId(planId)
    } else {
    }

    const formData = new FormData()
    formData.append('image', file)
    formData.append('planId', planId)

    try {
      const response = await fetch(getCdnUploadUrl(), {
        method: 'PUT',
        body: formData,
        credentials: 'include', // Crucial for sending cookies with the request
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(response.statusText + (errorText ? `: ${errorText}` : ''))
      }

      const key = await response.text()

      setUploadedFileKey(key)

      // Now update preview URL to point to the actual CDN image
      setPreviewImageUrl(key ? getCdnImageUrl(key) : tempPreviewUrl)
      // Revoke the temporary blob URL if CDN key is set
      if (key) URL.revokeObjectURL(tempPreviewUrl)

      onFileUploadSuccess?.({ key, name: file.name, type: file.type }, planId)
    } catch (error: any) {
      setUploadError(`${m['hero.fileUpload.uploadFailed']()}: ${error.message || m['hero.fileUpload.unknownError']()}`)
      // If upload fails, remove preview and reset related states
      setPreviewImageUrl(null)
      URL.revokeObjectURL(tempPreviewUrl) // Clean up blob URL on error
      setUploadedFileKey(null)
      setUploadedFileName(null)
      setUploadedFileType(null)
      setCurrentPlanId(null)
    } finally {
      setIsUploadingFile(false)
    }
  }, [onFileUploadSuccess, currentPlanId])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      // If a file was previously selected and user cancels, clear it.
      if (uploadedFileKey || previewImageUrl) {
        handleRemoveUploadedFile()
      }
      return
    }


    // Validate file size (max 5MB)
    const maxSizeInBytes = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSizeInBytes) {
      const errorMsg = m['hero.fileUpload.fileTooLarge']({ size: (file.size / 1024 / 1024).toFixed(2) })
      setUploadError(errorMsg)
      setPreviewImageUrl(null) // Clear any existing preview
      setUploadedFileKey(null)
      setUploadedFileName(null)
      setUploadedFileType(null)
      setCurrentPlanId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = '' // Reset to allow re-selection
      }
      return
    }

    // Validate file type (image/*)
    if (!file.type.startsWith('image/')) {
      const errorMsg = m['hero.fileUpload.invalidFileType']({ type: file.type })
      setUploadError(errorMsg)
      setPreviewImageUrl(null)
      setUploadedFileKey(null)
      setUploadedFileName(null)
      setUploadedFileType(null)
      setCurrentPlanId(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // If there was a previous file, remove it before uploading the new one
    if (uploadedFileKey || previewImageUrl) {
      handleRemoveUploadedFile()
    }

    // Validation passed, proceed to upload
    setUploadError(null) // Clear previous errors
    uploadFile(file)
  }, [uploadFile, handleRemoveUploadedFile, uploadedFileKey, previewImageUrl])

  // Get file details for form submission
  const getFileDetails = useCallback(() => {
    if (uploadedFileKey && uploadedFileName && uploadedFileType) {
      return {
        key: uploadedFileKey,
        name: uploadedFileName,
        type: uploadedFileType,
      }
    }
    return null
  }, [uploadedFileKey, uploadedFileName, uploadedFileType])

  // Get file details with PlanId for form submission
  const getFileDetailsWithPlanId = useCallback(() => {
    if (uploadedFileKey && uploadedFileName && uploadedFileType && currentPlanId) {
      return {
        fileDetails: {
          key: uploadedFileKey,
          name: uploadedFileName,
          type: uploadedFileType,
        },
        planId: currentPlanId,
      }
    }
    return null
  }, [uploadedFileKey, uploadedFileName, uploadedFileType, currentPlanId])

  return {
    fileInputRef,
    handleFileSelectClick,
    handleFileChange,
    handleRemoveUploadedFile,
    clearFileState,
    resetPlanId,
    uploadedFileKey,
    uploadedFileName,
    uploadedFileType,
    previewImageUrl,
    isUploadingFile,
    isDeletingFile,
    uploadError,
    getFileDetails,
    getFileDetailsWithPlanId,
    currentPlanId,
  }
}
