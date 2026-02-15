/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * section-cards.tsx
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

import * as m from '@/paraglide/messages'
import { useTRPC } from '@/trpc/client'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { CreateProjectDialog } from './create-project-dialog'
import { EmptyState } from './ui/empty-state'
import { ProjectCard } from './ui/project-card'
import { ProjectCreateButton } from './ui/project-create-button'
import { SkeletonCard } from './ui/skeleton-card'

// Project interface definition, exported for use by other components
export interface Project {
  id: string
  name: string
  initialMessage?: string | null
  updatedAt?: any
  createdAt?: any
  isActive?: boolean
  previewImageUrl?: string | null
}

export function SectionCards() {
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const trpc = useTRPC()
  const { data: projects } = useQuery({
    ...trpc.project.list.queryOptions({}),
  })

  return (
    <div className='flex flex-col gap-4 sm:gap-6'>
      <div className='flex items-center justify-between px-3 sm:px-4 lg:px-6'>
        <div className='flex items-center gap-2'>
          <Sparkles className='text-primary h-5 w-5' />
          <h2 className='text-lg sm:text-xl font-bold tracking-tight'>{m['dashboard.my_projects']()}</h2>
        </div>
        <ProjectCreateButton onClick={() => setIsCreateProjectOpen(true)} />
      </div>

      {/* Project list area */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 px-3 sm:px-4 lg:px-6'>
        {!projects ? (
          // Loading state shows skeleton screens
          Array(4)
            .fill(0)
            .map((_, index) => <SkeletonCard key={index} />)
        ) : Array.isArray(projects) && projects.length > 0 ? (
          projects.map((project) => <ProjectCard key={project.id} project={project} />)
        ) : (
          <EmptyState onCreateProject={() => setIsCreateProjectOpen(true)} />
        )}
      </div>

      <CreateProjectDialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen} />
    </div>
  )
}
