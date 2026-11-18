// Suscripciones: hasta cuándo está pagado cada restaurante, días de gracia y bloqueo por falta de pago.
// "paidUntil" es el último día pagado (incluido). Pasado ese día empiezan los días de gracia;
// después de la gracia el restaurante queda bloqueado hasta que se registre un pago.
import { cache } from "react";
import type { PlatformSettings } from "@prisma/client";
import { rootPrisma } from "@/lib/prisma-base";

const DAY = 86_400_000;

export type BillingState = "NONE" | "OK" | "DUE_SOON" | "GRACE" | "EXPIRED";

export const DUE_SOON_DAYS = 7;

export const PAYMENT_METHODS: Record<string, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

/** Ajustes de la plataforma (una fila). Se crea con los valores por defecto la primera vez. */
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  return (
    (await rootPrisma.platformSettings.findUnique({ where: { id: 1 } })) ??
    (await rootPrisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} }))
  );
});

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + n);
  if (x.getDate() < day) x.setDate(0); // 31 ene + 1 mes = 28/29 feb
  return x;
}

export interface Billing {
  state: BillingState;
  paidUntil: Date | null;
  /** Primer día sin pagar (paidUntil + 1). */
  dueDate: Date | null;
  /** Último día de gracia: después se bloquea. */
  graceUntil: Date | null;
  /** Días que faltan para vencer (negativo si ya venció). */
  daysLeft: number | null;
}

export function billingOf(paidUntil: Date | null, graceDays: number, now = new Date()): Billing {
  if (!paidUntil) return { state: "NONE", paidUntil: null, dueDate: null, graceUntil: null, daysLeft: null };
  const due = addDays(startOfDay(paidUntil), 1); // primer día sin pagar
  const blockAt = addDays(due, graceDays);
  const daysLeft = Math.round((due.getTime() - startOfDay(now).getTime()) / DAY) - 1;
  const state: BillingState =
    now >= blockAt ? "EXPIRED" : now >= due ? "GRACE" : daysLeft < DUE_SOON_DAYS ? "DUE_SOON" : "OK";
  return { state, paidUntil, dueDate: due, graceUntil: addDays(blockAt, -1), daysLeft };
}

/** ¿El restaurante no puede usar el sistema (suspendido a mano o vencido tras la gracia)? */
export function isBlocked(r: { status: string; paidUntil: Date | null }, graceDays: number, now = new Date()) {
  return r.status !== "ACTIVE" || billingOf(r.paidUntil, graceDays, now).state === "EXPIRED";
}

/**
 * Registrar un pago: el nuevo periodo empieza el día siguiente al último pagado
 * (o hoy, si ya estaba vencido) y dura los meses pagados.
 */
export function nextPeriod(paidUntil: Date | null, months: number, now = new Date()) {
  const today = startOfDay(now);
  const from = paidUntil && addDays(startOfDay(paidUntil), 1) > today ? addDays(startOfDay(paidUntil), 1) : today;
  const to = addDays(addMonths(from, months), -1);
  return { from, to };
}

export const fmtDay = (d: Date) => d.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });
