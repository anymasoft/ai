/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-card.tsx
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

import { memo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { enUS, zhCN } from 'date-fns/locale'
import { Clock, MoreVertical, Star } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tooltip, TooltipTrigger } from '@libra/ui/components/tooltip'
import { cn } from '@libra/ui/lib/utils'
import * as m from '@/paraglide/messages'
import { getLocale } from '@/paraglide/runtime'

// Static destructuring of message functions for better tree shaking
const {
  'dashboard.projectCard.time.updatedAgo': timeUpdatedAgo,
  'dashboard.projectCard.time.createdAgo': timeCreatedAgo,
  'dashboard.projectCard.time.justCreated': timeJustCreated,
  'dashboard.projectCard.noDescription': noDescription,
} = m
import {
  GlowingStarsDescription,
  GlowingStarsTitle,
} from '../../ui/glowing-stars'
import { CreateProjectDialog } from '../create-project-dialog'
import { Loading } from '../loading'
import { ProjectDetailsDialog } from '../project-details-dialog'
import type { Project } from '../section-cards'

function ProjectCardComponent({ project }: { project: Project }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showRequirementsDialog, setShowRequirementsDialog] = useState(false)

  // Check if project is inactive
  const isProjectInactive = project.isActive === false

  // Check if there's a valid preview image
  const hasValidPreviewImage =
    project.previewImageUrl &&
    project.previewImageUrl.trim() !== '' &&
    project.previewImageUrl !== 'null' &&
    project.previewImageUrl !== 'undefined'

  const handleProjectClick = (e: React.MouseEvent) => {
    e.preventDefault()

    // If project is inactive, prevent navigation and show tooltip
    if (isProjectInactive) {
      return
    }

    setIsLoading(true)

    if (!project.initialMessage) {
      setShowRequirementsDialog(true)
      setIsLoading(false) // Cancel loading state since we're just opening a dialog
    } else {
      router.push(`/project/${project.id}`)
      // Note: No need to reset loading state as component will be unmounted after navigation
    }
  }

  // Unified mouse hover handler functions
  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  // Format time
  const formattedTime = () => {
    const currentLocale = getLocale()
    const dateLocale = currentLocale === 'zh' ? zhCN : enUS

    if (project.updatedAt) {
      const timeAgo = formatDistanceToNow(new Date(project.updatedAt), { locale: dateLocale })
      return timeUpdatedAgo({ time: timeAgo })
    }
    if (project.createdAt) {
      const timeAgo = formatDistanceToNow(new Date(project.createdAt), { locale: dateLocale })
      return timeCreatedAgo({ time: timeAgo })
    }
    return timeJustCreated()
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger 
          asChild
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className={cn('block h-full group relative cursor-pointer', isProjectInactive && 'opacity-60')}
          >
            {hasValidPreviewImage ? (
              // Display preview image card
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  'overflow-hidden relative rounded-lg border',
                  !isProjectInactive && 'hover:border-primary/50 group-hover:shadow-lg',
                  !isProjectInactive && isHovered ? 'scale-[1.02] shadow-xl shadow-primary/10' : '',
                  isProjectInactive && 'border-muted-foreground/20 bg-muted/30 grayscale',
                  'flex flex-col'
                )}
              >
                {/* Top half: preview image area - reduced height for more compact design */}
                <div className='relative h-32 sm:h-36 md:h-40 overflow-hidden bg-gradient-to-b from-muted/5 to-muted/10'>
                  <Image
                    src={project.previewImageUrl || ''}
                    alt={`${project.name} preview`}
                    fill
                    className='object-cover transition-transform duration-300 group-hover:scale-105'
                    sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
                    loading='lazy'
                    onError={() => {
                      console.error(
                        '[ProjectCard] Failed to load preview image:',
                        project.previewImageUrl
                      )
                    }}
                  />
                </div>

                {/* Light effect shown on hover */}
                {isHovered && !isProjectInactive && (
                  <motion.div
                    className='absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent cursor-pointer z-10'
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    onClick={handleProjectClick}
                  />
                )}

                {/* Disabled overlay for inactive projects */}
                {isProjectInactive && (
                  <div
                    className='absolute inset-0 bg-muted/40 backdrop-blur-[2px] z-10 flex items-center justify-center'
                  >
                    <div className='bg-background/95 px-4 py-2 rounded-md border border-muted-foreground/30 shadow-sm'>
                      <span className='text-xs text-muted-foreground font-medium tracking-wider uppercase'>{m["dashboard.projectCard.inactive"]()}</span>
                    </div>
                  </div>
                )}

                {/* Bottom half: content area - reduced padding for more compact design */}
                <div className='flex flex-col flex-1 p-2.5 sm:p-3 relative z-20'>
                  {/* Clickable area: title and description */}
                  <Link
                    href={isProjectInactive ? '#' : `/project/${project.id}`}
                    className={cn(
                      'block flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md',
                      isProjectInactive && 'pointer-events-none cursor-not-allowed'
                    )}
                    onClick={handleProjectClick}
                    aria-label={`Open project: ${project.name}`}
                    tabIndex={isProjectInactive ? -1 : 0}
                  >
                    <div className='mb-1.5'>
                      <div className='flex items-start justify-between mb-1'>
                        <GlowingStarsTitle
                          variant='light'
                          className='line-clamp-1 text-sm sm:text-base font-semibold leading-tight'
                        >
                          {project.name}
                        </GlowingStarsTitle>

                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, rotate: -45, y: -2 }}
                          animate={{
                            opacity: isHovered ? 1 : 0,
                            scale: isHovered ? 1 : 0.8,
                            rotate: isHovered ? 0 : -45,
                            y: isHovered ? 0 : -2
                          }}
                          transition={{ duration: 0.4, type: 'spring', stiffness: 400, damping: 20 }}
                          aria-hidden='true'
                        >
                          <Star className='h-3.5 w-3.5 text-primary/80 fill-primary/25' />
                        </motion.div>
                      </div>

                      <GlowingStarsDescription
                        variant='light'
                        className='text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.25rem]'
                      >
                        {project.initialMessage || (
                          <span className='italic text-muted-foreground/60'>
                            {noDescription()}
                          </span>
                        )}
                      </GlowingStarsDescription>
                    </div>
                  </Link>

                  {/* Time information - more compact design */}
                  <div className='mt-auto'>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground border-t border-border/30 pt-1.5'>
                      <Clock className='size-3 flex-shrink-0 text-muted-foreground/70' />
                      <span className='inline-block w-full truncate font-medium'>{formattedTime()}</span>
                    </div>
                  </div>
                </div>

                {/* Settings button shown on hover */}
                {isHovered && !isProjectInactive && (
                  <motion.button
                    type='button'
                    className='absolute top-3 right-3 p-2 bg-background/95 backdrop-blur-md rounded-xl border border-border/60 shadow-lg hover:bg-background hover:border-border hover:shadow-xl z-30 transition-all duration-200 hover:scale-105 active:scale-95'
                    initial={{ opacity: 0, scale: 0.8, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -4 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setShowDetailsDialog(true)
                    }}
                    aria-label={m["dashboard.projectCard.projectSettings"]()}
                  >
                    <MoreVertical className='h-4 w-4 text-muted-foreground hover:text-foreground transition-colors' />
                  </motion.button>
                )}
              </div>
            ) : (
              // Display glowing stars background as fallback
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  'overflow-hidden relative rounded-lg border',
                  'bg-gradient-to-br from-background via-background/95 to-muted/20',
                  'border-border/50',
                  'flex flex-col',
                  !isProjectInactive && 'hover:border-primary/50 group-hover:shadow-lg',
                  !isProjectInactive && isHovered ? 'scale-[1.02] shadow-xl shadow-primary/10' : '',
                  isProjectInactive && 'border-muted-foreground/20 bg-muted/30 grayscale'
                )}
              >
                {/* Top half: stars background area - matching image card height */}
                <div className='relative h-32 sm:h-36 md:h-40 overflow-hidden bg-gradient-to-b from-muted/5 to-muted/10'>
                  <div className='flex justify-center items-center h-full'>
                    <div
                      className='h-full p-1 w-full'
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(18, 1fr)',
                        gap: '1px',
                      }}
                    >
                      {[...Array(108)].map((_, starIdx) => (
                        <div key={`star-${starIdx}`} className='relative flex items-center justify-center'>
                          <div
                            className='h-[1px] w-[1px] rounded-full transition-all duration-300'
                            style={{
                              background: isHovered
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--muted-foreground) / 0.3)',
                              boxShadow: isHovered
                                ? '0 0 2px hsl(var(--primary) / 0.5)'
                                : 'none'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Light effect shown on hover */}
                {isHovered && !isProjectInactive && (
                  <motion.div
                    className='absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent cursor-pointer z-10'
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    onClick={handleProjectClick}
                  />
                )}

                {/* Disabled overlay for inactive projects */}
                {isProjectInactive && (
                  <div
                    className='absolute inset-0 bg-muted/40 backdrop-blur-[2px] z-10 flex items-center justify-center'
                  >
                    <div className='bg-background/95 px-4 py-2 rounded-md border border-muted-foreground/30 shadow-sm'>
                      <span className='text-xs text-muted-foreground font-medium tracking-wider uppercase'>{m["dashboard.projectCard.inactive"]()}</span>
                    </div>
                  </div>
                )}

                {/* Bottom half: content area - matching image card structure */}
                <div className='flex flex-col flex-1 p-2.5 sm:p-3 relative z-20'>
                  {/* Clickable area: title and description */}
                  <Link
                    href={isProjectInactive ? '#' : `/project/${project.id}`}
                    className={cn(
                      'block flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md',
                      isProjectInactive && 'pointer-events-none cursor-not-allowed'
                    )}
                    onClick={handleProjectClick}
                    aria-label={`Open project: ${project.name}`}
                    tabIndex={isProjectInactive ? -1 : 0}
                  >
                    <div className='mb-1.5'>
                      <div className='flex items-start justify-between mb-1'>
                        <GlowingStarsTitle
                          variant='light'
                          className='line-clamp-1 text-sm sm:text-base font-semibold leading-tight'
                        >
                          {project.name}
                        </GlowingStarsTitle>

                        <motion.div
                          initial={{ opacity: 0, scale: 0.8, rotate: -45, y: -2 }}
                          animate={{
                            opacity: isHovered ? 1 : 0,
                            scale: isHovered ? 1 : 0.8,
                            rotate: isHovered ? 0 : -45,
                            y: isHovered ? 0 : -2
                          }}
                          transition={{ duration: 0.4, type: 'spring', stiffness: 400, damping: 20 }}
                          aria-hidden='true'
                        >
                          <Star className='h-3.5 w-3.5 text-primary/80 fill-primary/25' />
                        </motion.div>
                      </div>

                      <GlowingStarsDescription
                        variant='light'
                        className='text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-snug min-h-[2rem] sm:min-h-[2.25rem]'
                      >
                        {project.initialMessage || (
                          <span className='italic text-muted-foreground/60'>
                            {noDescription()}
                          </span>
                        )}
                      </GlowingStarsDescription>
                    </div>
                  </Link>

                  {/* Time information - more compact design */}
                  <div className='mt-auto'>
                    <div className='flex items-center gap-2 text-xs text-muted-foreground border-t border-border/30 pt-1.5'>
                      <Clock className='size-3 flex-shrink-0 text-muted-foreground/70' />
                      <span className='inline-block w-full truncate font-medium'>{formattedTime()}</span>
                    </div>
                  </div>
                </div>

                {/* Settings button shown on hover */}
                {isHovered && !isProjectInactive && (
                  <motion.button
                    type='button'
                    className='absolute top-3 right-3 p-2 bg-background/95 backdrop-blur-md rounded-xl border border-border/60 shadow-lg hover:bg-background hover:border-border hover:shadow-xl z-30 transition-all duration-200 hover:scale-105 active:scale-95'
                    initial={{ opacity: 0, scale: 0.8, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -4 }}
                    transition={{ duration: 0.3, type: 'spring', stiffness: 400, damping: 20 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setShowDetailsDialog(true)
                    }}
                    aria-label={m["dashboard.projectCard.projectSettings"]()}
                  >
                    <MoreVertical className='h-4 w-4 text-muted-foreground hover:text-foreground transition-colors' />
                  </motion.button>
                )}
              </div>
            )}

            {/* Loading animation overlay */}
            {isLoading && (
              <motion.div className='absolute inset-0 flex items-center justify-center rounded-lg z-50 bg-background/70 backdrop-blur-sm'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className='w-16 h-16'>
                  <Loading className='animate-pulse' />
                </div>
              </motion.div>
            )}
          </div>
        </TooltipTrigger>

        {/* Tooltip content - removed inactive project tooltip display */}
      </Tooltip>

      {/* Project details dialog */}
      <ProjectDetailsDialog
        open={showDetailsDialog}
        onOpenChange={(open) => setShowDetailsDialog(open)}
        projectId={project.id}
        projectName={project.name}
      />

      {/* Requirements collection dialog */}
      {showRequirementsDialog && (
        <CreateProjectDialog
          open={showRequirementsDialog}
          onOpenChange={(open) => {
            setShowRequirementsDialog(open)
          }}
          preSelectedProjectId={project.id}
          preSelectedProjectName={project.name}
          skipFirstDialog={true}
        />
      )}
    </>
  )
}

export const ProjectCard = memo(ProjectCardComponent)
