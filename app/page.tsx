import Link from "next/link";
import { cookies } from "next/headers";
import { ChefHat, Settings } from "lucide-react";
import { BrandHeader } from "@/components/Brand";
import prisma from "@/lib/prisma";
import { normalizeShape } from "@/lib/floor";
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

  const readyRows = await prisma.kitchenItem.findMany({
    where: { status: "READY" },
    select: { quantity: true, order: { select: { tableId: true } } },
  });
  const readyByTable = new Map<number, number>();
  for (const r of readyRows) readyByTable.set(r.order.tableId, (readyByTable.get(r.order.tableId) ?? 0) + r.quantity);

  const areas = await prisma.area.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });

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
      ready: readyByTable.get(t.id) ?? 0,
      shape: normalizeShape(t.shape),
      seats: t.seats,
      x: t.x,
      y: t.y,
      areaId: t.areaId,
    };
  });

  const counter = mapped.find((t) => t.number === 0) ?? null;
  const dining = mapped.filter((t) => t.number > 0);

  return (
    <div className="min-h-dvh flex flex-col">
      <AutoRefresh seconds={15} />
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <BrandHeader business={BUSINESS.name} subtitle="Punto de venta" />
          </div>
          <WaiterChip name={waiter?.name ?? null} dark />
          <Link
            href="/cocina"
            aria-label="Pantalla de cocina"
            title="Pantalla de cocina"
            className="size-11 rounded-full border border-white/10 bg-white/5 grid place-items-center text-ink-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChefHat className="size-5" />
          </Link>
          <Link
            href="/admin"
            aria-label="Panel de administración"
            title="Panel de administración"
            className="size-11 rounded-full border border-white/10 bg-white/5 grid place-items-center text-ink-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <FloorPlan tables={dining} counter={counter} areas={areas.map((a) => ({ id: a.id, name: a.name }))} />
      </main>
    </div>
  );
}
