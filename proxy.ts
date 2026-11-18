import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionForHost } from "@/lib/session";

// Protege todo /admin: hace falta una sesión abierta en ESTE restaurante.
// Con contraseña temporal, la única pantalla permitida es "Mi cuenta" hasta poner una propia.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await sessionForHost(request.cookies.get(SESSION_COOKIE)?.value, request.headers.get("host"));
  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(login);
    if (request.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session.account.mustChangePassword && !pathname.startsWith("/admin/ajustes/mi-cuenta")) {
    return NextResponse.redirect(new URL("/admin/ajustes/mi-cuenta", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
