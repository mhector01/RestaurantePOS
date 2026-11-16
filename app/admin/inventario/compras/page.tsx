import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMoney } from "@/lib/config";
import { formatQty } from "@/lib/inventory";
import { MiniKpi, SectionBar } from "@/components/inventory/InventoryTabs";
import { PurchaseActions } from "@/components/inventory/PurchaseActions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function monthRange(mes?: string) {
  const now = new Date();
  const m = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 1);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return {
    start,
    end,
    label: (() => {
      const t = start.toLocaleDateString("es", { month: "long", year: "numeric" });
      return t.charAt(0).toUpperCase() + t.slice(1);
    })(),
    prev: key(new Date(y, mo - 2, 1)),
    next: key(new Date(y, mo, 1)),
    isCurrent: key(start) === key(now),
  };
}

export default async function ComprasPage({ searchParams }: { searchParams: Promise<{ mes?: string; ver?: string }> }) {
  const sp = await searchParams;
  const onlyUnpaid = sp.ver === "pendientes";
  const range = monthRange(sp.mes);

  const [purchases, unpaid] = await Promise.all([
    prisma.purchase.findMany({
      where: onlyUnpaid ? { paid: false, status: "RECEIVED" } : { date: { gte: range.start, lt: range.end } },
      include: { supplier: true, items: { include: { ingredient: true } } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    }),
    prisma.purchase.aggregate({ where: { paid: false, status: "RECEIVED" }, _sum: { total: true }, _count: true }),
  ]);

  const valid = purchases.filter((p) => p.status === "RECEIVED");
  const monthTotal = valid.reduce((s, p) => s + p.total, 0);
  const bySupplier = new Map<string, number>();
  for (const p of valid) bySupplier.set(p.supplier?.name ?? "Sin proveedor", (bySupplier.get(p.supplier?.name ?? "Sin proveedor") ?? 0) + p.total);
  const top = [...bySupplier].sort((a, b) => b[1] - a[1])[0];

  const qs = (params: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <MiniKpi
          label={onlyUnpaid ? "Facturas pendientes" : `Compras de ${range.label.toLowerCase()}`}
          value={formatMoney(monthTotal)}
          hint={`${valid.length} factura${valid.length === 1 ? "" : "s"}`}
        />
        <MiniKpi
          label="Por pagar a proveedores"
          value={formatMoney(unpaid._sum.total ?? 0)}
          hint={`${unpaid._count} a crédito`}
          tone={(unpaid._sum.total ?? 0) > 0 ? "warn" : "good"}
        />
        {!onlyUnpaid && (
          <MiniKpi label="Proveedor principal del mes" value={top ? top[0] : "—"} hint={top ? formatMoney(top[1]) : undefined} />
        )}
      </div>

      <SectionBar title={onlyUnpaid ? "Facturas por pagar" : "Compras"}>
        <div className="flex rounded-xl border bg-card p-1 h-11">
          <Link
            href="/admin/inventario/compras"
            className={cn("px-3 rounded-lg text-sm font-medium grid place-items-center", !onlyUnpaid ? "bg-muted" : "text-muted-foreground")}
          >
            Por mes
          </Link>
          <Link
            href="/admin/inventario/compras?ver=pendientes"
            className={cn("px-3 rounded-lg text-sm font-medium grid place-items-center", onlyUnpaid ? "bg-muted" : "text-muted-foreground")}
          >
            Por pagar {unpaid._count > 0 && <span className="ml-1 text-amber-300">({unpaid._count})</span>}
          </Link>
        </div>
        <Button asChild className="h-11 rounded-xl">
          <Link href="/admin/inventario/compras/nueva">
            <Plus /> Nueva compra
          </Link>
        </Button>
      </SectionBar>

      {!onlyUnpaid && (
        <div className="flex items-center gap-2 mb-3">
          <Button asChild variant="outline" size="icon" className="size-10 rounded-xl">
            <Link href={`/admin/inventario/compras${qs({ mes: range.prev })}`} aria-label="Mes anterior">
              <ChevronLeft />
            </Link>
          </Button>
          <p className="font-medium min-w-36 text-center">{range.label}</p>
          {!range.isCurrent && (
            <Button asChild variant="outline" size="icon" className="size-10 rounded-xl">
              <Link href={`/admin/inventario/compras${qs({ mes: range.next })}`} aria-label="Mes siguiente">
                <ChevronRight />
              </Link>
            </Button>
          )}
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">{onlyUnpaid ? "No debes nada a tus proveedores 🎉" : "No hay compras registradas este mes"}</p>
          {!onlyUnpaid && (
            <p className="text-sm text-muted-foreground mt-1">
              Registra cada factura al recibir la mercadería: así el stock y el costo de tus platos quedan al día.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {purchases.map((p) => {
            const voided = p.status === "VOID";
            return (
              <li key={p.id} className={cn("rounded-2xl border bg-card", voided && "opacity-60")}>
                <details className="group">
                  <summary className="list-none cursor-pointer p-4 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="size-11 rounded-xl bg-muted grid place-items-center shrink-0 text-center leading-none">
                      <span>
                        <span className="block text-base font-semibold tabular">{p.date.getDate()}</span>
                        <span className="block text-[10px] uppercase text-muted-foreground">
                          {p.date.toLocaleDateString("es", { month: "short" }).replace(".", "")}
                        </span>
                      </span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium truncate", voided && "line-through")}>
                        {p.supplier?.name ?? "Sin proveedor"}
                        <span className="text-muted-foreground font-normal"> · #{p.id}</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {p.invoice && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="size-3" /> Fact. {p.invoice}
                          </span>
                        )}
                        <span>
                          {p.items.length} insumo{p.items.length === 1 ? "" : "s"}
                        </span>
                        {voided ? (
                          <span className="text-red-300">Anulada</span>
                        ) : p.paid ? (
                          <span className="text-success">Pagada</span>
                        ) : (
                          <span className="text-amber-300">A crédito · pendiente</span>
                        )}
                      </p>
                    </div>
                    <span className="font-semibold tabular">{formatMoney(p.total)}</span>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t px-4 py-3">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium py-1">Insumo</th>
                          <th className="text-right font-medium">Cantidad</th>
                          <th className="text-right font-medium hidden sm:table-cell">Costo unit.</th>
                          <th className="text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="tabular">
                        {p.items.map((i) => (
                          <tr key={i.id} className="border-t border-border/50">
                            <td className="py-1.5">{i.ingredient.name}</td>
                            <td className="text-right">{formatQty(i.quantity, i.ingredient.unit)}</td>
                            <td className="text-right hidden sm:table-cell">{formatMoney(i.unitCost)}</td>
                            <td className="text-right">{formatMoney(i.quantity * i.unitCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {p.notes && <p className="text-sm text-muted-foreground mt-2">Nota: {p.notes}</p>}
                    {!voided && (
                      <div className="flex justify-end mt-3">
                        <PurchaseActions id={p.id} paid={p.paid} total={formatMoney(p.total)} />
                      </div>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
