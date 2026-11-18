"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { loginAdmin, setupOwner } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/Brand";

export function LoginForm({ mode, business, next }: { mode: "login" | "setup"; business: string; next: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setup = mode === "setup";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const result = setup ? await setupOwner(data) : await loginAdmin(data);
    // Si todo sale bien la acción redirige; aquí solo llegan los errores
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink-950 flex flex-col p-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-medium h-11 px-2 self-start"
      >
        <ArrowLeft className="size-5" /> Volver al punto de venta
      </Link>

      <div className="flex-1 flex items-center justify-center pb-10">
        <div className="bg-card border w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/40">
          <BrandLogo className="h-20 mb-7 -ml-1" priority />
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {setup ? <KeyRound className="size-5 text-primary" /> : <LockKeyhole className="size-5 text-primary" />}
            {setup ? "Crea la cuenta del dueño" : "Administración"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {setup ? (
              <>
                Primer acceso a <span className="text-foreground font-medium">{business}</span>. Con esta cuenta
                entrarás al panel y podrás dar acceso a otras personas.
              </>
            ) : (
              <>
                Entra al panel de <span className="text-foreground font-medium">{business}</span>.
              </>
            )}
          </p>

          <form method="post" onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            {setup && (
              <Field label="Tu nombre">
                <Input name="name" required autoComplete="name" className="h-12 rounded-xl" />
              </Field>
            )}
            <Field label="Correo">
              <Input
                type="email"
                name="email"
                required
                autoFocus={!setup}
                autoComplete={setup ? "email" : "username"}
                className="h-12 rounded-xl"
              />
            </Field>
            <Field label={setup ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}>
              <Input
                type="password"
                name="password"
                required
                minLength={setup ? 8 : undefined}
                autoComplete={setup ? "new-password" : "current-password"}
                aria-invalid={!!error}
                className="h-12 rounded-xl"
              />
            </Field>
            {setup && (
              <>
                <Field label="Repite la contraseña">
                  <Input type="password" name="confirm" required autoComplete="new-password" className="h-12 rounded-xl" />
                </Field>
                <Field label="Clave de instalación" hint="La que te dio el proveedor del sistema (antes era la contraseña del panel).">
                  <Input type="password" name="setupKey" required autoComplete="off" className="h-12 rounded-xl" />
                </Field>
              </>
            )}
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-base">
              {loading && <Loader2 className="animate-spin" />}
              {setup ? "Crear cuenta y entrar" : "Entrar"}
            </Button>
            {!setup && (
              <p className="text-xs text-muted-foreground text-center">
                ¿Olvidaste tu contraseña? Pídele al dueño del restaurante que te asigne una nueva.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    // El <label> envuelve el campo: así el nombre del campo queda asociado sin ids
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium leading-none">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
