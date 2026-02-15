/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * history.ts
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

// Content type enumeration for message classification
export type ContentType = 'user_message' | 'thinking' | 'plan' | 'files'

export type FileType = {
    type: 'file';
    modified: string;
    original: string | null;
    path: string;
    basename: string;
    dirname: string;
    description: string;
    isNew?: boolean;
};

export type FileDiffType = {
    modified: string;
    original: string | null;
    basename: string;
    dirname: string;
    path: string;
    additions: number;
    deletions: number;
    type: 'edit' | 'create' | 'delete';
};

export type UserMessageType = {
    type: 'user';
    message: string;
    planId: string;
    contentType?: ContentType;
    attachment?: {
        key: string;
        name: string;
        type: string;
    };
};

export type CommandMessageType = {
    type: 'command';
    planId: string;
    command: 'bun install';
    packages: string[];
    description: string;
    contentType?: ContentType;
};

export type DiffMessageType = {
    type: 'diff';
    planId: string;
    diff: FileDiffType[];
    contentType?: ContentType;
};

export type PlanMessageType = {
    type: 'plan';
    planId: string;
    content: string;
    contentType?: ContentType;
};

export type ThinkingMessageType = {
    type: 'thinking';
    planId: string;
    content: string;
    contentType?: ContentType;
};

export type ScreenshotMessageType = {
    type: 'screenshot';
    planId: string;
    previewUrl: string;
    screenshotKey?: string;
    screenshotTimestamp?: number;
    contentType?: ContentType;
};

export type TimingMessageType = {
    type: 'timing';
    planId: string;
    timestamp: number;
    contentType?: ContentType;
};

export type MessageType = UserMessageType | DiffMessageType | CommandMessageType | PlanMessageType | ThinkingMessageType | ScreenshotMessageType | TimingMessageType;

// history type
export type HistoryType = Array<MessageType>;
