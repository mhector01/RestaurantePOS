"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Store } from "lucide-react";
import { saveIngredient } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BUSINESS, formatMoney } from "@/lib/config";
import { UNITS, parseQty } from "@/lib/inventory";
import { TAX_RATES } from "@/lib/fiscal";
import { cn } from "@/lib/utils";

export interface IngredientRow {
  id: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  maxStock: number | null;
  cost: number;
  supplierId: number | null;
}
export interface SupplierOption {
  id: number;
  name: string;
}
export interface CategoryOption {
  id: number;
  name: string;
}
/** Producto del menú con el que se vende este insumo tal cual (si lo hay). */
export interface SoldAs {
  name: string;
  price: number;
}

/** Bebidas alcohólicas y tabaco pagan ISV 18%. */
const looksAlcohol = (name: string) =>
  /cerveza|beer|vino|ron\b|whisk|guaro|aguardiente|tequila|vodka|licor|ginebra|gin\b|cigarr|tabaco|michelada|salva ?vida|imperial|port royal|barena/i.test(name);

interface Props {
  ingredient?: IngredientRow;
  suppliers: SupplierOption[];
  defaultName?: string;
  onSaved?: (id: number, data: { name: string; unit: string; cost: number }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode | null; // null = sin botón (diálogo controlado desde afuera)
  /** Para venderlo en el menú en el mismo paso; sin categorías no se ofrece esa opción. */
  categories?: CategoryOption[];
  soldAs?: SoldAs | null;
  /** Abrir con "También se vende en el menú" ya marcado (botón "Vender en el menú"). */
  sellFirst?: boolean;
}

const numText = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? "" : String(n));

