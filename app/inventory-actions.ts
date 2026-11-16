"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isValidAdminToken } from "@/lib/auth";
import { UNITS } from "@/lib/inventory";

type Result = { success: boolean; error?: string };

async function requireAdmin() {
  const cookieStore = await cookies();
  if (!(await isValidAdminToken(cookieStore.get(ADMIN_COOKIE)?.value))) {
    throw new Error("No autorizado");
  }
}

function refreshInventory() {
  revalidatePath("/admin", "layout"); // incluye la alerta del menú lateral
  revalidatePath("/mesa", "layout"); // productos agotados en la pantalla de pedidos
  revalidatePath("/llevar", "layout");
}

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};
const text = (v?: string | null) => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
};

/** "2026-11-16" → fecha a mediodía local, para que no se corra de día por la zona horaria. */
function parseDay(day?: string | null) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date();
  return new Date(`${day}T12:00:00`);
}

// ---------------------------------------------------------------------------
// INSUMOS
// ---------------------------------------------------------------------------

export interface IngredientInput {
  name: string;
  unit: string;
  minStock: number;
  maxStock: number | null;
  cost: number;
  supplierId: number | null;
  initialStock?: number; // solo al crear
}

export async function saveIngredient(id: number | null, input: IngredientInput): Promise<Result & { id?: number }> {
  await requireAdmin();
  const name = text(input.name);
  if (!name) return { success: false, error: "Escribe el nombre del insumo" };
  const unit = UNITS.some((u) => u.value === input.unit) ? input.unit : "unid";
  const data = {
    name,
    unit,
    minStock: Math.max(0, num(input.minStock)),
    maxStock: input.maxStock && input.maxStock > 0 ? input.maxStock : null,
    cost: Math.max(0, num(input.cost)),
    supplierId: input.supplierId || null,
  };

  const dup = await prisma.ingredient.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) },
  });
  if (dup) return { success: false, error: `Ya existe un insumo llamado "${dup.name}"` };

  if (id) {
    await prisma.ingredient.update({ where: { id }, data });
    refreshInventory();
    return { success: true, id };
  }

  const initial = Math.max(0, num(input.initialStock));
  const created = await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.create({ data: { ...data, stock: initial } });
    if (initial > 0) {
      await tx.stockMovement.create({
        data: { ingredientId: ing.id, type: "INITIAL", quantity: initial, stockAfter: initial, unitCost: ing.cost, note: "Stock inicial" },
      });
    }
    return ing;
  });
  refreshInventory();
  return { success: true, id: created.id };
}

/** Si el insumo ya tiene historial se archiva para no perder el kardex; si no, se elimina. */
export async function deleteIngredient(id: number): Promise<Result> {
  await requireAdmin();
  const inRecipes = await prisma.recipeItem.count({ where: { ingredientId: id } });
  if (inRecipes > 0) {
    return { success: false, error: `Se usa en ${inRecipes} receta${inRecipes === 1 ? "" : "s"}. Quítalo de ellas primero.` };
  }
  const history = await prisma.stockMovement.count({ where: { ingredientId: id } });
  const purchases = await prisma.purchaseItem.count({ where: { ingredientId: id } });
  if (history > 0 || purchases > 0) {
    await prisma.ingredient.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.ingredient.delete({ where: { id } });
  }
  refreshInventory();
  return { success: true };
}

export async function restoreIngredient(id: number) {
  await requireAdmin();
  await prisma.ingredient.update({ where: { id }, data: { active: true } });
  refreshInventory();
}

/** Merma: lo que se pierde (vencido, dañado, cortesía…). */
export async function registerWaste(ingredientId: number, quantity: number, reason: string): Promise<Result> {
  await requireAdmin();
  const qty = num(quantity);
  if (qty <= 0) return { success: false, error: "La cantidad debe ser mayor que cero" };
  await prisma.$transaction(async (tx) => {
    const ing = await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: { decrement: qty } } });
    await tx.stockMovement.create({
      data: { ingredientId, type: "WASTE", quantity: -qty, stockAfter: ing.stock, unitCost: ing.cost, note: text(reason) ?? "Merma" },
    });
  });
  refreshInventory();
  return { success: true };
}

