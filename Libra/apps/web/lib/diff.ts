/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * diff.ts
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

import * as Diff from 'diff';

export function diffFiles(
    original: string,
    modified: string,
): { additions: number; deletions: number } {
    const changes: Diff.Change[] = Diff.diffLines(original, modified);

    let additions = 0;
    let deletions = 0;

    for (const part of changes) {
        if (part.added) {
            additions += part.count ?? 0;
        } else if (part.removed) {
            deletions += part.count ?? 0;
        }
    }

    return { additions, deletions };
}

type AddedType = 1;
type RemovedType = -1;
type UnChangedType = 0;
type ChangeType = AddedType | RemovedType | UnChangedType;

function calculateSquares(
    additions: number,
    deletions: number,
    maxSquares = 5,
): ChangeType[] {
    const totalChanges = additions + deletions;

    if (totalChanges === 0) {
        return Array(maxSquares).fill(0);
    }

    if (totalChanges <= maxSquares) {
        return createSquares(additions, deletions, maxSquares);
    }

    // Calculate the proportion of added and removed lines
    const addedProportion = additions / totalChanges;

    // Calculate the number of squares for added, ensuring at least 1 if there are any additions
    let addedSquares = Math.round(addedProportion * maxSquares);
    addedSquares = additions > 0 ? Math.max(1, addedSquares) : 0;

    // Calculate removed squares, ensuring at least 1 if there are any removals
    let deletedSquares = maxSquares - addedSquares;
    deletedSquares = deletions > 0 ? Math.max(1, deletedSquares) : 0;

    // Final adjustment to ensure we don't exceed maxSquares
    if (addedSquares + deletedSquares > maxSquares) {
        if (additions > deletions) {
            deletedSquares = maxSquares - addedSquares;
        } else {
            addedSquares = maxSquares - deletedSquares;
        }
    }

    return createSquares(addedSquares, deletedSquares, maxSquares);
}

function createSquares(added: number, deleted: number, max: number): ChangeType[] {

    const result: ChangeType[] = [];

    for (let i = 0; i < added; i++) {
        result.push(1);
    }

    for (let i = 0; i < deleted; i++) {
        result.push(-1);
    }

    // If there's remaining space, fill with 'unchanged'
    for (let i = 0, len = max - result.length; i < len; i++) {
        result.push(0);
    }

    return result;
}
