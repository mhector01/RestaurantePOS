// Suscripción del restaurante actual (para su panel): plan, vencimiento y límites.
import { cache } from "react";
import prisma from "@/lib/prisma";
import { rootPrisma } from "@/lib/prisma-base";
import { currentRestaurantId } from "@/lib/tenant";
import { billingOf, getPlatformSettings } from "@/lib/billing";

export const getSubscription = cache(async () => {
  const id = await currentRestaurantId();
  const [r, settings, paymentsCount] = await Promise.all([
    rootPrisma.restaurant.findUniqueOrThrow({ where: { id }, include: { plan: true } }),
    getPlatformSettings(),
    prisma.subscriptionPayment.count(),
  ]);
  return {
    plan: r.plan,
    billing: billingOf(r.paidUntil, settings.graceDays),
    trial: !!r.paidUntil && paymentsCount === 0,
    settings,
  };
});

/** Mensaje de error si el plan no permite agregar otro mesero / otra cuenta; null si se puede. */
export async function planLimitProblem(kind: "waiters" | "accounts") {
  const { plan } = await getSubscription();
  if (!plan) return null;
  const max = kind === "waiters" ? plan.maxWaiters : plan.maxAccounts;
  if (max === null) return null;
  const used = kind === "waiters" ? await prisma.user.count() : await prisma.account.count({ where: { active: true } });
  if (used < max) return null;
  const what = kind === "waiters" ? `meser${max === 1 ? "o" : "os"}` : `cuenta${max === 1 ? "" : "s"} del panel`;
  return `Tu plan ${plan.name} permite hasta ${max} ${what}. Para agregar más, pide un cambio de plan.`;
}
