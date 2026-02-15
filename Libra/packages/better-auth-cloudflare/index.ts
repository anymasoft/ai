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

import type { KVNamespace } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { BetterAuthOptions, BetterAuthPlugin, SecondaryStorage, Session } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthEndpoint } from "better-auth/api";
import { schema } from "./schema";
import type { CloudflareGeolocation, CloudflarePluginOptions, WithCloudflareOptions } from "./types";
export * from "./client";
export * from "./schema";
export * from "./types";

/**
 * Cloudflare integration for Better Auth
 *
 * @param options - Plugin configuration options
 * @returns Better Auth plugin for Cloudflare
 */
export const cloudflare = (options?: CloudflarePluginOptions) => {
    const opts = options ?? {};

    // Default geolocationTracking to true if not specified
    const geolocationTrackingEnabled = opts.geolocationTracking === undefined || opts.geolocationTracking === true;

    return {
        id: "cloudflare",
        schema: schema(opts), // schema function will also default geolocationTracking to true
        endpoints: {
            getGeolocation: createAuthEndpoint(
                "/cloudflare/geolocation",
                {
                    method: "GET",
                },
                async ctx => {
                    const session = ctx.context?.session;
                    if (!session) {
                        return ctx.json({ error: "Unauthorized" }, { status: 401 });
                    }

                    // Original code threw an error if ctx.request was not available.
                    // Retaining similar logic but returning a 500 status code.
                    if (!ctx.request) {
                        return ctx.json({ error: "Request is not available" }, { status: 500 });
                    }

                    const cf = getCloudflareContext().cf;
                    if (!cf) {
                        return ctx.json({ error: "Cloudflare context is not available" }, { status: 404 });
                    }

                    // Extract and validate Cloudflare geolocation data
                    const context: CloudflareGeolocation = {
                        country: cf.country as string,
                        region: cf.region as string,
                    };

                    return ctx.json(context);
                }
            ),
        },

        init(_init_ctx) {
            return {
                options: {
                    databaseHooks: {
                        session: {
                            create: {
                                before: async (s: any) => {
                                    if (!geolocationTrackingEnabled) {
                                        return s;
                                    }
                                    const cf = (await getCloudflareContext({ async: true })).cf;
                                    s.country = cf?.country;
                                    s.region = cf?.region;
                                    return s;
                                },
                            },
                        },
                    },
                },
            };
        },
    } satisfies BetterAuthPlugin;
};

/**
 * Creates secondary storage using Cloudflare KV
 *
 * @param kv - Cloudflare KV namespace
 * @returns SecondaryStorage implementation
 */
export const createKVStorage = (kv: KVNamespace<string>): SecondaryStorage => {
    return {
        get: async (key: string) => {
            return kv.get(key);
        },
        set: async (key: string, value: string, ttl?: number) => {
            return kv.put(key, value, ttl ? { expirationTtl: ttl } : undefined);
        },
        delete: async (key: string) => {
            return kv.delete(key);
        },
    };
};

/**
 * Get geolocation data from Cloudflare context
 *
 * @returns Cloudflare geolocation data
 * @throws Error if Cloudflare context is not available
 */
export const getGeolocation = (): CloudflareGeolocation | undefined => {
    const cf = getCloudflareContext().cf;
    if (!cf) {
        throw new Error("Cloudflare context is not available");
    }
    return {
        country: cf.country || "Unknown",
        region: cf.region || "Unknown",
    };
};

/**
 * Enhances BetterAuthOptions with Cloudflare-specific configurations.
 *
 * This function integrates Cloudflare services like D1 for database and KV for secondary storage,
 * and sets up IP address detection and geolocation tracking based on the provided Cloudflare options.
 *
 * @param cloudFlareOptions - Options for configuring Cloudflare integration.
 * @param options - The base BetterAuthOptions to be enhanced.
 * @returns BetterAuthOptions configured for use with Cloudflare.
 */
export const withCloudflare = (
    cloudFlareOptions: WithCloudflareOptions,
    options: BetterAuthOptions
): BetterAuthOptions => {
    const autoDetectIpEnabled =
        cloudFlareOptions.autoDetectIpAddress === undefined || cloudFlareOptions.autoDetectIpAddress === true;
    const geolocationTrackingForSession =
        cloudFlareOptions.geolocationTracking === undefined || cloudFlareOptions.geolocationTracking === true;

    const updatedAdvanced = { ...options.advanced };
    if (autoDetectIpEnabled) {
        updatedAdvanced.ipAddress = {
            ...(updatedAdvanced.ipAddress ?? {}),
            ipAddressHeaders: ["cf-connecting-ip", "x-real-ip", ...(updatedAdvanced.ipAddress?.ipAddressHeaders ?? [])],
        };
    } else if (updatedAdvanced.ipAddress?.ipAddressHeaders) {
        // If autoDetectIp is disabled, ensure our headers are not in the list if they were added by default elsewhere
        // This part is tricky as we don't know if they were from the user or our default.
        // A safer approach might be to just rely on the user to not list them if they disable this flag.
        // For now, let's assume if autoDetectIpEnabled is false, the user manages headers explicitly.
    }

    const updatedSession = { ...options.session };
    if (geolocationTrackingForSession) {
        updatedSession.storeSessionInDatabase = true;
    } else if (options.session?.storeSessionInDatabase === undefined) {
        // If geolocationTracking is false, and the user hasn't set a preference for storeSessionInDatabase,
        // it will remain undefined (i.e., Better Auth core default behavior).
        // If user explicitly set it to true/false, that will be respected.
    }

    return {
        ...options,
        ...(cloudFlareOptions.d1 && {
            database: drizzleAdapter(cloudFlareOptions.d1.db, {
                provider: "sqlite",
                ...cloudFlareOptions.d1.options,
            })
        }),
        ...(cloudFlareOptions.kv && {
            secondaryStorage: createKVStorage(cloudFlareOptions.kv)
        }),
        plugins: [cloudflare(cloudFlareOptions), ...(options.plugins ?? [])],
        advanced: updatedAdvanced,
        session: updatedSession,
    };
};

export type SessionWithGeolocation = Session & {
    country?: string;
    region?: string;
};