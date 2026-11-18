// Sesiones del panel: la cookie guarda un token al azar y la base de datos solo su hash.
// Se pueden cerrar desde "Mi cuenta" y vencen tras días sin uso.
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { Account, Restaurant, Session } from "@prisma/client";
import prisma from "@/lib/prisma";
import { rootPrisma } from "@/lib/prisma-base";
import { restaurantForHost } from "@/lib/tenant";

export const SESSION_COOKIE = "ristemo_session";
const IDLE_DAYS = 7; // Sin entrar al panel en este tiempo, hay que volver a iniciar sesión
const COOKIE_DAYS = 30;
const DAY = 86_400_000;
const TOUCH_EVERY = 60 * 60_000; // Renueva el vencimiento como mucho una vez por hora

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type AdminRole = "OWNER" | "ADMIN";
export type SessionAccount = Pick<Account, "id" | "name" | "email" | "role" | "mustChangePassword"> & { sessionId: string };

/** Cookie "Secure" solo si la petición llegó por HTTPS (detrás del proxy de Coolify se ve en x-forwarded-proto). */
async function isHttps() {
  const proto = (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

/** Abre una sesión para la cuenta y deja la cookie en el navegador. */
export async function startSession(account: Pick<Account, "id">) {
  const token = randomBytes(32).toString("base64url");
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 300);
  await prisma.session.create({
    data: { id: hashToken(token), accountId: account.id, userAgent: ua, expiresAt: new Date(Date.now() + IDLE_DAYS * DAY) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    maxAge: COOKIE_DAYS * 24 * 60 * 60,
  });
}

type Valid = Session & { account: Account; restaurant: Restaurant };

/** ¿La sesión sigue abierta, es de este restaurante y la cuenta está activa? */
function isUsable(s: Valid | null, restaurantId: number | undefined): s is Valid {
  return (
    !!s &&
    s.restaurantId === restaurantId &&
    s.expiresAt > new Date() &&
    s.account.active &&
    s.restaurant.status === "ACTIVE"
  );
}

/**
 * Valida el token de la cookie para una dirección. La usa el proxy (antes de llegar a cualquier
 * pantalla del panel), sin `headers()` ni el filtro automático.
 */
export async function sessionForHost(token: string | undefined, host: string | null) {
  if (!token) return null;
  const [s, restaurant] = await Promise.all([
    rootPrisma.session.findUnique({ where: { id: hashToken(token) }, include: { account: true, restaurant: true } }),
    restaurantForHost(host),
  ]);
  return isUsable(s, restaurant?.id) ? s : null;
}

/** Cuenta con sesión en esta petición (o null). Renueva el vencimiento con el uso. */
export const getAdmin = cache(async (): Promise<SessionAccount | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { account: true, restaurant: true } });
  if (!isUsable(s, s?.restaurantId)) return null; // el filtro automático ya garantiza que es de este restaurante
  if (Date.now() - s.lastSeenAt.getTime() > TOUCH_EVERY) {
    await prisma.session.update({
      where: { id: s.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + IDLE_DAYS * DAY) },
    });
  }
  const { id, name, email, role, mustChangePassword } = s.account;
  return { id, name, email, role, mustChangePassword, sessionId: s.id };
});

export class AuthError extends Error {}

/**
 * Para acciones del panel: sin sesión válida (o sin el rol pedido) no se hace nada.
 * Con contraseña temporal solo se permite lo de "Mi cuenta" (`allowTemporary`).
 */
export async function requireAdmin(role?: AdminRole, opts?: { allowTemporary?: boolean }) {
  const admin = await getAdmin();
  if (!admin) throw new AuthError("No autorizado");
  if (admin.mustChangePassword && !opts?.allowTemporary) throw new AuthError("Primero pon tu propia contraseña");
  if (role === "OWNER" && admin.role !== "OWNER") throw new AuthError("Solo el dueño puede hacer esto");
  return admin;
}

/** Cierra la sesión de este navegador. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}
