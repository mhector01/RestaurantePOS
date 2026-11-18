"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, Wallet } from "lucide-react";
import { registerSubscriptionPayment, setPaidUntil, setRestaurantPlan } from "@/app/billing-actions";
import { callAction } from "@/lib/client-action";
import { formatMoney } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const METHODS: Record<string, string> = { TRANSFER: "Transferencia", CASH: "Efectivo", CARD: "Tarjeta", OTHER: "Otro" };

interface Props {
  restaurantId: number;
  planId: number | null;
  plans: { id: number; name: string; price: number; active: boolean }[];
  paidUntil: string | null; // YYYY-MM-DD
  status: { text: string; detail: string; tone: "good" | "warn" | "bad" | "muted" };
  payments: { id: number; amount: number; months: number; method: string; reference: string; note: string; periodFrom: string; periodTo: string; recordedBy: string; createdAt: string }[];
}

const day = (iso: string) => new Date(iso).toLocaleDateString("es-HN", { day: "numeric", month: "short", year: "numeric" });

export function SubscriptionAdmin({ restaurantId, planId, plans, paidUntil, status, payments }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId) ?? null;

  const changePlan = async (value: string) => {
    setBusy(true);
    const res = await callAction(() => setRestaurantPlan(restaurantId, value ? Number(value) : null));
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Plan actualizado");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold">Suscripción</h2>
          <p
            className={
              status.tone === "good"
                ? "text-sm text-emerald-300"
                : status.tone === "warn"
                  ? "text-sm text-amber-200"
                  : status.tone === "bad"
                    ? "text-sm text-red-300"
                    : "text-sm text-muted-foreground"
            }
          >
            {status.text}
          </p>
          {status.detail && <p className="text-xs text-muted-foreground mt-0.5">{status.detail}</p>}
        </div>
        <PaymentDialog restaurantId={restaurantId} price={plan?.price ?? 0} onDone={() => router.refresh()} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Plan</span>
          <select
            value={planId ?? ""}
            disabled={busy}
            onChange={(e) => changePlan(e.target.value)}
            className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm"
          >
            <option value="">Sin plan</option>
            {plans
              .filter((p) => p.active || p.id === planId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatMoney(p.price)}/mes{p.active ? "" : " (ya no se ofrece)"}
                </option>
              ))}
          </select>
        </label>
        <PaidUntilEditor restaurantId={restaurantId} paidUntil={paidUntil} onDone={() => router.refresh()} />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Pagos registrados</p>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4">Aún no hay pagos.</p>
        ) : (
          <ul className="divide-y rounded-xl border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="px-4 py-3 flex items-start gap-3">
                <Wallet className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {formatMoney(p.amount)} · {p.months} mes{p.months === 1 ? "" : "es"} · {METHODS[p.method] ?? p.method}
                    {p.reference && <span className="text-muted-foreground font-normal"> · Ref. {p.reference}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cubre del {day(p.periodFrom)} al {day(p.periodTo)} · registrado por {p.recordedBy} el {day(p.createdAt)}
                  </p>
                  {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PaymentDialog({ restaurantId, price, onDone }: { restaurantId: number; price: number; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ months: "1", amount: "", method: "TRANSFER", reference: "", note: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await callAction(() =>
      registerSubscriptionPayment(restaurantId, {
        amount: Number(form.amount),
        months: Number(form.months),
        method: form.method,
        reference: form.reference,
        note: form.note,
      })
    );
    setLoading(false);
    if (!res.success) return toast.error(res.error);
    const until = "paidUntil" in res && res.paidUntil ? new Date(res.paidUntil).toLocaleDateString("es-HN", { day: "numeric", month: "long", year: "numeric" }) : "";
    toast.success(until ? `Pago registrado. Pagado hasta el ${until}.` : "Pago registrado");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setForm({ months: "1", amount: price ? String(price) : "", method: "TRANSFER", reference: "", note: "" });
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-10 rounded-xl">
          <Wallet /> Registrar pago
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>El vencimiento se alarga por los meses pagados, desde el día siguiente al último pagado (o desde hoy si ya venció).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium">Meses</span>
              <Input
                type="number"
                min={1}
                max={24}
                required
                value={form.months}
                onChange={(e) => {
                  const months = e.target.value;
                  setForm((f) => ({ ...f, months, amount: price && Number(months) > 0 ? String(Math.round(price * Number(months) * 100) / 100) : f.amount }));
                }}
                className="h-11 rounded-xl"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium">Monto</span>
              <Input type="number" min={0} step="0.01" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-11 rounded-xl tabular" />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Forma de pago</span>
            <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm">
              {Object.entries(METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Referencia</span>
            <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Número de transferencia, recibo…" className="h-11 rounded-xl" />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Nota</span>
            <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Opcional" className="h-11 rounded-xl" />
          </label>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Registrar pago
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaidUntilEditor({ restaurantId, paidUntil, onDone }: { restaurantId: number; paidUntil: string | null; onDone: () => void }) {
  const [value, setValue] = useState(paidUntil ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (next: string | null) => {
    setBusy(true);
    const res = await callAction(() => setPaidUntil(restaurantId, next));
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    toast.success(next ? "Vencimiento actualizado" : "Queda sin vencimiento");
    if (!next) setValue("");
    onDone();
  };
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">Pagado hasta (incluido)</span>
      <div className="flex gap-2">
        <Input type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Pagado hasta" className="h-11 rounded-xl" />
        <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={busy || !value || value === paidUntil} onClick={() => save(value)}>
          {busy ? <Loader2 className="animate-spin" /> : <CalendarClock />} Guardar
        </Button>
      </div>
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>Para corregir o regalar días. Lo normal es registrar un pago.</span>
        {paidUntil && (
          <button type="button" className="text-primary font-medium shrink-0" disabled={busy} onClick={() => save(null)}>
            Quitar vencimiento
          </button>
        )}
      </div>
    </div>
  );
}
