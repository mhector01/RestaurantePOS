import { Download } from "lucide-react";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/config";
import { isoDay, resolvePeriod } from "@/lib/period";
import { EXPENSE_CATEGORY_LABEL, expenseCost } from "@/lib/expenses";
import { imageUrl } from "@/lib/uploads";
import { PageHeader } from "@/components/admin/AdminNav";
import { PeriodFilter } from "@/components/reports/ReportControls";
import { StatTile } from "@/components/reports/Blocks";
import { ExpenseDialog } from "@/components/expenses/ExpenseDialog";
import { ExpensesList, type ExpenseRow } from "@/components/expenses/ExpensesList";

export const dynamic = "force-dynamic";

export default async function GastosPage({ searchParams }: { searchParams: Promise<{ p?: string; desde?: string; hasta?: string }> }) {
  const period = resolvePeriod(await searchParams, "mes");
  const [expenses, unpaid, suppliers] = await Promise.all([
    prisma.expense.findMany({
      where: { date: { gte: period.start, lt: period.end } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
    }),
    prisma.expense.aggregate({ where: { status: "ACTIVE", paid: false }, _sum: { total: true }, _count: true }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, taxId: true } }),
  ]);

  const active = expenses.filter((e) => e.status === "ACTIVE");
  const total = active.reduce((s, e) => s + e.total, 0);
  const credit = active.filter((e) => e.hasInvoice).reduce((s, e) => s + e.isv15 + e.isv18, 0);
  const cost = active.reduce((s, e) => s + expenseCost(e), 0);
  const noInvoice = active.filter((e) => !e.hasInvoice);

  const byCategory = new Map<string, number>();
  for (const e of active) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + expenseCost(e));
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    date: isoDay(e.date),
    category: e.category,
    description: e.description,
    supplierId: e.supplierId,
    supplierName: e.supplierName,
    supplierRtn: e.supplierRtn,
    hasInvoice: e.hasInvoice,
    invoiceNumber: e.invoiceNumber,
    cai: e.cai,
    exempt: e.exempt,
    taxable15: e.taxable15,
    taxable18: e.taxable18,
    isv15: e.isv15,
    isv18: e.isv18,
    total: e.total,
    method: e.method,
    paid: e.paid,
    registerClosed: e.registerClosed,
    attachmentUrl: imageUrl(e.attachment),
    notes: e.notes,
    status: e.status,
    voidReason: e.voidReason,
    createdBy: e.createdBy,
  }));
  const last = new Date(period.end.getTime() - 86_400_000);

  return (
    <>
      <div className="mb-6 space-y-4">
        <PageHeader title="Gastos" description={`Alquiler, servicios, sueldos, mantenimiento… · ${period.label}`}>
          <Button asChild variant="outline" className="h-11 rounded-xl">
            <a href={`/admin/reportes/csv?tipo=gastos&${period.query}`}>
              <Download /> Descargar
            </a>
          </Button>
          <ExpenseDialog suppliers={suppliers} today={isoDay(new Date())} />
        </PageHeader>
        <PeriodFilter current={period.key} desde={isoDay(period.start)} hasta={isoDay(last)} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile hero label="Gastos del periodo" value={formatMoney(total)} hint={`${active.length} registro${active.length === 1 ? "" : "s"}`} />
        <StatTile label="ISV a favor (crédito fiscal)" value={formatMoney(credit)} hint="De los gastos con factura" />
        <StatTile label="Costo real (sin ISV a favor)" value={formatMoney(cost)} hint="Lo que resta a la utilidad" />
        <StatTile
          label="Por pagar"
          value={formatMoney(unpaid._sum.total ?? 0)}
          hint={unpaid._count ? `${unpaid._count} gasto${unpaid._count === 1 ? "" : "s"} a crédito` : "Todo pagado"}
        />
      </div>

      {noInvoice.length > 0 && (
        <p className="mb-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm">
          {noInvoice.length} gasto{noInvoice.length === 1 ? "" : "s"} sin factura por {formatMoney(noInvoice.reduce((s, e) => s + e.total, 0))}: no
          dan crédito fiscal. Pide factura con CAI y RTN del restaurante cuando se pueda.
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
        <ExpensesList rows={rows} suppliers={suppliers} today={isoDay(new Date())} truncated={expenses.length >= 500} />
        {categories.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 className="font-semibold">Por categoría</h2>
            <p className="text-sm text-muted-foreground mb-4">Costo sin el ISV a favor</p>
            <ul className="space-y-3">
              {categories.map(([cat, amount]) => (
                <li key={cat}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{EXPENSE_CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className="tabular font-medium">{formatMoney(amount)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${cost > 0 ? Math.max(2, (amount / cost) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
