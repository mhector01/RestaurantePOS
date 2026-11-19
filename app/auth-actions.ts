"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { rootPrisma } from "@/lib/prisma-base";
import { getAdminPassword } from "@/lib/auth";
import { currentRestaurantId } from "@/lib/tenant";
import { endSession, requireAdmin, startSession } from "@/lib/session";
import {
  burnPasswordCheck,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  temporaryPassword,
  verifyPassword,
} from "@/lib/password";
import { LOGIN_LIMIT, blockedMinutes, clearFailures, registerFailure } from "@/lib/rate-limit";
import { planLimitProblem } from "@/lib/subscription";
import { UploadError, deleteImage, saveImage } from "@/lib/uploads";

type Result = { success: boolean; error?: string };

const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/** Solo rutas internas del panel (evita redirigir a otro sitio con ?next=). */
function safeNext(value: unknown) {
  const next = String(value ?? "");
  return /^\/admin(\/[\w\-/]*)?(\?[\w=&%.\-]*)?$/.test(next) ? next : "/admin";
}

function blockedMessage(min: number) {
  return `Demasiados intentos. Espera ${min} minuto${min === 1 ? "" : "s"} y vuelve a intentar.`;
}

// ---------------------------------------------------------------------------
// ENTRAR / SALIR
// ---------------------------------------------------------------------------

export async function loginAdmin(formData: FormData) {
  const rid = await currentRestaurantId();
  const email = normalizeEmail(String(formData.get("email") ?? "")) ?? "";
  const password = String(formData.get("password") ?? "");
  const keys = [`login:${rid}:${email}`, `login-ip:${rid}:${await clientIp()}`];
  const wait = Math.max(...keys.map(blockedMinutes));
  if (wait) return { error: blockedMessage(wait) };

  const account = email ? await prisma.account.findFirst({ where: { email } }) : null;
  const ok = account ? await verifyPassword(password, account.passwordHash) : (await burnPasswordCheck(password), false);
  if (!account || !ok || !account.active) {
    keys.forEach((k) => registerFailure(k, { ...LOGIN_LIMIT, max: k.startsWith("login-ip") ? 20 : LOGIN_LIMIT.max }));
    return { error: account && ok ? "Esta cuenta está desactivada. Pide acceso al dueño." : "Correo o contraseña incorrectos" };
  }
  keys.forEach(clearFailures);
  await prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  await startSession(account);
  redirect(account.mustChangePassword ? "/admin/ajustes/mi-cuenta" : safeNext(formData.get("next")));
}

/**
 * Primer acceso de un restaurante sin cuentas (por ejemplo, el local que ya usaba el sistema):
 * crea la cuenta del dueño. Pide la clave de instalación (ADMIN_PASSWORD) para que nadie más
 * pueda adueñarse del restaurante.
 */
export async function setupOwner(formData: FormData) {
  const rid = await currentRestaurantId();
  const key = `setup:${rid}:${await clientIp()}`;
  const wait = blockedMinutes(key);
  if (wait) return { error: blockedMessage(wait) };

  const setupKey = getAdminPassword();
  if (!setupKey) return { error: "Falta configurar ADMIN_PASSWORD en el servidor." };
  if (String(formData.get("setupKey") ?? "") !== setupKey) {
    registerFailure(key, LOGIN_LIMIT);
    return { error: "La clave de instalación no es correcta" };
  }
  const name = clean(formData.get("name"));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) return { error: "Escribe tu nombre" };
  if (!email) return { error: "Escribe un correo válido" };
  const problem = passwordProblem(password, email);
  if (problem) return { error: problem };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "Las contraseñas no coinciden" };

  const passwordHash = await hashPassword(password);
  const account = await prisma.$transaction(async (tx) => {
    if ((await tx.account.count()) > 0) return null; // alguien la creó primero
    return tx.account.create({ data: { name, email, passwordHash, role: "OWNER", lastLoginAt: new Date() } });
  });
  if (!account) return { error: "Este restaurante ya tiene cuenta. Inicia sesión." };
  clearFailures(key);
  await startSession(account);
  redirect("/admin");
}

export async function logoutAdmin() {
  await endSession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// MI CUENTA
// ---------------------------------------------------------------------------

const SUPPORT_ONLY = { success: false, error: "No disponible en una sesión de soporte" };

export async function updateProfile(input: { name: string; email: string }): Promise<Result> {
  const me = await requireAdmin();
  if (me.support) return SUPPORT_ONLY;
  const name = clean(input.name);
  const email = normalizeEmail(input.email);
  if (name.length < 2) return { success: false, error: "Escribe tu nombre" };
  if (!email) return { success: false, error: "Escribe un correo válido" };
  const clash = await prisma.account.findFirst({ where: { email, NOT: { id: me.id } } });
  if (clash) return { success: false, error: "Ese correo ya lo usa otra cuenta" };
  await prisma.account.update({ where: { id: me.id }, data: { name, email } });
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function changePassword(input: { current: string; next: string }): Promise<Result> {
  const me = await requireAdmin(undefined, { allowTemporary: true });
  if (me.support) return SUPPORT_ONLY;
  const account = await prisma.account.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(input.current, account.passwordHash))) {
    return { success: false, error: "La contraseña actual no es correcta" };
  }
  const problem = passwordProblem(input.next, account.email);
  if (problem) return { success: false, error: problem };
  if (input.next === input.current) return { success: false, error: "La nueva contraseña debe ser distinta" };
  await prisma.$transaction([
    prisma.account.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next), mustChangePassword: false } }),
    // Al cambiar la contraseña se cierran las demás sesiones (por si alguien más la conocía)
    prisma.session.deleteMany({ where: { accountId: me.id, NOT: { id: me.sessionId } } }),
  ]);
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function closeOtherSessions(): Promise<Result> {
  const me = await requireAdmin();
  if (me.support) return SUPPORT_ONLY;
  await prisma.session.deleteMany({ where: { accountId: me.id, NOT: { id: me.sessionId } } });
  revalidatePath("/admin/ajustes/mi-cuenta");
  return { success: true };
}

// ---------------------------------------------------------------------------
// CUENTAS DEL PANEL (solo el dueño)
// ---------------------------------------------------------------------------

const ROLES = new Set(["OWNER", "ADMIN"]);

async function ownersLeft(excludingId: number) {
  return prisma.account.count({ where: { role: "OWNER", active: true, NOT: { id: excludingId } } });
}

export async function createAccount(input: { name: string; email: string; role: string }): Promise<Result & { password?: string }> {
  await requireAdmin("OWNER");
  const name = clean(input.name);
  const email = normalizeEmail(input.email);
  if (name.length < 2) return { success: false, error: "Escribe el nombre" };
  if (!email) return { success: false, error: "Escribe un correo válido" };
  if (!ROLES.has(input.role)) return { success: false, error: "Rol no válido" };
  if (await prisma.account.findFirst({ where: { email } })) return { success: false, error: "Ya hay una cuenta con ese correo" };
  const limit = await planLimitProblem("accounts");
  if (limit) return { success: false, error: limit };
  const password = temporaryPassword();
  await prisma.account.create({
    data: { name, email, role: input.role, passwordHash: await hashPassword(password), mustChangePassword: true },
  });
  revalidatePath("/admin/ajustes/cuentas");
  return { success: true, password };
}

export async function resetAccountPassword(id: number): Promise<Result & { password?: string }> {
  const me = await requireAdmin("OWNER");
  if (id === me.id) return { success: false, error: "Cambia tu propia contraseña en Mi cuenta" };
  const password = temporaryPassword();
  await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { accountId: id } }),
  ]);
  revalidatePath("/admin/ajustes/cuentas");
  return { success: true, password };
}

export async function updateAccount(id: number, input: { role?: string; active?: boolean }): Promise<Result> {
  const me = await requireAdmin("OWNER");
  if (id === me.id) return { success: false, error: "No puedes cambiar tu propio rol ni desactivarte" };
  const target = await prisma.account.findUnique({ where: { id } });
  if (!target) return { success: false, error: "Cuenta no encontrada" };
  if (input.role !== undefined && !ROLES.has(input.role)) return { success: false, error: "Rol no válido" };
  if (input.active && !target.active) {
    const limit = await planLimitProblem("accounts");
    if (limit) return { success: false, error: limit };
  }
  await prisma.$transaction([
    prisma.account.update({ where: { id }, data: { ...(input.role ? { role: input.role } : {}), ...(input.active !== undefined ? { active: input.active } : {}) } }),
    ...(input.active === false ? [prisma.session.deleteMany({ where: { accountId: id } })] : []),
  ]);
  revalidatePath("/admin/ajustes/cuentas");
  return { success: true };
}

