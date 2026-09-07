import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = ['/sign-in', '/mfa', '/auth', '/_next', '/api', '/favicon.ico', '/icon'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const hasAccess = request.cookies.has('as_access') || request.cookies.has('as_refresh');
  if (!hasAccess) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    const returnTo = `${pathname}${search}`;
    if (returnTo !== '/') url.searchParams.set('returnTo', returnTo);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
