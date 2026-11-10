import Link from "next/link";
import { cookies } from "next/headers";
import { Settings, UtensilsCrossed } from "lucide-react";
import prisma from "@/lib/prisma";
import { BUSINESS } from "@/lib/config";
import { FloorPlan, type FloorTable } from "@/components/pos/FloorPlan";
import { WaiterChip } from "@/components/pos/WaiterChip";
import { AutoRefresh } from "@/components/pos/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;
  const waiter = waiterId
    ? await prisma.user.findUnique({ where: { id: parseInt(waiterId) } })
    : null;

  const tables = await prisma.table.findMany({
    orderBy: { number: "asc" },
    include: {
      orders: {
        where: { status: "OPEN" },
        include: { items: true, user: true },
        take: 1,
      },
    },
  });

  const mapped: FloorTable[] = tables.map((t) => {
    const order = t.orders[0];
    const total = order?.items.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
    const items = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
    return {
      id: t.id,
      number: t.number,
      occupied: items > 0,
      total,
      items,
      openedAt: order ? order.createdAt.toISOString() : null,
      waiter: order?.user?.name ?? null,
    };
  });

  const counter = mapped.find((t) => t.number === 0) ?? null;
  const dining = mapped.filter((t) => t.number > 0);

  return (
    <div className="min-h-dvh flex flex-col">
      <AutoRefresh seconds={15} />
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight truncate">{BUSINESS.name}</p>
            <p className="text-xs text-muted-foreground">Punto de venta</p>
          </div>
          <WaiterChip name={waiter?.name ?? null} />
          <Link
            href="/admin"
            aria-label="Panel de administración"
            title="Panel de administración"
            className="size-11 rounded-full border bg-card grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <FloorPlan tables={dining} counter={counter} />
      </main>
    </div>
  );
}
