import { rootPrisma } from "@/lib/prisma-base";
import { requirePlatform } from "@/lib/platform-session";
import { TeamManager } from "@/components/platform/TeamManager";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  const me = await requirePlatform();
  const users = await rootPrisma.platformUser.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Equipo</h1>
        <p className="text-muted-foreground mt-1">Quién puede entrar a la plataforma: crear, suspender y dar acceso a restaurantes.</p>
      </div>
      <TeamManager
        meId={me.id}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          active: u.active,
          pending: u.mustChangePassword,
          lastLogin: u.lastLoginAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
