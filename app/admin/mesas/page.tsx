import prisma from "@/lib/prisma";
import { PageHeader } from "@/components/admin/AdminNav";
import { TablesManager } from "@/components/admin/TablesManager";

export const dynamic = "force-dynamic";

export default async function MesasPage() {
  const tables = await prisma.table.findMany({ orderBy: { number: "asc" } });
  const dining = tables.filter((t) => t.number > 0).map((t) => ({ id: t.id, number: t.number, status: t.status }));

  return (
    <>
      <PageHeader title="Mesas" description={`${dining.length} mesas en el salón.`} />
      <TablesManager tables={dining} hasCounter={tables.some((t) => t.number === 0)} />
    </>
  );
}
