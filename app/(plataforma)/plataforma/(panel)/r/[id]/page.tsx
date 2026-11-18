import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { rootPrisma } from "@/lib/prisma-base";
import { defaultRestaurantId, restaurantStats, restaurantUrl } from "@/lib/platform";
import { formatMoney } from "@/lib/config";
import { RestaurantAdmin } from "@/components/platform/RestaurantAdmin";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => (d ? d.toLocaleString("es-HN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default async function RestaurantePlataformaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [r, stats, defaultId, accounts] = await Promise.all([
    rootPrisma.restaurant.findUnique({ where: { id } }),
    restaurantStats([id]),
    defaultRestaurantId(),
    rootPrisma.account.findMany({ where: { restaurantId: id }, orderBy: [{ role: "desc" }, { name: "asc" }] }),
  ]);
  if (!r) notFound();
  const s = stats.get(id);
  const isDefault = id === defaultId;
  const url = restaurantUrl(r.slug);

  return (
    <>
      <Link href="/plataforma" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Restaurantes
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight truncate">{r.name || r.slug}</h1>
            {r.status === "ACTIVE" ? (
              <span className="text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-300 px-2.5 py-1">Activo</span>
            ) : (
              <span className="text-xs font-semibold rounded-full bg-red-500/15 text-red-300 px-2.5 py-1">
                Suspendido{r.suspendedAt ? ` desde ${r.suspendedAt.toLocaleDateString("es-HN")}` : ""}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Cliente desde {r.createdAt.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })}
            {isDefault && " · abre en el dominio principal"}
          </p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            {url.replace(/^https?:\/\//, "")} <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Ventas (30 días)" value={formatMoney(s.sales30)} sub={`${s.payments30} cobros`} />
        <Kpi label="Última venta" value={s.lastSale ? s.lastSale.toLocaleDateString("es-HN", { day: "numeric", month: "short" }) : "—"} sub={fmt(s.lastSale)} />
        <Kpi label="Último ingreso al panel" value={s.lastLogin ? s.lastLogin.toLocaleDateString("es-HN", { day: "numeric", month: "short" }) : "—"} sub={`${s.accounts} cuenta${s.accounts === 1 ? "" : "s"} activa${s.accounts === 1 ? "" : "s"}`} />
        <Kpi label="Configuración" value={`${s.products} productos`} sub={`${s.tables} mesas · ${s.waiters} meseros`} />
      </div>

      <RestaurantAdmin
        restaurant={{ id: r.id, name: r.name, slug: r.slug, notes: r.notes, active: r.status === "ACTIVE", isDefault, url }}
        rootDomain={process.env.ROOT_DOMAIN?.trim() || null}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          active: a.active,
          pending: a.mustChangePassword,
          lastLogin: a.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular mt-1 truncate">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
