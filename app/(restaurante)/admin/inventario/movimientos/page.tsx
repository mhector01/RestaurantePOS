import prisma from "@/lib/prisma";
import { formatMoney } from "@/lib/config";
import { MOVEMENT_LABEL, formatQty } from "@/lib/inventory";
import { MiniKpi, SectionBar } from "@/components/inventory/InventoryTabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  PURCHASE: "bg-success/15 text-success",
  SALE: "bg-sky-500/15 text-sky-300",
  WASTE: "bg-red-500/15 text-red-300",
  COUNT: "bg-violet-500/15 text-violet-300",
  INITIAL: "bg-muted text-foreground",
  VOID: "bg-muted text-muted-foreground",
};

const RANGES = [
  { value: "1", label: "Hoy" },
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
];

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ insumo?: string; tipo?: string; dias?: string }>;
}) {
  const sp = await searchParams;
  const ingredientId = sp.insumo ? parseInt(sp.insumo) : NaN;
  const type = sp.tipo && MOVEMENT_LABEL[sp.tipo] ? sp.tipo : undefined;
  const days = RANGES.some((r) => r.value === sp.dias) ? parseInt(sp.dias!) : 7;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const where = {
    createdAt: { gte: since },
    ...(Number.isFinite(ingredientId) ? { ingredientId } : {}),
    ...(type ? { type } : {}),
  };

  const [ingredients, movements, totals] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, unit: true } }),
    prisma.stockMovement.findMany({ where, include: { ingredient: true }, orderBy: { createdAt: "desc" }, take: 400 }),
    prisma.stockMovement.findMany({ where, select: { type: true, quantity: true, unitCost: true } }),
  ]);

  const valueOf = (t: string) =>
    totals.filter((m) => m.type === t).reduce((s, m) => s + m.quantity * m.unitCost, 0);
  const purchases = valueOf("PURCHASE") + valueOf("VOID");
  const sales = Math.abs(valueOf("SALE"));
  const waste = Math.abs(valueOf("WASTE"));
  const count = valueOf("COUNT");
  const selected = ingredients.find((i) => i.id === ingredientId);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Entró por compras" value={formatMoney(purchases)} />
        <MiniKpi label="Salió por ventas (costo)" value={formatMoney(sales)} hint="Costo de lo que se vendió" />
        <MiniKpi label="Mermas" value={formatMoney(waste)} tone={waste > 0 ? "danger" : undefined} />
        <MiniKpi
          label="Ajustes de conteo"
          value={`${count < 0 ? "−" : count > 0 ? "+" : ""}${formatMoney(Math.abs(count))}`}
          hint={count < 0 ? "Faltó mercadería" : count > 0 ? "Sobró mercadería" : "Sin diferencias"}
          tone={count < 0 ? "danger" : undefined}
        />
      </div>

      <SectionBar
        title={selected ? `Movimientos de ${selected.name}` : "Movimientos"}
        description="Cada entrada y salida de inventario (kardex)."
      />

      <form className="flex flex-wrap gap-2 mb-4" action="/admin/inventario/movimientos">
        <select
          name="insumo"
          defaultValue={selected ? String(selected.id) : ""}
          className="h-11 rounded-xl border border-input bg-card px-3 text-sm min-w-48 flex-1 sm:flex-none"
        >
          <option value="">Todos los insumos</option>
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={type ?? ""} className="h-11 rounded-xl border border-input bg-card px-3 text-sm">
          <option value="">Todos los tipos</option>
          {Object.entries(MOVEMENT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="dias" defaultValue={String(days)} className="h-11 rounded-xl border border-input bg-card px-3 text-sm">
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="h-11 rounded-xl">
          Filtrar
        </Button>
      </form>

      {movements.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          No hay movimientos en este periodo.
        </p>
      ) : (
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Fecha</th>
                {!selected && <th className="text-left font-medium px-2">Insumo</th>}
                <th className="text-left font-medium px-2">Tipo</th>
                <th className="text-right font-medium px-2">Cantidad</th>
                <th className="text-right font-medium px-2">Quedó</th>
                <th className="text-right font-medium px-2">Valor</th>
                <th className="text-left font-medium px-4">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground tabular">
                    {m.createdAt.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  {!selected && <td className="px-2 font-medium">{m.ingredient.name}</td>}
                  <td className="px-2">
                    <span className={cn("text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap", TYPE_STYLE[m.type])}>
                      {MOVEMENT_LABEL[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className={cn("px-2 text-right tabular font-medium whitespace-nowrap", m.quantity < 0 ? "text-red-300" : "text-success")}>
                    {m.quantity > 0 ? "+" : ""}
                    {formatQty(m.quantity, m.ingredient.unit)}
                  </td>
                  <td className="px-2 text-right tabular whitespace-nowrap">{formatQty(m.stockAfter, m.ingredient.unit)}</td>
                  <td className="px-2 text-right tabular text-muted-foreground whitespace-nowrap">
                    {formatMoney(Math.abs(m.quantity * m.unitCost))}
                  </td>
                  <td className="px-4 text-muted-foreground max-w-56 truncate">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 400 && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t">Se muestran los 400 más recientes. Usa los filtros para ver más.</p>
          )}
        </div>
      )}
    </>
  );
}
