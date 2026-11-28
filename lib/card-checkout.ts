// Pago de la suscripción con tarjeta: precios, inicio del cobro y aplicación del aviso de IMZA Pagos.
// Todo con rootPrisma y el id del restaurante explícito: también se usa con el restaurante bloqueado
// (donde el cliente filtrado no funciona) y desde el aviso, que no tiene restaurante en la dirección.
import type { Plan, Restaurant } from "@prisma/client";
import { rootPrisma } from "@/lib/prisma-base";
import { restaurantUrl } from "@/lib/platform";
import { applySubscriptionPayment } from "@/lib/subscription-payments";
import { type CobroAviso, ImzaPagosError, cardPaymentsEnabled, crearCobro } from "@/lib/imza-pagos";

// Los precios de los planes están en lempiras. Pagadito muestra al dueño el equivalente en dólares y cobra en USD;
// el cobro y el aviso conservan el monto en lempiras, que es lo que se registra en la suscripción.
export const CARD_CURRENCY = "HNL";

/**
 * Meses que se pueden pagar con tarjeta y su descuento en % sobre (precio del plan × meses).
 * Para ofrecer, p. ej., 10% en el pago anual: `12: 10`.
 */
export const CARD_DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 0,
  6: 0,
  12: 0,
};

export const CARD_MONTHS = Object.keys(CARD_DISCOUNTS)
  .map(Number)
  .sort((a, b) => a - b);

