/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * gold.tsx
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
import { useState } from 'react'
import { getSponsorshipTexts } from '@/lib/sponsorship-i18n'

interface GoldProps {
  locale?: string;
}

export const Gold = ({ locale = 'en' }: GoldProps = {}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const texts = getSponsorshipTexts(locale)

  const goldSponsors = [
    {
      name: locale === 'zh' ? '示例公司' : 'Demo Company',
      category: locale === 'zh' ? '开发工具' : 'Development Tools',
      description: locale === 'zh'
        ? '这是您的公司在黄金级赞助商中的展示效果示例，包含logo、介绍和直接链接。'
        : 'Example of how your company would be featured in the Gold tier with logo, description, and direct link.',
      website: 'https://github.com/sponsors/nextify-limited',
      linkText: locale === 'zh' ? '访问网站' : 'Visit Website',
      logo: { type: 'gradient', from: 'from-blue-500', to: 'to-purple-500', text: locale === 'zh' ? '示例公司' : 'Demo Co' },
      isPlaceholder: false,
    },
    {
      name: locale === 'zh' ? '您的企业Logo' : 'Your Company Logo',
      category: locale === 'zh' ? '可用位置' : 'Available Slot',
      description: texts.gold.description,
      website: 'https://github.com/sponsors/nextify-limited',
      linkText: texts.gold.buttonText,
      logo: { type: 'placeholder' },
      isPlaceholder: true,
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      className='max-w-4xl mx-auto mt-6'
    >
      {/* Gold Tier Header */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        className='text-center mb-6'
      >
        <motion.span
          whileHover={{ scale: 1.05 }}
          className='inline-block bg-gradient-to-r from-yellow-400 to-amber-400 text-gray-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg'
        >
          {texts.gold.title}
        </motion.span>
      </motion.div>

      <div className='relative'>
        {/* Background gradient effect */}
        <div className='absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-amber-400/20 to-orange-400/20 rounded-xl blur-xl' />

        <div className='relative backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border-3 border-yellow-400/60 dark:border-yellow-500/60 rounded-2xl shadow-2xl overflow-hidden min-h-[520px]'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-yellow-200/50 dark:divide-yellow-700/50'>
            {goldSponsors.map((sponsor, index) => (
              <motion.div
                key={sponsor.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.03 }}
                onHoverStart={() => setHoveredIndex(index)}
                onHoverEnd={() => setHoveredIndex(null)}
                className={`p-8 flex flex-col items-center justify-between h-full relative overflow-hidden
                                    ${
                                      sponsor.isPlaceholder
                                        ? 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700'
                                        : 'bg-white dark:bg-gray-800'
                                    }`}
              >
                {/* Hover gradient effect */}
                <motion.div
                  className='absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-amber-400/10 opacity-0'
                  animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Content wrapper */}
                <div className='relative z-10 w-full h-full flex flex-col items-center justify-between'>
                  {/* Logo Section */}
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className='w-full flex justify-center mb-6'
                  >
                    {sponsor.logo.type === 'gradient' ? (
                      <motion.div
                        whileHover={{ rotate: [0, -2, 2, 0] }}
                        transition={{ duration: 0.3 }}
                        className={`h-28 w-56 bg-gradient-to-r ${sponsor.logo.from} ${sponsor.logo.to} rounded-xl flex items-center justify-center shadow-xl`}
                      >
                        <span className='text-white font-bold text-xl'>{sponsor.logo.text}</span>
                      </motion.div>
                    ) : (
                      <div
                        className={`h-28 w-56 ${sponsor.isPlaceholder ? 'bg-gray-200 dark:bg-gray-600 border-2 border-dashed border-gray-400 dark:border-gray-500' : ''} rounded-xl flex items-center justify-center`}
                      >
                        <span className='text-gray-500 dark:text-gray-400 text-base font-medium text-center'>
                          {locale === 'zh' ? '您的Logo' : 'Your Logo'}
                          <br />
                          {locale === 'zh' ? '在这里' : 'Here'}
                          <br />
                          <span className="text-sm opacity-75">
                            {locale === 'zh' ? '(黄金级 1.6倍尺寸)' : '(Gold 1.6x Size)'}
                          </span>
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* Company Info */}
                  <div className='text-center flex-grow'>
                    <motion.h4
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className={`text-xl font-bold mb-3 ${sponsor.isPlaceholder ? 'text-gray-600 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}
                    >
                      {sponsor.name}
                    </motion.h4>

                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.1, type: 'spring' }}
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                        sponsor.isPlaceholder
                          ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      {sponsor.category}
                    </motion.span>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 + index * 0.1 }}
                      className={`text-sm mb-6 leading-relaxed ${
                        sponsor.isPlaceholder
                          ? 'text-gray-500 dark:text-gray-400 italic'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {sponsor.description}
                    </motion.p>
                  </div>

                  {/* Website Link */}
                  <motion.a
                    href={sponsor.website}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-label={`Visit ${sponsor.name} website`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`inline-flex items-center text-sm font-semibold transition-all ${
                      sponsor.isPlaceholder
                        ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                        : 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300'
                    }`}
                  >
                    {sponsor.linkText}
                    <motion.span animate={{ x: hoveredIndex === index ? 5 : 0 }} className='ml-1'>
                      →
                    </motion.span>
                  </motion.a>
                </div>

                {/* Placeholder border effect */}
                {sponsor.isPlaceholder && (
                  <div className='absolute inset-0 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg pointer-events-none' />
                )}
              </motion.div>
            ))}
          </div>

          {/* Benefits Footer with animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className='bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 p-6 border-t border-yellow-200/50 dark:border-yellow-700/50'
          >
            <div className='text-center'>
              <p className='text-sm text-yellow-800 dark:text-yellow-200 font-bold mb-3'>
                {texts.gold.benefits.title}
              </p>
              <div className='flex flex-wrap justify-center gap-4 text-xs text-yellow-700 dark:text-yellow-300'>
                {texts.gold.benefits.items.map((benefit, index) => (
                  <motion.span
                    key={benefit}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.05 }}
                    className='flex items-center'
                  >
                    <span className='mr-1'>✓</span>
                    {benefit}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
