/** Mes a partir de "2026-11" (o el actual): inicio, fin y navegación. */
export function monthRange(mes?: string) {
  const now = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const m = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : key(now);
  const [y, mo] = m.split("-").map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 1);
  const text = start.toLocaleDateString("es", { month: "long", year: "numeric" });
  return {
    key: key(start),
    start,
    end,
    label: text.charAt(0).toUpperCase() + text.slice(1),
    prev: key(new Date(y, mo - 2, 1)),
    next: key(new Date(y, mo, 1)),
    isCurrent: key(start) === key(now),
  };
}
