/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * auth-schema.ts
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

import {sqliteTable, text, integer} from "drizzle-orm/sqlite-core";
import {createId} from "@paralleldrive/cuid2";

export const user = sqliteTable("user", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', {mode: 'boolean'}).$defaultFn(() => false).notNull(),
    image: text('image'),
    createdAt: integer('created_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date()).notNull(),
    role: text('role').default('user').notNull(),
    banned: integer('banned', {mode: 'boolean'}).default(false),
    banReason: text('ban_reason'),
    banExpires: integer('ban_expires', {mode: 'timestamp'}),
    stripeCustomerId: text('stripe_customer_id'),
    normalizedEmail: text('normalized_email').unique()
});

export const session = sqliteTable("session", {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', {mode: 'timestamp'}).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull(),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id').notNull().references(() => user.id, {onDelete: 'cascade'}),
    country: text('country'),
    region: text('region'),
    impersonatedBy: text('impersonated_by'),
    activeOrganizationId: text('active_organization_id')
});

export const account = sqliteTable("account", {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => user.id, {onDelete: 'cascade'}),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {mode: 'timestamp'}),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {mode: 'timestamp'}),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull(),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).notNull()
});

export const verification = sqliteTable("verification", {
    id: text('id').$defaultFn(() => createId()).primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', {mode: 'timestamp'}).notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date()),
    updatedAt: integer('updated_at', {mode: 'timestamp'}).$defaultFn(() => /* @__PURE__ */ new Date())
});

export const organization = sqliteTable("organization", {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique(),
    logo: text('logo'),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull(),
    metadata: text('metadata')
});

export const member = sqliteTable("member", {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organization.id, {onDelete: 'cascade'}),
    userId: text('user_id').notNull().references(() => user.id, {onDelete: 'cascade'}),
    role: text('role').default("member").notNull(),
    createdAt: integer('created_at', {mode: 'timestamp'}).notNull()
});

export const invitation = sqliteTable("invitation", {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organization.id, {onDelete: 'cascade'}),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default("pending").notNull(),
    expiresAt: integer('expires_at', {mode: 'timestamp'}).notNull(),
    inviterId: text('inviter_id').notNull().references(() => user.id, {onDelete: 'cascade'})
});

export const subscription = sqliteTable("subscription", {
    id: text('id').primaryKey(),
    plan: text('plan').notNull(),
    referenceId: text('reference_id').notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    status: text('status').default("incomplete"),
    periodStart: integer('period_start', {mode: 'timestamp'}),
    periodEnd: integer('period_end', {mode: 'timestamp'}),
    cancelAtPeriodEnd: integer('cancel_at_period_end', {mode: 'boolean'}),
    seats: integer('seats')
});
