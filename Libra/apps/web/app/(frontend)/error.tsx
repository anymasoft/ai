/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * error.tsx
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

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import ErrorBoundary from "../../../web/components/ui/error"


// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error page convention
export default function Error({
                                  error,
                              }: {
    error: Error & { digest?: string }
}) {
    const posthog = usePostHog()

    useEffect(() => {
        if (posthog) {
            posthog.captureException(error, {
                source: 'nextjs-error-page',
                digest: error.digest,
            })
        }
    }, [error, posthog])

    return (
        <ErrorBoundary
            description="Sorry, something went wrong with the application."
            className="min-h-svh"
            error={error}
        />
    )
}
