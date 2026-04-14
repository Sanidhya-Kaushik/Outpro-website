// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PROTECTED_PATHS = ['/admin'];
const PUBLIC_AUTH_PATHS = ['/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => pathname.startsWith(p));

  const token = req.cookies.get('session')?.value;

  if (isProtected) {
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET ?? '',
      );
      const { payload } = await jwtVerify(token, secret);

      // Inject user role into header for downstream server components
      const res = NextResponse.next();
      res.headers.set('x-user-role', (payload.role as string) ?? '');
      res.headers.set('x-user-id', (payload.sub as string) ?? '');
      return res;
    } catch {
      // Invalid / expired token — redirect to login
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('session');
      return res;
    }
  }

  // Already authenticated → redirect away from login
  if (isPublicAuth && token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
      await jwtVerify(token, secret);
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    } catch {
      // Bad token — let them through to login
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    // Exclude static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
