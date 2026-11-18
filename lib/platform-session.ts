// Sesiones del equipo de la plataforma (/plataforma). Igual que las del panel de cada restaurante,
// pero con su propia tabla y cookie: una cuenta de restaurante nunca entra aquí, ni al revés.
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { PlatformSession, PlatformUser } from "@prisma/client";
import { rootPrisma } from "@/lib/prisma-base";
import { hashToken } from "@/lib/session";
import { isPlatformHost } from "@/lib/tenant-host";

export const PLATFORM_COOKIE = "ristemo_platform";
const IDLE_DAYS = 3;
const DAY = 86_400_000;
const TOUCH_EVERY = 30 * 60_000;

export type PlatformAccount = Pick<PlatformUser, "id" | "name" | "email" | "mustChangePassword"> & { sessionId: string };

async function isHttps() {
  return (await headers()).get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
}

export async function startPlatformSession(user: Pick<PlatformUser, "id">) {
  const token = randomBytes(32).toString("base64url");
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 300);
  await rootPrisma.platformSession.create({
    data: { id: hashToken(token), userId: user.id, userAgent: ua, expiresAt: new Date(Date.now() + IDLE_DAYS * DAY) },
  });
  (await cookies()).set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/plataforma",
    maxAge: 30 * 24 * 60 * 60,
  });
}

type Valid = PlatformSession & { user: PlatformUser };
const usable = (s: Valid | null): s is Valid => !!s && s.expiresAt > new Date() && s.user.active;

/** Para el proxy: ¿token válido en una dirección de la plataforma? */
export async function platformSessionFor(token: string | undefined, host: string | null) {
  if (!token || !isPlatformHost(host)) return null;
  const s = await rootPrisma.platformSession.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  return usable(s) ? s : null;
}

export const getPlatformUser = cache(async (): Promise<PlatformAccount | null> => {
  if (!isPlatformHost((await headers()).get("host"))) return null;
  const token = (await cookies()).get(PLATFORM_COOKIE)?.value;
  if (!token) return null;
  const s = await rootPrisma.platformSession.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!usable(s)) return null;
  if (Date.now() - s.lastSeenAt.getTime() > TOUCH_EVERY) {
    await rootPrisma.platformSession.update({
      where: { id: s.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + IDLE_DAYS * DAY) },
    });
  }
  const { id, name, email, mustChangePassword } = s.user;
  return { id, name, email, mustChangePassword, sessionId: s.id };
});

/** Para cada acción de la plataforma. Con contraseña temporal solo se permite cambiarla. */
export async function requirePlatform(opts?: { allowTemporary?: boolean }) {
  const user = await getPlatformUser();
  if (!user) throw new Error("No autorizado");
  if (user.mustChangePassword && !opts?.allowTemporary) throw new Error("Primero pon tu propia contraseña");
  return user;
}

export async function endPlatformSession() {
  const store = await cookies();
  const token = store.get(PLATFORM_COOKIE)?.value;
  if (token) await rootPrisma.platformSession.deleteMany({ where: { id: hashToken(token) } });
  store.delete({ name: PLATFORM_COOKIE, path: "/plataforma" });
}
