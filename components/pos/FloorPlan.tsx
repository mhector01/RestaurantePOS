"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, Plus, ShoppingBag, UserRound } from "lucide-react";
import { enableCounter } from "@/app/actions";
import { formatElapsed, formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface FloorTable {
  id: number;
  number: number;
  occupied: boolean;
  total: number;
  items: number;
  openedAt: string | null;
  waiter: string | null;
}

type Filter = "all" | "free" | "busy";

export function FloorPlan({ tables, counter }: { tables: FloorTable[]; counter: FloorTable | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const free = tables.filter((t) => !t.occupied).length;
  const busy = tables.length - free;
  const pendingTotal = [...tables, ...(counter ? [counter] : [])].reduce((s, t) => s + t.total, 0);

  const visible = tables.filter((t) =>
    filter === "all" ? true : filter === "free" ? !t.occupied : t.occupied
  );

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Todas", count: tables.length },
    { id: "free", label: "Libres", count: free },
    { id: "busy", label: "Ocupadas", count: busy },
  ];

  return (
    <div className="space-y-6">
      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Libres" value={String(free)} dot="bg-success" />
        <Stat label="Ocupadas" value={String(busy)} dot="bg-primary" />
        <Stat label="Por cobrar" value={formatMoney(pendingTotal)} />
      </div>

      {/* Para llevar */}
      {counter ? (
        <Link
          href={`/mesa/${counter.id}`}
          className={cn(
            "flex items-center gap-4 rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md active:scale-[0.99]",
            counter.occupied ? "bg-accent border-primary/30" : "bg-card"
          )}
        >
          <span
            className={cn(
              "size-12 sm:size-14 rounded-xl grid place-items-center shrink-0",
              counter.occupied ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
          >
            <ShoppingBag className="size-6" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base sm:text-lg">Para llevar / Mostrador</p>
            <p className="text-sm text-muted-foreground truncate">
              {counter.occupied
                ? `${counter.items} producto${counter.items === 1 ? "" : "s"} · ${formatMoney(counter.total)}`
                : "Venta rápida sin mesa"}
            </p>
          </div>
          <span
            className={cn(
              "h-11 px-4 sm:px-5 rounded-xl text-sm font-medium inline-flex items-center shrink-0",
              counter.occupied ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
            )}
          >
            {counter.occupied ? "Continuar" : "Nueva venta"}
          </span>
        </Link>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => enableCounter())}
          className="w-full flex items-center gap-3 rounded-2xl border border-dashed p-4 text-left text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">Habilitar ventas para llevar / mostrador</span>
        </button>
      )}

      {/* Filtros */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Mesas</h2>
        <div className="inline-flex rounded-xl bg-muted p-1" role="tablist">
          {filters.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium transition-all",
                filter === f.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-muted-foreground tabular">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grilla de mesas */}
      {tables.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Todavía no hay mesas</p>
          <p className="text-sm text-muted-foreground mt-1">
            El administrador puede crearlas en <span className="font-medium">Panel → Mesas</span>.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No hay mesas en este estado.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {visible.map((t) => (
            <TableCard key={t.id} table={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="rounded-2xl bg-card border px-3 py-3 sm:px-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {dot && <span className={cn("size-2 rounded-full", dot)} />}
        {label}
      </p>
      <p className="text-lg sm:text-2xl font-semibold tabular mt-0.5 truncate">{value}</p>
    </div>
  );
}

function TableCard({ table: t }: { table: FloorTable }) {
  return (
    <Link
      href={`/mesa/${t.id}`}
      className={cn(
        "group relative rounded-2xl border p-4 min-h-32 flex flex-col transition-all hover:shadow-md active:scale-[0.98]",
        t.occupied ? "bg-accent border-primary/30" : "bg-card hover:border-success/50"
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs text-muted-foreground font-medium">Mesa</span>
        <span
          className={cn(
            "text-[11px] font-medium px-2 py-0.5 rounded-full",
            t.occupied ? "bg-primary text-primary-foreground" : "bg-success/12 text-success"
          )}
        >
          {t.occupied ? "Ocupada" : "Libre"}
        </span>
      </div>
      <span className="text-4xl font-semibold tracking-tight leading-none mt-1">{t.number}</span>

      {t.occupied ? (
        <div className="mt-auto pt-3 space-y-1">
          <p className="text-base font-semibold tabular">{formatMoney(t.total)}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {t.openedAt && (
              <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                <Clock className="size-3" /> {formatElapsed(t.openedAt)}
              </span>
            )}
            {t.waiter && (
              <span className="inline-flex items-center gap-1 truncate">
                <UserRound className="size-3 shrink-0" /> <span className="truncate">{t.waiter.split(" ")[0]}</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-auto pt-3 text-xs text-muted-foreground group-hover:text-success transition-colors">
          Toca para abrir
        </p>
      )}
    </Link>
  );
}
