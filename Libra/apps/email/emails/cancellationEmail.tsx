/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * cancellationEmail.tsx
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

import { CancellationEmailTemplate } from '@libra/email/templates/emails/cancellation-email'
import { testData } from '../test-data';
import React from 'react';

/**
 * Example component showcasing the CancellationEmailTemplate email
 * Used for previewing and testing purposes
 * Uses React.createElement to match actual sending behavior
 */
const ExampleCancellationEmail = () =>
  React.createElement(CancellationEmailTemplate, testData.cancellationEmail) as React.ReactElement;

export default ExampleCancellationEmail
