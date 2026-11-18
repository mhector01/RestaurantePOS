import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { isPlatformHost } from "@/lib/tenant-host";
import { getPlatformSettings } from "@/lib/billing";
import { restaurantUrl } from "@/lib/platform";
import { SignupForm } from "@/components/platform/SignupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crea tu restaurante · Ristemo",
  description: "Punto de venta, cocina, inventario y facturación SAR para tu restaurante. Prueba gratis.",
  robots: { index: true, follow: true },
};

export default async function RegistroPage() {
  if (!isPlatformHost((await headers()).get("host"))) notFound();
  const settings = await getPlatformSettings();
  const example = restaurantUrl("tu-restaurante");
  if (!settings.signupEnabled || !example) notFound();
  // Dominio que se muestra en la vista previa de la dirección: "tu-restaurante.<dominio>"
  const domain = example.replace(/^https?:\/\/tu-restaurante\./, "");
  return <SignupForm trialDays={settings.trialDays} domain={domain} />;
}
