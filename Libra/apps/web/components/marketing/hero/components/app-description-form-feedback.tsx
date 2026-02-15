/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * app-description-form-feedback.tsx
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

import { AlertCircle } from 'lucide-react'
import type { Feedback } from '../types'

interface AppDescriptionFormFeedbackProps {
  feedback: Feedback
}

/**
 * App description form feedback component
 */
export const AppDescriptionFormFeedback: React.FC<AppDescriptionFormFeedbackProps> = ({
  feedback
}) => {
  if (!feedback.show || feedback.type !== 'error') return null;
  
  return (
    <div className='transition-all duration-300 ease-in-out mt-2 animate-in fade-in slide-in-from-top-2 duration-300'>
      <div className='px-3 py-2 rounded-md text-sm bg-destructive/10 text-destructive flex items-center gap-2 ring-1 ring-destructive/30'>
        <AlertCircle className="size-4" />
        {feedback.message}
      </div>
    </div>
  )
} 