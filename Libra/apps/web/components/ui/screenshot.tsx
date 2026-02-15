/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * screenshot.tsx
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

import { cn } from '@libra/ui/lib/utils'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useEffect, useState } from 'react'

interface ScreenshotProps {
  srcLight: string
  srcDark?: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
  loading?: 'eager' | 'lazy'
}

export default function Screenshot({
  srcLight,
  srcDark,
  alt,
  width,
  height,
  className,
  priority = false,
  loading = 'lazy',
}: ScreenshotProps) {
  const { resolvedTheme } = useTheme()
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (resolvedTheme) {
      setSrc(resolvedTheme === 'light' ? srcLight : srcDark || srcLight)
    }
  }, [resolvedTheme, srcLight, srcDark])

  if (!src) {
    return <div style={{ width, height }} className={cn('bg-muted', className)} aria-label={alt} />
  }

  return (
    <Image 
      src={src} 
      alt={alt} 
      width={width} 
      height={height} 
      className={className} 
      priority={priority}
      loading={loading}
    />
  )
}
