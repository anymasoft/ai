/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * loading.tsx
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@libra/ui/components/card'
import { Skeleton } from '@libra/ui/components/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@libra/ui/components/table'
import { ShieldIcon } from 'lucide-react'

export default function Loading() {
  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldIcon className="h-5 w-5 text-brand" />
              Session Management
            </CardTitle>
            <CardDescription>
              View your account login sessions to ensure account security
            </CardDescription>
          </div>
          <div className="h-9 w-9 rounded-md border border-border bg-background" /> {/* Button placeholder */}
        </div>
      </CardHeader>
      <CardContent>
        {/* Security tip box skeleton */}
        <div className="mb-4">
          <div className="border-l-[3px] border-contrast-1 p-4 bg-muted/50 rounded-md">
            <Skeleton className="h-5 w-[120px] mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead className="hidden md:table-cell">IP Address</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead className="hidden md:table-cell">Login Time</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 4 }).map((_, index) => (
              <TableRow key={`skeleton-${index}`} className="animate-pulse">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-5 w-[120px]" />
                  </div>
                  <div className="mt-1 md:hidden">
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-5 w-[100px]" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-5 w-[80px]" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Skeleton className="h-5 w-[120px]" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Skeleton className="h-6 w-[80px] rounded-full" />
                    {index !== 0 && index !== 3 && (
                      <Skeleton className="h-8 w-8 rounded-md" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
