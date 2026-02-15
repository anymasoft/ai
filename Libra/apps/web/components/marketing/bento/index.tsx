/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

import { Section } from '@libra/ui/components/section'
import {
  Tile,
  TileContent,
  TileDescription,
  TileLink,
  TileTitle,
  TileVisual,
} from '@libra/ui/components/tile'
import type { ReactNode } from 'react'
import { useId } from 'react'
import AiGenerate from '@/components/ui/ai-generate'
import ChatIllustration from '@/components/ui/chat'
import CodeEditorIllustration from '@/components/ui/code-editor'
import GlobeIllustration from '@/components/ui/globe'
import PipelineIllustration from '@/components/ui/pipeline'
import TilesIllustration from '@/components/ui/tiles'
import * as m from '@/paraglide/messages'

interface TileProps {
  title: string
  description: ReactNode
  visual: ReactNode
  size?: string
  icon?: ReactNode
}

interface BentoGridProps {
  title?: string
  description?: string
  tiles?: TileProps[] | false
  className?: string
}

export default function BentoGrid({
  title = m['bento.title'](),
  description = m['bento.description'](),
  tiles = [
    {
      title: m['bento.ai_coding.title'](),
      description: <p>{m['bento.ai_coding.description']()}</p>,
      visual: (
        <div className='min-h-[300px] w-full py-12'>
          <AiGenerate />
        </div>
      ),
      size: 'col-span-12 sm:col-span-6 lg:col-span-5',
    },
    {
      title: m['bento.complete_ownership.title'](),
      description: <p className='max-w-[460px]'>{m['bento.complete_ownership.description']()}</p>,
      visual: (
        <div className='min-h-[240px] w-full grow items-center self-center px-4 lg:px-12'>
          <CodeEditorIllustration />
        </div>
      ),
      size: 'col-span-12 sm:col-span-6 lg:col-span-7',
    },
    {
      title: m['bento.lightning_fast.title'](),
      description: <p className='max-w-[520px]'>{m['bento.lightning_fast.description']()}</p>,
      visual: (
        <div className='min-h-[160px] w-full grow items-center self-center'>
          <PipelineIllustration />
        </div>
      ),
      size: 'col-span-12 sm:col-span-6 lg:col-span-7',
    },
    {
      title: m['bento.performance_optimized.title'](),
      description: m['bento.performance_optimized.description'](),
      visual: (
        <div className='-mb-[96px] sm:-mb-[186px] md:-mx-32'>
          <GlobeIllustration className='[&_svg]:h-[100%] [&_svg]:w-[100%]' />
        </div>
      ),
      size: 'col-span-12 sm:col-span-6 lg:col-span-5',
    },
    {
      title: m['bento.tech_stack_freedom.title'](),
      description: (
        <>
          <p>{m['bento.tech_stack_freedom.description_1']()}</p>
          <p>{m['bento.tech_stack_freedom.description_2']()}</p>
        </>
      ),
      visual: (
        <div className='w-full sm:p-4 md:p-8'>
          <ChatIllustration />
        </div>
      ),
      size: 'col-span-12 sm:col-span-6 lg:col-span-5',
    },
    {
      title: m['bento.community_driven.title'](),
      description: (
        <>
          <p className='max-w-[460px]'>{m['bento.community_driven.description_1']()}</p>
          <p>{m['bento.community_driven.description_2']()}</p>
        </>
      ),
      visual: <TilesIllustration />,
      size: 'col-span-12 sm:col-span-6 lg:col-span-7',
    },
  ],
  className,
}: BentoGridProps) {
  const sectionId = useId()

  return (
    <Section id={sectionId} className={className}  >
      <div className='max-w-container mx-auto flex flex-col items-center gap-6 sm:gap-8 md:gap-10 lg:gap-12 px-4 sm:px-6 lg:px-8' id="features">
        <h2 className='text-center text-2xl font-semibold text-balance sm:text-3xl md:text-4xl lg:text-5xl'>{title}</h2>
        <p className='text-base text-muted-foreground max-w-full sm:max-w-[680px] md:max-w-[840px] text-center font-medium text-balance sm:text-lg md:text-xl'>
          {description}
        </p>
        {tiles !== false && tiles.length > 0 && (
          <div className='grid grid-cols-12 gap-3 sm:gap-4 w-full'>
            {tiles.map((tile) => (
              <Tile key={tile.title} className={tile.size}>
                <TileLink />
                <TileContent>
                  {tile.icon && tile.icon}
                  <TileTitle>{tile.title}</TileTitle>
                  <TileDescription>{tile.description}</TileDescription>
                </TileContent>
                <TileVisual>{tile.visual}</TileVisual>
              </Tile>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
