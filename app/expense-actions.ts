"use server";

// Gastos: registrar, editar, anular, marcar pagados y adjuntar la foto de la factura.
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { currentRestaurantId } from "@/lib/tenant";
import { normalizeRtn } from "@/lib/fiscal";
import { EXPENSE_CATEGORY_LABEL, EXPENSE_METHOD_LABEL, expenseAmounts, type TaxMode } from "@/lib/expenses";
import { UploadError, deleteImage, saveImage } from "@/lib/uploads";

type Result = { success: boolean; error?: string; id?: number };
const clean = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function refresh() {
  revalidatePath("/admin/gastos");
  revalidatePath("/admin/reportes", "layout");
}

/** "2026-11-23" → mediodía local, para que no se corra de día por la zona horaria. */
function parseDay(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface ExpenseInput {
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  supplierId: number | null;
  supplierName: string;
  supplierRtn: string;
  hasInvoice: boolean;
  invoiceNumber: string;
  cai: string;
  taxMode: TaxMode;
  total: number;
  isv: number | null;
  taxable15: number;
  taxable18: number;
  exempt: number;
  method: string;
  notes: string;
}

async function build(input: ExpenseInput) {
  const date = parseDay(input.date);
  if (!date) return { error: "Fecha no válida" };
  if (date.getTime() > Date.now() + 86_400_000) return { error: "La fecha no puede ser futura" };
  if (!EXPENSE_CATEGORY_LABEL[input.category]) return { error: "Elige una categoría" };
  if (!EXPENSE_METHOD_LABEL[input.method]) return { error: "Elige cómo se pagó" };
  const description = clean(input.description, 200);
  if (description.length < 2) return { error: "Describe el gasto (ej. Alquiler de noviembre)" };

  // Sin factura no hay crédito fiscal: todo cuenta como importe sin ISV
  const amounts = input.hasInvoice
    ? expenseAmounts({ mode: input.taxMode, total: input.total, isv: input.isv, taxable15: input.taxable15, taxable18: input.taxable18, exempt: input.exempt })
    : expenseAmounts({ mode: "EXEMPT", total: input.total });
  if ("error" in amounts) return { error: amounts.error };

  let supplierName = clean(input.supplierName);
  let supplierRtn = input.supplierRtn.replace(/\D/g, "");
  let supplierId: number | null = null;
  if (input.supplierId) {
    const s = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!s) return { error: "Ese proveedor no existe" };
    supplierId = s.id;
    // Copia del nombre y RTN: el gasto conserva sus datos aunque luego se borre el proveedor
    supplierName = s.name;
    supplierRtn = (s.taxId ?? "").replace(/\D/g, "") || supplierRtn;
  }
  if (supplierRtn && !normalizeRtn(supplierRtn)) return { error: "El RTN del proveedor debe tener 14 dígitos" };
  const invoiceNumber = clean(input.invoiceNumber, 40);
  if (input.hasInvoice && !invoiceNumber) return { error: "Escribe el número de la factura del proveedor" };

  const credit = input.method === "CREDIT";
  return {
    data: {
      date,
      category: input.category,
      description,
      supplierId,
      supplierName,
      supplierRtn,
      hasInvoice: !!input.hasInvoice,
      invoiceNumber: input.hasInvoice ? invoiceNumber : clean(input.invoiceNumber, 40),
      cai: input.hasInvoice ? clean(input.cai, 40).toUpperCase() : "",
      ...amounts,
      method: input.method,
      paid: !credit,
      paidAt: credit ? null : new Date(),
      notes: clean(input.notes, 500),
    },
  };
}

export async function saveExpense(id: number | null, input: ExpenseInput): Promise<Result> {
  const me = await requireAdmin();
  const built = await build(input);
  if ("error" in built) return { success: false, error: built.error };
  if (id) {
    const current = await prisma.expense.findUnique({ where: { id } });
    if (!current) return { success: false, error: "El gasto no existe" };
    if (current.status === "VOID") return { success: false, error: "Un gasto anulado no se puede editar" };
    if (current.registerClosed && (current.method !== input.method || current.total !== built.data.total)) {
      return { success: false, error: "Ya entró en un cierre de caja: no se puede cambiar el monto ni la forma de pago" };
    }
    await prisma.expense.update({
      where: { id },
      // Si ya estaba pagado se conserva la fecha de pago
      data: { ...built.data, paid: current.paid && input.method !== "CREDIT" ? true : built.data.paid, paidAt: current.paidAt ?? built.data.paidAt },
    });
    refresh();
    return { success: true, id };
  }
  const created = await prisma.expense.create({ data: { ...built.data, createdBy: me.name } });
  refresh();
  return { success: true, id: created.id };
}

export async function setExpensePaid(id: number, method: string): Promise<Result> {
  await requireAdmin();
  if (!EXPENSE_METHOD_LABEL[method] || method === "CREDIT") return { success: false, error: "Elige cómo se pagó" };
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e || e.status === "VOID") return { success: false, error: "El gasto no existe" };
  await prisma.expense.update({ where: { id }, data: { paid: true, paidAt: new Date(), method } });
  refresh();
  return { success: true };
}

export async function voidExpense(id: number, reason: string): Promise<Result> {
  await requireAdmin();
  const why = clean(reason, 200);
  if (why.length < 3) return { success: false, error: "Escribe el motivo de la anulación" };
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) return { success: false, error: "El gasto no existe" };
  await prisma.expense.update({ where: { id }, data: { status: "VOID", voidReason: why } });
  refresh();
  return { success: true };
}

/** Foto de la factura o recibo (ya reducida por el navegador). */
export async function setExpenseAttachment(id: number, form: FormData): Promise<Result> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof Blob)) return { success: false, error: "No llegó la foto" };
  const e = await prisma.expense.findUnique({ where: { id } });
  if (!e) return { success: false, error: "El gasto no existe" };
  const rid = await currentRestaurantId();
  try {
    const name = await saveImage(rid, Buffer.from(await file.arrayBuffer()));
    await prisma.expense.update({ where: { id }, data: { attachment: name } });
    await deleteImage(rid, e.attachment);
  } catch (err) {
    if (err instanceof UploadError) return { success: false, error: err.message };
    throw err;
  }
  refresh();
  return { success: true };
}