export async function deleteAccount(id: number): Promise<Result> {
  const me = await requireAdmin("OWNER");
  if (id === me.id) return { success: false, error: "No puedes eliminar tu propia cuenta" };
  const target = await prisma.account.findUnique({ where: { id } });
  if (!target) return { success: false, error: "Cuenta no encontrada" };
  if (target.role === "OWNER" && (await ownersLeft(id)) === 0) {
    return { success: false, error: "Debe quedar al menos un dueño" };
  }
  await prisma.account.delete({ where: { id } });
  revalidatePath("/admin/ajustes/cuentas");
  return { success: true };
}

// ---------------------------------------------------------------------------
// DATOS DEL NEGOCIO (solo el dueño)
// ---------------------------------------------------------------------------

export interface BusinessInput {
  name: string;
  address: string;
  taxId: string;
  phone: string;
}

export async function saveBusiness(input: BusinessInput): Promise<Result> {
  await requireAdmin("OWNER");
  const name = clean(input.name, 80);
  if (name.length < 2) return { success: false, error: "Escribe el nombre del restaurante" };
  const taxId = input.taxId.replace(/[^\d]/g, "");
  if (taxId && taxId.length !== 14) return { success: false, error: "El RTN debe tener 14 dígitos" };
  await rootPrisma.restaurant.update({
    where: { id: await currentRestaurantId() },
    data: { name, address: clean(input.address, 200), taxId, phone: clean(input.phone, 40) },
  });
  revalidatePath("/", "layout");
  return { success: true };
}

/** Reglas de descuentos: % que el mesero aplica sin autorización y % de ley para tercera edad. */
export async function saveDiscountSettings(input: { limit: number; seniorPercent: number }): Promise<Result> {
  await requireAdmin("OWNER");
  const limit = Math.floor(Number(input.limit));
  const senior = Math.floor(Number(input.seniorPercent));
  if (!(limit >= 0 && limit <= 100)) return { success: false, error: "El límite va de 0 a 100%" };
  if (!(senior >= 1 && senior <= 100)) return { success: false, error: "El % de tercera edad va de 1 a 100" };
  await rootPrisma.restaurant.update({ where: { id: await currentRestaurantId() }, data: { discountLimit: limit, seniorPercent: senior } });
  revalidatePath("/", "layout");
  return { success: true };
}

/** Logo para recibos y facturas. Recibe la imagen ya reducida por el navegador. */
export async function setRestaurantLogo(form: FormData): Promise<Result> {
  await requireAdmin("OWNER");
  const file = form.get("file");
  if (!(file instanceof Blob)) return { success: false, error: "No llegó la imagen" };
  const id = await currentRestaurantId();
  const current = await rootPrisma.restaurant.findUniqueOrThrow({ where: { id }, select: { logo: true } });
  try {
    const name = await saveImage(id, Buffer.from(await file.arrayBuffer()));
    await rootPrisma.restaurant.update({ where: { id }, data: { logo: name } });
    await deleteImage(id, current.logo);
  } catch (e) {
    if (e instanceof UploadError) return { success: false, error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function removeRestaurantLogo(): Promise<Result> {
  await requireAdmin("OWNER");
  const id = await currentRestaurantId();
  const current = await rootPrisma.restaurant.findUniqueOrThrow({ where: { id }, select: { logo: true } });
  await rootPrisma.restaurant.update({ where: { id }, data: { logo: null } });
  await deleteImage(id, current.logo);
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// SOPORTE DE LA PLATAFORMA
// ---------------------------------------------------------------------------

/** Dirección del panel de la plataforma, para volver al salir del modo soporte. */
function platformHome() {
  const host = process.env.PLATFORM_HOST?.trim() || process.env.ROOT_DOMAIN?.trim();
  if (host) return `https://${host.replace(/^\./, "")}/plataforma`;
  return process.env.NODE_ENV !== "production" ? "http://localhost:3000/plataforma" : "/plataforma";
}

/** Sale del modo soporte: cierra esa sesión y vuelve a la plataforma. */
export async function exitSupport() {
  const me = await requireAdmin();
  if (!me.support) redirect("/admin");
  await endSession();
  redirect(platformHome());
}

/** El dueño puede cerrar en cualquier momento las sesiones de soporte abiertas en su restaurante. */
export async function closeSupportSessions(): Promise<Result> {
  await requireAdmin("OWNER");
  await prisma.session.deleteMany({ where: { accountId: null } });
  revalidatePath("/admin/ajustes/cuentas");
  return { success: true };
}
