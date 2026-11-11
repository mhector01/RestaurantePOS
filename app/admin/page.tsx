import Link from "next/link";
import { ArrowRight, Banknote, Clock, CreditCard, Receipt, TrendingUp, UserRound } from "lucide-react";
import prisma from "@/lib/prisma";
import { getDailySales } from "@/app/actions";
import { PageHeader } from "@/components/admin/AdminNav";
import { AutoRefresh } from "@/components/pos/AutoRefresh";
import { formatElapsed, formatMoney } from "@/lib/config";

export const dynamic = "force-dynamic";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function AdminDashboard() {
  const [ventas, openOrders, tableCount] = await Promise.all([
    getDailySales(),
    prisma.order.findMany({
      where: { status: "OPEN", items: { some: {} } },
      include: { items: true, table: true, user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.table.count({ where: { number: { gt: 0 } } }),
  ]);

  const avg = ventas.transacciones > 0 ? ventas.total / ventas.transacciones : 0;
  const pending = openOrders.reduce(
    (s, o) => s + o.items.reduce((a, i) => a + i.price * i.quantity, 0),
    0
  );
  const cashPct = ventas.total > 0 ? Math.round((ventas.efectivo / ventas.total) * 100) : 0;

  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHeader
        title={greeting()}
        description={new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
      />

      {/* Indicadores del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Ventas de hoy" value={formatMoney(ventas.total)} Icon={TrendingUp} highlight />
        <Kpi label="Cobros" value={String(ventas.transacciones)} Icon={Receipt} />
        <Kpi label="Ticket promedio" value={formatMoney(avg)} Icon={Receipt} />
        <Kpi label="Por cobrar ahora" value={formatMoney(pending)} Icon={Clock} />
      </div>

      {/* Efectivo vs tarjeta */}
      <section className="mt-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Formas de pago de hoy</h2>
          <Link href="/admin/reportes" className="text-sm font-medium text-primary inline-flex items-center gap-1">
            Ver caja <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
          <div className="bg-success h-full" style={{ width: `${cashPct}%` }} />
          <div className="bg-sky-500 h-full" style={{ width: `${ventas.total > 0 ? 100 - cashPct : 0}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-xl bg-success/12 text-success grid place-items-center">
              <Banknote className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Efectivo</p>
              <p className="font-semibold tabular">{formatMoney(ventas.efectivo)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-xl bg-sky-500/12 text-sky-600 grid place-items-center">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Tarjeta</p>
              <p className="font-semibold tabular">{formatMoney(ventas.tarjeta)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* En este momento */}
      <section className="mt-4 rounded-2xl border bg-card overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">En este momento</h2>
            <p className="text-sm text-muted-foreground">
              {openOrders.length} cuenta{openOrders.length === 1 ? "" : "s"} abierta
              {openOrders.length === 1 ? "" : "s"} · {tableCount} mesas en total
            </p>
          </div>
        </div>
        {openOrders.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted-foreground">No hay cuentas abiertas.</p>
        ) : (
          <ul className="divide-y border-t">
            {openOrders.map((o) => {
              const total = o.items.reduce((a, i) => a + i.price * i.quantity, 0);
              const n = o.items.reduce((a, i) => a + i.quantity, 0);
              return (
                <li key={o.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="size-11 rounded-xl bg-accent text-accent-foreground grid place-items-center font-semibold shrink-0">
                    {o.table.number === 0 ? "PL" : o.table.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{o.table.number === 0 ? "Para llevar" : `Mesa ${o.table.number}`}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-3">
                      <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                        <Clock className="size-3" /> {formatElapsed(o.createdAt)}
                      </span>
                      {o.user && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserRound className="size-3" /> {o.user.name}
                        </span>
                      )}
                      <span>{n} prod.</span>
                    </p>
                  </div>
                  <span className="font-semibold tabular">{formatMoney(total)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Kpi({
  label,
  value,
  Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  Icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-primary to-orange-700 text-primary-foreground shadow-lg shadow-primary/20" : "rounded-2xl p-4 sm:p-5 bg-card border"}>
      <div className="flex items-center justify-between">
        <p className={highlight ? "text-sm text-white/80" : "text-sm text-muted-foreground"}>{label}</p>
        <Icon className={highlight ? "size-4 text-primary" : "size-4 text-muted-foreground"} />
      </div>
      <p className="text-xl sm:text-3xl font-semibold tabular mt-2 truncate">{value}</p>
    </div>
  );
}
