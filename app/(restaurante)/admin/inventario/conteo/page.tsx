import prisma from "@/lib/prisma";
import { SectionBar } from "@/components/inventory/InventoryTabs";
import { CountSheet } from "@/components/inventory/CountSheet";

export const dynamic = "force-dynamic";

export default async function ConteoPage() {
  const ingredients = await prisma.ingredient.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const date = new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <SectionBar
        title="Conteo físico"
        description="Cuenta lo que hay en bodega y cámara (idealmente cada semana). Solo llena lo que contaste; el sistema ajusta las diferencias."
      />
      {ingredients.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">Aún no hay insumos para contar.</p>
      ) : (
        <CountSheet
          date={date}
          items={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: i.stock, cost: i.cost }))}
        />
      )}
    </>
  );
}
