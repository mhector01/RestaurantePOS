import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { rootPrisma } from "@/lib/prisma-base";
import { defaultRestaurantId, restaurantStats, restaurantUrl, DAY } from "@/lib/platform";
import { billingOf, getPlatformSettings } from "@/lib/billing";
import { formatMoney } from "@/lib/config";
import { NewRestaurantDialog } from "@/components/platform/NewRestaurantDialog";
import { RestaurantFilter } from "@/components/platform/RestaurantFilter";
import { BillingBadge } from "@/components/platform/BillingBadge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fmtDate = (d: Date) => d.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });

function activity(last: Date | null, now: number) {
  if (!last) return { text: "Sin ventas aún", tone: "muted" as const };
  const days = Math.floor((now - last.getTime()) / DAY);
  if (days <= 0) return { text: "Vendió hoy", tone: "good" as const };
  if (days <= 3) return { text: `Última venta hace ${days} día${days === 1 ? "" : "s"}`, tone: "good" as const };
  if (days <= 14) return { text: `Última venta hace ${days} días`, tone: "warn" as const };
  return { text: `Sin ventas desde ${fmtDate(last)}`, tone: "bad" as const };
}

export default async function RestaurantesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const { q = "", estado = "" } = await searchParams;
  const [restaurants, stats, defaultId, settings, plans, paidCounts] = await Promise.all([
    rootPrisma.restaurant.findMany({ orderBy: { createdAt: "asc" }, include: { plan: true } }),
    restaurantStats(),
    defaultRestaurantId(),
    getPlatformSettings(),
    rootPrisma.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    rootPrisma.subscriptionPayment.groupBy({ by: ["restaurantId"], _count: true }),
  ]);
  const paying = new Set(paidCounts.map((p) => p.restaurantId));
  const now = new Date().getTime();

  const rows = restaurants.map((r) => {
    const billing = billingOf(r.paidUntil, settings.graceDays);
    const trial = !!r.paidUntil && !paying.has(r.id);
    const suspended = r.status !== "ACTIVE";
    return { r, billing, trial, suspended, s: stats.get(r.id) };
  });
  const usable = rows.filter((x) => !x.suspended && x.billing.state !== "EXPIRED");
  // Ingreso mensual: planes de los que ya pagan y siguen activos (no cuenta pruebas ni bloqueados)
  const mrr = usable.filter((x) => !x.trial && x.r.plan).reduce((s, x) => s + (x.r.plan?.price ?? 0), 0);
  const toCollect = rows.filter((x) => !x.suspended && (x.billing.state === "DUE_SOON" || x.billing.state === "GRACE"));
  const blocked = rows.filter((x) => x.suspended || x.billing.state === "EXPIRED");
  const trials = usable.filter((x) => x.trial).length;
  const newSignups = rows.filter((x) => x.r.source === "REGISTRO" && now - x.r.createdAt.getTime() < 7 * DAY).length;

  const term = q.trim().toLowerCase();
  const shown = rows.filter((x) => {
    if (estado === "activos" && (x.suspended || x.billing.state === "EXPIRED")) return false;
    if (estado === "por-cobrar" && !toCollect.includes(x)) return false;
    if (estado === "bloqueados" && !blocked.includes(x)) return false;
    if (estado === "prueba" && !x.trial) return false;
    if (!term) return true;
    const owners = x.s.owners.map((o) => o.email).join(" ");
    return `${x.r.name} ${x.r.slug} ${owners}`.toLowerCase().includes(term);
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Restaurantes</h1>
          <p className="text-muted-foreground mt-1">
            Los clientes que usan Ristemo.
            {newSignups > 0 && (
              <span className="text-primary font-medium">
                {" "}
                {newSignups} se registr{newSignups === 1 ? "ó" : "aron"} esta semana.
              </span>
            )}
          </p>
        </div>
        <NewRestaurantDialog plans={plans.map((p) => ({ id: p.id, name: p.name, price: p.price }))} trialDays={settings.trialDays} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Ingreso mensual" value={formatMoney(mrr)} hint="Planes de los que ya pagan" />
        <Kpi label="Restaurantes activos" value={String(usable.length)} hint={trials ? `${trials} en prueba gratis` : undefined} />
        <Kpi label="Por cobrar" value={String(toCollect.length)} hint={`Vencen en 7 días o están en gracia`} tone={toCollect.length ? "warn" : undefined} />
        <Kpi label="Bloqueados" value={String(blocked.length)} hint="Suspendidos o vencidos" tone={blocked.length ? "bad" : undefined} />
      </div>

      <RestaurantFilter q={q} estado={estado} />

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          {restaurants.length === 0 ? "Aún no hay restaurantes. Crea el primero." : "Ningún restaurante coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {shown.map(({ r, billing, trial, suspended, s }) => {
            const act = activity(s.lastSale, now);
            const url = r.id === defaultId ? "Dominio principal" : restaurantUrl(r.slug)?.replace(/^https?:\/\//, "") ?? `${r.slug}.(falta ROOT_DOMAIN)`;
            return (
              <li key={r.id}>
                <Link href={`/plataforma/r/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.name || r.slug}</p>
                      <BillingBadge billing={billing} trial={trial} suspended={suspended} />
                      {r.plan && <span className="text-[11px] text-muted-foreground">{r.plan.name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {url} · {s.owners[0]?.email ?? "sin dueño"}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-0.5",
                        act.tone === "good" && "text-emerald-300",
                        act.tone === "warn" && "text-amber-300",
                        act.tone === "bad" && "text-red-300",
                        act.tone === "muted" && "text-muted-foreground"
                      )}
                    >
                      {act.text}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold tabular">{formatMoney(s.sales30)}</p>
                    <p className="text-xs text-muted-foreground">
                      vendido en 30 días · {s.payments30} cobro{s.payments30 === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl sm:text-2xl font-semibold tabular mt-1", tone === "warn" && "text-amber-200", tone === "bad" && "text-red-300")}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
