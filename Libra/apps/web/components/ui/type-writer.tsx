/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * type-writer.tsx
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
import { useEffect, useState } from 'react'
import * as m from '@/paraglide/messages'

// Default typewriter texts - using constants to avoid dynamic access warnings
const DEFAULT_TYPEWRITER_TEXTS = [
  m['ui.typewriter.text1'](),
  m['ui.typewriter.text2'](),
  m['ui.typewriter.text3'](),
  m['ui.typewriter.text4'](),
  m['ui.typewriter.text5'](),
  m['ui.typewriter.text6'](),
  m['ui.typewriter.text7']()
]

export interface ITypewriterProps {
  delay: number
  texts: string[]
  baseText?: string
}

export function Typewriter({ delay, texts, baseText = '' }: ITypewriterProps) {
  const [animationComplete, setAnimationComplete] = useState(false)
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))
  const displayText = useTransform(rounded, (latest) => baseText.slice(0, latest))

  useEffect(() => {
    const controls = animate(count, baseText.length, {
      type: 'tween',
      delay,
      duration: 1,
      ease: 'easeInOut',
      onComplete: () => setAnimationComplete(true),
    })
    return () => {
      controls.stop?.()
    }
  }, [count, baseText.length, delay])

  return (
    <span>
      <motion.span>{displayText}</motion.span>
      {animationComplete && <RepeatedTextAnimation texts={texts} delay={delay + 1} />}
      <BlinkingCursor />
    </span>
  )
}

export interface IRepeatedTextAnimationProps {
  delay: number
  texts: string[]
}

function RepeatedTextAnimation({ delay, texts = DEFAULT_TYPEWRITER_TEXTS }: IRepeatedTextAnimationProps) {
  const textIndex = useMotionValue(0)

  const baseText = useTransform(textIndex, (latest) => texts[latest] || '')
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))
  const displayText = useTransform(rounded, (latest) => baseText.get().slice(0, latest))
  const updatedThisRound = useMotionValue(true)

  useEffect(() => {
    const animation = animate(count, 60, {
      type: 'tween',
      delay,
      duration: 1,
      ease: 'easeIn',
      repeat: Number.POSITIVE_INFINITY,
      repeatType: 'reverse',
      repeatDelay: 1,
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
      animation.stop?.()
    }
  }, [count, delay, textIndex, texts, updatedThisRound])

  return <motion.span className='inline'>{displayText}</motion.span>
}



function BlinkingCursor() {
  return (
    <motion.div
      animate='blinking'
      className='inline-block h-5 w-[1px] translate-y-1 bg-neutral-900'
    />
  )
}
