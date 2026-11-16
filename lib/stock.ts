import prisma from "@/lib/prisma";

/**
 * Descuenta del inventario los insumos de lo que se acaba de cobrar, según la receta de cada producto.
 * Los productos sin receta no se controlan. Nunca bloquea un cobro: si algo falla, solo se registra en el log.
 * El stock puede quedar negativo; eso indica que hace falta un conteo o registrar una compra.
 */
export async function consumeForSale(orderId: number, lines: { productId: number; quantity: number }[], note: string) {
  try {
    const productIds = [...new Set(lines.filter((l) => l.quantity > 0).map((l) => l.productId))];
    if (productIds.length === 0) return;
    const recipe = await prisma.recipeItem.findMany({ where: { productId: { in: productIds } } });
    if (recipe.length === 0) return;

    const need = new Map<number, number>();
    for (const line of lines) {
      for (const r of recipe) {
        if (r.productId !== line.productId) continue;
        need.set(r.ingredientId, (need.get(r.ingredientId) ?? 0) + r.quantity * line.quantity);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [ingredientId, qty] of need) {
        if (qty <= 0) continue;
        const ing = await tx.ingredient.update({
          where: { id: ingredientId },
          data: { stock: { decrement: qty } },
        });
        await tx.stockMovement.create({
          data: {
            ingredientId,
            type: "SALE",
            quantity: -qty,
            stockAfter: ing.stock,
            unitCost: ing.cost,
            orderId,
            note,
          },
        });
      }
    });
  } catch (error) {
    console.error("No se pudo descontar inventario de la venta", orderId, error);
  }
}

/** Productos que no se pueden preparar porque algún insumo de su receta está agotado. */
export async function outOfStockProductIds() {
  const rows = await prisma.recipeItem.findMany({
    where: { ingredient: { stock: { lte: 0 }, active: true } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const out = new Set(rows.map((r) => r.productId));
  if (out.size === 0) return [];

  // Un combo está sin stock si alguna de sus partes no tiene ninguna opción disponible
  const combos = await prisma.product.findMany({
    where: { isCombo: true },
    select: { id: true, comboSlots: { select: { options: { select: { productId: true } } } } },
  });
  for (const c of combos) {
    if (c.comboSlots.some((s) => s.options.length > 0 && s.options.every((o) => out.has(o.productId)))) out.add(c.id);
  }
  return [...out];
}

/** Cuántos insumos están en o por debajo de su mínimo (incluye agotados). */
export async function lowStockCount() {
  const [low, out] = await Promise.all([
    prisma.ingredient.count({
      where: { active: true, minStock: { gt: 0 }, stock: { gt: 0, lte: prisma.ingredient.fields.minStock } },
    }),
    prisma.ingredient.count({ where: { active: true, stock: { lte: 0 } } }),
  ]);
  return low + out;
}
