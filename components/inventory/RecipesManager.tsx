"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { RecipeDialog, foodCostTone, type RecipeIngredient, type RecipeProduct } from "@/components/inventory/RecipeDialog";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface RecipeListProduct extends RecipeProduct {
  categoryId: number;
  cost: number;
  summary: string; // "200 g Carne, 1 unid Pan…"
  combo?: boolean;
}

type Filter = "all" | "missing" | "high";

export function RecipesManager({
  products,
  categories,
  ingredients,
}: {
  products: RecipeListProduct[];
  categories: { id: number; name: string }[];
  ingredients: RecipeIngredient[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = query.trim().toLowerCase();

  const costed = (p: RecipeListProduct) => p.recipe.length > 0 || (p.combo && p.cost > 0);
  const high = (p: RecipeListProduct) => !!costed(p) && p.price > 0 && p.cost / p.price > 0.4;
  const counts = {
    all: products.length,
    missing: products.filter((p) => !p.combo && p.recipe.length === 0).length,
    high: products.filter(high).length,
  };
  const visible = products.filter(
    (p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (filter === "all" || (filter === "missing" ? !p.combo && p.recipe.length === 0 : high(p)))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar plato…"
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
        <div className="flex gap-1.5 overflow-x-auto">
          {(
            [
              ["all", "Todos"],
              ["missing", "Sin receta"],
              ["high", "Costo alto"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "h-12 px-4 rounded-xl border text-sm font-medium whitespace-nowrap inline-flex items-center gap-2",
                filter === key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
              )}
            >
              {label} <span className={cn("text-xs tabular", filter === key ? "opacity-80" : "text-muted-foreground")}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 && (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Primero agrega productos al menú.</p>
      )}

      {categories.map((c) => {
        const list = visible.filter((p) => p.categoryId === c.id);
        if (list.length === 0) return null;
        return (
          <section key={c.id} className="rounded-2xl border bg-card overflow-hidden">
            <h3 className="px-5 py-3 bg-muted/50 border-b font-semibold">{c.name}</h3>
            <ul className="divide-y">
              {list.map((p) => {
                const pct = p.price > 0 ? p.cost / p.price : 0;
                const tone = foodCostTone(pct);
                return (
                  <li key={p.id} className="pl-5 pr-2 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.combo || p.recipe.length > 0 ? p.summary : "Sin receta: no descuenta inventario"}
                      </p>
                    </div>
                    {costed(p) && (
                      <div className="text-right hidden sm:block">
                        <p className="text-sm tabular">
                          {formatMoney(p.cost)} <span className="text-muted-foreground">/ {formatMoney(p.price)}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular">Ganas {formatMoney(p.price - p.cost)}</p>
                      </div>
                    )}
                    {costed(p) && p.price > 0 && p.cost > 0 && (
                      <span className={cn("text-xs font-semibold rounded-full px-2 py-1 tabular w-14 text-center", tone.cls)} title={tone.label}>
                        {Math.round(pct * 100)}%
                      </span>
                    )}
                    <RecipeDialog product={p} ingredients={ingredients} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

