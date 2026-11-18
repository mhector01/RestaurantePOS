import prisma from "@/lib/prisma";
import { SectionBar } from "@/components/inventory/InventoryTabs";
import { NewRangeDialog, RangeActions } from "@/components/fiscal/RangeForm";
import { formatInvoiceNumber } from "@/lib/fiscal";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RangosPage() {
  const ranges = await prisma.invoiceRange.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { invoices: true } } },
  });
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <SectionBar
        title="Rangos CAI"
        description="Cuando un rango se agota o vence, el sistema pasa al siguiente rango activo automáticamente."
      >
        <NewRangeDialog />
      </SectionBar>

      {ranges.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">Aún no hay rangos registrados</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Solicita a la SAR la autorización de impresión (CAI) para tu punto de emisión y registra aquí el rango y la fecha
            límite que te asignaron.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranges.map((r) => {
            const total = r.rangeTo - r.rangeFrom + 1;
            const used = r.nextNumber - r.rangeFrom;
            const left = Math.max(0, r.rangeTo - r.nextNumber + 1);
            const expired = r.deadline < today;
            const exhausted = left === 0;
            const days = Math.floor((r.deadline.getTime() - now.getTime()) / 86_400_000);
            const state = !r.active
              ? { label: "Inactivo", cls: "bg-muted text-muted-foreground" }
              : expired
                ? { label: "Vencido", cls: "bg-red-500/15 text-red-300" }
                : exhausted
                  ? { label: "Agotado", cls: "bg-red-500/15 text-red-300" }
                  : { label: "Vigente", cls: "bg-success/15 text-success" };
            return (
              <div key={r.id} className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">CAI</p>
                    <p className="font-mono text-sm break-all">{r.cai}</p>
                  </div>
                  <span className={cn("text-xs font-semibold rounded-full px-2.5 py-1", state.cls)}>{state.label}</span>
                  <RangeActions id={r.id} active={r.active} used={r._count.invoices > 0} />
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Rango autorizado</p>
                    <p className="font-mono text-xs">{formatInvoiceNumber(r.prefix, r.rangeFrom)}</p>
                    <p className="font-mono text-xs">{formatInvoiceNumber(r.prefix, r.rangeTo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Siguiente factura</p>
                    <p className="font-mono text-xs">{exhausted ? "—" : formatInvoiceNumber(r.prefix, r.nextNumber)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha límite de emisión</p>
                    <p className={cn("font-medium", (expired || days <= 30) && r.active && "text-amber-300")}>
                      {r.deadline.toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" })}
                      {!expired && <span className="text-xs text-muted-foreground font-normal"> · {days} días</span>}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", left <= 50 ? "bg-amber-400" : "bg-primary")}
                      style={{ width: `${Math.min(100, (used / total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 tabular">
                    {used} de {total} usadas · quedan {left}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
