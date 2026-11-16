import prisma from "@/lib/prisma";

export type ComboSelection = Record<number, number>; // slotId → optionId

export interface ResolvedPart {
  productId: number;
  quantity: number;
  slotName: string;
}

/** Carga un combo con sus partes y opciones, en orden. */
export function loadCombo(productId: number) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      comboSlots: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: { options: { orderBy: [{ position: "asc" }, { id: "asc" }], include: { product: true } } },
      },
    },
  });
}

type LoadedCombo = NonNullable<Awaited<ReturnType<typeof loadCombo>>>;

/**
 * Valida lo que eligió el mesero y devuelve las partes, el recargo y una clave de la combinación.
 * Las partes con una sola opción se toman solas.
 */
export function resolveCombo(combo: LoadedCombo, selection: ComboSelection = {}) {
  const parts: ResolvedPart[] = [];
  let extra = 0;
  const keys: string[] = [];
  for (const slot of combo.comboSlots) {
    if (slot.options.length === 0) continue;
    const chosen =
      slot.options.length === 1 ? slot.options[0] : slot.options.find((o) => o.id === selection[slot.id]);
    if (!chosen) return { error: `Elige ${slot.name.toLowerCase()}` } as const;
    parts.push({ productId: chosen.productId, quantity: slot.quantity, slotName: slot.name });
    extra += chosen.extraPrice;
    keys.push(`${slot.id}:${chosen.id}`);
  }
  if (parts.length === 0) return { error: "Este combo aún no tiene productos configurados" } as const;
  return { parts, extra, variant: keys.join(",") } as const;
}

/**
 * Expande líneas vendidas a productos individuales: el combo (por si tiene receta propia, ej. empaque)
 * más cada una de sus partes. Sirve para descontar inventario.
 */
export function expandSoldLines(
  lines: { productId: number; quantity: number; parts?: { productId: number; quantity: number }[] }[]
) {
  const out: { productId: number; quantity: number }[] = [];
  for (const l of lines) {
    out.push({ productId: l.productId, quantity: l.quantity });
    for (const p of l.parts ?? []) out.push({ productId: p.productId, quantity: p.quantity * l.quantity });
  }
  return out;
}

/** "Coca-Cola · Papas grandes" — resumen de lo elegido para mostrar debajo del nombre. */
export function partsLabel(parts: { quantity: number; product: { name: string } }[]) {
  return parts.map((p) => (p.quantity > 1 ? `${p.quantity}× ${p.product.name}` : p.product.name)).join(" · ");
}
