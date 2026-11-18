"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveBusiness, type BusinessInput } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRtn } from "@/lib/fiscal";
import { cn } from "@/lib/utils";

export function BusinessForm({ initial }: { initial: BusinessInput }) {
  const [form, setForm] = useState<BusinessInput>({
    ...initial,
    taxId: /^\d{14}$/.test(initial.taxId) ? formatRtn(initial.taxId) : initial.taxId,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof BusinessInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await saveBusiness(form);
      if (!res.success) return toast.error(res.error ?? "No se pudo guardar");
      toast.success("Datos del negocio guardados");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl">
      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Datos del restaurante</h2>
          <p className="text-sm text-muted-foreground">
            Se muestran en el punto de venta, el panel, la cocina y el comprobante de cada cobro.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="b-name" label="Nombre del restaurante *">
            <Input id="b-name" value={form.name} onChange={set("name")} required className="h-12 rounded-xl" />
          </Field>
          <Field id="b-phone" label="Teléfono">
            <Input id="b-phone" value={form.phone} onChange={set("phone")} placeholder="Ej. 2222-3333" className="h-12 rounded-xl" />
          </Field>
          <Field id="b-address" label="Dirección" className="sm:col-span-2">
            <Input id="b-address" value={form.address} onChange={set("address")} placeholder="Colonia, calle, ciudad" className="h-12 rounded-xl" />
          </Field>
          <Field id="b-rtn" label="RTN">
            <Input
              id="b-rtn"
              inputMode="numeric"
              value={form.taxId}
              onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value.replace(/[^\d-]/g, "").slice(0, 16) }))}
              placeholder="0801-1990-123456"
              className="h-12 rounded-xl tabular"
            />
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">
          Los datos de la factura con CAI (razón social, RTN del obligado, mensaje al pie) se editan en{" "}
          <Link href="/admin/facturacion/datos" className="text-primary font-medium">
            Facturas → Datos fiscales
          </Link>
          .
        </p>
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
