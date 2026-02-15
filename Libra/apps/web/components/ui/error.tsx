/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error.tsx
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

import { useEffect } from 'react'
import { ErrorIndicator } from './error-indicator'
import Frame from './frame'
import { cn } from '@libra/ui/lib/utils'
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary'
import { usePostHog } from 'posthog-js/react'

export default function ErrorBoundary({
  error,
  description,
  className,
}: {
  error: Error & { digest?: string }
  description?: string
  className?: string
}) {
  const posthog = usePostHog()

  // biome-ignore lint/correctness/useExhaustiveDependencies: PostHog instance is stable
  useEffect(() => {
    if (posthog) {
      posthog.captureException(error, {
        source: 'error-boundary',
        component: 'ErrorBoundary',
        digest: error.digest,
        description,
      })
    } else {
      // Fallback to console logging if PostHog is not available
      console.error('Error boundary caught:', error)
    }
  }, [error])

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center',
        className
      )}
    >
      <Frame>
        <ErrorIndicator
          description={description}
          message={error.message}
          className="border-none"
        />
      </Frame>
    </div>
  )
}

function CatchErrorBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ReactErrorBoundary
      fallbackRender={({ error }) => <ErrorBoundary error={error} />}
    >
      {children}
    </ReactErrorBoundary>
  )
}
