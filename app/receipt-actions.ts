"use server";

// Reimpresión de cualquier cobro: con factura (copia de la factura) o sin ella (recibo).
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { toInvoiceView } from "@/lib/invoicing";
import type { TicketPayment } from "@/components/TicketPrint";

/**
 * Arma el comprobante de un cobro tal como se emitió: los productos salen del registro de ventas
 * (lo que se cobró en ese pago), con su descuento, propina y la factura si la tuvo.
 */
export async function getPaymentReprint(paymentId: number): Promise<TicketPayment | null> {
  await requireAdmin();
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: { include: { table: true } },
      saleLines: { orderBy: { id: "asc" } },
      discounts: { orderBy: { id: "asc" } },
      // La factura vigente; si se anuló y no se reemitió, la anulada (sale marcada ANULADA)
      invoices: { orderBy: [{ status: "asc" }, { id: "desc" }] },
    },
  });
  if (!p) return null;
  const invoice = p.invoices.find((i) => i.status === "ISSUED") ?? p.invoices[0] ?? null;
  const subtotal = Math.round(p.saleLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;
  const d = p.discounts[0];
  return {
    id: p.id,
    amount: p.amount,
    method: p.method,
    cardAmount: p.cardAmount,
    mixedWith: p.mixedWith,
    reference: p.reference,
    createdAt: p.createdAt,
    tip: p.tip,
    order: {
      id: p.order.id,
      name: p.order.name,
      table: { number: p.order.table.number },
      items: p.saleLines.map((l) => ({
        id: l.id,
        quantity: l.quantity,
        price: l.unitPrice,
        product: { name: l.name },
        detail: null,
      })),
    },
    invoice: invoice ? toInvoiceView(invoice) : null,
    discountInfo: d ? { label: d.label, amount: p.discount, subtotal } : null,
  };
}
