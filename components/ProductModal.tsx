"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes, Loader2, Pencil, Plus } from "lucide-react";
import { createCategory, saveProduct } from "@/app/actions";
import { setProductStockControl } from "@/app/inventory-actions";
import { formatQty, parseQty } from "@/lib/inventory";
import { TAX_RATES, normalizeTaxRate } from "@/lib/fiscal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BUSINESS } from "@/lib/config";
import { cn } from "@/lib/utils";

interface Category {
  id: number;
  name: string;
}
interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  taxRate?: string;
}
/** Insumo del inventario que se puede vender tal cual (para unirlo al controlar stock). */
export interface InventoryOption {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  maxStock: number | null;
  soldAs: string | null; // nombre del producto que ya lo vende, si hay
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Insumo que parece ser el mismo producto (mismo nombre, o uno contiene al otro). */
function guessIngredient(name: string, options: InventoryOption[]) {
  const n = norm(name);
  if (n.length < 3) return null;
  const free = options.filter((o) => !o.soldAs);
  return (
    free.find((o) => norm(o.name) === n) ??
    (n.length >= 4 ? free.find((o) => norm(o.name).includes(n) || n.includes(norm(o.name))) : undefined) ??
    null
  );
}

/** Cómo se controla el stock del producto: reventa (1 unidad por venta) o con receta propia. */
export type StockInfo =
  | { mode: "resale"; stock: number; minStock: number; maxStock: number | null }
  | { mode: "recipe" }
  | null;

export function ProductModal({
  product,
  categories,
  defaultCategoryId,
  compact = false,
  stock = null,
  inventory = [],
}: {
  stock?: StockInfo;
  inventory?: InventoryOption[];
  product?: Product;
  categories: Category[];
  defaultCategoryId?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [localCats, setLocalCats] = useState<Category[]>(categories);
  const [newCat, setNewCat] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [taxRate, setTaxRate] = useState("15");
  const [track, setTrack] = useState(false);
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [initial, setInitial] = useState("");
  // Insumo del inventario al que se une: null = crear uno nuevo con el nombre del producto
  const [ingredientId, setIngredientId] = useState<number | null>(null);
  const [pickedByHand, setPickedByHand] = useState(false);
  const wasResale = stock?.mode === "resale";
  const linkable = inventory.filter((o) => !o.soldAs);
  const chosen = linkable.find((o) => o.id === ingredientId) ?? null;

  const choose = (id: number | null, byHand: boolean) => {
    setIngredientId(id);
    setPickedByHand(byHand);
    const ing = inventory.find((o) => o.id === id);
    if (ing) {
      setMinStock(ing.minStock ? String(ing.minStock) : "");
      setMaxStock(ing.maxStock ? String(ing.maxStock) : "");
    }
  };

  const reset = () => {
    setName(product?.name ?? "");
    setPrice(product ? String(product.price) : "");
    setCategoryId(product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? null);
    setLocalCats(categories);
    setNewCat("");
    setCreatingCat(false);
    setTaxRate(normalizeTaxRate(product?.taxRate));
    setTrack(stock?.mode === "resale");
    setMinStock(stock?.mode === "resale" && stock.minStock ? String(stock.minStock) : "");
    setMaxStock(stock?.mode === "resale" && stock.maxStock ? String(stock.maxStock) : "");
    setInitial("");
    setIngredientId(null);
    setPickedByHand(false);
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    const cat = await createCategory(newCat);
    setLocalCats((c) => (c.some((x) => x.id === cat.id) ? c : [...c, cat]));
    setCategoryId(cat.id);
    setNewCat("");
    setCreatingCat(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(price);
    if (!categoryId) return toast.error("Elige una categoría");
    if (Number.isNaN(value) || value < 0) return toast.error("Precio no válido");
    const min = parseQty(minStock || "0");
    const max = maxStock ? parseQty(maxStock) : null;
    if (track && (Number.isNaN(min) || min < 0 || (max !== null && Number.isNaN(max)))) {
      return toast.error("Revisa las cantidades de inventario");
    }
    setLoading(true);
    try {
      const saved = await saveProduct(product?.id ?? null, name, value, categoryId, taxRate);
      const wasTracked = stock?.mode === "resale";
      if (track) {
        const res = await setProductStockControl(saved.id, {
          minStock: min,
          maxStock: max,
          initialStock: chosen ? 0 : parseQty(initial || "0") || 0,
          ingredientId: wasResale ? null : chosen?.id ?? null,
          previousName: product?.name,
        });
        if (!res.success) toast.error(res.error ?? "No se pudo unir con el inventario");
      } else if (wasTracked) {
        await setProductStockControl(saved.id, null);
      }
      toast.success(product ? "Producto actualizado" : "Producto agregado");
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${product.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : compact ? (
          <Button variant="ghost" size="sm" className="h-10 rounded-xl text-primary hover:text-primary">
            <Plus /> Agregar
          </Button>
        ) : (
          <Button className="h-11 rounded-xl">
            <Plus /> Nuevo producto
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>Así aparecerá en el menú de los meseros.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (track && !wasResale && !pickedByHand) choose(guessIngredient(e.target.value, inventory)?.id ?? null, false);
              }}
              placeholder="Ej. Hamburguesa doble"
              required
              autoFocus
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-price">Precio</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{BUSINESS.currency}</span>
              <Input
                id="p-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
                required
                className="h-12 rounded-xl pl-9 text-lg font-semibold tabular"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {localCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "h-10 px-4 rounded-full border text-sm font-medium transition-colors",
                    categoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
              {!creatingCat && (
                <button
                  type="button"
                  onClick={() => setCreatingCat(true)}
                  className="h-10 px-4 rounded-full border border-dashed text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1"
                >
                  <Plus className="size-4" /> Nueva
                </button>
              )}
            </div>
            {creatingCat && (
              <div className="flex gap-2 pt-1">
                <Input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                  placeholder="Nombre de la categoría"
                  className="h-11 rounded-xl"
                />
                <Button type="button" className="h-11 rounded-xl" onClick={addCategory}>
                  Crear
                </Button>
                <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={() => setCreatingCat(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Impuesto (ISV)</Label>
            <div className="grid grid-cols-3 gap-2">
              {TAX_RATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTaxRate(t.value)}
                  title={t.hint}
                  className={cn(
                    "h-10 rounded-xl border text-sm font-medium transition-colors",
                    taxRate === t.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El precio incluye el impuesto. {TAX_RATES.find((t) => t.value === taxRate)?.hint}.
            </p>
          </div>

          {stock?.mode === "recipe" ? (
            <p className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground flex gap-2">
              <Boxes className="size-4 mt-0.5 shrink-0" />
              Su inventario se controla con la receta (Inventario → Recetas).
            </p>
          ) : (
            <div className="rounded-2xl border p-3 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={track}
                  onChange={(e) => {
                    setTrack(e.target.checked);
                    if (e.target.checked && !wasResale && !pickedByHand) choose(guessIngredient(name, inventory)?.id ?? null, false);
                  }}
                  className="mt-1 size-5 accent-[var(--primary)]"
                />
                <span className="flex-1">
                  <span className="block font-medium text-sm">Controlar stock (se vende tal como se compra)</span>
                  <span className="block text-xs text-muted-foreground">
                    Gaseosas, cervezas, agua, snacks… Cada venta descuenta 1 unidad y avisa cuando hay que comprar.
                    {stock?.mode === "resale" && ` Hay ${formatQty(stock.stock, "unid")}.`}
                  </span>
                </span>
              </label>
              {track && !wasResale && linkable.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="p-ingredient" className="text-xs">
                    ¿Ya lo tienes en el inventario?
                  </Label>
                  <select
                    id="p-ingredient"
                    value={ingredientId ?? ""}
                    onChange={(e) => choose(e.target.value ? Number(e.target.value) : null, true)}
                    className="w-full h-11 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value="">No, crearlo en el inventario{name.trim() ? ` como «${name.trim()}»` : ""}</option>
                    {linkable.map((o) => (
                      <option key={o.id} value={o.id}>
                        Sí: {o.name} · hay {formatQty(o.stock, o.unit)}
                      </option>
                    ))}
                  </select>
                  {chosen && (
                    <p className="text-xs text-primary">
                      Se une a «{chosen.name}» del inventario: cada venta descuenta de ahí, sin registrarlo dos veces.
                    </p>
                  )}
                </div>
              )}
              {track && (
                <div className="grid grid-cols-3 gap-2">
                  {!wasResale && !chosen && (
                    <StockInput id="p-initial" label="Hay ahora" value={initial} onChange={setInitial} />
                  )}
                  <StockInput id="p-min" label="Avisar al llegar a" value={minStock} onChange={setMinStock} />
                  <StockInput id="p-max" label="Stock ideal" value={maxStock} onChange={setMaxStock} />
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading || creatingCat}>
            {loading && <Loader2 className="animate-spin" />}
            {product ? "Guardar cambios" : "Agregar al menú"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StockInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="0"
          className="h-11 rounded-xl pr-11 tabular font-semibold"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">unid</span>
      </div>
    </div>
  );
}
