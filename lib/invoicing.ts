import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  computeTotals,
  formatInvoiceNumber,
  normalizeTaxRate,
  splitComboAmount,
  type InvoiceIssuer,
  type InvoiceLine,
  type InvoiceView,
} from "@/lib/fiscal";

/** Avisar cuando queden pocas facturas o pocos días. */
export const LOW_RANGE_LEFT = 50;
export const DEADLINE_WARN_DAYS = 30;

export async function getFiscalSettings() {
  return (
    (await prisma.fiscalSettings.findUnique({ where: { id: 1 } })) ??
    (await prisma.fiscalSettings.create({ data: { id: 1 } }))
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Rangos aún utilizables (con números disponibles y fecha límite vigente), en orden de uso. */
export function usableRanges() {
  return prisma.invoiceRange.findMany({
    where: { active: true, deadline: { gte: startOfToday() } },
    orderBy: { id: "asc" },
  });
}

export type FiscalAlert = { level: "error" | "warn"; message: string };

/** Estado de la facturación para mostrar alertas en el panel y en caja. */
export async function fiscalStatus() {
  const settings = await getFiscalSettings();
  if (!settings.enabled) return { enabled: false, alerts: [] as FiscalAlert[], available: 0, current: null };
  const ranges = (await usableRanges()).filter((r) => r.nextNumber <= r.rangeTo);
  const available = ranges.reduce((s, r) => s + (r.rangeTo - r.nextNumber + 1), 0);
  const current = ranges[0] ?? null;
  const alerts: FiscalAlert[] = [];

  if (!settings.rtn || !settings.legalName) {
    alerts.push({ level: "error", message: "Faltan los datos fiscales del negocio (RTN y razón social)." });
  }
  if (!current) {
    alerts.push({ level: "error", message: "No hay un rango CAI vigente: los cobros no generan factura." });
  } else {
    if (available <= LOW_RANGE_LEFT) {
      alerts.push({ level: "warn", message: `Quedan ${available} facturas en el rango autorizado. Solicita un nuevo CAI.` });
    }
    const days = Math.floor((current.deadline.getTime() - Date.now()) / 86_400_000);
    if (days <= DEADLINE_WARN_DAYS && ranges.every((r) => r.deadline.getTime() - Date.now() < DEADLINE_WARN_DAYS * 86_400_000)) {
      alerts.push({
        level: days <= 7 ? "error" : "warn",
        message: `La fecha límite de emisión del CAI vence ${days <= 0 ? "hoy" : `en ${days} día${days === 1 ? "" : "s"}`}.`,
      });
    }
  }
  return { enabled: true, alerts, available, current };
}

// ---------------------------------------------------------------------------
// Emisión
// ---------------------------------------------------------------------------

export interface SoldItem {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  detail?: string | null;
  parts?: { productId: number; quantity: number }[];
}

/** Convierte lo cobrado en líneas de factura con su tasa de ISV (los combos reparten su precio). */
export async function buildInvoiceLines(items: SoldItem[]): Promise<InvoiceLine[]> {
  const ids = new Set<number>();
  for (const i of items) {
    ids.add(i.productId);
    i.parts?.forEach((p) => ids.add(p.productId));
  }
  const products = await prisma.product.findMany({ where: { id: { in: [...ids] } }, select: { id: true, price: true, taxRate: true } });
  const byId = new Map(products.map((p) => [p.id, p]));

  return items.map((i) => {
    const total = Math.round(i.price * i.quantity * 100) / 100;
    if (i.parts && i.parts.length > 0) {
      const split = splitComboAmount(
        total,
        i.parts.map((p) => ({
          price: byId.get(p.productId)?.price ?? 0,
          quantity: p.quantity,
          tax: normalizeTaxRate(byId.get(p.productId)?.taxRate),
        }))
      );
      const rates = Object.keys(split);
      return {
        name: i.name,
        detail: i.detail ?? null,
        quantity: i.quantity,
        unitPrice: i.price,
        total,
        tax: rates.length === 1 ? (rates[0] as InvoiceLine["tax"]) : "MIXTO",
        split,
      };
    }
    return {
      name: i.name,
      detail: i.detail ?? null,
      quantity: i.quantity,
      unitPrice: i.price,
      total,
      tax: normalizeTaxRate(byId.get(i.productId)?.taxRate),
    };
  });
}

type Customer = { name?: string | null; rtn?: string | null };

/**
 * Emite la factura de un pago con el siguiente correlativo del rango vigente.
 * El número se toma con bloqueo de fila, así dos cajas nunca reciben el mismo.
 * Devuelve null (con el motivo) si la facturación está apagada o no hay rango disponible.
 */
export async function issueInvoice(input: {
  paymentId: number;
  orderId: number;
  method: string;
  lines: InvoiceLine[];
  customer?: Customer;
  replaces?: number; // id de la factura anulada a la que reemplaza
}): Promise<{ invoice: InvoiceView | null; warning?: string }> {
  const settings = await getFiscalSettings();
  if (!settings.enabled) return { invoice: null };

  const totals = computeTotals(input.lines);
  const customerRtn = input.customer?.rtn || null;
  const customerName = (input.customer?.name || "").trim() || "Consumidor final";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "InvoiceRange"
        WHERE active = true AND "nextNumber" <= "rangeTo" AND deadline >= ${startOfToday()}
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE`;
      if (rows.length === 0) return null;
      const range = await tx.invoiceRange.update({
        where: { id: rows[0].id },
        data: { nextNumber: { increment: 1 } },
      });
      const sequence = range.nextNumber - 1;
      const issuer: InvoiceIssuer = {
        legalName: settings.legalName,
        tradeName: settings.tradeName,
        rtn: settings.rtn,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        footer: settings.footer,
        cai: range.cai,
        rangeFrom: formatInvoiceNumber(range.prefix, range.rangeFrom),
        rangeTo: formatInvoiceNumber(range.prefix, range.rangeTo),
        deadline: range.deadline.toISOString(),
      };
      const invoice = await tx.invoice.create({
        data: {
          number: formatInvoiceNumber(range.prefix, sequence),
          sequence,
          rangeId: range.id,
          paymentId: input.paymentId,
          orderId: input.orderId,
          customerName,
          customerRtn,
          exempt: totals.exempt,
          exonerated: totals.exonerated,
          taxable15: totals.taxable15,
          taxable18: totals.taxable18,
          isv15: totals.isv15,
          isv18: totals.isv18,
          discount: totals.discount,
          total: totals.total,
          method: input.method,
          lines: input.lines as unknown as Prisma.InputJsonValue,
          issuer: issuer as unknown as Prisma.InputJsonValue,
        },
      });
      if (input.replaces) {
        await tx.invoice.update({ where: { id: input.replaces }, data: { replacedById: invoice.id } });
      }
      return invoice;
    });
    if (!created) {
      return { invoice: null, warning: "No hay un rango CAI vigente. Se registró el pago, pero no se emitió factura." };
    }
    return { invoice: toInvoiceView(created) };
  } catch (error) {
    console.error("No se pudo emitir la factura", error);
    return { invoice: null, warning: "No se pudo emitir la factura. Revisa la configuración de facturación." };
  }
}

export function toInvoiceView(i: {
  id: number;
  number: string;
  customerName: string;
  customerRtn: string | null;
  exempt: number;
  exonerated: number;
  taxable15: number;
  taxable18: number;
  isv15: number;
  isv18: number;
  discount: number;
  total: number;
  method: string;
  lines: Prisma.JsonValue;
  issuer: Prisma.JsonValue;
  status: string;
  createdAt: Date;
}): InvoiceView {
  return {
    id: i.id,
    number: i.number,
    customerName: i.customerName,
    customerRtn: i.customerRtn,
    exempt: i.exempt,
    exonerated: i.exonerated,
    taxable15: i.taxable15,
    taxable18: i.taxable18,
    isv15: i.isv15,
    isv18: i.isv18,
    discount: i.discount,
    subtotal: Math.round((i.taxable15 + i.taxable18 + i.exempt + i.exonerated) * 100) / 100,
    total: i.total,
    method: i.method,
    lines: i.lines as unknown as InvoiceLine[],
    issuer: i.issuer as unknown as InvoiceIssuer,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
  };
}
