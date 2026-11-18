import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AccountsManager } from "@/components/settings/AccountsManager";
import { OwnerOnly } from "@/components/settings/OwnerOnly";
import { SupportLog } from "@/components/settings/SupportLog";

export const dynamic = "force-dynamic";

export default async function CuentasPage() {
  const me = await requireAdmin();
  if (me.role !== "OWNER") return <OwnerOnly what="dar o quitar acceso al panel" />;
  const [accounts, accesses, openSupport] = await Promise.all([
    prisma.account.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }] }),
    prisma.supportAccess.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.session.count({ where: { accountId: null, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <>
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
    <SupportLog
      canClose={!me.support}
      openSessions={openSupport}
      accesses={accesses.map((a) => ({ id: a.id, userName: a.userName, reason: a.reason, createdAt: a.createdAt.toISOString() }))}
    />
    </>
  );
}
