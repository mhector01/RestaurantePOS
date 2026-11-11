import { Banknote, CreditCard, Receipt, TrendingUp, Trophy } from "lucide-react";
import prisma from "@/lib/prisma";
import { PrintAndCloseButton } from "@/components/PrintAndCloseButton";
import { PageHeader } from "@/components/admin/AdminNav";
import { BUSINESS, formatMoney } from "@/lib/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const [ordenesPagadas, openAccounts] = await Promise.all([
    prisma.order.findMany({
      where: { status: "PAID" },
      include: { user: true, payments: true },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.order.count({ where: { status: "OPEN", items: { some: {} } } }),
  ]);

  let totalCash = 0;
  let totalCard = 0;
  let totalRevenue = 0;
  for (const order of ordenesPagadas) {
    for (const p of order.payments) {
      totalRevenue += p.amount;
      if (p.method.toUpperCase() === "CARD") totalCard += p.amount;
      else totalCash += p.amount;
    }
  }

  const totalOrders = ordenesPagadas.length;
  const avg = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const since = ordenesPagadas[0]?.createdAt;

  const waiterStats: Record<number, { name: string; total: number; count: number }> = {};
  for (const order of ordenesPagadas) {
    const key = order.userId ?? 0;
    const orderTotal = order.payments.reduce((s, p) => s + p.amount, 0);
    waiterStats[key] ??= { name: order.user?.name ?? "Sin asignar", total: 0, count: 0 };
    waiterStats[key].total += orderTotal;
    waiterStats[key].count += 1;
  }
  const ranking = Object.values(waiterStats).sort((a, b) => b.total - a.total);
  const best = ranking[0]?.total ?? 0;
  const now = new Date();

  return (
    <>
      {/* ---------- Corte impreso (solo al imprimir) ---------- */}
      <div className="print-area hidden print:block font-mono text-[11px] text-black bg-white">
        <p className="text-center font-bold text-sm">{BUSINESS.name}</p>
        <p className="text-center font-bold">CORTE DE CAJA (Z)</p>
        <p className="text-center mb-2">{now.toLocaleString("es")}</p>
        <p>--------------------------------</p>
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL VENTAS</span>
          <span>{formatMoney(totalRevenue)}</span>
        </div>
        <div className="flex justify-between">
          <span>Efectivo en caja</span>
          <span>{formatMoney(totalCash)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tarjeta</span>
          <span>{formatMoney(totalCard)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cuentas cobradas</span>
          <span>{totalOrders}</span>
        </div>
        <p>--------------------------------</p>
        <p className="font-bold">Por mesero</p>
        {ranking.map((m) => (
          <div key={m.name} className="flex justify-between">
            <span>
              {m.name} ({m.count})
            </span>
            <span>{formatMoney(m.total)}</span>
          </div>
        ))}
        <p>--------------------------------</p>
        <p className="text-center mt-2">Fin del turno</p>
      </div>

      {/* ---------- Pantalla ---------- */}
      <div className="print:hidden">
        <PageHeader
          title="Cierre de caja"
          description={
            since
              ? `Turno actual · desde ${since.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}`
              : "Turno actual · aún sin ventas"
          }
        >
          <PrintAndCloseButton hasSales={totalOrders > 0} openAccounts={openAccounts} />
        </PageHeader>

        {openAccounts > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
            Hay {openAccounts} cuenta{openAccounts === 1 ? "" : "s"} abierta{openAccounts === 1 ? "" : "s"}. Cóbralas
            antes de cerrar para que entren en este turno.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card label="Total vendido" value={formatMoney(totalRevenue)} Icon={TrendingUp} tone="dark" />
          <Card label="Efectivo en caja" value={formatMoney(totalCash)} Icon={Banknote} tone="green" />
          <Card label="Tarjeta" value={formatMoney(totalCard)} Icon={CreditCard} tone="blue" />
          <Card label="Cuentas cobradas" value={String(totalOrders)} sub={`Promedio ${formatMoney(avg)}`} Icon={Receipt} />
        </div>

        <section className="mt-4 rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            <h2 className="font-semibold">Ventas por mesero</h2>
          </div>
          {ranking.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-muted-foreground">Todavía no hay ventas en este turno.</p>
          ) : (
            <ul className="divide-y border-t">
              {ranking.map((m, i) => (
                <li key={m.name} className="px-5 py-4 flex items-center gap-4">
                  <span
                    className={cn(
                      "size-9 rounded-full grid place-items-center text-sm font-semibold shrink-0",
                      i === 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="font-semibold tabular">{formatMoney(m.total)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${best > 0 ? (m.total / best) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {m.count} cuenta{m.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Card({
  label,
  value,
  sub,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "dark" | "green" | "blue";
}) {
  return (
    <div className={cn("rounded-2xl p-4 sm:p-5 border", tone === "dark" ? "bg-gradient-to-br from-primary to-orange-700 text-primary-foreground border-primary" : "bg-card")}>
      <div className="flex items-center justify-between">
        <p className={cn("text-sm", tone === "dark" ? "text-white/80" : "text-muted-foreground")}>{label}</p>
        <Icon
          className={cn(
            "size-4",
            tone === "dark" ? "text-primary" : tone === "green" ? "text-success" : tone === "blue" ? "text-sky-600" : "text-muted-foreground"
          )}
        />
      </div>
      <p
        className={cn(
          "text-xl sm:text-3xl font-semibold tabular mt-2 truncate",
          tone === "green" && "text-success",
          tone === "blue" && "text-sky-600"
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
