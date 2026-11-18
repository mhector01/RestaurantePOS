import type { Billing } from "@/lib/billing";
import { cn } from "@/lib/utils";

const short = (d: Date) => d.toLocaleDateString("es-HN", { day: "numeric", month: "short" });

/** Texto y color del estado de la suscripción (sirve en servidor y cliente). */
export function billingLabel(b: Billing, opts: { trial: boolean; suspended?: boolean }) {
  if (opts.suspended) return { text: "Suspendido", tone: "bad" as const };
  switch (b.state) {
    case "NONE":
      return { text: "Sin vencimiento", tone: "muted" as const };
    case "OK":
      return { text: `${opts.trial ? "Prueba" : "Pagado"} hasta ${short(b.paidUntil!)}`, tone: "good" as const };
    case "DUE_SOON":
      return {
        text: b.daysLeft === 0 ? `${opts.trial ? "Prueba termina" : "Vence"} hoy` : `${opts.trial ? "Prueba termina" : "Vence"} en ${b.daysLeft} día${b.daysLeft === 1 ? "" : "s"}`,
        tone: "warn" as const,
      };
    case "GRACE":
      return { text: `Vencido · gracia hasta el ${short(b.graceUntil!)}`, tone: "warn" as const };
    case "EXPIRED":
      return { text: "Bloqueado por falta de pago", tone: "bad" as const };
  }
}

export function BillingBadge({ billing, trial, suspended, className }: { billing: Billing; trial: boolean; suspended?: boolean; className?: string }) {
  const { text, tone } = billingLabel(billing, { trial, suspended });
  return (
    <span
      className={cn(
        "text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap",
        tone === "good" && "bg-emerald-500/15 text-emerald-300",
        tone === "warn" && "bg-amber-400/15 text-amber-200",
        tone === "bad" && "bg-red-500/15 text-red-300",
        tone === "muted" && "bg-accent text-muted-foreground",
        className
      )}
    >
      {text}
    </span>
  );
}
