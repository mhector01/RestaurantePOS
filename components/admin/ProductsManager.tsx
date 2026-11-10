"use client";

import { useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { deleteCategory, deleteProduct } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ProductModal } from "@/components/ProductModal";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { formatMoney } from "@/lib/config";

interface Category {
  id: number;
  name: string;
}
interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}

export function ProductsManager({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

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
            <ProductModal categories={categories} defaultCategoryId={category.id} compact />
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
                  <p className="flex-1 min-w-0 font-medium truncate">{p.name}</p>
                  <p className="font-semibold tabular w-24 text-right">{formatMoney(p.price)}</p>
                  <div className="flex">
                    <ProductModal product={p} categories={categories} />
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
