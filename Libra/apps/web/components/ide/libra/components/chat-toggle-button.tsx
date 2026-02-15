/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * chat-toggle-button.tsx
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

import { ChevronLeft } from 'lucide-react'
import * as m from '@/paraglide/messages'

interface ChatToggleButtonProps {
  onClick: () => void
}

export function ChatToggleButton({ onClick }: ChatToggleButtonProps) {
  return (
    <button
      type='button'
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick()
        }
      }}
      aria-label={m['ide.chatToggle.openChatAriaLabel']()}
      className='fixed z-10 top-[50%] -translate-y-1/2 right-0 h-24 w-10 md:h-28 md:w-11 flex items-center justify-center shadow-lg rounded-l-xl transition-all duration-300 hover:w-12 md:hover:w-14 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer group
        /* Enhanced visual feedback */
        bg-gradient-to-r from-blue-500/80 to-blue-600/80 hover:from-blue-600 hover:to-blue-700
        /* Mobile: optimized for touch */
        sm:h-16 sm:w-16 sm:top-auto sm:bottom-6 sm:right-6 sm:rounded-full sm:shadow-xl'
      style={{
        backdropFilter: 'blur(8px)',
      }}
    >
      <ChevronLeft className='h-5 w-5 md:h-6 md:w-6 text-white transition-transform duration-300 group-hover:scale-110' aria-hidden='true' />
      <span className='sr-only'>{m['ide.chatToggle.openChat']()}</span>
    </button>
  )
}