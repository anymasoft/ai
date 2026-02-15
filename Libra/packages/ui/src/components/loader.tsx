/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * loader.tsx
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

import { useCallback, useEffect, useState } from 'react'
import { cn } from '../lib/utils'

// Add this before the Button component
const LOADER_VARIANTS = {
  line: ['|', '/', '─', '\\'],
  progress: ['▰▱▱▱▱▱', '▰▰▱▱▱▱', '▰▰▰▱▱▱', '▰▰▰▰▱▱', '▰▰▰▰▰▱', '▰▰▰▰▰▰'],
  compute: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  dots: ['.  ', '.. ', '...', ' ..', '  .', '   '],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  wave: ['⠀', '⠄', '⠆', '⠇', '⠋', '⠙', '⠸', '⠰', '⠠', '⠀'],
  square: ['◰', '◳', '◲', '◱'],
  pulse: ['□', '◊', '○', '◊'],
} as const

export const Loader = ({
  variant = 'square',
  interval = 150,
  className,
}: {
  variant?: keyof typeof LOADER_VARIANTS
  interval?: number
  className?: string
}) => {
  const [index, setIndex] = useState(0)
  const chars = LOADER_VARIANTS[variant]

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % chars.length)
    }, interval)
    return () => clearInterval(timer)
  }, [chars, interval])

  return <span className={cn('font-mono', className)}>{chars[index]}</span>
}

export const AssemblyLoader = ({
  interval = 20,
  className,
  filledChar = '■',
  emptyChar = '□',
  gridWidth = 5,
  gridHeight = 3,
}: {
  interval?: number
  className?: string
  filledChar?: string
  emptyChar?: string
  gridWidth?: number
  gridHeight?: number
}) => {
  // Grid state: true means filled
  const [grid, setGrid] = useState<boolean[][]>(
    Array(gridHeight)
      .fill(null)
      .map(() => Array(gridWidth).fill(false))
  )

  // Current falling block position
  const [block, setBlock] = useState<{ x: number; y: number } | null>(null)

  // Check if block can move down
  const canMoveDown = useCallback(
    (x: number, y: number) => {
      if (y + 1 >= gridHeight) return false // Bottom boundary
      if (y + 1 >= grid.length) return false

      const nextRow = grid[y + 1]
      if (!nextRow || x >= nextRow.length) return false

      return !nextRow[x]
    },
    [gridHeight, grid]
  )

  // Check if block can move left
  const canMoveLeft = useCallback(
    (x: number, y: number) => {
      if (x - 1 < 0) return false // Left boundary
      if (y >= grid.length) return false

      const currentRow = grid[y]
      if (!currentRow || x - 1 >= currentRow.length) return false

      return !currentRow[x - 1]
    },
    [grid]
  )

  // Place block in grid
  const placeBlock = useCallback((x: number, y: number) => {
    setGrid((prev) => {
      if (y >= prev.length) return prev

      const row = prev[y]
      if (!row || x >= row.length) return prev

      const newGrid = prev.map((row, i) =>
        i === y ? [...row.slice(0, x), true, ...row.slice(x + 1)] : [...row]
      )
      return newGrid
    })
  }, [])

  // Spawn new block - always at rightmost column
  const spawnBlock = useCallback(() => {
    // Check if grid is completely full
    if (grid.every((row) => row.every((cell) => cell))) {
      return null
    }
    return { x: gridWidth - 1, y: 0 }
  }, [grid, gridWidth])

  useEffect(() => {
    const timer = setInterval(() => {
      setBlock((current) => {
        if (!current) {
          return spawnBlock()
        }

        const { x, y } = current

        // If can move down, do it
        if (canMoveDown(x, y)) {
          return { x, y: y + 1 }
        }

        // If can't move down, try to move left
        if (canMoveLeft(x, y)) {
          return { x: x - 1, y }
        }

        // Can't move anymore, place block
        placeBlock(x, y)

        // Spawn new block
        return spawnBlock()
      })
    }, interval)

    return () => clearInterval(timer)
  }, [interval, canMoveDown, canMoveLeft, placeBlock, spawnBlock])

  return (
    <div className={cn('text-fg-300 h-fit w-fit font-mono whitespace-pre', className)}>
      {grid.map((row, y) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Grid rows have fixed positions
        <div key={`row-${y}`}>
          {row.map((cell, x) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Grid cells have fixed positions
            <span key={`cell-${x}-${y}`} className='tracking-[0.5em]'>
              {cell || (block && block.x === x && block.y === y) ? filledChar : emptyChar}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
