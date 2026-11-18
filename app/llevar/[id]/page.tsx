import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { WAITER_COOKIE, verifiedWaiterId } from "@/lib/waiter-session";
import { PinPad } from "@/components/PinPad";
import { OrderScreen } from "@/components/pos/OrderScreen";

export const dynamic = "force-dynamic";

export default async function LlevarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = parseInt(id);
  if (Number.isNaN(orderId)) notFound();

  const cookieStore = await cookies();
  const waiterId = verifiedWaiterId(cookieStore.get(WAITER_COOKIE)?.value);
  const mesero = waiterId ? await prisma.user.findUnique({ where: { id: parseInt(waiterId) } }) : null;
  if (!mesero) return <PinPad />;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { table: true } });
  if (!order || order.table.number !== 0) notFound();

  return <OrderScreen tableId={order.tableId} tableNumber={0} takeoutOrderId={order.id} waiter={mesero} />;
}
