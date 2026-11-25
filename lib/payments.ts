// Pago mixto (parte en efectivo y parte con tarjeta): cómo se reparte cada cobro entre efectivo y tarjeta.

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PaymentLike {
  amount: number; // consumo cobrado (lo facturado)
  tip: number; // propina voluntaria (aparte)
  method: string; // CASH, CARD o MIXED
  cardAmount: number; // MIXED: lo que se pasó con tarjeta (consumo + propina)
}

/**
 * Reparte venta y propina entre efectivo y tarjeta. En un pago mixto la propina se reparte en la
 * misma proporción que el total pagado.
 */
export function paymentSplit(p: PaymentLike) {
  const paid = p.amount + p.tip;
  if (p.method === "CARD") return { cash: 0, card: p.amount, tipCash: 0, tipCard: p.tip };
  if (p.method !== "MIXED" || paid <= 0) return { cash: p.amount, card: 0, tipCash: p.tip, tipCard: 0 };
  const cardPaid = Math.min(Math.max(p.cardAmount, 0), paid);
  const tipCard = round2((p.tip * cardPaid) / paid);
  const card = round2(cardPaid - tipCard);
  return { cash: round2(p.amount - card), card, tipCash: round2(p.tip - tipCard), tipCard };
}

/** "Efectivo L 300.00 · Tarjeta L 500.00" para tickets y listados. */
export function mixedDetail(p: { amount: number; tip?: number; cardAmount?: number }, money: (n: number) => string) {
  const paid = p.amount + (p.tip ?? 0);
  const card = Math.min(p.cardAmount ?? 0, paid);
  return `Efectivo ${money(round2(paid - card))} · Tarjeta ${money(card)}`;
}
