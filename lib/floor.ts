// Geometría del plano de mesas: tamaños, sillas y acomodo automático.
// Todo se mide en celdas de una cuadrícula; CELL es el tamaño de cada celda en píxeles.

export const CELL = 24;

export type TableShape = "square" | "round" | "rect";

export interface LayoutTable {
  id: number;
  number: number;
  shape: TableShape;
  seats: number;
  x: number | null;
  y: number | null;
}

export interface Placed<T extends LayoutTable = LayoutTable> {
  table: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Formas disponibles en la paleta del editor. */
export const PRESETS: { shape: TableShape; seats: number; label: string }[] = [
  { shape: "square", seats: 2, label: "Cuadrada" },
  { shape: "square", seats: 4, label: "Cuadrada" },
  { shape: "round", seats: 2, label: "Redonda" },
  { shape: "round", seats: 4, label: "Redonda" },
  { shape: "round", seats: 6, label: "Redonda" },
  { shape: "rect", seats: 6, label: "Rectangular" },
  { shape: "rect", seats: 8, label: "Rectangular" },
  { shape: "rect", seats: 10, label: "Rectangular" },
];

export function normalizeShape(s: string): TableShape {
  return s === "round" || s === "rect" ? s : "square";
}

/** Tamaño de la mesa (en celdas) según su forma y puestos. */
export function tableSize(shape: TableShape, seats: number): { w: number; h: number } {
  if (shape === "rect") {
    const perSide = Math.max(2, Math.ceil((seats - 2) / 2));
    return { w: 2 + perSide * 2, h: 4 };
  }
  if (shape === "round") {
    const d = seats <= 2 ? 3 : seats <= 4 ? 4 : 5;
    return { w: d, h: d };
  }
  const d = seats <= 2 ? 3 : 4;
  return { w: d, h: d };
}

/** Posición (en px, relativa a la esquina de la mesa) del centro de cada silla. */
export function chairPositions(shape: TableShape, seats: number, wPx: number, hPx: number) {
  const gap = 11; // distancia del borde de la mesa al centro de la silla
  const out: { x: number; y: number }[] = [];
  if (seats <= 0) return out;

  if (shape === "round") {
    const r = wPx / 2 + gap;
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 - Math.PI / 2 + (seats === 2 ? Math.PI / 2 : 0);
      out.push({ x: wPx / 2 + Math.cos(a) * r, y: hPx / 2 + Math.sin(a) * r });
    }
    return out;
  }

  const side = { top: 0, bottom: 0, left: 0, right: 0 };
  if (seats <= 2) {
    side.left = 1;
    side.right = seats - 1;
  } else {
    side.left = 1;
    side.right = 1;
    const rest = seats - 2;
    side.top = Math.ceil(rest / 2);
    side.bottom = Math.floor(rest / 2);
  }
  const along = (n: number, len: number) => Array.from({ length: n }, (_, k) => ((k + 1) / (n + 1)) * len);
  along(side.top, wPx).forEach((x) => out.push({ x, y: -gap }));
  along(side.bottom, wPx).forEach((x) => out.push({ x, y: hPx + gap }));
  along(side.left, hPx).forEach((y) => out.push({ x: -gap, y }));
  along(side.right, hPx).forEach((y) => out.push({ x: wPx + gap, y }));
  return out;
}

/**
 * Coloca cada mesa: las que tienen posición guardada van donde están;
 * las que no (mesas viejas o recién creadas) se acomodan en filas debajo.
 */
export function placeTables<T extends LayoutTable>(tables: T[]): Placed<T>[] {
  const placed: Placed<T>[] = [];
  const pending: T[] = [];
  for (const t of tables) {
    const { w, h } = tableSize(t.shape, t.seats);
    if (t.x !== null && t.y !== null) placed.push({ table: t, x: t.x, y: t.y, w, h });
    else pending.push(t);
  }

  let cursorY = placed.length ? Math.max(...placed.map((p) => p.y + p.h)) + 2 : 2;
  let cursorX = 2;
  let rowH = 0;
  const MAX_W = 44;
  for (const t of [...pending].sort((a, b) => a.number - b.number)) {
    const { w, h } = tableSize(t.shape, t.seats);
    if (cursorX + w > MAX_W) {
      cursorX = 2;
      cursorY += rowH + 2;
      rowH = 0;
    }
    placed.push({ table: t, x: cursorX, y: cursorY, w, h });
    cursorX += w + 2;
    rowH = Math.max(rowH, h);
  }
  return placed;
}

/** Tamaño del lienzo (en celdas) para que quepan todas las mesas con margen. */
export function canvasSize(placed: Placed[], min = { w: 40, h: 20 }) {
  const w = Math.max(min.w, ...placed.map((p) => p.x + p.w + 2));
  const h = Math.max(min.h, ...placed.map((p) => p.y + p.h + 2));
  return { w, h };
}

/** Busca un hueco libre para una mesa nueva. */
export function findFreeSpot(placed: Placed[], w: number, h: number, maxW = 40) {
  const hit = (x: number, y: number) =>
    placed.some((p) => x < p.x + p.w + 1 && x + w + 1 > p.x && y < p.y + p.h + 1 && y + h + 1 > p.y);
  for (let y = 2; y < 200; y += 1) {
    for (let x = 2; x + w <= maxW; x += 1) {
      if (!hit(x, y)) return { x, y };
    }
  }
  return { x: 2, y: 2 };
}
