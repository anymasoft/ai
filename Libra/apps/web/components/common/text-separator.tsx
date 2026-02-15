/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * text-separator.tsx
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

import { Separator } from '@libra/ui/components/separator'

interface TextSeparatorProps {
  text: string
}

export default function TextSeparator({ text }: TextSeparatorProps) {
  return (
    <div className='my-6 flex items-center gap-4'>
      <Separator className='w-auto flex-grow bg-gray-200' />
      <span className='text-sm text-gray-500 font-medium'>{text}</span>
      <Separator className='w-auto flex-grow bg-gray-200' />
    </div>
  )
}
