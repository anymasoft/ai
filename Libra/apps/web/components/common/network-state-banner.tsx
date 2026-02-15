/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * network-state-banner.tsx
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

import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useState } from 'react'
import {exponentialSmoothing} from "@/lib/utils";
import * as m from '@/paraglide/messages'

export default function NetworkStateBanner() {
  // @ts-ignore
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    // @ts-ignore
    window.addEventListener('online', handleOnline)
    // @ts-ignore
    window.addEventListener('offline', handleOffline)

    return () => {
      // @ts-ignore
      window.removeEventListener('online', handleOnline)
      // @ts-ignore
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline === undefined) return null

  return (
    <AnimatePresence initial={false}>
      {!isOnline && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ duration: 0.2, ease: exponentialSmoothing(5) }}
          className='w-full overflow-hidden border-b border-red-500/20 bg-red-500/10'
          suppressHydrationWarning
        >
          <div className='container mx-auto px-4 py-2'>
            <p className='text-center text-sm font-medium text-red-500'>
              {m["networkState.offline"]()}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
