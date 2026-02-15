/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workspace-slug-editor.tsx
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

import type * as React from "react"
import { Input } from "@libra/ui/components/input"
import { cn } from "@libra/ui/lib/utils"
import { generateSlug } from "./workspace-utils"
import { Loader2 } from "lucide-react"
import * as m from '@/paraglide/messages'

interface SlugValidation {
  valid: boolean
  message: string
}

interface WorkspaceSlugEditorProps {
  currentSlug: string
  isEditingSlug: boolean
  setIsEditingSlug: (isEditing: boolean) => void
  customSlug: string
  setCustomSlug: (slug: string) => void
  slugValidation: SlugValidation
  workspaceName: string
  resetSlug: () => void
  slugInputRef: React.RefObject<HTMLInputElement | null>
  isCheckingSlug?: boolean
}

export function WorkspaceSlugEditor({
  currentSlug,
  isEditingSlug,
  setIsEditingSlug,
  customSlug,
  setCustomSlug,
  slugValidation,
  workspaceName,
  resetSlug,
  slugInputRef,
  isCheckingSlug = false
}: WorkspaceSlugEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="workspace-slug" className="text-sm font-medium">
          {m["dashboard.workspace.slugEditor.label"]()}
        </label>
        {!isEditingSlug ? (
          <button
            type="button"
            onClick={() => {
              setIsEditingSlug(true)
              // Focus on input after state update
              setTimeout(() => slugInputRef.current?.focus(), 10)
            }}
            className="text-xs text-primary hover:underline"
          >
            {m["dashboard.workspace.slugEditor.customize"]()}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsEditingSlug(false)
              resetSlug()
            }}
            className="text-xs text-primary hover:underline"
          >
            {m["dashboard.workspace.slugEditor.reset"]()}
          </button>
        )}
      </div>
      
      {isEditingSlug ? (
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <div className="flex-shrink-0 px-3 py-2 text-sm text-muted-foreground bg-muted rounded-l-md border-y border-l">
              workspace/
            </div>
            <Input
              ref={slugInputRef}
              value={customSlug}
              onChange={(e) => {
                const value = e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, '')
                setCustomSlug(value)
              }}
              className={cn(
                "rounded-l-none focus:ring-1 focus:ring-primary",
                !slugValidation.valid && "border-red-300 focus:ring-red-300"
              )}
              placeholder="your-workspace"
              maxLength={30}
            />
            
            {isCheckingSlug && (
              <div className="ml-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          
          {!slugValidation.valid && (
            <p className="text-xs text-red-500 font-medium">
              {slugValidation.message}
            </p>
          )}
          
          <div className="text-xs text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>{m["dashboard.workspace.slugEditor.rules.length"]()}</li>
              <li>{m["dashboard.workspace.slugEditor.rules.format"]()}</li>
              <li>{m["dashboard.workspace.slugEditor.rules.noStartEnd"]()}</li>
            </ul>
          </div>
        </div>
      ) : (
        <button 
          type="button"
          className={cn(
            "w-full flex items-center rounded-md border px-3 py-2 text-sm bg-background hover:border-primary/50 cursor-pointer transition-colors",
            !slugValidation.valid && "border-red-300"
          )}
          onClick={() => {
            setIsEditingSlug(true)
            // Focus on input after state update
            setTimeout(() => slugInputRef.current?.focus(), 10)
          }}
          aria-label={m["dashboard.workspace.slugEditor.editLabel"]()}
        >
          <span className="text-muted-foreground mr-1">workspace/</span>
          <span className={cn(
            "font-medium",
            slugValidation.valid ? "text-primary" : "text-red-500"
          )}>
            {currentSlug}
          </span>
          {isCheckingSlug && (
            <Loader2 className="ml-2 h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {!slugValidation.valid && !isCheckingSlug && (
            <span className="ml-2 text-xs text-red-500">{m["dashboard.workspace.slugEditor.clickToEdit"]()}</span>
          )}
        </button>
      )}

      <p className="text-xs text-muted-foreground flex items-start">
        <span className="mt-0.5">
          {slugValidation.valid
            ? m["dashboard.workspace.slugEditor.description"]()
            : m["dashboard.workspace.slugEditor.fixDescription"]()
          }
        </span>
        {currentSlug !== generateSlug(workspaceName) && !isEditingSlug && (
          <button
            type="button"
            onClick={() => {
              setIsEditingSlug(false)
              resetSlug()
            }}
            className="ml-1 text-primary hover:underline inline-flex items-center"
          >
            <span>{m["dashboard.workspace.slugEditor.reset"]()}</span>
          </button>
        )}
      </p>
    </div>
  )
} 