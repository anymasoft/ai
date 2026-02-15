/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * layout.tsx
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

import Scroller from "@/components/scroller";
import { RootProvider } from "fumadocs-ui/provider";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { locales } from "@/lib/i18n";
import { zhTranslations } from "@/lib/translations";
import { notFound } from "next/navigation";

const translations = {
  zh: zhTranslations,
};

export default async function LanguageLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  // Validate that the language is supported
  const isValidLang = locales.some(locale => locale.locale === lang);
  if (!isValidLang) {
    notFound();
  }

  return (
    <RootProvider
      i18n={{
        locale: lang,
        locales: [...locales],
        translations: translations[lang as keyof typeof translations],
      }}
      theme={{}}
    >
      {children}
      <Suspense fallback={null}>
        <Scroller />
      </Suspense>
    </RootProvider>
  );
}
