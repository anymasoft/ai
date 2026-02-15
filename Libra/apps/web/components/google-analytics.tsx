/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * google-analytics.tsx
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

import Script from 'next/script'
import { useId } from 'react'

const GA_ID = process.env['NEXT_PUBLIC_GA_ID']

/**
 * Google Analytics 4 (GA4) tracking component
 * Loads and configures Google Analytics for production environments
 * Only renders when NODE_ENV is 'production' and GA_ID is configured
 */
function GoogleAnalytics(): React.ReactElement | null {
  const scriptId = useId()

  // Only load in production with valid GA_ID
  if (process.env.NODE_ENV !== 'production' || !GA_ID) {
    return null
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id={scriptId} strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  )
}

export { GoogleAnalytics }
