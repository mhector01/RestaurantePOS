// Periodos de los reportes: "Hoy", "Este mes", rango personalizado… con su periodo anterior para comparar.

export const PERIOD_PRESETS = [
  { key: "hoy", label: "Hoy" },
  { key: "ayer", label: "Ayer" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "mes", label: "Este mes" },
  { key: "mesant", label: "Mes anterior" },
  { key: "anio", label: "Este año" },
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"] | "rango";

const DAY = 86_400_000;

function day(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseDay(s?: string) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface Period {
  key: PeriodKey;
  start: Date; // inclusivo
  end: Date; // exclusivo
  label: string;
  prevStart: Date;
  prevEnd: Date;
  prevLabel: string;
  days: number;
  /** Agrupación sugerida para los gráficos de evolución. */
  bucket: "hour" | "day" | "month";
  query: string; // "p=mes" o "p=rango&desde=…&hasta=…" para enlaces y descargas
}

const fmt = (d: Date) => d.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });

export function resolvePeriod(sp: { p?: string; desde?: string; hasta?: string }, fallback: PeriodKey = "mes"): Period {
  const today = day(new Date());
  let key = (PERIOD_PRESETS.some((p) => p.key === sp.p) || sp.p === "rango" ? sp.p : fallback) as PeriodKey;
  let start: Date;
  let end: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (key) {
    case "hoy":
      start = today;
      end = addDays(today, 1);
      prevStart = addDays(today, -1);
      prevEnd = today;
      break;
    case "ayer":
      start = addDays(today, -1);
      end = today;
      prevStart = addDays(today, -2);
      prevEnd = start;
      break;
    case "7d":
      start = addDays(today, -6);
      end = addDays(today, 1);
      prevStart = addDays(start, -7);
      prevEnd = start;
      break;
    case "30d":
      start = addDays(today, -29);
      end = addDays(today, 1);
      prevStart = addDays(start, -30);
      prevEnd = start;
      break;
    case "mesant":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 1);
      prevStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      prevEnd = start;
      break;
    case "anio":
      start = new Date(today.getFullYear(), 0, 1);
      end = addDays(today, 1);
      prevStart = new Date(today.getFullYear() - 1, 0, 1);
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
      break;
    case "rango": {
      const a = parseDay(sp.desde);
      const b = parseDay(sp.hasta);
      if (a && b && b >= a) {
        start = a;
        end = addDays(b, 1);
        const len = Math.round((end.getTime() - start.getTime()) / DAY);
        prevStart = addDays(start, -len);
        prevEnd = start;
        break;
      }
      key = "mes";
    }
    // falls through
    default: // mes
      key = "mes";
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = addDays(today, 1);
      prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      // Mismo avance del mes anterior, para comparar parejo
      prevEnd = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate() + 1, 32));
      if (prevEnd > start) prevEnd = start;
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  const preset = PERIOD_PRESETS.find((p) => p.key === key);
  const label = preset
    ? key === "mes" || key === "mesant"
      ? cap(start.toLocaleDateString("es", { month: "long", year: "numeric" }))
      : preset.label
    : `${fmt(start)} – ${fmt(addDays(end, -1))}`;
  const prevLabel =
    key === "hoy" ? "ayer" : key === "ayer" ? "anteayer" : key === "mes" ? "el mismo tramo del mes anterior" : key === "anio" ? "el año anterior a la fecha" : "el periodo anterior";

  return {
    key,
    start,
    end,
    label,
    prevStart,
    prevEnd,
    prevLabel,
    days,
    bucket: days <= 1 ? "hour" : days <= 62 ? "day" : "month",
    query: key === "rango" ? `p=rango&desde=${isoDay(start)}&hasta=${isoDay(addDays(end, -1))}` : `p=${key}`,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Etiquetas de cada barra de evolución, con cero donde no hubo ventas. */
export function buckets(period: Period) {
  const out: { key: string; label: string; long: string }[] = [];
  if (period.bucket === "hour") {
    for (let h = 0; h < 24; h++) out.push({ key: String(h), label: `${h}`, long: `${h}:00 – ${h}:59` });
  } else if (period.bucket === "day") {
    for (let d = new Date(period.start); d < period.end; d = addDays(d, 1)) {
      out.push({
        key: isoDay(d),
        label: String(d.getDate()),
        long: cap(d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })),
      });
    }
  } else {
    for (let d = new Date(period.start.getFullYear(), period.start.getMonth(), 1); d < period.end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("es", { month: "short" }),
        long: cap(d.toLocaleDateString("es", { month: "long", year: "numeric" })),
      });
    }
  }
  return out;
}

export function bucketKey(period: Period, d: Date) {
  if (period.bucket === "hour") return String(d.getHours());
  if (period.bucket === "day") return isoDay(d);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/** Variación porcentual contra el periodo anterior (null si no hay base). */
export function delta(current: number, previous: number) {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}
