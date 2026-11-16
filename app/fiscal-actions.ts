"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";
import { normalizeCai, normalizeRtn, normalizeTaxRate, parseInvoiceNumber, type InvoiceLine } from "@/lib/fiscal";
import { issueInvoice, toInvoiceView } from "@/lib/invoicing";

type Result = { success: boolean; error?: string };

async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    throw new Error("No autorizado");
  }
}

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/mesa", "layout");
  revalidatePath("/llevar", "layout");
}

const clean = (v?: string | null, max = 150) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export interface FiscalInput {
  enabled: boolean;
  legalName: string;
  tradeName: string;
  rtn: string;
  address: string;
  phone: string;
  email: string;
  footer: string;
}

export async function saveFiscalSettings(input: FiscalInput): Promise<Result> {
  await requireAdmin();
  const rtn = normalizeRtn(input.rtn);
  if (input.rtn.trim() && !rtn) return { success: false, error: "El RTN debe tener 14 dígitos" };
  if (input.enabled && (!rtn || !clean(input.legalName))) {
    return { success: false, error: "Para activar la facturación necesitas el RTN y la razón social" };
  }
  const data = {
    enabled: input.enabled,
    legalName: clean(input.legalName),
    tradeName: clean(input.tradeName),
    rtn: rtn ?? "",
    address: clean(input.address, 250),
    phone: clean(input.phone, 40),
    email: clean(input.email, 100),
    footer: clean(input.footer, 120),
  };
  await prisma.fiscalSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  refresh();
  return { success: true };
}

export interface RangeInput {
  cai: string;
  from: string; // 000-001-01-00000001
  to: string; // 000-001-01-00000500
  deadline: string; // YYYY-MM-DD
  next?: string; // opcional: si ya se usaron números de este rango en otro sistema
}

export async function createInvoiceRange(input: RangeInput): Promise<Result> {
  await requireAdmin();
  const cai = normalizeCai(input.cai);
  if (!cai) return { success: false, error: "El CAI debe tener 32 caracteres (XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX)" };
  const from = parseInvoiceNumber(input.from);
  const to = parseInvoiceNumber(input.to);
  if (!from || !to) return { success: false, error: "El rango debe tener el formato 000-001-01-00000001" };
  if (from.prefix !== to.prefix) return { success: false, error: "El inicio y el final del rango deben tener el mismo prefijo" };
  if (to.number < from.number) return { success: false, error: "El final del rango debe ser mayor que el inicio" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) return { success: false, error: "Indica la fecha límite de emisión" };
  const deadline = new Date(`${input.deadline}T23:59:59`);

  let next = from.number;
  if (input.next?.trim()) {
    const n = parseInvoiceNumber(input.next) ?? { prefix: from.prefix, number: parseInt(input.next, 10) };
    if (!Number.isFinite(n.number) || n.number < from.number || n.number > to.number + 1) {
      return { success: false, error: "El siguiente número debe estar dentro del rango" };
    }
    next = n.number;
  }

  // Que no se cruce con otro rango del mismo prefijo
  const overlap = await prisma.invoiceRange.findFirst({
    where: { prefix: from.prefix, rangeFrom: { lte: to.number }, rangeTo: { gte: from.number } },
  });
  if (overlap) return { success: false, error: "Ese rango se cruza con otro ya registrado" };

  await prisma.invoiceRange.create({
    data: { cai, prefix: from.prefix, rangeFrom: from.number, rangeTo: to.number, nextNumber: next, deadline },
  });
  refresh();
  return { success: true };
}

export async function setRangeActive(id: number, active: boolean) {
  await requireAdmin();
  await prisma.invoiceRange.update({ where: { id }, data: { active } });
  refresh();
}

export async function deleteInvoiceRange(id: number): Promise<Result> {
  await requireAdmin();
  const used = await prisma.invoice.count({ where: { rangeId: id } });
  if (used > 0) return { success: false, error: "Ya tiene facturas emitidas; solo se puede desactivar." };
  await prisma.invoiceRange.delete({ where: { id } });
  refresh();
  return { success: true };
}

/** Anula una factura (el número queda usado y la factura se conserva como ANULADA). */
export async function voidInvoice(id: number, reason: string): Promise<Result> {
  await requireAdmin();
  const r = clean(reason, 200);
  if (!r) return { success: false, error: "Indica el motivo de la anulación" };
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return { success: false, error: "La factura no existe" };
  if (inv.status === "VOID") return { success: false, error: "Ya estaba anulada" };
  await prisma.invoice.update({ where: { id }, data: { status: "VOID", voidReason: r, voidedAt: new Date() } });
  refresh();
  return { success: true };
}

/**
 * Corrige los datos del cliente (ej. pidió factura con RTN después de pagar):
 * anula la factura y emite una nueva con el siguiente correlativo y los mismos productos.
 */
export async function reissueInvoice(id: number, customer: { rtn?: string; name?: string }) {
  await requireAdmin();
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) return { success: false as const, error: "La factura no existe" };
  if (inv.status === "VOID") return { success: false as const, error: "La factura ya está anulada" };
  const rtn = customer.rtn?.trim() ? normalizeRtn(customer.rtn) : null;
  if (customer.rtn?.trim() && !rtn) return { success: false as const, error: "El RTN debe tener 14 dígitos" };
  if (rtn && !clean(customer.name)) return { success: false as const, error: "Escribe el nombre o razón social" };

  await prisma.invoice.update({
    where: { id },
    data: { status: "VOID", voidReason: "Reemitida con datos del cliente corregidos", voidedAt: new Date() },
  });
  const res = await issueInvoice({
    paymentId: inv.paymentId,
    orderId: inv.orderId,
    method: inv.method,
    lines: inv.lines as unknown as InvoiceLine[],
    customer: { rtn, name: clean(customer.name) },
    replaces: id,
  });
  if (!res.invoice) {
    // Sin rango disponible: se revierte la anulación para no dejar la venta sin factura
    await prisma.invoice.update({ where: { id }, data: { status: "ISSUED", voidReason: null, voidedAt: null } });
    return { success: false as const, error: res.warning ?? "No se pudo emitir la nueva factura" };
  }
  refresh();
  return { success: true as const, invoice: res.invoice };
}

export async function getInvoiceForPrint(id: number) {
  await requireAdmin();
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { payment: { include: { order: { include: { table: true } } } } } });
  if (!inv) return null;
  const t = inv.payment.order.table.number;
  return { ...toInvoiceView(inv), reference: t === 0 ? `Para llevar · Pedido #${inv.orderId}` : `Mesa ${t}` };
}

/** Aplica una tasa de ISV a todos los productos de una categoría. */
export async function setCategoryTaxRate(categoryId: number, rate: string) {
  await requireAdmin();
  await prisma.product.updateMany({ where: { categoryId, isCombo: false }, data: { taxRate: normalizeTaxRate(rate) } });
  revalidatePath("/admin/productos");
}
