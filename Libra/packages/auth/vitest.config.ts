/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * vitest.config.ts
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

import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./utils/subscription-limits/__tests__/setup.ts'],
    env: {
      POSTGRES_URL: 'postgresql://test:test@localhost:5432/test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NODE_ENV: 'test',
      ENVIRONMENT: 'test',
    },
    pool: 'forks', // Use forks to ensure proper isolation
    include: [
      'utils/**/__tests__/**/*.test.ts',
      'utils/**/__tests__/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@libra/auth': path.resolve(__dirname, './'),
      '@libra/db': path.resolve(__dirname, '../db'),
      '@libra/common': path.resolve(__dirname, '../common'),
    },
  },
})
