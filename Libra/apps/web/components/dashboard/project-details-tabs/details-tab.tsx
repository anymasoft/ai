/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * details-tab.tsx
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

import { useId } from 'react'
import type { FormState } from '../project-details-types'
import { formatDate } from '../use-project-details'
import { Input } from '@libra/ui/components/input'
import { Badge } from '@libra/ui/components/badge'
import { Textarea } from '@libra/ui/components/textarea'
import * as m from '@/paraglide/messages'

interface DetailsTabProps {
  project: any // The specific project type should be defined here
  formState: FormState
  projectId: string | null
  onFormChange: (field: 'name' | 'description' | 'knowledge', value: string) => void
}

/**
 * Project details tab - redesigned with flat layout
 */
export function DetailsTab({
  project,
  formState,
  projectId,
  onFormChange
}: DetailsTabProps) {
  const projectNameId = useId()
  const projectDescriptionId = useId()
  
  return (
    <div className='space-y-6 w-full max-w-none'>
      {/* Basic Information Section */}
      <section className='space-y-4'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold tracking-tight text-foreground'>
            {m["dashboard.projectDetailsTabs.details.basicInfo"]()}
          </h2>
          <div className='h-px bg-border/60' />
        </div>
        
        <div className='bg-muted/30 rounded-xl p-4 lg:p-6 space-y-4 lg:space-y-6'>
          {/* Project Name Field */}
          <div className='space-y-3'>
            <label htmlFor={projectNameId} className='text-sm font-medium text-foreground'>
              {m["dashboard.projectDetailsTabs.details.projectName"]()}
            </label>
            <Input
              id={projectNameId}
              value={formState.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              className='bg-background/50 border-border/40 focus:border-primary/60 transition-colors'
              placeholder={m["dashboard.projectDetailsTabs.details.projectNamePlaceholder"]()}
            />
          </div>

          {/* Project Description Field */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <label htmlFor={projectDescriptionId} className='text-sm font-medium text-foreground'>
                {m["dashboard.projectDetailsTabs.details.projectDescription"]()}
              </label>
              <Badge variant='outline' className='bg-background/50 text-xs'>
                {m["dashboard.projectDetailsTabs.details.readOnly"]()}
              </Badge>
            </div>
            <Textarea
              id={projectDescriptionId}
              value={formState.description}
              className='min-h-[120px] bg-background/50 border-border/40 resize-none'
              readOnly
              placeholder={m["dashboard.projectDetailsTabs.details.projectDescriptionPlaceholder"]()}
            />
            <p className='text-xs text-muted-foreground leading-relaxed'>
              {m["dashboard.projectDetailsTabs.details.projectDescriptionHelp"]()}
            </p>
          </div>
        </div>
      </section>

      {/* Project Information Section */}
      <section className='space-y-4'>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold tracking-tight text-foreground'>
            {m["dashboard.projectDetailsTabs.details.projectInfo"]()}
          </h2>
          <div className='h-px bg-border/60' />
        </div>
        
        <div className='bg-muted/20 rounded-xl p-4 lg:p-6'>
          <dl className='space-y-3'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/30'>
              <dt className='text-sm font-medium text-muted-foreground mb-1 sm:mb-0'>
                {m["dashboard.projectDetailsTabs.details.createdAt"]()}
              </dt>
              <dd className='text-sm font-medium text-foreground'>
                {formatDate(typeof project === 'object' ? project?.createdAt : null)}
              </dd>
            </div>
            
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 border-b border-border/30'>
              <dt className='text-sm font-medium text-muted-foreground mb-1 sm:mb-0'>
                {m["dashboard.projectDetailsTabs.details.lastUpdated"]()}
              </dt>
              <dd className='text-sm font-medium text-foreground'>
                {formatDate(typeof project === 'object' ? project?.updatedAt : null)}
              </dd>
            </div>
            
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between py-2'>
              <dt className='text-sm font-medium text-muted-foreground mb-1 sm:mb-0'>
                {m["dashboard.projectDetailsTabs.details.projectId"]()}
              </dt>
              <dd>
                <code className='text-xs bg-muted/60 text-muted-foreground px-2 py-1 rounded-md font-mono break-all'>
                  {projectId}
                </code>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  )
} 
