"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { addTables, deleteTable, enableCounter } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { cn } from "@/lib/utils";

interface Table {
  id: number;
  number: number;
  status: string;
}

export function TablesManager({ tables, hasCounter }: { tables: Table[]; hasCounter: boolean }) {
  const [count, setCount] = useState(1);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      await addTables(count);
      toast.success(count === 1 ? "Mesa agregada" : `${count} mesas agregadas`);
      setCount(1);
    });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-semibold">Agregar mesas</h2>
          <p className="text-sm text-muted-foreground">Se numeran a continuación de la última.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border">
            <button
              type="button"
              aria-label="Menos"
              className="size-11 grid place-items-center disabled:opacity-30"
              disabled={count <= 1}
              onClick={() => setCount((c) => c - 1)}
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center font-semibold tabular">{count}</span>
            <button
              type="button"
              aria-label="Más"
              className="size-11 grid place-items-center disabled:opacity-30"
              disabled={count >= 20}
              onClick={() => setCount((c) => c + 1)}
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button className="h-11 rounded-xl" onClick={add} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Agregar
          </Button>
        </div>
      </section>

      {!hasCounter && (
        <section className="rounded-2xl border border-dashed p-5 flex items-center gap-4">
          <ShoppingBag className="size-6 text-muted-foreground" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Para llevar / mostrador</span>
            <span className="text-muted-foreground"> — habilita ventas rápidas sin mesa.</span>
          </p>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => startTransition(() => enableCounter())}>
            Habilitar
          </Button>
        </section>
      )}

      {tables.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">Aún no hay mesas.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {tables.map((t) => (
            <div
              key={t.id}
              className={cn(
                "relative rounded-2xl border bg-card p-4 flex flex-col items-center",
                t.status !== "FREE" && "bg-accent border-primary/30"
              )}
            >
              <span className="text-xs text-muted-foreground">Mesa</span>
              <span className="text-3xl font-semibold">{t.number}</span>
              <span className={cn("text-xs mt-1", t.status === "FREE" ? "text-success" : "text-primary")}>
                {t.status === "FREE" ? "Libre" : "Ocupada"}
              </span>
              {t.status === "FREE" && (
                <ConfirmAction
                  title={`¿Eliminar la mesa ${t.number}?`}
                  description="Solo se pueden eliminar mesas sin ventas registradas."
                  confirmLabel="Eliminar"
                  successMessage="Mesa eliminada"
                  action={() => deleteTable(t.id)}
                >
                  <button
                    type="button"
                    aria-label={`Eliminar mesa ${t.number}`}
                    className="absolute top-1.5 right-1.5 size-8 grid place-items-center rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </ConfirmAction>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
