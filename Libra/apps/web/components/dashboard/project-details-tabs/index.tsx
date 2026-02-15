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

'use client'

import type { TabId } from '../project-details-types'
import type { FormState } from '../project-details-types'
import { Skeleton } from '@libra/ui/components/skeleton'
import { DetailsTab } from './details-tab'
import { RequirementsTab } from './requirements-tab'
import { DangerTab } from './danger-tab'
import { ComingSoonTab } from './common-tab'

interface TabContentProps {
  activeTab: TabId
  project: any
  projectId: string | null
  formState: FormState
  onFormChange: (field: 'name' | 'description' | 'knowledge', value: string) => void
  isDeleting: boolean
  onDeleteClick: () => void
  onClose?: () => void
}

/**
 * Return the corresponding component based on the currently active tab
 */
export function TabContent({
  activeTab,
  project,
  projectId,
  formState,
  onFormChange,
  isDeleting,
  onDeleteClick,
  onClose,
}: TabContentProps) {
  // Return the corresponding component based on the tab ID
  switch (activeTab) {
    case 'details':
      return (
        <DetailsTab
          project={project}
          formState={formState}
          projectId={projectId}
          onFormChange={onFormChange}
        />
      )
    case 'knowledge':
      return <RequirementsTab
        formState={formState}
        onFormChange={onFormChange}
      />
    case 'assets':
      return <ComingSoonTab title="Assets" description="Manage project assets and resources" />
    case 'analytics':
      return <ComingSoonTab title="Analytics" description="View project performance and usage data" />
    case 'danger':
      return <DangerTab 
        isDeleting={isDeleting} 
        onDeleteClick={onDeleteClick} 
        onClose={onClose}
        projectName={project?.name || formState.name || 'Unknown Project'} 
      />
    default:
      return null
  }
}

/**
 * Loading state component
 */
export function LoadingState() {
  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-1/3' />
        <Skeleton className='h-10 w-full' />
      </div>

      <div className='space-y-2'>
        <Skeleton className='h-8 w-1/4' />
        <Skeleton className='h-24 w-full' />
      </div>

      <div className='space-y-2'>
        <Skeleton className='h-8 w-1/3' />
        <div className='space-y-1'>
          <Skeleton className='h-6 w-full' />
          <Skeleton className='h-6 w-full' />
          <Skeleton className='h-6 w-full' />
        </div>
      </div>
    </div>
  )
}

// Export all tab components



 