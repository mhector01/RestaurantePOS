"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { savePlatformSettings, type PlatformSettingsInput } from "@/app/billing-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PlatformSettingsForm({
  initial,
  plans,
  signupReady,
}: {
  initial: PlatformSettingsInput;
  plans: { id: number; name: string }[];
  signupReady: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await callAction(() => savePlatformSettings(form));
    setSaving(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Ajustes guardados");
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Cobro</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Días de prueba gratis" hint="Para restaurantes nuevos.">
            <Input type="number" min={0} max={90} value={form.trialDays} onChange={(e) => setForm((f) => ({ ...f, trialDays: Number(e.target.value) }))} className="h-11 rounded-xl" />
          </Field>
          <Field label="Días de gracia" hint="Después de vencer, antes de bloquear.">
            <Input type="number" min={0} max={30} value={form.graceDays} onChange={(e) => setForm((f) => ({ ...f, graceDays: Number(e.target.value) }))} className="h-11 rounded-xl" />
          </Field>
        </div>
        <Field label="Cómo pagar" hint="Lo ven los restaurantes cuando su suscripción está por vencer o vencida.">
          <textarea
            rows={5}
            value={form.paymentInstructions}
            onChange={(e) => setForm((f) => ({ ...f, paymentInstructions: e.target.value }))}
            placeholder={"Transferencia a Banco Atlántida, cuenta 0000-000-000 a nombre de …\nEnvía el comprobante por WhatsApp."}
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="WhatsApp de soporte">
            <Input value={form.supportPhone} onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))} placeholder="+504 9999-9999" className="h-11 rounded-xl" />
          </Field>
          <Field label="Correo de soporte">
            <Input type="email" value={form.supportEmail} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} className="h-11 rounded-xl" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Registro público</h2>
            <p className="text-sm text-muted-foreground">
              Un restaurante nuevo se registra solo en <span className="font-mono">/registro</span> y empieza su prueba gratis.
            </p>
          </div>
          {form.signupEnabled && (
            <a href="/registro" target="_blank" className="text-sm text-primary font-medium inline-flex items-center gap-1 shrink-0">
              Ver <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.signupEnabled}
            onChange={(e) => setForm((f) => ({ ...f, signupEnabled: e.target.checked }))}
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span className="text-sm">
            <span className="block font-medium">Permitir que los restaurantes se registren solos</span>
            <span className="block text-muted-foreground">
              Actívalo cuando tengas el certificado comodín (*.tudominio.com). Sin él, la dirección de cada restaurante nuevo no
              funciona hasta agregarla en Coolify.
            </span>
            {!signupReady && <span className="block text-amber-200 mt-1">Falta configurar ROOT_DOMAIN en el servidor.</span>}
          </span>
        </label>
        <Field label="Plan de los que se registran solos">
          <select
            value={form.signupPlanId ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, signupPlanId: e.target.value ? Number(e.target.value) : null }))}
            className="h-11 w-full rounded-xl border bg-transparent px-3 text-sm"
          >
            <option value="">Sin plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <Button type="submit" className="h-11 rounded-xl px-8" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Guardar ajustes
      </Button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
