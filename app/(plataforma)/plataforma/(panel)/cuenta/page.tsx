import { requirePlatform } from "@/lib/platform-session";
import { PlatformPasswordForm } from "@/components/platform/PlatformPasswordForm";

export const dynamic = "force-dynamic";

export default async function PlatformCuentaPage() {
  const me = await requirePlatform({ allowTemporary: true });
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-muted-foreground mt-1">
          {me.name} · {me.email}
        </p>
      </div>
      <PlatformPasswordForm temporary={me.mustChangePassword} />
    </>
  );
}
