/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * autoload.ts
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

import type { BundledLanguage, BundledTheme } from 'shiki'
import type { IDisposable, ShikiCode } from './index.js'

/**
 * Automatically load languages and themes when they are not already loaded.
 *
 * It's recommended to handle shiki highlighter by yourself if you know all the languages and themes you will use.
 * This plugin will convert the `updateOptions` method to async method.
 */
export function autoload(editor: ShikiCode): IDisposable {
  const updateOptions = editor.updateOptions

  editor.updateOptions = async (newOptions) => {
    const themes = editor.highlighter.getLoadedThemes()
    const langs = editor.highlighter.getLoadedLanguages()

    const task_list = []

    if (
      newOptions.theme !== void 0 &&
      newOptions.theme !== 'none' &&
      !themes.includes(newOptions.theme)
    ) {
      task_list.push(editor.highlighter.loadTheme(newOptions.theme as unknown as BundledTheme))
    }

    if (
      newOptions.language !== void 0 &&
      newOptions.language !== 'text' &&
      !langs.includes(newOptions.language)
    ) {
      task_list.push(editor.highlighter.loadLanguage(newOptions.language as BundledLanguage))
    }

    await Promise.all(task_list)

    updateOptions(newOptions)
  }

  return () => {
    editor.updateOptions = updateOptions
  }
}
