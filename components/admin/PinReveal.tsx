"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Oculta el PIN por defecto para que no quede a la vista en el panel. */
export function PinReveal({ pin }: { pin: string }) {
  const [show, setShow] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg bg-muted text-sm font-mono tabular hover:bg-accent"
      aria-label={show ? "Ocultar PIN" : "Mostrar PIN"}
    >
      <span className="tracking-[0.3em]">{show ? pin : "••••"}</span>
      {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
    </button>
  );
}
