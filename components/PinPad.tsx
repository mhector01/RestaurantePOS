"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, Delete, Loader2, Settings } from "lucide-react";
import { loginWaiter } from "@/app/actions";
import { BrandLogo } from "@/components/Brand";
import { cn } from "@/lib/utils";

interface Props {
  /** "screen" ocupa toda la pantalla; "inline" se usa dentro de un diálogo. */
  variant?: "screen" | "inline";
  title?: string;
  subtitle?: string;
  onSuccess?: () => void;
  /** Pantalla de inicio bloqueada: en vez de "Volver", muestra accesos a cocina y administración. */
  lockScreen?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PinPad({
  variant = "screen",
  title = "¿Quién atiende?",
  subtitle = "Ingresa tu PIN de 4 dígitos",
  onSuccess,
  lockScreen = false,
}: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setLoading(true);
      const res = await loginWaiter(value);
      if (res?.error) {
        setError(true);
        setPin("");
        setLoading(false);
        if (navigator.vibrate) navigator.vibrate(150);
        return;
      }
      toast.success(`Hola, ${res.name}`);
      router.refresh();
      onSuccess?.();
    },
    [router, onSuccess]
  );

  const press = useCallback(
    (num: string) => {
      if (loading || pin.length >= 4) return;
      setError(false);
      const next = pin + num;
      setPin(next);
      if (next.length === 4) submit(next);
    },
    [loading, pin, submit]
  );

  const back = useCallback(() => {
    if (!loading) setPin((p) => p.slice(0, -1));
  }, [loading]);

  // Permite usar el teclado físico
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  // Las teclas se achican según el alto disponible (celular bajo, tablet acostada) para que
  // todo quepa sin desplazar la pantalla
  const keyClass = cn(
    "rounded-2xl text-2xl font-semibold transition-all active:scale-95 select-none disabled:opacity-40",
    variant === "screen" ? "h-[clamp(3rem,9dvh,4.5rem)]" : "h-16"
  );

  const pad = (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center">
      <h2 className={cn("text-xl font-semibold", variant === "screen" && "text-white text-2xl")}>{title}</h2>
      <p className={cn("text-sm mt-1", variant === "screen" ? "text-ink-400" : "text-muted-foreground")}>
        {subtitle}
      </p>

      <div className={cn("flex gap-4", variant === "screen" ? "my-[clamp(1rem,3.5dvh,1.75rem)]" : "my-7", error && "animate-[shake_0.35s]")}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-3.5 rounded-full transition-all",
              i < pin.length
                ? "bg-primary scale-110"
                : variant === "screen"
                ? "bg-ink-700"
                : "bg-muted-foreground/25",
              error && "bg-destructive"
            )}
          />
        ))}
      </div>

      <div className="h-6 -mt-3 mb-3 text-sm font-medium">
        {loading ? (
          <span className="flex items-center gap-2 text-primary">
            <Loader2 className="size-4 animate-spin" /> Verificando…
          </span>
        ) : error ? (
          <span className="text-destructive">PIN incorrecto, intenta de nuevo</span>
        ) : null}
      </div>

      <div className={cn("grid grid-cols-3 w-full", variant === "screen" ? "gap-[clamp(0.5rem,1.6dvh,0.75rem)]" : "gap-3")}>
        {KEYS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={loading}
            onClick={() => press(n)}
            className={cn(
              keyClass,
              variant === "screen" ? "bg-ink-800 text-white hover:bg-ink-700" : "bg-muted hover:bg-accent"
            )}
          >
            {n}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={loading}
          onClick={() => press("0")}
          className={cn(
            keyClass,
            variant === "screen" ? "bg-ink-800 text-white hover:bg-ink-700" : "bg-muted hover:bg-accent"
          )}
        >
          0
        </button>
        <button
          type="button"
          aria-label="Borrar"
          disabled={loading || pin.length === 0}
          onClick={back}
          className={cn(
            keyClass,
            "flex items-center justify-center",
            variant === "screen" ? "text-ink-300 hover:bg-ink-800" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Delete className="size-7" />
        </button>
      </div>
    </div>
  );

  if (variant === "inline") return pad;

  return (
    // Alto fijo de la pantalla: no se desplaza ni "rebota" (solo si de verdad no cabe, como un
    // celular acostado, permite desplazar para no cortar teclas)
    <div className="h-dvh overflow-y-auto overscroll-none bg-ink-950 flex flex-col p-4">
      {lockScreen ? (
        <div className="flex justify-end gap-2">
          <Link
            href="/cocina"
            className="inline-flex items-center gap-2 h-10 px-3 rounded-full border border-white/10 bg-white/5 text-ink-300 hover:text-white text-sm font-medium"
          >
            <ChefHat className="size-4" /> Cocina
          </Link>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 h-10 px-3 rounded-full border border-white/10 bg-white/5 text-ink-300 hover:text-white text-sm font-medium"
          >
            <Settings className="size-4" /> Administración
          </Link>
        </div>
      ) : (
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-ink-400 hover:text-white text-sm font-medium h-11 px-2 self-start"
        >
          <ArrowLeft className="size-5" /> Volver a mesas
        </Link>
      )}
      <div className="flex-1 flex flex-col items-center justify-center gap-[clamp(0.75rem,4dvh,2rem)] pb-[clamp(0.5rem,4dvh,2.5rem)]">
        <BrandLogo className="h-[clamp(2.25rem,7dvh,3.5rem)] w-auto shrink-0" priority />
        {pad}
      </div>
    </div>
  );
}
