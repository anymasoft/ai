/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.ts
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

import {getCloudflareContext} from "@opennextjs/cloudflare";
import {drizzle} from "drizzle-orm/d1";
import {schema} from "./schema";

export async function getCache() {
    // Retrieves Cloudflare-specific context, including environment variables and bindings
    const {env} = await getCloudflareContext({async: true});
    return (env as any).CACHE;
}

export async function getAuthDb() {
    // Retrieves Cloudflare-specific context, including environment variables and bindings
    const {env} = await getCloudflareContext({async: true});
    // Determine environment: disable logger in production, enable in non-production
    const isProduction = (process.env['ENVIRONMENT'] as string) === 'production';

    // Initialize Drizzle with your D1 binding (e.g., "DB" or "DATABASE" from wrangler.toml)
    return drizzle((env as any).DATABASE, {
        // Ensure "DATABASE" matches your D1 binding name in wrangler.jsonc
        schema,
        logger: !isProduction,
    });
}

// Re-export the drizzle-orm types and utilities from here for convenience
export * from "drizzle-orm";

// Re-export the feature schemas for use in other files
export * from "./schema/auth-schema";
export * from "./schema/plan-schema";
export * from "./schema/price-schema";
export * from "./schema/github-schema";
export * from "./schema";