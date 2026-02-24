// Archivo: middleware.ts (En la raíz del proyecto)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Buscamos si el usuario tiene el pase VIP (la cookie)
  const session = request.cookies.get('admin_session');

  // Si intenta entrar a cualquier ruta que empiece con /admin...
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // ...y no tiene la cookie, lo mandamos a /login
    if (!session || session.value !== 'true') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Si todo está bien, lo dejamos pasar
  return NextResponse.next();
}

// Le decimos al guardia que solo vigile la zona admin
export const config = {
  matcher: '/admin/:path*',
};