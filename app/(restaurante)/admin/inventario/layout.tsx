import { PageHeader } from "@/components/admin/AdminNav";
import { InventoryTabs } from "@/components/inventory/InventoryTabs";

export default function InventarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Inventario" description="Insumos, compras, proveedores y costo de cada plato." />
      </div>
      <InventoryTabs />
      {children}
    </>
  );
}
