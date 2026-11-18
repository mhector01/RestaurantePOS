import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { rootPrisma } from "@/lib/prisma-base";
import { defaultRestaurantId, restaurantStats, restaurantUrl, DAY } from "@/lib/platform";
import { formatMoney } from "@/lib/config";
import { NewRestaurantDialog } from "@/components/platform/NewRestaurantDialog";
import { RestaurantFilter } from "@/components/platform/RestaurantFilter";
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
  const [restaurants, stats, defaultId] = await Promise.all([
    rootPrisma.restaurant.findMany({ orderBy: { createdAt: "asc" } }),
    restaurantStats(),
    defaultRestaurantId(),
  ]);
  const now = new Date().getTime();
  const active = restaurants.filter((r) => r.status === "ACTIVE");
  const sales30 = restaurants.reduce((s, r) => s + stats.get(r.id).sales30, 0);
  const idle = active.filter((r) => {
    const last = stats.get(r.id).lastSale;
    return !last || now - last.getTime() > 14 * DAY;
  }).length;

  const term = q.trim().toLowerCase();
  const shown = restaurants.filter((r) => {
    if (estado === "activos" && r.status !== "ACTIVE") return false;
    if (estado === "suspendidos" && r.status === "ACTIVE") return false;
    if (!term) return true;
    const owners = stats.get(r.id).owners.map((o) => o.email).join(" ");
    return `${r.name} ${r.slug} ${owners}`.toLowerCase().includes(term);
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Restaurantes</h1>
          <p className="text-muted-foreground mt-1">Los clientes que usan Ristemo.</p>
        </div>
        <NewRestaurantDialog />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Restaurantes activos" value={String(active.length)} />
        <Kpi label="Suspendidos" value={String(restaurants.length - active.length)} />
        <Kpi label="Ventas de todos (30 días)" value={formatMoney(sales30)} />
        <Kpi label="Sin ventas en 14 días" value={String(idle)} hint={idle ? "Activos que quizás dejaron de usarlo" : undefined} />
      </div>

      <RestaurantFilter q={q} estado={estado} />

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
          {restaurants.length === 0 ? "Aún no hay restaurantes. Crea el primero." : "Ningún restaurante coincide con la búsqueda."}
        </p>
      ) : (
        <ul className="rounded-2xl border bg-card divide-y overflow-hidden">
          {shown.map((r) => {
            const s = stats.get(r.id);
            const act = activity(s.lastSale, now);
            const url = r.id === defaultId ? "Dominio principal" : restaurantUrl(r.slug)?.replace(/^https?:\/\//, "") ?? `${r.slug}.(falta ROOT_DOMAIN)`;
            return (
              <li key={r.id}>
                <Link href={`/plataforma/r/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.name || r.slug}</p>
                      {r.status !== "ACTIVE" && (
                        <span className="text-[11px] font-semibold rounded-full bg-red-500/15 text-red-300 px-2 py-0.5">Suspendido</span>
                      )}
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
                      {s.payments30} cobro{s.payments30 === 1 ? "" : "s"} en 30 días
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

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold tabular mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
