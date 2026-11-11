"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Clock, LayoutGrid, Map as MapIcon, Plus, ShoppingBag, UserRound, UsersRound } from "lucide-react";
import { enableCounter } from "@/app/actions";
import { formatElapsed, formatMoney } from "@/lib/config";
import { CELL, canvasSize, placeTables, type TableShape } from "@/lib/floor";
import { FloorCanvas, TableShapeView, type TableTone } from "@/components/floor/FloorCanvas";
import { cn } from "@/lib/utils";

export interface FloorTable {
  id: number;
  number: number;
  occupied: boolean;
  total: number;
  items: number;
  openedAt: string | null;
  waiter: string | null;
  ready: number; // platos listos en cocina esperando ser servidos
  shape: TableShape;
  seats: number;
  x: number | null;
  y: number | null;
  areaId: number | null;
}

export interface FloorArea {
  id: number;
  name: string;
}

type View = "plan" | "list";
type Filter = "all" | "free" | "busy";

function toneOf(t: FloorTable): TableTone {
  if (t.ready > 0) return "ready";
  return t.occupied ? "busy" : "free";
}

export function FloorPlan({
  tables,
  counter,
  areas,
}: {
  tables: FloorTable[];
  counter: FloorTable | null;
  areas: FloorArea[];
}) {
  const [view, setView] = useState<View>("plan");
  const [areaId, setAreaId] = useState<number | null>(areas[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();

  const firstAreaId = areas[0]?.id ?? null;
  const currentId = areas.some((a) => a.id === areaId) ? areaId : firstAreaId;
  const inArea = useMemo(
    () => tables.filter((t) => (t.areaId ?? firstAreaId) === currentId),
    [tables, currentId, firstAreaId]
  );

  const free = tables.filter((t) => !t.occupied).length;
  const busy = tables.length - free;
  const pendingTotal = [...tables, ...(counter ? [counter] : [])].reduce((s, t) => s + t.total, 0);
  const guests = tables.filter((t) => t.occupied).reduce((s, t) => s + t.seats, 0);

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="flex items-stretch rounded-xl bg-ink-900 border border-ink-800 divide-x divide-ink-800 text-sm overflow-hidden">
        <Stat label="Libres" value={String(free)} dot="bg-emerald-400" />
        <Stat label="Ocupadas" value={String(busy)} dot="bg-primary" hint={guests ? `${guests} puestos` : undefined} />
        <Stat label="Por cobrar" value={formatMoney(pendingTotal)} strong />
      </div>

      {/* Para llevar */}
      {counter ? (
        <Link
          href={`/mesa/${counter.id}`}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2 transition-all active:scale-[0.99]",
            counter.occupied
              ? "bg-primary/15 border-primary/40 hover:bg-primary/20"
              : "bg-ink-900 border-ink-800 hover:border-ink-600"
          )}
        >
          <span
            className={cn(
              "size-9 rounded-lg grid place-items-center shrink-0",
              counter.occupied ? "bg-primary text-primary-foreground" : "bg-white/5 text-ink-300"
            )}
          >
            <ShoppingBag className="size-5" />
          </span>
          <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
            <p className="font-semibold text-sm">Para llevar</p>
            <p className="text-xs text-ink-400 truncate">
              {counter.occupied
                ? `${counter.items} producto${counter.items === 1 ? "" : "s"} · ${formatMoney(counter.total)}`
                : "Venta rápida sin mesa"}
            </p>
            {counter.ready > 0 && <ReadyBadge count={counter.ready} />}
          </div>
          <span
            className={cn(
              "h-9 px-3 sm:px-4 rounded-lg text-sm font-medium inline-flex items-center shrink-0",
              counter.occupied ? "bg-primary text-primary-foreground" : "bg-white text-ink-900"
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
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-ink-700 px-3 py-2.5 text-left text-ink-400 hover:text-white hover:border-primary/60 transition-colors"
        >
          <Plus className="size-5" />
          <span className="text-sm font-medium">Habilitar ventas para llevar / mostrador</span>
        </button>
      )}

      {/* Barra: salas + vista */}
      <div className="flex flex-wrap items-center gap-2">
        {view === "plan" && areas.length > 1 ? (
          <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl bg-ink-900 border border-ink-800 p-1">
            {areas.map((a) => {
              const count = tables.filter((t) => (t.areaId ?? firstAreaId) === a.id && t.occupied).length;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAreaId(a.id)}
                  className={cn(
                    "h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors inline-flex items-center gap-2",
                    a.id === currentId ? "bg-white/10 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  {a.name}
                  {count > 0 && (
                    <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] grid place-items-center tabular">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <h2 className="text-lg font-semibold">{view === "plan" ? areas[0]?.name ?? "Mesas" : "Mesas"}</h2>
        )}

        <div className="ml-auto flex items-center gap-2">
          {view === "list" && (
            <div className="inline-flex rounded-xl bg-ink-900 border border-ink-800 p-1" role="tablist">
              {(
                [
                  ["all", "Todas"],
                  ["free", "Libres"],
                  ["busy", "Ocupadas"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={cn(
                    "h-9 px-3 rounded-lg text-sm font-medium transition-colors",
                    filter === id ? "bg-white/10 text-white" : "text-ink-400 hover:text-white"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-xl bg-ink-900 border border-ink-800 p-1">
            <ViewButton active={view === "plan"} onClick={() => setView("plan")} label="Plano">
              <MapIcon className="size-4" />
            </ViewButton>
            <ViewButton active={view === "list"} onClick={() => setView("list")} label="Lista">
              <LayoutGrid className="size-4" />
            </ViewButton>
          </div>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 p-10 text-center">
          <p className="font-medium">Todavía no hay mesas</p>
          <p className="text-sm text-ink-400 mt-1">
            El administrador puede dibujarlas en <span className="font-medium text-ink-200">Panel → Plano</span>.
          </p>
        </div>
      ) : view === "plan" ? (
        <PlanView tables={inArea} />
      ) : (
        <ListView tables={tables} filter={filter} />
      )}

      <Legend />
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlanView({ tables }: { tables: FloorTable[] }) {
  const placed = useMemo(() => placeTables(tables), [tables]);
  // Recorta el lienzo al área ocupada para aprovechar la pantalla.
  const minX = placed.length ? Math.max(0, Math.min(...placed.map((p) => p.x)) - 2) : 0;
  const minY = placed.length ? Math.max(0, Math.min(...placed.map((p) => p.y)) - 2) : 0;
  const shifted = placed.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }));
  const size = canvasSize(shifted, { w: 20, h: 10 });

  if (tables.length === 0) {
    return <p className="text-sm text-ink-400 py-10 text-center">No hay mesas en esta sala.</p>;
  }

  return (
    <FloorCanvas width={size.w} height={size.h} fit>
      {shifted.map((p) => {
        const t = p.table;
        const small = p.w <= 3;
        return (
          <Link
            key={t.id}
            href={`/mesa/${t.id}`}
            aria-label={`Mesa ${t.number}${t.occupied ? `, ocupada, ${formatMoney(t.total)}` : ", libre"}`}
            className="absolute active:scale-95 transition-transform"
            style={{ left: p.x * CELL, top: p.y * CELL }}
          >
            <TableShapeView shape={t.shape} seats={t.seats} w={p.w} h={p.h} tone={toneOf(t)}>
              <span className={cn("font-bold leading-none", small ? "text-base" : "text-xl")}>{t.number}</span>
              {t.ready > 0 ? (
                <span className="mt-1 text-[10px] font-semibold text-emerald-300 inline-flex items-center gap-0.5">
                  <BellRing className="size-2.5" /> {t.ready}
                </span>
              ) : t.occupied ? (
                <>
                  <span className={cn("mt-1 font-semibold tabular leading-none", small ? "text-[9px]" : "text-[11px]")}>
                    {formatMoney(t.total)}
                  </span>
                  {!small && t.openedAt && (
                    <span className="text-[10px] text-white/60 mt-0.5" suppressHydrationWarning>
                      {formatElapsed(t.openedAt)}
                    </span>
                  )}
                </>
              ) : (
                <span className="mt-1 text-[10px] text-ink-400">{t.seats}P</span>
              )}
            </TableShapeView>
          </Link>
        );
      })}
    </FloorCanvas>
  );
}

function ListView({ tables, filter }: { tables: FloorTable[]; filter: Filter }) {
  const visible = tables.filter((t) => (filter === "all" ? true : filter === "free" ? !t.occupied : t.occupied));
  if (visible.length === 0) return <p className="text-sm text-ink-400 py-8 text-center">No hay mesas en este estado.</p>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {visible.map((t) => (
        <Link
          key={t.id}
          href={`/mesa/${t.id}`}
          className={cn(
            "group rounded-2xl border p-4 min-h-32 flex flex-col transition-all active:scale-[0.98]",
            t.ready > 0
              ? "bg-emerald-500/15 border-emerald-400/60"
              : t.occupied
                ? "bg-primary/15 border-primary/40 hover:bg-primary/20"
                : "bg-ink-900 border-ink-800 hover:border-emerald-400/50"
          )}
        >
          <div className="flex items-start justify-between">
            <span className="text-xs text-ink-400 font-medium inline-flex items-center gap-1">
              <UsersRound className="size-3" /> {t.seats}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium px-2 py-0.5 rounded-full",
                t.occupied ? "bg-primary text-primary-foreground" : "bg-emerald-400/15 text-emerald-300"
              )}
            >
              {t.occupied ? "Ocupada" : "Libre"}
            </span>
          </div>
          <span className="text-4xl font-semibold tracking-tight leading-none mt-1">{t.number}</span>
          {t.ready > 0 && <ReadyBadge count={t.ready} className="mt-2 self-start" />}
          {t.occupied ? (
            <div className="mt-auto pt-3 space-y-1">
              <p className="text-base font-semibold tabular">{formatMoney(t.total)}</p>
              <div className="flex items-center gap-3 text-xs text-ink-400">
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
            <p className="mt-auto pt-3 text-xs text-ink-500 group-hover:text-emerald-300 transition-colors">
              Toca para abrir
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-400">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-ink-600 bg-ink-800" /> Libre
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-primary bg-primary/25" /> Ocupada
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-emerald-400 bg-emerald-500/25" /> Pedido listo en cocina
      </span>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors",
        active ? "bg-white/10 text-white" : "text-ink-400 hover:text-white"
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ReadyBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white text-xs font-medium px-2 py-0.5 animate-pulse",
        className
      )}
    >
      <BellRing className="size-3" /> {count} listo{count === 1 ? "" : "s"}
    </span>
  );
}

/** Indicador compacto en una sola línea, para dejar el espacio al plano. */
function Stat({
  label,
  value,
  dot,
  hint,
  strong = false,
}: {
  label: string;
  value: string;
  dot?: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-11")}>
      {dot && <span className={cn("size-2 rounded-full shrink-0", dot)} />}
      <span className="text-ink-400 truncate hidden sm:inline">{label}</span>
      <span className={cn("font-semibold tabular truncate", strong && "text-primary")}>{value}</span>
      <span className="text-ink-400 truncate sm:hidden">{label.toLowerCase()}</span>
      {hint && <span className="text-xs text-ink-500 truncate hidden md:inline">· {hint}</span>}
    </div>
  );
}
