import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionForHost } from "@/lib/session";
import { PLATFORM_COOKIE, platformSessionFor } from "@/lib/platform-session";
import { isLandingHost, isPlatformHost } from "@/lib/tenant-host";
import { restaurantForHost } from "@/lib/tenant";
import { restaurantUrl } from "@/lib/platform";

// Pantallas de un restaurante: en el dominio principal se mandan al subdominio del restaurante por defecto.
const RESTAURANT_PATHS = ["/login", "/admin", "/cocina", "/llevar", "/mesa", "/media"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/plataforma")) return platform(request);
  const host = request.headers.get("host");
  if (isLandingHost(host)) {
    // El dominio principal es el sitio de Ristemo: "/" muestra la página de venta.
    if (pathname === "/") return NextResponse.rewrite(new URL("/sistema", request.url));
    if (pathname === "/sistema") return NextResponse.redirect(new URL("/", request.url), 308);
    if (RESTAURANT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      const target = await defaultRestaurantUrl(host);
      if (target) return NextResponse.redirect(new URL(pathname + request.nextUrl.search, target));
    }
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return restaurantAdmin(request);
  return NextResponse.next();
}

/** Dirección propia (subdominio) del restaurante que antes abría en el dominio principal. */
async function defaultRestaurantUrl(host: string | null) {
  const r = await restaurantForHost(host).catch(() => null);
  return r ? restaurantUrl(r.slug) : null;
}
// /admin: hace falta una sesión abierta en ESTE restaurante.
// Con contraseña temporal, la única pantalla permitida es "Mi cuenta" hasta poner una propia.
async function restaurantAdmin(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await sessionForHost(request.cookies.get(SESSION_COOKIE)?.value, request.headers.get("host"));
  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(login);
    if (request.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (session.account?.mustChangePassword && !pathname.startsWith("/admin/ajustes/mi-cuenta")) {
    return NextResponse.redirect(new URL("/admin/ajustes/mi-cuenta", request.url));
  }
  return NextResponse.next();
}

// /plataforma: solo en el dominio principal (nunca en el subdominio de un restaurante)
// y con una sesión del equipo de la plataforma.
async function platform(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isPlatformHost(request.headers.get("host"))) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  if (pathname === "/plataforma/login") return NextResponse.next();
  const session = await platformSessionFor(request.cookies.get(PLATFORM_COOKIE)?.value, request.headers.get("host"));
  if (!session) return NextResponse.redirect(new URL("/plataforma/login", request.url));
  if (session.user.mustChangePassword && pathname !== "/plataforma/cuenta") {
    return NextResponse.redirect(new URL("/plataforma/cuenta", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/sistema",
    "/login",
    "/admin/:path*",
    "/cocina/:path*",
    "/llevar/:path*",
    "/mesa/:path*",
    "/media/:path*",
    "/plataforma",
    "/plataforma/:path*",
  ],
};
