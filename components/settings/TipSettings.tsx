"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveTipSettings } from "@/app/auth-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Propina sugerida (Ajustes → Negocio). */
export function TipSettings({ enabled, percent }: { enabled: boolean; percent: number }) {
  const [form, setForm] = useState({ enabled, percent: String(percent) });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await callAction(() => saveTipSettings({ enabled: form.enabled, percent: Number(form.percent) }));
    setSaving(false);
    if (!res.success) return void toast.error(res.error);
    toast.success("Propina guardada");
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-5 space-y-4 max-w-3xl mt-5">
      <div>
        <h2 className="font-semibold">Propina</h2>
        <p className="text-sm text-muted-foreground">
          Se sugiere en la pre-cuenta y al cobrar se le pregunta al cliente. Por ley es voluntaria: nunca se cobra sola, no lleva ISV y en
          la factura sale aparte, debajo del total.
        </p>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          className="size-5 accent-[var(--primary)]"
        />
        <span className="text-sm font-medium">Sugerir propina en la pre-cuenta y al cobrar</span>
      </label>
      {form.enabled && (
        <label className="block space-y-1.5 max-w-xs">
          <span className="block text-sm font-medium">Propina sugerida</span>
          <div className="relative">
            <Input
              inputMode="numeric"
              value={form.percent}
              onChange={(e) => setForm((f) => ({ ...f, percent: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
              className="h-12 rounded-xl pr-8 tabular"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
          </div>
          <span className="block text-xs text-muted-foreground">Sobre el consumo, ya con descuentos. Lo usual en Honduras es 10%.</span>
        </label>
      )}
      <Button type="submit" className="h-11 rounded-xl" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} Guardar
      </Button>
    </form>
  );
}
