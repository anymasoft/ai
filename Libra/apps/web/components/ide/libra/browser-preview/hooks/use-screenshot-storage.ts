/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-screenshot-storage.ts
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

import { useCallback, useState } from 'react'
import { getCdnScreenshotUrl, getCdnScreenshotUploadUrl, getCdnImageUrl } from '@libra/common'

interface UseScreenshotStorageProps {
  planId?: string | null | undefined
  onScreenshotStored?: (data: { key: string; planId: string }) => void
  onHistoryUpdate?: (data: { planId: string; screenshotKey: string; previewUrl: string }) => void
}

interface ScreenshotResponse {
  key: string
  planId: string
}

interface ErrorResponse {
  message: string
}

export const useScreenshotStorage = ({
  planId,
  onScreenshotStored,
  onHistoryUpdate,
}: UseScreenshotStorageProps) => {
  const [isCheckingScreenshot, setIsCheckingScreenshot] = useState(false)
  const [isStoringScreenshot, setIsStoringScreenshot] = useState(false)
  const [existingScreenshotKey, setExistingScreenshotKey] = useState<string | null>(null)

  // Check if screenshot already exists for planId
  const checkExistingScreenshot = useCallback(
    async (targetPlanId: string): Promise<string | null> => {
      if (!targetPlanId) return null

      setIsCheckingScreenshot(true)
      try {
        const response = await fetch(getCdnScreenshotUrl(targetPlanId), {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = (await response.json()) as ScreenshotResponse
          setExistingScreenshotKey(data.key)
          return data.key
        }

        if (response.status === 404) {
          setExistingScreenshotKey(null)
          return null
        }

        return null
      } catch (error) {
        return null
      } finally {
        setIsCheckingScreenshot(false)
      }
    },
    []
  )

  // Store screenshot for planId
  const storeScreenshot = useCallback(
    async (
      dataUrl: string,
      targetPlanId: string,
      format: 'png' | 'jpeg' = 'png'
    ): Promise<{ success: boolean; key?: string; error?: string }> => {
      if (!dataUrl || !targetPlanId) {
        return { success: false, error: 'Missing dataUrl or planId' }
      }

      setIsStoringScreenshot(true)
      try {
        const response = await fetch(getCdnScreenshotUploadUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            dataUrl,
            planId: targetPlanId,
            format,
          }),
        })

        if (response.ok) {
          const data = (await response.json()) as ScreenshotResponse

          setExistingScreenshotKey(data.key)
          onScreenshotStored?.(data)

          // Update history with screenshot information
          const previewUrl = getCdnImageUrl(data.key)
          onHistoryUpdate?.({
            planId: targetPlanId,
            screenshotKey: data.key,
            previewUrl,
          })

          return { success: true, key: data.key }
        }

        const errorData = (await response
          .json()
          .catch(() => ({ message: response.statusText }))) as ErrorResponse
        return { success: false, error: errorData.message || 'Failed to store screenshot' }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      } finally {
        setIsStoringScreenshot(false)
      }
    },
    [onScreenshotStored, onHistoryUpdate]
  )

  // Check and conditionally store screenshot
  const checkAndStoreScreenshot = useCallback(
    async (
      dataUrl: string,
      targetPlanId: string,
      format: 'png' | 'jpeg' = 'png'
    ): Promise<{ shouldStore: boolean; existingKey?: string; newKey?: string }> => {
      if (!targetPlanId) {
        return { shouldStore: false }
      }

      // Check if screenshot already exists
      const existingKey = await checkExistingScreenshot(targetPlanId)

      if (existingKey) {
        return { shouldStore: false, existingKey }
      }

      // No existing screenshot, store the new one
      const result = await storeScreenshot(dataUrl, targetPlanId, format)

      if (result.success && result.key) {
        return { shouldStore: true, newKey: result.key }
      }

      return { shouldStore: false }
    },
    [checkExistingScreenshot, storeScreenshot]
  )

  // Get screenshot URL for display
  const getScreenshotUrl = useCallback((key: string): string => {
    return getCdnImageUrl(key)
  }, [])

  return {
    isCheckingScreenshot,
    isStoringScreenshot,
    existingScreenshotKey,
    checkExistingScreenshot,
    storeScreenshot,
    checkAndStoreScreenshot,
    getScreenshotUrl,
  }
}