export interface CardQuote {
  months: number;
  subtotal: number;
  discountPercent: number;
  total: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function cardQuote(monthlyPrice: number, months: number): CardQuote {
  const subtotal = cents(monthlyPrice * months);
  const discountPercent = CARD_DISCOUNTS[months] ?? 0;
  return { months, subtotal, discountPercent, total: cents(subtotal * (1 - discountPercent / 100)) };
}

export const cardQuotes = (monthlyPrice: number) => CARD_MONTHS.map((m) => cardQuote(monthlyPrice, m));

export const fmtMoney = (n: number) => `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const monthsLabel = (m: number) => `${m} mes${m === 1 ? "" : "es"}`;

/** ¿Se le puede ofrecer el pago con tarjeta a este restaurante? (servicio configurado y plan con precio) */
export function canPayByCard(r: Pick<Restaurant, "status"> & { plan: Plan | null }) {
  return cardPaymentsEnabled() && r.status === "ACTIVE" && !!r.plan && r.plan.price > 0 && !!restaurantUrl("x");
}

/** Dirección a la que vuelve el cliente después de Pagadito (imzaris.com le agrega &cobro=…&estado=…). */
export function returnUrl(slug: string, checkoutId: string) {
  return `${restaurantUrl(slug)}/admin/ajustes/suscripcion?pago=${encodeURIComponent(checkoutId)}`;
}

type StartResult = { ok: true; url: string } | { ok: false; error: string };

/** Crea el cobro pendiente, se lo pide a IMZA Pagos y devuelve la dirección de Pagadito. */
export async function startCardCheckout(
  restaurant: Restaurant & { plan: Plan | null },
  owner: { name: string; email: string },
  months: number
): Promise<StartResult> {
  if (!cardPaymentsEnabled()) return { ok: false, error: "El pago con tarjeta no está disponible por ahora." };
  if (restaurant.status !== "ACTIVE") return { ok: false, error: "La cuenta está suspendida. Comunícate con soporte." };
  const plan = restaurant.plan;
  if (!plan || !(plan.price > 0)) return { ok: false, error: "Tu restaurante no tiene un plan con precio. Comunícate con soporte." };
  if (!CARD_MONTHS.includes(months)) return { ok: false, error: "Elige cuántos meses vas a pagar" };
  if (!restaurantUrl(restaurant.slug)) return { ok: false, error: "Falta configurar ROOT_DOMAIN en el servidor." };

  const quote = cardQuote(plan.price, months);
  const checkout = await rootPrisma.cardCheckout.create({
    data: { restaurantId: restaurant.id, months, amount: quote.total, currency: CARD_CURRENCY, createdBy: owner.email },
  });
  try {
    const cobro = await crearCobro({
      referencia: checkout.id,
      descripcion: `Ristemo · ${plan.name} · ${monthsLabel(months)} · ${restaurant.name || restaurant.slug}`.slice(0, 200),
      monto: quote.total,
      moneda: CARD_CURRENCY,
      cliente: { nombre: owner.name, correo: owner.email },
      retorno_url: returnUrl(restaurant.slug, checkout.id),
      metadata: { restaurante: restaurant.slug, meses: months },
    });
    await rootPrisma.cardCheckout.update({ where: { id: checkout.id }, data: { cobroId: cobro.id } });
    return { ok: true, url: cobro.url };
  } catch (e) {
    console.error("[imza-pagos] no se pudo crear el cobro", checkout.id, e);
    await rootPrisma.cardCheckout.update({ where: { id: checkout.id }, data: { status: "FAILED" } });
    const busy = e instanceof ImzaPagosError && e.status === 502;
    return {
      ok: false,
      error: busy
        ? "El procesador de pagos no responde en este momento. Intenta de nuevo en unos minutos."
        : "No se pudo iniciar el pago con tarjeta. Intenta de nuevo o comunícate con soporte.",
    };
  }
}

const CLOSED: Record<string, "CANCELED" | "FAILED"> = {
  CANCELED: "CANCELED",
  EXPIRED: "CANCELED",
  FAILED: "FAILED",
  REVOKED: "FAILED",
};

/**
 * Aplica un aviso `cobro.actualizado`. Idempotente: el pago se registra y el cobro pasa a PAID en la
 * misma transacción, con la fila del cobro bloqueada, así que un aviso repetido no acredita dos veces.
 */
export async function settleCardCheckout(cobro: CobroAviso): Promise<string> {
  const ref = String(cobro.referencia ?? "");
  const checkout = ref ? await rootPrisma.cardCheckout.findUnique({ where: { id: ref } }) : null;
  if (!checkout) return "unknown";

  if (cobro.estado === "COMPLETED") {
    const paidCents = Math.round(Number(cobro.monto) * 100);
    const expectedCents = Math.round(checkout.amount.toNumber() * 100);
    if (paidCents !== expectedCents || String(cobro.moneda).toUpperCase() !== checkout.currency) {
      console.error("[imza-pagos] monto o moneda no coinciden", { checkout: checkout.id, cobro: cobro.id, monto: cobro.monto, moneda: cobro.moneda });
      return "mismatch";
    }
    return rootPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "CardCheckout" WHERE id = ${checkout.id} FOR UPDATE`;
      const current = await tx.cardCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
      if (current.status === "PAID") return "already-paid";
      // Aunque antes llegara un aviso de cancelado (desorden), si Pagadito lo cobró se acredita.
      const { payment } = await applySubscriptionPayment(tx, {
        restaurantId: current.restaurantId,
        months: current.months,
        amount: current.amount.toNumber(),
        method: "CARD",
        reference: String(cobro.referencia_pagadito || cobro.id).slice(0, 80),
        note: `Pago con tarjeta en línea (cobro ${cobro.id})`.slice(0, 300),
        recordedBy: "Pagadito",
      });
      await tx.cardCheckout.update({
        where: { id: current.id },
        data: { status: "PAID", paidAt: new Date(), cobroId: current.cobroId ?? cobro.id, paymentId: payment.id },
      });
      return "paid";
    });
  }

  const closed = CLOSED[cobro.estado];
  if (closed) {
    if (checkout.cobroId && checkout.cobroId !== cobro.id) return "other-cobro";
    if (checkout.status === "PAID") {
      // REVOKED después de pagado: no se descuenta solo; lo revisa la plataforma.
      console.warn("[imza-pagos] aviso", cobro.estado, "de un cobro ya acreditado", checkout.id, cobro.id);
      return "ignored-paid";
    }
    await rootPrisma.cardCheckout.updateMany({ where: { id: checkout.id, status: "PENDING" }, data: { status: closed } });
    return closed.toLowerCase();
  }
  return "ignored"; // REGISTERED, VERIFYING…: sigue pendiente
}

export interface CheckoutResult {
  status: "PENDING" | "PAID" | "CANCELED" | "FAILED";
  months: number;
  amount: number;
  paidUntil: string | null;
}

/** Resultado de un pago con tarjeta del restaurante (por su id o por el id del cobro), para mostrarlo al volver. */
export async function checkoutResult(restaurantId: number, by: { pago?: string | null; cobro?: string | null }): Promise<CheckoutResult | null> {
  const pago = by.pago?.slice(0, 40);
  const cobro = by.cobro?.slice(0, 60);
  if (!pago && !cobro) return null;
  const c = await rootPrisma.cardCheckout.findFirst({
    where: { restaurantId, ...(pago ? { id: pago } : { cobroId: cobro }) },
    include: { restaurant: { select: { paidUntil: true } } },
  });
  if (!c) return null;
  return {
    status: c.status as CheckoutResult["status"],
    months: c.months,
    amount: c.amount.toNumber(),
    paidUntil: c.status === "PAID" && c.restaurant.paidUntil ? c.restaurant.paidUntil.toISOString() : null,
  };
}
