/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * preview-loader.tsx
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

import { MultiStepLoader } from '@libra/ui/components/multi-step-loader'
import { LogoLarge } from '@/components/common/logo/LogoImage'

/**
 * Get preview-specific loading items
 */
const getPreviewItems = () => [
  { id: 1, text: 'Connecting to server...' },
  { id: 2, text: 'Initializing preview environment...' },
  { id: 3, text: 'Loading application resources...' },
  { id: 4, text: 'Rendering user interface...' },
  { id: 5, text: 'Establishing live connection...' },
  { id: 6, text: 'Optimizing performance...' },
  { id: 7, text: 'Almost ready...' },
  { id: 8, text: 'Preview is ready!' },
]

const getLoadingStates = () =>
  getPreviewItems().map((item) => ({
    text: item.text,
  }))

/**
 * PreviewLoader component - Complete loading experience for Preview components
 * Based on FeatureShowcase design pattern with full UI/UX implementation
 */
export default function PreviewLoader() {
  const loadingStates = getLoadingStates()

  return (
    <div className='relative w-full h-full flex border-border overflow-hidden bg-background items-center justify-center flex-col'>
      {/* Logo section */}
      <div className='w-full flex flex-col items-center justify-center h-full'>
        <div className='h-[80px] lg:h-[100px] flex items-center justify-center'>
          <div className='flex justify-center drop-shadow-glowPrimary'>
            <LogoLarge />
          </div>
        </div>

        {/* Preview loading presentation - use MultiStepLoader to auto-cycle through states */}
        <div className='flex items-center justify-center backdrop-blur-2xl h-[250px] lg:h-[300px] w-full relative'>
          <div className='relative w-full max-w-md mx-auto flex justify-center'>
            <MultiStepLoader
              loadingStates={loadingStates}
              loading={true}
              duration={1500}
              loop={true}
            />
          </div>

          {/* Enhance radial gradient mask effect */}
          <div
            className='absolute inset-x-0 top-0 bottom-0 z-20 pointer-events-none'
            style={{
              background:
                'linear-gradient(to bottom, hsl(var(--background)) 0%, hsla(var(--background), 0) 20%, hsla(var(--background), 0) 80%, hsl(var(--background)) 100%)',
            }}
          />
          <div className='bg-background inset-x-0 z-10 bottom-0 h-full absolute [mask-image:radial-gradient(600px_at_center,transparent_30%,white)]' />
        </div>
      </div>
    </div>
  )
}
