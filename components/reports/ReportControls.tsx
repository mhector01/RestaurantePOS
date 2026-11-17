"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERIOD_PRESETS } from "@/lib/period";
import { cn } from "@/lib/utils";

/** Fila de periodos, arriba de todo el reporte: aplica a todos los indicadores y gráficos. */
export function PeriodFilter({ current, desde, hasta }: { current: string; desde: string; hasta: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [custom, setCustom] = useState(current === "rango");
  const [from, setFrom] = useState(desde);
  const [to, setTo] = useState(hasta);

  return (
    <div className="print:hidden space-y-2">
      <div className="-mx-4 sm:mx-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-1.5 px-4 sm:px-0 min-w-max">
          {PERIOD_PRESETS.map((p) => (
            <Link
              key={p.key}
              href={`${pathname}?p=${p.key}`}
              scroll={false}
              onClick={() => setCustom(false)}
              className={cn(
                "h-9 px-3 rounded-full border text-sm font-medium inline-flex items-center transition-colors",
                current === p.key && !custom ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
              )}
            >
              {p.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setCustom((v) => !v)}
            className={cn(
              "h-9 px-3 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 transition-colors",
              custom || current === "rango" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            )}
          >
            <CalendarRange className="size-4" /> Personalizado
          </button>
        </div>
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) router.push(`${pathname}?p=rango&desde=${from}&hasta=${to}`, { scroll: false });
          }}
        >
          <label className="text-xs text-muted-foreground">
            Desde
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="block h-10 rounded-xl border bg-card px-3 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="block h-10 rounded-xl border bg-card px-3 text-sm text-foreground" />
          </label>
          <Button type="submit" className="h-10 rounded-xl" disabled={!from || !to}>
            Aplicar
          </Button>
        </form>
      )}
    </div>
  );
}

/** Descargar en Excel (CSV) e imprimir / guardar como PDF en hoja completa. */
export function ReportActions({ csvHref, csvLabel = "Excel (CSV)" }: { csvHref?: string; csvLabel?: string }) {
  const print = () => {
    document.documentElement.classList.add("print-report");
    const done = () => {
      document.documentElement.classList.remove("print-report");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };
  return (
    <>
      {csvHref && (
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <a href={csvHref}>
            <Download /> {csvLabel}
          </a>
        </Button>
      )}
      <Button variant="outline" className="h-11 rounded-xl" onClick={print}>
        <Printer /> Imprimir / PDF
      </Button>
    </>
  );
}