/** Conteo físico: deja el stock en lo que realmente hay y registra la diferencia. */
export async function saveCount(entries: { id: number; counted: number }[], note?: string): Promise<Result & { changed?: number }> {
  await requireAdmin();
  const valid = entries.filter((e) => Number.isFinite(e.counted) && e.counted >= 0);
  if (valid.length === 0) return { success: false, error: "No hay cantidades para guardar" };
  const label = text(note) ?? "Conteo físico";
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const e of valid) {
      const ing = await tx.ingredient.findUnique({ where: { id: e.id } });
      if (!ing) continue;
      const diff = Math.round((e.counted - ing.stock) * 1000) / 1000;
      if (diff === 0) continue;
      changed++;
      await tx.ingredient.update({ where: { id: e.id }, data: { stock: e.counted } });
      await tx.stockMovement.create({
        data: { ingredientId: e.id, type: "COUNT", quantity: diff, stockAfter: e.counted, unitCost: ing.cost, note: label },
      });
    }
  });
  refreshInventory();
  return { success: true, changed };
}

// ---------------------------------------------------------------------------
// PROVEEDORES
// ---------------------------------------------------------------------------

export interface SupplierInput {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  notes?: string;
}

export async function saveSupplier(id: number | null, input: SupplierInput): Promise<Result & { id?: number }> {
  await requireAdmin();
  const name = text(input.name);
  if (!name) return { success: false, error: "Escribe el nombre del proveedor" };
  const data = {
    name,
    contact: text(input.contact),
    phone: text(input.phone)?.replace(/[^\d+\-\s]/g, "") || null,
    email: text(input.email),
    taxId: text(input.taxId),
    notes: text(input.notes),
  };
  const saved = id
    ? await prisma.supplier.update({ where: { id }, data })
    : await prisma.supplier.create({ data });
  refreshInventory();
  return { success: true, id: saved.id };
}

export async function deleteSupplier(id: number): Promise<Result> {
  await requireAdmin();
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) {
    await prisma.supplier.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.supplier.delete({ where: { id } });
  }
  refreshInventory();
  return { success: true };
}

export async function restoreSupplier(id: number) {
  await requireAdmin();
  await prisma.supplier.update({ where: { id }, data: { active: true } });
  refreshInventory();
}

// ---------------------------------------------------------------------------
// COMPRAS
// ---------------------------------------------------------------------------

export interface PurchaseInput {
  supplierId: number | null;
  invoice?: string;
  date?: string; // YYYY-MM-DD
  paid: boolean;
  notes?: string;
  items: { ingredientId: number; quantity: number; unitCost: number }[];
}

/** Registra la compra recibida: sube el stock y recalcula el costo promedio de cada insumo. */
export async function createPurchase(input: PurchaseInput): Promise<Result & { id?: number }> {
  await requireAdmin();
  const items = input.items
    .map((i) => ({ ingredientId: i.ingredientId, quantity: num(i.quantity), unitCost: Math.max(0, num(i.unitCost)) }))
    .filter((i) => i.ingredientId && i.quantity > 0);
  if (items.length === 0) return { success: false, error: "Agrega al menos un insumo con cantidad" };

  const total = Math.round(items.reduce((s, i) => s + i.quantity * i.unitCost, 0) * 100) / 100;
  const date = parseDay(input.date);
  const supplier = input.supplierId ? await prisma.supplier.findUnique({ where: { id: input.supplierId } }) : null;

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        supplierId: supplier?.id ?? null,
        invoice: text(input.invoice),
        date,
        total,
        paid: input.paid,
        paidAt: input.paid ? new Date() : null,
        notes: text(input.notes),
        items: { create: items },
      },
    });

    for (const i of items) {
      const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: i.ingredientId } });
      // Costo promedio ponderado (si el stock estaba negativo, cuenta como cero)
      const base = Math.max(ing.stock, 0);
      const cost = base + i.quantity > 0 ? (base * ing.cost + i.quantity * i.unitCost) / (base + i.quantity) : i.unitCost;
      const updated = await tx.ingredient.update({
        where: { id: ing.id },
        data: {
          stock: { increment: i.quantity },
          cost: Math.round(cost * 10000) / 10000,
          active: true,
          // El primer proveedor al que se le compra queda como habitual
          ...(supplier && !ing.supplierId ? { supplierId: supplier.id } : {}),
        },
      });
      await tx.stockMovement.create({
        data: {
          ingredientId: ing.id,
          type: "PURCHASE",
          quantity: i.quantity,
          stockAfter: updated.stock,
          unitCost: i.unitCost,
          purchaseId: p.id,
          note: [supplier?.name, p.invoice && `Fact. ${p.invoice}`].filter(Boolean).join(" · ") || `Compra #${p.id}`,
        },
      });
    }
    return p;
  });

  refreshInventory();
  return { success: true, id: purchase.id };
}

