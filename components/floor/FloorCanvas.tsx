"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CELL, chairPositions, type TableShape } from "@/lib/floor";
import { cn } from "@/lib/utils";

export type TableTone = "free" | "busy" | "ready" | "plain";

const TONES: Record<TableTone, { table: string; chair: string }> = {
  free: {
    table: "bg-ink-800 border-ink-600 text-ink-100 hover:border-emerald-400/70",
    chair: "bg-ink-600",
  },
  busy: {
    table: "bg-primary/25 border-primary text-white",
    chair: "bg-primary/70",
  },
  ready: {
    table: "bg-emerald-500/25 border-emerald-400 text-white ring-4 ring-emerald-400/30 animate-pulse",
    chair: "bg-emerald-400/80",
  },
  plain: {
    table: "bg-ink-800 border-ink-600 text-ink-100",
    chair: "bg-ink-600",
  },
};

interface ShapeProps {
  shape: TableShape;
  seats: number;
  w: number; // en celdas
  h: number;
  tone?: TableTone;
  selected?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Dibujo de una mesa con sus sillas alrededor. */
export function TableShapeView({ shape, seats, w, h, tone = "plain", selected, children, className }: ShapeProps) {
  const wPx = w * CELL;
  const hPx = h * CELL;
  const t = TONES[tone];
  return (
    <div className={cn("relative", className)} style={{ width: wPx, height: hPx }}>
      {chairPositions(shape, seats, wPx, hPx).map((c, i) => (
        <span
          key={i}
          className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2", shape === "round" ? "rounded-full" : "rounded-[3px]", t.chair)}
          style={{ left: c.x, top: c.y }}
        />
      ))}
      <div
        className={cn(
          "absolute inset-0 border-2 flex flex-col items-center justify-center text-center transition-colors shadow-lg shadow-black/30",
          shape === "round" ? "rounded-full" : "rounded-xl",
          t.table,
          selected && "ring-2 ring-offset-2 ring-offset-ink-900 ring-primary"
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface CanvasProps {
  width: number; // en celdas
  height: number;
  fit?: boolean; // reduce la escala para que quepa a lo ancho
  children: React.ReactNode;
  onBackgroundPointerDown?: () => void;
  canvasRef?: React.Ref<HTMLDivElement>;
  editable?: boolean; // en el editor se bloquea el scroll táctil para poder arrastrar
  className?: string;
}

/** Lienzo oscuro con cuadrícula. Con `fit`, se escala para caber en el ancho disponible. */
export function FloorCanvas({
  width,
  height,
  fit = false,
  children,
  onBackgroundPointerDown,
  canvasRef,
  editable = false,
  className,
}: CanvasProps) {
  const outer = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const baseW = width * CELL;
  const hPx = height * CELL;

  useLayoutEffect(() => {
    if (!outer.current) return;
    const el = outer.current;
    const update = () => setContainerW(el.clientWidth - 2);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Con "fit" se reduce si no cabe; si sobra espacio, la cuadrícula se estira para llenarlo.
  // En pantallas angostas no baja de 0.6 para que las mesas sigan siendo fáciles de tocar (el resto se desplaza).
  const s = fit && containerW > 0 ? Math.max(0.6, Math.min(1, containerW / baseW)) : 1;
  const wPx = s < 1 ? baseW : Math.max(baseW, containerW);

  return (
    <div
      ref={outer}
      className={cn(
        "rounded-2xl border border-ink-800 bg-ink-950 overflow-auto overscroll-contain [color-scheme:dark]",
        className
      )}
    >
      <div style={{ width: wPx * s, height: hPx * s }}>
        <div
          ref={canvasRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onBackgroundPointerDown?.();
          }}
          className={cn("relative origin-top-left select-none", editable && "touch-none")}
          style={{
            width: wPx,
            height: hPx,
            transform: s !== 1 ? `scale(${s})` : undefined,
            backgroundColor: "oklch(0.15 0.045 262)",
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
            backgroundSize: `${CELL}px ${CELL}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
