"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { UNITS } from "@/lib/inventory";
import { normalizeTaxRate } from "@/lib/fiscal";

type Result = { success: boolean; error?: string };

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

/** Para vender el insumo tal cual en el menú (cerveza, gaseosa, agua…), creando su producto en el mismo paso. */
export interface SellInput {
  price: number;
  categoryId: number | null;
  newCategory?: string; // si no hay categoría todavía, se crea (sin ir a cocina: se sirve tal cual)
  taxRate: string;
}

type Tx = Pick<typeof prisma, "product" | "recipeItem" | "category">;

/** Productos de reventa de un insumo: los que llevan exactamente 1 unidad de él y nada más. */
async function resaleProductsOf(tx: Tx, ingredientId: number) {
  const products = await tx.product.findMany({
    where: { isCombo: false, recipe: { some: { ingredientId, quantity: 1 } } },
    include: { recipe: true },
  });
  return products.filter((p) => p.recipe.length === 1);
}

/** Crea el producto del menú para vender un insumo tal cual. */
async function createResaleProduct(tx: Tx, ing: { id: number; name: string }, sell: SellInput) {
  const price = Math.round(num(sell.price) * 100) / 100;
  if (!(price > 0)) throw new UserError("Escribe el precio de venta");
  let categoryId = sell.categoryId;
  if (!categoryId) {
    const catName = text(sell.newCategory);
    if (!catName) throw new UserError("Elige la categoría del menú donde se va a vender");
    const cat =
      (await tx.category.findFirst({ where: { name: { equals: catName, mode: "insensitive" } } })) ??
      (await tx.category.create({ data: { name: catName, kitchen: false } }));
    categoryId = cat.id;
  } else if (!(await tx.category.findUnique({ where: { id: categoryId } }))) {
    throw new UserError("Esa categoría no existe");
  }
  if (await tx.product.findFirst({ where: { name: { equals: ing.name, mode: "insensitive" } } })) {
    throw new UserError(`Ya hay un producto llamado "${ing.name}" en el menú. Ve a Menú, edítalo y en "Controlar stock" elige este insumo.`);
  }
  const product = await tx.product.create({
    data: { name: ing.name, price, categoryId, taxRate: normalizeTaxRate(sell.taxRate) },
  });
  await tx.recipeItem.create({ data: { productId: product.id, ingredientId: ing.id, quantity: 1 } });
  return product;
}

class UserError extends Error {}

export async function saveIngredient(id: number | null, input: IngredientInput, sell?: SellInput | null): Promise<Result & { id?: number }> {
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

  try {
    const saved = await prisma.$transaction(async (tx) => {
      let ing;
      if (id) {
        const before = await tx.ingredient.findUniqueOrThrow({ where: { id } });
        ing = await tx.ingredient.update({ where: { id }, data });
        // Su producto de reventa se llama igual: si cambia el nombre del insumo, cambia también en el menú
        if (before.name !== ing.name) {
          for (const p of await resaleProductsOf(tx, id)) {
            const clash = await tx.product.findFirst({ where: { name: { equals: ing.name, mode: "insensitive" }, NOT: { id: p.id } } });
            if (p.name === before.name && !clash) await tx.product.update({ where: { id: p.id }, data: { name: ing.name } });
          }
        }
      } else {
        const initial = Math.max(0, num(input.initialStock));
        ing = await tx.ingredient.create({ data: { ...data, stock: initial } });
        if (initial > 0) {
          await tx.stockMovement.create({
            data: { ingredientId: ing.id, type: "INITIAL", quantity: initial, stockAfter: initial, unitCost: ing.cost, note: "Stock inicial" },
          });
        }
      }
      if (sell && (await resaleProductsOf(tx, ing.id)).length === 0) await createResaleProduct(tx, ing, sell);
      return ing;
    });
    refreshInventory();
    if (sell) revalidatePath("/admin/productos");
    return { success: true, id: saved.id };
  } catch (e) {
    if (e instanceof UserError) return { success: false, error: e.message };
    throw e;
  }
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
  tax?: number; // ISV de la factura (crédito fiscal)
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
        tax: Math.max(0, Math.min(total, Math.round(num(input.tax) * 100) / 100)),
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

/**
 * Control de stock desde el Menú para productos que se venden tal como se compran
 * (gaseosas, cervezas, agua, snacks empacados). Crea o reutiliza su insumo y le pone receta de 1 unidad.
 * Con null deja de controlarse (se quita la receta; el insumo y su historial se conservan).
 */
export async function setProductStockControl(
  productId: number,
  control: { minStock: number; maxStock: number | null; initialStock?: number; ingredientId?: number | null; previousName?: string } | null
): Promise<Result> {
  await requireAdmin();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { recipe: { include: { ingredient: true } } },
  });
  if (!product) return { success: false, error: "El producto no existe" };

  const current = product.recipe.length === 1 && product.recipe[0].quantity === 1 ? product.recipe[0].ingredient : null;

  if (!control) {
    if (current) await prisma.recipeItem.deleteMany({ where: { productId } });
    refreshInventory();
    return { success: true };
  }

  const minStock = Math.max(0, num(control.minStock));
  const maxStock = control.maxStock && control.maxStock > minStock ? control.maxStock : null;

  const chosen = control.ingredientId ? await prisma.ingredient.findUnique({ where: { id: control.ingredientId } }) : null;
  if (control.ingredientId && !chosen) return { success: false, error: "Ese insumo no existe" };

  await prisma.$transaction(async (tx) => {
    let ing =
      chosen ??
      current ??
      (await tx.ingredient.findFirst({ where: { name: { equals: product.name, mode: "insensitive" } } }));
    if (!ing) {
      const initial = Math.max(0, num(control.initialStock));
      ing = await tx.ingredient.create({ data: { name: product.name, unit: "unid", stock: initial, minStock, maxStock } });
      if (initial > 0) {
        await tx.stockMovement.create({
          data: { ingredientId: ing.id, type: "INITIAL", quantity: initial, stockAfter: initial, unitCost: 0, note: "Stock inicial" },
        });
      }
    } else {
      // Si cambió el nombre del producto, el insumo de reventa lo sigue (si no choca con otro)
      // Solo si el insumo se llamaba igual que el producto: uno elegido con otro nombre conserva el suyo
      const rename =
        !chosen &&
        !!control.previousName &&
        ing.name.toLowerCase() === control.previousName.trim().toLowerCase() &&
        ing.name !== product.name &&
        !(await tx.ingredient.findFirst({ where: { name: { equals: product.name, mode: "insensitive" }, NOT: { id: ing.id } } }));
      ing = await tx.ingredient.update({
        where: { id: ing.id },
        data: { minStock, maxStock, active: true, ...(rename ? { name: product.name } : {}) },
      });
    }
    await tx.recipeItem.deleteMany({ where: { productId } });
    await tx.recipeItem.create({ data: { productId, ingredientId: ing.id, quantity: 1 } });
  });
  refreshInventory();
  return { success: true };
}

/** Corrige el ISV (crédito fiscal) de una compra ya registrada. */
export async function setPurchaseTax(id: number, tax: number): Promise<Result> {
  await requireAdmin();
  const p = await prisma.purchase.findUnique({ where: { id } });
  if (!p) return { success: false, error: "La compra no existe" };
  const value = Math.round(num(tax) * 100) / 100;
  if (value < 0 || value > p.total) return { success: false, error: "El ISV no puede ser mayor que el total" };
  await prisma.purchase.update({ where: { id }, data: { tax: value } });
  refreshInventory();
  return { success: true };
}
