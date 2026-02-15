/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * bronze.tsx
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

"use client";

import { motion } from 'motion/react';
import { useState } from 'react';
import { getSponsorshipTexts } from '@/lib/sponsorship-i18n';


interface BronzeProps {
  locale?: string;
}

export const Bronze = ({ locale = 'en' }: BronzeProps = {}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const texts = getSponsorshipTexts(locale);

  const bronzeSponsors = [
    {
      name: locale === 'zh' ? '社区支持者' : 'Community Supporter',
      category: locale === 'zh' ? '开源倡导者' : 'Open Source Advocate',
      description: locale === 'zh'
        ? '这是您的支持在我们社区赞助商版块中的展示效果示例。'
        : 'Example of how your support would be recognized in our community sponsor section.',
      website: 'https://github.com/sponsors/nextify-limited',
      linkText: locale === 'zh' ? '访问网站' : 'Visit Website',
      logo: { type: 'gradient', from: 'from-amber-500', to: 'to-orange-500', text: locale === 'zh' ? '社区' : 'CS' },
      isPlaceholder: false,
    },
    {
      name: locale === 'zh' ? '您的支持' : 'Your Support Here',
      category: locale === 'zh' ? '可用认可位置' : 'Available Recognition',
      description: texts.bronze.description,
      website: 'https://github.com/sponsors/nextify-limited',
      linkText: texts.bronze.buttonText,
      logo: { type: 'placeholder' },
      isPlaceholder: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="max-w-2xl mx-auto"
    >
      {/* Bronze Tier Header */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="text-center mb-6"
      >
        <motion.span
          whileHover={{ scale: 1.05 }}
          className="inline-block bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg"
        >
          {texts.bronze.title}
        </motion.span>
      </motion.div>

      <div className="relative">
        {/* Background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-300/20 via-orange-300/20 to-red-300/20 rounded-xl blur-xl" />

        <div className="relative backdrop-blur-sm bg-white/90 dark:bg-gray-900/90 border-2 border-amber-400/50 dark:border-amber-500/50 rounded-xl shadow-xl overflow-hidden min-h-[400px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-amber-200/50 dark:divide-amber-700/50">
            {bronzeSponsors.map((sponsor, index) => (
              <motion.div
                key={sponsor.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                onHoverStart={() => setHoveredIndex(index)}
                onHoverEnd={() => setHoveredIndex(null)}
                className={`p-4 flex flex-col items-center justify-between h-full relative overflow-hidden
                                    ${
                                      sponsor.isPlaceholder
                                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
                                        : 'bg-white dark:bg-gray-800'
                                    }`}
              >
                {/* Hover gradient effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0"
                  animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                {/* Content wrapper */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-between">
                  {/* Community Badge Section */}
                  <motion.div
                    whileHover={{ y: -5 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    className="w-full flex justify-center mb-6"
                  >
                    {sponsor.logo.type === 'gradient' ? (
                      <motion.div
                        whileHover={{ rotate: [0, -2, 2, 0] }}
                        transition={{ duration: 0.3 }}
                        className="relative"
                      >
                        <div className={`h-16 w-32 bg-gradient-to-r ${sponsor.logo.from} ${sponsor.logo.to} rounded-lg flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold text-lg">{sponsor.logo.text}</span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {locale === 'zh' ? '社区赞助商' : 'Community Sponsor'}
                        </div>
                      </motion.div>
                    ) : (
                      <div className="relative">
                        <div
                          className={`h-16 w-32 ${sponsor.isPlaceholder ? 'bg-gray-200 dark:bg-gray-600 border-2 border-dashed border-gray-400 dark:border-gray-500' : ''} rounded-lg flex items-center justify-center`}
                        >
                          <span className="text-gray-500 dark:text-gray-400 text-xs font-medium text-center">
                            {locale === 'zh' ? '您的Logo' : 'Your Logo'}
                            <br />
                            <span className="text-xs opacity-75">
                              {locale === 'zh' ? '(青铜级 1.0倍基础尺寸)' : '(Bronze 1.0x Base)'}
                            </span>
                          </span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {locale === 'zh' ? '社区赞助商' : 'Community Sponsor'}
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Company Info */}
                  <div className="text-center flex-grow">
                    <motion.h4
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className={`text-lg font-bold mb-2 ${sponsor.isPlaceholder ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'}`}
                    >
                      {sponsor.name}
                    </motion.h4>

                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 + index * 0.1, type: 'spring' }}
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                        sponsor.isPlaceholder
                          ? 'bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                      }`}
                    >
                      {sponsor.category}
                    </motion.span>

                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className={`text-sm mb-6 leading-relaxed ${
                        sponsor.isPlaceholder
                          ? 'text-amber-600 dark:text-amber-400 italic'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {sponsor.description}
                    </motion.p>
                  </div>

                  {/* Website Link */}
                  <motion.a
                    href={sponsor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${sponsor.name} website`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`inline-flex items-center text-sm font-semibold transition-all ${
                      sponsor.isPlaceholder
                        ? 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                        : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                    }`}
                  >
                    {sponsor.linkText}
                    <motion.span animate={{ x: hoveredIndex === index ? 5 : 0 }} className="ml-1">
                      →
                    </motion.span>
                  </motion.a>
                </div>

                {/* Placeholder border effect */}
                {sponsor.isPlaceholder && (
                  <div className="absolute inset-0 border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-lg pointer-events-none" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Benefits Footer with animation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 p-6 border-t border-amber-200/50 dark:border-amber-700/50"
          >
            <div className="text-center">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-bold mb-3">
                {texts.bronze.benefits.title}
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-xs text-amber-700 dark:text-amber-300">
                {texts.bronze.benefits.items.map((benefit, index) => (
                  <motion.span
                    key={benefit}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + index * 0.05 }}
                    className="flex items-center"
                  >
                    <span className="mr-1">✓</span>
                    {benefit}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};