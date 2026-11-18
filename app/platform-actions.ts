"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rootPrisma } from "@/lib/prisma-base";
import { endPlatformSession, requirePlatform, startPlatformSession } from "@/lib/platform-session";
import { restaurantUrl } from "@/lib/platform";
import { isPlatformHost, normalizeSlug } from "@/lib/tenant-host";
import {
  burnPasswordCheck,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  temporaryPassword,
  verifyPassword,
} from "@/lib/password";
import { LOGIN_LIMIT, blockedMinutes, clearFailures, registerFailure } from "@/lib/rate-limit";

type Result = { success: boolean; error?: string };
const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function refresh(id?: number) {
  revalidatePath("/plataforma");
  if (id) revalidatePath(`/plataforma/r/${id}`);
}

// ---------------------------------------------------------------------------
// ENTRAR / SALIR / MI CUENTA
// ---------------------------------------------------------------------------

export async function loginPlatform(formData: FormData) {
  if (!isPlatformHost((await headers()).get("host"))) return { error: "No disponible en esta dirección" };
  const email = normalizeEmail(String(formData.get("email") ?? "")) ?? "";
  const password = String(formData.get("password") ?? "");
  const keys = [`plat:${email}`, `plat-ip:${await clientIp()}`];
  const wait = Math.max(...keys.map(blockedMinutes));
  if (wait) return { error: `Demasiados intentos. Espera ${wait} min y vuelve a intentar.` };

  const user = email ? await rootPrisma.platformUser.findUnique({ where: { email } }) : null;
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  if (!user || !ok || !user.active) {
    keys.forEach((k) => registerFailure(k, { ...LOGIN_LIMIT, max: k.startsWith("plat-ip") ? 15 : LOGIN_LIMIT.max }));
    return { error: "Correo o contraseña incorrectos" };
  }
  keys.forEach(clearFailures);
  await rootPrisma.platformUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startPlatformSession(user);
  redirect(user.mustChangePassword ? "/plataforma/cuenta" : "/plataforma");
}

export async function logoutPlatform() {
  await endPlatformSession();
  redirect("/plataforma/login");
}

