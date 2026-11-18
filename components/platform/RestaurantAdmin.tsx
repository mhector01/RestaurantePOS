"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Pause, Play } from "lucide-react";
import { grantOwnerAccess, setRestaurantActive, updateRestaurant } from "@/app/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/pos/ConfirmAction";
import { HandoffDialog, ownerHandoff, type HandoffData } from "@/components/platform/Handoff";
import { ROLE_LABEL } from "@/components/settings/roles";
import { cn } from "@/lib/utils";

interface Props {
  restaurant: { id: number; name: string; slug: string; notes: string; active: boolean; isDefault: boolean; url: string | null };
  rootDomain: string | null;
  accounts: { id: number; name: string; email: string; role: string; active: boolean; pending: boolean; lastLogin: string | null }[];
}

export function RestaurantAdmin({ restaurant: r, rootDomain, accounts }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({ name: r.name, slug: r.slug, notes: r.notes });
  const [saving, setSaving] = useState(false);
  const [owner, setOwner] = useState({ email: "", name: "" });
  const [granting, setGranting] = useState(false);
  const [handoff, setHandoff] = useState<HandoffData | null>(null);
  const slugChanged = form.slug !== r.slug;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await updateRestaurant(r.id, form);
    setSaving(false);
    if (!res.success) return toast.error(res.error);
    toast.success("Datos guardados");
    router.refresh();
  };

  const grant = async (email: string, name: string) => {
    setGranting(true);
    const res = await grantOwnerAccess(r.id, { email, name });
    setGranting(false);
    if (!res.success || !res.password || !res.email) return toast.error(res.error ?? "No se pudo");
    setOwner({ email: "", name: "" });
    setHandoff(ownerHandoff({ restaurant: r.name || r.slug, url: r.isDefault ? null : r.url, email: res.email, password: res.password, isNew: false }));
    router.refresh();
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="space-y-5">
        <form onSubmit={save} className="rounded-2xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Datos</h2>
          <Field label="Nombre">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-11 rounded-xl" />
          </Field>
          <Field
            label="Subdominio"
            hint={
              slugChanged
                ? "Al cambiarlo, la dirección anterior deja de funcionar: avísale al restaurante y actualiza el dominio en Coolify."
                : r.isDefault
                  ? "Este restaurante también abre en el dominio principal."
                  : undefined
            }
          >
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) }))}
              className={cn("h-11 rounded-xl font-mono", slugChanged && "border-amber-400/60")}
            />
          </Field>
          <Field label="Notas internas" hint="El restaurante no las ve.">
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4}
              className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </Field>
          <Button type="submit" className="h-11 rounded-xl" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Guardar
          </Button>
        </form>

        {rootDomain && !r.isDefault && (
          <section className="rounded-2xl border border-dashed p-5 text-sm space-y-1">
            <h2 className="font-semibold">Dominio en Coolify</h2>
            <p className="text-muted-foreground">
              Si no usas certificado comodín, agrega esta dirección en <b>Domains</b> de la aplicación y vuelve a desplegar:
            </p>
            <p className="font-mono text-foreground break-all">https://{r.slug}.{rootDomain}</p>
          </section>
        )}

        <section className={cn("rounded-2xl border p-5 space-y-3", r.active ? "bg-card" : "border-red-500/40 bg-red-500/5")}>
          <h2 className="font-semibold">{r.active ? "Suspender" : "Restaurante suspendido"}</h2>
          <p className="text-sm text-muted-foreground">
            {r.active
              ? "Bloquea el punto de venta, la cocina y el panel (por ejemplo, por falta de pago). No se borra nada y se puede reactivar cuando quieras."
              : "Nadie del restaurante puede usar el sistema. Sus datos siguen guardados."}
          </p>
          <ConfirmAction
            title={r.active ? `¿Suspender ${r.name || r.slug}?` : `¿Reactivar ${r.name || r.slug}?`}
            description={
              r.active
                ? "Verán un aviso de cuenta suspendida en todas las pantallas, incluso con mesas abiertas."
                : "Podrán volver a usar el sistema de inmediato."
            }
            confirmLabel={r.active ? "Suspender" : "Reactivar"}
            destructive={r.active}
            successMessage={r.active ? "Restaurante suspendido" : "Restaurante reactivado"}
            action={async () => {
              const res = await setRestaurantActive(r.id, !r.active);
              router.refresh();
              return res;
            }}
          >
            <Button variant={r.active ? "outline" : "default"} className={cn("h-11 rounded-xl", r.active && "text-red-300 hover:text-red-200")}>
              {r.active ? <Pause /> : <Play />} {r.active ? "Suspender" : "Reactivar"}
            </Button>
          </ConfirmAction>
        </section>
      </div>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Acceso al panel</h2>
          <p className="text-sm text-muted-foreground">Cuentas del restaurante. Si el dueño olvidó su contraseña, dale una temporal nueva.</p>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-4">
            Sin cuentas: quien entre a /login podrá crear la del dueño con la clave de instalación. Mejor créala aquí.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {accounts.map((a) => (
              <li key={a.id} className={cn("flex items-center gap-3 px-4 py-3", !a.active && "opacity-60")}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {!a.active
                      ? "Desactivada"
                      : a.pending
                        ? "Con contraseña temporal"
                        : a.lastLogin
                          ? `Entró ${new Date(a.lastLogin).toLocaleDateString("es-HN")}`
                          : "Nunca ha entrado"}
                  </p>
                </div>
                <span className="text-xs font-medium rounded-full bg-accent text-accent-foreground px-2.5 py-1 shrink-0">
                  {ROLE_LABEL[a.role] ?? a.role}
                </span>
                {a.role === "OWNER" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-xl"
                    aria-label={`Contraseña temporal nueva para ${a.name}`}
                    title="Contraseña temporal nueva"
                    disabled={granting}
                    onClick={() => grant(a.email, a.name)}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            grant(owner.email, owner.name);
          }}
          className="space-y-3 pt-2 border-t"
        >
          <p className="text-sm font-medium pt-3">Agregar otro dueño</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Nombre" aria-label="Nombre del dueño" value={owner.name} onChange={(e) => setOwner((o) => ({ ...o, name: e.target.value }))} className="h-11 rounded-xl" />
            <Input required type="email" placeholder="Correo" aria-label="Correo del dueño" value={owner.email} onChange={(e) => setOwner((o) => ({ ...o, email: e.target.value }))} className="h-11 rounded-xl" />
          </div>
          <Button type="submit" variant="outline" className="h-11 rounded-xl" disabled={granting}>
            {granting && <Loader2 className="animate-spin" />} Dar acceso de dueño
          </Button>
        </form>
      </section>

      <HandoffDialog data={handoff} onClose={() => setHandoff(null)} />
    </div>
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
