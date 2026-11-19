// Descuentos al cobrar. Este archivo lo usan el servidor (para cobrar) y la pantalla de cobro
// (para mostrar el monto antes de confirmar), así los dos calculan exactamente lo mismo.

export type DiscountKind = "PERCENT" | "AMOUNT" | "COURTESY" | "SENIOR";
export type DiscountScope = "ORDER" | "ITEM";

export interface DiscountInput {
  kind: DiscountKind;
  scope: DiscountScope;
  /** Con scope ITEM: id de la línea de la cuenta (OrderItem) a la que se aplica. */
  itemId?: number;
  /** % (PERCENT) o monto en dinero (AMOUNT). */
  value?: number;
  reason?: string;
  beneficiaryName?: string; // tercera edad / discapacidad
  beneficiaryId?: string; // número de identidad
  managerPin?: string; // PIN del encargado cuando hace falta autorizar
}

export interface DiscountRules {
  /** Hasta este % el mesero aplica descuentos sin autorización. */
  limit: number;
  /** % de ley para tercera edad / discapacidad. */
  seniorPercent: number;
}

export const DISCOUNT_KIND_LABEL: Record<DiscountKind, string> = {
  PERCENT: "Descuento",
  AMOUNT: "Descuento",
  COURTESY: "Cortesía",
  SENIOR: "Tercera edad / discapacidad",
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Número de identidad hondureño: 13 dígitos (se acepta con guiones). */
export function normalizeDni(value: string) {
  const d = (value ?? "").replace(/\D/g, "");
  return d.length === 13 ? d : null;
}
export const formatDni = (d: string) => (d.length === 13 ? `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}` : d);

export interface Allocation {
  /** Descuento (con ISV) de cada línea cobrada, en el mismo orden. */
  perLine: number[];
  total: number;
  /** % que representa sobre lo que se le aplicó (para saber si pide autorización). */
  effectivePercent: number;
  /** % aplicado (PERCENT y SENIOR). */
  percent: number | null;
  error?: string;
}

/**
 * Reparte el descuento entre las líneas que se están cobrando.
 * `lines`: lo que se cobra, con la línea de la cuenta (key) y su total con ISV.
 */
export function allocateDiscount(lines: { key: number; total: number }[], d: DiscountInput, rules: DiscountRules): Allocation {
  const empty = (error: string): Allocation => ({ perLine: lines.map(() => 0), total: 0, effectivePercent: 0, percent: null, error });
  const targets = lines.map((l) => (d.scope === "ITEM" ? l.key === d.itemId : true));
  const base = round2(lines.reduce((s, l, i) => s + (targets[i] ? l.total : 0), 0));
  if (d.scope === "ITEM" && !targets.some(Boolean)) return empty("Elige el producto al que se le aplica el descuento");
  if (base <= 0) return empty("No hay nada que descontar");

  let percent: number | null = null;
  let perLine: number[];
  if (d.kind === "AMOUNT") {
    const amount = round2(Number(d.value));
    if (!(amount > 0)) return empty("Escribe el monto del descuento");
    const capped = Math.min(amount, base);
    // Reparto proporcional; la última línea se lleva el redondeo
    const idx = lines.map((_, i) => i).filter((i) => targets[i]);
    let assigned = 0;
    perLine = lines.map(() => 0);
    idx.forEach((i, n) => {
      const share = n === idx.length - 1 ? round2(capped - assigned) : round2((capped * lines[i].total) / base);
      perLine[i] = share;
      assigned = round2(assigned + share);
    });
  } else {
    const p = d.kind === "COURTESY" ? 100 : d.kind === "SENIOR" ? rules.seniorPercent : Number(d.value);
    if (!(p > 0 && p <= 100)) return empty("El porcentaje debe estar entre 1 y 100");
    percent = d.kind === "COURTESY" ? null : p;
    perLine = lines.map((l, i) => (targets[i] ? round2((l.total * p) / 100) : 0));
  }
  const total = round2(perLine.reduce((s, x) => s + x, 0));
  return { perLine, total, effectivePercent: base > 0 ? (total / base) * 100 : 0, percent };
}

/** ¿Este descuento necesita el PIN de un encargado? */
export function needsAuthorization(kind: DiscountKind, effectivePercent: number, rules: DiscountRules) {
  if (kind === "COURTESY") return true;
  if (kind === "SENIOR") return false; // es un derecho de ley: solo pide los datos del beneficiario
  return effectivePercent > rules.limit + 1e-9;
}

/** Texto que sale en el ticket y la factura: "Descuento 10% · Promoción", "Cortesía · Cumpleaños"… */
export function discountLabel(d: DiscountInput, alloc: Allocation, itemName?: string) {
  const base =
    d.kind === "COURTESY"
      ? "Cortesía"
      : d.kind === "SENIOR"
        ? `Tercera edad ${alloc.percent ?? ""}%`
        : alloc.percent !== null
          ? `Descuento ${alloc.percent}%`
          : "Descuento";
  const extra = [itemName, d.kind === "SENIOR" ? d.beneficiaryName?.trim() : d.reason?.trim()].filter(Boolean).join(" · ");
  return extra ? `${base} · ${extra}`.slice(0, 120) : base;
}
