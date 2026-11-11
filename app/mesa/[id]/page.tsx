import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ArrowLeft, Clock } from "lucide-react";
import prisma from "@/lib/prisma";
import { PinPad } from "@/components/PinPad";
import { WaiterChip } from "@/components/pos/WaiterChip";
import { OrderWorkspace } from "@/components/pos/OrderWorkspace";
import { KitchenReadyBanner } from "@/components/pos/KitchenReadyBanner";
import { AutoRefresh } from "@/components/pos/AutoRefresh";
import { formatElapsed } from "@/lib/config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mesaId = parseInt(id);
  if (Number.isNaN(mesaId)) notFound();

  // El mesero debe identificarse con su PIN
  const cookieStore = await cookies();
  const waiterId = cookieStore.get("waiter_id")?.value;
  const mesero = waiterId ? await prisma.user.findUnique({ where: { id: parseInt(waiterId) } }) : null;
  if (!mesero) return <PinPad />;

  const [mesa, productos, categorias, openOrder, cocina] = await Promise.all([
    prisma.table.findUnique({ where: { id: mesaId } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findFirst({
      where: { tableId: mesaId, status: "OPEN" },
      include: { items: { include: { product: true }, orderBy: { id: "asc" } }, payments: true, user: true },
    }),
    prisma.kitchenItem.findMany({
      where: { status: { in: ["PENDING", "READY"] }, order: { tableId: mesaId } },
      include: { product: true },
      orderBy: { readyAt: "asc" },
    }),
  ]);

  if (!mesa) notFound();

  const esMostrador = mesa.number === 0;

  // Estado en cocina de los productos de la cuenta abierta
  const kitchenByProduct: Record<number, { pending: number; ready: number }> = {};
  for (const k of cocina) {
    if (k.orderId !== openOrder?.id) continue;
    const e = (kitchenByProduct[k.productId] ??= { pending: 0, ready: 0 });
    if (k.status === "PENDING") e.pending += k.quantity;
    else e.ready += k.quantity;
  }
  const paid = openOrder?.payments.reduce((s, p) => s + p.amount, 0) ?? 0;
  const hasItems = (openOrder?.items.length ?? 0) > 0;

  return (
    <div className="min-h-dvh flex flex-col">
      <AutoRefresh seconds={15} />
      <header className="sticky top-0 z-20 h-16 bg-background/85 backdrop-blur border-b">
        <div className="h-full px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            aria-label="Volver a mesas"
            className="size-11 rounded-full grid place-items-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-lg leading-tight truncate">
              {esMostrador ? "Para llevar" : `Mesa ${mesa.number}`}
            </h1>
            <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
              <span className={cn("size-2 rounded-full", hasItems ? "bg-primary" : "bg-success")} />
              {hasItems ? "Cuenta abierta" : "Libre"}
              {openOrder && hasItems && (
                <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                  · <Clock className="size-3" /> {formatElapsed(openOrder.createdAt)}
                </span>
              )}
              {openOrder?.user && openOrder.user.id !== mesero.id && (
                <span className="truncate">· Abrió {openOrder.user.name.split(" ")[0]}</span>
              )}
            </p>
          </div>
          <WaiterChip name={mesero.name} />
        </div>
      </header>

      <KitchenReadyBanner
        tableId={mesaId}
        ready={cocina.filter((k) => k.status === "READY").map((k) => ({ name: k.product.name, quantity: k.quantity }))}
        pendingUnits={cocina.filter((k) => k.status === "PENDING").reduce((s, k) => s + k.quantity, 0)}
      />

      <OrderWorkspace
        mesaId={mesaId}
        label={esMostrador ? "Para llevar" : `Mesa ${mesa.number}`}
        kitchen={kitchenByProduct}
        orderId={openOrder?.id ?? null}
        products={productos.map((p) => ({ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId }))}
        categories={categorias.map((c) => ({ id: c.id, name: c.name }))}
        items={(openOrder?.items ?? []).map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.product.name,
          price: i.price,
          quantity: i.quantity,
        }))}
        paid={paid}
      />
    </div>
  );
}
