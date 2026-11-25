import Link from "next/link";
import { ArrowLeft, Clock, ShoppingBag } from "lucide-react";
import prisma from "@/lib/prisma";
import { imageUrl } from "@/lib/uploads";
import { WaiterChip } from "@/components/pos/WaiterChip";
import { OrderWorkspace } from "@/components/pos/OrderWorkspace";
import { OrderNameEditor } from "@/components/pos/OrderNameEditor";
import { KitchenReadyBanner } from "@/components/pos/KitchenReadyBanner";
import { AutoRefresh } from "@/components/pos/AutoRefresh";
import { formatElapsed } from "@/lib/config";
import { outOfStockProductIds } from "@/lib/stock";
import { partsLabel } from "@/lib/combos";
import { getFiscalSettings } from "@/lib/invoicing";
import { discountRules, tipRules } from "@/lib/discount-server";
import { cn } from "@/lib/utils";

interface Props {
  tableId: number;
  tableNumber: number;
  /** Para llevar: se trabaja sobre un pedido concreto (puede haber varios a la vez). */
  takeoutOrderId?: number;
  waiter: { id: number; name: string };
}

/** Pantalla de pedido: la usan las mesas (/mesa/[id]) y los pedidos para llevar (/llevar/[id]). */
export async function OrderScreen({ tableId, tableNumber, takeoutOrderId, waiter }: Props) {
  const takeout = takeoutOrderId !== undefined;

  const [productos, categorias, order, soldOut, fiscal, rules, tips] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        comboSlots: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          include: { options: { orderBy: [{ position: "asc" }, { id: "asc" }], include: { product: true } } },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.order.findFirst({
      where: takeout ? { id: takeoutOrderId } : { tableId, status: "OPEN" },
      include: {
        items: { include: { product: true, parts: { include: { product: true } } }, orderBy: { id: "asc" } },
        payments: true,
        user: true,
      },
    }),
    outOfStockProductIds(),
    getFiscalSettings(),
    discountRules(),
    tipRules(),
  ]);

  // Mesas: lo de cocina de cualquier cuenta de la mesa (puede haber algo listo de una cuenta ya cobrada).
  // Para llevar: solo lo de este pedido.
  const cocina = await prisma.kitchenItem.findMany({
    where: {
      status: { in: ["PENDING", "READY"] },
      ...(takeout ? { orderId: takeoutOrderId } : { order: { tableId } }),
    },
    include: { product: true },
    orderBy: { readyAt: "asc" },
  });

  const kitchenByProduct: Record<number, { pending: number; ready: number }> = {};
  for (const k of cocina) {
    if (k.orderId !== order?.id) continue;
    const e = (kitchenByProduct[k.productId] ??= { pending: 0, ready: 0 });
    if (k.status === "PENDING") e.pending += k.quantity;
    else e.ready += k.quantity;
  }

  const isOpen = order?.status === "OPEN";
  const paid = isOpen ? order.payments.reduce((s, p) => s + p.amount, 0) : 0;
  const hasItems = (order?.items.length ?? 0) > 0;
  const title = takeout ? `Para llevar #${takeoutOrderId}` : `Mesa ${tableNumber}`;

  return (
    // En tablet / escritorio la pantalla no se desplaza: el menú tiene su propio scroll y la cuenta
    // queda fija a la derecha, siempre con el botón de cobrar a la vista
    <div className="min-h-dvh flex flex-col lg:h-dvh lg:overflow-hidden">
      <AutoRefresh seconds={15} />
      <header className="sticky top-0 z-20 h-16 bg-background/85 backdrop-blur border-b">
        <div className="h-full px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
          <Link
            href={takeout ? "/llevar" : "/"}
            aria-label={takeout ? "Volver a pedidos para llevar" : "Volver a mesas"}
            className="size-11 rounded-full grid place-items-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {takeout && <ShoppingBag className="size-4 text-primary shrink-0" />}
              <h1 className="font-semibold text-lg leading-tight truncate">{title}</h1>
              <OrderNameEditor
                tableId={tableId}
                orderId={takeout ? (order?.id ?? null) : isOpen ? order.id : null}
                name={order?.name ?? null}
                phone={order?.phone ?? null}
                takeout={takeout}
                className="min-w-0"
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2 truncate mt-0.5">
              <span className={cn("size-2 rounded-full", !isOpen ? "bg-success" : hasItems ? "bg-primary" : "bg-ink-500")} />
              {!isOpen ? "Pagado" : hasItems ? "Cuenta abierta" : takeout ? "Sin productos" : "Libre"}
              {order && hasItems && (
                <span className="inline-flex items-center gap-1" suppressHydrationWarning>
                  · <Clock className="size-3" /> {formatElapsed(order.createdAt)}
                </span>
              )}
              {order?.user && order.user.id !== waiter.id && (
                <span className="truncate">· Abrió {order.user.name.split(" ")[0]}</span>
              )}
            </p>
          </div>
          <WaiterChip name={waiter.name} />
        </div>
      </header>

      <KitchenReadyBanner
        tableId={tableId}
        orderId={takeout ? takeoutOrderId : undefined}
        ready={cocina.filter((k) => k.status === "READY").map((k) => ({ name: k.product.name, quantity: k.quantity }))}
        pendingUnits={cocina.filter((k) => k.status === "PENDING").reduce((s, k) => s + k.quantity, 0)}
      />

      <OrderWorkspace
        closed={
          takeout && !isOpen ? (
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-sm text-center">
            <span className="size-16 rounded-full bg-success/15 text-success grid place-items-center mx-auto mb-4">
              <ShoppingBag className="size-8" />
            </span>
            <p className="text-xl font-semibold">Pedido pagado</p>
            <p className="text-muted-foreground mt-1">
              {cocina.some((k) => k.status === "READY")
                ? "Ya está listo: entrégalo al cliente y toca Entregado."
                : cocina.length > 0
                  ? "Se está preparando. Cuando cocina lo marque listo, aparecerá para entregar."
                  : "No tiene nada pendiente en cocina."}
            </p>
            <Link
              href="/llevar"
              className="mt-6 inline-flex h-12 px-5 rounded-xl bg-primary text-primary-foreground font-medium items-center"
            >
              Ver pedidos para llevar
            </Link>
          </div>
        </div>
          ) : undefined
        }
        mesaId={tableId}
        label={takeout ? (order?.name ?? "Para llevar") : `Mesa ${tableNumber}`}
        takeout={takeout}
        kitchen={kitchenByProduct}
        orderId={isOpen ? order.id : null}
        products={productos.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          categoryId: p.categoryId,
          image: imageUrl(p.image),
          combo: p.isCombo
            ? p.comboSlots.map((s) => ({
                id: s.id,
                name: s.name,
                quantity: s.quantity,
                options: s.options.map((o) => ({ id: o.id, productId: o.productId, name: o.product.name, extraPrice: o.extraPrice })),
              }))
            : null,
        }))}
        categories={categorias.map((c) => ({ id: c.id, name: c.name }))}
        items={(isOpen ? order.items : []).map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.product.name,
          price: i.price,
          quantity: i.quantity,
          detail: partsLabel(i.parts) || null,
        }))}
        paid={paid}
        soldOut={soldOut}
        invoicing={fiscal.enabled}
        discountRules={rules}
        tipRules={tips}
        waiterName={order?.user?.name ?? waiter.name}
      />
    </div>
  );
}
