import { getBusiness, getRestaurant } from "@/lib/tenant";
import prisma from "@/lib/prisma";
import { DiscountSettings } from "@/components/settings/DiscountSettings";
import { requireAdmin } from "@/lib/session";
import { BusinessForm } from "@/components/settings/BusinessForm";
import { LogoUploader } from "@/components/settings/LogoUploader";
import { OwnerOnly } from "@/components/settings/OwnerOnly";

export const dynamic = "force-dynamic";

export default async function NegocioPage() {
  const me = await requireAdmin();
  if (me.role !== "OWNER") return <OwnerOnly what="cambiar los datos del negocio" />;
  const [{ logo, ...business }, restaurant, managers] = await Promise.all([getBusiness(), getRestaurant(), prisma.user.count({ where: { role: "ADMIN" } })]);
  return (
    <>
      <LogoUploader logo={logo} name={business.name} />
      <BusinessForm initial={business} />
      <DiscountSettings limit={restaurant?.discountLimit ?? 10} seniorPercent={restaurant?.seniorPercent ?? 25} managers={managers} />
    </>
  );
}
