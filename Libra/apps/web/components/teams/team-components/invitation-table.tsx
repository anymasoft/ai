/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * invitation-table.tsx
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

import { useState } from 'react'
import { format } from 'date-fns'

// Import UI components
import {
  Card,
  CardContent,
} from '@libra/ui/components/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@libra/ui/components/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@libra/ui/components/table'
import { Skeleton } from '@libra/ui/components/skeleton'
import { Button } from '@libra/ui/components/button'
import { 
  TrashIcon, 
  CheckCircleIcon, 
  AlertCircleIcon
} from "lucide-react"
import * as m from '@/paraglide/messages'

// Import status badge components
import { 
  RoleBadge, 
  InvitationStatusBadge,
  getInvitationStatus 
} from './status-badges'

// Import types
import type { InvitationTableProps, Invitation } from './types'

export function InvitationTable({
  invitations,
  isLoading,
  onCancelInvitation
}: InvitationTableProps) {
  const [invitationToCancel, setInvitationToCancel] = useState<Invitation | null>(null)

  // Handle cancel invitation
  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return
    
    await onCancelInvitation(invitationToCancel.id, invitationToCancel.email)
    setInvitationToCancel(null)
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m['dashboard.teams.invitationTable.columns.email']()}</TableHead>
              <TableHead className="hidden md:table-cell">{m['dashboard.teams.invitationTable.columns.role']()}</TableHead>
              <TableHead className="hidden md:table-cell">{m['dashboard.teams.invitationTable.columns.status']()}</TableHead>
              <TableHead className="hidden md:table-cell">{m['dashboard.teams.invitationTable.columns.expiresAt']()}</TableHead>
              <TableHead className="text-right">{m['dashboard.teams.invitationTable.columns.actions']()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading state
              Array(2).fill(0).map((_, index) => (
                <TableRow key={`inv-skeleton-${index}`}>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-9 w-9 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircleIcon className="h-8 w-8 opacity-40" />
                    <p>{m['dashboard.teams.invitationTable.noInvitations']()}</p>
                    <p className="text-sm">{m['dashboard.teams.invitationTable.noInvitationsDesc']()}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => {
                // Get invitation status
                const invitationStatus = getInvitationStatus(invitation);
                // Can cancel (only pending invitations can be canceled)
                const canCancel = invitationStatus === 'pending';
                
                return (
                  <TableRow 
                    key={invitation.id}
                    // Add fade effect for canceled and expired invitations
                    className={`${invitationStatus === 'canceled' || invitationStatus === 'expired' ? 'opacity-60' : ''}`}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{invitation.email}</div>
                        <div className="md:hidden mt-1 flex flex-wrap gap-1.5">
                          <RoleBadge role={invitation.role} />
                          <InvitationStatusBadge status={invitationStatus} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <RoleBadge role={invitation.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <InvitationStatusBadge status={invitationStatus} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(invitation.expiresAt), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-9 w-9 opacity-70 hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isLoading || !canCancel}
                            onClick={() => setInvitationToCancel(invitation)}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle className="text-destructive flex items-center gap-2">
                              <AlertCircleIcon className="h-5 w-5" />
                              {m['dashboard.teams.invitationTable.actions.confirmCancel']()}
                            </DialogTitle>
                            <DialogDescription>
                              {m['dashboard.teams.invitationTable.actions.confirmCancelDesc']({ email: invitationToCancel?.email || '' })}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="bg-muted/40 p-4 rounded-md">
                            <div>
                              <div className="font-medium">{m['dashboard.teams.inviteForm.emailLabel']()}</div>
                              <div className="text-sm mt-1">{invitationToCancel?.email}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="text-sm text-muted-foreground">{m['dashboard.teams.inviteForm.roleLabel']()}:</div>
                                {invitationToCancel && <RoleBadge role={invitationToCancel.role} />}
                              </div>
                              {invitationToCancel && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="text-sm text-muted-foreground">{m['dashboard.teams.invitationTable.currentStatus']()}:</div>
                                  <InvitationStatusBadge status={getInvitationStatus(invitationToCancel)} />
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setInvitationToCancel(null)}
                            >
                              {m['dashboard.teams.invitationTable.actions.cancel']()}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={handleCancelInvitation}
                              disabled={isLoading}
                            >
                              {isLoading ? m['dashboard.teams.invitationTable.actions.canceling']() : m['dashboard.teams.invitationTable.actions.cancelButton']()}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
} 