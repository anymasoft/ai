/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * content-section.tsx
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

import { Section } from '@react-email/components';
import type * as React from 'react';

export interface ContentSectionProps {
  /** Section content */
  children: React.ReactNode;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Content section for email templates with consistent styling
 * Uses inline styles for better email client compatibility
 */
export const ContentSection: React.FC<ContentSectionProps> = ({
  children,
  className = '',
}) => {
  return (
    <Section
      className={className}
      style={{
        padding: '28px',
      }}
    >
      {children}
    </Section>
  );
};