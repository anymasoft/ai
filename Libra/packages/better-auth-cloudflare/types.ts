/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * types.ts
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

import type { KVNamespace } from "@cloudflare/workers-types";
import type { DrizzleAdapterConfig } from "better-auth/adapters/drizzle";
import type { drizzle } from "drizzle-orm/d1";

export interface CloudflarePluginOptions {
    /**
     * Auto-detect IP address
     * @default true
     */
    autoDetectIpAddress?: boolean;

    /**
     * Track geolocation data in the session table
     * @default true
     */
    geolocationTracking?: boolean;
}

export interface WithCloudflareOptions extends CloudflarePluginOptions {
    /**
     * D1 database for primary storage, if that's what you're using.
     */
    d1?: {
        /**
         * D1 database for primary storage, if that's what you're using.
         */
        db: ReturnType<typeof drizzle>;
        /**
         * Drizzle adapter options for primary storage, if you're using D1.
         */
        options?: Omit<DrizzleAdapterConfig, "provider">;
    };

    /**
     * KV namespace for secondary storage, if you want to use that.
     */
    kv?: KVNamespace | any;
}

/**
 * Cloudflare geolocation data
 */
export interface CloudflareGeolocation {
    country: string;
    region: string;
}