"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveDiscountSettings } from "@/app/auth-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Reglas de descuentos del restaurante (Ajustes → Negocio). */
export function DiscountSettings({ limit, seniorPercent, managers }: { limit: number; seniorPercent: number; managers: number }) {
  const [form, setForm] = useState({ limit: String(limit), senior: String(seniorPercent) });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await callAction(() => saveDiscountSettings({ limit: Number(form.limit), seniorPercent: Number(form.senior) }));
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Reglas de descuento guardadas");
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5 space-y-4 max-w-3xl mt-5">
      <div>
        <h2 className="font-semibold">Descuentos al cobrar</h2>
        <p className="text-sm text-muted-foreground">
          Quien cobra puede aplicar descuentos hasta el límite. Más que eso, y las cortesías, los autoriza un encargado con su PIN.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Descuento sin autorización (hasta)</span>
          <div className="relative">
            <Input
              inputMode="numeric"
              value={form.limit}
              onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
              className="h-12 rounded-xl pr-8 tabular"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
          <span className="block text-xs text-muted-foreground">0% = todo descuento pide encargado.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium">Tercera edad / discapacidad</span>
          <div className="relative">
            <Input
              inputMode="numeric"
              value={form.senior}
              onChange={(e) => setForm((f) => ({ ...f, senior: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
              className="h-12 rounded-xl pr-8 tabular"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
          <span className="block text-xs text-muted-foreground">El que marca la ley; confírmalo con tu contador.</span>
        </label>
      </div>
      <p className={managers === 0 ? "text-sm text-amber-200" : "text-sm text-muted-foreground"}>
        {managers === 0 ? "Aún no hay encargados: " : `${managers} encargado${managers === 1 ? "" : "s"} pueden autorizar. `}
        márcalos en{" "}
        <Link href="/admin/usuarios" className="text-primary font-medium">
          Personal
        </Link>
        .
      </p>
      <Button type="submit" className="h-11 rounded-xl" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Guardar reglas
      </Button>
    </form>
  );
}
