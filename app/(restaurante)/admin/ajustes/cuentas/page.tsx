import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AccountsManager } from "@/components/settings/AccountsManager";
import { OwnerOnly } from "@/components/settings/OwnerOnly";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const me = await requireAdmin();
  if (me.role !== "OWNER") return <OwnerOnly what="dar o quitar acceso al panel" />;
  const accounts = await prisma.account.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] });
  return (
    <AccountsManager
      meId={me.id}
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        active: a.active,
        pending: a.mustChangePassword,
        lastLogin: a.lastLoginAt?.toISOString() ?? null,
      }))}
    />
  );
}
