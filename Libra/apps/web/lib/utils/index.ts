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

/**
 * Creates an exponential smoothing easing function for Framer Motion animations.
 * This implements exponential smoothing as described in https://lisyarus.github.io/blog/posts/exponential-smoothing.html
 * where the position approaches the target value smoothly with a speed factor.
 * @param {number} speed - The speed factor that determines how quickly the value approaches the target (default: 10)
 * @returns {(t: number) => number} An easing function that takes a progress value between 0 and 1 and returns a smoothed value
 */
export const exponentialSmoothing =
    (speed = 10) =>
        (t: number): number => {
            // For Framer Motion, we want to map t from [0,1] to a smoothed value
            // Using exponential smoothing formula: 1 - exp(-speed * t)
            return 1 - Math.exp(-speed * t)
        }

export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout : ReturnType<typeof setTimeout> | null = null

    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
            func(...args)
            timeout = null
        }, wait)
    }
}
