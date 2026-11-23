import prisma from "@/lib/prisma";
import { resolvePeriod } from "@/lib/period";
import { ReportHeader } from "@/components/reports/Blocks";
import { PaymentsList, type PaymentRow } from "@/components/reports/PaymentsList";

export const dynamic = "force-dynamic";

const LIMIT = 300;

export default async function CobrosPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  const period = resolvePeriod(await searchParams, "hoy");
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: period.start, lt: period.end } },
    orderBy: { createdAt: "desc" },
    take: LIMIT + 1,
    include: {
      order: { select: { id: true, name: true, table: { select: { number: true } }, user: { select: { name: true } } } },
      invoices: { select: { number: true, status: true, customerName: true }, orderBy: { id: "desc" } },
      discounts: { select: { label: true }, take: 1 },
    },
  });

  const rows: PaymentRow[] = payments.slice(0, LIMIT).map((p) => {
    const invoice = p.invoices.find((i) => i.status === "ISSUED") ?? p.invoices[0] ?? null;
    return {
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      place: p.order.table.number === 0 ? `Para llevar · #${p.order.id}` : `Mesa ${p.order.table.number}`,
      customer: invoice && invoice.customerName !== "Consumidor final" ? invoice.customerName : p.order.name,
      waiter: p.order.user?.name ?? null,
      amount: p.amount,
      tip: p.tip,
      discount: p.discount,
      discountLabel: p.discounts[0]?.label ?? null,
      method: p.method,
      invoiceNumber: invoice?.number ?? null,
      invoiceVoid: invoice?.status === "VOID",
    };
  });

  return (
    <>
      <ReportHeader title="Cobros" period={period} />
      <PaymentsList rows={rows} truncated={payments.length > LIMIT} />
    </>
  );
}
