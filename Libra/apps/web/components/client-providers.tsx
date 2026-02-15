/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * client-providers.tsx
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

'use client'

import { ToastProvider } from '@libra/ui/components/toast'
import { TooltipProvider } from '@libra/ui/components/tooltip'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { GifPreloadProvider, PreloadGifs } from '@/components/ui/text-gif'
import { UpgradeModalProvider } from '@/components/common/upgrade-modal'

interface ClientProvidersProps {
  children: React.ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <PostHogProvider>
      <TooltipProvider>
        <ToastProvider>
          <UpgradeModalProvider>
            <GifPreloadProvider>
              <PreloadGifs />
              {children}
            </GifPreloadProvider>
          </UpgradeModalProvider>
        </ToastProvider>
      </TooltipProvider>
    </PostHogProvider>
  )
}

function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      return
    }

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest',
      ui_host: 'https://us.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      disable_session_recording: false,
      advanced_disable_toolbar_metrics: true,
      opt_in_site_apps: true,
      autocapture: false,
      capture_exceptions: true,
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug()
      },
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
