/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * client.ts
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

import type { BetterAuthClientPlugin } from "better-auth";
import type { cloudflare } from "./index";

/**
 * Cloudflare client plugin for Better Auth
 *
 * @returns Client plugin for Cloudflare integration
 */
export const cloudflareClient = () => {
    return {
        id: "cloudflare",
        $InferServerPlugin: {} as ReturnType<typeof cloudflare>,
    } satisfies BetterAuthClientPlugin;
};