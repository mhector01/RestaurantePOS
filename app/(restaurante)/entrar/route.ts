import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { startSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Entrada directa después del registro público: el enlace trae un token de un solo uso
 * (vence a los 10 minutos). Si sirve, abre la sesión en este restaurante y lleva al panel.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (token.length < 20) redirect("/login");
  const id = createHash("sha256").update(token).digest("hex");
  // El filtro automático solo encuentra tickets de ESTE restaurante
  const ticket = await prisma.loginTicket.findUnique({ where: { id }, include: { account: true } });
  if (!ticket) redirect("/login");
  await prisma.loginTicket.delete({ where: { id } });
  if (ticket.expiresAt < new Date() || !ticket.account.active) redirect("/login");
  await startSession(ticket.account);
  redirect("/admin?bienvenida=1");
}
