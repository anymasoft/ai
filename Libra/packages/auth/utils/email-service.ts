/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * email-service.ts
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

import { getAuthDb, eq, user } from '../db';
import {
  sendWelcomeEmail as sendWelcomeEmailTemplate,
  sendCancellationEmail as sendCancellationEmailTemplate,
  sendOrganizationInvitation as sendOrganizationInvitationTemplate
} from '@libra/email';

/**
 * Send a welcome email to the user identified by their Stripe customer ID.
 */
export async function sendWelcomeEmail(stripeCustomerId: string, planName: string) {
  try {
    // Initialize database connection
    const db = await getAuthDb();
    // Find the user by their Stripe customer ID
    const userRecord = await db.query.user.findFirst({
      where: eq(user.stripeCustomerId, stripeCustomerId),
    });
    if (!userRecord || !userRecord.email) {
      console.error(`[Email] User not found with Stripe Customer ID: ${stripeCustomerId}`);
      throw new Error(`User not found with Stripe Customer ID: ${stripeCustomerId}`);
    }
    const userEmail = userRecord.email;
    
    // Call the email template function
    await sendWelcomeEmailTemplate(userEmail, planName);
  } catch (error) {
    console.error(`[Email] Failed to send welcome email for Stripe Customer ID ${stripeCustomerId}:`, error);
    throw error;
  }
}

/**
 * Send a cancellation email to the user identified by their user ID.
 */
export async function sendCancellationEmail(userId: string) {
  try {
    // Initialize database connection
    const db = await getAuthDb();
    // Find the user by their user ID
    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, userId),
    });
    if (!userRecord || !userRecord.email) {
      console.error(`[Email] User not found with ID: ${userId}`);
      throw new Error(`User not found with ID: ${userId}`);
    }
    const userEmail = userRecord.email;
    
    // Call the email template function
    await sendCancellationEmailTemplate(userEmail);
  } catch (error) {
    console.error(`[Email] Failed to send cancellation email to user ID ${userId}:`, error);
    throw error;
  }
}

/**
 * Send an organization invitation email.
 */
export async function sendOrganizationInvitation(options: {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}) {
  // This function doesn't need database operations, so we can directly call the email template
  await sendOrganizationInvitationTemplate(options);
}
