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

"use client";

import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { Button } from "@libra/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@libra/ui/components/dropdown-menu";
import { getLocale, setLocale, type Locale } from "../paraglide/runtime";
import * as m from "@/paraglide/messages";

const getLanguages = (isHydrated: boolean) => [
  { code: "en" as Locale, name: isHydrated ? m["common.languages.english"]() : "English" },
  { code: "zh" as Locale, name: isHydrated ? m["common.languages.chinese"]() : "中文" },
];

export function LanguageSwitcher() {
  const [isHydrated, setIsHydrated] = useState(false);
  const currentLocale = getLocale();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const handleLanguageChange = (locale: Locale) => {
    setLocale(locale);
  };

  const languages = getLanguages(isHydrated);
  const currentLanguage = languages.find(lang => lang.code === currentLocale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          {isHydrated ? (
            <span>
              {currentLanguage?.name}
            </span>
          ) : (
            <span>
              {m["common.languages.english"]()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`cursor-pointer ${
              currentLocale === language.code ? "bg-accent" : ""
            }`}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
