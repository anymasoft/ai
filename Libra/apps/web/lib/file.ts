/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * file.ts
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

interface GitHubFile {
    name: string
    path: string
    // sha: string
    // size: number
    // url: string
    // html_url: string
    // git_url: string
    // download_url: string
    type: string
    _links: {
        self: string
        // git: string
        // html: string
    }
}

export interface GitHubFileNode extends GitHubFile {
    children?: Array<GitHubFileNode>
    depth: number
    parentPath?: string
}
