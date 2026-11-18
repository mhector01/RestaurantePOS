"use client";

import { callAction } from "@/lib/client-action";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createRestaurant, type NewRestaurantInput } from "@/app/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HandoffDialog, ownerHandoff, type HandoffData } from "@/components/platform/Handoff";
import { formatMoney } from "@/lib/config";

const EMPTY: NewRestaurantInput = { name: "", slug: "", ownerName: "", ownerEmail: "", notes: "", planId: null, trial: true };

export interface PlanOption {
  id: number;
  name: string;
  price: number;
}

/** Igual que normalizeSlug del servidor, para sugerir el subdominio mientras se escribe el nombre. */
function suggestSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function NewRestaurantDialog({ plans, trialDays }: { plans: PlanOption[]; trialDays: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const set = (k: keyof NewRestaurantInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === "name" && !slugTouched ? { slug: suggestSlug(v) } : {}) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await callAction(() => createRestaurant(form));
    setLoading(false);
    if (!res.success || !res.password || !res.email) return toast.error(res.error ?? "No se pudo crear");
    setOpen(false);
    setCreatedId(res.id ?? null);
    setHandoff(ownerHandoff({ restaurant: form.name.trim(), url: res.url ?? null, email: res.email, password: res.password, isNew: true }));
    setForm(EMPTY);
    setSlugTouched(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="h-11 rounded-xl">
            <Plus /> Nuevo restaurante
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md rounded-3xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo restaurante</DialogTitle>
            <DialogDescription>Se crea vacío, con la cuenta del dueño. El dueño arma su menú, mesas y personal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nombre del restaurante">
              <Input required autoFocus value={form.name} onChange={set("name")} placeholder="Ej. Pupusería La Esquina" className="h-12 rounded-xl" />
            </Field>
            <Field label="Subdominio" hint={form.slug ? `Entrarán por ${form.slug}.tudominio.com` : "Se sugiere a partir del nombre"}>
              <Input
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) }));
                }}
                placeholder="la-esquina"
                className="h-12 rounded-xl font-mono"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre del dueño">
                <Input value={form.ownerName} onChange={set("ownerName")} placeholder="Opcional" className="h-12 rounded-xl" />
              </Field>
              <Field label="Correo del dueño">
                <Input required type="email" value={form.ownerEmail} onChange={set("ownerEmail")} className="h-12 rounded-xl" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Plan">
                <select
                  value={form.planId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value ? Number(e.target.value) : null }))}
                  className="h-12 w-full rounded-xl border bg-transparent px-3 text-sm"
                >
                  <option value="">Sin plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {formatMoney(p.price)}/mes
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer self-end">
                <input
                  type="checkbox"
                  checked={form.trial}
                  onChange={(e) => setForm((f) => ({ ...f, trial: e.target.checked }))}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="text-sm">
                  <span className="block font-medium">Prueba gratis de {trialDays} días</span>
                  <span className="block text-xs text-muted-foreground">Si no, queda sin vencimiento hasta registrar un pago.</span>
                </span>
              </label>
            </div>
            <Field label="Notas internas" hint="Solo las ve la plataforma: teléfono, plan, acuerdos…">
              <textarea
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </Field>
            <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Crear restaurante
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <HandoffDialog
        data={handoff}
        onClose={() => {
          setHandoff(null);
          if (createdId) router.push(`/plataforma/r/${createdId}`);
        }}
      />
    </>
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
