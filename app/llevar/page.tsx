import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, BellRing, ChefHat, ChevronRight, Clock, Phone, ShoppingBag } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatElapsed, formatMoney } from "@/lib/config";
import { PinPad } from "@/components/PinPad";
import { WaiterChip } from "@/components/pos/WaiterChip";
import { AutoRefresh } from "@/components/pos/AutoRefresh";
import { NewTakeoutButton } from "@/components/pos/NewTakeoutButton";
import { DeliverButton } from "@/components/pos/DeliverButton";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Takeout {
  id: number;
  name: string;
  phone: string | null;
  open: boolean;
  total: number; // pendiente de cobro si está abierto; cobrado si no
  units: number;
  pendingKitchen: number;
  ready: number;
  createdAt: Date;
  waiter: string | null;
}

export default async function LlevarPage() {
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;
  const waiter = waiterId ? await prisma.user.findUnique({ where: { id: parseInt(waiterId) } }) : null;
  if (!waiter) return <PinPad />;

  const counter = await prisma.table.findFirst({ where: { number: 0 } });
  const orders = counter
    ? await prisma.order.findMany({
        where: {
          tableId: counter.id,
          OR: [{ status: "OPEN" }, { createdAt: { gte: startOfToday() } }],
        },
        include: { items: true, payments: true, kitchenItems: true, user: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const list: Takeout[] = orders.map((o) => {
    const open = o.status === "OPEN";
    return {
      id: o.id,
      name: o.name ?? `Pedido #${o.id}`,
      phone: o.phone,
      open,
      total: open
        ? o.items.reduce((s, i) => s + i.price * i.quantity, 0)
        : o.payments.reduce((s, p) => s + p.amount, 0),
      units: o.items.reduce((s, i) => s + i.quantity, 0) || o.kitchenItems.reduce((s, k) => s + k.quantity, 0),
      pendingKitchen: o.kitchenItems.filter((k) => k.status === "PENDING").reduce((s, k) => s + k.quantity, 0),
      ready: o.kitchenItems.filter((k) => k.status === "READY").reduce((s, k) => s + k.quantity, 0),
      createdAt: o.createdAt,
      waiter: o.user?.name ?? null,
    };
  });

  const readyList = list.filter((t) => t.ready > 0);
  const active = list.filter((t) => t.ready === 0 && (t.open || t.pendingKitchen > 0));
  const delivered = list.filter((t) => !t.open && t.ready === 0 && t.pendingKitchen === 0).reverse();

  return (
    <div className="min-h-dvh flex flex-col">
      <AutoRefresh seconds={10} />
      <header className="sticky top-0 z-20 h-16 bg-background/85 backdrop-blur border-b">
        <div className="h-full max-w-5xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="Volver a mesas"
            className="size-11 rounded-full grid place-items-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-lg leading-tight flex items-center gap-2">
              <ShoppingBag className="size-5 text-primary" /> Para llevar
            </h1>
            <p className="text-xs text-muted-foreground">
              {active.length} en curso · {readyList.length} listo{readyList.length === 1 ? "" : "s"} para entregar
            </p>
          </div>
          <WaiterChip name={waiter.name} />
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-7">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
          <div className="flex-1 min-w-48">
            <p className="font-semibold">¿Un cliente nuevo?</p>
            <p className="text-sm text-muted-foreground">Anota su nombre y toma el pedido. Así cocina y caja saben de quién es.</p>
          </div>
          <NewTakeoutButton />
        </div>

        {readyList.length > 0 && (
          <Section title="Listos para entregar" tone="ready" count={readyList.length}>
            {readyList.map((t) => (
              <TakeoutCard key={t.id} t={t} highlight>
                {t.open && t.total > 0 ? (
                  // No se entrega sin cobrar: primero se pasa por caja
                  <Link
                    href={`/llevar/${t.id}`}
                    className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5 hover:opacity-90"
                  >
                    Cobrar {formatMoney(t.total)}
                  </Link>
                ) : (
                  <DeliverButton orderId={t.id} name={t.name} />
                )}
              </TakeoutCard>
            ))}
          </Section>
        )}

        <Section title="En curso" count={active.length}>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center rounded-2xl border border-dashed">
              No hay pedidos en curso.
            </p>
          ) : (
            active.map((t) => <TakeoutCard key={t.id} t={t} />)
          )}
        </Section>

        {delivered.length > 0 && (
          <Section title="Entregados hoy" tone="muted" count={delivered.length}>
            {delivered.slice(0, 30).map((t) => (
              <TakeoutCard key={t.id} t={t} compact />
            ))}
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "ready" | "muted";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={cn(
          "text-sm font-semibold mb-3 flex items-center gap-2",
          tone === "ready" ? "text-success" : tone === "muted" ? "text-muted-foreground" : ""
        )}
      >
        {tone === "ready" && <BellRing className="size-4 animate-pulse" />}
        {title}
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function TakeoutCard({
  t,
  highlight,
  compact,
  children,
}: {
  t: Takeout;
  highlight?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card flex items-center gap-3 pr-3",
        highlight && "border-success/60 bg-success/10",
        compact && "opacity-70"
      )}
    >
      <Link href={`/llevar/${t.id}`} className="flex-1 min-w-0 flex items-center gap-3 p-3 sm:p-4">
        <span
          className={cn(
            "size-12 rounded-xl grid place-items-center shrink-0 text-sm font-bold tabular",
            highlight ? "bg-success text-white" : t.open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          #{t.id}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-base truncate">{t.name}</p>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            <span className="inline-flex items-center gap-1" suppressHydrationWarning>
              <Clock className="size-3" /> {formatElapsed(t.createdAt)}
            </span>
            {t.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {t.phone}
              </span>
            )}
            <span>
              {t.units} producto{t.units === 1 ? "" : "s"}
            </span>
          </p>
          {!compact && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {t.open ? (
                <Chip className="bg-primary/15 text-primary">
                  {t.total > 0 ? `Por cobrar ${formatMoney(t.total)}` : "Tomando pedido"}
                </Chip>
              ) : (
                <Chip className="bg-success/15 text-success">Pagado {formatMoney(t.total)}</Chip>
              )}
              {t.pendingKitchen > 0 && (
                <Chip className="bg-amber-400/15 text-amber-200">
                  <ChefHat className="size-3" /> {t.pendingKitchen} en cocina
                </Chip>
              )}
              {t.ready > 0 && (
                <Chip className="bg-success/20 text-success">
                  <BellRing className="size-3" /> {t.ready} listo{t.ready === 1 ? "" : "s"}
                </Chip>
              )}
            </div>
          )}
        </div>
        {!children && <ChevronRight className="size-5 text-muted-foreground shrink-0" />}
      </Link>
      {children}
    </div>
  );
}

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}>
      {children}
    </span>
  );
}
