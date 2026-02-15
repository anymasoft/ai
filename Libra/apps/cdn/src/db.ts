/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * db.ts
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

import {drizzle} from "drizzle-orm/d1";
import {schema} from "@libra/auth/db";
import type { AppContext } from './types';


export async function getAuthDb(c: AppContext) {
    // Determine if production environment, disable logging in production, enable in other environments
    const isProduction = (process.env.ENVIRONMENT as string) === 'production';

    // Initialize Drizzle with your D1 binding (e.g., "DB" or "DATABASE" from wrangler.toml)
    return drizzle(c.env.DATABASE, {
        // Ensure "DATABASE" matches your D1 binding name in wrangler.jsonc
        schema,
        logger: !isProduction,
    });
}
