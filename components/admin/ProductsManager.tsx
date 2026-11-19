"use client";

import { useState, useTransition } from "react";
import { ChefHat, Search, Trash2, X } from "lucide-react";
import { deleteCategory, deleteProduct, setCategoryKitchen } from "@/app/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProductModal, type InventoryOption, type StockInfo } from "@/components/ProductModal";
import { formatQty, stockLevel } from "@/lib/inventory";
import { ComboDialog } from "@/components/admin/ComboDialog";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { formatMoney } from "@/lib/config";

interface Category {
  id: number;
  name: string;
  kitchen: boolean;
}
interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  taxRate: string;
  stock: StockInfo;
  /** Partes del combo; null si es un producto normal. */
  combo: { name: string; quantity: number; options: { productId: number; extraPrice: number }[] }[] | null;
}

export function ProductsManager({ products, categories, inventory }: { products: Product[]; categories: Category[]; inventory: InventoryOption[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const nameOf = new Map(products.map((p) => [p.id, p.name]));
  const components = products.filter((p) => !p.combo).map(({ id, name, price, categoryId }) => ({ id, name, price, categoryId }));

  const groups = categories
    .map((c) => ({
      category: c,
      items: products.filter((p) => p.categoryId === c.id && (!q || p.name.toLowerCase().includes(q))),
      total: products.filter((p) => p.categoryId === c.id).length,
    }))
    .filter((g) => !q || g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar entre ${products.length} productos…`}
          className="w-full h-12 rounded-xl border bg-card pl-11 pr-10 outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {categories.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Tu menú está vacío</p>
          <p className="text-sm text-muted-foreground mt-1">
            Usa <span className="font-medium">Nuevo producto</span> para agregar el primero; ahí mismo puedes crear categorías.
          </p>
        </div>
      )}

      {groups.length === 0 && q && <p className="text-sm text-muted-foreground text-center py-8">Sin resultados.</p>}

      {groups.map(({ category, items, total }) => (
        <section key={category.id} className="rounded-2xl border bg-card overflow-hidden">
          <header className="flex items-center gap-2 px-5 py-3 bg-muted/50 border-b">
            <h2 className="font-semibold flex-1">
              {category.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{total}</span>
            </h2>
            <KitchenToggle category={category} />
            <ProductModal categories={categories} defaultCategoryId={category.id} compact inventory={inventory} />
            {total === 0 && (
              <ConfirmAction
                title={`¿Eliminar la categoría "${category.name}"?`}
                confirmLabel="Eliminar"
                successMessage="Categoría eliminada"
                action={() => deleteCategory(category.id)}
              >
                <Button variant="ghost" size="icon" className="size-10 rounded-xl text-muted-foreground hover:text-destructive" aria-label="Eliminar categoría">
                  <Trash2 className="size-4" />
                </Button>
              </ConfirmAction>
            )}
          </header>

          {items.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">Sin productos en esta categoría.</p>
          ) : (
            <ul className="divide-y">
              {items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 pl-5 pr-2 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {p.name}
                      {p.combo && (
                        <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-primary/15 text-primary">
                          Combo
                        </span>
                      )}
                      {p.stock?.mode === "resale" && <StockChip stock={p.stock} />}
                    </p>
                    {p.combo && (
                      <p className="text-xs text-muted-foreground truncate">
                        {p.combo
                          .map((s) =>
                            s.options.length === 1
                              ? `${s.quantity > 1 ? `${s.quantity}× ` : ""}${nameOf.get(s.options[0].productId) ?? "?"}`
                              : `${s.name} a elegir (${s.options.length})`
                          )
                          .join(" + ")}
                      </p>
                    )}
                  </div>
                  {p.taxRate !== "15" && !p.combo && (
                    <span
                      className={cn(
                        "text-[11px] font-semibold rounded-full px-2 py-0.5",
                        p.taxRate === "18" ? "bg-violet-500/15 text-violet-300" : "bg-sky-500/15 text-sky-300"
                      )}
                      title="Tasa de ISV"
                    >
                      {p.taxRate === "18" ? "ISV 18%" : "Exento"}
                    </span>
                  )}
                  <p className="font-semibold tabular w-24 text-right">{formatMoney(p.price)}</p>
                  <div className="flex">
                    {p.combo ? (
                      <ComboDialog
                        combo={{ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId, slots: p.combo }}
                        products={components}
                        categories={categories}
                      />
                    ) : (
                      <ProductModal product={p} categories={categories} stock={p.stock} inventory={inventory} />
                    )}
                    <ConfirmAction
                      title={`¿Eliminar "${p.name}"?`}
                      description="Dejará de aparecer en el menú. Si ya tiene ventas registradas no se podrá eliminar."
                      confirmLabel="Eliminar"
                      successMessage="Producto eliminado"
                      action={() => deleteProduct(p.id)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-xl text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar ${p.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </ConfirmAction>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/** Existencias de un producto de reventa (gaseosa, cerveza…). */
function StockChip({ stock }: { stock: Extract<StockInfo, { mode: "resale" }> }) {
  const lvl = stockLevel(stock.stock, stock.minStock);
  return (
    <span
      className={cn(
        "ml-2 align-middle text-[11px] font-medium rounded-full px-2 py-0.5 tabular",
        lvl === "out" ? "bg-red-500/15 text-red-300" : lvl === "low" ? "bg-amber-400/15 text-amber-200" : "bg-muted text-muted-foreground"
      )}
      title="Existencias en inventario"
    >
      {lvl === "out" ? "Agotado" : `${formatQty(stock.stock)} en stock`}
    </span>
  );
}

/** Define si los productos de la categoría se envían a la pantalla de cocina. */
function KitchenToggle({ category }: { category: Category }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setCategoryKitchen(category.id, !category.kitchen))}
      title={category.kitchen ? "Se envía a cocina. Toca para no enviarla." : "No se envía a cocina. Toca para enviarla."}
      aria-pressed={category.kitchen}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 border transition-colors",
        category.kitchen
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-card text-muted-foreground line-through decoration-1",
        pending && "opacity-60"
      )}
    >
      <ChefHat className="size-3.5" /> Cocina
    </button>
  );
}
