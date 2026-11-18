"use client";

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { loginPlatform } from "@/app/platform-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/Brand";

export function PlatformLoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await loginPlatform(new FormData(e.currentTarget));
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink-950 grid place-items-center p-4">
      <div className="bg-card border w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/40">
        <BrandLogo className="h-20 mb-7 -ml-1" priority />
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Building2 className="size-5 text-primary" /> Plataforma
        </h1>
        <p className="text-muted-foreground mt-1">Administración de los restaurantes que usan Ristemo.</p>
        <form method="post" onSubmit={submit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Correo</span>
            <Input type="email" name="email" required autoFocus autoComplete="username" className="h-12 rounded-xl" />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium">Contraseña</span>
            <Input type="password" name="password" required autoComplete="current-password" aria-invalid={!!error} className="h-12 rounded-xl" />
          </label>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-base">
            {loading && <Loader2 className="animate-spin" />} Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
