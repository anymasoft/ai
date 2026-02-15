/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * language-switcher.tsx
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

'use client';

import { useParams, usePathname } from 'next/navigation';
import { locales } from '@/lib/i18n';
import { Languages } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

export function LanguageSwitcher() {
  const params = useParams();
  const pathname = usePathname();
  const currentLang = params['lang'] as string;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the current locale info
  const currentLocale = locales.find(locale => locale.locale === currentLang);

  // Function to generate the new path for a different language
  const getLocalizedPath = (newLang: string) => {
    // Remove the current language from the pathname
    const pathWithoutLang = pathname.replace(`/${currentLang}`, '');
    // Add the new language
    return `/${newLang}${pathWithoutLang}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">
          {currentLocale?.name || 'Language'}
        </span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-md min-w-[120px] z-50">
          {locales.map((locale) => (
            <Link
              key={locale.locale}
              href={getLocalizedPath(locale.locale)}
              className={`block px-3 py-2 text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md ${
                currentLang === locale.locale ? 'bg-accent' : ''
              }`}
              onClick={() => setIsOpen(false)}
            >
              {locale.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
