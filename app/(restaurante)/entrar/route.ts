import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { startSession, startSupportSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Entrada directa con un enlace de un solo uso: después del registro público (vence a los 10 minutos)
 * o cuando la plataforma entra como soporte (vence a los 2 minutos). Abre la sesión y lleva al panel.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (token.length < 20) redirect("/login");
  const id = createHash("sha256").update(token).digest("hex");
  // El filtro automático solo encuentra tickets de ESTE restaurante
  const ticket = await prisma.loginTicket.findUnique({ where: { id }, include: { account: true } });
  if (!ticket) redirect("/login");
  await prisma.loginTicket.delete({ where: { id } });
  if (ticket.expiresAt < new Date()) redirect("/login");
  if (ticket.supportName && !ticket.account) {
    await startSupportSession(ticket.supportName);
    redirect("/admin");
  }
  if (!ticket.account?.active) redirect("/login");
  await startSession(ticket.account);
  redirect("/admin?bienvenida=1");
}
