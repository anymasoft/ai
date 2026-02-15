/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * sonner.tsx
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

import { useTheme } from 'next-themes'
import type { ComponentPropsWithoutRef } from 'react'
import type { ToasterProps } from 'sonner'
import { Toaster as Sonner, toast as sonnerToast } from 'sonner'
import { cn } from '../lib/utils'

type ToastProps = ComponentPropsWithoutRef<typeof Sonner>

const Toaster = ({
  position = 'bottom-right',
  closeButton = true,
  richColors = true,
  expand = false,
  duration = 4000,
  className,
  ...props
}: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className={cn('toaster group', className)}
      position={position}
      closeButton={closeButton}
      richColors={richColors}
      expand={expand}
      duration={duration}
      toastOptions={{
        classNames: {
          toast: cn(
            'group toast group-[.toaster]: group-[.toaster]:text-fg',
            'group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            'group-[.toaster]:rounded-md group-[.toaster]:p-4',
            'transition-all duration-200 ease-in-out',
            'data-[state=open]:animate-slideInFromBottom data-[state=closed]:animate-fadeOut',
            'ToastRoot'
          ),
          title: cn(
            'group-[.toast]:font-medium group-[.toast]:text-sm',
            'group-[.toast]:mb-1 group-[.toast]:tracking-wide'
          ),
          description: cn(
            'group-[.toast]:text-muted-foreground group-[.toast]:text-xs',
            'group-[.toast]:opacity-90 group-[.toast]:leading-relaxed'
          ),
          actionButton: cn(
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            'group-[.toast]:font-medium group-[.toast]:rounded-sm group-[.toast]:text-xs',
            'group-[.toast]:py-1 group-[.toast]:px-2 group-[.toast]:transition-colors',
            'group-[.toast]:hover:bg-primary/90 group-[.toast]:focus:ring-1',
            'group-[.toast]:focus:ring-primary/30'
          ),
          cancelButton: cn(
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
            'group-[.toast]:font-medium group-[.toast]:rounded-sm group-[.toast]:text-xs',
            'group-[.toast]:py-1 group-[.toast]:px-2 group-[.toast]:transition-colors',
            'group-[.toast]:hover:bg-muted/90 group-[.toast]:focus:ring-1',
            'group-[.toast]:focus:ring-muted/30'
          ),
          error: cn(
            'group-[.toast]:bg-error/10 group-[.toast]:text-error',
            'group-[.toast]:border-error/20'
          ),
          success: cn(
            'group-[.toast]:bg-green-500/10 group-[.toast]:text-green-500',
            'group-[.toast]:border-green-500/20'
          ),
          warning: cn(
            'group-[.toast]:bg-yellow-500/10 group-[.toast]:text-yellow-500',
            'group-[.toast]:border-yellow-500/20'
          ),
          info: cn(
            'group-[.toast]:bg-blue-500/10 group-[.toast]:text-blue-500',
            'group-[.toast]:border-blue-500/20'
          ),
          loading: cn('group-[.toast]:animate-pulse'),
        },
      }}
      {...props}
    />
  )
}

// Simply export the original toast function, ensuring enhanced styles are used
const toast = sonnerToast

export { Toaster, toast }
export type { ToastProps }
