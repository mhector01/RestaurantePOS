import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { MyAccount } from "@/components/settings/MyAccount";

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const me = await requireAdmin(undefined, { allowTemporary: true });
  if (me.support) {
    return (
      <p className="max-w-3xl rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
        Estás en una sesión de soporte: no hay una cuenta propia que configurar aquí. Las cuentas del restaurante se manejan en
        Acceso al panel.
      </p>
    );
  }
  const sessions = await prisma.session.findMany({
    where: { accountId: me.id, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, lastSeenAt: true, createdAt: true },
  });
  return (
    <MyAccount
      me={{ name: me.name, email: me.email, role: me.role, mustChangePassword: me.mustChangePassword }}
      sessions={sessions.map((s) => ({
        current: s.id === me.sessionId,
        device: describeDevice(s.userAgent),
        lastSeen: s.lastSeenAt.toISOString(),
      }))}
    />
  );
}

/** "Chrome en Windows", "Safari en iPhone"… a partir del user-agent. */
function describeDevice(ua: string) {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return os ? `${browser} en ${os}` : browser;
}
