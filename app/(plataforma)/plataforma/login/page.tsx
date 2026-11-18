import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPlatformUser } from "@/lib/platform-session";
import { isPlatformHost } from "@/lib/tenant-host";
import { PlatformLoginForm } from "@/components/platform/PlatformLoginForm";

export const dynamic = "force-dynamic";

export default async function PlatformLoginPage() {
  if (!isPlatformHost((await headers()).get("host"))) notFound();
  if (await getPlatformUser()) redirect("/plataforma");
  return <PlatformLoginForm />;
}
