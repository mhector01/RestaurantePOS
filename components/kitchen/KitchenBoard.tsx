"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, BellOff, Check, ChefHat, Clock, RotateCcw, ShoppingBag, UserRound } from "lucide-react";
import { markKitchenItemReady, markKitchenOrderReady, undoKitchenItem } from "@/app/actions";
import { cn } from "@/lib/utils";

export interface KitchenTicketItem {
  id: number;
  name: string;
  quantity: number;
  status: "PENDING" | "READY";
  createdAt: string;
  readyAt: string | null;
}

export interface KitchenTicket {
  orderId: number;
  table: number;
  waiter: string | null;
  since: string;
  items: KitchenTicketItem[];
}

type Optimistic =
  | { type: "ready"; ids: number[] }
  | { type: "undo"; id: number };

// Minutos de espera a partir de los cuales la comanda se marca en ámbar / rojo.
const WARN_MIN = 10;
const LATE_MIN = 20;

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function minutesBetween(from: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 60_000));
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.16);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {
    // El navegador no permite audio: no pasa nada.
  }
}

export function KitchenBoard({ business, tickets }: { business: string; tickets: KitchenTicket[] }) {
  const now = useNow();
  const [, startTransition] = useTransition();
  const [sound, setSound] = useState(false);

  const [optimistic, apply] = useOptimistic(tickets, (state: KitchenTicket[], action: Optimistic) =>
    state.map((t) => ({
      ...t,
      items: t.items.map((i) => {
        if (action.type === "ready" && action.ids.includes(i.id)) {
          return { ...i, status: "READY" as const, readyAt: new Date().toISOString() };
        }
        if (action.type === "undo" && action.id === i.id) return { ...i, status: "PENDING" as const, readyAt: null };
        return i;
      }),
    }))
  );

  const active = optimistic
    .filter((t) => t.items.some((i) => i.status === "PENDING"))
    .map((t) => ({
      ...t,
      waitingSince: t.items.filter((i) => i.status === "PENDING").map((i) => i.createdAt).sort()[0],
    }))
    .sort((a, b) => a.waitingSince.localeCompare(b.waitingSince));
  const done = optimistic
    .filter((t) => t.items.every((i) => i.status === "READY"))
    .sort((a, b) => (b.items[0]?.readyAt ?? "").localeCompare(a.items[0]?.readyAt ?? ""));

  const pendingUnits = active.reduce(
    (s, t) => s + t.items.filter((i) => i.status === "PENDING").reduce((n, i) => n + i.quantity, 0),
    0
  );

  // Aviso sonoro cuando entra algo nuevo a la cocina.
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    const ids = new Set(tickets.flatMap((t) => t.items.filter((i) => i.status === "PENDING").map((i) => i.id)));
    const prev = seen.current;
    seen.current = ids;
    if (!prev || !sound) return;
    if ([...ids].some((id) => !prev.has(id))) beep();
  }, [tickets, sound]);

  const ready = (ids: number[], orderId?: number) =>
    startTransition(async () => {
      apply({ type: "ready", ids });
      if (orderId !== undefined) await markKitchenOrderReady(orderId);
      else await markKitchenItemReady(ids[0]);
    });

  const undo = (id: number) =>
    startTransition(async () => {
      apply({ type: "undo", id });
      await undoKitchenItem(id);
    });

  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="sticky top-0 z-10 bg-stone-950/90 backdrop-blur border-b border-white/10">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al punto de venta"
            className="size-11 rounded-full grid place-items-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <span className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <ChefHat className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Cocina</p>
            <p className="text-xs text-stone-400 truncate">{business}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="px-3 h-9 rounded-full bg-white/5 border border-white/10 inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              {active.length} comanda{active.length === 1 ? "" : "s"}
            </span>
            <span className="px-3 h-9 rounded-full bg-white/5 border border-white/10 inline-flex items-center tabular">
              {pendingUnits} plato{pendingUnits === 1 ? "" : "s"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!sound) beep();
              setSound(!sound);
            }}
            className={cn(
              "h-11 px-4 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors",
              sound ? "bg-primary text-primary-foreground" : "bg-white/10 text-stone-300 hover:bg-white/15"
            )}
            aria-pressed={sound}
          >
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            <span className="hidden sm:inline">{sound ? "Sonido activo" : "Activar sonido"}</span>
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-8">
        {active.length === 0 ? (
          <div className="py-24 text-center">
            <ChefHat className="size-14 mx-auto text-stone-700" />
            <p className="mt-4 text-xl font-semibold">Todo al día</p>
            <p className="text-stone-400 mt-1">Las comandas nuevas aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 2xl:columns-4 gap-4 [&>*]:mb-4">
            {active.map((t) => {
              const mins = minutesBetween(t.waitingSince, now);
              const level = mins >= LATE_MIN ? "late" : mins >= WARN_MIN ? "warn" : "ok";
              const pending = t.items.filter((i) => i.status === "PENDING");
              return (
                <article
                  key={t.orderId}
                  className={cn(
                    "break-inside-avoid rounded-2xl overflow-hidden bg-stone-900 border-2",
                    level === "late" ? "border-red-500" : level === "warn" ? "border-amber-400" : "border-white/10"
                  )}
                >
                  <header
                    className={cn(
                      "px-4 py-3 flex items-center gap-3",
                      level === "late" ? "bg-red-500 text-white" : level === "warn" ? "bg-amber-400 text-stone-950" : "bg-white/5"
                    )}
                  >
                    {t.table === 0 ? <ShoppingBag className="size-6" /> : null}
                    <h2 className="text-2xl font-bold flex-1 leading-none">
                      {t.table === 0 ? "Para llevar" : `Mesa ${t.table}`}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-lg font-semibold tabular" suppressHydrationWarning>
                      <Clock className="size-5" /> {mins} min
                    </span>
                  </header>
                  {t.waiter && (
                    <p className="px-4 pt-2 text-sm text-stone-400 inline-flex items-center gap-1.5">
                      <UserRound className="size-4" /> {t.waiter}
                    </p>
                  )}

                  <ul className="p-2">
                    {t.items.map((i) =>
                      i.status === "PENDING" ? (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => ready([i.id])}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5 active:bg-white/10 transition-colors group"
                          >
                            <span className="text-2xl font-bold tabular w-10 text-primary">{i.quantity}×</span>
                            <span className="flex-1 text-xl font-semibold leading-tight">{i.name}</span>
                            <span className="size-10 rounded-full border-2 border-white/20 grid place-items-center text-transparent group-hover:text-stone-400 group-hover:border-stone-400 transition-colors">
                              <Check className="size-5" />
                            </span>
                          </button>
                        </li>
                      ) : (
                        <li key={i.id} className="flex items-center gap-3 rounded-xl px-3 py-2 text-stone-500">
                          <span className="text-lg font-semibold tabular w-10">{i.quantity}×</span>
                          <span className="flex-1 text-lg line-through">{i.name}</span>
                          <button
                            type="button"
                            onClick={() => undo(i.id)}
                            aria-label={`Deshacer ${i.name}`}
                            title="Deshacer"
                            className="size-10 rounded-full grid place-items-center hover:bg-white/10 hover:text-stone-200"
                          >
                            <RotateCcw className="size-4" />
                          </button>
                        </li>
                      )
                    )}
                  </ul>

                  <div className="p-3 pt-0">
                    <button
                      type="button"
                      onClick={() => ready(pending.map((i) => i.id), t.orderId)}
                      className="w-full h-14 rounded-xl bg-success text-white text-lg font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition"
                    >
                      <Check className="size-6" /> {pending.length > 1 ? "Todo listo" : "Listo"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {done.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-stone-400 mb-3">Listos hace poco</h2>
            <div className="flex flex-wrap gap-2">
              {done.map((t) => (
                <div
                  key={t.orderId}
                  className="rounded-xl bg-stone-900 border border-white/10 px-3 py-2 flex items-center gap-3"
                >
                  <span className="size-7 rounded-full bg-success/20 text-success grid place-items-center">
                    <Check className="size-4" />
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold">{t.table === 0 ? "Para llevar" : `Mesa ${t.table}`}</p>
                    <p className="text-stone-400">
                      {t.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => t.items.forEach((i) => undo(i.id))}
                    className="h-9 px-3 rounded-lg text-sm text-stone-300 hover:bg-white/10 inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="size-4" /> Deshacer
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
