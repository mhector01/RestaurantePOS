import { formatMoney } from "@/lib/config";
import { delta, resolvePeriod } from "@/lib/period";
import { discountSummary, salesSummary, tipSummary } from "@/lib/reports";
import { DISCOUNT_KIND_LABEL, formatDni, type DiscountKind } from "@/lib/discounts";
import { Panel, ReportHeader, StatTile } from "@/components/reports/Blocks";
import { BarList, ColumnChart, SegmentedBar } from "@/components/reports/Charts";

export const dynamic = "force-dynamic";

export default async function VentasReportPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  const period = resolvePeriod(await searchParams);
  const [s, disc, tips] = await Promise.all([salesSummary(period), discountSummary(period), tipSummary(period)]);
  const evoTitle = period.bucket === "hour" ? "Ventas por hora" : period.bucket === "day" ? "Ventas por día" : "Ventas por mes";
  const bestHour = s.hours.reduce((b, h) => (h.value > (b?.value ?? 0) ? h : b), s.hours[0]);
  const bestDay = s.weekdays.reduce((b, d) => (d.value > b.value ? d : b), s.weekdays[0]);

  return (
    <>
      <ReportHeader title="Ventas" period={period} csvHref={`/admin/reportes/csv?tipo=ventas&${period.query}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatTile hero label="Ventas" value={formatMoney(s.total)} delta={delta(s.total, s.prevTotal)} vs={period.prevLabel} />
        <StatTile label="Cuentas cobradas" value={s.orders.toLocaleString("es-HN")} delta={delta(s.orders, s.prevOrders)} vs={period.prevLabel} />
        <StatTile label="Ticket promedio" value={formatMoney(s.avg)} delta={delta(s.avg, s.prevAvg)} vs={period.prevLabel} />
        <StatTile label="Productos vendidos" value={s.units.toLocaleString("es-HN")} delta={delta(s.units, s.prevUnits)} vs={period.prevLabel} />
      </div>

      <div className="grid gap-4">
        <Panel title={evoTitle} description="Lo cobrado (con ISV). Pasa el cursor sobre una columna para ver el detalle.">
          <ColumnChart data={s.series} />
        </Panel>

        <div className="grid lg:grid-cols-2 gap-4">
          <Panel
            title="Horas pico"
            description={bestHour && bestHour.value > 0 ? `La hora más fuerte es ${bestHour.long}` : "Ventas según la hora del cobro"}
          >
            <ColumnChart data={s.hours} height={180} color="var(--series-2)" />
          </Panel>
          <Panel
            title="Días de la semana"
            description={bestDay.value > 0 ? `El día más fuerte es el ${bestDay.long.toLowerCase()}` : "Ventas según el día"}
          >
            <ColumnChart data={s.weekdays} height={180} color="var(--series-3)" />
          </Panel>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Formas de pago">
            <SegmentedBar
              parts={[
                { label: "Efectivo", value: s.methods.CASH, color: "var(--series-3)" },
                { label: "Tarjeta", value: s.methods.CARD, color: "var(--series-1)" },
                { label: "Transferencia", value: s.methods.TRANSFER ?? 0, color: "var(--series-4)" },
              ]}
            />
          </Panel>
          <Panel title="Mesas y para llevar">
            <SegmentedBar
              parts={[
                { label: "En mesa", value: s.channel.MESA ?? 0, color: "var(--series-1)" },
                { label: "Para llevar", value: s.channel.LLEVAR ?? 0, color: "var(--series-2)" },
              ]}
            />
          </Panel>
        </div>

        <Panel
          title="Descuentos y cortesías"
          description={
            disc.count
              ? `${formatMoney(disc.total)} en ${disc.count} cobro${disc.count === 1 ? "" : "s"}: lo que se dejó de cobrar en el periodo.`
              : "No se otorgaron descuentos en este periodo."
          }
        >
          {disc.count > 0 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-5">
                <BarList
                  rows={disc.byKind.map((k) => ({
                    label: k.kind === "PERCENT" || k.kind === "AMOUNT" ? (k.kind === "PERCENT" ? "Descuento %" : "Descuento por monto") : DISCOUNT_KIND_LABEL[k.kind as DiscountKind] ?? k.kind,
                    value: k.amount,
                    extra: `${k.count} ${k.count === 1 ? "vez" : "veces"}`,
                  }))}
                  color="var(--series-2)"
                />
                <div>
                  <p className="text-sm font-medium mb-2">Quién los aplicó o autorizó</p>
                  <BarList rows={disc.byPerson.map((p) => ({ label: p.name, value: p.amount, extra: `${p.count} ${p.count === 1 ? "vez" : "veces"}` }))} color="var(--series-5)" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Últimos descuentos</p>
                <ul className="divide-y rounded-xl border text-sm">
                  {disc.recent.map((d) => (
                    <li key={d.id} className="px-3 py-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate">{d.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.createdAt.toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}
                          {d.appliedBy && ` · ${d.appliedBy}`}
                          {d.authorizedBy && ` · autorizó ${d.authorizedBy}`}
                          {d.beneficiaryId && ` · Id. ${formatDni(d.beneficiaryId)}`}
                        </p>
                      </div>
                      <span className="tabular font-medium whitespace-nowrap">−{formatMoney(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Propinas"
          description={
            tips.count
              ? `${formatMoney(tips.total)} en ${tips.count} cobro${tips.count === 1 ? "" : "s"} · efectivo ${formatMoney(tips.cash)} · tarjeta o transferencia ${formatMoney(tips.card)}. No son venta ni llevan ISV.`
              : "Ningún cliente dejó propina en este periodo."
          }
        >
          {tips.count > 0 && (
            <BarList
              rows={tips.byWaiter.map((w) => ({
                label: w.name,
                value: w.amount,
                extra: `${w.count} cuenta${w.count === 1 ? "" : "s"} · ${w.sales > 0 ? Math.round((w.amount / w.sales) * 1000) / 10 : 0}% de lo cobrado`,
              }))}
              color="var(--series-3)"
            />
          )}
        </Panel>

        <Panel title="Ventas por mesero" description="Lo que vendió cada uno y su ticket promedio.">
          <BarList
            rows={s.waiters.map((w) => ({
              label: w.name,
              value: w.total,
              extra: `${w.orders} cuenta${w.orders === 1 ? "" : "s"} · prom. ${formatMoney(w.orders ? w.total / w.orders : 0)}`,
            }))}
            emptyText="Sin ventas en este periodo"
          />
        </Panel>
      </div>
    </>
  );
}
