/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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
import { motion } from 'framer-motion'
import Image from 'next/image'
import React from 'react'
import * as m from '@/paraglide/messages'

export default function Testimonials() {
  return (
    <div className='w-full max-w-7xl mx-auto my-10 sm:my-16 lg:my-20 py-10 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8'>
      <div className='flex flex-col lg:flex-row gap-8 lg:gap-12'>
        {/* Left Title Section - 40% */}
        <div className='w-full lg:w-[40%]'>
          <div className='sticky top-20'>
            <h2
              className={cn(
                'text-2xl sm:text-3xl text-center lg:text-left md:text-4xl lg:text-5xl xl:text-6xl bg-[radial-gradient(61.17%_178.53%_at_38.83%_-13.54%,#3B3B3B_0%,#888787_12.61%,#FFFFFF_50%,#888787_80%,#3B3B3B_100%)] ',
                'bg-clip-text text-transparent leading-tight'
              )}
            >
              {m["testimonials.title"]()}
            </h2>
            <p className='text-sm text-center lg:text-left mx-auto lg:mx-0 text-neutral-400 mt-6 max-w-sm'>
              {m["testimonials.description"]()}
            </p>
          </div>
        </div>

        {/* Right Testimonials Section - 60% */}
        <div className='w-full grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 md:w-[60%] mx-auto'>
          <TestimonialCard
            name={m["testimonials.user1.name"]()}
            role={m["testimonials.user1.role"]()}
            image='/manu_arora.jpg'
            quote={m["testimonials.user1.quote"]()}
          />
          <TestimonialCard
            name={m["testimonials.user2.name"]()}
            role={m["testimonials.user2.role"]()}
            image='/kishore_gunnam.jpg'
            quote={m["testimonials.user2.quote"]()}
            className='lg:mt-[50px]'
          />
          <TestimonialCard
            name={m["testimonials.user3.name"]()}
            role={m["testimonials.user3.role"]()}
            image='/kishore_gunnam.jpg'
            quote={m["testimonials.user3.quote"]()}
            className='lg:mt-[-50px]'
          />
          <TestimonialCard
            name={m["testimonials.user3.name"]()}
            role={m["testimonials.user3.role"]()}
            image='/manu_arora.jpg'
            quote={m["testimonials.user3.quote"]()}
          />
        </div>
      </div>
    </div>
  )
}

const TestimonialCard = ({
  name,
  role,
  image,
  quote,
  className,
}: {
  name: string
  role: string
  image: string
  quote: string
  className?: string
}) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={cn(
        'flex flex-col h-auto min-h-[300px] sm:h-96 p-6 sm:p-8 rounded-[17px]',
        'border border-[#474747]',
        'bg-white bg-[linear-gradient(178deg,#2E2E2E_0.37%,#0B0B0B_38.61%),linear-gradient(180deg,#4C4C4C_0%,#151515_100%),linear-gradient(180deg,#2E2E2E_0%,#0B0B0B_100%)]',
        'relative isolate',
        className
      )}
    >
      <div className='flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8'>
        <div className='relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-2 border-neutral-700'>
          <Image src={image} alt={name} fill className='object-cover' />
        </div>
        <div>
          <h3 className='text-lg sm:text-xl font-semibold text-white'>{name}</h3>
          <p className='text-sm text-neutral-400'>{role}</p>
        </div>
      </div>
      <p className='text-base sm:text-lg text-neutral-300 leading-relaxed'>&quot;{quote}&quot;</p>
    </motion.div>
  )
}
