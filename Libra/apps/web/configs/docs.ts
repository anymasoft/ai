/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * docs.ts
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

import type { IconType } from 'react-icons/lib'
import {
  SiDocker,
  SiGnubash,
  SiGo,
  SiJavascript,
  SiJson,
  SiMarkdown,
  SiPython,
  SiRuby,
  SiTypescript,
  SiYaml,
} from 'react-icons/si'

/**
 * Maps programming language/file type identifiers to their corresponding React icons
 * from the react-icons/si package. Used to display language-specific icons in the Documentation.
 *
 * @example
 * const Icon = IconsMap['typescript'] // Returns SiTypescript icon component
 */
export const IconsMap: Record<string, IconType> = {
  dockerfile: SiDocker,
  javascript: SiJavascript,
  typescript: SiTypescript,
  python: SiPython,
  go: SiGo,
  json: SiJson,
  yaml: SiYaml,
  md: SiMarkdown,
  terminal: SiGnubash,
}
