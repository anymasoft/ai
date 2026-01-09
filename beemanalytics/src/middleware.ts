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

  // Admin-only routes (check first, before other protected routes)
  if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/api/admin')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    // If no token, redirect to sign-in
    if (!token) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // If not admin email, redirect to home
    if (token.email !== ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  // Protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
  ];

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute) {
    // Get the token to check authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });

    // If no token, redirect to sign-in
    if (!token) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Redirect aliases
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/sign-up', request.url));
  }

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
