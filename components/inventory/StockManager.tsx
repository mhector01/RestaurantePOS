"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, History, Search, X } from "lucide-react";
import { deleteIngredient, restoreIngredient } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { IngredientDialog, type IngredientRow, type SupplierOption } from "@/components/inventory/IngredientDialog";
import { WasteDialog } from "@/components/inventory/WasteDialog";
import { formatMoney } from "@/lib/config";
import { formatQty, stockLevel, type StockLevel } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface StockItem extends IngredientRow {
  supplierName: string | null;
  usedIn: number; // productos cuya receta lo usa
  active: boolean;
}

type Filter = "all" | "reorder" | "out" | "archived";

export const LEVEL_STYLE: Record<StockLevel, { label: string; badge: string; bar: string }> = {
  out: { label: "Agotado", badge: "bg-red-500/15 text-red-300 border-red-500/30", bar: "bg-red-500" },
  low: { label: "Stock bajo", badge: "bg-amber-400/15 text-amber-200 border-amber-400/30", bar: "bg-amber-400" },
  ok: { label: "Bien", badge: "bg-success/12 text-success border-success/25", bar: "bg-success" },
};

export function StockManager({
  items,
  suppliers,
  initialFilter = "all",
}: {
  items: StockItem[];
  suppliers: SupplierOption[];
  initialFilter?: Filter;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const q = query.trim().toLowerCase();

  const active = items.filter((i) => i.active);
  const counts = {
    all: active.length,
    reorder: active.filter((i) => stockLevel(i.stock, i.minStock) !== "ok").length,
    out: active.filter((i) => stockLevel(i.stock, i.minStock) === "out").length,
    archived: items.length - active.length,
  };

  const shown = items
    .filter((i) => (filter === "archived" ? !i.active : i.active))
    .filter((i) => {
      const lvl = stockLevel(i.stock, i.minStock);
      if (filter === "reorder") return lvl !== "ok";
      if (filter === "out") return lvl === "out";
      return true;
    })
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.supplierName?.toLowerCase().includes(q));

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "reorder", label: "Por reponer" },
    { key: "out", label: "Agotados" },
    ...(counts.archived > 0 ? [{ key: "archived" as Filter, label: "Archivados" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${active.length} insumos…`}
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
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFilter(c.key)}
              className={cn(
                "h-12 px-4 rounded-xl border text-sm font-medium whitespace-nowrap inline-flex items-center gap-2",
                filter === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
              )}
            >
              {c.label}
              <span
                className={cn(
                  "text-xs tabular rounded-full px-1.5",
                  filter === c.key ? "bg-white/20" : c.key === "reorder" && counts.reorder > 0 ? "bg-red-500 text-white" : "text-muted-foreground"
                )}
              >
                {counts[c.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Aún no tienes insumos</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Agrega lo que compras para cocinar (carnes, verduras, bebidas). Después arma la receta de cada plato en{" "}
            <Link href="/admin/inventario/recetas" className="text-primary font-medium">Recetas</Link> y el stock se descontará solo con cada venta.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed">
          {filter === "reorder" ? "Todo está por encima del mínimo. 👌" : "Sin resultados."}
        </p>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_auto] gap-4 px-5 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/40">
            <span>Insumo</span>
            <span>Existencia</span>
            <span className="text-right">Valor</span>
            <span className="w-56 text-right">Acciones</span>
          </div>
          <ul className="divide-y">
            {shown.map((i) => (
              <StockRow key={i.id} item={i} suppliers={suppliers} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StockRow({ item: i, suppliers }: { item: StockItem; suppliers: SupplierOption[] }) {
  const lvl = stockLevel(i.stock, i.minStock);
  const st = LEVEL_STYLE[lvl];
  const scale = Math.max(i.maxStock ?? 0, i.minStock * 2, i.stock, 1);
  const pct = Math.max(0, Math.min(100, (i.stock / scale) * 100));
  const minPct = Math.min(100, (i.minStock / scale) * 100);
  const [pending, startTransition] = useTransition();

  return (
    <li className="px-4 sm:px-5 py-3.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_auto] gap-x-4 gap-y-2 items-center">
      <div className="min-w-0">
        <p className="font-medium truncate">{i.name}</p>
        <p className="text-xs text-muted-foreground truncate">
          {i.supplierName ?? "Sin proveedor"}
          {" · "}
          {i.usedIn > 0 ? `En ${i.usedIn} receta${i.usedIn === 1 ? "" : "s"}` : "Sin receta"}
        </p>
      </div>

      <div className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold tabular", lvl === "out" && "text-red-300")}>{formatQty(i.stock, i.unit)}</span>
          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", st.badge)}>{st.label}</span>
        </div>
        <div className="relative mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full rounded-full", st.bar)} style={{ width: `${pct}%` }} />
          {i.minStock > 0 && <span className="absolute top-0 h-full w-0.5 bg-foreground/50" style={{ left: `${minPct}%` }} />}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {i.minStock > 0 ? `Mínimo ${formatQty(i.minStock, i.unit)}` : "Sin mínimo definido"}
          {i.maxStock ? ` · Ideal ${formatQty(i.maxStock, i.unit)}` : ""}
        </p>
      </div>

      <div className="hidden md:block text-right">
        <p className="font-semibold tabular">{formatMoney(Math.max(i.stock, 0) * i.cost)}</p>
        <p className="text-[11px] text-muted-foreground tabular">
          {formatMoney(i.cost)} / {i.unit}
        </p>
      </div>

      <div className="flex items-center justify-end md:w-56 row-start-1 col-start-2 md:row-start-auto md:col-start-auto">
        {i.active ? (
          <>
            <WasteDialog ingredient={i} />
            <Button asChild variant="ghost" size="icon" className="size-10 rounded-xl" title="Ver movimientos">
              <Link href={`/admin/inventario/movimientos?insumo=${i.id}`} aria-label={`Movimientos de ${i.name}`}>
                <History className="size-4" />
              </Link>
            </Button>
            <IngredientDialog ingredient={i} suppliers={suppliers} />
            <ConfirmAction
              title={`¿Archivar "${i.name}"?`}
              description="Deja de aparecer en el stock y en las compras. Su historial se conserva y puedes restaurarlo cuando quieras."
              confirmLabel="Archivar"
              successMessage="Insumo archivado"
              action={() => deleteIngredient(i.id)}
            >
              <Button variant="ghost" size="icon" className="size-10 rounded-xl text-muted-foreground hover:text-destructive" aria-label={`Archivar ${i.name}`}>
                <Archive className="size-4" />
              </Button>
            </ConfirmAction>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            disabled={pending}
            onClick={() => startTransition(() => restoreIngredient(i.id))}
          >
            <ArchiveRestore className="size-4" /> Restaurar
          </Button>
        )}
      </div>
    </li>
  );
}
