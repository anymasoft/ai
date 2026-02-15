/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * stars.ts
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
 * Response interface for GitHub Stars GraphQL API
 */
interface StarResponse {
    data: {
        [key: string]: {
            stargazerCount: number;
        };
    };
    errors?: any;
}
const LIBRA_GITHUB_TOKEN = process.env['LIBRA_GITHUB_TOKEN'];
const API_URL = "https://api.github.com/graphql";

export async function fetchStars(resources: { slug: string; stars?: number }[]) {
    try {
        if (resources.length === 0) return;
        const uniqueSlugs = Array.from(
            new Set(
                resources
                    .filter((r) => r.stars === undefined)
                    .map((r, id) => ({
                        id,
                        slug: r.slug,
                    }))
            )
        );

        if (uniqueSlugs.length === 0) return;

        const queryParts = uniqueSlugs.map(({ id, slug }) => {
            const [owner, name] = slug.split("/");
            return `
      repo${id}: repository(owner: "${owner}", name: "${name}") {
        stargazerCount
      }
    `;
        });

        const query = `{ ${queryParts.join("\n")} }`;
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LIBRA_GITHUB_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });

        const json = await res.json() as StarResponse;

        if (json.errors) {
            console.error("GraphQL errors:", json.errors);
            throw new Error("Failed to fetch GitHub stars");
        }

        // Create a map of slug → star count
        const starsMap = new Map<string, number>();
        for (const slug of uniqueSlugs) {
            const count = json.data[`repo${slug.id}`]?.stargazerCount;
            if (typeof count === "number") {
                starsMap.set(slug.slug, count);
            }
        }

        // Mutate in-place
        for (const r of resources) {
            const stars = starsMap.get(r.slug);
            if (stars !== undefined) {
                r.stars = stars;
            }
        }

        // sort by star count (descending) in place
        resources.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    } catch (_) {
        throw new Error("Failed to fetch GitHub stars");
    }
}