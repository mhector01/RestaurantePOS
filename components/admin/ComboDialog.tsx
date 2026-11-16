"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { createCategory } from "@/app/actions";
import { saveCombo } from "@/app/combo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BUSINESS, formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface ComboCategory {
  id: number;
  name: string;
}
export interface ComboComponentProduct {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}
export interface ComboData {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  slots: { name: string; quantity: number; options: { productId: number; extraPrice: number }[] }[];
}

interface SlotState {
  key: number;
  name: string;
  quantity: number;
  options: { productId: number; extra: string }[];
}

const SUGGESTED = ["Plato", "Acompañante", "Bebida", "Postre"];

export function ComboDialog({
  combo,
  products,
  categories,
}: {
  combo?: ComboData;
  products: ComboComponentProduct[];
  categories: ComboCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cats, setCats] = useState(categories);
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const byId = new Map(products.map((p) => [p.id, p]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const reset = () => {
    setName(combo?.name ?? "");
    setPrice(combo ? String(combo.price) : "");
    setCats(categories);
    const comboCat = categories.find((c) => c.name.toLowerCase() === "combos");
    setCategoryId(combo?.categoryId ?? comboCat?.id ?? null);
    const initial = combo
      ? combo.slots.map((s, i) => ({
          key: i + 1,
          name: s.name,
          quantity: s.quantity,
          options: s.options.map((o) => ({ productId: o.productId, extra: o.extraPrice ? String(o.extraPrice) : "" })),
        }))
      : [{ key: 1, name: "Plato", quantity: 1, options: [] }];
    setSlots(initial);
    setNextKey(initial.length + 1);
  };

  const addSlot = (slotName: string) => {
    setSlots((s) => [...s, { key: nextKey, name: slotName, quantity: 1, options: [] }]);
    setNextKey((k) => k + 1);
  };
  const updateSlot = (key: number, patch: Partial<SlotState>) =>
    setSlots((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const createCombosCategory = async () => {
    const cat = await createCategory("Combos");
    setCats((c) => (c.some((x) => x.id === cat.id) ? c : [...c, { id: cat.id, name: cat.name }]));
    setCategoryId(cat.id);
  };

  // Lo que costaría pedir todo por separado (con la primera opción de cada parte)
  const separate = slots.reduce((s, slot) => {
    const first = slot.options[0] && byId.get(slot.options[0].productId);
    return s + (first ? first.price * slot.quantity : 0);
  }, 0);
  const priceN = parseFloat(price.replace(",", "."));
  const saving$ = Number.isFinite(priceN) ? separate - priceN : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) return toast.error("Elige una categoría");
    if (!Number.isFinite(priceN) || priceN < 0) return toast.error("Precio no válido");
    const empty = slots.find((s) => s.options.length === 0);
    if (empty) return toast.error(`Agrega al menos un producto en "${empty.name || "la parte vacía"}"`);
    setSaving(true);
    try {
      const res = await saveCombo(combo?.id ?? null, {
        name,
        price: priceN,
        categoryId,
        slots: slots.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          options: s.options.map((o) => ({ productId: o.productId, extraPrice: parseFloat(o.extra.replace(",", ".")) || 0 })),
        })),
      });
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(combo ? "Combo actualizado" : "Combo creado");
      setOpen(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const hasCombosCat = cats.some((c) => c.name.toLowerCase() === "combos");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) reset();
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {combo ? (
          <Button variant="ghost" size="icon" className="size-10 rounded-xl" aria-label={`Editar ${combo.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" className="h-11 rounded-xl">
            <Layers /> Nuevo combo
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl rounded-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{combo ? "Editar combo" : "Nuevo combo"}</DialogTitle>
          <DialogDescription>
            Arma el combo por partes. Una parte con un solo producto va fija; con varios, el mesero elige uno al pedirlo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid sm:grid-cols-[minmax(0,1fr)_10rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nombre</Label>
              <Input
                id="c-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Combo Clásico"
                required
                autoFocus
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-price">Precio del combo</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{BUSINESS.currency}</span>
                <Input
                  id="c-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="0.00"
                  required
                  className="h-12 rounded-xl pl-9 text-lg font-semibold tabular"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoría en el menú</Label>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "h-9 px-3.5 rounded-full border text-sm font-medium transition-colors",
                    categoryId === c.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {c.name}
                </button>
              ))}
              {!hasCombosCat && (
                <button
                  type="button"
                  onClick={createCombosCategory}
                  className="h-9 px-3.5 rounded-full border border-dashed text-sm font-medium text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                >
                  <Plus className="size-4" /> Crear «Combos»
                </button>
              )}
            </div>
          </div>

          {/* Partes */}
          <div className="space-y-3">
            {slots.map((slot, idx) => {
              const used = new Set(slot.options.map((o) => o.productId));
              const fixed = slot.options.length === 1;
              return (
                <div key={slot.key} className="rounded-2xl border bg-background/40 p-3 sm:p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-primary/15 text-primary text-xs font-bold grid place-items-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      value={slot.name}
                      onChange={(e) => updateSlot(slot.key, { name: e.target.value })}
                      placeholder="Nombre de la parte (ej. Bebida)"
                      aria-label="Nombre de la parte"
                      className="flex-1 min-w-0 h-10 rounded-lg border border-input bg-card px-3 font-medium outline-none focus:border-primary"
                    />
                    <div className="flex items-center rounded-lg border bg-card" title="Cuántas unidades lleva">
                      <button
                        type="button"
                        aria-label="Menos"
                        disabled={slot.quantity <= 1}
                        onClick={() => updateSlot(slot.key, { quantity: slot.quantity - 1 })}
                        className="size-9 grid place-items-center disabled:opacity-30"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular">{slot.quantity}</span>
                      <button
                        type="button"
                        aria-label="Más"
                        onClick={() => updateSlot(slot.key, { quantity: slot.quantity + 1 })}
                        className="size-9 grid place-items-center"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label="Quitar parte"
                      onClick={() => setSlots((s) => s.filter((x) => x.key !== slot.key))}
                      className="size-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {slot.options.length > 0 && (
                    <ul className="space-y-1.5">
                      {slot.options.map((o) => {
                        const p = byId.get(o.productId);
                        return (
                          <li key={o.productId} className="flex items-center gap-2 rounded-xl bg-card border px-3 py-1.5">
                            <span className="flex-1 min-w-0 truncate text-sm">
                              {p?.name ?? "Producto eliminado"}
                              <span className="text-xs text-muted-foreground"> · {p ? formatMoney(p.price) : ""}</span>
                            </span>
                            {!fixed && (
                              <span className="relative w-24 shrink-0" title="Recargo si eligen esta opción">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">+{BUSINESS.currency}</span>
                                <input
                                  inputMode="decimal"
                                  value={o.extra}
                                  onChange={(e) =>
                                    updateSlot(slot.key, {
                                      options: slot.options.map((x) =>
                                        x.productId === o.productId ? { ...x, extra: e.target.value.replace(/[^\d.,]/g, "") } : x
                                      ),
                                    })
                                  }
                                  placeholder="0"
                                  aria-label={`Recargo por ${p?.name}`}
                                  className="w-full h-8 rounded-lg border border-input bg-background pl-8 pr-2 text-sm tabular outline-none focus:border-primary"
                                />
                              </span>
                            )}
                            <button
                              type="button"
                              aria-label={`Quitar ${p?.name}`}
                              onClick={() => updateSlot(slot.key, { options: slot.options.filter((x) => x.productId !== o.productId) })}
                              className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <select
                    value=""
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      if (id) updateSlot(slot.key, { options: [...slot.options, { productId: id, extra: "" }] });
                    }}
                    className="w-full h-10 rounded-xl border border-dashed border-input bg-card px-3 text-sm text-muted-foreground outline-none focus:border-primary"
                  >
                    <option value="">
                      {slot.options.length === 0 ? "+ Elegir producto…" : "+ Agregar otra opción para elegir…"}
                    </option>
                    {cats.map((c) => {
                      const list = products.filter((p) => p.categoryId === c.id && !used.has(p.id));
                      if (list.length === 0) return null;
                      return (
                        <optgroup key={c.id} label={c.name}>
                          {list.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatMoney(p.price)})
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {slot.options.length === 0
                      ? "Sin productos todavía."
                      : fixed
                        ? `Fijo: siempre lleva ${slot.quantity > 1 ? `${slot.quantity}× ` : ""}${byId.get(slot.options[0].productId)?.name}.`
                        : `El mesero elige 1 de ${slot.options.length}${slot.quantity > 1 ? ` (${slot.quantity} unidades)` : ""}. Recargo opcional por opción.`}
                  </p>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2">
              {SUGGESTED.filter((n) => !slots.some((s) => s.name.toLowerCase() === n.toLowerCase())).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addSlot(n)}
                  className="h-9 px-3 rounded-full border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1"
                >
                  <Plus className="size-3.5" /> {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addSlot("")}
                className="h-9 px-3 rounded-full border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex items-center gap-1"
              >
                <Plus className="size-3.5" /> Otra parte
              </button>
            </div>
          </div>

          {separate > 0 && Number.isFinite(priceN) && (
            <div className="rounded-2xl bg-muted/40 p-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">Por separado</p>
                <p className="font-semibold tabular">{formatMoney(separate)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Precio combo</p>
                <p className="font-semibold tabular">{formatMoney(priceN)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{saving$ >= 0 ? "Ahorro del cliente" : "Más caro que separado"}</p>
                <p className={cn("font-semibold tabular", saving$ >= 0 ? "text-success" : "text-red-300")}>
                  {formatMoney(Math.abs(saving$))}
                  {separate > 0 && <span className="text-xs font-normal"> ({Math.round((Math.abs(saving$) / separate) * 100)}%)</span>}
                </p>
              </div>
            </div>
          )}
          {catName.size === 0 && <p className="text-xs text-muted-foreground">Primero crea productos en el menú.</p>}

          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {combo ? "Guardar combo" : "Crear combo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