export function IngredientDialog({ ingredient, suppliers, defaultName, onSaved, open, onOpenChange, trigger, categories, soldAs, sellFirst }: Props) {
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("unid");
  const [stock, setStock] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [cost, setCost] = useState("");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [sell, setSell] = useState(false);
  const [sellPrice, setSellPrice] = useState("");
  const [sellCat, setSellCat] = useState<string>(""); // id de categoría o "new"
  const [newCat, setNewCat] = useState("");
  const [tax, setTax] = useState("15");
  const canSell = !!categories && !soldAs;

  const startSelling = (on: boolean, currentName: string) => {
    setSell(on);
    if (on) {
      setTax(looksAlcohol(currentName) ? "18" : "15");
      const bebidas = categories?.find((c) => /bebida|cerveza|refresco|licor/i.test(c.name));
      setSellCat(bebidas ? String(bebidas.id) : categories?.length ? String(categories[0].id) : "new");
      if (!categories?.length) setNewCat("Bebidas");
    }
  };

  const reset = () => {
    setName(ingredient?.name ?? defaultName ?? "");
    setUnit(ingredient?.unit ?? "unid");
    setStock("");
    setMin(numText(ingredient?.minStock));
    setMax(numText(ingredient?.maxStock));
    setCost(numText(ingredient?.cost));
    setSupplierId(ingredient?.supplierId ?? null);
    setSellPrice("");
    setNewCat("");
    startSelling(!!sellFirst && canSell, ingredient?.name ?? defaultName ?? "");
  };

  const change = (v: boolean) => {
    if (v) reset();
    setInnerOpen(v);
    onOpenChange?.(v);
  };

  const unitLabel = UNITS.find((u) => u.value === unit)?.value ?? unit;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = { min: parseQty(min || "0"), max: max ? parseQty(max) : null, cost: parseQty(cost || "0"), stock: parseQty(stock || "0") };
    if ([values.min, values.cost, values.stock].some((n) => Number.isNaN(n) || n < 0) || (values.max !== null && Number.isNaN(values.max))) {
      return toast.error("Revisa las cantidades: deben ser números positivos");
    }
    if (values.max !== null && values.max > 0 && values.max < values.min) {
      return toast.error("El stock ideal debe ser mayor que el mínimo");
    }
    const sellData =
      sell && canSell
        ? { price: parseFloat(sellPrice), categoryId: sellCat && sellCat !== "new" ? Number(sellCat) : null, newCategory: newCat, taxRate: tax }
        : null;
    if (sellData && !(sellData.price > 0)) return toast.error("Escribe el precio de venta en el menú");
    if (sellData && !sellData.categoryId && !newCat.trim()) return toast.error("Escribe el nombre de la categoría del menú");
    setLoading(true);
    try {
      const res = await saveIngredient(ingredient?.id ?? null, {
        name,
        unit,
        minStock: values.min,
        maxStock: values.max,
        cost: values.cost,
        supplierId,
        initialStock: values.stock,
      }, sellData);
      if (!res.success || !res.id) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(
        sellData ? `Listo: "${name.trim()}" quedó en el inventario y en el menú` : ingredient ? "Insumo actualizado" : "Insumo agregado"
      );
      onSaved?.(res.id, { name: name.trim(), unit, cost: values.cost });
      change(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={change}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ??
            (ingredient ? (
              <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${ingredient.name}`}>
                <Pencil className="size-4" />
              </Button>
            ) : (
              <Button className="h-11 rounded-xl">
                <Plus /> Nuevo insumo
              </Button>
            ))}
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ingredient ? "Editar insumo" : "Nuevo insumo"}</DialogTitle>
          <DialogDescription>
            Materia prima (pollo, queso, aceite) o producto que revendes tal cual (gaseosas, cervezas).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="i-name">Nombre</Label>
            <Input
              id="i-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pechuga de pollo"
              required
              autoFocus
              className="h-12 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Unidad de medida</Label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUnit(u.value)}
                  className={cn(
                    "h-10 px-3.5 rounded-full border text-sm font-medium transition-colors",
                    unit === u.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Usa la misma unidad en compras y recetas. Si compras por caja, regístralo en unidades.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!ingredient && (
              <QtyField id="i-stock" label="Stock actual" unit={unitLabel} value={stock} onChange={setStock} hint="Lo que hay hoy" />
            )}
            <QtyField
              id="i-cost"
              label={`Costo por ${unitLabel}`}
              prefix={BUSINESS.currency}
              value={cost}
              onChange={setCost}
              hint={ingredient ? "Se recalcula con cada compra" : "Lo que te cuesta"}
            />
            <QtyField id="i-min" label="Stock mínimo" unit={unitLabel} value={min} onChange={setMin} hint="Avisar al llegar aquí" />
            <QtyField id="i-max" label="Stock ideal" unit={unitLabel} value={max} onChange={setMax} hint="Hasta dónde reponer" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="i-supplier">Proveedor habitual</Label>
            <select
              id="i-supplier"
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-primary"
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Sirve para armar la lista de compras por proveedor.</p>
          </div>

          {soldAs ? (
            <p className="rounded-2xl border bg-muted/40 p-3 text-sm text-muted-foreground flex gap-2">
              <Store className="size-4 mt-0.5 shrink-0 text-primary" />
              <span>
                Se vende en el menú como <b className="text-foreground">{soldAs.name}</b> a {formatMoney(soldAs.price)}. Cada venta descuenta 1{" "}
                {unitLabel}. El precio se cambia en Menú.
              </span>
            </p>
          ) : (
            canSell && (
              <div className={cn("rounded-2xl border p-3 space-y-3", sell && "border-primary/40 bg-primary/5")}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sell}
                    onChange={(e) => startSelling(e.target.checked, name)}
                    className="mt-1 size-5 accent-[var(--primary)]"
                  />
                  <span className="flex-1">
                    <span className="block font-medium text-sm">También se vende tal cual en el menú</span>
                    <span className="block text-xs text-muted-foreground">
                      Cervezas, gaseosas, agua, snacks… Se agrega al menú de los meseros y cada venta descuenta 1 {unitLabel} de aquí. No hay
                      que registrarlo otra vez.
                    </span>
                  </span>
                </label>
                {sell && (
                  <div className="space-y-3">
                    <QtyField id="i-sell-price" label="Precio de venta" prefix={BUSINESS.currency} value={sellPrice} onChange={setSellPrice} hint="El que cobra el mesero (incluye ISV)" />
                    <div className="space-y-1.5">
                      <Label htmlFor="i-sell-cat">Categoría en el menú</Label>
                      <select
                        id="i-sell-cat"
                        value={sellCat}
                        onChange={(e) => setSellCat(e.target.value)}
                        className="w-full h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-primary"
                      >
                        {categories!.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="new">+ Nueva categoría…</option>
                      </select>
                      {sellCat === "new" && (
                        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Ej. Bebidas" className="h-11 rounded-xl" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Impuesto (ISV)</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {TAX_RATES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setTax(t.value)}
                            title={t.hint}
                            className={cn(
                              "h-10 rounded-xl border text-sm font-medium transition-colors",
                              tax === t.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{TAX_RATES.find((t) => t.value === tax)?.hint}.</p>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {sell && canSell ? (ingredient ? "Guardar y agregar al menú" : "Agregar al inventario y al menú") : ingredient ? "Guardar cambios" : "Agregar insumo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QtyField({
  id,
  label,
  value,
  onChange,
  unit,
  prefix,
  hint,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  prefix?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <Input
          id={id}
          inputMode="decimal"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          placeholder="0"
          className={cn("h-12 rounded-xl tabular font-semibold", prefix && "pl-8", unit && "pr-12")}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{unit}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
