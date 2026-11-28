// Registrar un pago de la suscripción (lo usan el panel de la plataforma y el aviso de pago con tarjeta).
// No depende de la sesión: quien llama ya validó quién paga y cuánto.
import type { Prisma } from "@prisma/client";
import { nextPeriod } from "@/lib/billing";

export interface ApplyPaymentInput {
  restaurantId: number;
  months: number;
  amount: number;
  method: string; // TRANSFER, CASH, CARD, OTHER
  reference: string;
  note?: string;
  recordedBy: string;
}

/**
 * Dentro de una transacción: bloquea la fila del restaurante, calcula el periodo pagado,
 * guarda el pago y alarga `paidUntil`.
 *
 * Si estaba bloqueado por vencimiento, se desbloquea solo (el vencimiento se calcula con `paidUntil`).
 * Una suspensión (status SUSPENDED) siempre la pone a mano el equipo de la plataforma, nunca la falta
 * de pago, así que un pago NO la quita: se reactiva aparte.
 */
export async function applySubscriptionPayment(tx: Prisma.TransactionClient, input: ApplyPaymentInput) {
  // Bloquea la fila para que dos pagos registrados a la vez no calculen el mismo periodo
  await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id = ${input.restaurantId} FOR UPDATE`;
  const r = await tx.restaurant.findUniqueOrThrow({ where: { id: input.restaurantId } });
  const period = nextPeriod(r.paidUntil, input.months);
  const payment = await tx.subscriptionPayment.create({
    data: {
      restaurantId: input.restaurantId,
      amount: input.amount,
      months: input.months,
      method: input.method,
      reference: input.reference,
      note: input.note ?? "",
      periodFrom: period.from,
      periodTo: period.to,
      recordedBy: input.recordedBy,
    },
  });
  await tx.restaurant.update({ where: { id: input.restaurantId }, data: { paidUntil: period.to } });
  return { payment, period };
}
