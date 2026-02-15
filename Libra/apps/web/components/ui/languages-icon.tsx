/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * languages-icon.tsx
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

import { cn } from '@libra/ui/lib/utils'
import type { Variants } from 'framer-motion'
import { motion, useAnimation } from 'framer-motion'

const pathVariants: Variants = {
  initial: { opacity: 1, pathLength: 1, pathOffset: 0 },
  animate: (custom: number) => ({
    opacity: [0, 1],
    pathLength: [0, 1],
    pathOffset: [1, 0],
    transition: {
      opacity: { duration: 0.01, delay: custom * 0.1 },
      pathLength: {
        type: 'spring',
        duration: 0.5,
        bounce: 0,
        delay: custom * 0.1,
      },
    },
  }),
}

const svgVariants: Variants = {
  initial: { opacity: 1 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

interface LanguagesIconProps {
  className?: string
}

const LanguagesIcon = ({ className }: LanguagesIconProps) => {
  const svgControls = useAnimation()
  const pathControls = useAnimation()

  const onAnimationStart = () => {
    svgControls.start('animate')
    pathControls.start('animate')
  }

  const onAnimationEnd = () => {
    svgControls.start('initial')
    pathControls.start('initial')
  }

  return (
    <div
      className={cn(
        'cursor-pointer select-none hover:bg-accent rounded-md transition-colors duration-200 flex items-center justify-center',
        className
      )}
      onMouseEnter={onAnimationStart}
      onMouseLeave={onAnimationEnd}
    >
      <motion.svg
        xmlns='http://www.w3.org/2000/svg'
        width='28'
        height='28'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
        variants={svgVariants}
        animate={svgControls}
      >
        <motion.path d='m5 8 6 6' variants={pathVariants} custom={3} animate={pathControls} />
        <motion.path d='m4 14 6-6 3-3' variants={pathVariants} custom={2} animate={pathControls} />
        <motion.path d='M2 5h12' variants={pathVariants} custom={1} animate={pathControls} />
        <motion.path d='M7 2h1' variants={pathVariants} custom={0} animate={pathControls} />
        <motion.path
          d='m22 22-5-10-5 10'
          variants={pathVariants}
          custom={3}
          animate={pathControls}
        />
        <motion.path d='M14 18h6' variants={pathVariants} custom={3} animate={pathControls} />
      </motion.svg>
    </div>
  )
}

export { LanguagesIcon }