export async function changePlatformPassword(input: { current: string; next: string }): Promise<Result> {
  const me = await requirePlatform({ allowTemporary: true });
  const user = await rootPrisma.platformUser.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(input.current, user.passwordHash))) return { success: false, error: "La contraseña actual no es correcta" };
  const problem = passwordProblem(input.next, user.email);
  if (problem) return { success: false, error: problem };
  if (input.next === input.current) return { success: false, error: "La nueva contraseña debe ser distinta" };
  await rootPrisma.$transaction([
    rootPrisma.platformUser.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next), mustChangePassword: false } }),
    rootPrisma.platformSession.deleteMany({ where: { userId: me.id, NOT: { id: me.sessionId } } }),
  ]);
  revalidatePath("/plataforma", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// RESTAURANTES
// ---------------------------------------------------------------------------

export interface NewRestaurantInput {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  notes: string;
}

/** Crea el restaurante con la cuenta de su dueño (contraseña temporal). */
export async function createRestaurant(
  input: NewRestaurantInput
): Promise<Result & { id?: number; password?: string; url?: string | null; email?: string }> {
  await requirePlatform();
  const name = clean(input.name, 80);
  const slug = normalizeSlug(input.slug || input.name);
  const ownerName = clean(input.ownerName) || "Dueño";
  const email = normalizeEmail(input.ownerEmail);
  if (name.length < 2) return { success: false, error: "Escribe el nombre del restaurante" };
  if (!slug) return { success: false, error: "El subdominio debe tener al menos 2 letras o números (y no puede ser www, app, admin ni api)" };
  if (!email) return { success: false, error: "Escribe el correo del dueño" };
  if (await rootPrisma.restaurant.findUnique({ where: { slug } })) {
    return { success: false, error: `Ya existe un restaurante con el subdominio "${slug}"` };
  }
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  const restaurant = await rootPrisma.$transaction(async (tx) => {
    const r = await tx.restaurant.create({ data: { name, slug, notes: clean(input.notes, 2000) } });
    await tx.account.create({
      data: { restaurantId: r.id, name: ownerName, email, passwordHash, role: "OWNER", mustChangePassword: true },
    });
    return r;
  });
  refresh();
  return { success: true, id: restaurant.id, password, url: restaurantUrl(slug), email };
}

export interface RestaurantEdit {
  name: string;
  slug: string;
  notes: string;
}

export async function updateRestaurant(id: number, input: RestaurantEdit): Promise<Result> {
  await requirePlatform();
  const name = clean(input.name, 80);
  const slug = normalizeSlug(input.slug);
  if (name.length < 2) return { success: false, error: "Escribe el nombre del restaurante" };
  if (!slug) return { success: false, error: "Subdominio no válido" };
  const clash = await rootPrisma.restaurant.findFirst({ where: { slug, NOT: { id } } });
  if (clash) return { success: false, error: `El subdominio "${slug}" ya lo usa ${clash.name || clash.slug}` };
  await rootPrisma.restaurant.update({ where: { id }, data: { name, slug, notes: clean(input.notes, 2000) } });
  refresh(id);
  return { success: true };
}

/** Suspender bloquea el punto de venta, la cocina y el panel del restaurante (sus datos se conservan). */
export async function setRestaurantActive(id: number, active: boolean): Promise<Result> {
  await requirePlatform();
  await rootPrisma.restaurant.update({
    where: { id },
    data: active ? { status: "ACTIVE", suspendedAt: null } : { status: "SUSPENDED", suspendedAt: new Date() },
  });
  refresh(id);
  return { success: true };
}

/** Acceso de dueño: crea la cuenta o le asigna una contraseña temporal nueva (y cierra sus sesiones). */
export async function grantOwnerAccess(
  id: number,
  input: { email: string; name: string }
): Promise<Result & { password?: string; email?: string }> {
  await requirePlatform();
  const email = normalizeEmail(input.email);
  if (!email) return { success: false, error: "Escribe un correo válido" };
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  const existing = await rootPrisma.account.findUnique({ where: { restaurantId_email: { restaurantId: id, email } } });
  await rootPrisma.$transaction(async (tx) => {
    if (existing) {
      await tx.account.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: true, active: true, role: "OWNER" },
      });
      await tx.session.deleteMany({ where: { accountId: existing.id } });
    } else {
      await tx.account.create({
        data: { restaurantId: id, name: clean(input.name) || "Dueño", email, passwordHash, role: "OWNER", mustChangePassword: true },
      });
    }
  });
  refresh(id);
  return { success: true, password, email };
}

// ---------------------------------------------------------------------------
// EQUIPO DE LA PLATAFORMA
// ---------------------------------------------------------------------------

export async function createPlatformUser(input: { name: string; email: string }): Promise<Result & { password?: string }> {
  await requirePlatform();
  const name = clean(input.name);
  const email = normalizeEmail(input.email);
  if (name.length < 2) return { success: false, error: "Escribe el nombre" };
  if (!email) return { success: false, error: "Escribe un correo válido" };
  if (await rootPrisma.platformUser.findUnique({ where: { email } })) return { success: false, error: "Ya existe con ese correo" };
  const password = temporaryPassword();
  await rootPrisma.platformUser.create({ data: { name, email, passwordHash: await hashPassword(password), mustChangePassword: true } });
  revalidatePath("/plataforma/equipo");
  return { success: true, password };
}

export async function resetPlatformUser(id: number): Promise<Result & { password?: string }> {
  const me = await requirePlatform();
  if (id === me.id) return { success: false, error: "Cambia tu propia contraseña en Mi cuenta" };
  const password = temporaryPassword();
  await rootPrisma.$transaction([
    rootPrisma.platformUser.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }),
    rootPrisma.platformSession.deleteMany({ where: { userId: id } }),
  ]);
  revalidatePath("/plataforma/equipo");
  return { success: true, password };
}

export async function setPlatformUserActive(id: number, active: boolean): Promise<Result> {
  const me = await requirePlatform();
  if (id === me.id) return { success: false, error: "No puedes desactivarte a ti mismo" };
  await rootPrisma.$transaction([
    rootPrisma.platformUser.update({ where: { id }, data: { active } }),
    ...(active ? [] : [rootPrisma.platformSession.deleteMany({ where: { userId: id } })]),
  ]);
  revalidatePath("/plataforma/equipo");
  return { success: true };
}
