"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copia el pedido en texto, listo para pegarlo en WhatsApp al proveedor. */
export function CopyOrderButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 rounded-xl"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast.success("Pedido copiado. Pégalo en WhatsApp o en un correo.");
          setTimeout(() => setDone(false), 2000);
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar pedido
    </Button>
  );
}
