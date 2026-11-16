"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markOrderServed } from "@/app/actions";

/** Marca un pedido para llevar como entregado al cliente. */
export function DeliverButton({ orderId, name }: { orderId: number; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markOrderServed(orderId);
          toast.success(`Pedido de ${name} entregado`);
        })
      }
      className="h-11 px-4 rounded-xl bg-success text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Entregar
    </button>
  );
}
