/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * type.ts
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

export type DescriptionChunkType = {
    type: 'description' | 'description_complete';
    planId: string;
    data: { content: string };
};

export type ThinkingChunkType = {
    type: 'thinking' | 'thinking_complete';
    planId: string;
    data: { content: string };
};

type FileActionChunkType = {
    type: 'file';
    description: string;
    modified: string;
    original: string | null;
    basename: string;
    dirname: string;
    path: string;
    isNew?: boolean;
};

type CommandActionChunkType = {
    type: 'command';
    description: string;
    command: 'bun install';
    packages: string[];
};

export type ActionChunkType = {
    type: 'action';
    planId: string;
    data: FileActionChunkType | CommandActionChunkType ;
};