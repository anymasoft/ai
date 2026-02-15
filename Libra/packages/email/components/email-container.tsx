/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * email-container.tsx
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

import { Body, Container, Head, Html, Preview, Tailwind } from '@react-email/components'
import type * as React from 'react'
import { EmailFooter } from './email-footer'
import { EmailHeader } from './email-header'

// Define RGB color variables for better email client compatibility
const colors = {
  brand: '#e9680c', // Your brand color
  'brand-foreground': '#ffffff',
  background: '#ffffff',
  foreground: '#1f2937', // Gray-800
  muted: '#f3f4f6', // Gray-100
  'muted-foreground': '#6b7280', // Gray-500
  border: '#e5e7eb', // Gray-200
  destructive: '#ef4444', // Red-500
  'destructive-foreground': '#ffffff',
}

export interface EmailContainerProps {
  /** Email title for metadata */
  title: string
  /** Preview text displayed in email clients */
  previewText: string
  /** Email content */
  children: React.ReactNode
}

/**
 * Base container for all email templates
 * Provides consistent styling, responsive layout, and includes header/footer
 */
export const EmailContainer: React.FC<EmailContainerProps> = ({
  title,
  previewText,
  children,
}) => {
  return (
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: colors.brand,
              'brand-foreground': colors['brand-foreground'],
              background: colors.background,
              foreground: colors.foreground,
              muted: colors.muted,
              'muted-foreground': colors['muted-foreground'],
              border: colors.border,
              destructive: colors.destructive,
              'destructive-foreground': colors['destructive-foreground'],
            },
            fontFamily: {
              sans: ['Inter', 'Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
            },
            borderRadius: {
              lg: '10px', // Use px instead of rem for better email support
              md: '6px',
              sm: '4px',
            },
            spacing: {
              '18': '4.5rem',
              '22': '5.5rem',
            },
          },
        },
      }}
    >
      <Html lang='en'>
        <Head>
          <title>{title}</title>
          <meta name='viewport' content='width=device-width, initial-scale=1.0' />
          <meta name='format-detection' content='telephone=no' />
          <meta name='x-apple-disable-message-reformatting' />
        </Head>
        <Preview>{previewText}</Preview>
        <Body className='m-0 p-0 font-sans bg-gray-50 text-foreground'>
          <Container className='max-w-2xl mx-auto bg-white my-8 border border-gray-200' style={{ borderRadius: '10px' }}>
            <EmailHeader />
            {children}
            <EmailFooter />
          </Container>
        </Body>
      </Html>
    </Tailwind>
  )
}
