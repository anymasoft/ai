/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * glowing-stars.tsx
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
import { AnimatePresence, motion } from 'motion/react'
import React from 'react'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'

export const GlowingStarsBackgroundCard = ({
  className,
  children,
  variant = 'default',
}: {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'light' | 'transparent'
}) => {
  const [mouseEnter, setMouseEnter] = useState(false)

  const backgroundStyles = {
    default: 'bg-[linear-gradient(110deg,#333_0.6%,#222)]',
    light: 'bg-[linear-gradient(110deg,rgba(255,255,255,0.8)_0.6%,rgba(240,240,240,0.9))] dark:bg-[linear-gradient(110deg,rgba(30,30,30,0.7)_0.6%,rgba(20,20,20,0.8))]',
    transparent: 'bg-transparent backdrop-blur-sm'
  }

  const borderStyles = {
    default: 'border-[#eaeaea] dark:border-neutral-600',
    light: 'border-neutral-200 dark:border-neutral-700',
    transparent: 'border-neutral-200/50 dark:border-neutral-700/30'
  }

  return (
    <div
      onMouseEnter={() => {
        setMouseEnter(true)
      }}
      onMouseLeave={() => {
        setMouseEnter(false)
      }}
      className={cn(
        backgroundStyles[variant],
        borderStyles[variant],
        'p-0 h-full w-full rounded-xl border transition-all duration-300 flex flex-col',
        className
      )}
    >
      <div className='flex justify-center items-center'>
        <Illustration mouseEnter={mouseEnter} variant={variant} />
      </div>
      <div className='px-4 pb-4 pt-0 flex-1 flex flex-col'>{children}</div>
    </div>
  )
}

export const GlowingStarsDescription = ({
  className,
  children,
  variant = 'default',
}: {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'light'
}) => {
  const textStyles = {
    default: 'text-white',
    light: 'text-neutral-600 dark:text-neutral-300'
  }

  return <p className={cn('text-base max-w-[16rem]', textStyles[variant], className)}>{children}</p>
}

export const GlowingStarsTitle = ({
  className,
  children,
  variant = 'default',
}: {
  className?: string
  children?: React.ReactNode
  variant?: 'default' | 'light'
}) => {
  const textStyles = {
    default: 'text-[#eaeaea]',
    light: 'text-neutral-800 dark:text-neutral-100'
  }

  return <h2 className={cn('font-bold text-2xl', textStyles[variant], className)}>{children}</h2>
}

const Illustration = ({ mouseEnter, variant = 'default' }: { mouseEnter: boolean; variant?: 'default' | 'light' | 'transparent' }) => {
  const stars = 108
  const columns = 18

  const [glowingStars, setGlowingStars] = useState<number[]>([])

  const highlightedStars = useRef<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      highlightedStars.current = Array.from({ length: 5 }, () => Math.floor(Math.random() * stars))
      setGlowingStars([...highlightedStars.current])
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Memoize star colors to avoid unnecessary re-renders
  const starColors = useMemo(() => ({
    default: {
      base: '#666',
      active: '#fff'
    },
    light: {
      base: 'rgba(180,180,180,0.5)',
      active: '#fff'
    },
    transparent: {
      base: 'rgba(180,180,180,0.3)',
      active: '#fff'
    }
  }), [])

  const glowColors = useMemo(() => ({
    default: 'bg-blue-500 shadow-blue-400',
    light: 'bg-primary shadow-primary/50',
    transparent: 'bg-primary shadow-primary/30'
  }), [])

  // Memoize star props to avoid new object creation on each render
  const getStarProps = useCallback((starIdx: number, isGlowing: boolean, staticDelay: number, delay: number) => {
    return {
      isGlowing: mouseEnter ? true : isGlowing,
      delay: mouseEnter ? staticDelay : delay,
      colors: starColors[variant],
    }
  }, [mouseEnter, starColors, variant])

  return (
    <div
      className='h-32 p-1 w-full'
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '1px',
      }}
    >
      {[...Array(stars)].map((_, starIdx) => {
        const isGlowing = glowingStars.includes(starIdx)
        const delay = (starIdx % 10) * 0.1
        const staticDelay = starIdx * 0.01
        // Memoize star props
        const starProps = getStarProps(starIdx, isGlowing, staticDelay, delay)
        return (
          <div key={`matrix-col-${starIdx}}`} className='relative flex items-center justify-center'>
            <Star {...starProps} />
            {mouseEnter && <Glow delay={staticDelay} colorClass={glowColors[variant]} />}
            <AnimatePresence mode='wait'>
              {isGlowing && <Glow delay={delay} colorClass={glowColors[variant]} />}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

// Memoized Star component to avoid unnecessary re-renders
const Star = React.memo(function Star({ 
  isGlowing, 
  delay,
  colors = { base: '#666', active: '#fff' }
}: { 
  isGlowing: boolean; 
  delay: number;
  colors?: { base: string; active: string }
}) {
  // Memoize animation props
  const animate = useMemo(() => ({
    scale: isGlowing ? [1, 1.2, 2.5, 2.2, 1.5] : 1,
    background: isGlowing ? colors.active : colors.base,
  }), [isGlowing, colors])

  const transition = useMemo(() => ({
    duration: 2,
    delay: delay,
  }), [delay])

  const initial = useMemo(() => ({
    scale: 1,
  }), [])

  return (
    <motion.div
      key={delay}
      initial={initial}
      animate={animate}
      transition={transition}
      className={cn('h-[1px] w-[1px] rounded-full relative z-20')}
      style={{ backgroundColor: isGlowing ? colors.active : colors.base }}
    />
  )
})

// Memoized Glow component
const Glow = React.memo(function Glow({ delay, colorClass = 'bg-blue-500 shadow-blue-400' }: { delay: number; colorClass?: string }) {
  const initial = useMemo(() => ({ opacity: 0 }), [])
  const animate = useMemo(() => ({ opacity: 1 }), [])
  const transition = useMemo(() => ({ duration: 2, delay }), [delay])
  const exit = useMemo(() => ({ opacity: 0 }), [])

  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={transition}
      exit={exit}
      className={cn('absolute left-1/2 -translate-x-1/2 z-10 h-[4px] w-[4px] rounded-full blur-[1px] shadow-2xl', colorClass)}
    />
  )
})
