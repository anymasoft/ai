/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * teams-management.tsx
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

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { toast } from "sonner"
import { RefreshCcwIcon } from "lucide-react"
import * as m from '@/paraglide/messages'

// Import auth client
import { authClient } from '@libra/auth/auth-client' 

// Import UI components
import { Button } from "@libra/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@libra/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@libra/ui/components/tabs'
import { Badge } from '@libra/ui/components/badge'

// Import custom sub-components
import { InviteForm } from './team-components/invite-form'
import { MemberTable } from './team-components/member-table'
import { InvitationTable } from './team-components/invitation-table'
import { LoadingCard } from './team-components/loading-card'

// Import type definitions
import type { 
  Member, 
  Invitation,
  MemberStatus,
  InvitationStatus,
  handleInviteMemberParams
} from './team-components/types'

export function TeamsManagement() {
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined)
  
  const initialized = useRef(false)
  
  // @ts-ignore
  const { data: activeOrganization } = authClient.useActiveOrganization()
  const fetchOrganizationData = async (orgId: string) => {
    try {
      setIsLoading(true)
      setOrganizationId(orgId)

      const invitationsResponse = await authClient.organization.listInvitations({
        query: { organizationId: orgId }
      })

      // Process data
      if (invitationsResponse && 'data' in invitationsResponse) {
        setInvitations(invitationsResponse.data || [])
      }

      // Get member list - directly use activeOrganization.members
      if (activeOrganization?.members) {
        // Ensure type compatibility
        const membersList = activeOrganization.members as unknown as Member[]
        setMembers(membersList)
      }
    } catch (error) {
      console.error("Failed to fetch team data:", error)
      toast.error(m['dashboard.teams.errors.fetchFailed']())
    } finally {
      setIsLoading(false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    // If already initialized and has data, skip
    if (initialized.current && members.length > 0) {
      return
    }
    
    // If no organization data, return directly
    if (!activeOrganization || !activeOrganization.id) {
      return
    }
    
    // Mark as initialized
    initialized.current = true

    fetchOrganizationData(activeOrganization.id)
  }, [activeOrganization, members.length])

  // Manually refresh data
  const refreshData = async () => {
    if (!activeOrganization?.id) return
    
    toast.info(m['dashboard.teams.refreshing'](), { id: "refresh-data" })
    await fetchOrganizationData(activeOrganization.id)
    toast.success(m['dashboard.teams.refreshSuccess'](), { id: "refresh-data" })
  }

  // Handle invite form submission
  const handleInviteMember = async (params: handleInviteMemberParams) => {
    if (!organizationId) {
      toast.error(m['dashboard.teams.errors.noOrganization']())
      return
    }
    
    try {
      setIsLoading(true)

      await authClient.organization.inviteMember({
        email: params.email,
        role: params.role as "admin" | "member" | "owner", 
        organizationId: organizationId
      })

      toast.success(m['dashboard.teams.inviteForm.invitationSent']({ email: params.email }))
      
      if (invitations) {
        const newInvitation: Invitation = {
          id: `temp-${Date.now()}`,  // Temporary ID, will be replaced on refresh
          email: params.email,
          role: params.role,
          status: 'pending',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
          organizationId: organizationId,
          inviterId: '',
          teamId: undefined
        }
        
        setInvitations(prev => [...prev, newInvitation])
      }
    } catch (error) {
      console.error("Failed to send invitation:", error)
      toast.error(m['dashboard.teams.inviteForm.sendFailed']())
    } finally {
      setIsLoading(false)
    }
  }
  
  // Cancel Invitation
  const handleCancelInvitation = async (invitationId: string, email: string) => {
    try {
      setIsLoading(true)
      await authClient.organization.cancelInvitation({
        invitationId
      })
      toast.success(m['dashboard.teams.invitationTable.actions.canceled']({ email }))
      
      // Instead of deleting the invitation record, update its status to "cancelled".
      setInvitations(current => 
        current.map(inv => 
          inv.id === invitationId
            ? {...inv, status: 'canceled'}
            : inv
        )
      )
    } catch (error) {
      console.error("Failed to cancel invitation:", error)
      toast.error(m['dashboard.teams.invitationTable.actions.cancelFailed']())
    } finally {
      setIsLoading(false)
    }
  }
  
  // Remove member
  const handleRemoveMember = async (memberId: string, organizationId: string, name = '', email = '') => {
    try {
      setIsLoading(true)
      await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId
      })

      toast.success(m['dashboard.teams.memberTable.actions.removed']({ name: name || email || '' }))
      
      // Update member list - Filter out removed members from the current list
      setMembers(members.filter(member => member.id !== memberId))
    } catch (error) {
      console.error("Failed to remove member:", error)
      toast.error(m['dashboard.teams.memberTable.actions.removeFailed']())
    } finally {
      setIsLoading(false)
    }
  }

  // Update member roles
  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    try {
      setIsLoading(true)
      await authClient.organization.updateMemberRole({
        memberId,
        role: role as "admin" | "member" | "owner"
      })
      toast.success(m['dashboard.teams.memberTable.actions.roleUpdated']())
      
      // Update current status
      setMembers(current => 
        current.map(member => 
          member.id === memberId 
            ? {...member, role} 
            : member
        )
      )
    } catch (error) {
      console.error("Failed to update member role:", error)
      toast.error(m['dashboard.teams.memberTable.actions.roleUpdateFailed']())
    } finally {
      setIsLoading(false)
    }
  }

  // If no organization data yet, display loading status
  if (!activeOrganization) {
    return <LoadingCard />
  }

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{m['dashboard.teams.title']()}</h1>
          <p className="text-muted-foreground mt-1">{m['dashboard.teams.subtitle']()}</p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={refreshData}
          disabled={isLoading}
          className="shrink-0"
        >
          <RefreshCcwIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {m['dashboard.teams.refreshData']()}
        </Button>
      </div>

      <div className="mb-8">
        <Card className="border-border/40 overflow-hidden">
          <CardHeader className="bg-card/40">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <CardTitle className="text-lg sm:text-xl">{m['dashboard.teams.currentOrganization']()}</CardTitle>
                <CardDescription>
                  {activeOrganization.name || m['dashboard.teams.unnamedOrganization']()}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <InviteForm 
        onInvite={handleInviteMember}
        isLoading={isLoading}
      />

      <div className="space-y-8">
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="mb-2 w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
            <TabsTrigger value="members" className="text-center">
              {m['dashboard.teams.tabs.members']()}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="text-center">
              {m['dashboard.teams.tabs.invitations']()}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="members">
            <MemberTable 
              members={members}
              isLoading={isLoading}
              organizationId={organizationId || ''}
              onUpdateRole={handleUpdateMemberRole}
              onRemoveMember={handleRemoveMember}
            />
          </TabsContent>
          
          <TabsContent value="invitations">
            <InvitationTable 
              invitations={invitations}
              isLoading={isLoading}
              onCancelInvitation={handleCancelInvitation}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 