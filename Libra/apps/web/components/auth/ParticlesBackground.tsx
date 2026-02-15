/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * ParticlesBackground.tsx
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

import {SparklesCore} from '@/components/ui/sparkles'
import {memo} from 'react'
import { useTheme } from 'next-themes'

/**
 * A memoized particles background component
 * Uses 3D particle animation for visual effect
 */
const ParticlesBackground = memo(() => {
    const { resolvedTheme } = useTheme()
    
    // Dynamic particle color based on theme
    const particleColor = resolvedTheme === 'dark' ? '#FDBA72FF' : '#3B82F6FF'
    
    return (
        <div className='absolute inset-0 w-full h-full z-0 overflow-hidden'>
            <SparklesCore
                background="transparent"
                minSize={0.8}
                maxSize={2.0}
                particleDensity={100}
                className="w-full h-full"
                particleColor={particleColor}
            />
        </div>
    )
})

ParticlesBackground.displayName = 'ParticlesBackground'

export default ParticlesBackground 