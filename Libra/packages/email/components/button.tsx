/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * button.tsx
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

import { Link } from '@react-email/components';
import type * as React from 'react';

export interface ButtonProps {
  /** URL the button links to */
  href: string;
  /** Button text */
  children: React.ReactNode;
  /** CSS class variants */
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive';
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Button component for emails with Outlook-compatible styling
 * Uses inline styles and table-based layout for maximum compatibility
 */
export const Button: React.FC<ButtonProps> = ({
  href,
  children,
  variant = 'primary',
  className = '',
}) => {
  // Define variant styles with RGB colors for better email client support
  const variantStyles = {
    primary: {
      backgroundColor: '#e9680c', // Your brand color
      color: '#ffffff',
      borderColor: '#e9680c',
    },
    secondary: {
      backgroundColor: '#f3f4f6', // Gray-100
      color: '#1f2937', // Gray-800
      borderColor: '#e5e7eb', // Gray-200
    },
    outline: {
      backgroundColor: '#ffffff',
      color: '#e9680c', // Your brand color
      borderColor: '#e9680c',
    },
    destructive: {
      backgroundColor: '#ef4444', // Red-500
      color: '#ffffff',
      borderColor: '#ef4444',
    },
  };

  const styles = variantStyles[variant];

  return (
    <table cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: '0 auto' }}>
      <tr>
        <td
          style={{
            backgroundColor: styles.backgroundColor,
            borderRadius: '6px',
            border: `2px solid ${styles.borderColor}`,
          }}
        >
          <Link
            href={href}
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              fontSize: '16px',
              fontWeight: '600',
              color: styles.color,
              textDecoration: 'none',
              textAlign: 'center' as const,
              lineHeight: '1.5',
            }}
            className={className}
          >
            {children}
          </Link>
        </td>
      </tr>
    </table>
  );
};