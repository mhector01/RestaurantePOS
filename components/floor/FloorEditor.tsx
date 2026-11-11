"use client";

import { useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Layers,
  MousePointerClick,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import {
  addTableToArea,
  createArea,
  deleteArea,
  deleteTable,
  enableCounter,
  moveTable,
  renameArea,
  saveLayout,
  updateTable,
} from "@/app/actions";
import {
  CELL,
  PRESETS,
  canvasSize,
  findFreeSpot,
  placeTables,
  tableSize,
  type LayoutTable,
  type TableShape,
} from "@/lib/floor";
import { FloorCanvas, TableShapeView } from "@/components/floor/FloorCanvas";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { cn } from "@/lib/utils";

export interface EditorTable extends LayoutTable {
  areaId: number | null;
  busy: boolean;
}

export interface EditorArea {
  id: number;
  name: string;
}

type Action =
  | { type: "move"; id: number; x: number; y: number }
  | { type: "add"; table: EditorTable }
  | { type: "update"; id: number; patch: Partial<EditorTable> };

interface Drag {
  id: number;
  pointerX: number;
  pointerY: number;
  origX: number;
  origY: number;
  x: number;
  y: number;
  moved: boolean;
}

export function FloorEditor({
  areas,
  tables,
  hasCounter,
}: {
  areas: EditorArea[];
  tables: EditorTable[];
  hasCounter: boolean;
}) {
  const [areaId, setAreaId] = useState<number | null>(areas[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [, startTransition] = useTransition();
  const tempId = useRef(-1); // ids temporales para mesas aún no guardadas

  const [items, apply] = useOptimistic(tables, (state: EditorTable[], a: Action) => {
    switch (a.type) {
      case "move":
        return state.map((t) => (t.id === a.id ? { ...t, x: a.x, y: a.y } : t));
      case "add":
        return [...state, a.table];
      case "update":
        return state.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t));
    }
  });

  // Si la sala elegida se eliminó, vuelve a la primera.
  const currentArea = areas.find((a) => a.id === areaId) ?? areas[0] ?? null;
  const firstAreaId = areas[0]?.id ?? null;

  const inArea = useMemo(
    () =>
      items.filter((t) =>
        t.areaId === null ? currentArea?.id === firstAreaId : t.areaId === currentArea?.id
      ),
    [items, currentArea?.id, firstAreaId]
  );
  const placed = useMemo(() => placeTables(inArea), [inArea]);
  const size = canvasSize(placed, { w: 44, h: 24 });

  // Las mesas sin posición (creadas antes del plano) se guardan donde se acomodaron,
  // así no "saltan" cuando se mueve otra.
  const autoSaved = useRef(new Set<number>());
  useEffect(() => {
    const unsaved = placed.filter((p) => (p.table.x === null || p.table.y === null) && p.table.id > 0);
    const fresh = unsaved.filter((p) => !autoSaved.current.has(p.table.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => autoSaved.current.add(p.table.id));
    saveLayout(fresh.map((p) => ({ id: p.table.id, x: p.x, y: p.y }))).catch(() => {});
  }, [placed]);

  const selected = items.find((t) => t.id === selectedId) ?? null;
  const seatsInArea = inArea.reduce((s, t) => s + t.seats, 0);

  // ----- Arrastrar -----
  const onPointerDown = (e: React.PointerEvent, id: number, x: number, y: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, pointerX: e.clientX, pointerY: e.clientY, origX: x, origY: y, x, y, moved: false });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.pointerX;
    const dy = e.clientY - drag.pointerY;
    const moved = drag.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
    setDrag({
      ...drag,
      moved,
      x: Math.max(0, drag.origX + Math.round(dx / CELL)),
      y: Math.max(0, drag.origY + Math.round(dy / CELL)),
    });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) {
      setSelectedId(d.id);
      return;
    }
    setSelectedId(d.id);
    if (d.x === d.origX && d.y === d.origY) return;
    startTransition(async () => {
      apply({ type: "move", id: d.id, x: d.x, y: d.y });
      await moveTable(d.id, d.x, d.y);
    });
  };

  // ----- Agregar desde la paleta -----
  const addPreset = (shape: TableShape, seats: number) => {
    if (!currentArea) return;
    const { w, h } = tableSize(shape, seats);
    const spot = findFreeSpot(placed, w, h, Math.max(40, size.w - 2));
    const nextNumber = Math.max(0, ...items.map((t) => t.number)) + 1;
    const temp: EditorTable = {
      id: tempId.current--,
      number: nextNumber,
      shape,
      seats,
      x: spot.x,
      y: spot.y,
      areaId: currentArea.id,
      busy: false,
    };
    startTransition(async () => {
      apply({ type: "add", table: temp });
      const res = await addTableToArea(currentArea.id, shape, seats, spot.x, spot.y);
      if (res?.success) {
        setSelectedId(res.id);
        toast.success(`Mesa ${res.number} agregada`);
      }
    });
  };

  const patch = (id: number, p: Partial<EditorTable>) =>
    startTransition(async () => {
      apply({ type: "update", id, patch: p });
      const res = await updateTable(id, {
        number: p.number,
        shape: p.shape,
        seats: p.seats,
        areaId: p.areaId ?? undefined,
      });
      if (res && !res.success) toast.error(res.error);
    });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 text-ink-100 border border-ink-800 overflow-hidden">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-ink-800">
          <AreaMenu
            areas={areas}
            current={currentArea}
            counts={Object.fromEntries(
              areas.map((a) => [a.id, items.filter((t) => (t.areaId ?? firstAreaId) === a.id).length])
            )}
            onSelect={(id) => {
              setAreaId(id);
              setSelectedId(null);
            }}
          />
          <p className="text-sm text-ink-400">
            {inArea.length} mesa{inArea.length === 1 ? "" : "s"} en {currentArea?.name ?? "—"}
          </p>
          <span className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/5 border border-white/10 text-sm">
            <UsersRound className="size-4 text-primary" /> {seatsInArea} puestos
          </span>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Lienzo */}
          <div className="flex-1 min-w-0 p-3">
            {currentArea ? (
              <FloorCanvas
                width={size.w}
                height={size.h}
                editable
                className="max-h-[68vh]"
                onBackgroundPointerDown={() => setSelectedId(null)}
              >
                {placed.map((p) => {
                  const dragging = drag?.id === p.table.id;
                  const x = dragging ? drag.x : p.x;
                  const y = dragging ? drag.y : p.y;
                  return (
                    <div
                      key={p.table.id}
                      onPointerDown={(e) => onPointerDown(e, p.table.id, p.x, p.y)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={() => setDrag(null)}
                      className={cn(
                        "absolute cursor-grab active:cursor-grabbing",
                        dragging ? "z-20 opacity-90" : "transition-[left,top] duration-150"
                      )}
                      style={{ left: x * CELL, top: y * CELL }}
                    >
                      <TableShapeView
                        shape={p.table.shape}
                        seats={p.table.seats}
                        w={p.w}
                        h={p.h}
                        tone={p.table.busy ? "busy" : "plain"}
                        selected={selectedId === p.table.id}
                      >
                        <span className="text-sm font-bold leading-none">T{p.table.number}</span>
                        <span className="text-[10px] text-ink-400 mt-0.5">{p.table.seats}P</span>
                      </TableShapeView>
                    </div>
                  );
                })}
                {placed.length === 0 && (
                  <div className="absolute inset-0 grid place-items-center pointer-events-none">
                    <p className="text-ink-500 text-sm flex items-center gap-2">
                      <MousePointerClick className="size-4" /> Elige una forma en la paleta para agregar la primera mesa
                    </p>
                  </div>
                )}
              </FloorCanvas>
            ) : (
              <div className="p-10 text-center text-ink-400">Crea una sala para empezar.</div>
            )}
          </div>

          {/* Panel lateral */}
          <aside className="lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-ink-800 p-4 space-y-5">
            {selected ? (
              <SelectedPanel
                key={selected.id}
                table={selected}
                areas={areas}
                onClose={() => setSelectedId(null)}
                onPatch={(p) => patch(selected.id, p)}
                onDeleted={() => setSelectedId(null)}
              />
            ) : (
              <div>
                <h3 className="font-semibold">Paleta</h3>
                <p className="text-xs text-ink-400 mt-0.5 mb-3">
                  Toca una forma para agregarla. Arrastra las mesas para acomodarlas.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => {
                    const s = tableSize(p.shape, p.seats);
                    const scale = Math.min(0.62, 100 / (s.w * CELL));
                    return (
                      <button
                        key={`${p.shape}-${p.seats}`}
                        type="button"
                        disabled={!currentArea}
                        onClick={() => addPreset(p.shape, p.seats)}
                        className="rounded-xl border border-ink-700 bg-ink-800/50 hover:border-primary hover:bg-primary/10 transition-colors p-2 pt-4 flex flex-col items-center gap-2 disabled:opacity-40"
                      >
                        <div className="h-16 w-full grid place-items-center overflow-hidden">
                          <div style={{ transform: `scale(${scale})` }}>
                            <TableShapeView shape={p.shape} seats={p.seats} w={s.w} h={s.h} />
                          </div>
                        </div>
                        <span className="text-xs text-ink-300">
                          {p.label} · {p.seats}P
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {!hasCounter && (
        <section className="rounded-2xl border border-dashed p-5 flex items-center gap-4">
          <ShoppingBag className="size-6 text-muted-foreground" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Para llevar / mostrador</span>
            <span className="text-muted-foreground"> — habilita ventas rápidas sin mesa.</span>
          </p>
          <button
            type="button"
            className="h-11 px-4 rounded-xl border bg-card text-sm font-medium hover:bg-muted"
            onClick={() => startTransition(() => enableCounter())}
          >
            Habilitar
          </button>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AreaMenu({
  areas,
  current,
  counts,
  onSelect,
}: {
  areas: EditorArea[];
  current: EditorArea | null;
  counts: Record<number, number>;
  onSelect: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "new" | "rename">("list");
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const submit = () =>
    startTransition(async () => {
      if (mode === "new") {
        const res = await createArea(name);
        if (!res.success) return void toast.error(res.error);
        if (res.id) onSelect(res.id);
        toast.success("Sala creada");
      } else if (mode === "rename" && current) {
        const res = await renameArea(current.id, name);
        if (!res.success) return void toast.error(res.error);
      }
      setMode("list");
      setName("");
      setOpen(false);
    });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setMode("list");
        }}
        className="h-10 pl-3 pr-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 inline-flex items-center gap-2 text-sm font-medium"
      >
        <Layers className="size-4 text-primary" />
        {current?.name ?? "Sin salas"}
        <ChevronDown className={cn("size-4 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-30 w-64 rounded-xl bg-ink-900 border border-ink-700 shadow-2xl shadow-black/50 overflow-hidden">
          {mode === "list" ? (
            <>
              <ul className="py-1">
                {areas.map((a) => (
                  <li key={a.id} className="group flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(a.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex-1 text-left px-3 py-2.5 text-sm flex items-center gap-2",
                        a.id === current?.id ? "text-primary bg-primary/10" : "hover:bg-white/5"
                      )}
                    >
                      {a.name}
                      <span className="text-xs text-ink-500">{counts[a.id] ?? 0}</span>
                    </button>
                    {(counts[a.id] ?? 0) === 0 && areas.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Eliminar ${a.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteArea(a.id);
                            if (!res.success) toast.error(res.error);
                            else toast.success("Sala eliminada");
                          })
                        }
                        className="size-9 grid place-items-center text-ink-500 hover:text-red-400"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-ink-800 py-1">
                {current && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("rename");
                      setName(current.name);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 flex items-center gap-2 text-ink-300"
                  >
                    <Pencil className="size-4" /> Renombrar “{current.name}”
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMode("new");
                    setName("");
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 flex items-center gap-2 text-primary"
                >
                  <Plus className="size-4" /> Nueva sala
                </button>
              </div>
            </>
          ) : (
            <form
              className="p-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className="text-xs text-ink-400">{mode === "new" ? "Nombre de la nueva sala" : "Nuevo nombre"}</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Terraza, Barra, Segundo piso…"
                className="w-full h-10 rounded-lg bg-ink-800 border border-ink-700 px-3 text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="flex-1 h-9 rounded-lg text-sm text-ink-300 hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="flex-1 h-9 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SelectedPanel({
  table,
  areas,
  onClose,
  onPatch,
  onDeleted,
}: {
  table: EditorTable;
  areas: EditorArea[];
  onClose: () => void;
  onPatch: (p: Partial<EditorTable>) => void;
  onDeleted: () => void;
}) {
  const [number, setNumber] = useState(String(table.number));

  const commitNumber = () => {
    const n = parseInt(number);
    if (!Number.isFinite(n) || n === table.number) return setNumber(String(table.number));
    onPatch({ number: n });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold flex-1">Mesa {table.number}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="size-9 rounded-lg grid place-items-center text-ink-400 hover:bg-white/5"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-ink-400" htmlFor="table-number">
          Número
        </label>
        <div className="flex gap-2">
          <input
            id="table-number"
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            onBlur={commitNumber}
            onKeyDown={(e) => e.key === "Enter" && commitNumber()}
            className="flex-1 h-10 rounded-lg bg-ink-800 border border-ink-700 px-3 text-sm outline-none focus:border-primary tabular"
          />
          <button
            type="button"
            onClick={commitNumber}
            aria-label="Guardar número"
            className="size-10 rounded-lg grid place-items-center bg-white/5 hover:bg-white/10"
          >
            <Check className="size-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs text-ink-400">Forma y puestos</p>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => {
            const active = p.shape === table.shape && p.seats === table.seats;
            return (
              <button
                key={`${p.shape}-${p.seats}`}
                type="button"
                title={`${p.label} · ${p.seats} puestos`}
                onClick={() => onPatch({ shape: p.shape, seats: p.seats })}
                className={cn(
                  "h-12 rounded-lg border text-[11px] flex flex-col items-center justify-center gap-1",
                  active ? "border-primary bg-primary/15 text-white" : "border-ink-700 text-ink-300 hover:border-ink-500"
                )}
              >
                <span
                  className={cn(
                    "border border-current",
                    p.shape === "round" ? "rounded-full size-4" : p.shape === "rect" ? "rounded-[3px] w-6 h-3.5" : "rounded-[3px] size-4"
                  )}
                />
                {p.seats}P
              </button>
            );
          })}
        </div>
      </div>

      {areas.length > 1 && (
        <div className="space-y-1.5">
          <label className="text-xs text-ink-400" htmlFor="table-area">
            Sala
          </label>
          <select
            id="table-area"
            value={table.areaId ?? areas[0].id}
            onChange={(e) => {
              const areaId = parseInt(e.target.value);
              onPatch({ areaId, x: null, y: null });
              onClose();
            }}
            className="w-full h-10 rounded-lg bg-ink-800 border border-ink-700 px-3 text-sm outline-none focus:border-primary"
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {table.busy ? (
        <p className="text-xs text-ink-400">Tiene una cuenta abierta; no se puede eliminar ahora.</p>
      ) : (
        <ConfirmAction
          title={`¿Eliminar la mesa ${table.number}?`}
          description="Solo se pueden eliminar mesas sin ventas registradas."
          confirmLabel="Eliminar"
          successMessage="Mesa eliminada"
          action={async () => {
            const res = await deleteTable(table.id);
            if (res.success) onDeleted();
            return res;
          }}
        >
          <button
            type="button"
            className="w-full h-10 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-red-500/10"
          >
            <Trash2 className="size-4" /> Eliminar mesa
          </button>
        </ConfirmAction>
      )}
    </div>
  );
}
