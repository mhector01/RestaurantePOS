import prisma from "@/lib/prisma";
import { getBusiness } from "@/lib/tenant";
import { AutoRefresh } from "@/components/pos/AutoRefresh";
import { KitchenBoard, type KitchenTicket } from "@/components/kitchen/KitchenBoard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: `Cocina · ${(await getBusiness()).name}` };
}

// Los platos listos siguen visibles un rato por si hay que deshacer.
const READY_WINDOW_MIN = 15;

function loadKitchenItems() {
  const since = new Date(Date.now() - READY_WINDOW_MIN * 60_000);
  return prisma.kitchenItem.findMany({
    where: {
      OR: [{ status: "PENDING" }, { status: "READY", readyAt: { gte: since } }],
    },
    include: { product: true, order: { include: { table: true, user: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export default async function CocinaPage() {
  const [items, business] = await Promise.all([loadKitchenItems(), getBusiness()]);

  const byOrder = new Map<number, KitchenTicket>();
  for (const i of items) {
    let t = byOrder.get(i.orderId);
    if (!t) {
      t = {
        orderId: i.orderId,
        table: i.order.table.number,
        name: i.order.name,
        waiter: i.order.user?.name ?? null,
        since: i.createdAt.toISOString(),
        items: [],
      };
      byOrder.set(i.orderId, t);
    }
    t.items.push({
      id: i.id,
      name: i.product.name,
      quantity: i.quantity,
      status: i.status as "PENDING" | "READY",
      createdAt: i.createdAt.toISOString(),
      readyAt: i.readyAt?.toISOString() ?? null,
    });
  }

  return (
    <>
      <AutoRefresh seconds={5} />
      <KitchenBoard business={business.name} tickets={[...byOrder.values()]} />
    </>
  );
}
