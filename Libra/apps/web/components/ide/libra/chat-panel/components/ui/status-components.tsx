/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * status-components.tsx
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

import { AlertCircle, Loader2 } from 'lucide-react';
import * as m from '@/paraglide/messages';

/**
 * Loading status component
 * Supports three different sizes of loading status display
 */
export const LoadingState = ({ 
  message = m['ide.statusComponents.loadingContent'](),
  variant = 'default'
}: { 
  message?: string;
  variant?: 'default' | 'compact' | 'inline'
}) => {
  // Inline variant - minimum size
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-fg-subtle py-1">
        <div className="relative h-4 w-4">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-1 w-1 rounded-full" />
          </div>
        </div>
        <span className="text-sm">{message}</span>
      </div>
    );
  }
  
  // Compact variant - medium size
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="flex items-center gap-3 px-4 py-2 -subtle rounded-full shadow-sm">
          <div className="relative h-4 w-4">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-1 w-1 rounded-full" />
            </div>
          </div>
          <span className="text-sm font-medium text-fg">{message}</span>
        </div>
      </div>
    );
  }
  
  // Default variant - full size
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4">
        <div className="h-12 w-12 rounded-full -subtle/60 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
        </div>
        <div className="absolute inset-0 animate-pulse-slow opacity-70">
          <div className="absolute inset-0 rounded-full bg-accent/10 animate-ping" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-fg mb-1">{message}</h3>
      <p className="text-sm text-fg-subtle max-w-md">
        {m['ide.statusComponents.pleaseBePatient']()}
      </p>
    </div>
  );
};

/**
 * Empty state component
 * Used when there is no content to display
 */
export const EmptyState = ({
  message = m['ide.statusComponents.noContentAvailable'](),
  description = m['ide.statusComponents.noContentToDisplay'](),
  icon = <AlertCircle className="h-5 w-5" />
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="w-10 h-10 rounded-full -subtle flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="text-base font-medium text-fg mb-1">{message}</h3>
      <p className="text-sm text-fg-subtle max-w-sm">{description}</p>
    </div>
  );
}; 