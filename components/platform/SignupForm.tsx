"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChefHat, FileText, Loader2, Package, Receipt, X } from "lucide-react";
import { checkSlug, registerRestaurant, type SignupInput } from "@/app/signup-actions";
import { callAction } from "@/lib/client-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/Brand";
import { cn } from "@/lib/utils";

function suggestSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const FEATURES = [
  { Icon: Receipt, title: "Punto de venta", text: "Mesas, pedidos para llevar, cuentas divididas y combos." },
  { Icon: ChefHat, title: "Pantalla de cocina", text: "Los pedidos llegan solos y el mesero ve cuándo están listos." },
  { Icon: Package, title: "Inventario", text: "Recetas, compras, proveedores y alertas de stock bajo." },
  { Icon: FileText, title: "Facturación SAR", text: "Factura con CAI, ISV 15% y 18%, y reportes para la declaración." },
];

export function SignupForm({ trialDays, domain }: { trialDays: number; domain: string }) {
  const [form, setForm] = useState<SignupInput>({ restaurant: "", slug: "", name: "", email: "", phone: "", password: "", website: "" });
  const [confirm, setConfirm] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "free" | "taken">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const check = useRef(0);

  const set = (k: keyof SignupInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === "restaurant" && !slugTouched ? { slug: suggestSlug(v) } : {}) }));
  };

  // Revisa si la dirección está libre mientras se escribe (con una pequeña espera)
  useEffect(() => {
    const slug = form.slug;
    const n = ++check.current;
    const t = setTimeout(async () => {
      if (slug.length < 2) return setSlugState("idle");
      setSlugState("checking");
      const res = await callAction(() => checkSlug(slug));
      if (n !== check.current) return;
      setSlugState("available" in res && res.available ? "free" : "available" in res ? "taken" : "idle");
    }, 400);
    return () => clearTimeout(t);
  }, [form.slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== confirm) return setError("Las contraseñas no coinciden");
    setLoading(true);
    const res = await callAction(() => registerRestaurant(form));
    if ("redirectTo" in res && res.redirectTo) {
      window.location.href = res.redirectTo;
      return;
    }
    setError(("error" in res && res.error) || "No se pudo completar el registro");
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-14 grid lg:grid-cols-[1fr_minmax(0,28rem)] gap-10 items-start">
        <div className="lg:pt-6">
          <BrandLogo className="h-16 sm:h-20 -ml-1" priority />
          <h1 className="mt-8 text-3xl sm:text-4xl font-semibold tracking-tight text-white">Tu restaurante, en orden desde hoy</h1>
          <p className="mt-3 text-lg text-ink-300 max-w-xl">
            Crea tu cuenta y empieza a vender en minutos. {trialDays > 0 ? `${trialDays} días de prueba gratis, sin tarjeta.` : ""}
          </p>
          <ul className="mt-8 grid sm:grid-cols-2 gap-4 max-w-2xl">
            {FEATURES.map(({ Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Icon className="size-5 text-primary" />
                <p className="mt-2 font-medium text-white">{title}</p>
                <p className="text-sm text-ink-300">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <form method="post" onSubmit={submit} className="bg-card border rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Crea tu restaurante</h2>
            <p className="text-sm text-muted-foreground">Con estos datos entras al panel de administración.</p>
          </div>

          <Field label="Nombre del restaurante">
            <Input required value={form.restaurant} onChange={set("restaurant")} placeholder="Ej. Baleadas Doña Marta" className="h-12 rounded-xl" />
          </Field>

          <Field label="Dirección de tu sistema">
            <div className="flex items-center rounded-xl border h-12 overflow-hidden focus-within:ring-2 focus-within:ring-ring/50">
              <input
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) }));
                }}
                aria-label="Subdominio"
                className="flex-1 min-w-0 bg-transparent px-3 text-sm outline-none font-mono"
              />
              <span className="px-3 text-sm text-muted-foreground font-mono bg-muted/40 h-full grid place-items-center shrink-0">.{domain}</span>
            </div>
            <span className={cn("flex items-center gap-1 text-xs", slugState === "taken" ? "text-red-300" : slugState === "free" ? "text-emerald-300" : "text-muted-foreground")}>
              {slugState === "checking" && <Loader2 className="size-3 animate-spin" />}
              {slugState === "free" && <Check className="size-3" />}
              {slugState === "taken" && <X className="size-3" />}
              {slugState === "taken" ? "Ya está en uso, prueba otra" : slugState === "free" ? "Disponible" : "Así entrarás tú y tu personal."}
            </span>
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tu nombre">
              <Input required autoComplete="name" value={form.name} onChange={set("name")} className="h-12 rounded-xl" />
            </Field>
            <Field label="Teléfono / WhatsApp">
              <Input required type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="9999-9999" className="h-12 rounded-xl" />
            </Field>
          </div>
          <Field label="Correo">
            <Input required type="email" autoComplete="email" value={form.email} onChange={set("email")} className="h-12 rounded-xl" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Contraseña (mín. 8)">
              <Input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} className="h-12 rounded-xl" />
            </Field>
            <Field label="Repítela">
              <Input required type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-12 rounded-xl" />
            </Field>
          </div>

          {/* Campo trampa para bots: invisible para las personas */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} className="hidden" aria-hidden="true" />

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || slugState === "taken"} className="w-full h-12 rounded-xl text-base">
            {loading && <Loader2 className="animate-spin" />} {trialDays > 0 ? "Empezar prueba gratis" : "Crear mi restaurante"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Al terminar entras directo a tu panel para configurar mesas, menú y meseros.</p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
