import { AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/config";
import { delta, resolvePeriod } from "@/lib/period";
import { productSales, profitSummary } from "@/lib/reports";
import { Panel, ReportHeader, StatTile } from "@/components/reports/Blocks";
import { BarList, ColumnChart } from "@/components/reports/Charts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GananciasReportPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  const period = resolvePeriod(await searchParams);
  const [g, prod] = await Promise.all([profitSummary(period), productSales(period)]);
  const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
  const topProfit = prod.products.filter((p) => p.costed).sort((a, b) => b.profit - a.profit);

  const rows: { label: string; value: number; tone?: "sub" | "total" | "neg"; hint?: string }[] = [
    { label: "Ventas cobradas (con ISV)", value: g.gross },
    { label: "− ISV cobrado (es de la SAR, no tuyo)", value: -g.tax, tone: "neg" },
    { label: "Ventas netas", value: g.net, tone: "sub" },
    { label: "− Costo de lo vendido (insumos según receta)", value: -g.cost, tone: "neg" },
    { label: "Utilidad bruta", value: g.grossProfit, tone: "sub", hint: g.net > 0 ? `Margen ${pct(g.margin)}` : undefined },
    { label: "− Mermas registradas", value: -g.waste, tone: "neg" },
    {
      label: g.countAdj < 0 ? "− Faltantes en conteo físico" : "Sobrantes en conteo físico (no se suman)",
      value: g.countAdj < 0 ? g.countAdj : 0,
      tone: "neg",
      hint: g.countAdj > 0 ? formatMoney(g.countAdj) : undefined,
    },
    { label: "Utilidad bruta real", value: g.adjusted, tone: "total" },
  ];

  return (
    <>
      <ReportHeader title="Ganancias y costos" period={period} csvHref={`/admin/reportes/csv?tipo=ganancias&${period.query}`} />

      {g.coverage < 0.8 && g.net > 0 && (
        <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 text-amber-100 p-4 text-sm flex gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          Solo el {Math.round(g.coverage * 100)}% de lo vendido tiene receta con costo. Lo demás aparece como si no costara nada,
          así que la utilidad real es menor. Completa las recetas en Inventario → Recetas.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile hero label="Utilidad bruta" value={formatMoney(g.grossProfit)} delta={delta(g.grossProfit, g.prevProfit)} vs={period.prevLabel} />
        <StatTile label="Margen bruto" value={g.net > 0 ? pct(g.margin) : "—"} hint="Utilidad sobre ventas netas" />
        <StatTile
          label="Costo de alimentos"
          value={g.foodCost === null ? "—" : pct(g.foodCost)}
          hint={g.foodCost === null ? "Sin recetas con costo" : g.foodCost <= 0.35 ? "Saludable (25% – 35%)" : "Alto: revisa porciones y precios"}
        />
        <StatTile label="Compras del periodo" value={formatMoney(g.purchases)} hint={`${g.purchaseCount} factura${g.purchaseCount === 1 ? "" : "s"} de proveedores`} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <Panel title="Estado de resultados" description="De lo cobrado a lo que realmente queda, antes de gastos fijos.">
          <dl className="text-sm">
            {rows.map((r) => (
              <div
                key={r.label}
                className={cn(
                  "flex items-baseline justify-between gap-3 py-2",
                  r.tone === "sub" && "border-t font-semibold",
                  r.tone === "total" && "border-t-2 border-foreground/40 font-semibold text-base"
                )}
              >
                <dt className={cn(r.tone === "neg" && "text-muted-foreground")}>
                  {r.label}
                  {r.hint && <span className="ml-2 text-xs font-normal text-muted-foreground">{r.hint}</span>}
                </dt>
                <dd className={cn("tabular whitespace-nowrap", r.value < 0 && "text-muted-foreground")}>{formatMoney(r.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground mt-3">
            No incluye gastos fijos (planilla, alquiler, luz, agua, gas). Réstalos de la utilidad bruta real para conocer la
            utilidad neta del negocio.
          </p>
        </Panel>

        <Panel
          title={period.bucket === "hour" ? "Utilidad bruta por hora" : period.bucket === "day" ? "Utilidad bruta por día" : "Utilidad bruta por mes"}
          description="Ventas netas menos costo de insumos."
        >
          <ColumnChart data={g.series} color="var(--series-3)" />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Los que más ganancia dejan" description="Utilidad bruta total en el periodo (solo productos con receta).">
          <BarList
            limit={8}
            color="var(--series-3)"
            rows={topProfit.map((p) => ({
              label: p.name,
              value: p.profit,
              sub: p.category,
              extra: `${p.units} u · margen ${p.margin === null ? "—" : `${Math.round(p.margin * 100)}%`}`,
            }))}
            emptyText="Aún no hay ventas de productos con receta"
          />
        </Panel>
      </div>
    </>
  );
}
