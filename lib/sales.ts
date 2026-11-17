import prisma from "@/lib/prisma";
import type { InvoiceLine, TaxRate } from "@/lib/fiscal";
import type { SoldItem } from "@/lib/invoicing";

const RATE: Record<TaxRate, number> = { "15": 0.15, "18": 0.18, EXENTO: 0 };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Costo de una unidad de cada producto según su receta (insumo × costo promedio). */
export async function unitCosts(productIds: number[]) {
  const recipe = await prisma.recipeItem.findMany({
    where: { productId: { in: productIds } },
    include: { ingredient: { select: { cost: true } } },
  });
  const cost = new Map<number, number>();
  for (const r of recipe) cost.set(r.productId, (cost.get(r.productId) ?? 0) + r.quantity * r.ingredient.cost);
  return cost;
}

/** Monto sin ISV de una línea (los combos con tasas mezcladas usan su reparto). */
function netOf(line: InvoiceLine) {
  if (line.split) {
    return Object.entries(line.split).reduce((s, [rate, amount]) => s + (amount ?? 0) / (1 + RATE[rate as TaxRate]), 0);
  }
  return line.tax === "MIXTO" ? line.total / 1.15 : line.total / (1 + RATE[line.tax]);
}

/**
 * Registra lo cobrado en un pago para los reportes: ventas, ISV, costo y mesero.
 * Nunca bloquea el cobro; si falla solo se registra en el log.
 */
export async function recordSales(input: {
  paymentId: number;
  orderId: number;
  items: SoldItem[];
  lines: InvoiceLine[]; // mismas posiciones que items (de buildInvoiceLines)
}) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { table: true, user: true },
    });
    const ids = new Set<number>();
    for (const i of input.items) {
      ids.add(i.productId);
      i.parts?.forEach((p) => ids.add(p.productId));
    }
    const [costs, products] = await Promise.all([
      unitCosts([...ids]),
      prisma.product.findMany({ where: { id: { in: [...ids] } }, include: { category: true } }),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));

    await prisma.saleLine.createMany({
      data: input.items.map((item, idx) => {
        const line = input.lines[idx];
        const product = byId.get(item.productId);
        const unitCost =
          (costs.get(item.productId) ?? 0) +
          (item.parts ?? []).reduce((s, p) => s + (costs.get(p.productId) ?? 0) * p.quantity, 0);
        const net = round2(netOf(line));
        return {
          paymentId: input.paymentId,
          orderId: input.orderId,
          productId: item.productId,
          name: item.name,
          categoryName: product?.category.name ?? "Sin categoría",
          isCombo: product?.isCombo ?? false,
          quantity: item.quantity,
          unitPrice: item.price,
          total: line.total,
          net,
          tax: round2(line.total - net),
          cost: round2(unitCost * item.quantity),
          waiterName: order?.user?.name ?? null,
          channel: order?.table.number === 0 ? "LLEVAR" : "MESA",
        };
      }),
    });
  } catch (error) {
    console.error("No se pudo registrar la venta para reportes", input.paymentId, error);
  }
}
