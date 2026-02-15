/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * hero-typewriter-effect.tsx
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

import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@libra/ui/lib/utils'

interface HeroTypewriterEffectProps {
  baseText: string
  examples: string[]
  isActive: boolean
  isInputFocused: boolean
  isHovering: boolean
  hasContent: boolean
  className?: string
  delay?: number
}

export const HeroTypewriterEffect = ({
  baseText,
  examples,
  isActive,
  isInputFocused,
  isHovering,
  hasContent,
  className,
  delay = 1,
}: HeroTypewriterEffectProps) => {
  const [animationComplete, setAnimationComplete] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const animationRef = useRef<any>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Motion values for base text animation
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))
  const displayText = useTransform(rounded, (latest) => baseText.slice(0, latest))

  // Determine if typewriter should be visible
  const shouldShowTypewriter = isActive && !isInputFocused && !isHovering && !hasContent

  // Handle visibility changes
  useEffect(() => {
    if (shouldShowTypewriter) {
      // Delay before starting animation
      timeoutRef.current = setTimeout(() => {
        setShouldShow(true)
      }, 500)
    } else {
      // Hide immediately and reset
      setShouldShow(false)
      setAnimationComplete(false)
      if (animationRef.current) {
        animationRef.current.stop?.()
        animationRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      count.set(0)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [shouldShowTypewriter, count])

  // Base text animation
  useEffect(() => {
    if (shouldShow && !animationComplete) {
      animationRef.current = animate(count, baseText.length, {
        type: 'tween',
        delay: delay,
        duration: baseText.length * 0.05, // 50ms per character like original
        ease: 'linear',
        onComplete: () => setAnimationComplete(true),
      })

      return () => {
        if (animationRef.current) {
          animationRef.current.stop?.()
          animationRef.current = null
        }
      }
    }
  }, [shouldShow, animationComplete, count, baseText.length, delay])

  if (!shouldShow) {
    return null
  }

  return (
    <div className={cn('text-sm text-muted-foreground', className)}>
      <motion.span>{displayText}</motion.span>
      {animationComplete && (
        <RepeatedTextAnimation 
          texts={examples} 
          delay={0.5}
          className="text-foreground font-medium"
        />
      )}
      <BlinkingCursor />
    </div>
  )
}

interface RepeatedTextAnimationProps {
  texts: string[]
  delay: number
  className?: string
}

const RepeatedTextAnimation = ({ texts, delay, className }: RepeatedTextAnimationProps) => {
  const textIndex = useMotionValue(0)
  const count = useMotionValue(0)
  const animationRef = useRef<any>(null)

  const baseText = useTransform(textIndex, (latest) => texts[latest] || '')
  const rounded = useTransform(count, (latest) => Math.round(latest))
  const displayText = useTransform(rounded, (latest) => baseText.get().slice(0, latest))
  const updatedThisRound = useMotionValue(true)

  useEffect(() => {
    if (texts.length === 0) return

    // Use a more conservative max length to ensure proper cycling
    const maxLength = Math.max(...texts.map(text => text.length))

    animationRef.current = animate(count, maxLength, {
      type: 'tween',
      delay,
      duration: maxLength * 0.05, // 50ms per character like original
      ease: 'linear',
      repeat: Number.POSITIVE_INFINITY,
      repeatType: 'reverse',
      repeatDelay: 1.5, // Pause after typing before erasing
      onUpdate(latest) {
        if (updatedThisRound.get() && latest > 0) {
          updatedThisRound.set(false)
        } else if (!updatedThisRound.get() && latest === 0) {
          textIndex.set((textIndex.get() + 1) % texts.length)
          updatedThisRound.set(true)
        }
      },
    })

    return () => {
      if (animationRef.current) {
        animationRef.current.stop?.()
        animationRef.current = null
      }
    }
  }, [count, delay, textIndex, texts, updatedThisRound])

  return <motion.span className={cn('inline', className)}>{displayText}</motion.span>
}

const cursorVariants = {
  blinking: {
    opacity: [0, 0, 1, 1],
    transition: {
      duration: 1,
      repeat: Number.POSITIVE_INFINITY,
      repeatDelay: 0,
      ease: 'linear' as const,
      times: [0, 0.5, 0.5, 1],
    },
  },
}

const BlinkingCursor = () => {
  return (
    <motion.div
      variants={cursorVariants}
      animate='blinking'
      className='inline-block h-4 w-[1px] translate-y-0.5 bg-primary ml-0.5'
    />
  )
}
