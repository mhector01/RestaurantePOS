import { rootPrisma } from "@/lib/prisma-base";
import { requirePlatform } from "@/lib/platform-session";
import { getPlatformSettings } from "@/lib/billing";
import { PlatformSettingsForm } from "@/components/platform/PlatformSettingsForm";
import { PlansManager } from "@/components/platform/PlansManager";

export const dynamic = "force-dynamic";

export default async function PlataformaAjustesPage() {
  await requirePlatform();
  const [settings, plans, usage] = await Promise.all([
    getPlatformSettings(),
    rootPrisma.plan.findMany({ orderBy: { position: "asc" } }),
    rootPrisma.restaurant.groupBy({ by: ["planId"], _count: true }),
  ]);
  const count = new Map(usage.map((u) => [u.planId, u._count]));
  const signupReady = !!process.env.ROOT_DOMAIN?.trim() || process.env.NODE_ENV !== "production";
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground mt-1">Planes, prueba gratis, cobro y registro de restaurantes nuevos.</p>
      </div>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <PlansManager plans={plans.map((p) => ({ ...p, restaurants: count.get(p.id) ?? 0, createdAt: undefined }))} />
        <PlatformSettingsForm
          signupReady={signupReady}
          plans={plans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))}
          initial={{
            trialDays: settings.trialDays,
            graceDays: settings.graceDays,
            signupEnabled: settings.signupEnabled,
            signupPlanId: settings.signupPlanId,
            paymentInstructions: settings.paymentInstructions,
            supportPhone: settings.supportPhone,
            supportEmail: settings.supportEmail,
          }}
        />
      </div>
    </>
  );
}
