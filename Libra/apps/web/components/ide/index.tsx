/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

import type { HistoryType } from '@libra/common'
import LibraComponent from './libra'
import './styles/resizable.css'

/**
 * IDE main entry point
 * Responsible for rendering the core editor interface
 */
export default function Index(props: {
  codePreviewActive?: boolean
  initialMessages: HistoryType
  usageData?: any
  isUsageLoading?: boolean
}) {
  return (
    <div className='h-full w-full overflow-hidden bg-background'>
      <LibraComponent
        codePreviewActive={props.codePreviewActive ?? false}
        initialMessages={props.initialMessages}
        usageData={props.usageData}
        isUsageLoading={props.isUsageLoading ?? false}
      />
    </div>
  )
}
