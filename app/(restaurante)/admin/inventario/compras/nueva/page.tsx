import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { stockLevel, suggestedOrder } from "@/lib/inventory";
import { SectionBar } from "@/components/inventory/InventoryTabs";
import { PurchaseForm } from "@/components/inventory/PurchaseForm";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function todayISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string; sugerido?: string }>;
}) {
  const sp = await searchParams;
  const [ingredients, suppliers] = await Promise.all([
    prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const supplierParam = sp.proveedor !== undefined ? parseInt(sp.proveedor) : NaN;
  const supplierId = suppliers.some((s) => s.id === supplierParam) ? supplierParam : null;

  // Desde la lista de compras sugerida: lo que hay que reponer de ese proveedor
  const initialLines =
    sp.sugerido === "1"
      ? ingredients
          .filter((i) => (supplierId ? i.supplierId === supplierId : i.supplierId === null))
          .filter((i) => stockLevel(i.stock, i.minStock) !== "ok")
          .map((i) => ({ ingredientId: i.id, quantity: suggestedOrder(i.stock, i.minStock, i.maxStock), out: i.stock <= 0 }))
          .filter((l) => l.quantity > 0 || l.out)
          .map(({ ingredientId, quantity }) => ({ ingredientId, quantity }))
      : [];

  return (
    <>
      <SectionBar title="Registrar compra" description="Copia la factura del proveedor tal como llegó.">
        <Button asChild variant="ghost" className="h-11 rounded-xl">
          <Link href="/admin/inventario/compras">
            <ArrowLeft /> Volver a compras
          </Link>
        </Button>
      </SectionBar>
      <PurchaseForm
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          stock: i.stock,
          cost: i.cost,
          supplierId: i.supplierId,
        }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        today={todayISO()}
        initialSupplierId={supplierId}
        initialLines={initialLines}
      />
    </>
  );
}
