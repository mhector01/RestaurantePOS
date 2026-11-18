import { getBusiness } from "@/lib/tenant";
import { requireAdmin } from "@/lib/session";
import { BusinessForm } from "@/components/settings/BusinessForm";
import { OwnerOnly } from "@/components/settings/OwnerOnly";

export const dynamic = "force-dynamic";

export default async function NegocioPage() {
  const me = await requireAdmin();
  if (me.role !== "OWNER") return <OwnerOnly what="cambiar los datos del negocio" />;
  const business = await getBusiness();
  return <BusinessForm initial={business} />;
}
