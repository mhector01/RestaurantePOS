"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { makeResaleProduct, saveRecipe } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/config";
import { parseQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface RecipeIngredient {
  id: number;
  name: string;
  unit: string;
  cost: number;
}
export interface RecipeProduct {
  id: number;
  name: string;
  price: number;
  recipe: { ingredientId: number; quantity: number }[];
}

/** Bandas habituales de costo de alimentos sobre el precio de venta. */
export function foodCostTone(pct: number) {
  if (pct <= 0.3) return { label: "Saludable", cls: "bg-success/15 text-success" };
  if (pct <= 0.4) return { label: "Ajustado", cls: "bg-amber-400/15 text-amber-200" };
  return { label: "Muy alto", cls: "bg-red-500/15 text-red-300" };
}

export function RecipeDialog({ product, ingredients }: { product: RecipeProduct; ingredients: RecipeIngredient[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<{ ingredientId: number; qty: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const cost = rows.reduce((s, r) => {
    const q = parseQty(r.qty);
    return s + (q > 0 ? q * (byId.get(r.ingredientId)?.cost ?? 0) : 0);
  }, 0);
  const pct = product.price > 0 ? cost / product.price : 0;
  const tone = foodCostTone(pct);
  const used = new Set(rows.map((r) => r.ingredientId));

  const save = async () => {
    const items = rows.map((r) => ({ ingredientId: r.ingredientId, quantity: parseQty(r.qty) }));
    const bad = items.find((i) => !(i.quantity > 0));
    if (bad) return toast.error(`Falta la cantidad de ${byId.get(bad.ingredientId)?.name}`);
    setSaving(true);
    try {
      await saveRecipe(product.id, items);
      toast.success(items.length ? `Receta de ${product.name} guardada` : `${product.name} quedó sin control de stock`);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const resale = async () => {
    setSaving(true);
    try {
      const res = await makeResaleProduct(product.id);
      if (!res.success) return toast.error(res.error ?? "No se pudo");
      toast.success(`Listo: cada ${product.name} vendido descuenta 1 unidad del inventario`);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setRows(product.recipe.map((r) => ({ ingredientId: r.ingredientId, qty: String(r.quantity) })));
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {product.recipe.length > 0 ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar receta de ${product.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-10 rounded-xl text-primary">
            <Plus className="size-4" /> Receta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receta de {product.name}</DialogTitle>
          <DialogDescription>
            Cuánto lleva <b>una</b> porción. Al cobrarla se descuenta esto del inventario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              Sin insumos. Agrégalos abajo, o si lo vendes tal como lo compras (gaseosa, cerveza), usa{" "}
              <b>Producto de reventa</b>.
            </p>
          )}
          {rows.map((r, idx) => {
            const ing = byId.get(r.ingredientId);
            if (!ing) return null;
            const q = parseQty(r.qty);
            return (
              <div key={r.ingredientId} className="flex items-center gap-2 rounded-xl border bg-background/40 p-2 pl-3">
                <span className="flex-1 min-w-0 truncate text-sm font-medium">{ing.name}</span>
                <span className="relative w-32 shrink-0">
                  <input
                    inputMode="decimal"
                    autoFocus={idx === rows.length - 1 && !r.qty}
                    value={r.qty}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d.,]/g, "");
                      setRows((rs) => rs.map((x) => (x.ingredientId === r.ingredientId ? { ...x, qty: v } : x)));
                    }}
                    placeholder="0"
                    aria-label={`Cantidad de ${ing.name}`}
                    className="w-full h-10 rounded-lg border border-input bg-card pl-2.5 pr-11 tabular font-semibold outline-none focus:border-primary"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{ing.unit}</span>
                </span>
                <span className="w-20 text-right text-xs text-muted-foreground tabular shrink-0">
                  {q > 0 ? formatMoney(q * ing.cost) : "—"}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar ${ing.name}`}
                  onClick={() => setRows((rs) => rs.filter((x) => x.ingredientId !== r.ingredientId))}
                  className="size-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}

          <select
            value=""
            onChange={(e) => {
              const id = parseInt(e.target.value);
              if (id) setRows((rs) => [...rs, { ingredientId: id, qty: "" }]);
            }}
            className="w-full h-11 rounded-xl border border-dashed border-input bg-card px-3 text-sm text-muted-foreground outline-none focus:border-primary"
          >
            <option value="">+ Agregar insumo…</option>
            {ingredients
              .filter((i) => !used.has(i.id))
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
          </select>
          {ingredients.length === 0 && (
            <p className="text-xs text-muted-foreground">Primero crea tus insumos en la pestaña Stock.</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted/40 p-3 text-center">
          <div>
            <p className="text-[11px] text-muted-foreground">Costo por plato</p>
            <p className="font-semibold tabular">{formatMoney(cost)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Precio de venta</p>
            <p className="font-semibold tabular">{formatMoney(product.price)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Costo de alimento</p>
            <p className="font-semibold tabular">
              {cost > 0 ? (
                <span className={cn("rounded-full px-2 py-0.5 text-sm", tone.cls)}>{Math.round(pct * 100)}%</span>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
        {cost > 0 && (
          <p className="text-xs text-muted-foreground -mt-2">
            Te quedan {formatMoney(product.price - cost)} por plato para cubrir personal, alquiler y ganancia. Lo sano en
            restaurantes es que el costo de alimento quede entre 25% y 35% del precio.
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <Button type="button" variant="outline" className="h-12 rounded-xl sm:flex-1" onClick={resale} disabled={saving}>
            <Package className="size-4" /> Producto de reventa
          </Button>
          <Button type="button" className="h-12 rounded-xl sm:flex-1 text-base" onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Guardar receta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
