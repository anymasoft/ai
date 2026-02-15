/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * otp-code.tsx
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

import { Section, Text } from '@react-email/components';
import * as React from 'react';

export interface OtpCodeProps {
  /** The OTP code to display */
  code: string;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Component for displaying OTP codes in emails with consistent styling
 */
export const OtpCode: React.FC<OtpCodeProps> = ({
  code,
  className = '',
}) => {
  return (
    <Section
      className={className}
      style={{
        backgroundColor: '#fef3e2', // Orange-50 to match brand color
        borderLeft: '4px solid #e9680c', // Brand color
        padding: '16px',
        marginBottom: '24px',
        textAlign: 'center',
        borderRadius: '6px',
      }}
    >
      <Text
        style={{
          fontSize: '28px',
          fontWeight: 'bold',
          letterSpacing: '5px',
          margin: '0',
          color: '#1f2937', // Gray-800
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        }}
      >
        {code}
      </Text>
    </Section>
  );
};