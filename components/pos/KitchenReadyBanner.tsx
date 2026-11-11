"use client";

import { useTransition } from "react";
import { BellRing, Check, ChefHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markTableServed } from "@/app/actions";

interface Props {
  tableId: number;
  ready: { name: string; quantity: number }[];
  pendingUnits: number;
}

/** Avisa al mesero qué ya salió de cocina y qué sigue preparándose. */
export function KitchenReadyBanner({ tableId, ready, pendingUnits }: Props) {
  const [pending, startTransition] = useTransition();

  if (ready.length === 0 && pendingUnits === 0) return null;

  if (ready.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-2 border-b bg-muted/40 text-sm text-muted-foreground flex items-center gap-2">
        <ChefHat className="size-4" />
        {pendingUnits} plato{pendingUnits === 1 ? "" : "s"} en preparación
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-2.5 border-b bg-success/10 flex items-center gap-3">
      <span className="size-9 rounded-full bg-success text-white grid place-items-center shrink-0 animate-pulse">
        <BellRing className="size-4" />
      </span>
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-semibold text-success">Listo para servir</p>
        <p className="truncate">
          {ready.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
          {pendingUnits > 0 && <span className="text-muted-foreground"> · {pendingUnits} aún en cocina</span>}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await markTableServed(tableId);
            toast.success("Marcado como servido");
          })
        }
        className="h-10 px-4 rounded-xl bg-success text-white text-sm font-medium inline-flex items-center gap-1.5 shrink-0 hover:opacity-90"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Servido
      </button>
    </div>
  );
}
