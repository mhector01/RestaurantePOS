import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { isPlatformHost } from "@/lib/tenant-host";
import { getPlatformSettings } from "@/lib/billing";
import { restaurantUrl } from "@/lib/platform";
import { rootPrisma } from "@/lib/prisma-base";
import { Landing } from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ristemo · Sistema para restaurantes",
  description:
    "Punto de venta, mesas, pantalla de cocina, inventario con recetas, facturación SAR, gastos y reportes de utilidad. Todo en la nube, desde cualquier celular, tablet o computadora.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Ristemo · Sistema para restaurantes",
    description: "Tu restaurante completo en un solo sistema: mesas, cocina, inventario, facturación SAR y reportes.",
    images: ["/brand/ristemo-logo.png"],
  },
};

// Página pública que vende el sistema. Solo en el dominio principal, nunca en el de un restaurante.
export default async function SistemaPage() {
  if (!isPlatformHost((await headers()).get("host"))) notFound();
  // La página de venta nunca debe caerse: si la base no responde, se muestra sin precios ni registro.
  const [settings, plans] = await Promise.all([
    getPlatformSettings().catch(() => ({ trialDays: 0, signupEnabled: false, supportPhone: "", supportEmail: "" })),
    rootPrisma.plan
      .findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { price: "asc" }] })
      .catch(() => []),
  ]);
  const signupOpen = settings.signupEnabled && !!restaurantUrl("x");
  const phone = settings.supportPhone.replace(/\D/g, "");
  const whatsapp = phone ? `https://wa.me/${phone.length === 8 ? `504${phone}` : phone}` : null;

  return (
    <Landing
      trialDays={settings.trialDays}
      signupHref={signupOpen ? "/registro" : null}
      whatsapp={whatsapp}
      email={settings.supportEmail || null}
      plans={plans.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        description: p.description,
        maxWaiters: p.maxWaiters,
        maxAccounts: p.maxAccounts,
      }))}
    />
  );
}
