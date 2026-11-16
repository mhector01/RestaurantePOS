"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer, Search } from "lucide-react";
import { saveCount } from "@/app/inventory-actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/config";
import { formatQty, parseQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface Item {
  id: number;
  name: string;
  unit: string;
  stock: number;
  cost: number;
}

/** Hoja de conteo físico: se anota lo que realmente hay y el sistema registra las diferencias. */
export function CountSheet({ items, date }: { items: Item[]; date: string }) {
  const [counted, setCounted] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const q = query.trim().toLowerCase();

  const diffs = items
    .map((i) => {
      const raw = counted[i.id];
      if (raw === undefined || raw === "") return null;
      const n = parseQty(raw);
      if (!Number.isFinite(n) || n < 0) return null;
      return { ...i, counted: n, diff: Math.round((n - i.stock) * 1000) / 1000 };
    })
    .filter((d): d is Item & { counted: number; diff: number } => d !== null);
  const changes = diffs.filter((d) => d.diff !== 0);
  const valueDiff = changes.reduce((s, d) => s + d.diff * d.cost, 0);

  const save = async () => {
    if (diffs.length === 0) return toast.error("Anota al menos una cantidad contada");
    setSaving(true);
    try {
      const res = await saveCount(diffs.map((d) => ({ id: d.id, counted: d.counted })), `Conteo físico ${date}`);
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(
        res.changed ? `Conteo guardado: se ajustaron ${res.changed} insumo${res.changed === 1 ? "" : "s"}` : "Conteo guardado: todo cuadraba"
      );
      setCounted({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar insumo…"
            className="w-full h-12 rounded-xl border bg-card pl-11 pr-3 outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
          />
        </div>
        <Button variant="outline" className="h-12 rounded-xl" onClick={() => window.print()}>
          <Printer /> Imprimir hoja
        </Button>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Hoja de conteo de inventario</h1>
        <p className="text-sm">Fecha: {date} · Contado por: ______________________</p>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden print:border-black print:rounded-none">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem_8rem_6.5rem] sm:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem] gap-3 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/40">
          <span>Insumo</span>
          <span className="text-right">Sistema</span>
          <span className="text-center">Contado</span>
          <span className="text-right">Diferencia</span>
        </div>
        <ul className="divide-y">
          {items
            .filter((i) => !q || i.name.toLowerCase().includes(q))
            .map((i) => {
              const d = diffs.find((x) => x.id === i.id);
              return (
                <li
                  key={i.id}
                  className="grid grid-cols-[minmax(0,1fr)_6rem_8rem_6.5rem] sm:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem] gap-3 px-4 py-2 items-center break-inside-avoid"
                >
                  <span className="truncate text-sm font-medium">{i.name}</span>
                  <span className="text-right text-sm tabular text-muted-foreground">{formatQty(i.stock, i.unit)}</span>
                  <span className="relative">
                    <input
                      inputMode="decimal"
                      value={counted[i.id] ?? ""}
                      onChange={(e) => setCounted((c) => ({ ...c, [i.id]: e.target.value.replace(/[^\d.,]/g, "") }))}
                      aria-label={`Cantidad contada de ${i.name}`}
                      className="w-full h-10 rounded-lg border border-input bg-background pl-2.5 pr-10 tabular font-semibold outline-none focus:border-primary print:border-black"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{i.unit}</span>
                  </span>
                  <span
                    className={cn(
                      "text-right text-sm tabular font-medium",
                      !d || d.diff === 0 ? "text-muted-foreground" : d.diff < 0 ? "text-red-300" : "text-success"
                    )}
                  >
                    {d ? (d.diff === 0 ? "Cuadra" : `${d.diff > 0 ? "+" : ""}${formatQty(d.diff)}`) : ""}
                  </span>
                </li>
              );
            })}
        </ul>
      </div>

      <div className="sticky bottom-20 md:bottom-4 z-10 rounded-2xl border bg-popover/95 backdrop-blur p-4 flex flex-wrap items-center gap-3 shadow-xl print:hidden">
        <div className="flex-1 min-w-48 text-sm">
          <p>
            <b>{diffs.length}</b> contado{diffs.length === 1 ? "" : "s"} · <b>{changes.length}</b> con diferencia
          </p>
          {changes.length > 0 && (
            <p className={cn("text-xs", valueDiff < 0 ? "text-red-300" : "text-success")}>
              {valueDiff < 0 ? "Faltante" : "Sobrante"} valorizado: {formatMoney(Math.abs(valueDiff))}
            </p>
          )}
        </div>
        <Button className="h-12 rounded-xl px-6" onClick={save} disabled={saving || diffs.length === 0}>
          {saving && <Loader2 className="animate-spin" />} Guardar conteo
        </Button>
      </div>
    </div>
  );
}
