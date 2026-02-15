/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * action-button.tsx
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

import { Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@libra/ui/components/button'
import { cn } from '@libra/ui/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type ButtonIntent = 'primary' | 'secondary' | 'danger'

interface ActionButtonProps extends Omit<ButtonProps, 'variant'> {
  intent: ButtonIntent
  loading?: boolean
  icon?: LucideIcon
  children: React.ReactNode
}

const intentConfig = {
  primary: {
    className: 'deployment-button-primary hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
    variant: 'default' as const
  },
  secondary: {
    className: 'border-border/50 hover:bg-muted/50 hover:border-border/70 transition-all',
    variant: 'outline' as const
  },
  danger: {
    className: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground hover:shadow-lg',
    variant: 'destructive' as const
  }
} as const

export function ActionButton({
  intent,
  loading = false,
  icon: Icon,
  children,
  className,
  disabled,
  ...props
}: ActionButtonProps) {
  const config = intentConfig[intent]
  const isDisabled = disabled || loading

  return (
    <Button
      variant={config.variant}
      disabled={isDisabled}
      className={cn(
        'h-12 font-semibold relative overflow-hidden',
        'transition-all duration-300 ease-out',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        config.className,
        className
      )}
      style={{
        fontSize: 'var(--deployment-font-size-base)',
        borderRadius: 'var(--deployment-radius-md)',
      }}
      aria-disabled={isDisabled}
      aria-describedby={loading ? `${props.id}-loading` : undefined}
      {...props}
    >
      {/* Loading state with enhanced accessibility */}
      {loading ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="sr-only">加载中...</span>
        </>
      ) : Icon ? (
        <Icon className="mr-2 h-5 w-5" aria-hidden="true" />
      ) : null}

      {/* Button content */}
      <span className="relative z-10">{children}</span>

      {/* Ripple effect for primary buttons */}
      {intent === 'primary' && !loading && (
        <span
          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0
                     transform -skew-x-12 -translate-x-full group-hover:translate-x-full
                     transition-transform duration-700 ease-out"
          aria-hidden="true"
        />
      )}
    </Button>
  )
}
