/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error-indicator.tsx
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
import { Button } from '@libra/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@libra/ui/components/card'
import { RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import * as m from '@/paraglide/messages'

interface ErrorIndicatorProps {
  title?: string
  description?: string
  message?: string
  className?: string
}

export function ErrorIndicator({
  title = m["ui.error.title"](),
  description = m["ui.error.description"](),
  message,
  className,
}: ErrorIndicatorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Card className={cn(' w-full max-w-md border', className)}>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-light">{title}</CardTitle>
        <CardDescription className="text-md font-light">
          {description}
        </CardDescription>
      </CardHeader>
      {message && (
        <CardContent className="text-fg-500 mx-auto max-w-md pb-0 text-center">
          <p>{message}</p>
        </CardContent>
      )}
      <CardFooter className="px-auto flex flex-col gap-4 py-4">
        <Button
          variant="outline"
          onClick={() => startTransition(() => router.refresh())}
          className="w-full max-w-md gap-2"
        >
          <RefreshCcw
            className={`text-fg-500 h-4 w-4 duration-500 ease-in-out ${isPending ? 'animate-spin' : ''}`}
          />
          {m["ui.error.refresh"]()}
        </Button>
      </CardFooter>
    </Card>
  )
}
