/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * member-table.tsx
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
import { Avatar, AvatarFallback, AvatarImage } from '@libra/ui/components/avatar'
import { Button } from '@libra/ui/components/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@libra/ui/components/select"
import { 
  TrashIcon, 
  UserIcon, 
  AlertCircleIcon
} from "lucide-react"
import * as m from '@/paraglide/messages'

// Import status badge components
import { 
  RoleBadge, 
  getMemberStatus 
} from './status-badges'

// Import types
import type { MemberTableProps, Member } from './types'

export function MemberTable({
  members,
  isLoading,
  organizationId,
  onUpdateRole,
  onRemoveMember
}: MemberTableProps) {
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)

  // Handle member removal
  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    
    await onRemoveMember(
      memberToRemove.id, 
      organizationId,
      memberToRemove.user?.name,
      memberToRemove.user?.email
    )
    
    setMemberToRemove(null)
  }

  return (
    <Card className="border-border/40">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m['dashboard.teams.memberTable.columns.name']()}</TableHead>
              <TableHead className="hidden md:table-cell">{m['dashboard.teams.memberTable.columns.role']()}</TableHead>
              <TableHead className="hidden md:table-cell">{m['dashboard.teams.memberTable.columns.joinedAt']()}</TableHead>
              <TableHead className="text-right">{m['dashboard.teams.memberTable.columns.actions']()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading state
              Array(3).fill(0).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-9 w-16" />
                      <Skeleton className="h-9 w-9" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <UserIcon className="h-8 w-8 opacity-40" />
                    <p>{m['dashboard.teams.memberTable.noMembers']()}</p>
                    <p className="text-sm">{m['dashboard.teams.memberTable.inviteFirst']()}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                return (
                  <TableRow key={member.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {member.user?.image ? (
                            <AvatarImage src={member.user.image} alt={member.user.name || m['avatar.userAlt']()} />
                          ) : null}
                          <AvatarFallback>
                            {(member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || 'U').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <div className="font-medium">
                            {member.user?.name || (member.user?.email ? member.user.email.split('@')[0] : m['dashboard.teams.memberTable.unnamedUser']())}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{member.user?.email || ''}</div>
                          <div className="md:hidden mt-1 flex items-center gap-2">
                            <RoleBadge role={member.role} />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(member.createdAt), 'yyyy-MM-dd')}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.role !== 'owner' ? (
                        <div className="flex justify-end gap-2">
                          <Select
                            value={member.role}
                            onValueChange={(value) => onUpdateRole(member.id, value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="h-9 w-24 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{m['dashboard.teams.inviteForm.roleAdmin']()}</SelectItem>
                              <SelectItem value="member">{m['dashboard.teams.inviteForm.roleMember']()}</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 opacity-70 hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isLoading}
                                onClick={() => setMemberToRemove(member)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle className="text-destructive flex items-center gap-2">
                                  <AlertCircleIcon className="h-5 w-5" />
                                  {m['dashboard.teams.memberTable.actions.confirmRemove']()}
                                </DialogTitle>
                                <DialogDescription>
                                  {m['dashboard.teams.memberTable.actions.confirmRemoveDesc']({ name: memberToRemove?.user?.name || memberToRemove?.user?.email || m['dashboard.teams.memberTable.unnamedUser']() })}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="bg-muted/40 p-4 rounded-md">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    {memberToRemove?.user?.image ? (
                                      <AvatarImage src={memberToRemove.user.image} alt={memberToRemove.user.name || m['avatar.userAlt']()} />
                                    ) : null}
                                    <AvatarFallback>
                                      {(memberToRemove?.user?.name?.charAt(0) || memberToRemove?.user?.email?.charAt(0) || 'U').toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">
                                      {memberToRemove?.user?.name || (memberToRemove?.user?.email ? memberToRemove.user.email.split('@')[0] : m['dashboard.teams.memberTable.unnamedUser']())}
                                    </div>
                                    <div className="text-sm text-muted-foreground">{memberToRemove?.user?.email || ''}</div>
                                  </div>
                                </div>
                              </div>
                              
                              <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setMemberToRemove(null)}
                                >
                                  {m['dashboard.teams.memberTable.actions.cancel']()}
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  onClick={handleRemoveMember}
                                  disabled={isLoading}
                                >
                                  {isLoading ? m['dashboard.teams.memberTable.actions.removing']() : m['dashboard.teams.memberTable.actions.confirm']()}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-sm italic pr-2">
                          {m['dashboard.teams.inviteForm.roleOwner']()}
                        </div>
                      )}
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