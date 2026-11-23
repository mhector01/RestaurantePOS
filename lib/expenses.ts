// Gastos: categorías, formas de pago y desglose del ISV (sirve en servidor y navegador).

export const EXPENSE_CATEGORIES = [
  { value: "RENT", label: "Alquiler" },
  { value: "ELECTRICITY", label: "Energía eléctrica" },
  { value: "WATER", label: "Agua" },
  { value: "PHONE_INTERNET", label: "Teléfono e internet" },
  { value: "GAS", label: "Gas" },
  { value: "PAYROLL", label: "Sueldos y salarios" },
  { value: "SOCIAL", label: "IHSS, RAP y prestaciones" },
  { value: "MAINTENANCE", label: "Mantenimiento y reparaciones" },
  { value: "CLEANING", label: "Limpieza y desechables" },
  { value: "MARKETING", label: "Publicidad" },
  { value: "TRANSPORT", label: "Transporte y combustible" },
  { value: "PROFESSIONAL", label: "Honorarios (contador, abogado…)" },
  { value: "TAXES_FEES", label: "Impuestos, permisos y tasas" },
  { value: "BANK", label: "Comisiones bancarias y POS" },
  { value: "EQUIPMENT", label: "Equipo y mobiliario" },
  { value: "OTHER", label: "Otros" },
] as const;

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export const EXPENSE_METHODS = [
  { value: "REGISTER", label: "Efectivo de la caja", hint: "Se descuenta en el cierre de caja del turno" },
  { value: "CASH", label: "Efectivo (otro)", hint: "No sale de la caja del turno" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
  { value: "CHECK", label: "Cheque" },
  { value: "CREDIT", label: "A crédito (por pagar)" },
] as const;

export const EXPENSE_METHOD_LABEL: Record<string, string> = Object.fromEntries(EXPENSE_METHODS.map((m) => [m.value, m.label]));

/** Cómo viene el ISV en el documento. */
export type TaxMode = "15" | "18" | "EXEMPT" | "MIXED";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ExpenseAmounts {
  exempt: number;
  taxable15: number;
  taxable18: number;
  isv15: number;
  isv18: number;
  total: number;
}

/**
 * Desglosa el gasto como en el libro de compras.
 * - 15 / 18: `total` incluye el ISV; se separan base e impuesto (el ISV se puede corregir a mano
 *   para que cuadre exacto con la factura, por redondeos del proveedor).
 * - EXEMPT: todo es importe exento / sin ISV.
 * - MIXED: se escriben las bases gravadas y el exento; el ISV se calcula.
 */
export function expenseAmounts(input: {
  mode: TaxMode;
  total?: number;
  isv?: number | null; // ISV corregido a mano (modo 15 / 18)
  taxable15?: number;
  taxable18?: number;
  exempt?: number;
}): ExpenseAmounts | { error: string } {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  if (input.mode === "MIXED") {
    const t15 = round2(n(input.taxable15));
    const t18 = round2(n(input.taxable18));
    const ex = round2(n(input.exempt));
    if (t15 < 0 || t18 < 0 || ex < 0) return { error: "Los importes no pueden ser negativos" };
    const isv15 = round2(t15 * 0.15);
    const isv18 = round2(t18 * 0.18);
    const total = round2(t15 + t18 + ex + isv15 + isv18);
    if (total <= 0) return { error: "Escribe los importes de la factura" };
    return { exempt: ex, taxable15: t15, taxable18: t18, isv15, isv18, total };
  }
  const total = round2(n(input.total));
  if (!(total > 0)) return { error: "Escribe el total del gasto" };
  if (input.mode === "EXEMPT") return { exempt: total, taxable15: 0, taxable18: 0, isv15: 0, isv18: 0, total };
  const rate = input.mode === "18" ? 0.18 : 0.15;
  const auto = round2(total - total / (1 + rate));
  const isv = input.isv === null || input.isv === undefined || Number.isNaN(Number(input.isv)) ? auto : round2(n(input.isv));
  if (isv < 0 || isv >= total) return { error: "El ISV no cuadra con el total" };
  const base = round2(total - isv);
  return input.mode === "18"
    ? { exempt: 0, taxable15: 0, taxable18: base, isv15: 0, isv18: isv, total }
    : { exempt: 0, taxable15: base, taxable18: 0, isv15: isv, isv18: 0, total };
}

/** Gasto sin ISV recuperable: para la utilidad cuenta el total; con factura, el ISV es crédito fiscal. */
export const expenseCost = (e: { hasInvoice: boolean; total: number; isv15: number; isv18: number }) =>
  e.hasInvoice ? round2(e.total - e.isv15 - e.isv18) : e.total;
