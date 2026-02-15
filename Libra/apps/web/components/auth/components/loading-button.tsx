/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * loading-button.tsx
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

import { Button } from '@libra/ui/components/button'
import type React from 'react'

interface LoadingButtonProps {
  isLoading?: boolean
  loadingText?: string
  className?: string
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export default function LoadingButton({
  isLoading = false,
  loadingText = 'Loading...',
  className = '',
  children,
  icon,
  iconPosition = 'left',
  variant = 'default',
  size = 'default',
  disabled,
  onClick,
  type = 'button',
}: LoadingButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      type={type}
      className={`transition-all duration-200 ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      <div className='flex items-center justify-center gap-2'>
        {isLoading ? (
          <>
            <svg
              className='h-4 w-4 animate-spin'
              fill='none'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
            <span>{loadingText}</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span>{icon}</span>}
            <span>{children}</span>
            {icon && iconPosition === 'right' && <span>{icon}</span>}
          </>
        )}
      </div>
    </Button>
  )
}
