/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * panelConfig.ts
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

export const PANEL_CONFIG = {
  browser: {
    defaultSize: {
      withChat: 58, // 优化比例，提供更平衡的内容展示
      withoutChat: 100,
      mobile: 100,
      tablet: 60, // 平板端给IDE更多空间
    },
    minSize: {
      desktop: 35, // 降低最小宽度，增加布局灵活性
      tablet: 40,
      mobile: 100,
    },
    className: 'flex flex-col min-h-0 transition-all duration-300 relative ide-browser-panel',
  },
  chat: {
    defaultSize: {
      desktop: 42, // 优化比例，与IDE面板形成更好的平衡
      tablet: 40, // 平板端适当减少，给IDE更多空间
      mobile: 100,
    },
    minSize: 30, // 提高最小宽度，确保聊天内容可读性
    maxSize: {
      desktop: 60, // 增加最大宽度，提供更大的聊天空间
      tablet: 55,
      mobile: 100,
    },
  },
  main: {
    className: 'flex-1 h-full overflow-hidden ide-main-panel',
  },
  codeExplorer: {
    className: 'flex flex-col h-full border overflow-hidden ide-code-explorer',
  },
} as const

export const PANEL_EVENTS = {
  onLayout: (sizes: number[]) => {
  },
  onBrowserResize: (size: number) => {
  },
  onChatResize: (size: number) => {
  },
  onResizeStart: () => {
    document.body.classList.add('resizing-panels')
  },
  onResizeEnd: () => {
    document.body.classList.remove('resizing-panels')
  },
} as const 