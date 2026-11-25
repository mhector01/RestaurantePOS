// Formas de pago de un cobro: efectivo, tarjeta, transferencia o mixto (parte en efectivo y parte
// con tarjeta o transferencia), y cómo se reparte cada cobro entre ellas.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PaymentLike {
  amount: number; // consumo cobrado (lo facturado)
  tip: number; // propina voluntaria (aparte)
  method: string; // CASH, CARD, TRANSFER o MIXED
  cardAmount: number; // MIXED: lo que no fue en efectivo (consumo + propina)
  mixedWith?: string | null; // MIXED: CARD o TRANSFER
}

export interface Split {
  cash: number;
  card: number;
  transfer: number;
  tipCash: number;
  tipCard: number;
  tipTransfer: number;
}

const ZERO: Split = { cash: 0, card: 0, transfer: 0, tipCash: 0, tipCard: 0, tipTransfer: 0 };

/**
 * Reparte venta y propina entre efectivo, tarjeta y transferencia. En un pago mixto la propina se
 * reparte en la misma proporción que el total pagado.
 */
export function paymentSplit(p: PaymentLike): Split {
  const paid = p.amount + p.tip;
  if (p.method === "CARD") return { ...ZERO, card: p.amount, tipCard: p.tip };
  if (p.method === "TRANSFER") return { ...ZERO, transfer: p.amount, tipTransfer: p.tip };
  if (p.method !== "MIXED" || paid <= 0) return { ...ZERO, cash: p.amount, tipCash: p.tip };
  const otherPaid = Math.min(Math.max(p.cardAmount, 0), paid);
  const tipOther = round2((p.tip * otherPaid) / paid);
  const other = round2(otherPaid - tipOther);
  const base = { ...ZERO, cash: round2(p.amount - other), tipCash: round2(p.tip - tipOther) };
  return p.mixedWith === "TRANSFER" ? { ...base, transfer: other, tipTransfer: tipOther } : { ...base, card: other, tipCard: tipOther };
}

/** "Efectivo L 300.00 · Tarjeta L 500.00" para tickets y listados. */
export function mixedDetail(
  p: { amount: number; tip?: number; cardAmount?: number; mixedWith?: string | null },
  money: (n: number) => string
) {
  const paid = p.amount + (p.tip ?? 0);
  const other = Math.min(p.cardAmount ?? 0, paid);
  return `Efectivo ${money(round2(paid - other))} · ${p.mixedWith === "TRANSFER" ? "Transferencia" : "Tarjeta"} ${money(other)}`;
}

/** Texto de la forma de pago para comprobantes y listados. */
export function paymentText(
  p: { method: string; amount: number; tip?: number; cardAmount?: number; mixedWith?: string | null; reference?: string | null },
  money: (n: number) => string,
  label: Record<string, string>
) {
  const base = p.method === "MIXED" ? mixedDetail(p, money) : (label[p.method] ?? p.method);
  return p.reference ? `${base} · Ref. ${p.reference}` : base;
}
