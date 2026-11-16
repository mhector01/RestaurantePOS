"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";

async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    throw new Error("No autorizado");
  }
}

export interface ComboInput {
  name: string;
  price: number;
  categoryId: number;
  slots: {
    name: string;
    quantity: number;
    options: { productId: number; extraPrice: number }[];
  }[];
}

/** Crea o actualiza un combo con sus partes. Las ventas anteriores no cambian (guardan lo que se eligió). */
export async function saveCombo(id: number | null, input: ComboInput): Promise<{ success: boolean; error?: string; id?: number }> {
  await requireAdmin();
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return { success: false, error: "Escribe el nombre del combo" };
  if (!(input.price >= 0)) return { success: false, error: "Precio no válido" };

  const slots = input.slots
    .map((s, i) => ({
      name: s.name.replace(/\s+/g, " ").trim() || `Parte ${i + 1}`,
      quantity: Math.max(1, Math.min(20, Math.floor(s.quantity || 1))),
      position: i,
      options: s.options
        .filter((o) => o.productId)
        .map((o, j) => ({ productId: o.productId, extraPrice: Math.max(0, o.extraPrice || 0), position: j })),
    }))
    .filter((s) => s.options.length > 0);
  if (slots.length === 0) return { success: false, error: "Agrega al menos un producto al combo" };

  // Un combo no puede contener combos (evita ciclos y cocina confusa)
  const ids = slots.flatMap((s) => s.options.map((o) => o.productId));
  const nested = await prisma.product.count({ where: { id: { in: ids }, isCombo: true } });
  if (nested > 0) return { success: false, error: "Un combo no puede incluir otro combo" };

  const saved = await prisma.$transaction(async (tx) => {
    const data = { name, price: input.price, isCombo: true, category: { connect: { id: input.categoryId } } };
    const product = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });
    await tx.comboSlot.deleteMany({ where: { comboId: product.id } });
    for (const s of slots) {
      await tx.comboSlot.create({
        data: {
          comboId: product.id,
          name: s.name,
          quantity: s.quantity,
          position: s.position,
          options: { create: s.options },
        },
      });
    }
    return product;
  });

  revalidatePath("/admin/productos");
  revalidatePath("/admin/inventario", "layout");
  revalidatePath("/mesa", "layout");
  revalidatePath("/llevar", "layout");
  return { success: true, id: saved.id };
}
