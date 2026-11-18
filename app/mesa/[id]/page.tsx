import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { WAITER_COOKIE, verifiedWaiterId } from "@/lib/waiter-session";
import { PinPad } from "@/components/PinPad";
import { OrderScreen } from "@/components/pos/OrderScreen";

export const dynamic = "force-dynamic";

export default async function MesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mesaId = parseInt(id);
  if (Number.isNaN(mesaId)) notFound();

  // El mesero debe identificarse con su PIN
  const cookieStore = await cookies();
  const waiterId = verifiedWaiterId(cookieStore.get(WAITER_COOKIE)?.value);
  const mesero = waiterId ? await prisma.user.findUnique({ where: { id: parseInt(waiterId) } }) : null;
  if (!mesero) return <PinPad />;

  const mesa = await prisma.table.findUnique({ where: { id: mesaId } });
  if (!mesa) notFound();
  // El mostrador maneja varios pedidos a la vez: se atiende desde /llevar
  if (mesa.number === 0) redirect("/llevar");

  return <OrderScreen tableId={mesa.id} tableNumber={mesa.number} waiter={mesero} />;
}
