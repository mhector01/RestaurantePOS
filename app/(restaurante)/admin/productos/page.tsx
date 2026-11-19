import prisma from "@/lib/prisma";
import { ProductModal } from "@/components/ProductModal";
import { ProductsManager } from "@/components/admin/ProductsManager";
import { ComboDialog } from "@/components/admin/ComboDialog";
import { PageHeader } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function ProductosPage() {
  const [productos, categorias, insumos] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        recipe: { include: { ingredient: true } },
        comboSlots: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          include: { options: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const products = productos.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    categoryId: p.categoryId,
    taxRate: p.taxRate,
    // Reventa = receta de 1 sola unidad de un insumo; con otra receta, se controla desde Inventario → Recetas
    stock:
      p.recipe.length === 1 && p.recipe[0].quantity === 1
        ? {
            mode: "resale" as const,
            stock: p.recipe[0].ingredient.stock,
            minStock: p.recipe[0].ingredient.minStock,
            maxStock: p.recipe[0].ingredient.maxStock,
          }
        : p.recipe.length > 0
          ? { mode: "recipe" as const }
          : null,
    combo: p.isCombo
      ? p.comboSlots.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          options: s.options.map((o) => ({ productId: o.productId, extraPrice: o.extraPrice })),
        }))
      : null,
  }));
  const categories = categorias.map((c) => ({ id: c.id, name: c.name, kitchen: c.kitchen }));
  // Insumos que se pueden unir a un producto de reventa (y cuál producto ya vende cada uno)
  const soldAs = new Map<number, string>();
  for (const p of productos) if (!p.isCombo && p.recipe.length === 1 && p.recipe[0].quantity === 1) soldAs.set(p.recipe[0].ingredientId, p.name);
  const inventory = insumos.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    stock: i.stock,
    minStock: i.minStock,
    maxStock: i.maxStock,
    soldAs: soldAs.get(i.id) ?? null,
  }));
  const components = products.filter((p) => !p.combo).map(({ id, name, price, categoryId }) => ({ id, name, price, categoryId }));

  return (
    <>
      <PageHeader title="Menú" description="Productos, combos y precios que ven los meseros.">
        <ComboDialog products={components} categories={categories} />
        <ProductModal categories={categories} inventory={inventory} />
      </PageHeader>
      <ProductsManager products={products} categories={categories} inventory={inventory} />
    </>
  );
}
