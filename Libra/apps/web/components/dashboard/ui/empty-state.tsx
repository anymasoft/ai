/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * empty-state.tsx
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

import { Button } from '@libra/ui/components/button'
import { Plus, Star } from 'lucide-react'
import {
  GlowingStarsDescription,
  GlowingStarsTitle,
} from '../../ui/glowing-stars'
import * as m from '@/paraglide/messages'

export function EmptyState({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <div className='col-span-full flex items-center justify-center py-10 lg:py-16'>
      <div className='px-8 sm:px-10 md:px-12 py-10 sm:py-12 md:py-14 flex flex-col items-center w-full'>
        {/* Icon container */}
        <div className='p-5 rounded-xl bg-primary/10 mb-6 inline-block relative'>
          <div className='absolute inset-0 rounded-xl bg-primary/5 animate-pulse opacity-30' />
          <Star className='size-8 text-primary relative z-10' />
        </div>

        {/* Title */}
        <GlowingStarsTitle variant='light' className='text-2xl mb-3 font-semibold'>
          {m["dashboard.empty_state_title"]()}
        </GlowingStarsTitle>

        {/* Subtitle */}
        <GlowingStarsDescription
          variant='light'
          className='max-w-md mb-8 text-center text-muted-foreground text-base leading-relaxed'
        >
          {m["dashboard.empty_state_description"]()}
        </GlowingStarsDescription>

        {/* Button */}
        <Button
          className='flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg px-6 py-2 text-base font-medium'
          onClick={onCreateProject}
        >
          <Plus className='size-5' />
          <span>{m["dashboard.empty_state_button"]()}</span>
        </Button>
      </div>
    </div>
  )
} 