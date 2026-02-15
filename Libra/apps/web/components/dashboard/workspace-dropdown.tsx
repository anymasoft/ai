/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workspace-dropdown.tsx
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
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@libra/ui/components/dropdown-menu'
import { SidebarMenuButton } from '@libra/ui/components/sidebar'
import { Button } from '@libra/ui/components/button'
import { CheckIcon, Crown, PlusCircle, Sparkles } from 'lucide-react'
import { Skeleton } from '@libra/ui/components/skeleton'

import type { TeamProps } from './workspace-utils'
import * as m from '@/paraglide/messages'

// Define plan types
type PlanType = 'FREE' | 'PRO' | 'MAX';

// Define visual styles for each plan
const PLAN_STYLES: Record<PlanType, {
  color: string;
  gradientFrom: string;
  gradientTo: string;
  badge: string;
  icon: LucideIcon;
}> = {
  FREE: {
    color: 'text-gray-500',
    gradientFrom: 'from-gray-400',
    gradientTo: 'to-gray-600',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: Sparkles,
  },
  PRO: {
    color: 'text-blue-500',
    gradientFrom: 'from-blue-400',
    gradientTo: 'to-blue-600',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Crown,
  },
  MAX: {
    color: 'text-purple-500',
    gradientFrom: 'from-purple-400',
    gradientTo: 'to-purple-600',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    icon: Crown,
  },
}

// Define icon rendering function for each plan style
const renderPlanIcon = (Icon: LucideIcon, className?: string) => {
  return React.createElement(Icon, { className: className || "size-4" });
};

// Render team Logo component
const renderLogo = (LogoComponent: React.ElementType, className?: string) => {
  return React.createElement(LogoComponent, { className: className || "size-4" });
};

interface WorkspaceDropdownProps {
  teams: TeamProps[]
  activeTeam: TeamProps | null
  onTeamChange: (team: TeamProps) => void
  onCreateWorkspace: () => void
  isChanging: boolean
  isMobile: boolean
}

export function WorkspaceDropdown({
  teams,
  activeTeam,
  onTeamChange,
  onCreateWorkspace,
  isChanging,
  isMobile,
}: WorkspaceDropdownProps) {
  if (!activeTeam) return null

  // Get current active team's plan style
  const getPlanStyle = (plan: string) => {
    const planKey = (plan || 'FREE') as PlanType;
    return PLAN_STYLES[planKey] || PLAN_STYLES.FREE;
  }

  // Get current active team's plan style
  const activeTeamPlanStyle = getPlanStyle(activeTeam.plan || 'FREE');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between px-2"
          disabled={isChanging}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 max-w-[150px] sm:max-w-[180px]">
            <div className="flex-shrink-0 rounded-md p-1">
              {activeTeam.logo ? (
                renderLogo(activeTeam.logo, "size-5")
              ) : (
                <div className="size-5 rounded-md bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                  {activeTeam.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col items-start leading-none min-w-0">
              <span className="line-clamp-1 text-xs sm:text-sm font-medium truncate w-full">
                {activeTeam.name}
              </span>
              <div className="flex items-center gap-1">
                <div className="flex items-center">
                  <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${activeTeamPlanStyle.badge}`}>
                    {renderPlanIcon(activeTeamPlanStyle.icon, "size-2.5")}
                    <span>{activeTeam.plan || 'FREE'}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isMobile ? "center" : "start"}
        side="right"
        className="w-56 sm:w-64 max-h-[50vh] overflow-auto"
      >
        <DropdownMenuRadioGroup
          value={activeTeam.id}
          onValueChange={(value) => {
            const team = teams.find((team) => team.id === value)
            if (team) {
              onTeamChange(team)
            }
          }}
        >
          {teams.map((team) => {
            // Get team plan style
            const planStyle = getPlanStyle(team.plan || 'FREE');

            // Calculate dynamic class names
            const isActive = team.id === activeTeam.id;
            const activeClass = isActive
              ? `bg-gradient-to-r ${planStyle.gradientFrom}/10 ${planStyle.gradientTo}/10`
              : '';
            
            return (
              <DropdownMenuRadioItem
                key={team.id}
                value={team.id}
                className={cn(
                  "py-2 px-3 cursor-pointer focus:bg-accent/80", 
                  activeClass
                )}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 max-w-[180px] sm:max-w-[210px]">
                  <div className="flex-shrink-0 rounded-md p-1">
                    {team.logo ? (
                      renderLogo(team.logo, "size-5")
                    ) : (
                      <div className="size-5 rounded-md bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                        {team.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start leading-none min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="line-clamp-1 text-xs sm:text-sm font-medium truncate w-full">
                        {team.name}
                      </span>
                      {isActive && <CheckIcon className="size-3.5 text-primary ml-1" />}
                    </div>
                    
                    <div className="flex items-center mt-1">
                      <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${planStyle.badge}`}>
                        {renderPlanIcon(planStyle.icon, "size-2.5")}
                        <span>{team.plan || 'FREE'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 py-1.5"
          onClick={onCreateWorkspace}
        >
          <PlusCircle className="size-4 text-muted-foreground" />
          <span>{m["dashboard.workspace.create.createNew"]()}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
