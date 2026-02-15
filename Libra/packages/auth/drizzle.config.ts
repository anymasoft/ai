/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * drizzle.config.ts
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

import { defineConfig } from 'drizzle-kit';
import fs from "node:fs";
import path from "node:path";
import {env} from "./env.mjs";

function getLocalD1DB() {
    try {
        const basePath = path.resolve("../../apps/web/.wrangler/state/v3/d1");
        const dbFile = fs
            .readdirSync(basePath, { encoding: "utf-8", recursive: true })
            .find((f) => f.endsWith(".sqlite"));

        if (!dbFile) {
            throw new Error(`.sqlite file not found in ${basePath}`);
        }

        const url = path.resolve(basePath, dbFile);
        return url;
    } catch (err) {
        return null;
    }
}

export default defineConfig({
    out: './db/migrations',
    schema: './db/schema',
    dialect: 'sqlite',
    ...(process.env.NODE_ENV === "production"
        ? {
            driver: "d1-http",
            dbCredentials: {
                accountId: env.CLOUDFLARE_ACCOUNT_ID,
                databaseId: env.DATABASE_ID,
                token: env.CLOUDFLARE_API_TOKEN,
            },
        }
        : {
            dbCredentials: {
                url: getLocalD1DB(),
            },
        }),
});