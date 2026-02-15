/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * ai-generate.tsx
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
import { motion, easeInOut } from 'framer-motion'
import type { Variants } from 'framer-motion'

const AiGenerate = () => {
    const variants: Variants = {
        initial: {
            x: 0,
        },
        animate: {
            x: 10,
            rotate: 5,
            transition: {
                duration: 0.3,
                ease: easeInOut,
            },
        },
    }
    const variantsSecond: Variants = {
        initial: {
            x: 0,
        },
        animate: {
            x: -10,
            rotate: -5,
            transition: {
                duration: 0.3,
                ease: easeInOut,
            },
        },
    }


    return (
        <motion.div
            initial='initial'
            whileHover='animate'
            className='flex flex-1 w-full h-full min-h-[6rem] dark:bg-dot-white/[0.2] bg-dot-black/[0.2] flex-col space-y-2'
        >

            <motion.div
                variants={variants}
                className='flex flex-row rounded-full border border-neutral-100 dark:border-white/[0.2] p-2 items-center space-x-2 bg-white dark:bg-black glass-1 dark:glass-3'
            >
                <div className='h-6 w-6 rounded-full bg-gradient-to-r from-primary to-brand shadow-sm dark:shadow-primary/20 shrink-0' />
                <div className='w-full bg-gray-100 h-4 rounded-full dark:bg-neutral-900' />
            </motion.div>
            <motion.div
                variants={variantsSecond}
                className='flex flex-row rounded-full border border-neutral-100 dark:border-white/[0.2] p-2 items-center space-x-2 w-3/4 ml-auto bg-white dark:bg-black glass-1 dark:glass-3'
            >
                <div className='w-full bg-gray-100 h-4 rounded-full dark:bg-neutral-900' />
                <div className='h-6 w-6 rounded-full bg-gradient-to-r from-primary to-brand shadow-sm dark:shadow-primary/20 shrink-0' />
            </motion.div>
            <motion.div
                variants={variants}
                className='flex flex-row rounded-full border border-neutral-100 dark:border-white/[0.2] p-2 items-center space-x-2 bg-white dark:bg-black glass-1 dark:glass-3'
            >
                <div className='h-6 w-6 rounded-full bg-gradient-to-r from-primary to-brand shadow-sm dark:shadow-primary/20 shrink-0' />
                <div className='w-full bg-gray-100 h-4 rounded-full dark:bg-neutral-900' />
            </motion.div>
        </motion.div>
    )
}

export default AiGenerate
