/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * sponsorship-demo.tsx
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
import type { DemoPreviewProps } from '@/types/sponsorship';

export const SponsorshipDemo = ({ tier, locale = 'en', className = '' }: DemoPreviewProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const texts = getSponsorshipTexts(locale);
  
  if (tier === 'silver') {
    return (
      <SilverDemo 
        texts={texts.silver} 
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        className={className}
      />
    );
  }
  
  if (tier === 'bronze') {
    return (
      <BronzeDemo 
        texts={texts.bronze} 
        isHovered={isHovered}
        setIsHovered={setIsHovered}
        className={className}
      />
    );
  }
  
  return null;
};

interface DemoProps {
  texts: {
    demo: {
      title: string;
      description: string;
      logoPlaceholder?: string;
      websiteLink?: string;
      badgeText?: string;
      communitySection?: string;
    };
  };
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
  className?: string;
}

const SilverDemo = ({ texts, isHovered, setIsHovered, className }: DemoProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className={`mt-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 ${className}`}
  >
    <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
      {texts.demo.title}
    </h4>
    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
      {texts.demo.description}
    </p>
    
    {/* Demo Preview */}
    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-600">
      <div className="flex items-center justify-between">
        <motion.div
          whileHover={{ scale: 1.05 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className="flex items-center space-x-3 cursor-pointer"
        >
          <div className="w-12 h-12 bg-gradient-to-r from-slate-400 to-slate-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">LOGO</span>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {texts.demo.logoPlaceholder}
            </div>
            <motion.div
              animate={{ color: isHovered ? '#3b82f6' : '#64748b' }}
              className="text-xs cursor-pointer"
            >
              {texts.demo.websiteLink} →
            </motion.div>
          </div>
        </motion.div>
        
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Silver Sponsor
        </div>
      </div>
    </div>
  </motion.div>
);

const BronzeDemo = ({ texts, className }: DemoProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: 0.2 }}
    className={`mt-6 p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-700 ${className}`}
  >
    <h4 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4">
      {texts.demo.title}
    </h4>
    <p className="text-sm text-amber-700 dark:text-amber-300 mb-6">
      {texts.demo.description}
    </p>
    
    {/* Demo Preview */}
    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-amber-200 dark:border-amber-600">
      <div className="text-center">
        <motion.div
          whileHover={{ scale: 1.02 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          className="inline-block"
        >
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 px-4 py-2 rounded-full border border-amber-200 dark:border-amber-700">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">L</span>
              </div>
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {texts.demo.badgeText}
              </span>
            </div>
          </div>
        </motion.div>
        
        <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          {texts.demo.communitySection}
        </div>
      </div>
    </div>
  </motion.div>
  );
};
