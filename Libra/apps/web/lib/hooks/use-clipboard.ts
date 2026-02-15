/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * use-clipboard.ts
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

import { useState, useCallback } from 'react'
import { tryCatch } from '@libra/common'

/**
 * Hook for copying text to clipboard with temporary success state
 * @param duration - Duration in ms for how long the success state should persist (default: 3000ms)
 * @returns [boolean, (text: string) => Promise<void>] - [wasCopied, copy] tuple
 */
export const useClipboard = (
  duration = 3000
): [boolean, (text: string) => Promise<void>] => {
  const [wasCopied, setWasCopied] = useState(false)

  const copy = useCallback(
    async (text: string) => {
      const [, error] = await tryCatch(async () => {
        await navigator.clipboard.writeText(text)
        setWasCopied(true)

        // Reset wasCopied after duration
        setTimeout(() => {
          setWasCopied(false)
        }, duration)
      })

      if (error) {
        setWasCopied(false)
      }
    },
    [duration]
  )

  return [wasCopied, copy]
}