/** Anula una compra mal registrada: devuelve el stock que había sumado. */
export async function voidPurchase(id: number): Promise<Result> {
  await requireAdmin();
  const purchase = await prisma.purchase.findUnique({ where: { id }, include: { items: true } });
  if (!purchase) return { success: false, error: "La compra no existe" };
  if (purchase.status === "VOID") return { success: false, error: "La compra ya estaba anulada" };

  await prisma.$transaction(async (tx) => {
    for (const i of purchase.items) {
      const ing = await tx.ingredient.update({ where: { id: i.ingredientId }, data: { stock: { decrement: i.quantity } } });
      await tx.stockMovement.create({
        data: {
          ingredientId: i.ingredientId,
          type: "VOID",
          quantity: -i.quantity,
          stockAfter: ing.stock,
          unitCost: i.unitCost,
          purchaseId: id,
          note: `Anulación de compra #${id}`,
        },
      });
    }
    await tx.purchase.update({ where: { id }, data: { status: "VOID" } });
  });
  refreshInventory();
  return { success: true };
}

export async function setPurchasePaid(id: number, paid: boolean) {
  await requireAdmin();
  await prisma.purchase.update({ where: { id }, data: { paid, paidAt: paid ? new Date() : null } });
  refreshInventory();
}

// ---------------------------------------------------------------------------
// RECETAS
// ---------------------------------------------------------------------------

/** Reemplaza la receta completa de un producto. Una lista vacía deja el producto sin control de stock. */
export async function saveRecipe(productId: number, items: { ingredientId: number; quantity: number }[]): Promise<Result> {
  await requireAdmin();
  const merged = new Map<number, number>();
  for (const i of items) {
    const q = num(i.quantity);
    if (i.ingredientId && q > 0) merged.set(i.ingredientId, (merged.get(i.ingredientId) ?? 0) + q);
  }
  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { productId } }),
    prisma.recipeItem.createMany({
      data: [...merged].map(([ingredientId, quantity]) => ({ productId, ingredientId, quantity })),
    }),
  ]);
  refreshInventory();
  return { success: true };
}

/**
 * Producto de reventa (gaseosa, cerveza, agua): crea un insumo con su mismo nombre en unidades
 * y le pone como receta "1 unidad". Si el insumo ya existe, solo lo enlaza.
 */
export async function makeResaleProduct(productId: number): Promise<Result> {
  await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { success: false, error: "El producto no existe" };
  const existing = await prisma.ingredient.findFirst({ where: { name: { equals: product.name, mode: "insensitive" } } });
  const ing = existing ?? (await prisma.ingredient.create({ data: { name: product.name, unit: "unid" } }));
  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { productId } }),
    prisma.recipeItem.create({ data: { productId, ingredientId: ing.id, quantity: 1 } }),
  ]);
  refreshInventory();
  return { success: true };
}
