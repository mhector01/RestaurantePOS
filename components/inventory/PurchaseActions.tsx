"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ban, CircleCheck, Loader2, Percent } from "lucide-react";
import { setPurchasePaid, setPurchaseTax, voidPurchase } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/pos/ConfirmAction";

export function PurchaseActions({ id, paid, total, tax }: { id: number; paid: boolean; total: string; tax: number }) {
  const [pending, startTransition] = useTransition();
  const [editTax, setEditTax] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {editTax === null ? (
        <Button variant="ghost" size="sm" className="h-9 rounded-lg" onClick={() => setEditTax(tax ? String(tax) : "")}>
          <Percent className="size-4" /> ISV
        </Button>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await setPurchaseTax(id, parseFloat(editTax.replace(",", ".")) || 0);
              if (!res.success) return void toast.error(res.error ?? "No se pudo guardar");
              toast.success("ISV de la compra actualizado");
              setEditTax(null);
            });
          }}
        >
          <input
            autoFocus
            inputMode="decimal"
            value={editTax}
            onChange={(e) => setEditTax(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="ISV"
            aria-label="ISV de la factura de compra"
            className="w-24 h-9 rounded-lg border bg-card px-2 text-sm tabular outline-none focus:border-primary"
          />
          <Button type="submit" size="sm" className="h-9 rounded-lg" disabled={pending}>
            Guardar
          </Button>
        </form>
      )}
      {!paid && (
        <Button
          size="sm"
          className="h-9 rounded-lg bg-success hover:bg-success/90 text-white"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setPurchasePaid(id, true);
              toast.success(`Factura marcada como pagada (${total})`);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />} Pagar
        </Button>
      )}
      <ConfirmAction
        title={`¿Anular la compra #${id}?`}
        description="Se resta del stock lo que esta compra había sumado. Úsalo solo si se registró por error o se devolvió la mercadería."
        confirmLabel="Anular compra"
        successMessage="Compra anulada"
        action={() => voidPurchase(id)}
      >
        <Button variant="ghost" size="icon" className="size-9 rounded-lg text-muted-foreground hover:text-destructive" aria-label="Anular compra">
          <Ban className="size-4" />
        </Button>
      </ConfirmAction>
    </div>
  );
}
