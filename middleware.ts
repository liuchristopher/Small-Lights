import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith('/admin')) return NextResponse.next();

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse('ADMIN_PASSWORD not set', { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = atob(encoded);
        const [, pass] = decoded.split(':');
        if (pass === expected) return NextResponse.next();
      } catch {}
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="small lights admin"' },
  });
}

export const config = { matcher: '/admin/:path*' };
