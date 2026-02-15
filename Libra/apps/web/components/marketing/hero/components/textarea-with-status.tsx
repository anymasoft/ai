/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * textarea-with-status.tsx
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

import { Sparkles, XCircle } from 'lucide-react'
import type React from 'react'
import * as m from '@/paraglide/messages'

// Define the same ref type as in the hook
type ElementRef<T> = {
  current: T | null;
}

interface TextareaWithStatusProps {
  value: string
  placeholder: string
  stableHeight: number
  isTyping: boolean
  characterCount: number
  maxCharacters: number
  minCharacters: number
  idealCharacterCount: number
  progressBarWidth: number
  aiSuggestion: string
  isInputFocused: boolean
  isSubmitting: boolean
  textareaRef: ElementRef<HTMLTextAreaElement>
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onClear: () => void
  getCharCountStatusLabel: () => string
  getCharCountStatusClass: () => string
}

/**
 * Textarea component with status display
 */
export const TextareaWithStatus: React.FC<TextareaWithStatusProps> = ({
  value,
  placeholder,
  stableHeight,
  isTyping,
  characterCount,
  maxCharacters,
  minCharacters,
  idealCharacterCount,
  progressBarWidth,
  aiSuggestion,
  isInputFocused,
  isSubmitting,
  textareaRef,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  onClear,
  getCharCountStatusLabel,
  getCharCountStatusClass,
}) => {
  return (
    <div className="relative">
      {/* Progress bar indicator */}
      <div 
        className={`absolute top-0 left-0 h-1 transition-all duration-500 ease-out ${
          progressBarWidth > 0 ? 'opacity-100' : 'opacity-0'
        } ${
          characterCount < minCharacters ? 'bg-destructive/50' 
          : characterCount < idealCharacterCount ? 'bg-amber-500/50' 
          : characterCount < maxCharacters * 0.8 ? 'bg-emerald-500/50' 
          : characterCount < maxCharacters ? 'bg-amber-500/50' 
          : 'bg-destructive/50'
        }`}
        style={{ width: `${progressBarWidth}%` }}
      />

      <div className="relative">
        {/* Text input area */}
        <textarea
          ref={textareaRef}
          className='will-change-auto ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 w-full px-4 pt-4 pb-10 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 bg-transparent grow resize-none min-h-[120px] transition-all duration-300 ease-in-out'
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          maxLength={maxCharacters}
          rows={4}
          style={{ height: `${stableHeight}px` }}
          disabled={isSubmitting}
          aria-label='App description'
          aria-describedby='char-count-status'
          spellCheck="true"
        />

        {/* AI suggestion hint - only shown while typing */}
        {aiSuggestion && (
          <div className="absolute top-1 right-4 flex items-center gap-1.5 text-xs text-primary/80 font-light bg-primary/5 px-2 py-0.5 rounded-full ring-1 ring-primary/10 transition-opacity duration-300 ease-in-out">
            <Sparkles className="size-3" />
            <span>{aiSuggestion}</span>
          </div>
        )}

        {/* Enhanced character counter - bottom toolbar */}
        <div className='absolute bottom-0 left-0 right-0 py-2 px-4 flex items-center justify-between bg-muted/20 backdrop-blur-sm border-t border-border/10 transition-opacity duration-300 ease-in-out'>
          <div className="flex items-center gap-2">
            {isTyping && (
              <span className='inline-block h-2 w-2 rounded-full bg-primary animate-pulse' />
            )}
            <div className="flex items-center gap-1.5">
              <span 
                id="char-count-status"
                className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                characterCount < minCharacters ? "bg-destructive/10 ring-1 ring-destructive/20" :
                characterCount < idealCharacterCount ? "bg-amber-500/10 ring-1 ring-amber-500/20" :
                characterCount > maxCharacters * 0.95 ? "bg-destructive/10 ring-1 ring-destructive/20" :
                "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                } ${getCharCountStatusClass()}`}
              >
                {characterCount}/{maxCharacters}
              </span>
              <span className="text-xs text-muted-foreground/70">
                ({getCharCountStatusLabel()})
              </span>
            </div>
          </div>

          {/* Clear button - improved version */}
          {value.length > 0 && (
            <button
              type='button'
              className='text-xs flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30'
              onClick={onClear}
              aria-label="Clear input"
            >
              <XCircle className='size-3' />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 