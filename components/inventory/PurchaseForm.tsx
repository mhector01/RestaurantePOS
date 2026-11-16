"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { createPurchase } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IngredientDialog, type SupplierOption } from "@/components/inventory/IngredientDialog";
import { BUSINESS, formatMoney } from "@/lib/config";
import { formatQty, parseQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

export interface PurchaseIngredient {
  id: number;
  name: string;
  unit: string;
  stock: number;
  cost: number;
  supplierId: number | null;
}

interface Line {
  key: number;
  ingredientId: number;
  qty: string;
  unitCost: string;
  total: string;
}

const money = (n: number) => (Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : "");

export function PurchaseForm({
  ingredients: initialIngredients,
  suppliers,
  today,
  initialSupplierId,
  initialLines,
}: {
  ingredients: PurchaseIngredient[];
  suppliers: SupplierOption[];
  today: string;
  initialSupplierId: number | null;
  initialLines: { ingredientId: number; quantity: number }[];
}) {
  const router = useRouter();
  const keyRef = useRef(1);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const lineFor = (ingredientId: number, quantity?: number): Line => {
    const ing = ingredients.find((i) => i.id === ingredientId);
    const cost = ing?.cost ?? 0;
    return {
      key: keyRef.current++,
      ingredientId,
      qty: quantity ? String(quantity) : "",
      unitCost: money(cost),
      total: quantity ? money(quantity * cost) : "",
    };
  };

  const [supplierId, setSupplierId] = useState<number | null>(initialSupplierId);
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(() => initialLines.map((l) => lineFor(l.ingredientId, l.quantity)));
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosen = new Set(lines.map((l) => l.ingredientId));
  const q = query.trim().toLowerCase();
  const matches = ingredients
    .filter((i) => !chosen.has(i.id) && (!q || i.name.toLowerCase().includes(q)))
    // Primero los del proveedor elegido
    .sort((a, b) => Number(b.supplierId === supplierId) - Number(a.supplierId === supplierId) || a.name.localeCompare(b.name))
    .slice(0, 8);
  const exact = ingredients.some((i) => i.name.toLowerCase() === q);

  const addLine = (id: number) => {
    setLines((ls) => [...ls, lineFor(id)]);
    setQuery("");
    setTimeout(() => document.getElementById(`qty-${id}`)?.focus(), 0);
  };

  const update = (key: number, field: "qty" | "unitCost" | "total", value: string) => {
    const clean = value.replace(/[^\d.,]/g, "");
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, [field]: clean };
        const qn = parseQty(next.qty);
        if (field === "total") {
          const t = parseQty(clean);
          if (qn > 0 && t >= 0) next.unitCost = money(t / qn) || "0";
        } else {
          const c = parseQty(next.unitCost);
          if (qn > 0 && c >= 0) next.total = money(qn * c);
        }
        return next;
      })
    );
  };

  const total = lines.reduce((s, l) => {
    const t = parseQty(l.total);
    return s + (Number.isFinite(t) ? t : 0);
  }, 0);

  const submit = async () => {
    const items = lines.map((l) => ({
      ingredientId: l.ingredientId,
      quantity: parseQty(l.qty),
      unitCost: parseQty(l.qty) > 0 ? parseQty(l.total || "0") / parseQty(l.qty) : 0,
    }));
    if (items.length === 0) return toast.error("Agrega al menos un insumo");
    const bad = items.find((i) => !(i.quantity > 0));
    if (bad) return toast.error(`Falta la cantidad de ${byId.get(bad.ingredientId)?.name}`);
    setSaving(true);
    try {
      const res = await createPurchase({ supplierId, invoice, date, paid, notes, items });
      if (!res.success) return toast.error(res.error ?? "No se pudo registrar");
      toast.success(`Compra registrada por ${formatMoney(total)}. El stock ya se actualizó.`);
      router.push("/admin/inventario/compras");
    } catch {
      toast.error("No se pudo registrar la compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        {/* Datos de la factura */}
        <section className="rounded-2xl border bg-card p-4 sm:p-5 grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="pf-supplier">Proveedor</Label>
            <select
              id="pf-supplier"
              value={supplierId ?? ""}
              onChange={(e) => setSupplierId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full h-12 rounded-xl border border-input bg-card px-3 outline-none focus:border-primary"
            >
              <option value="">Sin proveedor (compra en mercado, supermercado…)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-invoice">N.º de factura</Label>
            <Input id="pf-invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Opcional" className="h-12 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-date">Fecha</Label>
            <Input id="pf-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Pago</Label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl border bg-muted/40 h-12">
              {[
                { v: true, label: "Pagada" },
                { v: false, label: "A crédito" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPaid(o.v)}
                  className={cn(
                    "rounded-lg text-sm font-medium transition-colors",
                    paid === o.v ? (o.v ? "bg-success text-white" : "bg-amber-400 text-black") : "text-muted-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Insumos */}
        <section className="rounded-2xl border bg-card">
          <div className="p-4 sm:p-5 border-b">
            <Label htmlFor="pf-search" className="mb-2 block">
              Insumos recibidos
            </Label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
              <input
                id="pf-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (matches[0]) addLine(matches[0].id);
                    else if (q) setCreating(query.trim());
                  }
                }}
                placeholder="Busca un insumo para agregarlo…"
                autoComplete="off"
                className="w-full h-12 rounded-xl border bg-background pl-11 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
              />
              {focused && (matches.length > 0 || q) && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border bg-popover shadow-xl overflow-hidden">
                  {matches.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addLine(i.id)}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-muted"
                    >
                      <span className="flex-1 truncate">{i.name}</span>
                      <span className="text-xs text-muted-foreground tabular">
                        hay {formatQty(i.stock, i.unit)} · {formatMoney(i.cost)}/{i.unit}
                      </span>
                    </button>
                  ))}
                  {q && !exact && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setCreating(query.trim())}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-primary hover:bg-muted border-t"
                    >
                      <Plus className="size-4" /> Crear insumo «{query.trim()}»
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Busca arriba lo que llegó en la factura.</p>
          ) : (
            <ul className="divide-y">
              {lines.map((l) => {
                const ing = byId.get(l.ingredientId);
                if (!ing) return null;
                const qn = parseQty(l.qty);
                const unitCost = qn > 0 ? parseQty(l.total || "0") / qn : NaN;
                const change = ing.cost > 0 && unitCost > 0 ? (unitCost - ing.cost) / ing.cost : 0;
                return (
                  <li key={l.key} className="p-4 sm:px-5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <p className="font-medium flex-1 min-w-0 truncate">{ing.name}</p>
                      {Math.abs(change) >= 0.1 && (
                        <span
                          className={cn(
                            "text-[11px] font-medium rounded-full px-2 py-0.5 inline-flex items-center gap-1",
                            change > 0 ? "bg-red-500/15 text-red-300" : "bg-success/15 text-success"
                          )}
                          title={`Costo promedio actual: ${formatMoney(ing.cost)} por ${ing.unit}`}
                        >
                          {change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          {change > 0 ? "Subió" : "Bajó"} {Math.round(Math.abs(change) * 100)}%
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label={`Quitar ${ing.name}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="size-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <LineInput id={`qty-${ing.id}`} label="Cantidad" suffix={ing.unit} value={l.qty} onChange={(v) => update(l.key, "qty", v)} />
                      <LineInput label={`Costo / ${ing.unit}`} prefix={BUSINESS.currency} value={l.unitCost} onChange={(v) => update(l.key, "unitCost", v)} />
                      <LineInput label="Total línea" prefix={BUSINESS.currency} value={l.total} onChange={(v) => update(l.key, "total", v)} />
                    </div>
                    {qn > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 tabular">
                        Stock: {formatQty(ing.stock, ing.unit)} → <span className="text-foreground font-medium">{formatQty(ing.stock + qn, ing.unit)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Resumen */}
      <aside className="rounded-2xl border bg-card p-5 space-y-4 lg:sticky lg:top-6">
        <div>
          <p className="text-sm text-muted-foreground">Total de la factura</p>
          <p className="text-3xl font-semibold tabular">{formatMoney(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {lines.length} insumo{lines.length === 1 ? "" : "s"} · {paid ? "Pagada" : "Queda pendiente de pago"}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-notes">Notas</Label>
          <textarea
            id="pf-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opcional. Ej. faltó 1 caja, viene el lunes"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary resize-none"
          />
        </div>
        <Button className="w-full h-12 rounded-xl text-base" onClick={submit} disabled={saving || lines.length === 0}>
          {saving && <Loader2 className="animate-spin" />} Registrar compra
        </Button>
        <p className="text-xs text-muted-foreground">
          Al registrarla se suma al stock y se recalcula el costo promedio de cada insumo.
        </p>
      </aside>

      <IngredientDialog
        trigger={null}
        open={creating !== null}
        onOpenChange={(v) => !v && setCreating(null)}
        defaultName={creating ?? ""}
        suppliers={suppliers}
        onSaved={(id, data) => {
          setIngredients((list) => [...list, { id, name: data.name, unit: data.unit, stock: 0, cost: data.cost, supplierId }]);
          setLines((ls) => [...ls, { key: keyRef.current++, ingredientId: id, qty: "", unitCost: money(data.cost), total: "" }]);
          setQuery("");
        }}
      />
    </div>
  );
}

function LineInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="relative block mt-0.5">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={cn(
            "w-full h-11 rounded-xl border border-input bg-background px-2.5 tabular font-semibold outline-none focus:border-primary",
            prefix && "pl-7",
            suffix && "pr-10"
          )}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{suffix}</span>}
      </span>
    </label>
  );
}
