import Link from "next/link";
import { formatMoney } from "@/lib/config";
import { resolvePeriod } from "@/lib/period";
import { productSales, type MenuClass } from "@/lib/reports";
import { Panel, ReportHeader, StatTile } from "@/components/reports/Blocks";
import { BarList } from "@/components/reports/Charts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CLASSES: Record<MenuClass, { title: string; what: string; todo: string; dot: string }> = {
  estrella: {
    title: "Estrellas",
    what: "Se venden mucho y dejan buena ganancia.",
    todo: "Cuídalas: misma receta, buena ubicación en el menú y que nunca falten.",
    dot: "var(--series-6)",
  },
  caballo: {
    title: "Caballos de batalla",
    what: "Se venden mucho pero dejan poca ganancia.",
    todo: "Revisa porción y costo de la receta, o súbeles un poco el precio.",
    dot: "var(--series-4)",
  },
  rompecabezas: {
    title: "Rompecabezas",
    what: "Dejan buena ganancia pero se venden poco.",
    todo: "Promociónalos: que el mesero los recomiende, mejor foto o lugar en el menú.",
    dot: "var(--series-1)",
  },
  perro: {
    title: "Perros",
    what: "Se venden poco y dejan poca ganancia.",
    todo: "Candidatos a salir del menú o a rediseñarse.",
    dot: "var(--series-8)",
  },
};

type Sort = "ventas" | "unidades" | "ganancia";

export default async function ProductosReportPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string; orden?: string }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const sort: Sort = sp.orden === "unidades" || sp.orden === "ganancia" ? sp.orden : "ventas";
  const r = await productSales(period);
  const sorted = [...r.products].sort((a, b) =>
    sort === "unidades" ? b.units - a.units : sort === "ganancia" ? b.profit - a.profit : b.total - a.total
  );
  const top = sorted[0];
  const low = [...r.products].filter((p) => !p.combo).sort((a, b) => a.units - b.units).slice(0, 5);
  const sortHref = (o: Sort) => `/admin/reportes/productos?${period.query}${o === "ventas" ? "" : `&orden=${o}`}`;

  return (
    <>
      <ReportHeader title="Productos" period={period} csvHref={`/admin/reportes/csv?tipo=productos&${period.query}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile hero label="Vendido en productos" value={formatMoney(r.totalSales)} hint={`${r.products.length} productos distintos`} />
        <StatTile label="Unidades" value={r.totalUnits.toLocaleString("es-HN")} hint="Platos y bebidas vendidos" />
        <StatTile label="El más vendido" value={top?.name ?? "—"} hint={top ? `${top.units} unidades · ${formatMoney(top.total)}` : undefined} />
        <StatTile
          label="Ventas con costo conocido"
          value={`${Math.round(r.costedShare * 100)}%`}
          hint={r.costedShare < 0.8 ? "Arma recetas para medir la ganancia" : "Buena cobertura de recetas"}
        />
      </div>

      <div className="grid gap-4">
        <Panel
          title="Ranking de productos"
          action={
            <div className="flex rounded-xl border bg-muted/40 p-1 text-xs print:hidden">
              {(["ventas", "unidades", "ganancia"] as Sort[]).map((o) => (
                <Link
                  key={o}
                  href={sortHref(o)}
                  scroll={false}
                  className={cn("px-2.5 h-7 rounded-lg grid place-items-center capitalize font-medium", sort === o ? "bg-card shadow-sm" : "text-muted-foreground")}
                >
                  {o}
                </Link>
              ))}
            </div>
          }
        >
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin ventas en este periodo</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left font-medium py-2 px-4 sm:px-0">Producto</th>
                    <th className="text-right font-medium px-2">Unidades</th>
                    <th className="text-right font-medium px-2">Ventas</th>
                    <th className="text-right font-medium px-2">% del total</th>
                    <th className="text-right font-medium px-2">Costo</th>
                    <th className="text-right font-medium px-2">Ganancia</th>
                    <th className="text-right font-medium px-4 sm:px-0">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular">
                  {sorted.map((p) => (
                    <tr key={p.name}>
                      <td className="py-2 px-4 sm:px-0">
                        <p className="font-medium font-sans">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-sans">{p.category}</p>
                      </td>
                      <td className="text-right px-2">{p.units}</td>
                      <td className="text-right px-2 font-semibold">{formatMoney(p.total)}</td>
                      <td className="text-right px-2 text-muted-foreground">{(p.share * 100).toFixed(1)}%</td>
                      <td className="text-right px-2 text-muted-foreground">{p.costed ? formatMoney(p.cost) : "—"}</td>
                      <td className="text-right px-2">{p.costed ? formatMoney(p.profit) : "—"}</td>
                      <td className="text-right px-4 sm:px-0">
                        {p.margin === null ? (
                          <span className="text-xs text-muted-foreground" title="Sin receta: no se conoce el costo">
                            sin receta
                          </span>
                        ) : (
                          `${Math.round(p.margin * 100)}%`
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Ventas por categoría">
            <BarList rows={r.categories.map((c) => ({ label: c.name, value: c.total, extra: `${c.units} unid.` }))} emptyText="Sin ventas" />
          </Panel>
          <Panel title="Los que menos se venden" description="Revisa si vale la pena mantenerlos en el menú.">
            <BarList
              format="int"
              color="var(--series-8)"
              rows={low.map((p) => ({ label: p.name, value: p.units, sub: p.category, extra: formatMoney(p.total) }))}
              emptyText="Sin ventas"
            />
          </Panel>
        </div>

        <Panel
          title="Ingeniería de menú"
          description="Clasifica cada plato con receta según cuánto se vende y cuánto deja por plato (sin ISV). Así sabes qué empujar, qué ajustar y qué quitar."
        >
          {r.matrix.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Se necesitan al menos dos platos con receta vendidos en el periodo. Arma las recetas en Inventario → Recetas.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(CLASSES) as MenuClass[]).map((k) => {
                const c = CLASSES[k];
                const items = r.matrix.filter((m) => m.cls === k).sort((a, b) => b.units - a.units);
                return (
                  <div key={k} className="rounded-xl border bg-background/40 p-4 break-inside-avoid">
                    <p className="font-semibold flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: c.dot }} /> {c.title}
                      <span className="text-xs text-muted-foreground font-normal">{items.length}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.what}</p>
                    <p className="text-xs mt-1">{c.todo}</p>
                    {items.length > 0 ? (
                      <ul className="mt-3 space-y-1 text-sm">
                        {items.map((m) => (
                          <li key={m.name} className="flex justify-between gap-2">
                            <span className="truncate">{m.name}</span>
                            <span className="text-xs text-muted-foreground tabular whitespace-nowrap">
                              {m.units} u · {formatMoney(m.unitProfit)}/plato
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">Ninguno</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {r.matrix.length >= 2 && (
            <p className="text-xs text-muted-foreground mt-3">
              Ganancia promedio por plato: {formatMoney(r.avgProfit)}. Un plato es «popular» si vende al menos el 70% de lo que le
              tocaría en partes iguales.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}
