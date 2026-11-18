import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { fmtDay, type Billing } from "@/lib/billing";
import { cn } from "@/lib/utils";

/** Aviso en el panel cuando la prueba o el periodo pagado está por terminar o ya terminó (días de gracia). */
export function SubscriptionBanner({ billing, trial }: { billing: Billing; trial: boolean }) {
  if (billing.state !== "DUE_SOON" && billing.state !== "GRACE") return null;
  const grace = billing.state === "GRACE";
  const when = billing.daysLeft === 0 ? "hoy" : `en ${billing.daysLeft} día${billing.daysLeft === 1 ? "" : "s"}`;
  const text = grace
    ? `Tu ${trial ? "prueba gratis" : "suscripción"} venció el ${fmtDay(billing.paidUntil!)}. El sistema se bloqueará después del ${fmtDay(billing.graceUntil!)} si no se registra el pago.`
    : `Tu ${trial ? "prueba gratis termina" : "suscripción vence"} ${when} (${fmtDay(billing.paidUntil!)}).`;
  return (
    <div
      className={cn(
        "mb-5 rounded-2xl border p-4 text-sm flex flex-col sm:flex-row sm:items-center gap-3 print:hidden",
        grace ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-amber-400/40 bg-amber-400/10 text-amber-100"
      )}
    >
      {grace ? <AlertTriangle className="size-5 shrink-0" /> : <CalendarClock className="size-5 shrink-0" />}
      <p className="flex-1">{text}</p>
      <Link href="/admin/ajustes/suscripcion" className="font-semibold underline underline-offset-4 shrink-0">
        Ver cómo pagar
      </Link>
    </div>
  );
}
