/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * source.ts
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

import { docs } from "@/.source";
import { loader } from "fumadocs-core/source";
import { icons } from "lucide-react";
import { createElement } from "react";
import { i18n } from "@/lib/i18n";

export const source = loader({
    baseUrl: "/",
    source: docs.toFumadocsSource(),
    i18n,
    icon(icon) {
        if (!icon) {
            // You may set a default icon
            return undefined;
        }

        if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
        
        return undefined;
    },
});