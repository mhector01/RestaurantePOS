"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveFiscalSettings, type FiscalInput } from "@/app/fiscal-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRtn } from "@/lib/fiscal";
import { cn } from "@/lib/utils";

export function FiscalSettingsForm({ initial, hasRange }: { initial: FiscalInput; hasRange: boolean }) {
  const [form, setForm] = useState<FiscalInput>({ ...initial, rtn: initial.rtn ? formatRtn(initial.rtn) : "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FiscalInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveFiscalSettings(form);
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success(form.enabled ? "Datos guardados. Los cobros ya emiten factura con CAI." : "Datos guardados");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold">Obligado tributario</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="f-legal" label="Nombre o razón social *">
            <Input id="f-legal" value={form.legalName} onChange={set("legalName")} placeholder="Ej. Inversiones López S. de R.L." className="h-12 rounded-xl" />
          </Field>
          <Field id="f-trade" label="Nombre comercial">
            <Input id="f-trade" value={form.tradeName} onChange={set("tradeName")} placeholder="Ej. Restaurante El Fogón" className="h-12 rounded-xl" />
          </Field>
          <Field id="f-rtn" label="RTN *">
            <Input
              id="f-rtn"
              inputMode="numeric"
              value={form.rtn}
              onChange={(e) => setForm((f) => ({ ...f, rtn: e.target.value.replace(/[^\d-]/g, "").slice(0, 16) }))}
              placeholder="0801-1990-123456"
              className="h-12 rounded-xl tabular"
            />
          </Field>
          <Field id="f-phone" label="Teléfono">
            <Input id="f-phone" value={form.phone} onChange={set("phone")} placeholder="Ej. 2222-3333" className="h-12 rounded-xl" />
          </Field>
          <Field id="f-address" label="Dirección del establecimiento" className="sm:col-span-2">
            <Input id="f-address" value={form.address} onChange={set("address")} placeholder="Colonia, calle, ciudad" className="h-12 rounded-xl" />
          </Field>
          <Field id="f-email" label="Correo">
            <Input id="f-email" type="email" value={form.email} onChange={set("email")} placeholder="Opcional" className="h-12 rounded-xl" />
          </Field>
          <Field id="f-footer" label="Mensaje al pie">
            <Input id="f-footer" value={form.footer} onChange={set("footer")} placeholder="Ej. ¡Gracias por su visita!" className="h-12 rounded-xl" />
          </Field>
        </div>
      </section>

      <section className={cn("rounded-2xl border p-5", form.enabled ? "border-success/40 bg-success/5" : "bg-card")}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="mt-1 size-5 accent-[var(--primary)]"
          />
          <span>
            <span className="block font-semibold">Emitir factura con CAI en cada cobro</span>
            <span className="block text-sm text-muted-foreground">
              Cada pago toma el siguiente número del rango autorizado y se imprime como factura POS. Los precios del menú
              incluyen el ISV; la factura lo desglosa.
            </span>
            {!hasRange && form.enabled && (
              <span className="block text-sm text-amber-300 mt-1">Aún no hay un rango CAI vigente: regístralo en Rangos CAI.</span>
            )}
          </span>
        </label>
      </section>

      <Button type="submit" className="h-12 rounded-xl px-8 text-base" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Guardar
      </Button>
    </form>
  );
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
