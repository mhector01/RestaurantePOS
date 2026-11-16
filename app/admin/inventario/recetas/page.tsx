import prisma from "@/lib/prisma";
import { formatMoney } from "@/lib/config";
import { formatQty } from "@/lib/inventory";
import { MiniKpi, SectionBar } from "@/components/inventory/InventoryTabs";
import { RecipesManager, type RecipeListProduct } from "@/components/inventory/RecipesManager";

export const dynamic = "force-dynamic";

export default async function RecetasPage() {
  const [products, categories, ingredients] = await Promise.all([
    prisma.product.findMany({
      include: { recipe: { include: { ingredient: true }, orderBy: { id: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const list: RecipeListProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    categoryId: p.categoryId,
    recipe: p.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
    cost: p.recipe.reduce((s, r) => s + r.quantity * r.ingredient.cost, 0),
    summary: p.recipe.map((r) => `${formatQty(r.quantity, r.ingredient.unit)} ${r.ingredient.name}`).join(" · "),
  }));

  // Solo los que ya tienen costo (insumos con al menos una compra o costo cargado)
  const withRecipe = list.filter((p) => p.recipe.length > 0 && p.price > 0 && p.cost > 0);
  const avgPct = withRecipe.length ? withRecipe.reduce((s, p) => s + p.cost / p.price, 0) / withRecipe.length : 0;
  const coverage = list.length ? Math.round((list.filter((p) => p.recipe.length > 0).length / list.length) * 100) : 0;
  const best = [...withRecipe].sort((a, b) => b.price - b.cost - (a.price - a.cost))[0];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <MiniKpi
          label="Costo de alimento promedio"
          value={withRecipe.length ? `${Math.round(avgPct * 100)}%` : "—"}
          hint="Lo sano: entre 25% y 35%"
          tone={!withRecipe.length ? undefined : avgPct <= 0.35 ? "good" : avgPct <= 0.4 ? "warn" : "danger"}
        />
        <MiniKpi
          label="Platos con receta"
          value={`${coverage}%`}
          hint={coverage < 100 ? "Los demás no descuentan inventario" : "Todo el menú controlado"}
          tone={coverage === 100 ? "good" : "warn"}
        />
        <MiniKpi
          label="Deja más ganancia por plato"
          value={best ? best.name : "—"}
          hint={best ? `${formatMoney(best.price - best.cost)} por plato` : undefined}
        />
      </div>

      <SectionBar
        title="Recetas y costeo"
        description="Define qué lleva cada plato: así el stock baja solo al vender y sabes cuánto te cuesta."
      />
      <RecipesManager
        products={list}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, cost: i.cost }))}
      />
    </>
  );
}
