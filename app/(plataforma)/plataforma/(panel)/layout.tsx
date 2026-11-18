import { redirect } from "next/navigation";
import { getPlatformUser } from "@/lib/platform-session";
import { PlatformNav } from "@/components/platform/PlatformNav";

export const dynamic = "force-dynamic";

export default async function PlatformPanelLayout({ children }: { children: React.ReactNode }) {
  const me = await getPlatformUser();
  if (!me) redirect("/plataforma/login");
  return (
    <div className="min-h-dvh flex flex-col">
      <PlatformNav name={me.name} locked={me.mustChangePassword} />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</main>
    </div>
  );
}
