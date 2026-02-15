/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * info-box.tsx
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

import { Heading, Section, Text } from '@react-email/components';
import type * as React from 'react';

export interface InfoBoxProps {
  /** Box title */
  title?: string;
  /** Box content */
  children: React.ReactNode;
  /** Box type/style variant */
  variant?: 'info' | 'success' | 'warning' | 'error';
}

/**
 * Information box component for highlighting important information in emails
 * Uses inline styles for maximum email client compatibility
 */
export const InfoBox: React.FC<InfoBoxProps> = ({
  title,
  children,
  variant = 'info',
}) => {
  // Define variant styles with RGB colors and inline styles
  const variantStyles = {
    info: {
      backgroundColor: '#fef3e2', // Orange-50 to match your brand color
      borderLeft: '4px solid #e9680c', // Your brand color
      color: '#1f2937', // Gray-800
    },
    success: {
      backgroundColor: '#f0fdf4', // Green-50
      borderLeft: '4px solid #22c55e', // Green-500
      color: '#1f2937', // Gray-800
    },
    warning: {
      backgroundColor: '#fefce8', // Yellow-50
      borderLeft: '4px solid #eab308', // Yellow-500
      color: '#1f2937', // Gray-800
    },
    error: {
      backgroundColor: '#fef2f2', // Red-50
      borderLeft: '4px solid #ef4444', // Red-500
      color: '#1f2937', // Gray-800
    },
  };

  const styles = variantStyles[variant];

  return (
    <Section
      style={{
        ...styles,
        padding: '16px',
        marginBottom: '24px',
        borderRadius: '6px',
      }}
    >
      {title && (
        <Heading
          as="h3"
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: '500',
            color: '#1f2937', // Gray-800
            lineHeight: '1.5',
          }}
        >
          {title}
        </Heading>
      )}
      {typeof children === 'string' ? (
        <Text
          style={{
            margin: '0',
            fontSize: '14px',
            color: '#6b7280', // Gray-500
            lineHeight: '1.6',
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Section>
  );
};