import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ADMIN_EMAIL } from '@/lib/admin-config'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/landing',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/forgot-password-2',
    '/forgot-password-3',
    '/auth-callback',
  ];

  // Error pages are public
  if (pathname.startsWith('/errors/')) {
    return NextResponse.next();
  }

  // Auth routes are public
  if (pathname.startsWith('/sign-') || pathname.startsWith('/forgot-') || pathname.startsWith('/auth/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Get token early to check authentication for all other routes
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  // If not authenticated, redirect to landing page
  if (!token) {
    return NextResponse.redirect(new URL('/landing', request.url));
  }

  // Admin-only routes (check AFTER authentication, require admin email)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // If not admin email, redirect to card-generator
    if (token.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/card-generator', request.url));
    }

    return NextResponse.next();
  }

  // Redirect aliases
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/sign-up', request.url));
  }

  // All other routes are accessible if authenticated
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    // - public files (png, jpg, svg, etc.)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
}
