import { formatMoney } from "@/lib/config";
import { delta, resolvePeriod } from "@/lib/period";
import { salesSummary } from "@/lib/reports";
import { Panel, ReportHeader, StatTile } from "@/components/reports/Blocks";
import { BarList, ColumnChart, SegmentedBar } from "@/components/reports/Charts";

export const dynamic = "force-dynamic";

export default async function VentasReportPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  const period = resolvePeriod(await searchParams);
  const s = await salesSummary(period);
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
