/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * requirements-tab.tsx
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

import type { FormState } from '../project-details-types'
import { Textarea } from '@libra/ui/components/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@libra/ui/components/card'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@libra/ui/components/alert'
import * as m from '@/paraglide/messages'
import { useState, useEffect } from 'react'
import { cn } from '@libra/ui/lib/utils'

interface RequirementsTabProps {
  formState: FormState
  onFormChange: (field: 'name' | 'description' | 'knowledge', value: string) => void
}

const MAX_KNOWLEDGE_LENGTH = 500 // 前端字符限制



/**
 * Knowledge tab component
 */
export function RequirementsTab({ formState, onFormChange }: RequirementsTabProps) {
  const [charCount, setCharCount] = useState(formState.knowledge?.length || 0)
  const [isFocused, setIsFocused] = useState(false)
  
  useEffect(() => {
    setCharCount(formState.knowledge?.length || 0)
  }, [formState.knowledge])

  const handleKnowledgeChange = (value: string) => {
    if (value.length <= MAX_KNOWLEDGE_LENGTH) {
      onFormChange('knowledge', value)
      setCharCount(value.length)
    }
  }

  const charPercentage = (charCount / MAX_KNOWLEDGE_LENGTH) * 100
  const isNearLimit = charPercentage >= 90
  
  return (
    <div className='h-full flex flex-col space-y-4'>
      {/* Main Knowledge Input Card */}
      <Card className='flex-1 flex flex-col shadow-sm'>
        <CardHeader className='pb-4'>
          <CardTitle className='text-xl'>{m["dashboard.projectDetailsTabs.knowledge.title"]()}</CardTitle>
          <CardDescription className='text-sm'>
            {m["dashboard.projectDetailsTabs.knowledge.description"]()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-4">
          <div className='flex-1 relative'>
            <Textarea
              value={formState.knowledge}
              onChange={(e) => handleKnowledgeChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={cn(
                'flex-1 h-full min-h-[300px] resize-none',
                'text-sm leading-relaxed p-4',
                'border-input/50 focus:border-primary/50',
                'transition-all duration-200',
                'placeholder:text-muted-foreground/60 placeholder:italic',
                isFocused && 'shadow-sm'
              )}
              placeholder={m["dashboard.projectDetailsTabs.knowledge.placeholder"]()}
            />
          </div>
          
          {/* Character Count */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              {formState.hasKnowledgeChanges && (
                <span className='text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md'>
                  {m["dashboard.projectDetailsTabs.knowledge.unsaved"]()}
                </span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <span className={cn(
                'text-xs font-medium transition-colors',
                isNearLimit ? 'text-amber-600' : 'text-muted-foreground'
              )}>
                {charCount.toLocaleString()} / {MAX_KNOWLEDGE_LENGTH.toLocaleString()}
              </span>
              <div className='w-20 h-1.5 bg-muted rounded-full overflow-hidden'>
                <div 
                  className={cn(
                    'h-full transition-all duration-300',
                    isNearLimit ? 'bg-amber-600' : 'bg-primary'
                  )}
                  style={{ width: `${Math.min(charPercentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips and Information Alert */}
      <Alert className='shadow-sm border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10'>
        <AlertCircle className='h-4 w-4 text-blue-600 dark:text-blue-400' />
        <AlertDescription className='text-sm'>
          <span className='font-medium text-blue-900 dark:text-blue-200 block mb-1'>
            {m["dashboard.projectDetailsTabs.knowledge.tipTitle"]()}
          </span>
          <span className='text-blue-800 dark:text-blue-300'>
            {m["dashboard.projectDetailsTabs.knowledge.tipContent"]()}
          </span>
        </AlertDescription>
      </Alert>
    </div>
  )
}