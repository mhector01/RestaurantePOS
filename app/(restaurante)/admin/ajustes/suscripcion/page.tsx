import { Mail, Phone, Wallet } from "lucide-react";
import prisma from "@/lib/prisma";
import { getSubscription } from "@/lib/subscription";
import { PAYMENT_METHODS, fmtDay } from "@/lib/billing";
import { formatMoney } from "@/lib/config";
import { billingLabel } from "@/components/platform/BillingBadge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const short = (d: Date) => d.toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });

export default async function SuscripcionPage() {
  const [{ plan, billing, trial, settings }, payments, waiters, accounts] = await Promise.all([
    getSubscription(),
    prisma.subscriptionPayment.findMany({ orderBy: { createdAt: "desc" }, take: 24 }),
    prisma.user.count(),
    prisma.account.count({ where: { active: true } }),
  ]);
  const label = billingLabel(billing, { trial });
  const showPay = billing.state !== "NONE" && (settings.paymentInstructions || settings.supportPhone || settings.supportEmail);

  return (
    <div className="max-w-3xl space-y-5">
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="text-xl font-semibold">{plan ? plan.name : "Sin plan asignado"}</p>
            {plan && (
              <p className="text-sm text-muted-foreground">
                {formatMoney(plan.price)} al mes{plan.description ? ` · ${plan.description}` : ""}
              </p>
            )}
          </div>
          <span
            className={cn(
              "text-xs font-semibold rounded-full px-2.5 py-1",
              label.tone === "good" && "bg-emerald-500/15 text-emerald-300",
              label.tone === "warn" && "bg-amber-400/15 text-amber-200",
              label.tone === "bad" && "bg-red-500/15 text-red-300",
              label.tone === "muted" && "bg-accent text-muted-foreground"
            )}
          >
            {label.text}
          </span>
        </div>
        <dl className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">{trial ? "Prueba gratis hasta" : "Pagado hasta"}</dt>
            <dd className="font-medium mt-0.5">{billing.paidUntil ? fmtDay(billing.paidUntil) : "Sin vencimiento"}</dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">Meseros</dt>
            <dd className="font-medium mt-0.5 tabular">
              {waiters}
              {plan?.maxWaiters != null && ` de ${plan.maxWaiters}`}
            </dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">Cuentas del panel</dt>
            <dd className="font-medium mt-0.5 tabular">
              {accounts}
              {plan?.maxAccounts != null && ` de ${plan.maxAccounts}`}
            </dd>
          </div>
        </dl>
        {billing.state === "GRACE" && (
          <p className="mt-4 text-sm text-red-200">
            Venció el {fmtDay(billing.paidUntil!)}. El {fmtDay(billing.graceUntil!)} es el último día antes de que el sistema se bloquee.
          </p>
        )}
      </section>

      {showPay && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Cómo pagar</h2>
          {settings.paymentInstructions && <p className="text-sm text-muted-foreground whitespace-pre-line">{settings.paymentInstructions}</p>}
          <div className="flex flex-wrap gap-4 text-sm">
            {settings.supportPhone && (
              <a href={`https://wa.me/${settings.supportPhone.replace(/\D/g, "")}`} className="inline-flex items-center gap-2 text-primary font-medium">
                <Phone className="size-4" /> {settings.supportPhone}
              </a>
            )}
            {settings.supportEmail && (
              <a href={`mailto:${settings.supportEmail}`} className="inline-flex items-center gap-2 text-primary font-medium">
                <Mail className="size-4" /> {settings.supportEmail}
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Cuando confirmemos tu pago, la fecha de vencimiento se actualiza aquí.</p>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Pagos</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay pagos registrados.</p>
        ) : (
          <ul className="divide-y rounded-xl border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-start gap-3">
                <Wallet className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {formatMoney(p.amount)} · {p.months} mes{p.months === 1 ? "" : "es"} · {PAYMENT_METHODS[p.method] ?? p.method}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Del {short(p.periodFrom)} al {short(p.periodTo)} · registrado el {short(p.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
