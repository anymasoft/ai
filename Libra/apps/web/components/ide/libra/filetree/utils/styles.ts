/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * styles.ts
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

/**
 * Generate style string for code block
 */
export function generateCodeBlockStyles(
  showLineNumbers: boolean,
  startLineNumber: number,
  bgColor: string
): string {
  if (showLineNumbers) {
    return `
      <style>
      :root {
          --shiki-bg: ${bgColor};
      }
      .shiki {
          background-color: var(--shiki-bg) !important;
          height: 100% !important;
          border: none !important;
          border-radius: 0 !important;
          padding: 1rem !important;
      }
      .shiki pre {
          background-color: var(--shiki-bg) !important;
          height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
      }
      .shiki code {
          counter-reset: line ${startLineNumber - 1};
          display: block !important;
          background-color: var(--shiki-bg) !important;
          height: 100% !important;
          padding: 0 !important;
      }
      .shiki code .line {
          position: relative;
          padding-left: 2.5rem;
      }
      .shiki code .line::before {
          content: counter(line);
          counter-increment: line;
          position: absolute;
          left: 0;
          top: 0;
          width: 2rem;
          text-align: right;
          color: rgba(115,138,148,.4);
          user-select: none;
      }
      .shiki code .line:last-child:empty::before {
          content: none;
          counter-increment: none;
      }
      .shiki code .line:last-child {
          min-height: 1.2em;
          display: inline-block;
          width: 100%;
      }
      </style>
    `
  }
  return `
    <style>
    .shiki {
        border: none !important;
        border-radius: 0 !important;
        padding: 1rem !important;
    }
    .shiki pre {
        padding: 0 !important;
        margin: 0 !important;
    }
    .shiki code {
        padding: 0 !important;
    }
    </style>
  `
}

/**
 * Get background color for theme
 */
export function getThemeBackgroundColor(isDarkMode: boolean): string {
  return isDarkMode ? '#1a1b26' : '#ffffff'
}

/**
 * Get theme name
 */
export function getThemeName(isDarkMode: boolean): string {
  return isDarkMode ? 'tokyo-night' : 'github-light'
}
