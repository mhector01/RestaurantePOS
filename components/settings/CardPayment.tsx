"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, CreditCard, Loader2, XCircle } from "lucide-react";
import { cardPaymentStatus, startBlockedCardPayment, startCardPayment } from "@/app/card-payment-actions";
import { callAction } from "@/lib/client-action";
import type { CardQuote, CheckoutResult } from "@/lib/card-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Copias de lib/card-checkout.ts para no traer Prisma al navegador
const fmtMoney = (n: number) => `L ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthsLabel = (m: number) => `${m} mes${m === 1 ? "" : "es"}`;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" });

function MonthsPicker({ quotes, value, onChange }: { quotes: CardQuote[]; value: number; onChange: (m: number) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Meses a pagar">
      {quotes.map((q) => (
        <button
          key={q.months}
          type="button"
          role="radio"
          aria-checked={value === q.months}
          onClick={() => onChange(q.months)}
          className={cn(
            "rounded-xl border p-3 text-left transition-colors",
            value === q.months ? "border-primary bg-primary/10" : "hover:bg-accent"
          )}
        >
          <span className="block text-sm font-medium">{monthsLabel(q.months)}</span>
          <span className="block text-xs text-muted-foreground tabular">{fmtMoney(q.total)}</span>
          {q.discountPercent > 0 && <span className="block text-xs text-emerald-300">−{q.discountPercent}%</span>}
        </button>
      ))}
    </div>
  );
}

function Total({ quote }: { quote: CardQuote }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">Total a pagar · {monthsLabel(quote.months)}</span>
      <span className="text-right">
        {quote.discountPercent > 0 && <span className="block text-xs text-muted-foreground line-through tabular">{fmtMoney(quote.subtotal)}</span>}
        <span className="text-lg font-semibold tabular">{fmtMoney(quote.total)}</span>
      </span>
    </div>
  );
}

/** Ajustes → Suscripción: el dueño elige los meses y va a pagar a Pagadito. */
export function CardPayment({ planName, quotes }: { planName: string; quotes: CardQuote[] }) {
  const [months, setMonths] = useState(quotes[0]?.months ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const quote = quotes.find((q) => q.months === months) ?? quotes[0];

  const pay = async () => {
    setLoading(true);
    setError("");
    // Si todo sale bien la acción redirige a Pagadito; aquí solo llegan los errores
    const res = await callAction(() => startCardPayment(months));
    if (res && !res.success) {
      setError(res.error ?? "No se pudo iniciar el pago");
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <CreditCard className="size-4 text-primary" /> Pagar con tarjeta
        </h2>
        <p className="text-sm text-muted-foreground">
          Plan {planName}. Elige cuántos meses pagar; el vencimiento se alarga solo en cuanto se confirma el pago.
        </p>
      </div>
      <MonthsPicker quotes={quotes} value={months} onChange={setMonths} />
      {quote && <Total quote={quote} />}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button type="button" className="h-11 rounded-xl" onClick={pay} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <CreditCard />} Pagar {quote ? fmtMoney(quote.total) : ""}
      </Button>
      <p className="text-xs text-muted-foreground">Pago único y seguro con Pagadito, que te mostrará el equivalente en dólares. No guardamos los datos de tu tarjeta.</p>
    </section>
  );
}

/** Mensaje al volver de Pagadito. Lo que dice sale de la base de datos, nunca del ?estado= de la dirección. */
export function CardPaymentResult({ result }: { result: CheckoutResult }) {
  const tone =
    result.status === "PAID"
      ? "border-emerald-500/30 bg-emerald-500/10"
      : result.status === "PENDING"
        ? "border-amber-400/30 bg-amber-400/10"
        : "border-red-500/30 bg-red-500/10";
  const Icon = result.status === "PAID" ? CheckCircle2 : result.status === "PENDING" ? Clock : XCircle;
  const what = `${fmtMoney(result.amount)} · ${monthsLabel(result.months)}`;
  return (
    <div className={cn("rounded-2xl border p-4 flex items-start gap-3 text-left", tone)}>
      <Icon className="size-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        {result.status === "PAID" && (
          <>
            <p className="font-medium">¡Pago recibido! Gracias.</p>
            <p className="text-muted-foreground">
              {what}.{result.paidUntil ? ` Tu suscripción quedó pagada hasta el ${fmtDay(result.paidUntil)}.` : ""}
            </p>
          </>
        )}
        {result.status === "PENDING" && (
          <>
            <p className="font-medium">Estamos confirmando tu pago</p>
            <p className="text-muted-foreground">{what}. Esto tarda unos segundos; la página se actualiza sola.</p>
          </>
        )}
        {(result.status === "CANCELED" || result.status === "FAILED") && (
          <>
            <p className="font-medium">El pago no se completó</p>
            <p className="text-muted-foreground">{what}. No se hizo ningún cargo. Puedes intentarlo de nuevo.</p>
          </>
        )}
      </div>
    </div>
  );
}

/** Mientras el pago sigue pendiente, vuelve a pedir la página unas cuantas veces. */
export function RefreshWhilePending({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!pending || tries >= 20) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [pending, tries, router]);
  return null;
}

/** ?pago= / ?cobro= de la dirección, o dentro de ?next= si el panel mandó a /login. */
function returnParams() {
  const url = new URL(window.location.href);
  let p = url.searchParams;
  const next = p.get("next");
  if (!p.get("pago") && !p.get("cobro") && next) p = new URL(next, url.origin).searchParams;
  return { pago: p.get("pago"), cobro: p.get("cobro") };
}

/**
 * Pantalla de "Suscripción vencida": el dueño confirma con su correo y contraseña y paga con tarjeta.
 * Al volver de Pagadito muestra el resultado y, cuando se confirma, recarga (el sistema ya funciona).
 */
export function BlockedCardPayment({ planName, quotes }: { planName: string; quotes: CardQuote[] }) {
  const [months, setMonths] = useState(quotes[0]?.months ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const quote = quotes.find((q) => q.months === months) ?? quotes[0];

  useEffect(() => {
    const { pago, cobro } = returnParams();
    if (!pago && !cobro) return;
    let stop = false;
    let tries = 0;
    const check = async () => {
      const res = await cardPaymentStatus(pago, cobro).catch(() => null);
      if (stop) return;
      setResult(res);
      if (res?.status === "PENDING" && tries++ < 20) setTimeout(check, 3000);
    };
    check();
    return () => {
      stop = true;
    };
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(e.currentTarget);
    data.set("months", String(months));
    const res = await callAction(() => startBlockedCardPayment(data));
    if (res && !res.success) {
      setError(res.error ?? "No se pudo iniciar el pago");
      setLoading(false);
    }
  };

  if (result?.status === "PAID") {
    return (
      <div className="mt-6 space-y-3">
        <CardPaymentResult result={result} />
        <Button type="button" className="h-11 rounded-xl w-full" onClick={() => window.location.assign("/admin/ajustes/suscripcion")}>
          Entrar al sistema
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 text-left rounded-2xl border bg-muted/30 p-4 space-y-3">
      {result && <CardPaymentResult result={result} />}
      <div>
        <p className="font-medium flex items-center gap-2">
          <CreditCard className="size-4 text-primary" /> Pagar con tarjeta
        </p>
        <p className="text-sm text-muted-foreground">Plan {planName}. Al confirmarse el pago, el sistema vuelve a funcionar.</p>
      </div>
      <MonthsPicker quotes={quotes} value={months} onChange={setMonths} />
      {quote && <Total quote={quote} />}
      <p className="text-xs text-muted-foreground">Confirma que eres el dueño con tu correo y contraseña del panel.</p>
      <Input name="email" type="email" autoComplete="email" placeholder="Correo" required className="h-11 rounded-xl" />
      <Input name="password" type="password" autoComplete="current-password" placeholder="Contraseña" required className="h-11 rounded-xl" />
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button type="submit" className="h-11 rounded-xl w-full" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <CreditCard />} Pagar {quote ? fmtMoney(quote.total) : ""}
      </Button>
    </form>
  );
}
