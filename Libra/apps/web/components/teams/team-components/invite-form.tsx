/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * invite-form.tsx
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

import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'

// Import UI components
import {
  Button,
} from "@libra/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@libra/ui/components/card'
import { Label } from "@libra/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@libra/ui/components/select"
import { Input } from '@libra/ui/components/input'
import { PlusCircleIcon, UserPlusIcon, MailIcon, UserIcon } from "lucide-react"
import * as m from '@/paraglide/messages'

// Import types
import { InviteFormProps, handleInviteMemberParams } from './types'

// Invite member form validation schema
const getInviteMemberSchema = () => z.object({
  email: z.email({ error: m['dashboard.teams.inviteForm.emailInvalid']() }),
  role: z.string({ error: m['dashboard.teams.inviteForm.roleRequired']() })
})

export function InviteForm({ onInvite, isLoading }: InviteFormProps) {
  const InviteMemberSchema = getInviteMemberSchema()
  
  // Form setup
  const form = useForm<z.infer<typeof InviteMemberSchema>>({
    resolver: zodResolver(InviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member'
    },
  })

  // Handle form submission
  const handleSubmit = async (data: z.infer<typeof InviteMemberSchema>) => {
    // Call parent component's method
    await onInvite(data as handleInviteMemberParams)
    
    // Reset form
    form.reset({
      email: '',
      role: 'member'
    })
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      <Card className="mb-8 border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center">
            <UserPlusIcon className="h-5 w-5 mr-2 text-primary" />
            {m['dashboard.teams.inviteForm.title']()}
          </CardTitle>
          <CardDescription>
            {m['dashboard.teams.inviteForm.description']()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Email input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2 text-sm font-medium">
                <MailIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {m['dashboard.teams.inviteForm.emailLabel']()}
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  placeholder="alex@example.com"
                  disabled={isLoading}
                  className="pl-3 pr-3 border-input/70 bg-background focus-visible:border-primary/50 transition-all duration-200 hover:border-input shadow-sm"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            {/* Role selection */}
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2 text-sm font-medium">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                {m['dashboard.teams.inviteForm.roleLabel']()}
              </Label>
              <Select
                disabled={isLoading}
                onValueChange={(value) => form.setValue("role", value)}
                defaultValue={form.getValues().role}
              >
                <SelectTrigger id="role" className="border-input/70 bg-background focus-visible:border-primary/50 transition-all duration-200 hover:border-input shadow-sm h-9">
                  <SelectValue placeholder={m['dashboard.teams.inviteForm.rolePlaceholder']()} />
                </SelectTrigger>
                <SelectContent className="min-w-[8rem]">
                  <SelectItem value="member">{m['dashboard.teams.inviteForm.roleMember']()}</SelectItem>
                  <SelectItem value="admin">{m['dashboard.teams.inviteForm.roleAdmin']()}</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.role.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t border-border/40 pt-4">
          <Button
            type='submit'
            disabled={isLoading}
            className="gap-2 shadow-sm transition-all duration-200 hover:shadow"
          >
            <PlusCircleIcon className="h-4 w-4" />
            {isLoading ? m['dashboard.teams.inviteForm.sending']() : m['dashboard.teams.inviteForm.sendInvitation']()}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
} 