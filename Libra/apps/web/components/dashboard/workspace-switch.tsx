/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workspace-switch.tsx
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

import { authClient } from '@libra/auth/auth-client'
import { SidebarMenu, SidebarMenuItem, useSidebar } from '@libra/ui/components/sidebar'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { toast } from 'sonner'
import * as m from '@/paraglide/messages'
import { CreateWorkspaceDialog } from './create-workspace-dialog'
import { WorkspaceDropdown } from './workspace-dropdown'
import type { TeamProps } from './workspace-utils'

function TeamSwitcher({ teams }: { teams: TeamProps[] }) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isChanging, setIsChanging] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  // @ts-ignore
  const { data: activeOrganization } = authClient.useActiveOrganization()

  // Use first team by default, if activeOrganizationId exists use specified organization
  const defaultActiveTeam = React.useMemo(() => {
    if (activeOrganization?.id && teams.length > 0) {
      const found = teams.find((team) => team.id === activeOrganization.id)
      return found || teams[0]
    }
    return teams.length > 0 ? teams[0] : null
  }, [teams, activeOrganization])

  const [activeTeam, setActiveTeam] = React.useState<TeamProps | null>(defaultActiveTeam || null)

  // Handle switching active organization
  const handleChangeOrganization = async (team: TeamProps) => {
    if (!activeTeam || team.id === activeTeam.id) return

    try {
      setIsChanging(true)
      // Log organization switch start

      if (team.slug) {
        await authClient.organization.setActive({
          organizationSlug: team.slug,
        })
      } else {
        await authClient.organization.setActive({
          organizationId: team.id,
        })
      }

      // Update state
      setActiveTeam(team)

      // Show success message
      toast.success(m['dashboard.workspace.switcher.switchedTo']({ name: team.name }))

      // Refresh page to get new active organization data
      router.refresh()
    } catch (error) {
      console.error('Failed to switch workspace:', error)
      toast.error(m['dashboard.workspace.switcher.switchFailed']())
    } finally {
      setIsChanging(false)
    }
  }

  if (!activeTeam || teams.length === 0) {
    return null
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <WorkspaceDropdown
            teams={teams}
            activeTeam={activeTeam}
            onTeamChange={handleChangeOrganization}
            onCreateWorkspace={() => setIsCreateDialogOpen(true)}
            isChanging={isChanging}
            isMobile={isMobile}
          />
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateWorkspaceDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </>
  )
}

// Export component with new name, maintain compatibility
export { TeamSwitcher as WorkspaceSwitcher }
