"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export type ValueFormat = "money" | "int" | "pct";

export function fmtValue(v: number, f: ValueFormat) {
  if (f === "money") return formatMoney(v);
  if (f === "pct") return `${Math.round(v * 1000) / 10}%`;
  return Math.round(v).toLocaleString("es-HN");
}

/** Número compacto para ejes: 950 · 1.2K · 15K · 1.3M */
function compact(v: number, f: ValueFormat) {
  if (f === "pct") return `${Math.round(v * 100)}%`;
  const abs = Math.abs(v);
  const s = abs >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : abs >= 10_000 ? `${Math.round(v / 1000)}K` : abs >= 1000 ? `${+(v / 1000).toFixed(1)}K` : `${Math.round(v)}`;
  return f === "money" ? `${formatMoney(0).replace(/[\d.,\s]/g, "")}${s}` : s;
}

/** Máximo "redondo" para el eje y sus marcas. */
function niceScale(max: number) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(t);
  return { top, ticks };
}

export interface ColumnDatum {
  key: string;
  label: string; // etiqueta corta del eje
  long: string; // texto del tooltip
  value: number;
  note?: string; // dato extra en el tooltip (ej. "12 cuentas")
}

/**
 * Columnas verticales de una sola serie con eje Y, tooltip por columna y la mayor resaltada.
 * La columna más alta lleva su valor encima (etiqueta selectiva).
 */
export function ColumnChart({
  data,
  format = "money",
  height = 220,
  color = "var(--series-1)",
  emptyText = "Sin datos en este periodo",
}: {
  data: ColumnDatum[];
  format?: ValueFormat;
  height?: number;
  color?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const { top, ticks } = niceScale(max);
  const peak = data.findIndex((d) => d.value === max && max > 0);
  // Con muchas columnas se muestran menos etiquetas en el eje X
  const every = data.length > 24 ? Math.ceil(data.length / 12) : 1;

  if (max <= 0) {
    return (
      <div className="grid place-items-center text-sm text-muted-foreground rounded-xl border border-dashed" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className="relative select-none pt-3" role="img" aria-label="Gráfico de columnas">
      <div className="flex">
        {/* Eje Y */}
        <div className="relative w-12 shrink-0 text-[10px] text-muted-foreground tabular" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t, format)}
            </span>
          ))}
        </div>
        {/* Área del gráfico */}
        <div className="relative flex-1 min-w-0" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-border" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const h = (d.value / top) * 100;
              return (
                <button
                  key={d.key}
                  type="button"
                  tabIndex={0}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((x) => (x === i ? null : x))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((x) => (x === i ? null : x))}
                  aria-label={`${d.long}: ${fmtValue(d.value, format)}`}
                  className="relative flex-1 h-full flex items-end justify-center outline-none group"
                >
                  {hover === i && <span className="absolute inset-0 bg-foreground/5 rounded" />}
                  <span
                    className="relative w-full max-w-6 rounded-t-[4px] transition-[filter]"
                    style={{
                      height: `${h}%`,
                      minHeight: d.value > 0 ? 2 : 0,
                      background: color,
                      filter: hover === i ? "brightness(1.2)" : undefined,
                    }}
                  />
                  {i === peak && hover === null && (
                    <span className="absolute -translate-y-full text-[10px] font-semibold tabular whitespace-nowrap pb-1" style={{ bottom: `${h}%` }}>
                      {compact(d.value, format)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border bg-popover px-3 py-2 shadow-xl text-xs whitespace-nowrap"
              style={{
                left: `${((hover + 0.5) / data.length) * 100}%`,
                bottom: `${Math.min(100, (data[hover].value / top) * 100)}%`,
                marginBottom: 8,
              }}
            >
              <p className="text-sm font-semibold tabular">{fmtValue(data[hover].value, format)}</p>
              <p className="text-muted-foreground">{data[hover].long}</p>
              {data[hover].note && <p className="text-muted-foreground">{data[hover].note}</p>}
            </div>
          )}
        </div>
      </div>
      {/* Eje X */}
      <div className="flex ml-12 mt-1.5 gap-[2px] text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 text-center truncate">
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface BarRow {
  label: string;
  value: number;
  sub?: string;
  extra?: string; // dato a la derecha bajo el valor
}

/** Ranking horizontal (productos, meseros, categorías): nombre, barra y valor. */
export function BarList({
  rows,
  format = "money",
  color = "var(--series-1)",
  limit,
  emptyText = "Sin datos",
}: {
  rows: BarRow[];
  format?: ValueFormat;
  color?: string;
  limit?: number;
  emptyText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(0, ...rows.map((r) => r.value));
  const shown = limit && !expanded ? rows.slice(0, limit) : rows;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>;
  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((r, i) => (
          <li key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium truncate">{r.label}</span>
                {r.sub && <span className="text-xs text-muted-foreground truncate">{r.sub}</span>}
              </div>
              <div className="mt-1 h-2 rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${max > 0 ? Math.max(1, (r.value / max) * 100) : 0}%`, background: color }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular">{fmtValue(r.value, format)}</p>
              {r.extra && <p className="text-[11px] text-muted-foreground tabular">{r.extra}</p>}
            </div>
          </li>
        ))}
      </ul>
      {limit && rows.length > limit && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-sm font-medium text-primary print:hidden">
          {expanded ? "Ver menos" : `Ver los ${rows.length}`}
        </button>
      )}
    </div>
  );
}

/** Barra segmentada (un todo dividido en partes) con leyenda: formas de pago, canal… */
export function SegmentedBar({
  parts,
  format = "money",
}: {
  parts: { label: string; value: number; color: string }[];
  format?: ValueFormat;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground">Sin datos</p>;
  return (
    <div>
      <div className="flex h-7 gap-[2px]">
        {parts.map((p, i) =>
          p.value > 0 ? (
            <div
              key={p.label}
              tabIndex={0}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${fmtValue(p.value, format)} (${Math.round((p.value / total) * 100)}%)`}
              className="h-full rounded-[4px] flex items-center px-2 text-[11px] font-semibold text-white overflow-hidden outline-none"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color, filter: hover === i ? "brightness(1.15)" : undefined }}
            >
              {p.value / total >= 0.12 ? `${Math.round((p.value / total) * 100)}%` : ""}
            </div>
          ) : null
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {parts.map((p, i) => (
          <li key={p.label} className={cn("flex items-center gap-2 text-sm", hover === i && "font-semibold")}>
            <span className="size-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="font-semibold tabular">{fmtValue(p.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
