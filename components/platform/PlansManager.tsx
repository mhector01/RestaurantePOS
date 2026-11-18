"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { savePlan, setPlanActive, type PlanInput } from "@/app/billing-actions";
import { callAction } from "@/lib/client-action";
import { formatMoney } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Plan {
  id: number;
  name: string;
  price: number;
  description: string;
  maxWaiters: number | null;
  maxAccounts: number | null;
  active: boolean;
  restaurants: number;
}

const limitText = (n: number | null, one: string, many: string) => (n === null ? `${many} sin límite` : `hasta ${n} ${n === 1 ? one : many}`);

export function PlansManager({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  const toggle = async (p: Plan) => {
    setBusy(p.id);
    const res = await callAction(() => setPlanActive(p.id, !p.active));
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success(p.active ? "El plan ya no se ofrece" : "Plan disponible otra vez");
    router.refresh();
  };

  return (
    <section className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Planes</h2>
          <p className="text-sm text-muted-foreground">Precio mensual y límites de cada plan.</p>
        </div>
        <PlanDialog onSaved={() => router.refresh()} />
      </div>
      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4">
          Aún no hay planes. Crea al menos uno (por ejemplo, Básico y Profesional) para asignarlo a los restaurantes.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {plans.map((p) => (
            <li key={p.id} className={cn("flex items-start gap-3 px-4 py-3", !p.active && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {p.name} <span className="text-primary tabular">{formatMoney(p.price)}</span>
                  <span className="text-xs text-muted-foreground font-normal">/mes</span>
                  {!p.active && <span className="ml-2 text-xs text-muted-foreground font-normal">(ya no se ofrece)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {limitText(p.maxWaiters, "mesero", "meseros")} · {limitText(p.maxAccounts, "cuenta del panel", "cuentas del panel")} · {p.restaurants} restaurante
                  {p.restaurants === 1 ? "" : "s"}
                </p>
                {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
              </div>
              <PlanDialog plan={p} onSaved={() => router.refresh()} />
              <Button variant="ghost" className="h-9 rounded-xl text-xs" disabled={busy === p.id} onClick={() => toggle(p)}>
                {busy === p.id && <Loader2 className="animate-spin" />}
                {p.active ? "Retirar" : "Ofrecer"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanDialog({ plan, onSaved }: { plan?: Plan; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const empty = { name: "", price: "", description: "", maxWaiters: "", maxAccounts: "" };
  const [form, setForm] = useState(empty);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const input: PlanInput = {
      name: form.name,
      price: Number(form.price),
      description: form.description,
      maxWaiters: form.maxWaiters === "" ? null : Number(form.maxWaiters),
      maxAccounts: form.maxAccounts === "" ? null : Number(form.maxAccounts),
    };
    const res = await callAction(() => savePlan(plan?.id ?? null, input));
    setLoading(false);
    if (!res.success) return toast.error(res.error);
    toast.success(plan ? "Plan actualizado" : "Plan creado");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v)
          setForm(
            plan
              ? {
                  name: plan.name,
                  price: String(plan.price),
                  description: plan.description,
                  maxWaiters: plan.maxWaiters === null ? "" : String(plan.maxWaiters),
                  maxAccounts: plan.maxAccounts === null ? "" : String(plan.maxAccounts),
                }
              : empty
          );
        setOpen(v);
      }}
    >
      <DialogTrigger asChild>
        {plan ? (
          <Button variant="ghost" size="icon" className="size-9 rounded-xl" aria-label={`Editar ${plan.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="outline" className="h-10 rounded-xl">
            <Plus /> Nuevo plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>Cambiar el precio no modifica pagos ya registrados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Básico" className="h-11 rounded-xl" />
            </Field>
            <Field label="Precio mensual">
              <Input required type="number" min={0} step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="h-11 rounded-xl tabular" />
            </Field>
            <Field label="Máx. meseros" hint="Vacío = sin límite">
              <Input type="number" min={0} value={form.maxWaiters} onChange={(e) => setForm((f) => ({ ...f, maxWaiters: e.target.value }))} className="h-11 rounded-xl" />
            </Field>
            <Field label="Máx. cuentas del panel" hint="Vacío = sin límite">
              <Input type="number" min={0} value={form.maxAccounts} onChange={(e) => setForm((f) => ({ ...f, maxAccounts: e.target.value }))} className="h-11 rounded-xl" />
            </Field>
          </div>
          <Field label="Descripción">
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Opcional" className="h-11 rounded-xl" />
          </Field>
          <Button type="submit" className="w-full h-12 rounded-xl text-base" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Guardar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
