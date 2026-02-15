/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * welcomeEmailFree.tsx
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

import { WelcomeEmailTemplate } from '@libra/email/templates/emails/welcomeEmail';
import { testData } from '../test-data';
import React from 'react';

/**
 * Example component showcasing the WelcomeEmailTemplate for FREE plan
 * Used for previewing and testing purposes
 * Uses React.createElement to match actual sending behavior
 */
const ExampleWelcomeEmailFree = () =>
  React.createElement(WelcomeEmailTemplate, testData.welcomeEmailFree) as React.ReactElement;

export default ExampleWelcomeEmailFree;
