/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * project-details-sidebar.tsx
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
import { Badge } from '@libra/ui/components/badge'
import { ScrollArea } from '@libra/ui/components/scroll-area'
import  { TAB_GROUPS, type TabId } from './project-details-types'
import {
  Activity,
  AlertTriangle,
  FolderOpen,
  MessageSquare,
  Settings,
} from 'lucide-react'
import * as m from '@/paraglide/messages'


/**
 * Icon mapping
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'details': Settings,
  'knowledge': MessageSquare,
  'assets': FolderOpen,
  'analytics': Activity,
  'danger': AlertTriangle,
}

interface SidebarProps {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  showIcons?: boolean
}

/**
 * Project details sidebar navigation component
 */
export function ProjectDetailsSidebar({ activeTab, setActiveTab, showIcons = true }: SidebarProps) {
  return (
    <div className='w-full md:w-56 md:min-w-56 lg:w-64 lg:min-w-64 flex-shrink-0 bg-muted/5 border-b md:border-b-0 md:border-r'>
      <div className='md:sticky md:top-0 w-full overflow-hidden'>
        <ScrollArea className='h-full max-h-[600px] py-4 px-2'>
          {Object.entries(TAB_GROUPS).map(([groupKey, items]) => (
            <div key={groupKey} className='mb-6'>
              <h3 className='text-xs font-medium text-muted-foreground mb-3 px-1 uppercase tracking-wider'>
                {groupKey === 'project' && m["dashboard.projectDetailsTabs.groups.project"]()}
                {groupKey === 'content' && m["dashboard.projectDetailsTabs.groups.content"]()}
                {groupKey === 'dangerZone' && m["dashboard.projectDetailsTabs.groups.dangerZone"]()}
              </h3>
              <nav className='space-y-1.5'>
                {items.map((tab) => {
                  const Icon = ICON_MAP[tab.id] || Settings
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      type='button'
                      className={cn(
                        'group flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-lg transition-all duration-200',
                        'hover:bg-muted/50',
                        activeTab === tab.id && 'bg-primary/10 text-primary hover:bg-primary/15',
                        activeTab !== tab.id && 'text-muted-foreground hover:text-foreground',
                        tab.comingSoon && 'cursor-not-allowed opacity-60'
                      )}
                      disabled={tab.comingSoon}
                      aria-current={activeTab === tab.id ? 'page' : undefined}
                    >
                      <div className='flex items-center gap-3'>
                        {showIcons && (
                          <Icon 
                            className={cn(
                              'h-4 w-4 transition-colors',
                              activeTab === tab.id && 'text-primary'
                            )} 
                          />
                        )}
                        <span className={cn(
                          'font-medium',
                          activeTab === tab.id && 'text-primary'
                        )}>
                          {tab.id === 'details' && m["dashboard.projectDetailsTabs.tabs.details"]()}
                          {tab.id === 'knowledge' && m["dashboard.projectDetailsTabs.tabs.knowledge"]()}
                          {tab.id === 'assets' && m["dashboard.projectDetailsTabs.tabs.assets"]()}
                          {tab.id === 'analytics' && m["dashboard.projectDetailsTabs.tabs.analytics"]()}
                          {tab.id === 'danger' && m["dashboard.projectDetailsTabs.tabs.danger"]()}
                        </span>
                      </div>
                      {tab.comingSoon && (
                        <Badge 
                          variant='secondary' 
                          className={cn(
                            'text-xs h-5 px-2',
                            'bg-muted text-muted-foreground',
                            'group-hover:bg-muted/80'
                          )}
                        >
                          Coming Soon
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}