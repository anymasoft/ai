/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * page.tsx
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

import { initAuth } from "@libra/auth/auth-server"
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { api } from "@/trpc/server"
import { format } from "date-fns"
import { 
  RefreshCcwIcon, 
  SmartphoneIcon, 
  ComputerIcon, 
  TabletIcon, 
  ServerIcon,
  InfoIcon,
  ShieldIcon,
  XCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from "lucide-react"

// Import UI components
import { Button } from "@libra/ui/components/button"
import { Badge } from '@libra/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@libra/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@libra/ui/components/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@libra/ui/components/tooltip"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@libra/ui/components/alert"
import * as m from '@/paraglide/messages'

export default async function SessionPage() {
  const auth = await initAuth()
  const headersList = await headers()
  const sessionData = await auth.api.getSession({
    headers: headersList,
  })
  const user = sessionData?.user

  if (!user) {
    redirect('/')
  }
  
  // Get all sessions
  const sessions = await api.session.list({})
  
  // Get current session ID
  const currentSessionId = sessions.find(s => s.userId === user.id)?.id || ''
  
  // Get simplified user agent information
  const getDeviceInfo = (userAgent?: string | null) => {
    if (!userAgent) return { name: m['dashboard.session.table.deviceTypes.unknown'](), icon: ServerIcon }
    
    // More detailed device recognition logic
    if (userAgent.includes('iPhone')) return { name: m['dashboard.session.table.deviceTypes.iPhone'](), icon: SmartphoneIcon }
    if (userAgent.includes('iPad')) return { name: m['dashboard.session.table.deviceTypes.iPad'](), icon: TabletIcon }
    if (userAgent.includes('Android') && userAgent.includes('Mobile')) return { name: m['dashboard.session.table.deviceTypes.androidPhone'](), icon: SmartphoneIcon }
    if (userAgent.includes('Android')) return { name: m['dashboard.session.table.deviceTypes.androidTablet'](), icon: TabletIcon }
    if (userAgent.includes('Windows')) return { name: m['dashboard.session.table.deviceTypes.windows'](), icon: ComputerIcon }
    if (userAgent.includes('Mac')) return { name: m['dashboard.session.table.deviceTypes.mac'](), icon: ComputerIcon }
    if (userAgent.includes('Linux')) return { name: m['dashboard.session.table.deviceTypes.linux'](), icon: ServerIcon }
    
    return { name: m['dashboard.session.table.deviceTypes.other'](), icon: ServerIcon }
  }
  
  // Format date time
  const formatDateTime = (date: Date) => {
    return format(new Date(date), 'yyyy-MM-dd HH:mm:ss')
  }
  
  // Check if session is expired
  const isSessionExpired = (expiresAt: Date) => {
    return new Date(expiresAt) < new Date()
  }
  
  // Get session status badge
  const getSessionStatusBadge = (sessionId: string, expiresAt: Date) => {
    if (sessionId === currentSessionId) {
      return (
        <Badge variant="brand" className="flex items-center gap-1 px-2 py-1">
          <CheckCircleIcon className="h-3 w-3" />
          <span>{m['dashboard.session.status.current']()}</span>
        </Badge>
      )
    }
    
    if (isSessionExpired(expiresAt)) {
      return (
        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1 px-2 py-1">
          <XCircleIcon className="h-3 w-3" />
          <span>{m['dashboard.session.status.expired']()}</span>
        </Badge>
      )
    }
    
    return (
      <Badge variant="secondary" className="flex items-center gap-1 px-2 py-1">
        <ShieldIcon className="h-3 w-3" />
        <span>{m['dashboard.session.status.active']()}</span>
      </Badge>
    )
  }

  // Terminate session handler function
  async function terminateSession(sessionId: string) {
    'use server'
    try {
      // Note: This API is not yet implemented, need to add session.terminate method in backend
      // TODO: Implement session termination functionality using sessionId parameter
      // Refresh page to update data
      revalidatePath('/dashboard/session')
    } catch (error) {
      console.error(m['dashboard.session.actions.terminateFailed']({ error: error instanceof Error ? error.message : 'Unknown error' }))
    }
  }

  return (
    <TooltipProvider>
      <Card className="shadow-sm border-0 transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5 text-brand" />
              {m['dashboard.session.title']()}
            </CardTitle>
            <CardDescription>
              {m['dashboard.session.subtitle']()}
            </CardDescription>
          </div>
          <form action={async () => {
            'use server'
            // This form will refresh the page to get latest data
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  type="submit"
                  className="transition-all hover:bg-accent hover:text-accent-foreground"
                >
                  <RefreshCcwIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{m['dashboard.session.refresh']()}</p>
              </TooltipContent>
            </Tooltip>
          </form>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Alert variant="contrast1" border="left" className="bg-muted/50">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>{m['dashboard.session.securityTip.title']()}</AlertTitle>
              <AlertDescription>
                {m['dashboard.session.securityTip.description']()}
              </AlertDescription>
            </Alert>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m['dashboard.session.table.columns.device']()}</TableHead>
                <TableHead className="hidden md:table-cell">{m['dashboard.session.table.columns.ipAddress']()}</TableHead>
                <TableHead className="hidden md:table-cell">{m['dashboard.session.table.columns.location']()}</TableHead>
                <TableHead className="hidden md:table-cell">{m['dashboard.session.table.columns.loginTime']()}</TableHead>
                <TableHead className="text-right">{m['dashboard.session.table.columns.status']()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions && sessions.length > 0 ? (
                // Session list
                sessions.map((session) => {
                  const deviceInfo = getDeviceInfo(session.userAgent);
                  const DeviceIcon = deviceInfo.icon;
                  const isCurrentSession = session.id === currentSessionId;
                  const isExpired = isSessionExpired(session.expiresAt);
                  
                  return (
                    <TableRow 
                      key={session.id} 
                      className="group transition-colors hover:bg-muted/50 cursor-default"
                    >
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          <DeviceIcon className="h-4 w-4 text-brand" />
                          {deviceInfo.name}
                        </div>
                        <div className="text-xs text-muted-foreground md:hidden mt-1">
                          {formatDateTime(session.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {session.ipAddress ? (
                          <Tooltip>
                            <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
                              {session.ipAddress}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{m['dashboard.session.table.unknownIP']()}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : m['dashboard.session.table.unknownIP']()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {session.country ? `${session.country}${session.region ? `, ${session.region}` : ''}` : m['dashboard.session.table.unknownLocation']()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help underline decoration-dotted underline-offset-4">
                            {formatDateTime(session.createdAt)}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{m['dashboard.session.table.expiresAt']({ time: formatDateTime(session.expiresAt) })}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {getSessionStatusBadge(session.id, session.expiresAt)}
                          
                          {!isCurrentSession && !isExpired && (
                            <form action={terminateSession.bind(null, session.id)}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    type="submit" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <XCircleIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{m['dashboard.session.table.terminateTooltip']()}</p>
                                </TooltipContent>
                              </Tooltip>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                // No data state
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AlertTriangleIcon className="h-5 w-5 text-muted-foreground mb-1" />
                      <p className="text-muted-foreground">{m['dashboard.session.table.noSessions']()}</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}