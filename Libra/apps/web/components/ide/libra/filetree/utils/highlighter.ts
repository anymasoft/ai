/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * highlighter.ts
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

import { createHighlighter as shikiGetHighlighter } from 'shiki/bundle-web.mjs'

/**
 * Cache function
 */
const cache = <T extends (...args: any[]) => any>(fn: T) => {
  const cache = new Map<string, any>()
  return async (...args: Parameters<T>) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const value = await fn(...args)
    cache.set(key, value)
    return value
  }
}

/**
 * Highlighter instance
 */
const highlighterPromise = shikiGetHighlighter({} as any)

/**
 * Get highlighter instance
 */
export const getHighlighter = cache(async (language: string, themes: string[]) => {
  const highlighter = await highlighterPromise
  const loadedLanguages = highlighter.getLoadedLanguages()
  const loadedThemes = highlighter.getLoadedThemes()

  const promises = []

  // Special handling for unsupported languages
  let langToUse = language

  // Handle common special cases
  if (language === 'toml') {
    // For TOML files, use INI or JSON as the closest alternative
    if (loadedLanguages.includes('ini')) {
      langToUse = 'ini'
    } else if (loadedLanguages.includes('json')) {
      langToUse = 'json'
    } else {
      langToUse = 'plaintext'
    }
  }

  if (!loadedLanguages.includes(langToUse as any)) {
    // Try to load language, fallback to plaintext if failed
    promises.push(
      highlighter.loadLanguage(langToUse as any).catch(() => {
        return highlighter.loadLanguage('plaintext')
      })
    )
  }

  for (const theme of themes) {
    if (!loadedThemes.includes(theme as any)) {
      promises.push(highlighter.loadTheme(theme as any))
    }
  }

  await Promise.all(promises)

  // Even if language loading succeeds, ensure language is actually available, otherwise use plaintext
  if (!highlighter.getLoadedLanguages().includes(langToUse as any)) {
    langToUse = 'plaintext'
  }

  return { highlighter, langToUse }
})

/**
 * Process language type
 */
export function processLanguage(lang: string): {
  processedLang: string
  originalLang: string
  usingAlternativeHighlighting: boolean
} {
  const originalLang = lang
  let processedLang = lang
  
  if (lang === 'diff') {
    processedLang = 'plaintext'
  }
  
  const usingAlternativeHighlighting = lang === 'toml'
  
  return {
    processedLang,
    originalLang,
    usingAlternativeHighlighting
  }
}
