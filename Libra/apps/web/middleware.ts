/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * middleware.ts
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

import { paraglideMiddleware } from '@/paraglide/server'
import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  return paraglideMiddleware(request, ({ request, locale }) => {
    request.headers.set('x-paraglide-locale', locale)
    request.headers.set('x-paraglide-request-url', request.url)
    return NextResponse.rewrite(request.url, request)
  })
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    '/((?!api|monitoring|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.json$|sentry-example-page).*)',
  ],
}
