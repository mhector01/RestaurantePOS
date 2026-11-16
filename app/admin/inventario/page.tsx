import Link from "next/link";
import { PackagePlus, ShoppingCart, Truck } from "lucide-react";
import prisma from "@/lib/prisma";
import { BUSINESS, formatMoney } from "@/lib/config";
import { formatQty, stockLevel, suggestedOrder } from "@/lib/inventory";
import { MiniKpi, SectionBar } from "@/components/inventory/InventoryTabs";
import { IngredientDialog } from "@/components/inventory/IngredientDialog";
import { StockManager, type StockItem } from "@/components/inventory/StockManager";
import { CopyOrderButton } from "@/components/inventory/CopyOrderButton";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function InventarioPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const { filtro } = await searchParams;
  const since = startOfMonth();
  const [ingredients, suppliers, monthPurchases, unpaid, waste] = await Promise.all([
    prisma.ingredient.findMany({
      include: { supplier: true, _count: { select: { recipeItems: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.purchase.aggregate({ where: { status: "RECEIVED", date: { gte: since } }, _sum: { total: true }, _count: true }),
    prisma.purchase.aggregate({ where: { status: "RECEIVED", paid: false }, _sum: { total: true }, _count: true }),
    prisma.stockMovement.findMany({ where: { type: "WASTE", createdAt: { gte: since } }, select: { quantity: true, unitCost: true } }),
  ]);

  const items: StockItem[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
    stock: i.stock,
    minStock: i.minStock,
    maxStock: i.maxStock,
    cost: i.cost,
    supplierId: i.supplierId,
    supplierName: i.supplier?.name ?? null,
    usedIn: i._count.recipeItems,
    active: i.active,
  }));
  const active = items.filter((i) => i.active);
  const value = active.reduce((s, i) => s + Math.max(i.stock, 0) * i.cost, 0);
  const reorder = active.filter((i) => stockLevel(i.stock, i.minStock) !== "ok");
  const outCount = reorder.filter((i) => i.stock <= 0).length;
  const wasteValue = waste.reduce((s, m) => s + Math.abs(m.quantity) * m.unitCost, 0);

  // Lista de compras sugerida, agrupada por proveedor habitual
  // Los agotados sin mínimo definido también salen (con cantidad por definir), para que nunca se escapen
  const toBuy = reorder
    .map((i) => ({ ...i, qty: suggestedOrder(i.stock, i.minStock, i.maxStock) }))
    .filter((i) => i.qty > 0 || i.stock <= 0);
  const groups = new Map<string, { supplierId: number | null; name: string; items: typeof toBuy }>();
  for (const i of toBuy) {
    const key = String(i.supplierId ?? "none");
    const g = groups.get(key) ?? { supplierId: i.supplierId, name: i.supplierName ?? "Sin proveedor asignado", items: [] };
    g.items.push(i);
    groups.set(key, g);
  }
  const shopping = [...groups.values()].sort((a, b) =>
    a.supplierId === null ? 1 : b.supplierId === null ? -1 : a.name.localeCompare(b.name)
  );

  const supplierOptions = suppliers.map((s) => ({ id: s.id, name: s.name }));
  const unpaidTotal = unpaid._sum.total ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniKpi label="Valor del inventario" value={formatMoney(value)} hint={`${active.length} insumos`} />
        <MiniKpi
          label="Por reponer"
          value={String(reorder.length)}
          hint={outCount > 0 ? `${outCount} agotado${outCount === 1 ? "" : "s"}` : "Ninguno agotado"}
          tone={outCount > 0 ? "danger" : reorder.length > 0 ? "warn" : "good"}
        />
        <MiniKpi
          label="Compras del mes"
          value={formatMoney(monthPurchases._sum.total ?? 0)}
          hint={`Mermas del mes: ${formatMoney(wasteValue)}`}
        />
        <MiniKpi
          label="Por pagar a proveedores"
          value={formatMoney(unpaidTotal)}
          hint={unpaid._count > 0 ? `${unpaid._count} factura${unpaid._count === 1 ? "" : "s"} a crédito` : "Todo pagado"}
          tone={unpaidTotal > 0 ? "warn" : undefined}
        />
      </div>

      {shopping.length > 0 && (
        <section className="mb-8">
          <SectionBar
            title="Lista de compras sugerida"
            description="Lo que llegó al mínimo, con la cantidad para volver al stock ideal."
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {shopping.map((g) => {
              const est = g.items.reduce((s, i) => s + i.qty * i.cost, 0);
              const text = [
                `Hola${g.supplierId ? ` ${g.name}` : ""}, de ${BUSINESS.name} queremos hacer el siguiente pedido:`,
                ...g.items.map((i) => (i.qty > 0 ? `• ${formatQty(i.qty, i.unit)} de ${i.name}` : `• ${i.name} (cantidad por confirmar)`)),
                "¡Gracias!",
              ].join("\n");
              return (
                <div key={g.name} className="rounded-2xl border bg-card overflow-hidden">
                  <header className="px-4 py-3 flex items-center gap-3 border-b bg-muted/40">
                    <span className="size-9 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
                      <Truck className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.items.length} insumo{g.items.length === 1 ? "" : "s"}
                        {est > 0 && ` · aprox. ${formatMoney(est)}`}
                      </p>
                    </div>
                  </header>
                  <ul className="divide-y text-sm">
                    {g.items.map((i) => (
                      <li key={i.id} className="px-4 py-2 flex items-center gap-3">
                        <span className={i.stock <= 0 ? "size-2 rounded-full bg-red-500 shrink-0" : "size-2 rounded-full bg-amber-400 shrink-0"} />
                        <span className="flex-1 min-w-0 truncate">{i.name}</span>
                        <span className="text-xs text-muted-foreground tabular">hay {formatQty(i.stock, i.unit)}</span>
                        {i.qty > 0 ? (
                          <span className="font-semibold tabular w-24 text-right">+{formatQty(i.qty, i.unit)}</span>
                        ) : (
                          <span className="text-xs text-amber-300 w-24 text-right" title="Define su stock mínimo para que el sistema calcule cuánto pedir">
                            Sin mínimo
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <footer className="px-4 py-3 flex flex-wrap gap-2 justify-end border-t">
                    <CopyOrderButton text={text} />
                    <Button asChild size="sm" className="h-10 rounded-xl">
                      <Link href={`/admin/inventario/compras/nueva?sugerido=1&proveedor=${g.supplierId ?? 0}`}>
                        <ShoppingCart className="size-4" /> Registrar compra
                      </Link>
                    </Button>
                  </footer>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SectionBar title="Existencias" description="El stock baja solo con cada venta, según la receta de cada plato.">
        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link href="/admin/inventario/compras/nueva">
            <PackagePlus /> Registrar compra
          </Link>
        </Button>
        <IngredientDialog suppliers={supplierOptions} />
      </SectionBar>
      <StockManager items={items} suppliers={supplierOptions} initialFilter={filtro === "reponer" ? "reorder" : "all"} />
    </>
  );
}
