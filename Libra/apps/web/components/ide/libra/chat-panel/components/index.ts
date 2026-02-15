/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.ts
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

// Chat panel component exports - unified entry file
// Group and export all components by functionality and type for easy import

// =====================
// Main chat components
// =====================
export { ChatMessage } from './chat-message';
export { MessageGroup } from './message-group';
export { MessageList } from './message-list';
export { ChatInputArea } from './chat-input-area';
export { ChatHeader } from './chat-header';
export { NewMessageIndicator } from './new-message-indicator';

// =====================
// UI subcomponents
// =====================
export * from './ui';

// =====================
// Utility hooks
// =====================
export * from './hooks';

// =====================
// Type definitions
// =====================
export * from './types';