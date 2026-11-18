import { PageHeader } from "@/components/admin/AdminNav";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin(undefined, { allowTemporary: true });
  return (
    <>
      <PageHeader title="Ajustes" description="Datos del restaurante y quién puede entrar al panel." />
      <SettingsTabs locked={me.mustChangePassword} />
      {children}
    </>
  );
}
