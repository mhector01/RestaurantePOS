"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, LockKeyhole } from "lucide-react";
import { loginAdmin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await loginAdmin(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-stone-950 flex flex-col p-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-sm font-medium h-11 px-2 self-start"
      >
        <ArrowLeft className="size-5" /> Volver al punto de venta
      </Link>

      <div className="flex-1 flex items-center justify-center pb-10">
        <div className="bg-card w-full max-w-sm rounded-3xl p-8 shadow-2xl">
          <span className="size-14 rounded-2xl bg-accent text-primary grid place-items-center mb-5">
            <LockKeyhole className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold">Administración</h1>
          <p className="text-muted-foreground mt-1">Ingresa la contraseña del administrador.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              type="password"
              name="password"
              placeholder="Contraseña"
              required
              autoFocus
              aria-invalid={!!error}
              className="h-12 rounded-xl text-lg"
            />
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-base">
              {loading && <Loader2 className="animate-spin" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
