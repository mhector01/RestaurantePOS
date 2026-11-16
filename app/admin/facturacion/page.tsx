import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMoney } from "@/lib/config";
import { formatRtn } from "@/lib/fiscal";
import { monthRange } from "@/lib/month";
import { MiniKpi, SectionBar } from "@/components/inventory/InventoryTabs";
import { InvoiceActions } from "@/components/fiscal/InvoiceActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FacturasPage({ searchParams }: { searchParams: Promise<{ mes?: string; q?: string }> }) {
  const sp = await searchParams;
  const range = monthRange(sp.mes);
  const q = sp.q?.trim();

  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: range.start, lt: range.end },
      ...(q
        ? {
            OR: [
              { number: { contains: q } },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerRtn: { contains: q.replace(/\D/g, "") || q } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
  });

  const valid = invoices.filter((i) => i.status === "ISSUED");
  const sum = (k: "total" | "isv15" | "isv18" | "taxable15" | "taxable18" | "exempt") => valid.reduce((s, i) => s + i[k], 0);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label={`Facturado en ${range.label.toLowerCase()}`} value={formatMoney(sum("total"))} hint={`${valid.length} facturas`} />
        <MiniKpi label="ISV 15%" value={formatMoney(sum("isv15"))} hint={`Gravado ${formatMoney(sum("taxable15"))}`} />
        <MiniKpi label="ISV 18%" value={formatMoney(sum("isv18"))} hint={`Gravado ${formatMoney(sum("taxable18"))}`} />
        <MiniKpi
          label="Exento"
          value={formatMoney(sum("exempt"))}
          hint={`${invoices.length - valid.length} anulada${invoices.length - valid.length === 1 ? "" : "s"}`}
        />
      </div>

      <SectionBar title="Facturas emitidas" description="El libro de ventas trae el detalle que pide tu contador para la declaración del ISV.">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <a href={`/admin/facturacion/libro?mes=${range.key}`}>
            <Download /> Libro de ventas (CSV)
          </a>
        </Button>
      </SectionBar>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button asChild variant="outline" size="icon" className="size-10 rounded-xl">
          <Link href={`/admin/facturacion?mes=${range.prev}`} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <p className="font-medium min-w-36 text-center">{range.label}</p>
        {!range.isCurrent && (
          <Button asChild variant="outline" size="icon" className="size-10 rounded-xl">
            <Link href={`/admin/facturacion?mes=${range.next}`} aria-label="Mes siguiente">
              <ChevronRight />
            </Link>
          </Button>
        )}
        <form className="ml-auto flex-1 sm:flex-none" action="/admin/facturacion">
          <input type="hidden" name="mes" value={range.key} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar número, cliente o RTN…"
            className="w-full sm:w-72 h-10 rounded-xl border bg-card px-3 text-sm outline-none focus:border-primary"
          />
        </form>
      </div>

      {invoices.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No hay facturas en este periodo.</p>
      ) : (
        <div className="rounded-2xl border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="text-xs text-muted-foreground bg-muted/40">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Número</th>
                <th className="text-left font-medium px-2">Fecha</th>
                <th className="text-left font-medium px-2">Cliente</th>
                <th className="text-right font-medium px-2">ISV</th>
                <th className="text-right font-medium px-2">Total</th>
                <th className="text-right font-medium px-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((i) => {
                const voided = i.status === "VOID";
                return (
                  <tr key={i.id} className={cn(voided && "opacity-60")}>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">
                      <span className={cn(voided && "line-through")}>{i.number}</span>
                      {voided && (
                        <span className="block font-sans text-[11px] text-red-300" title={i.voidReason ?? ""}>
                          Anulada{i.voidReason ? ` · ${i.voidReason}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-2 whitespace-nowrap text-muted-foreground tabular">
                      {i.createdAt.toLocaleString("es-HN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-2">
                      <p className="truncate max-w-56">{i.customerName}</p>
                      {i.customerRtn && <p className="text-xs text-muted-foreground tabular">{formatRtn(i.customerRtn)}</p>}
                    </td>
                    <td className="px-2 text-right tabular text-muted-foreground">{formatMoney(i.isv15 + i.isv18)}</td>
                    <td className="px-2 text-right tabular font-semibold">{formatMoney(i.total)}</td>
                    <td className="px-4">
                      <InvoiceActions id={i.id} number={i.number} voided={voided} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
