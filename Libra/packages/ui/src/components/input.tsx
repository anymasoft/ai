/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * input.tsx
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

import * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

const DebouncedInput = React.forwardRef<
  HTMLInputElement,
  {
    value: string | number
    onChange: (value: string | number) => void
    debounce?: number
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>
>(({ value: initialValue, onChange, debounce = 300, ...props }, ref) => {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, debounce, onChange])

  return <Input {...props} ref={ref} value={value} onChange={(e) => setValue(e.target.value)} />
})
DebouncedInput.displayName = 'DebouncedInput'

const AutosizeInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & { autosize?: boolean }
>((props, ref) => {
  const { value, className, autosize = true, ...rest } = props
  const displayValue = value?.toString() || ''

  return (
    <Input
      {...rest}
      ref={ref}
      value={value}
      className={cn(className, autosize && 'w-[var(--width)]')}
      style={
        autosize
          ? ({
              '--width': `${Math.max(1, displayValue.length)}ch`,
            } as React.CSSProperties)
          : undefined
      }
    />
  )
})
AutosizeInput.displayName = 'AutosizeInput'

export { Input, DebouncedInput, AutosizeInput }
