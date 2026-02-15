/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * form-message.tsx
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

import { Alert, AlertDescription } from '@libra/ui/components/alert'
import { cn } from '@libra/ui/lib/utils'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { motion } from 'motion/react'

export type AuthMessage = { success?: string } | { error?: string } | { message?: string }

export function AuthFormMessage({
  className,
  message,
}: {
  className?: string
  message: AuthMessage
}) {
  return (
    <motion.div
      className={cn('flex w-full max-w-md flex-col gap-2', className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      {'success' in message && (
        <Alert variant='contrast1'>
          <CheckCircle2 className='h-4 w-4' />
          <AlertDescription>{decodeURIComponent(message.success || '')}</AlertDescription>
        </Alert>
      )}
      {'error' in message && (
        <Alert variant='error'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{decodeURIComponent(message.error || '')}</AlertDescription>
        </Alert>
      )}
      {'message' in message && (
        <Alert variant='contrast2'>
          <Info className='h-4 w-4' />
          <AlertDescription>{decodeURIComponent(message.message || '')}</AlertDescription>
        </Alert>
      )}
    </motion.div>
  )
}
