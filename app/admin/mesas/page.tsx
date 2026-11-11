import prisma from "@/lib/prisma";
import { PageHeader } from "@/components/admin/AdminNav";
import { FloorEditor } from "@/components/floor/FloorEditor";
import { normalizeShape } from "@/lib/floor";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  let areas = await prisma.area.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  if (areas.length === 0) {
    await prisma.area.create({ data: { name: "Salón principal" } });
    areas = await prisma.area.findMany({ orderBy: [{ position: "asc" }, { id: "asc" }] });
  }
  const tables = await prisma.table.findMany({ orderBy: { number: "asc" } });
  const dining = tables.filter((t) => t.number > 0);

  return (
    <>
      <PageHeader
        title="Plano del local"
        description={`${dining.length} mesas · ${dining.reduce((s, t) => s + t.seats, 0)} puestos en ${areas.length} sala${areas.length === 1 ? "" : "s"}.`}
      />
      <FloorEditor
        areas={areas.map((a) => ({ id: a.id, name: a.name }))}
        tables={dining.map((t) => ({
          id: t.id,
          number: t.number,
          shape: normalizeShape(t.shape),
          seats: t.seats,
          x: t.x,
          y: t.y,
          areaId: t.areaId,
          busy: t.status !== "FREE",
        }))}
        hasCounter={tables.some((t) => t.number === 0)}
      />
    </>
  );
}
