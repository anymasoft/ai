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

import * as m from '@/paraglide/messages'
import { Section } from '@libra/ui/components/section'
import type { ReactNode } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../ui/accordion-raised'

interface FAQItemProps {
  question: string
  answer: ReactNode
  value?: string
}

interface FAQProps {
  title?: string
  items?: FAQItemProps[] | false
  className?: string
}

export default function FAQ({
  title = m['faq.title'](),
  items = [
    {
      question: m['faq.q1'](),
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[640px] text-balance'>{m['faq.a1']()}</p>
        </>
      ),
    },
    {
      question: m['faq.q2'](),
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[600px]'>{m['faq.a2']()}</p>
        </>
      ),
    },
    {
      question: m['faq.q3'](),
      answer: (
        <>
          <p className='text-muted-foreground mb-4 max-w-[580px]'>{m['faq.a3']()}</p>
        </>
      ),
    },
    {
      question: m['faq.q4'](),
      answer: <p className='text-muted-foreground mb-4 max-w-[580px]'>{m['faq.a4']()}</p>,
    },
    {
      question: m['faq.q5'](),
      answer: <p className='text-muted-foreground mb-4 max-w-[580px]'>{m['faq.a5']()}</p>,
    },
    {
      question: m['faq.q6'](),
      answer: <p className='text-muted-foreground mb-4 max-w-[580px]'>{m['faq.a6']()}</p>,
    },
  ],
  className,
}: FAQProps) {
  return (
    <Section className={className}>
      <div className='max-w-container mx-auto flex flex-col items-center gap-8 md:flex-row md:items-start'>
        <h2 className='text-center text-3xl leading-tight font-semibold sm:text-5xl md:text-left md:leading-tight'>
          {title}
        </h2>
        {items !== false && items.length > 0 && (
          <Accordion type='single' collapsible className='w-full max-w-[800px]'>
            {items.map((item, index) => (
              <AccordionItem key={index} value={item.value || `item-${index + 1}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </Section>
  )
}
