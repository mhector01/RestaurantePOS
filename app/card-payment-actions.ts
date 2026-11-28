"use server";

// Pago de la suscripción con tarjeta, iniciado por el dueño desde el subdominio de su restaurante.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rootPrisma } from "@/lib/prisma-base";
import { getRestaurant } from "@/lib/tenant";
import { requireAdmin } from "@/lib/session";
import { billingOf, getPlatformSettings } from "@/lib/billing";
import { burnPasswordCheck, normalizeEmail, verifyPassword } from "@/lib/password";
import { LOGIN_LIMIT, blockedMinutes, clearFailures, registerFailure } from "@/lib/rate-limit";
import { type CheckoutResult, checkoutResult, startCardCheckout } from "@/lib/card-checkout";

type Result = { success: boolean; error?: string };

async function restaurantWithPlan() {
  const r = await getRestaurant();
  return r ? rootPrisma.restaurant.findUnique({ where: { id: r.id }, include: { plan: true } }) : null;
}

/** Desde Ajustes → Suscripción (con sesión de dueño): va a Pagadito o devuelve el error. */
export async function startCardPayment(months: number): Promise<Result> {
  const me = await requireAdmin("OWNER");
  if (me.support) return { success: false, error: "El pago con tarjeta lo hace el dueño desde su propia cuenta" };
  const r = await restaurantWithPlan();
  if (!r) return { success: false, error: "Restaurante no encontrado" };
  const res = await startCardCheckout(r, { name: me.name, email: me.email }, Math.floor(Number(months)));
  if (!res.ok) return { success: false, error: res.error };
  redirect(res.url);
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

/**
 * Desde la pantalla de "Suscripción vencida": ahí no hay sesión que sirva (el bloqueo las invalida),
 * así que el dueño confirma con su correo y contraseña. Solo inicia el pago: no abre ninguna sesión
 * ni desbloquea nada; el restaurante vuelve a funcionar cuando llega el aviso de pago confirmado.
 */
export async function startBlockedCardPayment(formData: FormData): Promise<Result> {
  const r = await restaurantWithPlan();
  if (!r) return { success: false, error: "Restaurante no encontrado" };
  if (r.status !== "ACTIVE") return { success: false, error: "La cuenta está suspendida. Comunícate con soporte." };
  const settings = await getPlatformSettings();
  if (billingOf(r.paidUntil, settings.graceDays).state !== "EXPIRED") {
    return { success: false, error: "Tu suscripción no está vencida: paga desde Ajustes → Suscripción." };
  }

  const email = normalizeEmail(String(formData.get("email") ?? "")) ?? "";
  const password = String(formData.get("password") ?? "");
  // Mismo freno que el inicio de sesión (comparte las llaves: no da intentos extra)
  const keys = [`login:${r.id}:${email}`, `login-ip:${r.id}:${await clientIp()}`];
  const wait = Math.max(...keys.map(blockedMinutes));
  if (wait) return { success: false, error: `Demasiados intentos. Espera ${wait} minuto${wait === 1 ? "" : "s"} y vuelve a intentar.` };

  const account = email ? await rootPrisma.account.findFirst({ where: { restaurantId: r.id, email } }) : null;
  const ok = account ? await verifyPassword(password, account.passwordHash) : (await burnPasswordCheck(password), false);
  if (!account || !ok || !account.active) {
    keys.forEach((k) => registerFailure(k, { ...LOGIN_LIMIT, max: k.startsWith("login-ip") ? 20 : LOGIN_LIMIT.max }));
    return { success: false, error: "Correo o contraseña incorrectos" };
  }
  keys.forEach(clearFailures);
  if (account.role !== "OWNER") return { success: false, error: "Solo el dueño del restaurante puede pagar la suscripción." };

  const res = await startCardCheckout(r, { name: account.name, email: account.email }, Math.floor(Number(formData.get("months"))));
  if (!res.ok) return { success: false, error: res.error };
  redirect(res.url);
}

/** Estado de un pago con tarjeta de ESTE restaurante (para la pantalla de bloqueo, que se actualiza sola). */
export async function cardPaymentStatus(pago: string | null, cobro: string | null): Promise<CheckoutResult | null> {
  const r = await getRestaurant();
  if (!r) return null;
  return checkoutResult(r.id, { pago, cobro });
}
