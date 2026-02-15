/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * workspace-utils.ts
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

/**
 * Utility functions and types for workspace management
 */

import * as React from "react"
import { authClient } from "@libra/auth/auth-client"
import * as m from "@/paraglide/messages"

// Workspace type definition
export interface TeamProps {
  id: string
  name: string
  logo: React.ElementType
  plan: string
  slug?: string | null
}

/**
 * Generate a URL-friendly slug from a workspace name
 */
export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Validate a workspace slug
 */
function validateSlug(slug: string): { valid: boolean; message: string } {
  // Basic validation: cannot be empty, length 3-30, only lowercase letters, numbers and hyphens
  if (!slug) return { valid: false, message: m['dashboard.workspace.validation.slugEmpty']() }
  if (slug.length < 3) return { valid: false, message: m['dashboard.workspace.validation.slugTooShort']() }

  const validPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
  if (!validPattern.test(slug)) {
    return {
      valid: false,
      message: m['dashboard.workspace.validation.slugInvalidFormat']()
    }
  }

  return { valid: true, message: '' }
}

/**
 * A custom hook for debouncing values
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    // Set a timeout to update the debounced value after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cancel the timeout if the value changes or the component unmounts
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for managing workspace slug state
 */
export function useWorkspaceSlug(workspaceName: string) {
  const [customSlug, setCustomSlug] = React.useState("")
  const [isEditingSlug, setIsEditingSlug] = React.useState(false)
  const [isCheckingSlug, setIsCheckingSlug] = React.useState(false)
  const [slugAvailability, setSlugAvailability] = React.useState<{
    available: boolean;
    message: string;
  }>({ available: true, message: '' })
  
  // Get current slug to use
  const currentSlug = React.useMemo(() => {
    if (isEditingSlug && customSlug) {
      return customSlug
    }

    if (workspaceName) {
      return generateSlug(workspaceName)
    }

    return "your-workspace"
  }, [customSlug, workspaceName, isEditingSlug])

  // Debounce to avoid frequent API calls
  const debouncedSlug = useDebounce(currentSlug, 500)

  // When name changes, if user hasn't customized slug, auto-update slug
  React.useEffect(() => {
    if (!isEditingSlug && workspaceName) {
      setCustomSlug(generateSlug(workspaceName))
    }
  }, [workspaceName, isEditingSlug])

  // Validate current slug
  const baseValidation = React.useMemo(
    () => validateSlug(currentSlug),
    [currentSlug]
  )

  // Check slug availability
  React.useEffect(() => {
    // Only check availability when basic validation passes
    if (!baseValidation.valid || debouncedSlug === 'your-workspace') {
      return
    }
    
    const checkSlugAvailability = async () => {
      try {
        setIsCheckingSlug(true)
        // Log the slug check operation
        const result = await authClient.organization.checkSlug({
          slug: debouncedSlug
        })
        
        // If successful return status:true means available
        setSlugAvailability({
          available: true,
          message: ''
        })
      } catch (error) {
        console.error("Failed to check identifier availability:", error)

        // Check if it's because slug is already taken
        if (error && typeof error === 'object' && 'code' in error && error.code === 'SLUG_IS_TAKEN') {
          setSlugAvailability({
            available: false,
            message: m['dashboard.workspace.validation.slugAlreadyInUse']()
          })
        } else {
          // Other unknown errors
          setSlugAvailability({
            available: false,
            message: m['dashboard.workspace.validation.slugCheckFailed']()
          })
        }
      } finally {
        setIsCheckingSlug(false)
      }
    }

    checkSlugAvailability()
  }, [debouncedSlug, baseValidation.valid])

  // Combine basic validation and availability check results
  const slugValidation = React.useMemo(() => {
    if (!baseValidation.valid) {
      return baseValidation
    }
    
    if (!slugAvailability.available) {
      return { valid: false, message: slugAvailability.message }
    }
    
    return { valid: true, message: '' }
  }, [baseValidation, slugAvailability])
  
  return {
    customSlug,
    setCustomSlug,
    isEditingSlug,
    setIsEditingSlug,
    currentSlug,
    slugValidation,
    isCheckingSlug,
    resetSlug: () => setCustomSlug(generateSlug(workspaceName))
  }
} 