/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error-display.tsx
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

import * as m from '@/paraglide/messages'

interface ErrorDisplayProps {
  onRetry?: () => void
}

export function ErrorDisplay({ onRetry }: ErrorDisplayProps) {
  return (
    <div className='flex items-center justify-center h-full w-full -subtle'>
      <div className='flex flex-col items-center gap-4 p-8 rounded-xl bg-error-bg-subtle border border-error shadow-md max-w-md'>
        <div className='h-12 w-12 rounded-full bg-error-bg flex items-center justify-center'>
          <span className='text-error-fg text-2xl font-bold'>!</span>
        </div>
        <div className='text-center'>
          <p className='text-lg font-medium text-error-fg'>{m['ide.errorDisplay.failedToLoad']()}</p>
          <p className='text-sm text-fg-muted mt-3 mb-4'>
            {m['ide.errorDisplay.networkIssue']()}
          </p>
          <button
            type='button'
            onClick={onRetry || (() => window.location.reload())}
            className='px-4 py-2 bg-emphasis text-fg-default rounded-md hover:bg-emphasis-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          >
            {m['ide.errorDisplay.refreshPage']()}
          </button>
        </div>
      </div>
    </div>
  )
} 