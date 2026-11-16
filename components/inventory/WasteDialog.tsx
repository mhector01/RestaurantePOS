"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash } from "lucide-react";
import { registerWaste } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QtyField } from "@/components/inventory/IngredientDialog";
import { formatMoney } from "@/lib/config";
import { WASTE_REASONS, formatQty, parseQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

/** Registrar una merma: lo que se pierde y por qué. */
export function WasteDialog({ ingredient }: { ingredient: { id: number; name: string; unit: string; stock: number; cost: number } }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<string>(WASTE_REASONS[0]);
  const [other, setOther] = useState("");
  const [loading, setLoading] = useState(false);

  const n = parseQty(qty || "0");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(n > 0)) return toast.error("Escribe cuánto se perdió");
    setLoading(true);
    try {
      const res = await registerWaste(ingredient.id, n, reason === "Otro" ? other || "Otro" : reason);
      if (!res.success) return toast.error(res.error ?? "No se pudo registrar");
      toast.success(`Merma registrada: ${formatQty(n, ingredient.unit)} de ${ingredient.name}`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setQty("");
          setReason(WASTE_REASONS[0]);
          setOther("");
        }
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-10 rounded-xl text-muted-foreground" title="Registrar merma">
          <Trash className="size-4" /> <span className="hidden xl:inline">Merma</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Merma de {ingredient.name}</DialogTitle>
          <DialogDescription>
            Hay {formatQty(ingredient.stock, ingredient.unit)}. Lo que registres se descuenta del stock y queda en el historial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <QtyField id="w-qty" label="Cantidad perdida" unit={ingredient.unit} value={qty} onChange={setQty} autoFocus />
          <div className="space-y-2">
            <Label>Motivo</Label>
            <div className="flex flex-wrap gap-2">
              {[...WASTE_REASONS, "Otro"].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "h-9 px-3 rounded-full border text-sm transition-colors",
                    reason === r ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {reason === "Otro" && (
              <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe el motivo" className="h-11 rounded-xl" />
            )}
          </div>
          {n > 0 && ingredient.cost > 0 && (
            <p className="text-sm text-muted-foreground">
              Pérdida estimada: <span className="font-semibold text-foreground">{formatMoney(n * ingredient.cost)}</span>
            </p>
          )}
          <Button type="submit" variant="destructive" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Registrar merma
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
