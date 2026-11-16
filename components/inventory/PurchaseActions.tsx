"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Ban, CircleCheck, Loader2 } from "lucide-react";
import { setPurchasePaid, voidPurchase } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/pos/ConfirmAction";

export function PurchaseActions({ id, paid, total }: { id: number; paid: boolean; total: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-1">
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
