// Utilidades de inventario que sirven tanto en el servidor como en el navegador.

export const UNITS = [
  { value: "unid", label: "Unidad" },
  { value: "kg", label: "Kilogramo" },
  { value: "g", label: "Gramo" },
  { value: "lb", label: "Libra" },
  { value: "oz", label: "Onza" },
  { value: "l", label: "Litro" },
  { value: "ml", label: "Mililitro" },
] as const;

export const MOVEMENT_LABEL: Record<string, string> = {
  PURCHASE: "Compra",
  SALE: "Venta",
  WASTE: "Merma",
  COUNT: "Conteo",
  INITIAL: "Stock inicial",
  VOID: "Compra anulada",
};

export const WASTE_REASONS = ["Vencido", "Dañado", "Se quemó / mal preparado", "Se cayó", "Cortesía", "Consumo del personal"];

/** Cantidades sin ceros de más: 2 → "2", 0.25 → "0.25", 1.3333 → "1.333". */
export function formatQty(value: number, unit?: string) {
  const n = Math.round(value * 1000) / 1000;
  const text = n.toLocaleString("es-HN", { maximumFractionDigits: 3 });
  return unit ? `${text} ${unit}` : text;
}

export type StockLevel = "out" | "low" | "ok";

/** Agotado si no queda nada; bajo si llegó al mínimo (punto de reorden). */
export function stockLevel(stock: number, minStock: number): StockLevel {
  if (stock <= 0) return "out";
  if (minStock > 0 && stock <= minStock) return "low";
  return "ok";
}

/** Cuánto pedir para volver al stock ideal (o al doble del mínimo si no hay ideal). */
export function suggestedOrder(stock: number, minStock: number, maxStock: number | null) {
  const target = maxStock && maxStock > minStock ? maxStock : minStock * 2;
  return Math.max(0, Math.ceil((target - Math.max(stock, 0)) * 100) / 100);
}

/** Convierte el texto de un input a número (acepta coma decimal). */
export function parseQty(text: string) {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}
