/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * platinum.tsx
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

import { motion } from "motion/react";
import { getSponsorshipTexts } from '@/lib/sponsorship-i18n';

interface PlatinumProps {
  locale?: string;
}

export const Platinum = ({ locale = 'en' }: PlatinumProps = {}) => {
    const texts = getSponsorshipTexts(locale);

    // Placeholder data for Platinum tier sponsors
    const platinumSponsor = {
        name: locale === 'zh' ? "您的企业名称" : "Your Company Name",
        tagline: texts.platinum.tagline,
        description: texts.platinum.description,
        logoLight: "/placeholder-logo-light.png",
        logoDark: "/placeholder-logo-dark.png",
        website: "https://your-company.com",
        cta: locale === 'zh' ? '了解更多关于我们的平台' : 'Learn more about our platform',
        benefits: texts.platinum.benefits.items
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full max-w-5xl mx-auto relative"
        >
            {/* Static gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 rounded-2xl blur-xl opacity-20" />

            {/* Main card */}
            <div className="relative bg-white/90 dark:bg-gray-900/90 border-4 border-yellow-400 hover:border-yellow-500 rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 min-h-[600px]">
                <div className="relative p-10">
                    {/* Header badge */}
                    <div className="flex items-center justify-center mb-6">
                        <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-6 py-2 rounded-full text-sm font-bold tracking-wider hover:from-yellow-600 hover:to-amber-600 transition-all duration-200">
                            <span className="inline-block mr-2">🏆</span>
                            {texts.platinum.title}
                        </span>
                    </div>

                    {/* Company Logo Section */}
                    <div className="text-center mb-8">
                        <a href={platinumSponsor.website} target="_blank" rel="noopener noreferrer">
                            <div className="w-full py-8 flex justify-center items-center mb-8">
                                <div className="h-40 w-80 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                                    <span className="text-gray-500 dark:text-gray-400 text-lg font-medium text-center">
                                        {locale === 'zh' ? '您的企业Logo' : 'Your Company Logo'}<br/>
                                        <span className="text-sm opacity-75">
                                          {locale === 'zh' ? '(白金级 2.0倍尺寸)' : '(Premium 2.0x Size)'}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </a>

                        <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent mb-3">
                            {platinumSponsor.name}
                        </h3>

                        <p className="text-xl text-yellow-700 dark:text-yellow-300 font-semibold mb-4">
                            {platinumSponsor.tagline}
                        </p>

                        <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-3xl mx-auto leading-relaxed">
                            {platinumSponsor.description}
                        </p>

                        <a
                            href={platinumSponsor.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Visit ${platinumSponsor.name} website`}
                            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            {platinumSponsor.cta}
                            <svg
                                aria-hidden="true"
                                className="ml-2 w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>

                    {/* Benefits Section */}
                    <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 border border-yellow-200/50 dark:border-yellow-700/50">
                        <h4 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 text-center">
                            {texts.platinum.benefits.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {platinumSponsor.benefits.map((benefit, index) => (
                                <div
                                    key={benefit}
                                    className="flex items-center text-sm text-gray-700 dark:text-gray-300"
                                    style={{ animationDelay: `${index * 0.1}s` }}
                                >
                                    <svg
                                        aria-hidden="true"
                                        className="w-5 h-5 text-yellow-500 mr-3 flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {benefit}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Call to Action */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {locale === 'zh' ? '有兴趣成为白金级赞助商？' : 'Interested in becoming a Platinum sponsor?'}
                            <a
                                href="https://github.com/sponsors/nextify-limited"
                                className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 font-semibold ml-1 inline-flex items-center group transition-colors duration-200"
                            >
                                {locale === 'zh' ? '联系我们了解更多' : 'Contact us to learn more'}
                                <span className="ml-1 transition-transform duration-200 group-hover:translate-x-1">
                                    →
                                </span>
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};