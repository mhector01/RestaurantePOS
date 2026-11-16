"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface ComboSlotView {
  id: number;
  name: string;
  quantity: number;
  options: { id: number; productId: number; name: string; extraPrice: number }[];
}
export interface ComboView {
  id: number;
  name: string;
  price: number;
  slots: ComboSlotView[];
}

/** El mesero elige las opciones de un combo (bebida, acompañante…) antes de agregarlo. */
export function ComboPicker({
  combo,
  soldOut,
  onClose,
  onConfirm,
}: {
  combo: ComboView | null;
  soldOut?: Set<number>;
  onClose: () => void;
  onConfirm: (selection: Record<number, number>, price: number, detail: string) => void;
}) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [forId, setForId] = useState<number | null>(null);
  // Al abrir otro combo se empieza de cero
  if (combo && combo.id !== forId) {
    setForId(combo.id);
    setPicked({});
  }

  if (!combo) return null;
  const choiceSlots = combo.slots.filter((s) => s.options.length > 1);
  const missing = choiceSlots.filter((s) => !picked[s.id]);
  const extra = choiceSlots.reduce((sum, s) => sum + (s.options.find((o) => o.id === picked[s.id])?.extraPrice ?? 0), 0);
  const detail = combo.slots
    .map((s) => {
      const o = s.options.length === 1 ? s.options[0] : s.options.find((x) => x.id === picked[s.id]);
      return o ? (s.quantity > 1 ? `${s.quantity}× ${o.name}` : o.name) : null;
    })
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg rounded-3xl max-h-[92dvh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle className="text-xl">{combo.name}</DialogTitle>
          <DialogDescription>
            {combo.slots
              .filter((s) => s.options.length === 1)
              .map((s) => (s.quantity > 1 ? `${s.quantity}× ${s.options[0].name}` : s.options[0].name))
              .join(" + ") || "Elige las opciones del combo"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 space-y-5 pb-5">
          {choiceSlots.map((slot) => (
            <section key={slot.id}>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                {slot.name}
                {slot.quantity > 1 && <span className="text-xs text-muted-foreground">({slot.quantity} unidades)</span>}
                {!picked[slot.id] && (
                  <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-primary/15 text-primary">Elige 1</span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {slot.options.map((o) => {
                  const active = picked[slot.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [slot.id]: o.id }))}
                      className={cn(
                        "min-h-14 rounded-xl border-2 px-3 py-2 text-left flex items-center gap-2 transition-colors",
                        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                      )}
                    >
                      <span
                        className={cn(
                          "size-5 rounded-full border-2 grid place-items-center shrink-0",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                        )}
                      >
                        {active && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-snug">{o.name}</span>
                        {o.extraPrice > 0 && (
                          <span className="block text-xs text-primary tabular">+{formatMoney(o.extraPrice)}</span>
                        )}
                        {soldOut?.has(o.productId) && (
                          <span className="block text-[11px] font-semibold text-red-300">Sin stock</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="sticky bottom-0 border-t bg-popover p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-semibold tabular">{formatMoney(combo.price + extra)}</p>
          </div>
          <Button
            className="h-12 rounded-xl px-5 text-base"
            disabled={missing.length > 0}
            onClick={() => onConfirm(picked, combo.price + extra, detail)}
          >
            <Plus /> {missing.length > 0 ? `Falta ${missing[0].name.toLowerCase()}` : "Agregar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
