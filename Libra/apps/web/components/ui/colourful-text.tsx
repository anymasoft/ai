/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * colourful-text.tsx
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
import { motion } from 'motion/react'
import React from 'react'

export function ColourfulText({ text }: { text: string }) {
  const colors = [
    'rgb(131, 179, 32)',
    'rgb(47, 195, 106)',
    'rgb(42, 169, 210)',
    'rgb(4, 112, 202)',
    'rgb(107, 10, 255)',
    'rgb(183, 0, 218)',
    'rgb(218, 0, 171)',
    'rgb(230, 64, 92)',
    'rgb(232, 98, 63)',
    'rgb(249, 129, 47)',
  ]

  const [currentColors, setCurrentColors] = React.useState(colors)
  const [count, setCount] = React.useState(0)
  const [isHydrated, setIsHydrated] = React.useState(false)

  React.useEffect(() => {
    // Set hydrated state first to avoid hydration mismatch
    setIsHydrated(true)

    const interval = setInterval(() => {
      // Use a deterministic shuffle to avoid hydration issues
      setCurrentColors((prevColors) => {
        const shuffled = [...prevColors].sort((a, b) => {
          // Create a pseudo-random but deterministic sort
          const aHash = a.charCodeAt(4)
          const bHash = b.charCodeAt(4)
          return (aHash % 3) - (bHash % 3)
        })
        return shuffled
      })
      setCount((prev) => prev + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Don't render animations until hydrated to prevent mismatch
  if (!isHydrated) {
    return (
      <span className='inline-block whitespace-pre font-sans tracking-tight'>
        {text}
      </span>
    )
  }

  return text.split('').map((char, index) => (
    <motion.span
      // biome-ignore lint/suspicious/noArrayIndexKey: Index is stable for this use case
      key={`${char}-${count}-${index}`}
      initial={{
        y: 0,
      }}
      animate={{
        color: currentColors[index % currentColors.length],
        y: [0, -3, 0],
        scale: [1, 1.01, 1],
        filter: ['blur(0px)', 'blur(5px)', 'blur(0px)'],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 0.5,
        delay: index * 0.05,
      }}
      className='inline-block whitespace-pre font-sans tracking-tight'
    >
      {char}
    </motion.span>
  ))
}
