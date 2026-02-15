/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * common-tab.tsx
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

import { Badge } from '@libra/ui/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@libra/ui/components/card'

interface ComingSoonTabProps {
  title: string
  description: string
}

/**
 * General "Coming Soon" feature tab
 */
export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
  return (
    <div className='h-full flex items-center justify-center p-4'>
      <Card className='w-full max-w-2xl shadow-sm'>
        <CardHeader className='text-center pb-6'>
          <div className='mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center'>
            <div className='h-6 w-6 rounded-full bg-primary/20' />
          </div>
          <CardTitle className='text-2xl'>{title}</CardTitle>
          <CardDescription className='text-base mt-2'>{description}</CardDescription>
        </CardHeader>
        <CardContent className='pb-8'>
          <div className='relative overflow-hidden rounded-lg border bg-muted/20 p-8'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent' />
            <div className='relative text-center space-y-4'>
              <Badge 
                variant='secondary' 
                className='mb-4 px-3 py-1 text-sm font-medium bg-primary/10 text-primary border-primary/20'
              >
                Coming Soon
              </Badge>
              <p className='text-muted-foreground text-sm max-w-md mx-auto'>
                We're working hard to bring you this feature. Stay tuned for updates!
              </p>
              <div className='flex items-center justify-center gap-2 pt-4'>
                <div className='h-2 w-2 rounded-full bg-primary/40 animate-pulse' />
                <div className='h-2 w-2 rounded-full bg-primary/40 animate-pulse animation-delay-200' />
                <div className='h-2 w-2 rounded-full bg-primary/40 animate-pulse animation-delay-400' />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}