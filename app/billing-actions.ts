"use server";

// Suscripciones desde la plataforma: planes, ajustes, plan y vencimiento de cada restaurante, pagos.
import { revalidatePath } from "next/cache";
import { rootPrisma } from "@/lib/prisma-base";
import { requirePlatform } from "@/lib/platform-session";
import { PAYMENT_METHODS, nextPeriod } from "@/lib/billing";

type Result = { success: boolean; error?: string };
const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const cleanBlock = (v: unknown, max = 2000) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** "2026-12-31" → fecha local (sin desfase de zona horaria). */
function parseDay(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 ? date : null;
}

const limit = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

function refreshRestaurant(id: number) {
  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/r/${id}`);
}

// ---------------------------------------------------------------------------
// AJUSTES DE LA PLATAFORMA
// ---------------------------------------------------------------------------

export interface PlatformSettingsInput {
  trialDays: number;
  graceDays: number;
  signupEnabled: boolean;
  signupPlanId: number | null;
  paymentInstructions: string;
  supportPhone: string;
  supportEmail: string;
}

export async function savePlatformSettings(input: PlatformSettingsInput): Promise<Result> {
  await requirePlatform();
  const trialDays = Math.floor(Number(input.trialDays));
  const graceDays = Math.floor(Number(input.graceDays));
  if (!(trialDays >= 0 && trialDays <= 90)) return { success: false, error: "Los días de prueba van de 0 a 90" };
  if (!(graceDays >= 0 && graceDays <= 30)) return { success: false, error: "Los días de gracia van de 0 a 30" };
  if (input.signupPlanId && !(await rootPrisma.plan.findUnique({ where: { id: input.signupPlanId } }))) {
    return { success: false, error: "Ese plan no existe" };
  }
  const data = {
    trialDays,
    graceDays,
    signupEnabled: !!input.signupEnabled,
    signupPlanId: input.signupPlanId || null,
    paymentInstructions: cleanBlock(input.paymentInstructions),
    supportPhone: clean(input.supportPhone, 40),
    supportEmail: clean(input.supportEmail, 120),
  };
  await rootPrisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  revalidatePath("/plataforma", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// PLANES
// ---------------------------------------------------------------------------

export interface PlanInput {
  name: string;
  price: number;
  description: string;
  maxWaiters: number | null | "";
  maxAccounts: number | null | "";
}

export async function savePlan(id: number | null, input: PlanInput): Promise<Result> {
  await requirePlatform();
  const name = clean(input.name, 60);
  const price = Math.round(Number(input.price) * 100) / 100;
  const maxWaiters = limit(input.maxWaiters);
  const maxAccounts = limit(input.maxAccounts);
  if (name.length < 2) return { success: false, error: "Escribe el nombre del plan" };
  if (!(price >= 0)) return { success: false, error: "Precio no válido" };
  if (maxWaiters === undefined || maxAccounts === undefined) return { success: false, error: "Los límites deben ser números (o vacíos = sin límite)" };
  const data = { name, price, description: cleanBlock(input.description, 300), maxWaiters, maxAccounts };
  if (id) await rootPrisma.plan.update({ where: { id }, data });
  else await rootPrisma.plan.create({ data: { ...data, position: await rootPrisma.plan.count() } });
  revalidatePath("/plataforma", "layout");
  return { success: true };
}

export async function setPlanActive(id: number, active: boolean): Promise<Result> {
  await requirePlatform();
  await rootPrisma.plan.update({ where: { id }, data: { active } });
  revalidatePath("/plataforma", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// SUSCRIPCIÓN DE UN RESTAURANTE
// ---------------------------------------------------------------------------

export async function setRestaurantPlan(id: number, planId: number | null): Promise<Result> {
  await requirePlatform();
  if (planId && !(await rootPrisma.plan.findUnique({ where: { id: planId } }))) return { success: false, error: "Ese plan no existe" };
  await rootPrisma.restaurant.update({ where: { id }, data: { planId } });
  refreshRestaurant(id);
  return { success: true };
}

/** Ajuste manual del vencimiento (corregir un error, regalar días) o "sin vencimiento" con null. */
export async function setPaidUntil(id: number, day: string | null): Promise<Result> {
  await requirePlatform();
  const paidUntil = day === null ? null : parseDay(day);
  if (day !== null && !paidUntil) return { success: false, error: "Fecha no válida" };
  await rootPrisma.restaurant.update({ where: { id }, data: { paidUntil } });
  refreshRestaurant(id);
  return { success: true };
}

export interface PaymentInput {
  amount: number;
  months: number;
  method: string;
  reference: string;
  note: string;
}

/** Registra un pago y alarga el vencimiento por los meses pagados. */
export async function registerSubscriptionPayment(id: number, input: PaymentInput): Promise<Result & { paidUntil?: string }> {
  const me = await requirePlatform();
  const amount = Math.round(Number(input.amount) * 100) / 100;
  const months = Math.floor(Number(input.months));
  if (!(amount > 0)) return { success: false, error: "Escribe el monto pagado" };
  if (!(months >= 1 && months <= 24)) return { success: false, error: "Los meses van de 1 a 24" };
  if (!PAYMENT_METHODS[input.method]) return { success: false, error: "Forma de pago no válida" };

  const to = await rootPrisma.$transaction(async (tx) => {
    // Bloquea la fila para que dos pagos registrados a la vez no calculen el mismo periodo
    await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${id} FOR UPDATE`;
    const r = await tx.restaurant.findUniqueOrThrow({ where: { id } });
    const period = nextPeriod(r.paidUntil, months);
    await tx.subscriptionPayment.create({
      data: {
        restaurantId: id,
        amount,
        months,
        method: input.method,
        reference: clean(input.reference, 80),
        note: clean(input.note, 300),
        periodFrom: period.from,
        periodTo: period.to,
        recordedBy: me.name,
      },
    });
    // Si estaba bloqueado por vencimiento, se desbloquea solo. Una suspensión manual se quita aparte.
    await tx.restaurant.update({ where: { id }, data: { paidUntil: period.to } });
    return period.to;
  });
  refreshRestaurant(id);
  return { success: true, paidUntil: to.toISOString() };
}
